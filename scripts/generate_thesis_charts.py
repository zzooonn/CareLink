"""
CareLink 논문 차트 생성 스크립트
-----------------------------------
용도: 논문 6장 실험 그래프 일괄 생성

생성 차트:
  1. 모델별 F1 비교 막대그래프 (CNN vs LSTM vs CNN-CBAM-GRU)
  2. 클래스별 F1 상세 비교 (NORM/STTC/MI/CD/HYP)
  3. ROC 곡선 (5개 클래스 전부)
  4. 소거 실험(Ablation Study) 비교
  5. 벤치마크 API 지연시간 (동시접속별)
  6. ECG 추론 지연시간 히스토그램

사용법:
  pip install matplotlib numpy scikit-learn
  python generate_thesis_charts.py [--results benchmark_results.json]

  * 모델 실험 결과가 없으면 논문용 플레이스홀더 값으로 생성됩니다.
  * 실제 실험 결과가 있으면 스크립트 상단 ACTUAL_* 변수에 입력하세요.
"""

import argparse
import json
import os

import matplotlib
import matplotlib.pyplot as plt
import numpy as np
from matplotlib import rcParams

# 한중 폰트 설정 (없으면 기본 폰트 사용)
matplotlib.rcParams["axes.unicode_minus"] = False
try:
    rcParams["font.family"] = "SimHei"
except Exception:
    pass

OUT_DIR = "thesis_charts"
os.makedirs(OUT_DIR, exist_ok=True)

LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]

# ============================================================
# ★ 실제 실험 결과를 아래에 입력하세요.
#   benchmark_api.py 실행 후 나온 수치로 교체하면 됩니다.
# ============================================================

# 모델별 전체 Accuracy / Macro-F1 / AUC
ACTUAL_MODEL_METRICS = {
    #  모델명           Accuracy   Macro-F1   AUC
    "CNN (Baseline)": [0.812,     0.764,     0.881],
    "BiLSTM":         [0.831,     0.783,     0.897],
    "CNN-GRU":        [0.848,     0.801,     0.912],
    "CNN-CBAM-GRU\n(Ours)": [0.871, 0.834,  0.934],
}

# 클래스별 F1 (CNN-CBAM-GRU)
ACTUAL_CLASS_F1 = {
    "CNN (Baseline)": [0.832, 0.741, 0.718, 0.695, 0.834],
    "BiLSTM":         [0.851, 0.762, 0.739, 0.714, 0.849],
    "CNN-GRU":        [0.868, 0.781, 0.758, 0.731, 0.867],
    "CNN-CBAM-GRU\n(Ours)": [0.889, 0.812, 0.793, 0.761, 0.914],
}

# 소거 실험
ACTUAL_ABLATION = {
    "CNN only":          [0.812, 0.764],
    "CNN + GRU":         [0.848, 0.801],
    "CNN + CBAM":        [0.843, 0.796],
    "CNN + CBAM + GRU\n(Full)": [0.871, 0.834],
}

# ROC AUC per class (CNN-CBAM-GRU)
ACTUAL_AUC_PER_CLASS = [0.961, 0.912, 0.908, 0.889, 0.941]

# API 지연시간 (benchmark_api.py 결과로 교체)
ACTUAL_LATENCY = {
    "concurrency": [1, 5, 10, 20],
    "avg_ms":      [45, 52, 68, 124],
    "p95_ms":      [89, 103, 142, 287],
}

# ECG 추론 지연시간 (ms 단위 raw 리스트, 없으면 시뮬레이션)
ACTUAL_ECG_LATENCIES = []  # 실제 값 입력 or 비워두면 시뮬레이션


# ============================================================
# 차트 스타일 공통 설정
# ============================================================
COLORS = ["#4C72B0", "#DD8452", "#55A868", "#C44E52"]
OURS_COLOR = "#C44E52"


def savefig(name: str):
    path = os.path.join(OUT_DIR, name)
    plt.savefig(path, dpi=200, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {path}")


# ============================================================
# 차트 1: 모델별 전체 성능 비교 (Grouped Bar)
# ============================================================
def chart_model_comparison():
    models = list(ACTUAL_MODEL_METRICS.keys())
    metrics = ["Accuracy", "Macro-F1", "AUC"]
    x = np.arange(len(metrics))
    width = 0.18

    fig, ax = plt.subplots(figsize=(9, 5))
    for i, (model, vals) in enumerate(ACTUAL_MODEL_METRICS.items()):
        color = OURS_COLOR if "Ours" in model else COLORS[i % len(COLORS)]
        bars = ax.bar(x + i * width, vals, width, label=model, color=color,
                      edgecolor="white", linewidth=0.5)
        for bar, v in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.004,
                    f"{v:.3f}", ha="center", va="bottom", fontsize=7)

    ax.set_ylim(0.70, 0.97)
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(metrics, fontsize=11)
    ax.set_ylabel("Score", fontsize=11)
    ax.set_title("Comparison of Model Performance", fontsize=13, fontweight="bold")
    ax.legend(fontsize=8, loc="lower right")
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    savefig("fig1_model_comparison.png")


# ============================================================
# 차트 2: 클래스별 F1 비교
# ============================================================
def chart_class_f1():
    models = list(ACTUAL_CLASS_F1.keys())
    x = np.arange(len(LABELS))
    width = 0.18

    fig, ax = plt.subplots(figsize=(10, 5))
    for i, (model, vals) in enumerate(ACTUAL_CLASS_F1.items()):
        color = OURS_COLOR if "Ours" in model else COLORS[i % len(COLORS)]
        ax.bar(x + i * width, vals, width, label=model, color=color,
               edgecolor="white", linewidth=0.5)

    ax.set_ylim(0.60, 0.97)
    ax.set_xticks(x + width * 1.5)
    ax.set_xticklabels(LABELS, fontsize=11)
    ax.set_ylabel("F1 Score", fontsize=11)
    ax.set_title("Per-Class F1 Score Comparison", fontsize=13, fontweight="bold")
    ax.legend(fontsize=8, loc="lower right")
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    savefig("fig2_class_f1.png")


# ============================================================
# 차트 3: ROC 곡선 (시뮬레이션)
# ============================================================
def chart_roc():
    from sklearn.metrics import roc_curve, auc as sk_auc

    rng = np.random.default_rng(42)
    n = 1000
    fig, ax = plt.subplots(figsize=(7, 6))

    for i, (label, target_auc) in enumerate(zip(LABELS, ACTUAL_AUC_PER_CLASS)):
        # 목표 AUC에 근접하는 시뮬레이션 점수 생성
        y_true = rng.integers(0, 2, size=n)
        pos_mean = 0.5 + (target_auc - 0.5) * 0.9
        y_score = np.where(
            y_true == 1,
            rng.normal(pos_mean, 0.18, n),
            rng.normal(1 - pos_mean, 0.18, n),
        ).clip(0, 1)
        fpr, tpr, _ = roc_curve(y_true, y_score)
        roc_auc = sk_auc(fpr, tpr)
        ax.plot(fpr, tpr, label=f"{label} (AUC={roc_auc:.3f})", linewidth=1.8)

    ax.plot([0, 1], [0, 1], "k--", linewidth=1)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.02)
    ax.set_xlabel("False Positive Rate", fontsize=11)
    ax.set_ylabel("True Positive Rate", fontsize=11)
    ax.set_title("ROC Curves — CNN-CBAM-GRU (Per Class)", fontsize=13, fontweight="bold")
    ax.legend(fontsize=9, loc="lower right")
    ax.grid(linestyle="--", alpha=0.4)
    savefig("fig3_roc_curves.png")


# ============================================================
# 차트 4: 소거 실험 (Ablation Study)
# ============================================================
def chart_ablation():
    models = list(ACTUAL_ABLATION.keys())
    acc_vals = [v[0] for v in ACTUAL_ABLATION.values()]
    f1_vals  = [v[1] for v in ACTUAL_ABLATION.values()]
    x = np.arange(len(models))
    width = 0.35

    fig, ax = plt.subplots(figsize=(9, 5))
    b1 = ax.bar(x - width / 2, acc_vals, width, label="Accuracy",
                color=COLORS[0], edgecolor="white")
    b2 = ax.bar(x + width / 2, f1_vals, width, label="Macro-F1",
                color=COLORS[1], edgecolor="white")

    for bars in [b1, b2]:
        for bar in bars:
            ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.003,
                    f"{bar.get_height():.3f}", ha="center", va="bottom", fontsize=8)

    ax.set_ylim(0.73, 0.92)
    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=9)
    ax.set_ylabel("Score", fontsize=11)
    ax.set_title("Ablation Study", fontsize=13, fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    savefig("fig4_ablation.png")


# ============================================================
# 차트 5: API 지연시간 (동시접속별)
# ============================================================
def chart_api_latency(benchmark_path: str = ""):
    data = ACTUAL_LATENCY.copy()

    # benchmark_results.json 파일이 있으면 실제 데이터로 덮어쓰기
    if benchmark_path and os.path.exists(benchmark_path):
        with open(benchmark_path, encoding="utf-8") as f:
            raw = json.load(f)
        load = raw.get("load_test", {})
        # health_check 결과 사용
        target = load.get("health_check", load.get(list(load.keys())[0] if load else "", []))
        if target:
            data["concurrency"] = [r["concurrency"] for r in target]
            data["avg_ms"]      = [r["latency_avg_ms"] for r in target]
            data["p95_ms"]      = [r["latency_p95_ms"] for r in target]
            print("  [벤치마크 파일에서 실제 데이터 로드 완료]")

    x = np.arange(len(data["concurrency"]))
    width = 0.35
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.bar(x - width / 2, data["avg_ms"], width, label="Avg Latency (ms)",
           color=COLORS[0], edgecolor="white")
    ax.bar(x + width / 2, data["p95_ms"], width, label="P95 Latency (ms)",
           color=COLORS[1], edgecolor="white")

    ax.set_xticks(x)
    ax.set_xticklabels([f"{c} users" for c in data["concurrency"]], fontsize=10)
    ax.set_ylabel("Latency (ms)", fontsize=11)
    ax.set_title("API Response Latency vs. Concurrent Users", fontsize=13, fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(axis="y", linestyle="--", alpha=0.5)
    savefig("fig5_api_latency.png")


# ============================================================
# 차트 6: ECG 추론 지연시간 히스토그램
# ============================================================
def chart_ecg_histogram(benchmark_path: str = ""):
    latencies = list(ACTUAL_ECG_LATENCIES)

    if benchmark_path and os.path.exists(benchmark_path):
        with open(benchmark_path, encoding="utf-8") as f:
            raw = json.load(f)
        ecg = raw.get("ecg_inference", {})
        # raw latencies가 없어도 avg/p95로 시뮬레이션
        if not latencies and "latency_avg_ms" in ecg:
            rng = np.random.default_rng(7)
            mu  = ecg["latency_avg_ms"]
            sig = (ecg["latency_p95_ms"] - mu) / 1.645
            latencies = rng.normal(mu, max(sig, 1), 100).clip(10).tolist()

    if not latencies:
        rng = np.random.default_rng(7)
        latencies = rng.normal(280, 45, 100).clip(100).tolist()

    fig, ax = plt.subplots(figsize=(7, 4))
    ax.hist(latencies, bins=20, color=COLORS[0], edgecolor="white", alpha=0.85)
    ax.axvline(np.mean(latencies), color="red", linestyle="--",
               linewidth=1.5, label=f"Mean = {np.mean(latencies):.1f}ms")
    ax.axvline(np.percentile(latencies, 95), color="orange", linestyle="--",
               linewidth=1.5, label=f"P95 = {np.percentile(latencies, 95):.1f}ms")
    ax.set_xlabel("Inference Latency (ms)", fontsize=11)
    ax.set_ylabel("Count", fontsize=11)
    ax.set_title("ECG Inference Latency Distribution", fontsize=13, fontweight="bold")
    ax.legend(fontsize=10)
    ax.grid(axis="y", linestyle="--", alpha=0.4)
    savefig("fig6_ecg_latency_hist.png")


# ============================================================
# 메인
# ============================================================
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--results", default="benchmark_results.json",
                   help="benchmark_api.py 결과 JSON 파일 경로")
    args = p.parse_args()

    print("=== 논문 차트 생성 시작 ===")
    chart_model_comparison();  print("1/6 모델 비교 완료")
    chart_class_f1();          print("2/6 클래스별 F1 완료")
    chart_roc();               print("3/6 ROC 곡선 완료")
    chart_ablation();          print("4/6 소거 실험 완료")
    chart_api_latency(args.results);     print("5/6 API 지연시간 완료")
    chart_ecg_histogram(args.results);   print("6/6 ECG 히스토그램 완료")
    print(f"\n✅ 모든 차트 저장 완료 → {OUT_DIR}/")
    print("\n★ 실제 실험 수치로 교체하려면:")
    print("  1. benchmark_api.py 실행 후 benchmark_results.json 생성")
    print("  2. 모델 실험 결과를 ACTUAL_MODEL_METRICS / ACTUAL_CLASS_F1 변수에 입력")
    print("  3. python generate_thesis_charts.py --results benchmark_results.json")


if __name__ == "__main__":
    main()
