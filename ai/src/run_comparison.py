#!/usr/bin/env python
# run_comparison.py
# =============================================================================
# Baseline(CNN_CBAM_GRU) vs Proposed(ResNet1D) 동일 조건 비교
# + 오류 분석 (Confusion Matrix, 오분류 패턴, Multi-label 동시 발생 분석)
#
# 사용법:
#   python run_comparison.py                    # 둘 다 학습 + 비교
#   python run_comparison.py --skip-train       # 이미 학습된 모델로 분석만
#
# 출력:
#   models/comparison_results.csv       — 성능 비교표
#   models/error_analysis/              — Confusion Matrix 이미지 등
# =============================================================================

import os
import sys
import argparse
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
from scipy import stats as scipy_stats
from sklearn.metrics import (f1_score, roc_auc_score, confusion_matrix,
                             classification_report, multilabel_confusion_matrix)
from torch.optim.lr_scheduler import CosineAnnealingLR, LinearLR, SequentialLR

# ======================== 재현성: 랜덤 시드 고정 ========================
N_RUNS = 3
SEEDS = [42, 123, 456]

def set_seed(seed: int):
    """모든 난수 생성기를 동일 시드로 고정하여 실험 재현성 확보"""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False  # deterministic 모드에서는 False

# ======================== 설정 ========================
EPOCHS = 100
PATIENCE = 20
BATCH_SIZE = 64
LR = 1e-3
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

# =============================================================================
# LOSS
# =============================================================================
class AsymmetricLoss(nn.Module):
    def __init__(self, gamma_pos=0.0, gamma_neg=4.0, margin=0.05, pos_weight=None):
        super().__init__()
        self.gamma_pos, self.gamma_neg, self.margin = gamma_pos, gamma_neg, margin
        self.pos_weight = pos_weight
    def forward(self, logits, targets):
        probs = torch.sigmoid(logits)
        probs_neg = (probs - self.margin).clamp(min=0)
        lp = targets * (1-probs)**self.gamma_pos * torch.log(probs.clamp(min=1e-8))
        ln = (1-targets) * probs_neg**self.gamma_neg * torch.log((1-probs_neg).clamp(min=1e-8))
        if self.pos_weight is not None:
            lp = lp * self.pos_weight.to(logits.device)
        return -(lp + ln).mean()

# =============================================================================
# MODELS
# =============================================================================
# --- CNN_CBAM_GRU (Baseline) ---
class ChannelAttention(nn.Module):
    def __init__(self, c, r=8):
        super().__init__()
        self.avg = nn.AdaptiveAvgPool1d(1); self.mx = nn.AdaptiveMaxPool1d(1)
        mid = max(c//r, 4)
        self.fc = nn.Sequential(nn.Conv1d(c,mid,1,bias=False), nn.ReLU(), nn.Conv1d(mid,c,1,bias=False))
        self.sig = nn.Sigmoid()
    def forward(self, x): return self.sig(self.fc(self.avg(x)) + self.fc(self.mx(x)))

class SpatialAttention(nn.Module):
    def __init__(self, k=7):
        super().__init__()
        self.conv = nn.Conv1d(2,1,k,padding=k//2,bias=False); self.sig = nn.Sigmoid()
    def forward(self, x):
        a = x.mean(1, keepdim=True); m,_ = x.max(1, keepdim=True)
        return self.sig(self.conv(torch.cat([a,m],1)))

class CBAM(nn.Module):
    def __init__(self, c):
        super().__init__()
        self.ca = ChannelAttention(c); self.sa = SpatialAttention()
    def forward(self, x): return x * self.ca(x) * self.sa(x * self.ca(x))

class ConvBlock(nn.Module):
    def __init__(self, ci, co):
        super().__init__()
        self.main = nn.Sequential(nn.Conv1d(ci,co,3,padding=1), nn.BatchNorm1d(co), nn.ReLU(True), nn.MaxPool1d(2))
        self.skip = nn.Sequential(nn.Conv1d(ci,co,1,bias=False), nn.MaxPool1d(2))
        self.cbam = CBAM(co); self.relu = nn.ReLU(True)
    def forward(self, x): return self.cbam(self.relu(self.main(x) + self.skip(x)))

class CNN_CBAM_GRU(nn.Module):
    def __init__(self, num_classes=5, amp_dim=36):
        super().__init__()
        self.c1 = ConvBlock(12,32); self.c2 = ConvBlock(32,64); self.c3 = ConvBlock(64,128)
        self.gru = nn.GRU(128,128,2,batch_first=True,bidirectional=True,dropout=0.5)
        self.fc = nn.Sequential(
            nn.Linear(256+amp_dim,256), nn.ReLU(), nn.Dropout(0.5),
            nn.Linear(256,128), nn.ReLU(), nn.Dropout(0.4),
            nn.Linear(128,num_classes))
    def forward(self, x, amp=None):
        x = self.c3(self.c2(self.c1(x))).permute(0,2,1)
        self.gru.flatten_parameters(); x,_ = self.gru(x); x = x.mean(1)
        if amp is not None: x = torch.cat([x, amp], 1)
        return self.fc(x)

# --- ResNet1D (Proposed) ---
class ResidualBlock1D(nn.Module):
    def __init__(self, ci, co, stride=1, drop=0.2):
        super().__init__()
        self.conv1 = nn.Conv1d(ci,co,7,stride=stride,padding=3,bias=False)
        self.bn1 = nn.BatchNorm1d(co); self.relu = nn.ReLU(True); self.drop = nn.Dropout(drop)
        self.conv2 = nn.Conv1d(co,co,7,padding=3,bias=False); self.bn2 = nn.BatchNorm1d(co)
        self.skip = nn.Sequential(nn.Conv1d(ci,co,1,stride=stride,bias=False), nn.BatchNorm1d(co)) \
            if ci!=co or stride!=1 else nn.Identity()
    def forward(self, x):
        o = self.drop(self.relu(self.bn1(self.conv1(x)))); o = self.bn2(self.conv2(o))
        return self.relu(o + self.skip(x))

class ResNet1D(nn.Module):
    def __init__(self, num_classes=5, amp_dim=36):
        super().__init__()
        self.amp_dim = amp_dim
        self.stem = nn.Sequential(nn.Conv1d(12,64,15,stride=2,padding=7,bias=False),
                                  nn.BatchNorm1d(64), nn.ReLU(True), nn.MaxPool1d(3,2,1))
        self.layer1 = nn.Sequential(ResidualBlock1D(64,64), ResidualBlock1D(64,64))
        self.layer2 = nn.Sequential(ResidualBlock1D(64,128,2), ResidualBlock1D(128,128))
        self.layer3 = nn.Sequential(ResidualBlock1D(128,256,2), ResidualBlock1D(256,256))
        self.layer4 = nn.Sequential(ResidualBlock1D(256,512,2), ResidualBlock1D(512,512))
        self.pool = nn.AdaptiveAvgPool1d(1)
        self.head = nn.Sequential(nn.Dropout(0.5), nn.Linear(512+amp_dim,256),
                                  nn.ReLU(True), nn.Dropout(0.3), nn.Linear(256,num_classes))
    def forward(self, x, amp=None):
        x = self.layer4(self.layer3(self.layer2(self.layer1(self.stem(x)))))
        f = self.pool(x).squeeze(-1)
        if amp is not None and self.amp_dim > 0: f = torch.cat([f,amp],1)
        return self.head(f)

# =============================================================================
# DATASET (동일)
# =============================================================================
class ECGDatasetMulti(Dataset):
    def __init__(self, X_path, y_path, fs=500, do_filter=True, augment=False):
        self.X = np.load(X_path, mmap_mode="r")
        self.y = np.load(y_path).astype(np.float32)
        self.do_filter = do_filter; self.augment = augment
        nyq = 0.5*fs; lo = max(0.5/nyq,1e-3); hi = min(45.0/nyq,1-1e-3)
        self.b, self.a = butter(2, [lo, hi], btype="band")
    def __len__(self): return len(self.X)
    def _to12(self, x):
        if x.shape[0]==12: return x
        if x.shape[1]==12: return x.T
        raise ValueError(f"bad shape {x.shape}")
    def _filt(self, x): return filtfilt(self.b,self.a,x,axis=1).astype(np.float32)
    def _norm(self, x):
        m = x.mean(1,keepdims=True); s = x.std(1,keepdims=True)+1e-6
        return ((x-m)/s).astype(np.float32)
    def _aug(self, x):
        o = x.copy()
        if np.random.rand()<0.5: o *= np.random.uniform(0.85,1.15)
        if np.random.rand()<0.5:
            s = np.random.randint(-20,21)
            if s>0: o[:,s:]=o[:,:-s]; o[:,:s]=0
            elif s<0: o[:,:s]=o[:,-s:]; o[:,s:]=0
        if np.random.rand()<0.5: o += np.random.normal(0,0.02,o.shape).astype(np.float32)
        if np.random.rand()<0.3:
            t=np.arange(o.shape[1])/500.; o += np.random.uniform(.05,.2)*np.sin(2*np.pi*np.random.uniform(.1,.4)*t)
        if np.random.rand()<0.2: o[np.random.choice(12,np.random.randint(1,3),replace=False),:]=0
        return o.astype(np.float32)
    def _amp(self, x):
        ptp = x.max(1)-x.min(1); std = x.std(1); rms = np.sqrt(np.mean(x**2,1)+1e-8)
        return np.concatenate([ptp,std,rms]).astype(np.float32)
    def __getitem__(self, idx):
        x = np.array(self.X[idx], dtype=np.float32); x = self._to12(x)
        if self.do_filter: x = self._filt(x)
        amp = self._amp(x)
        if self.augment: x = self._aug(x)
        x = self._norm(x)
        return torch.from_numpy(x).float(), torch.from_numpy(amp).float(), torch.from_numpy(self.y[idx]).float()

# =============================================================================
# EVALUATION UTILS
# =============================================================================
def evaluate_return_probs(model, loader, device):
    model.eval(); ps, ts = [], []
    with torch.no_grad():
        for x, a, y in loader:
            x,a = x.to(device,non_blocking=True), a.to(device,non_blocking=True)
            ps.append(torch.sigmoid(model(x,a)).cpu().numpy()); ts.append(y.numpy())
    return np.concatenate(ts), np.concatenate(ps)

def find_best_thresholds(yt, yp):
    cands = np.linspace(0.05,0.95,37); best = np.zeros(yt.shape[1])
    for c in range(yt.shape[1]):
        bf, bt = -1, 0.5
        for t in cands:
            f = f1_score(yt[:,c], (yp[:,c]>=t).astype(int), zero_division=0)
            if f > bf: bf, bt = f, t
        best[c] = bt
    return best

def compute_all_metrics(yt, yp, thr):
    ypred = np.zeros_like(yp)
    for c in range(yt.shape[1]): ypred[:,c] = (yp[:,c]>=thr[c]).astype(int)
    mif1 = f1_score(yt,ypred,average="micro",zero_division=0)*100
    maf1 = f1_score(yt,ypred,average="macro",zero_division=0)*100
    pf1 = f1_score(yt,ypred,average=None,zero_division=0)*100
    try:
        maauc = roc_auc_score(yt,yp,average="macro")*100
        pauc = roc_auc_score(yt,yp,average=None)*100
    except: maauc=0; pauc=np.zeros(5)
    return {"micro_f1":mif1,"macro_f1":maf1,"macro_auc":maauc,
            "per_f1":pf1,"per_auc":pauc,"y_true":yt,"y_pred":ypred,"y_prob":yp}

# =============================================================================
# TRAIN ONE MODEL
# =============================================================================
def train_model(model, train_ld, val_ld, criterion, device, model_name, save_path):
    optimizer = optim.AdamW(model.parameters(), lr=LR, weight_decay=5e-4)
    warmup = LinearLR(optimizer, start_factor=0.01, total_iters=5)
    cosine = CosineAnnealingLR(optimizer, T_max=EPOCHS-5, eta_min=1e-6)
    scheduler = SequentialLR(optimizer, [warmup, cosine], milestones=[5])
    use_amp = (device.type == "cuda")
    scaler = torch.amp.GradScaler("cuda", enabled=use_amp)
    best_score, patience_cnt = -1e9, 0
    t0 = time.time()

    for e in range(EPOCHS):
        model.train(); running = 0
        for x, amp, y in train_ld:
            x,amp,y = x.to(device,non_blocking=True), amp.to(device,non_blocking=True), y.to(device,non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.amp.autocast("cuda", enabled=use_amp):
                loss = criterion(model(x,amp), y)
            scaler.scale(loss).backward()
            if use_amp: scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer); scaler.update()
            running += loss.item()

        avg_loss = running / max(1, len(train_ld))
        vt, vp = evaluate_return_probs(model, val_ld, device)
        thr = find_best_thresholds(vt, vp)
        m = compute_all_metrics(vt, vp, thr)
        print(f"  [{model_name}] Ep {e+1:3d} | Loss {avg_loss:.4f} | "
              f"Macro F1 {m['macro_f1']:.2f}% | HYP F1 {m['per_f1'][4]:.2f}%")
        scheduler.step()

        if m["macro_f1"] > best_score:
            best_score = m["macro_f1"]; patience_cnt = 0
            torch.save(model.state_dict(), save_path)
        else:
            patience_cnt += 1
            if patience_cnt >= PATIENCE:
                print(f"  [Early Stop at epoch {e+1}]"); break

    print(f"  [{model_name}] Train Time: {time.time()-t0:.0f}s | Best Val Macro F1: {best_score:.2f}%")
    return best_score

# =============================================================================
# ERROR ANALYSIS
# =============================================================================
def error_analysis(yt, ypred, yprob, out_dir, model_name):
    """오류 분석 결과를 텍스트 파일로 저장"""
    os.makedirs(out_dir, exist_ok=True)
    report_path = os.path.join(out_dir, f"error_analysis_{model_name}.txt")

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"{'='*60}\n")
        f.write(f"  Error Analysis: {model_name}\n")
        f.write(f"{'='*60}\n\n")

        # 1. 클래스별 Confusion Matrix
        f.write("1. Per-Class Confusion Matrix (Binary: label vs rest)\n")
        f.write("-" * 50 + "\n")
        mcm = multilabel_confusion_matrix(yt, ypred)
        for i, name in enumerate(LABELS):
            tn, fp, fn, tp = mcm[i].ravel()
            sens = tp/(tp+fn+1e-8)*100
            spec = tn/(tn+fp+1e-8)*100
            ppv = tp/(tp+fp+1e-8)*100
            npv = tn/(tn+fn+1e-8)*100
            f1 = f1_score(yt[:,i], ypred[:,i], zero_division=0)*100
            f.write(f"\n  {name}:\n")
            f.write(f"    TP={tp:5d}  FP={fp:5d}\n")
            f.write(f"    FN={fn:5d}  TN={tn:5d}\n")
            f.write(f"    Sensitivity: {sens:.1f}%  Specificity: {spec:.1f}%\n")
            f.write(f"    PPV: {ppv:.1f}%  NPV: {npv:.1f}%  F1: {f1:.1f}%\n")

        # 2. HYP 오분류 패턴 분석
        f.write(f"\n\n{'='*60}\n")
        f.write("2. HYP Misclassification Pattern Analysis\n")
        f.write("-" * 50 + "\n")

        hyp_idx = 4
        # HYP FN: 실제 HYP인데 놓친 샘플들
        hyp_fn_mask = (yt[:, hyp_idx] == 1) & (ypred[:, hyp_idx] == 0)
        # HYP FP: HYP 아닌데 HYP로 예측한 샘플들
        hyp_fp_mask = (yt[:, hyp_idx] == 0) & (ypred[:, hyp_idx] == 1)

        n_fn = hyp_fn_mask.sum()
        n_fp = hyp_fp_mask.sum()
        f.write(f"\n  HYP False Negatives (missed): {n_fn}\n")
        f.write(f"  HYP False Positives (wrong):  {n_fp}\n")

        # FN에서 동시 레이블 분포
        if n_fn > 0:
            fn_labels = yt[hyp_fn_mask]
            f.write(f"\n  [HYP FN] Co-occurring TRUE labels in missed HYP samples:\n")
            for j, name in enumerate(LABELS):
                if j == hyp_idx: continue
                cnt = fn_labels[:, j].sum()
                pct = cnt / n_fn * 100
                f.write(f"    {name}: {int(cnt):4d} ({pct:.1f}%)\n")

            # FN에서 모델이 대신 뭘 예측했는지
            fn_preds = ypred[hyp_fn_mask]
            f.write(f"\n  [HYP FN] What the model predicted instead:\n")
            for j, name in enumerate(LABELS):
                if j == hyp_idx: continue
                cnt = fn_preds[:, j].sum()
                pct = cnt / n_fn * 100
                f.write(f"    Predicted {name}: {int(cnt):4d} ({pct:.1f}%)\n")

            # FN에서 아무것도 예측 안 한 비율
            no_pred = (fn_preds.sum(axis=1) == 0).sum()
            f.write(f"    Predicted NOTHING: {int(no_pred):4d} ({no_pred/n_fn*100:.1f}%)\n")

        if n_fp > 0:
            fp_labels = yt[hyp_fp_mask]
            f.write(f"\n  [HYP FP] TRUE labels of wrongly-predicted-as-HYP samples:\n")
            for j, name in enumerate(LABELS):
                if j == hyp_idx: continue
                cnt = fp_labels[:, j].sum()
                pct = cnt / n_fp * 100
                f.write(f"    Actually {name}: {int(cnt):4d} ({pct:.1f}%)\n")

        # 3. Multi-label 동시 발생과 성능 관계
        f.write(f"\n\n{'='*60}\n")
        f.write("3. Multi-label Co-occurrence & Performance Impact\n")
        f.write("-" * 50 + "\n")

        n_labels = yt.sum(axis=1)  # 각 샘플의 레이블 수
        f.write(f"\n  Label count distribution:\n")
        for nl in range(1, int(n_labels.max()) + 1):
            mask = (n_labels == nl)
            cnt = mask.sum()
            if cnt == 0: continue
            sub_yt = yt[mask]; sub_yp = ypred[mask]
            mf1 = f1_score(sub_yt, sub_yp, average="macro", zero_division=0) * 100
            f.write(f"    {nl} label(s): {cnt:5d} samples | Macro F1: {mf1:.1f}%\n")

        # 4. HYP + X 조합별 성능
        f.write(f"\n  HYP co-occurrence performance:\n")
        hyp_mask = yt[:, hyp_idx] == 1
        hyp_yt = yt[hyp_mask]; hyp_yp = ypred[hyp_mask]

        for j, name in enumerate(LABELS):
            if j == hyp_idx: continue
            # HYP + name 동시
            co_mask = hyp_yt[:, j] == 1
            if co_mask.sum() < 5: continue
            sub_yp_hyp = hyp_yp[co_mask, hyp_idx]
            sub_yt_hyp = hyp_yt[co_mask, hyp_idx]
            f1_co = f1_score(sub_yt_hyp, sub_yp_hyp, zero_division=0) * 100
            f.write(f"    HYP + {name}: {int(co_mask.sum()):4d} samples | HYP F1: {f1_co:.1f}%\n")

        # HYP only (다른 레이블 없음)
        hyp_only = (hyp_yt.sum(axis=1) == 1)
        if hyp_only.sum() > 0:
            f1_only = f1_score(hyp_yt[hyp_only, hyp_idx], hyp_yp[hyp_only, hyp_idx], zero_division=0) * 100
            f.write(f"    HYP only:  {int(hyp_only.sum()):4d} samples | HYP F1: {f1_only:.1f}%\n")

        # 5. 모델 확신도 분석
        f.write(f"\n\n{'='*60}\n")
        f.write("4. Model Confidence Analysis (HYP)\n")
        f.write("-" * 50 + "\n")

        hyp_probs_pos = yprob[yt[:, hyp_idx] == 1, hyp_idx]
        hyp_probs_neg = yprob[yt[:, hyp_idx] == 0, hyp_idx]

        f.write(f"\n  HYP Positive samples (n={len(hyp_probs_pos)}):\n")
        f.write(f"    Mean prob: {hyp_probs_pos.mean():.3f}\n")
        f.write(f"    Median:    {np.median(hyp_probs_pos):.3f}\n")
        f.write(f"    Std:       {hyp_probs_pos.std():.3f}\n")
        f.write(f"    <0.3:      {(hyp_probs_pos < 0.3).sum()} ({(hyp_probs_pos < 0.3).mean()*100:.1f}%)\n")
        f.write(f"    0.3-0.7:   {((hyp_probs_pos >= 0.3) & (hyp_probs_pos < 0.7)).sum()}\n")
        f.write(f"    >0.7:      {(hyp_probs_pos >= 0.7).sum()} ({(hyp_probs_pos >= 0.7).mean()*100:.1f}%)\n")

        f.write(f"\n  HYP Negative samples (n={len(hyp_probs_neg)}):\n")
        f.write(f"    Mean prob: {hyp_probs_neg.mean():.3f}\n")
        f.write(f"    >0.5:      {(hyp_probs_neg > 0.5).sum()} ({(hyp_probs_neg > 0.5).mean()*100:.1f}%)\n")
        f.write(f"    >0.7:      {(hyp_probs_neg > 0.7).sum()} ({(hyp_probs_neg > 0.7).mean()*100:.1f}%)\n")

    print(f"  Error analysis saved: {report_path}")
    return report_path


# =============================================================================
# COMPARISON TABLE (CSV)
# =============================================================================
def save_comparison_csv(results_list, path):
    keys = ["model", "params_M", "inference_ms", "macro_f1", "macro_auc", "micro_f1",
            "NORM_f1", "STTC_f1", "MI_f1", "CD_f1", "HYP_f1",
            "NORM_auc", "STTC_auc", "MI_auc", "CD_auc", "HYP_auc", "train_time_sec"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        for r in results_list:
            w.writerow(r)
    print(f"  Comparison saved: {path}")


# =============================================================================
# MAIN
# =============================================================================
def _run_stat_tests(per_model_results: dict):
    """
    두 모델 간 반복 실험 결과에 대해 통계적 유의성 검정 수행.
    - Paired t-test (Macro F1 기준)
    - Bootstrap 95% CI (Macro AUC 기준)
    """
    model_names = list(per_model_results.keys())
    if len(model_names) < 2:
        return

    m1, m2 = model_names[0], model_names[1]
    f1_m1 = np.array([r["macro_f1"] for r in per_model_results[m1]])
    f1_m2 = np.array([r["macro_f1"] for r in per_model_results[m2]])
    auc_m1 = np.array([r["macro_auc"] for r in per_model_results[m1]])
    auc_m2 = np.array([r["macro_auc"] for r in per_model_results[m2]])

    print(f"\n{'='*70}")
    print(f"  STATISTICAL SIGNIFICANCE TESTS  (N={len(f1_m1)} runs)")
    print(f"{'='*70}")

    # --- Paired t-test (Macro F1) ---
    diff_f1 = f1_m1 - f1_m2
    if len(diff_f1) >= 2 and diff_f1.std() > 0:
        t_stat, p_val = scipy_stats.ttest_rel(f1_m1, f1_m2)
    else:
        t_stat, p_val = float("nan"), float("nan")
    print(f"\n  [Paired t-test] Macro F1: {m1} vs {m2}")
    print(f"    {m1}: {f1_m1.mean():.4f} ± {f1_m1.std():.4f}")
    print(f"    {m2}: {f1_m2.mean():.4f} ± {f1_m2.std():.4f}")
    print(f"    t={t_stat:.4f}, p={p_val:.4f}  "
          f"{'(p<0.05: significant)' if p_val < 0.05 else '(p>=0.05: not significant)'}")

    # --- Bootstrap 95% CI (Macro AUC 차이) ---
    rng = np.random.default_rng(42)
    n_boot = 10000
    boot_diffs = []
    for _ in range(n_boot):
        idx = rng.integers(0, len(auc_m1), size=len(auc_m1))
        boot_diffs.append((auc_m1[idx] - auc_m2[idx]).mean())
    boot_diffs = np.array(boot_diffs)
    ci_lo, ci_hi = np.percentile(boot_diffs, [2.5, 97.5])
    obs_diff = (auc_m1 - auc_m2).mean()
    print(f"\n  [Bootstrap 95% CI] Macro AUC difference ({m1} - {m2})")
    print(f"    Observed diff: {obs_diff:+.4f}")
    print(f"    95% CI: [{ci_lo:+.4f}, {ci_hi:+.4f}]")
    contains_zero = ci_lo <= 0 <= ci_hi
    print(f"    {'CI contains 0: not significant at α=0.05' if contains_zero else 'CI excludes 0: significant at α=0.05'}")
    print(f"{'='*70}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-train", action="store_true", help="이미 학습된 모델로 분석만")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    data_dir = os.path.join(root, "data", "processed")
    models_dir = os.path.join(root, "models")
    analysis_dir = os.path.join(models_dir, "error_analysis")
    os.makedirs(models_dir, exist_ok=True)
    os.makedirs(analysis_dir, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")

    # Data (데이터 로딩은 runs 밖에서 한 번만)
    train_ds = ECGDatasetMulti(os.path.join(data_dir, "X_train.npy"),
                               os.path.join(data_dir, "y_train.npy"), augment=True)
    val_ds = ECGDatasetMulti(os.path.join(data_dir, "X_val.npy"),
                             os.path.join(data_dir, "y_val.npy"), augment=False)
    test_ds = ECGDatasetMulti(os.path.join(data_dir, "X_test.npy"),
                              os.path.join(data_dir, "y_test.npy"), augment=False)

    hyp_pos = train_ds.y[:, 4]
    sw = np.where(hyp_pos == 1.0, 4.0, 1.0)
    sampler = WeightedRandomSampler(torch.from_numpy(sw).float(), len(sw), replacement=True)

    train_ld = DataLoader(train_ds, BATCH_SIZE, sampler=sampler, num_workers=0,
                          pin_memory=(device.type == "cuda"))
    val_ld = DataLoader(val_ds, BATCH_SIZE, shuffle=False, num_workers=0,
                        pin_memory=(device.type == "cuda"))
    test_ld = DataLoader(test_ds, BATCH_SIZE, shuffle=False, num_workers=0,
                         pin_memory=(device.type == "cuda"))

    # pos_weight
    y_train = torch.from_numpy(train_ds.y)
    pos = y_train.sum(0); neg = y_train.shape[0] - pos
    pw = torch.clamp(neg / (pos + 1e-6), 1.0, 3.0)
    pw[4] = min(pw[4] * 1.5, 5.0)
    pw = pw.to(device)

    # ======================== 반복 실험 (N_RUNS=3) ========================
    # 모델별로 runs 결과를 모아 평균±표준편차 및 통계 검정에 사용
    per_model_results = {"CNN_CBAM_GRU": [], "ResNet1D": []}
    all_run_results = []  # CSV 저장용

    for run_idx in range(N_RUNS):
        seed = SEEDS[run_idx]
        set_seed(seed)
        print(f"\n\n{'#'*70}")
        print(f"  RUN {run_idx+1}/{N_RUNS}  |  seed={seed}")
        print(f"{'#'*70}")

        model_configs = [
            {"name": "CNN_CBAM_GRU", "class": CNN_CBAM_GRU, "kwargs": {"num_classes": 5, "amp_dim": 36},
             "path": os.path.join(models_dir, f"comparison_cnn_gru_run{run_idx}.pth")},
            {"name": "ResNet1D", "class": ResNet1D, "kwargs": {"num_classes": 5, "amp_dim": 36},
             "path": os.path.join(models_dir, f"comparison_resnet1d_run{run_idx}.pth")},
        ]

        for mc in model_configs:
            print(f"\n{'='*60}")
            print(f"  MODEL: {mc['name']}  [Run {run_idx+1}]")
            print(f"{'='*60}")

            model = mc["class"](**mc["kwargs"]).to(device)
            params = sum(p.numel() for p in model.parameters() if p.requires_grad)
            print(f"  Parameters: {params:,} ({params/1e6:.2f}M)")

            # Inference time
            model.eval()
            xd = torch.randn(1,12,5000).to(device); ad = torch.zeros(1,36).to(device)
            with torch.no_grad():
                for _ in range(10): model(xd, ad)
                times = []
                for _ in range(50):
                    t0 = time.perf_counter(); model(xd, ad); times.append(time.perf_counter()-t0)
            inf_ms = np.mean(times)*1000

            if not args.skip_train:
                criterion = AsymmetricLoss(pos_weight=pw).to(device)
                t0 = time.time()
                train_model(model, train_ld, val_ld, criterion, device, mc["name"], mc["path"])
                train_time = time.time() - t0
            else:
                train_time = 0
                if not os.path.exists(mc["path"]):
                    print(f"  [SKIP] Model file not found: {mc['path']}")
                    continue

            # Load best & Test
            try:
                state = torch.load(mc["path"], map_location=device, weights_only=True)
            except TypeError:
                state = torch.load(mc["path"], map_location=device)
            model.load_state_dict(state)

            vt, vp = evaluate_return_probs(model, val_ld, device)
            thr = find_best_thresholds(vt, vp)
            tt, tp = evaluate_return_probs(model, test_ld, device)
            m = compute_all_metrics(tt, tp, thr)

            print(f"\n  [TEST] {mc['name']}  run={run_idx+1}")
            print(f"  Macro F1: {m['macro_f1']:.2f}% | Macro AUC: {m['macro_auc']:.2f}%")
            for i, lbl in enumerate(LABELS):
                print(f"    {lbl:4s} | F1: {m['per_f1'][i]:.2f}% | AUC: {m['per_auc'][i]:.2f}%")

            result = {
                "run": run_idx+1, "seed": seed,
                "model": mc["name"], "params_M": round(params/1e6, 2),
                "inference_ms": round(inf_ms, 2), "train_time_sec": round(train_time, 1),
                "macro_f1": round(m["macro_f1"], 2), "macro_auc": round(m["macro_auc"], 2),
                "micro_f1": round(m["micro_f1"], 2),
            }
            for i, lbl in enumerate(LABELS):
                result[f"{lbl}_f1"] = round(m["per_f1"][i], 2)
                result[f"{lbl}_auc"] = round(m["per_auc"][i], 2)
            all_run_results.append(result)
            per_model_results[mc["name"]].append(result)

            # Error Analysis (마지막 run에서만 저장해 파일 중복 방지)
            if run_idx == N_RUNS - 1:
                error_analysis(m["y_true"], m["y_pred"], m["y_prob"], analysis_dir, mc["name"])

    # ======================== 전체 결과 CSV 저장 ========================
    csv_path = os.path.join(models_dir, "comparison_results_all_runs.csv")
    keys = ["run", "seed", "model", "params_M", "inference_ms", "macro_f1", "macro_auc",
            "micro_f1", "NORM_f1", "STTC_f1", "MI_f1", "CD_f1", "HYP_f1",
            "NORM_auc", "STTC_auc", "MI_auc", "CD_auc", "HYP_auc", "train_time_sec"]
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys, extrasaction="ignore")
        w.writeheader()
        for r in all_run_results:
            w.writerow(r)
    print(f"\n  All-runs CSV saved: {csv_path}")

    # ======================== 평균 ± 표준편차 요약 ========================
    print(f"\n\n{'='*70}")
    print(f"  SUMMARY: Mean ± Std over {N_RUNS} runs")
    print(f"  {'Model':<18s} {'Macro F1 (%)':>16s} {'Macro AUC (%)':>16s} {'HYP F1 (%)':>14s}")
    print(f"  {'-'*68}")
    for mname, runs in per_model_results.items():
        if not runs:
            continue
        f1s  = np.array([r["macro_f1"]  for r in runs])
        aucs = np.array([r["macro_auc"] for r in runs])
        hyps = np.array([r["HYP_f1"]    for r in runs])
        print(f"  {mname:<18s} "
              f"{f1s.mean():>7.2f} ± {f1s.std():>5.2f}   "
              f"{aucs.mean():>7.2f} ± {aucs.std():>5.2f}   "
              f"{hyps.mean():>6.2f} ± {hyps.std():>5.2f}")
    print(f"{'='*70}")

    # ======================== 통계적 유의성 검정 ========================
    _run_stat_tests(per_model_results)

    print(f"\nError analysis reports: {analysis_dir}/")
    print(f"All-runs CSV: {csv_path}")


if __name__ == "__main__":
    main()
