# train_local_multilabel.py
# PTB-XL 5-superclass Multi-Label training
# (개선점 적용: Amplitude Feature Injection + Threshold Tuning + Weight Clipping)

import os
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.backends.cudnn as cudnn
from torch.utils.data import Dataset, DataLoader
from scipy.signal import butter, filtfilt
from sklearn.metrics import f1_score, roc_auc_score

# =============================================================================
# 1) MODEL: Amplitude Feature를 받아들이도록 수정
# =============================================================================
class ChannelAttention(nn.Module):
    def __init__(self, in_planes, ratio=16):
        super().__init__()
        self.avg_pool = nn.AdaptiveAvgPool1d(1)
        self.max_pool = nn.AdaptiveMaxPool1d(1)
        mid = max(in_planes // ratio, 4)
        self.fc = nn.Sequential(
            nn.Conv1d(in_planes, mid, 1, bias=False),
            nn.ReLU(),
            nn.Conv1d(mid, in_planes, 1, bias=False),
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        return self.sigmoid(self.fc(self.avg_pool(x)) + self.fc(self.max_pool(x)))

class SpatialAttention(nn.Module):
    def __init__(self, k=7):
        super().__init__()
        self.conv = nn.Conv1d(2, 1, k, padding=k // 2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg = x.mean(dim=1, keepdim=True)
        mx, _ = x.max(dim=1, keepdim=True)
        return self.sigmoid(self.conv(torch.cat([avg, mx], dim=1)))

class CBAM(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.ca = ChannelAttention(c, ratio=8)
        self.sa = SpatialAttention()

    def forward(self, x):
        return x * self.sa(x * self.ca(x))

class ConvBlock(nn.Module):
    def __init__(self, cin, cout):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv1d(cin, cout, 3, padding=1),
            nn.BatchNorm1d(cout),
            nn.ReLU(inplace=True),
            nn.MaxPool1d(2),
            CBAM(cout), # CBAM 위치 조정 (Pooling 후 혹은 전, 여기선 유지)
        )

    def forward(self, x):
        return self.block(x)

class CNN_CBAM_GRU(nn.Module):
    def __init__(self, num_classes=5, amp_dim=36): # ✅ amp_dim 추가 (12 leads * 3 features)
        super().__init__()
        self.c1 = ConvBlock(12, 32)
        self.c2 = ConvBlock(32, 32)

        self.gru = nn.GRU(
            input_size=32, hidden_size=64,
            num_layers=2, batch_first=True,
            bidirectional=True, dropout=0.5
        )
        
        # ✅ FC Layer 수정: GRU 출력(128) + Amp Feature(36) = 164
        self.fc = nn.Sequential(
            nn.Linear(128 + amp_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, num_classes)
        )

    def forward(self, x, amp): # ✅ amp 입력 받음
        # x: (B, 12, L)
        x = self.c1(x)
        x = self.c2(x)
        x = x.permute(0, 2, 1)  # (B, T, C)
        self.gru.flatten_parameters()
        x, _ = self.gru(x)
        x = x.mean(dim=1)       # (B, 128) - GRU Context Vector
        
        # ✅ Feature Concatenation (Deep Feature + Hand-Crafted Amplitude)
        combined = torch.cat([x, amp], dim=1) # (B, 128+36)
        
        return self.fc(combined)

# =============================================================================
# 2) DATASET: Amplitude Feature 추출 로직 추가
# =============================================================================
class ECGDatasetMulti(Dataset):
    def __init__(self, X_path, y_path, fs=500, do_filter=True, augment=False):
        self.X = np.load(X_path, mmap_mode="r")
        self.y = np.load(y_path).astype(np.float32)
        self.do_filter = do_filter
        self.augment = augment

        nyq = 0.5 * fs
        low = 0.5 / nyq
        high = 45.0 / nyq
        eps = 1e-3
        if high >= 1.0: high = 1.0 - eps
        if low <= 0.0: low = eps
        self.b, self.a = butter(2, [low, high], btype="band")

    def __len__(self):
        return len(self.X)

    def _to_12xL(self, x: np.ndarray) -> np.ndarray:
        if x.shape[0] == 12: return x
        if x.shape[1] == 12: return x.T
        raise ValueError(f"Expected (12,L) or (L,12), got {x.shape}")

    def _apply_filter(self, x12xL: np.ndarray) -> np.ndarray:
        return filtfilt(self.b, self.a, x12xL, axis=1).astype(np.float32)

    def _normalize(self, x12xL: np.ndarray) -> np.ndarray:
        mean = x12xL.mean(axis=1, keepdims=True)
        std = x12xL.std(axis=1, keepdims=True) + 1e-6
        return ((x12xL - mean) / std).astype(np.float32)

    def _augment(self, x12xL: np.ndarray) -> np.ndarray:
        out = x12xL.copy()
        scale = np.random.uniform(0.95, 1.05)
        out *= scale
        shift = np.random.randint(-10, 11)
        if shift > 0:
            out[:, shift:] = out[:, :-shift]; out[:, :shift] = 0
        elif shift < 0:
            out[:, :shift] = out[:, -shift:]; out[:, shift:] = 0
        noise = np.random.normal(0, 0.01, out.shape).astype(np.float32)
        out += noise
        return out.astype(np.float32)

    # ✅ 진폭 피처 추출 함수 (정규화 전에 호출해야 함!)
    def _amp_feats(self, x12xL: np.ndarray) -> np.ndarray:
        # 각 리드별: PTP(최대-최소), STD(표준편차), RMS(실효값)
        ptp = x12xL.max(axis=1) - x12xL.min(axis=1)      # (12,)
        std = x12xL.std(axis=1)                          # (12,)
        rms = np.sqrt(np.mean(x12xL**2, axis=1) + 1e-8)  # (12,)
        
        # 3가지 특징을 이어 붙임 -> 총 36개 특징
        feats = np.concatenate([ptp, std, rms], axis=0)
        return feats.astype(np.float32)

    def __getitem__(self, idx):
        x = np.array(self.X[idx], dtype=np.float32)
        x = self._to_12xL(x)

        if self.do_filter:
            x = self._apply_filter(x)
        if self.augment:
            x = self._augment(x)

        # ✅ 핵심: 정규화(Normalize) 전에 진폭 정보(Amp)를 추출
        amp = self._amp_feats(x)

        x = self._normalize(x)
        y = self.y[idx]
        
        # x, amp, y 세 가지를 리턴
        return torch.from_numpy(x).float(), torch.from_numpy(amp).float(), torch.from_numpy(y).float()

# =============================================================================
# 3) METRICS: Threshold Tuning & Evaluation
# =============================================================================
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

# (A) 확률과 정답을 수집하는 함수
def evaluate_return_probs(model, loader, device):
    model.eval()
    all_probs, all_true = [], []
    with torch.no_grad():
        for x, amp, y in loader: # amp 추가
            x = x.to(device, non_blocking=True)
            amp = amp.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            logits = model(x, amp)
            probs = torch.sigmoid(logits)
            
            all_probs.append(probs.detach().cpu().numpy())
            all_true.append(y.detach().cpu().numpy())

    y_true = np.concatenate(all_true, axis=0)
    y_prob = np.concatenate(all_probs, axis=0)
    return y_true, y_prob

# (B) 최적의 Threshold를 찾는 함수 (Val 셋용)
def find_best_thresholds(y_true, y_prob):
    # 0.05 ~ 0.95 사이를 탐색
    thresholds_candidates = np.linspace(0.05, 0.95, 19)
    n_classes = y_true.shape[1]
    best_thresholds = np.zeros(n_classes)
    
    for c in range(n_classes):
        best_f1 = -1.0
        best_t = 0.5
        for t in thresholds_candidates:
            pred = (y_prob[:, c] >= t).astype(int)
            f1 = f1_score(y_true[:, c], pred, zero_division=0)
            if f1 > best_f1:
                best_f1 = f1
                best_t = t
        best_thresholds[c] = best_t
        
    return best_thresholds

# (C) 정해진 Threshold로 점수 리포팅
def report_metrics(y_true, y_prob, thresholds):
    # 각 클래스별로 다른 threshold 적용
    y_pred = np.zeros_like(y_prob)
    for c in range(y_true.shape[1]):
        y_pred[:, c] = (y_prob[:, c] >= thresholds[c]).astype(int)

    micro_f1 = f1_score(y_true, y_pred, average="micro", zero_division=0) * 100
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0) * 100
    
    try:
        macro_auc = roc_auc_score(y_true, y_prob, average="macro") * 100
        per_class_auc = roc_auc_score(y_true, y_prob, average=None) * 100
    except:
        macro_auc = 0.0
        per_class_auc = [0]*5

    per_class_f1 = f1_score(y_true, y_pred, average=None, zero_division=0) * 100

    print(f"  >> Micro F1: {micro_f1:.2f}% | Macro F1: {macro_f1:.2f}% | Macro AUROC: {macro_auc:.2f}%")
    print(f"  >> Thresholds used: {np.round(thresholds, 2)}")
    for i, name in enumerate(LABELS):
        print(f"     - {name:4s} | F1: {per_class_f1[i]:6.2f}% | AUROC: {per_class_auc[i]:6.2f}% | Thr: {thresholds[i]:.2f}")
    
    return macro_f1

# =============================================================================
# 4) TRAIN
# =============================================================================
def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data = os.path.join(root, "data", "processed")
    models = os.path.join(root, "models")
    os.makedirs(models, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("Device:", device)
    if device.type == "cuda":
        cudnn.benchmark = True
        print("GPU:", torch.cuda.get_device_name(0))

    # ✅ Augment=True 로 변경 (Training set)
    train_ds = ECGDatasetMulti(os.path.join(data, "X_train.npy"), os.path.join(data, "y_train.npy"),
                               do_filter=True, augment=True) 
    val_ds   = ECGDatasetMulti(os.path.join(data, "X_val.npy"),   os.path.join(data, "y_val.npy"),
                               do_filter=True, augment=False)
    test_ds  = ECGDatasetMulti(os.path.join(data, "X_test.npy"),  os.path.join(data, "y_test.npy"),
                               do_filter=True, augment=False)

    train_ld = DataLoader(train_ds, batch_size=64, shuffle=True, num_workers=2,
                          pin_memory=(device.type == "cuda"), persistent_workers=True)
    val_ld   = DataLoader(val_ds, batch_size=64, shuffle=False, num_workers=2,
                          pin_memory=(device.type == "cuda"), persistent_workers=True)
    test_ld  = DataLoader(test_ds, batch_size=64, shuffle=False, num_workers=2,
                          pin_memory=(device.type == "cuda"), persistent_workers=True)

    # pos_weight 계산 & Clipping
    y_train = torch.from_numpy(train_ds.y)
    pos = y_train.sum(dim=0)
    neg = y_train.shape[0] - pos
    
    # ✅ 가중치 Clipping (최대 3.0배까지만 가중치 부여)
    raw_weights = neg / (pos + 1e-6)
    pos_weight = torch.clamp(raw_weights, min=1.0, max=3.0).to(device)

    print("pos per class:", pos.tolist())
    print("Clipped pos_weight:", pos_weight.detach().cpu().tolist())

    model = CNN_CBAM_GRU(num_classes=5, amp_dim=36).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.Adam(model.parameters(), lr=3e-4, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.1, patience=10)

    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best_score = -1e9
    best_path = os.path.join(models, "best_model_multilabel.pth")

    epochs = 200
    patience = 0
    max_patience = 30

    print("\n--- Training (Multi-Label) ---")
    for e in range(epochs):
        model.train()
        running = 0.0

        for x, amp, y in train_ld: # amp 추가
            x = x.to(device, non_blocking=True)
            amp = amp.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=use_amp):
                logits = model(x, amp) # forward(x, amp)
                loss = criterion(logits, y)

            scaler.scale(loss).backward()
            if use_amp:
                scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()

            running += float(loss.detach().cpu().item())

        avg_loss = running / max(1, len(train_ld))
        lr = optimizer.param_groups[0]["lr"]
        print(f"Epoch {e+1:3d} | LR {lr:.6f} | Train Loss {avg_loss:.4f}")

        # ✅ Validation with Threshold Tuning
        val_true, val_prob = evaluate_return_probs(model, val_ld, device)
        best_thr = find_best_thresholds(val_true, val_prob) # Val에서 최적 Threshold 찾기
        macro_f1 = report_metrics(val_true, val_prob, best_thr) # 찾은 Thr로 평가

        scheduler.step(macro_f1)

        if macro_f1 > best_score:
            best_score = macro_f1
            patience = 0
            torch.save(model.state_dict(), best_path)
            print(f"    --> Best updated! (Macro F1: {best_score:.2f}%)")
        else:
            patience += 1
            if patience >= max_patience:
                print(f"\n[Early Stopping] No improvement for {max_patience} epochs.")
                break

    print("\n--- Final Test ---")
    if os.path.exists(best_path):
        try:
            state = torch.load(best_path, map_location=device, weights_only=True)
        except TypeError:
            state = torch.load(best_path, map_location=device)
        model.load_state_dict(state)

        # 1. Best Model 기준으로 Validation에서 다시 최적 Threshold 산출
        # (학습 때 저장 안 했으므로 다시 계산하는 것이 가장 간편함)
        print("Calculating optimal thresholds from Validation Set...")
        val_true, val_prob = evaluate_return_probs(model, val_ld, device)
        final_thresholds = find_best_thresholds(val_true, val_prob)
        print("Optimal Thresholds:", np.round(final_thresholds, 2))

        # 2. Test Set 평가에 적용
        print("Applying to Test Set...")
        test_true, test_prob = evaluate_return_probs(model, test_ld, device)
        report_metrics(test_true, test_prob, final_thresholds)
        
        print("Saved model:", best_path)
    else:
        print("Best model not found:", best_path)

if __name__ == "__main__":
    main()