import os
import time
import numpy as np
import traceback
from math import gcd
from typing import List, Optional
from contextlib import asynccontextmanager

import torch
import torch.nn as nn
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from scipy.signal import butter, filtfilt, resample_poly
import uvicorn

# ✅ [수정 1] CORS 미들웨어 import 주석 해제 (필수!)
from fastapi.middleware.cors import CORSMiddleware

# =============================================================================
# 0) 경로/상수 설정
# =============================================================================
current_file_path = os.path.abspath(__file__)
src_folder = os.path.dirname(current_file_path)
ai_folder = os.path.dirname(src_folder)

DEFAULT_MODEL_PATH = os.path.join(ai_folder, "models", "best_model_multilabel.pth")
MODEL_PATH = os.environ.get("MODEL_PATH", DEFAULT_MODEL_PATH)

FS = 500
TARGET_LEN = 5000  # 10 sec * 500 Hz
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

SAMPLE_DIR = os.environ.get("SAMPLE_DIR", os.path.join(ai_folder, "samples"))
DEFAULT_THRESHOLDS = [0.6, 0.45, 0.5, 0.6, 0.7]

def load_thresholds_from_env() -> List[float]:
    raw = os.environ.get("THRESHOLDS", "").strip()
    if not raw:
        return DEFAULT_THRESHOLDS
    try:
        vals = [float(x) for x in raw.split(",")]
        if len(vals) != 5:
            raise ValueError("THRESHOLDS must have 5 values")
        return vals
    except Exception:
        print("⚠️ THRESHOLDS env parse failed. Using DEFAULT_THRESHOLDS.")
        return DEFAULT_THRESHOLDS

THRESHOLDS = load_thresholds_from_env()

# =============================================================================
# 1) 유틸 함수들
# =============================================================================
def to_12xL(x: np.ndarray) -> np.ndarray:
    if x.ndim != 2:
        raise ValueError(f"Expected 2D array. Got {x.ndim}D")
    if x.shape[0] == 12:
        return x
    if x.shape[1] == 12:
        return x.T
    raise ValueError(f"Expected (12, L) or (L, 12). Got {x.shape}")

def ensure_len_12xL(x12xL: np.ndarray, target_len: int = TARGET_LEN) -> np.ndarray:
    L = x12xL.shape[1]
    if L == target_len:
        return x12xL.astype(np.float32)
    if L > target_len:
        return x12xL[:, -target_len:].astype(np.float32)
    pad = target_len - L
    return np.pad(x12xL, ((0, 0), (0, pad)), mode="constant").astype(np.float32)

def resample_12lead(x12xL: np.ndarray, in_fs: int, out_fs: int) -> np.ndarray:
    if in_fs == out_fs:
        return x12xL.astype(np.float32)
    g = gcd(in_fs, out_fs)
    up = out_fs // g
    down = in_fs // g
    y = resample_poly(x12xL, up, down, axis=1).astype(np.float32)
    return y

def sigmoid_np(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))

def compute_amp_feats(x12xL: np.ndarray) -> np.ndarray:
    ptp = x12xL.max(axis=1) - x12xL.min(axis=1)
    std = x12xL.std(axis=1)
    rms = np.sqrt(np.mean(x12xL**2, axis=1) + 1e-8)
    feats = np.concatenate([ptp, std, rms], axis=0).astype(np.float32)
    return feats

def decode_active_labels(probs: np.ndarray, thresholds: List[float]) -> List[str]:
    active = []
    for i, p in enumerate(probs.tolist()):
        if p >= thresholds[i]:
            active.append(LABELS[i])
    return active

def risk_level_from_probs(probs: np.ndarray) -> str:
    abnormal = float(np.max(probs[1:])) if probs.shape[0] >= 5 else 0.0
    if abnormal >= 0.8:
        return "high"
    if abnormal >= 0.6:
        return "medium"
    return "low"

# =============================================================================
# 1.5) 데모용 샘플 생성
# =============================================================================
def _randn():
    return float(np.random.randn())

def _beat_template(phase: float) -> float:
    def g(mu, sigma, amp):
        return amp * np.exp(-0.5 * ((phase - mu) / sigma) ** 2)
    return (
        g(0.18, 0.03, 0.12) +    # P
        g(0.38, 0.012, -0.15) +  # Q
        g(0.40, 0.01, 1.0) +     # R
        g(0.43, 0.014, -0.25) +  # S
        g(0.68, 0.05, 0.3)       # T
    )

def make_demo_window_12xL(label: str, fs: int = FS, length: int = TARGET_LEN) -> np.ndarray:
    print(f"⚡ [Demo Generator] Generating FAKE signal for: {label}")
    label = label.upper().strip()
    lead_mults = np.array([0.7, 1.1, 0.4, -0.9, -0.2, 0.8, 0.2, 0.5, 0.8, 1.1, 1.0, 0.8], dtype=np.float32)
    hr = 75.0
    beat_dur = 60.0 / hr
    noise_std = 0.08 
    wander_amp = 0.05
    wander_freq = 0.3
    wander_phase = float(np.random.rand() * np.pi * 2)

    x = np.zeros((12, length), dtype=np.float32)
    t_sec = 0.0
    phase = 0.0

    for i in range(length):
        dt = 1.0 / fs
        t_sec += dt
        phase += dt / beat_dur
        if phase >= 1.0:
            phase -= 1.0

        clean = float(_beat_template(phase))
        distortion = 0.0
        
        if label == "MI":
            if 0.45 <= phase <= 0.65:
                distortion = 0.8
            if 0.36 <= phase <= 0.39:
                distortion -= 0.5
        elif label == "STTC":
            if 0.60 <= phase <= 0.80:
                distortion = -1.2 * np.sin(np.pi * (phase - 0.60) / (0.80 - 0.60))
        elif label == "HYP":
            if 0.38 <= phase <= 0.44:
                 distortion = 2.0 * clean
        elif label == "CD":
             if 0.40 <= phase <= 0.42:
                 distortion = -clean * 0.5

        modified_signal = clean + distortion
        wander = float(wander_amp * np.sin(2 * np.pi * wander_freq * t_sec + wander_phase))

        for ch in range(12):
            val = modified_signal * float(lead_mults[ch]) + wander + float(noise_std * _randn())
            x[ch, i] = val
    return x

# =============================================================================
# 2) MODEL
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
            nn.CBAM(cout) if hasattr(nn, 'CBAM') else CBAM(cout), 
        )
    def forward(self, x):
        return self.block(x)

class CNN_CBAM_GRU(nn.Module):
    def __init__(self, num_classes=5, amp_dim=36):
        super().__init__()
        self.c1 = ConvBlock(12, 32)
        self.c2 = ConvBlock(32, 32)
        self.gru = nn.GRU(
            input_size=32, hidden_size=64,
            num_layers=2, batch_first=True,
            bidirectional=True, dropout=0.5
        )
        self.fc = nn.Sequential(
            nn.Linear(128 + amp_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(128, num_classes)
        )

    def forward(self, x, amp):
        x = self.c1(x)
        x = self.c2(x)
        x = x.permute(0, 2, 1)
        self.gru.flatten_parameters()
        x, _ = self.gru(x)
        x = x.mean(dim=1)
        combined = torch.cat([x, amp], dim=1)
        return self.fc(combined)

# =============================================================================
# 3) Preprocessor
# =============================================================================
class Preprocessor:
    def __init__(self, fs=FS, low_hz=0.5, high_hz=45.0):
        self.fs = fs
        nyq = 0.5 * fs
        low = low_hz / nyq
        high = high_hz / nyq
        eps = 1e-3
        if high >= 1.0: high = 1.0 - eps
        if low <= 0.0: low = eps
        self.b, self.a = butter(2, [low, high], btype="band")

    def bandpass(self, x12xL: np.ndarray) -> np.ndarray:
        return filtfilt(self.b, self.a, x12xL, axis=1).astype(np.float32)

    def normalize(self, x12xL: np.ndarray) -> np.ndarray:
        mean = x12xL.mean(axis=1, keepdims=True)
        std = x12xL.std(axis=1, keepdims=True) + 1e-6
        return ((x12xL - mean) / std).astype(np.float32)

# =============================================================================
# 4) FastAPI Lifespan & App
# =============================================================================
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model: Optional[CNN_CBAM_GRU] = None
pre: Optional[Preprocessor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, pre
    print(f"🔍 모델 파일: {MODEL_PATH}")
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"❌ 모델 파일을 찾을 수 없습니다: {MODEL_PATH}")

    m = CNN_CBAM_GRU(num_classes=5, amp_dim=36).to(DEVICE)
    try:
        state = torch.load(MODEL_PATH, map_location=DEVICE, weights_only=True)
    except TypeError:
        state = torch.load(MODEL_PATH, map_location=DEVICE)

    m.load_state_dict(state)
    m.eval()

    model = m
    pre = Preprocessor(fs=FS)
    os.makedirs(SAMPLE_DIR, exist_ok=True)

    print(f"✅ 모델 로드 성공 ({DEVICE})")
    print(f"✅ THRESHOLDS: {THRESHOLDS}")
    print(f"✅ SAMPLE_DIR: {SAMPLE_DIR}")
    yield
    print("서버 종료 중...")

app = FastAPI(title="ECG Multi-Label Analysis API", lifespan=lifespan)

# ✅ [수정 2] CORS 미들웨어 적용 (Network Timeout 방지)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 주소 허용 (모바일 접속 시 필수)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictReq(BaseModel):
    x: List[List[float]]
    fs: Optional[int] = Field(default=None)
    amp: Optional[List[float]] = Field(default=None)

@app.get("/health")
def health():
    return {"ok": True, "model_loaded": model is not None}

@app.get("/sample_window")
def sample_window(label: Optional[str] = Query(None)):
    try:
        if label is None or str(label).strip() == "":
            picked_label = str(np.random.choice(LABELS))
            print(f"🎲 Random label picked: {picked_label}")
        else:
            picked_label = str(label).upper().strip()
            print(f"🎯 Requested label: {picked_label}")

        if picked_label not in LABELS:
            raise HTTPException(400, f"Unknown label: {picked_label}. Allowed: {LABELS}")

        os.makedirs(SAMPLE_DIR, exist_ok=True)
        path = os.path.join(SAMPLE_DIR, f"{picked_label}.npy")

        if os.path.exists(path):
            print(f"📂 Load from file: {path}")
            arr = np.load(path)
            if arr.ndim == 3 and arr.shape[1] == 12:
                idx = int(np.random.randint(0, arr.shape[0]))
                x = arr[idx]
                sample_id = f"{picked_label}_{idx}"
            elif arr.ndim == 3 and arr.shape[2] == 12:
                idx = int(np.random.randint(0, arr.shape[0]))
                x = arr[idx]
                sample_id = f"{picked_label}_{idx}"
            elif arr.ndim == 2:
                x = arr
                sample_id = f"{picked_label}_single"
            else:
                raise HTTPException(500, f"Unsupported npy shape: {arr.shape}")
            
            x = np.array(x, dtype=np.float32)
            x = to_12xL(x)
            x = ensure_len_12xL(x, TARGET_LEN)
            
            return {
                "x": x.tolist(), "fs": FS, "label": picked_label, 
                "id": sample_id, "from": "file", "ts": time.time()
            }

        print(f"⚠️ File not found. Generating DEMO signal.")
        x = make_demo_window_12xL(picked_label, fs=FS, length=TARGET_LEN)
        sample_id = f"{picked_label}_demo"

        return {
            "x": x.tolist(),
            "fs": FS,
            "label": picked_label,
            "id": sample_id,
            "from": "generated_demo",
            "ts": time.time(),
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Sample server error: {str(e)}")

@app.post("/predict_window")
def predict_window(req: PredictReq):
    if model is None or pre is None:
        raise HTTPException(500, "Model not ready")

    try:
        if not req.x or len(req.x) == 0:
            raise ValueError("Input data 'x' is empty")

        row_lengths = set(len(row) for row in req.x)
        if len(row_lengths) != 1:
            raise ValueError(f"Jagged array detected. Row lengths: {row_lengths}")

        x = np.array(req.x, dtype=np.float32)
        x = to_12xL(x)

        if np.isnan(x).any():
            x = np.nan_to_num(x)

        in_fs = int(req.fs) if req.fs else FS
        if in_fs != FS:
            x = resample_12lead(x, in_fs, FS)

        x = ensure_len_12xL(x, TARGET_LEN)

        x_f = pre.bandpass(x)
        amp = compute_amp_feats(x_f)
        x_n = pre.normalize(x_f)

        xt = torch.from_numpy(x_n).unsqueeze(0).float().to(DEVICE)
        at = torch.from_numpy(amp).unsqueeze(0).float().to(DEVICE)

        with torch.no_grad():
            logits = model(xt, at).detach().cpu().numpy()[0]

        probs = sigmoid_np(logits).astype(float)
        active = decode_active_labels(probs, THRESHOLDS)
        risk = risk_level_from_probs(probs)

        top_idx = int(np.argmax(probs))
        top_label = LABELS[top_idx]
        top_conf = float(probs[top_idx])

        return {
            "probs": probs.tolist(),
            "thresholds": THRESHOLDS,
            "active_labels": active,
            "risk_level": risk,
            "top_label": top_label,
            "top_confidence": top_conf,
        }

    except Exception as e:
        print("\n" + "=" * 60)
        print("❌ PREDICT ERROR")
        print("=" * 60)
        traceback.print_exc()
        print("=" * 60 + "\n")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000)