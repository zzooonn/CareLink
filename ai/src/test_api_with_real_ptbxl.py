# train_local_multilabel.py
# PTB-XL 5-superclass Multi-Label training (GPU/AMP 안정화)

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
# 1) MODEL (서버 구조 그대로)
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
            CBAM(cout),
            nn.MaxPool1d(2),
        )

    def forward(self, x):
        return self.block(x)

class CNN_CBAM_GRU(nn.Module):
    def __init__(self, num_classes=5):
        super().__init__()
        self.c1 = ConvBlock(12, 32)
        self.c2 = ConvBlock(32, 32)

        self.gru = nn.GRU(
            input_size=32, hidden_size=64,
            num_layers=2, batch_first=True,
            bidirectional=True, dropout=0.5
        )

        self.fc = nn.Sequential(
            nn.Linear(128, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, num_classes)  # logits (B,5)
        )

    def forward(self, x):
        # x: (B, 12, L)
        x = self.c1(x)
        x = self.c2(x)
        x = x.permute(0, 2, 1)  # (B, T, C)
        self.gru.flatten_parameters()
        x, _ = self.gru(x)
        x = x.mean(dim=1)       # (B, 128)
        return self.fc(x)       # (B, 5) logits

# =============================================================================
# 2) DATASET (X: (N,5000,12) or (N,12,5000), y: (N,5))
# =============================================================================
class ECGDatasetMulti(Dataset):
    def __init__(self, X_path, y_path, fs=500, do_filter=True, augment=False):
        self.X = np.load(X_path, mmap_mode="r")
        self.y = np.load(y_path).astype(np.float32)  # (N,5) multi-hot
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
        # x: (5000,12) or (12,5000)
        if x.shape[0] == 12:
            return x
        if x.shape[1] == 12:
            return x.T
        raise ValueError(f"Expected (12,L) or (L,12), got {x.shape}")

    def _apply_filter(self, x12xL: np.ndarray) -> np.ndarray:
        return filtfilt(self.b, self.a, x12xL, axis=1).astype(np.float32)

    def _normalize(self, x12xL: np.ndarray) -> np.ndarray:
        mean = x12xL.mean(axis=1, keepdims=True)
        std = x12xL.std(axis=1, keepdims=True) + 1e-6
        return ((x12xL - mean) / std).astype(np.float32)

    def _augment(self, x12xL: np.ndarray) -> np.ndarray:
        # 필요하면 켜세요(처음엔 False 권장)
        out = x12xL.copy()
        scale = np.random.uniform(0.95, 1.05)
        out *= scale

        shift = np.random.randint(-10, 11)
        if shift > 0:
            out[:, shift:] = out[:, :-shift]
            out[:, :shift] = 0
        elif shift < 0:
            out[:, :shift] = out[:, -shift:]
            out[:, shift:] = 0

        noise = np.random.normal(0, 0.01, out.shape).astype(np.float32)
        out += noise
        return out.astype(np.float32)

    def __getitem__(self, idx):
        x = np.array(self.X[idx], dtype=np.float32)
        x = self._to_12xL(x)

        if self.do_filter:
            x = self._apply_filter(x)
        if self.augment:
            x = self._augment(x)

        x = self._normalize(x)

        y = self.y[idx]  # (5,)
        return torch.from_numpy(x).float(), torch.from_numpy(y).float()

# =============================================================================
# 3) METRICS
# =============================================================================
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

@torch.no_grad()
def evaluate_multilabel(model, loader, device, threshold=0.5):
    model.eval()
    all_probs = []
    all_true = []

    for x, y in loader:
        x = x.to(device, non_blocking=True)
        y = y.to(device, non_blocking=True)

        logits = model(x)                # (B,5)
        probs = torch.sigmoid(logits)    # (B,5)

        all_probs.append(probs.detach().cpu().numpy())
        all_true.append(y.detach().cpu().numpy())

    y_true = np.concatenate(all_true, axis=0)   # (N,5)
    y_prob = np.concatenate(all_probs, axis=0)  # (N,5)
    y_pred = (y_prob >= threshold).astype(np.int32)

    # F1 (멀티라벨)
    micro_f1 = f1_score(y_true, y_pred, average="micro", zero_division=0) * 100
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0) * 100
    per_class_f1 = f1_score(y_true, y_pred, average=None, zero_division=0) * 100

    # AUROC (threshold-free)
    try:
        macro_auc = roc_auc_score(y_true, y_prob, average="macro") * 100
        per_class_auc = roc_auc_score(y_true, y_prob, average=None) * 100
    except ValueError:
        macro_auc = float("nan")
        per_class_auc = np.array([np.nan] * y_true.shape[1])

    print(f"  >> Micro F1: {micro_f1:.2f}% | Macro F1: {macro_f1:.2f}% | Macro AUROC: {macro_auc:.2f}%")
    for i, name in enumerate(LABELS):
        print(f"     - {name:4s} | F1: {per_class_f1[i]:6.2f}% | AUROC: {per_class_auc[i]:6.2f}%")

    return macro_f1, macro_auc

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

    # Dataset
    train_ds = ECGDatasetMulti(os.path.join(data, "X_train.npy"), os.path.join(data, "y_train.npy"),
                               do_filter=True, augment=False)  # 처음엔 augment=False 추천
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

    # pos_weight 계산: (neg/pos) per class
    y_train = torch.from_numpy(train_ds.y)  # (N,5) float32
    pos = y_train.sum(dim=0)
    neg = y_train.shape[0] - pos
    pos_weight = (neg / (pos + 1e-6)).to(device)

    print("pos per class:", pos.tolist())
    print("pos_weight:", pos_weight.detach().cpu().tolist())

    model = CNN_CBAM_GRU(num_classes=5).to(device)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = optim.Adam(model.parameters(), lr=3e-4, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="max", factor=0.1, patience=10)

    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)

    best = -1e9
    best_path = os.path.join(models, "best_model_multilabel.pth")

    epochs = 200
    patience = 0
    max_patience = 30

    print("\n--- Training (Multi-Label) ---")
    for e in range(epochs):
        model.train()
        running = 0.0

        for x, y in train_ld:
            x = x.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)

            with torch.amp.autocast("cuda", enabled=use_amp):
                logits = model(x)          # (B,5)
                loss = criterion(logits, y)

            scaler.scale(loss).backward()

            # GRU 안정화용 gradient clipping
            if use_amp:
                scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)

            scaler.step(optimizer)
            scaler.update()

            running += float(loss.detach().cpu().item())

        avg_loss = running / max(1, len(train_ld))
        lr = optimizer.param_groups[0]["lr"]
        print(f"Epoch {e+1:3d} | LR {lr:.6f} | Train Loss {avg_loss:.4f}")

        macro_f1, macro_auc = evaluate_multilabel(model, val_ld, device, threshold=0.5)

        # 모델 선택 기준: Macro F1 우선(원하면 macro_auc로 바꿔도 됨)
        score = macro_f1
        scheduler.step(score)

        if score > best:
            best = score
            patience = 0
            torch.save(model.state_dict(), best_path)
            print(f"    --> Best updated! (Macro F1: {best:.2f}%)")
        else:
            patience += 1
            if patience >= max_patience:
                print(f"\n[Early Stopping] No improvement for {max_patience} epochs.")
                break

    print("\n--- Final Test ---")
    if os.path.exists(best_path):
        # torch.load warning 방지 (버전 호환 위해 try)
        try:
            state = torch.load(best_path, map_location=device, weights_only=True)
        except TypeError:
            state = torch.load(best_path, map_location=device)
        model.load_state_dict(state)
        evaluate_multilabel(model, test_ld, device, threshold=0.5)
        print("Saved model:", best_path)
    else:
        print("Best model not found:", best_path)

if __name__ == "__main__":
    main()
