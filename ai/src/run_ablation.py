#!/usr/bin/env python
# run_ablation.py
# =============================================================================
# Ablation Study: 각 기법의 기여도를 측정하기 위해 요소를 하나씩 제거하며 실험
#
# 실험 구성 (6가지):
#   1. Full          : 모든 기법 적용 (ASL + Amp + Filter + Sampler + Aug)
#   2. w/o ASL       : Focal Loss → 일반 BCE Loss로 교체
#   3. w/o Amp       : Amplitude Feature 제거 (amp_dim=0)
#   4. w/o Filter    : Bandpass Filter 제거
#   5. w/o Sampler   : WeightedRandomSampler 제거 (일반 shuffle)
#   6. w/o Aug       : Data Augmentation 제거
#
# 사용법:
#   python run_ablation.py
#   (결과는 models/ablation_results.csv 에 저장)
#
# 주의: epochs를 줄여서 빠르게 돌리려면 ABLATION_EPOCHS 수정
# =============================================================================

import os
import sys
import csv
import time
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
import torch.backends.cudnn as cudnn
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
from scipy.signal import butter, filtfilt
from sklearn.metrics import f1_score, roc_auc_score, confusion_matrix
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR

# ======================== 재현성: 랜덤 시드 고정 ========================
ABLATION_SEED = 42

def set_seed(seed: int):
    """모든 난수 생성기를 동일 시드로 고정하여 실험 재현성 확보"""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False

# ======================== 설정 ========================
ABLATION_EPOCHS = 80        # Ablation용 에폭 (Full 학습보다 짧게)
PATIENCE = 15               # Early stopping patience
BATCH_SIZE = 64
LR = 1e-3

# =============================================================================
# LOSS FUNCTIONS
# =============================================================================
class AsymmetricLoss(nn.Module):
    def __init__(self, gamma_pos=0.0, gamma_neg=4.0, margin=0.05, pos_weight=None):
        super().__init__()
        self.gamma_pos = gamma_pos
        self.gamma_neg = gamma_neg
        self.margin = margin
        self.pos_weight = pos_weight

    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        probs_neg = (probs - self.margin).clamp(min=0)
        loss_pos = targets * (1 - probs) ** self.gamma_pos * torch.log(probs.clamp(min=1e-8))
        loss_neg = (1 - targets) * probs_neg ** self.gamma_neg * torch.log((1 - probs_neg).clamp(min=1e-8))
        if self.pos_weight is not None:
            loss_pos = loss_pos * self.pos_weight.to(logits.device)
        return -(loss_pos + loss_neg).mean()


class SimpleBCELoss(nn.Module):
    """Ablation용: ASL 대신 일반 BCE + pos_weight"""
    def __init__(self, pos_weight=None):
        super().__init__()
        self.pos_weight = pos_weight

    def forward(self, logits, targets):
        return nn.functional.binary_cross_entropy_with_logits(
            logits, targets, pos_weight=self.pos_weight
        )


# =============================================================================
# MODEL: ResNet1D
# =============================================================================
class ResidualBlock1D(nn.Module):
    def __init__(self, cin, cout, stride=1, dropout=0.2):
        super().__init__()
        self.conv1 = nn.Conv1d(cin, cout, 7, stride=stride, padding=3, bias=False)
        self.bn1 = nn.BatchNorm1d(cout)
        self.relu = nn.ReLU(inplace=True)
        self.drop = nn.Dropout(dropout)
        self.conv2 = nn.Conv1d(cout, cout, 7, padding=3, bias=False)
        self.bn2 = nn.BatchNorm1d(cout)
        self.skip = nn.Sequential(
            nn.Conv1d(cin, cout, 1, stride=stride, bias=False),
            nn.BatchNorm1d(cout),
        ) if (cin != cout or stride != 1) else nn.Identity()

    def forward(self, x):
        out = self.drop(self.relu(self.bn1(self.conv1(x))))
        out = self.bn2(self.conv2(out))
        return self.relu(out + self.skip(x))


class ResNet1D(nn.Module):
    def __init__(self, num_classes=5, amp_dim=36):
        super().__init__()
        self.amp_dim = amp_dim
        self.stem = nn.Sequential(
            nn.Conv1d(12, 64, 15, stride=2, padding=7, bias=False),
            nn.BatchNorm1d(64), nn.ReLU(inplace=True),
            nn.MaxPool1d(3, stride=2, padding=1),
        )
        self.layer1 = nn.Sequential(ResidualBlock1D(64, 64), ResidualBlock1D(64, 64))
        self.layer2 = nn.Sequential(ResidualBlock1D(64, 128, stride=2), ResidualBlock1D(128, 128))
        self.layer3 = nn.Sequential(ResidualBlock1D(128, 256, stride=2), ResidualBlock1D(256, 256))
        self.layer4 = nn.Sequential(ResidualBlock1D(256, 512, stride=2), ResidualBlock1D(512, 512))
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.head = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(512 + amp_dim, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )

    def forward(self, x, amp=None):
        x = self.stem(x)
        x = self.layer1(x); x = self.layer2(x)
        x = self.layer3(x); x = self.layer4(x)
        feat = self.pool(x).squeeze(-1)
        if amp is not None and self.amp_dim > 0:
            feat = torch.cat([feat, amp], dim=1)
        return self.head(feat)


# =============================================================================
# DATASET
# =============================================================================
class ECGDatasetMulti(Dataset):
    def __init__(self, X_path, y_path, fs=500, do_filter=True, augment=False, use_amp=True):
        self.X = np.load(X_path, mmap_mode="r")
        self.y = np.load(y_path).astype(np.float32)
        self.do_filter = do_filter
        self.augment = augment
        self.use_amp = use_amp

        nyq = 0.5 * fs
        low = max(0.5 / nyq, 1e-3)
        high = min(45.0 / nyq, 1.0 - 1e-3)
        self.b, self.a = butter(2, [low, high], btype="band")

    def __len__(self):
        return len(self.X)

    def _to_12xL(self, x):
        if x.shape[0] == 12: return x
        if x.shape[1] == 12: return x.T
        raise ValueError(f"Expected (12,L) or (L,12), got {x.shape}")

    def _apply_filter(self, x):
        return filtfilt(self.b, self.a, x, axis=1).astype(np.float32)

    def _normalize(self, x):
        mean = x.mean(axis=1, keepdims=True)
        std = x.std(axis=1, keepdims=True) + 1e-6
        return ((x - mean) / std).astype(np.float32)

    def _augment(self, x):
        out = x.copy()
        if np.random.rand() < 0.5:
            out *= np.random.uniform(0.85, 1.15)
        if np.random.rand() < 0.5:
            shift = np.random.randint(-20, 21)
            if shift > 0:
                out[:, shift:] = out[:, :-shift]; out[:, :shift] = 0
            elif shift < 0:
                out[:, :shift] = out[:, -shift:]; out[:, shift:] = 0
        if np.random.rand() < 0.5:
            out += np.random.normal(0, 0.02, out.shape).astype(np.float32)
        if np.random.rand() < 0.3:
            t = np.arange(out.shape[1]) / 500.0
            freq = np.random.uniform(0.1, 0.4)
            amp = np.random.uniform(0.05, 0.2)
            out += amp * np.sin(2 * np.pi * freq * t)
        if np.random.rand() < 0.2:
            cuts = np.random.choice(12, np.random.randint(1, 3), replace=False)
            out[cuts, :] = 0.0
        return out.astype(np.float32)

    def _amp_feats(self, x):
        ptp = x.max(axis=1) - x.min(axis=1)
        std = x.std(axis=1)
        rms = np.sqrt(np.mean(x ** 2, axis=1) + 1e-8)
        return np.concatenate([ptp, std, rms], axis=0).astype(np.float32)

    def __getitem__(self, idx):
        x = np.array(self.X[idx], dtype=np.float32)
        x = self._to_12xL(x)
        if self.do_filter:
            x = self._apply_filter(x)

        # Amp 피처: augmentation 전 원본에서 추출
        if self.use_amp:
            amp = self._amp_feats(x)
        else:
            amp = np.zeros(36, dtype=np.float32)  # 제로 벡터 (모델 입력 형태 유지)

        if self.augment:
            x = self._augment(x)
        x = self._normalize(x)
        y = self.y[idx]
        return torch.from_numpy(x).float(), torch.from_numpy(amp).float(), torch.from_numpy(y).float()


# =============================================================================
# EVALUATION
# =============================================================================
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

def evaluate_return_probs(model, loader, device):
    model.eval()
    all_probs, all_true = [], []
    with torch.no_grad():
        for x, amp, y in loader:
            x = x.to(device, non_blocking=True)
            amp = amp.to(device, non_blocking=True)
            logits = model(x, amp)
            all_probs.append(torch.sigmoid(logits).cpu().numpy())
            all_true.append(y.numpy())
    return np.concatenate(all_true), np.concatenate(all_probs)


def find_best_thresholds(y_true, y_prob):
    candidates = np.linspace(0.05, 0.95, 37)
    best = np.zeros(y_true.shape[1])
    for c in range(y_true.shape[1]):
        best_f1, best_t = -1, 0.5
        for t in candidates:
            f1 = f1_score(y_true[:, c], (y_prob[:, c] >= t).astype(int), zero_division=0)
            if f1 > best_f1:
                best_f1, best_t = f1, t
        best[c] = best_t
    return best


def compute_metrics(y_true, y_prob, thresholds):
    """모든 주요 메트릭을 dict로 반환"""
    y_pred = np.zeros_like(y_prob)
    for c in range(y_true.shape[1]):
        y_pred[:, c] = (y_prob[:, c] >= thresholds[c]).astype(int)

    micro_f1 = f1_score(y_true, y_pred, average="micro", zero_division=0) * 100
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0) * 100
    per_f1 = f1_score(y_true, y_pred, average=None, zero_division=0) * 100

    try:
        macro_auc = roc_auc_score(y_true, y_prob, average="macro") * 100
        per_auc = roc_auc_score(y_true, y_prob, average=None) * 100
    except:
        macro_auc = 0.0
        per_auc = np.zeros(5)

    return {
        "micro_f1": micro_f1, "macro_f1": macro_f1, "macro_auc": macro_auc,
        "NORM_f1": per_f1[0], "STTC_f1": per_f1[1], "MI_f1": per_f1[2],
        "CD_f1": per_f1[3], "HYP_f1": per_f1[4],
        "NORM_auc": per_auc[0], "STTC_auc": per_auc[1], "MI_auc": per_auc[2],
        "CD_auc": per_auc[3], "HYP_auc": per_auc[4],
        "thresholds": np.round(thresholds, 2).tolist(),
    }


# =============================================================================
# SINGLE EXPERIMENT RUNNER
# =============================================================================
def run_single_experiment(config, data_dir, device):
    """
    config dict:
      name, use_asl, use_amp, use_filter, use_sampler, use_augment
    """
    name = config["name"]
    print(f"\n{'='*60}")
    print(f"  ABLATION: {name}")
    print(f"  ASL={config['use_asl']}, Amp={config['use_amp']}, "
          f"Filter={config['use_filter']}, Sampler={config['use_sampler']}, "
          f"Aug={config['use_augment']}")
    print(f"{'='*60}")

    amp_dim = 36 if config["use_amp"] else 0

    # Dataset
    train_ds = ECGDatasetMulti(
        os.path.join(data_dir, "X_train.npy"), os.path.join(data_dir, "y_train.npy"),
        do_filter=config["use_filter"], augment=config["use_augment"],
        use_amp=config["use_amp"])
    val_ds = ECGDatasetMulti(
        os.path.join(data_dir, "X_val.npy"), os.path.join(data_dir, "y_val.npy"),
        do_filter=config["use_filter"], augment=False,
        use_amp=config["use_amp"])
    test_ds = ECGDatasetMulti(
        os.path.join(data_dir, "X_test.npy"), os.path.join(data_dir, "y_test.npy"),
        do_filter=config["use_filter"], augment=False,
        use_amp=config["use_amp"])

    # Sampler
    if config["use_sampler"]:
        hyp_pos = train_ds.y[:, 4]
        sw = np.where(hyp_pos == 1.0, 4.0, 1.0)
        sampler = WeightedRandomSampler(torch.from_numpy(sw).float(), len(sw), replacement=True)
        train_ld = DataLoader(train_ds, batch_size=BATCH_SIZE, sampler=sampler,
                              num_workers=0, pin_memory=(device.type == "cuda"))
    else:
        train_ld = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=0, pin_memory=(device.type == "cuda"))

    val_ld = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0,
                        pin_memory=(device.type == "cuda"))
    test_ld = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0,
                         pin_memory=(device.type == "cuda"))

    # pos_weight
    y_train = torch.from_numpy(train_ds.y)
    pos = y_train.sum(dim=0)
    neg = y_train.shape[0] - pos
    raw_w = neg / (pos + 1e-6)
    pos_weight = torch.clamp(raw_w, min=1.0, max=3.0)
    pos_weight[4] = min(pos_weight[4] * 1.5, 5.0)
    pos_weight = pos_weight.to(device)

    # Model (amp_dim=0이면 amp 무시)
    model = ResNet1D(num_classes=5, amp_dim=amp_dim).to(device)

    # Loss
    if config["use_asl"]:
        criterion = AsymmetricLoss(gamma_pos=0.0, gamma_neg=4.0, margin=0.05,
                                   pos_weight=pos_weight).to(device)
    else:
        criterion = SimpleBCELoss(pos_weight=pos_weight).to(device)

    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=5e-4)
    warmup = LinearLR(optimizer, start_factor=0.01, total_iters=5)
    cosine = CosineAnnealingLR(optimizer, T_max=ABLATION_EPOCHS - 5, eta_min=1e-6)
    scheduler = SequentialLR(optimizer, [warmup, cosine], milestones=[5])

    use_cuda_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_cuda_amp)

    best_score = -1e9
    patience_cnt = 0
    t_start = time.time()

    for e in range(ABLATION_EPOCHS):
        model.train()
        running = 0.0
        for x, amp, y in train_ld:
            x = x.to(device, non_blocking=True)
            amp = amp.to(device, non_blocking=True)
            y = y.to(device, non_blocking=True)

            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=use_cuda_amp):
                logits = model(x, amp if config["use_amp"] else None)
                loss = criterion(logits, y)

            scaler.scale(loss).backward()
            if use_cuda_amp:
                scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
            running += loss.item()

        avg_loss = running / max(1, len(train_ld))
        lr = optimizer.param_groups[0]["lr"]

        # Validation
        val_true, val_prob = evaluate_return_probs(model, val_ld, device)
        best_thr = find_best_thresholds(val_true, val_prob)
        metrics = compute_metrics(val_true, val_prob, best_thr)

        print(f"  Ep {e+1:3d} | LR {lr:.6f} | Loss {avg_loss:.4f} | "
              f"Macro F1 {metrics['macro_f1']:.2f}% | HYP F1 {metrics['HYP_f1']:.2f}%")

        scheduler.step()

        if metrics["macro_f1"] > best_score:
            best_score = metrics["macro_f1"]
            patience_cnt = 0
            # 메모리에만 저장 (디스크 I/O 절약)
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            best_thr_saved = best_thr.copy()
        else:
            patience_cnt += 1
            if patience_cnt >= PATIENCE:
                print(f"  [Early Stop at epoch {e+1}]")
                break

    train_time = time.time() - t_start

    # Test with best model
    model.load_state_dict({k: v.to(device) for k, v in best_state.items()})
    test_true, test_prob = evaluate_return_probs(model, test_ld, device)

    # val에서 찾은 threshold로 test 평가
    val_true2, val_prob2 = evaluate_return_probs(model, val_ld, device)
    final_thr = find_best_thresholds(val_true2, val_prob2)
    test_metrics = compute_metrics(test_true, test_prob, final_thr)

    print(f"\n  [TEST] {name}")
    print(f"  Macro F1: {test_metrics['macro_f1']:.2f}% | Macro AUC: {test_metrics['macro_auc']:.2f}%")
    for lbl in LABELS:
        print(f"    {lbl:4s} | F1: {test_metrics[f'{lbl}_f1']:.2f}% | AUC: {test_metrics[f'{lbl}_auc']:.2f}%")
    print(f"  Train Time: {train_time:.0f}s ({train_time/60:.1f}min)")

    # 결과 dict
    result = {"experiment": name, "train_time_sec": round(train_time, 1)}
    result.update(test_metrics)
    return result


# =============================================================================
# MAIN: 전체 Ablation 실행
# =============================================================================
def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(root, "data", "processed")
    models_dir = os.path.join(root, "models")
    os.makedirs(models_dir, exist_ok=True)

    # 모든 Ablation 조건을 동일 시드로 실행하여 공정한 비교 보장
    set_seed(ABLATION_SEED)
    print(f"[Reproducibility] Global seed fixed: {ABLATION_SEED}")

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # ======================== 실험 구성 ========================
    experiments = [
        {
            "name": "Full (All techniques)",
            "use_asl": True, "use_amp": True, "use_filter": True,
            "use_sampler": True, "use_augment": True,
        },
        {
            "name": "w/o ASL (use BCE)",
            "use_asl": False, "use_amp": True, "use_filter": True,
            "use_sampler": True, "use_augment": True,
        },
        {
            "name": "w/o Amp Features",
            "use_asl": True, "use_amp": False, "use_filter": True,
            "use_sampler": True, "use_augment": True,
        },
        {
            "name": "w/o Bandpass Filter",
            "use_asl": True, "use_amp": True, "use_filter": False,
            "use_sampler": True, "use_augment": True,
        },
        {
            "name": "w/o WeightedSampler",
            "use_asl": True, "use_amp": True, "use_filter": True,
            "use_sampler": False, "use_augment": True,
        },
        {
            "name": "w/o Augmentation",
            "use_asl": True, "use_amp": True, "use_filter": True,
            "use_sampler": True, "use_augment": False,
        },
    ]

    results = []
    total_start = time.time()

    for i, config in enumerate(experiments):
        print(f"\n\n{'#'*60}")
        print(f"  EXPERIMENT {i+1}/{len(experiments)}")
        print(f"{'#'*60}")
        # 각 조건도 동일 시드로 초기화하여 조건 간 공정 비교 보장
        set_seed(ABLATION_SEED)
        result = run_single_experiment(config, data_dir, device)
        results.append(result)

        # 중간 저장 (실험 도중 중단돼도 결과 보존)
        csv_path = os.path.join(models_dir, "ablation_results.csv")
        _save_csv(results, csv_path)
        print(f"\n  >> 중간 결과 저장됨: {csv_path}")

    total_time = time.time() - total_start
    print(f"\n\n{'='*60}")
    print(f"  ALL ABLATION EXPERIMENTS COMPLETE")
    print(f"  Total Time: {total_time:.0f}s ({total_time/3600:.1f}h)")
    print(f"{'='*60}")

    # ======================== 최종 결과 출력 ========================
    print(f"\n{'='*70}")
    print(f"  {'Experiment':<28s} {'Macro F1':>9s} {'Macro AUC':>10s} {'HYP F1':>8s} {'Time':>7s}")
    print(f"  {'-'*66}")
    for r in results:
        print(f"  {r['experiment']:<28s} {r['macro_f1']:>8.2f}% {r['macro_auc']:>9.2f}% "
              f"{r['HYP_f1']:>7.2f}% {r['train_time_sec']:>6.0f}s")
    print(f"{'='*70}")

    csv_path = os.path.join(models_dir, "ablation_results.csv")
    _save_csv(results, csv_path)
    print(f"\nFinal results saved to: {csv_path}")


def _save_csv(results, path):
    if not results:
        return
    keys = ["experiment", "macro_f1", "macro_auc", "micro_f1",
            "NORM_f1", "STTC_f1", "MI_f1", "CD_f1", "HYP_f1",
            "NORM_auc", "STTC_auc", "MI_auc", "CD_auc", "HYP_auc",
            "train_time_sec"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            writer.writerow(r)


if __name__ == "__main__":
    main()
