import os
import numpy as np

FS = 500
TARGET_LEN = 5000
LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

def _beat_template(phase: float) -> float:
    def g(mu, sigma, amp):
        return amp * np.exp(-0.5 * ((phase - mu) / sigma) ** 2)
    return (
        g(0.18, 0.03, 0.12) +
        g(0.38, 0.012, -0.15) +
        g(0.40, 0.01, 1.0) +
        g(0.43, 0.014, -0.25) +
        g(0.68, 0.05, 0.3)
    )

def make_demo_window_12xL(label: str, fs: int = FS, length: int = TARGET_LEN) -> np.ndarray:
    label = label.upper().strip()
    lead_mults = np.array([0.7, 1.1, 0.4, -0.9, -0.2, 0.8, 0.2, 0.5, 0.8, 1.1, 1.0, 0.8], dtype=np.float32)

    hr = 70.0
    beat_dur = 60.0 / hr

    # label별 시각 차이만 (질병 의미 X)
    if label == "NORM":
        noise_std, wander_amp = 0.02, 0.015
    elif label == "STTC":
        noise_std, wander_amp = 0.05, 0.02
    elif label == "MI":
        noise_std, wander_amp = 0.06, 0.025
    elif label == "CD":
        noise_std, wander_amp = 0.07, 0.03
    elif label == "HYP":
        noise_std, wander_amp = 0.05, 0.02
    else:
        noise_std, wander_amp = 0.06, 0.02

    wander_freq = 0.2
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
        wander = float(wander_amp * np.sin(2 * np.pi * wander_freq * t_sec + wander_phase))

        noise = np.random.randn(12).astype(np.float32) * noise_std
        x[:, i] = clean * lead_mults + wander + noise

    return x

def main():
    # server.py가 ai_folder/samples를 기본으로 쓰니까
    # 이 스크립트는 server.py 기준으로 "ai_folder/samples"에 맞춰 생성해 주세요.
    # 여기서는 실행 위치 기준으로 samples 폴더를 만들게 해둠.
    out_dir = os.environ.get("SAMPLE_DIR", os.path.join(os.getcwd(), "samples"))
    os.makedirs(out_dir, exist_ok=True)

    n_per_label = int(os.environ.get("N_PER_LABEL", "20"))

    for lb in LABELS:
        data = np.stack([make_demo_window_12xL(lb) for _ in range(n_per_label)], axis=0)  # (N,12,5000)
        path = os.path.join(out_dir, f"{lb}.npy")
        np.save(path, data)
        print(f"Saved: {path} shape={data.shape}")

if __name__ == "__main__":
    main()
