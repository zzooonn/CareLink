#!/usr/bin/env python
# statistical_tests.py
# =============================================================================
# 논문 수준의 통계적 유의성 검정 모듈
#
# 제공 함수:
#   bootstrap_auroc_ci()  — DeLong 대안: Bootstrap으로 AUROC 신뢰구간 계산
#   paired_ttest()        — 두 모델의 반복 실험 결과에 대해 Paired t-test 수행
#   mcnemar_test()        — 두 모델의 예측 결과에 대해 McNemar 검정 수행
#
# 사용 예시는 하단 main() 블록 참고
# =============================================================================

import numpy as np
from scipy import stats as scipy_stats
from sklearn.metrics import roc_auc_score


# =============================================================================
# 1. Bootstrap AUROC 신뢰구간
#    DeLong (1988) 검정의 비모수 대안.
#    두 모델 각각의 AUROC에 대해 CI를 계산하고, 차이에 대한 CI도 제공.
# =============================================================================
def bootstrap_auroc_ci(
    y_true: np.ndarray,
    y_prob_a: np.ndarray,
    y_prob_b: np.ndarray = None,
    n_bootstrap: int = 10000,
    ci: float = 0.95,
    seed: int = 42,
) -> dict:
    """
    Bootstrap을 이용한 AUROC 신뢰구간 계산.

    Parameters
    ----------
    y_true    : (N,) 또는 (N, C) — 정답 레이블
    y_prob_a  : (N,) 또는 (N, C) — 모델 A 예측 확률
    y_prob_b  : (N,) 또는 (N, C) — 모델 B 예측 확률 (None이면 A만 계산)
    n_bootstrap : 부트스트랩 반복 횟수
    ci        : 신뢰수준 (기본 0.95 → 95% CI)
    seed      : 난수 시드

    Returns
    -------
    dict with keys:
        auc_a          : float — 관측된 모델 A AUROC
        ci_a           : (lo, hi) — 모델 A AUROC CI
        auc_b          : float or None
        ci_b           : (lo, hi) or None
        diff_obs       : float or None — auc_a - auc_b
        ci_diff        : (lo, hi) or None — 차이의 CI
        significant    : bool or None — CI가 0을 포함하지 않으면 True
    """
    rng = np.random.default_rng(seed)
    n = len(y_true)
    alpha = 1.0 - ci

    def _auc(yt, yp):
        try:
            avg = "macro" if yt.ndim == 2 else "binary"
            return roc_auc_score(yt, yp, average=avg if yt.ndim == 2 else None)
        except ValueError:
            return float("nan")

    # --- 모델 A ---
    auc_a_obs = _auc(y_true, y_prob_a)
    boot_a = []
    for _ in range(n_bootstrap):
        idx = rng.integers(0, n, size=n)
        boot_a.append(_auc(y_true[idx], y_prob_a[idx]))
    boot_a = np.array([v for v in boot_a if not np.isnan(v)])
    ci_a = (np.percentile(boot_a, alpha / 2 * 100),
            np.percentile(boot_a, (1 - alpha / 2) * 100))

    result = {
        "auc_a": auc_a_obs, "ci_a": ci_a,
        "auc_b": None, "ci_b": None,
        "diff_obs": None, "ci_diff": None, "significant": None,
    }

    if y_prob_b is None:
        return result

    # --- 모델 B + 차이 ---
    auc_b_obs = _auc(y_true, y_prob_b)
    boot_b, boot_diff = [], []
    rng2 = np.random.default_rng(seed)  # 동일 인덱스로 쌍 비교
    for _ in range(n_bootstrap):
        idx = rng2.integers(0, n, size=n)
        va = _auc(y_true[idx], y_prob_a[idx])
        vb = _auc(y_true[idx], y_prob_b[idx])
        boot_b.append(vb)
        boot_diff.append(va - vb)

    boot_b = np.array([v for v in boot_b if not np.isnan(v)])
    boot_diff = np.array([v for v in boot_diff if not np.isnan(v)])
    ci_b = (np.percentile(boot_b, alpha / 2 * 100),
            np.percentile(boot_b, (1 - alpha / 2) * 100))
    ci_diff = (np.percentile(boot_diff, alpha / 2 * 100),
               np.percentile(boot_diff, (1 - alpha / 2) * 100))
    significant = not (ci_diff[0] <= 0 <= ci_diff[1])

    result.update({
        "auc_b": auc_b_obs, "ci_b": ci_b,
        "diff_obs": auc_a_obs - auc_b_obs,
        "ci_diff": ci_diff, "significant": significant,
    })
    return result


# =============================================================================
# 2. Paired t-test
#    두 모델의 N회 반복 실험 스칼라 결과(예: Macro F1)를 받아 검정.
# =============================================================================
def paired_ttest(
    scores_a: list,
    scores_b: list,
    alpha: float = 0.05,
    metric_name: str = "Macro F1",
    model_a_name: str = "Model A",
    model_b_name: str = "Model B",
) -> dict:
    """
    두 모델의 반복 실험 결과에 대해 Paired t-test 수행.

    Parameters
    ----------
    scores_a  : 모델 A의 실험별 스칼라 점수 (예: [74.52, 74.83, 75.01])
    scores_b  : 모델 B의 실험별 스칼라 점수 (len(scores_a) == len(scores_b))
    alpha     : 유의수준 (기본 0.05)
    metric_name : 메트릭 이름 (출력용)
    model_a_name, model_b_name : 모델 이름 (출력용)

    Returns
    -------
    dict with keys: t_stat, p_value, significant, mean_a, std_a, mean_b, std_b,
                    mean_diff, ci_diff_95
    """
    a = np.array(scores_a, dtype=float)
    b = np.array(scores_b, dtype=float)
    assert len(a) == len(b), "scores_a와 scores_b의 길이가 같아야 합니다."
    assert len(a) >= 2, "최소 2회 이상 반복 실험 결과가 필요합니다."

    t_stat, p_value = scipy_stats.ttest_rel(a, b)
    diff = a - b
    n = len(diff)
    se = diff.std(ddof=1) / np.sqrt(n)
    t_crit = scipy_stats.t.ppf(1 - alpha / 2, df=n - 1)
    ci_diff = (diff.mean() - t_crit * se, diff.mean() + t_crit * se)

    result = {
        "metric": metric_name,
        "model_a": model_a_name, "mean_a": float(a.mean()), "std_a": float(a.std(ddof=1)),
        "model_b": model_b_name, "mean_b": float(b.mean()), "std_b": float(b.std(ddof=1)),
        "mean_diff": float(diff.mean()),
        f"ci_diff_{int((1-alpha)*100)}": ci_diff,
        "t_stat": float(t_stat), "p_value": float(p_value),
        "significant": bool(p_value < alpha),
    }
    return result


def print_ttest_result(res: dict):
    """paired_ttest() 결과를 논문 표 형식으로 출력"""
    print(f"\n[Paired t-test] {res['metric']}  (α=0.05)")
    print(f"  {res['model_a']}: {res['mean_a']:.4f} ± {res['std_a']:.4f}")
    print(f"  {res['model_b']}: {res['mean_b']:.4f} ± {res['std_b']:.4f}")
    ci_key = [k for k in res if k.startswith("ci_diff_")][0]
    lo, hi = res[ci_key]
    print(f"  Mean diff ({res['model_a']} − {res['model_b']}): "
          f"{res['mean_diff']:+.4f}  "
          f"{ci_key.replace('_', ' ').replace('ci diff', 'CI')}: [{lo:+.4f}, {hi:+.4f}]")
    print(f"  t={res['t_stat']:.4f}, p={res['p_value']:.4f}  "
          f"→ {'SIGNIFICANT (p<0.05)' if res['significant'] else 'not significant (p≥0.05)'}")


# =============================================================================
# 3. McNemar 검정
#    두 모델의 예측 결과(이진)가 같은 샘플/다른 샘플의 분포를 비교.
#    클래스별로 호출하거나, 전체 샘플에 대해 호출한다.
# =============================================================================
def mcnemar_test(
    y_true: np.ndarray,
    y_pred_a: np.ndarray,
    y_pred_b: np.ndarray,
    exact: bool = False,
    correction: bool = True,
    alpha: float = 0.05,
) -> dict:
    """
    McNemar 검정: 두 모델의 분류 결과 차이가 유의한지 검정.

    Parameters
    ----------
    y_true   : (N,) 정답 레이블 (이진 또는 다중 클래스 각각에 대해 호출)
    y_pred_a : (N,) 모델 A 예측 (0 또는 1)
    y_pred_b : (N,) 모델 B 예측 (0 또는 1)
    exact    : True이면 이항 검정(exact), False이면 카이제곱 근사
    correction : True이면 Yates 연속성 보정 적용 (exact=False 시)
    alpha    : 유의수준

    Returns
    -------
    dict with keys: b, c, statistic, p_value, significant
        b = A 맞고 B 틀린 샘플 수
        c = A 틀리고 B 맞는 샘플 수
    """
    correct_a = (y_pred_a == y_true).astype(int)
    correct_b = (y_pred_b == y_true).astype(int)

    # 불일치 셀
    b = int(((correct_a == 1) & (correct_b == 0)).sum())  # A맞 B틀
    c = int(((correct_a == 0) & (correct_b == 1)).sum())  # A틀 B맞

    if exact:
        # 이항 검정 (b+c가 작을 때 권장)
        n = b + c
        if n == 0:
            p_value = 1.0
            statistic = 0.0
        else:
            # H0: p=0.5 (양측)
            p_value = float(2 * scipy_stats.binom.cdf(min(b, c), n, 0.5))
            p_value = min(p_value, 1.0)
            statistic = float(min(b, c))
        test_type = "exact binomial"
    else:
        # 카이제곱 근사 (Yates 보정 선택적)
        if correction:
            statistic = (abs(b - c) - 1) ** 2 / max(b + c, 1)
        else:
            statistic = (b - c) ** 2 / max(b + c, 1)
        p_value = float(scipy_stats.chi2.sf(statistic, df=1))
        test_type = "chi2" + (" (Yates)" if correction else "")

    return {
        "b": b, "c": c,
        "test_type": test_type,
        "statistic": float(statistic),
        "p_value": p_value,
        "significant": bool(p_value < alpha),
    }


def print_mcnemar_result(res: dict, label_name: str = ""):
    """mcnemar_test() 결과를 논문 표 형식으로 출력"""
    tag = f"[{label_name}] " if label_name else ""
    print(f"\n{tag}McNemar test ({res['test_type']})")
    print(f"  A correct, B wrong (b) = {res['b']}")
    print(f"  A wrong, B correct (c) = {res['c']}")
    print(f"  statistic={res['statistic']:.4f}, p={res['p_value']:.4f}  "
          f"→ {'SIGNIFICANT (p<0.05)' if res['significant'] else 'not significant (p≥0.05)'}")


# =============================================================================
# 사용 예시 (실제 모델 결과로 교체하여 사용)
# =============================================================================
if __name__ == "__main__":
    import os, sys

    print("=" * 65)
    print("  Statistical Tests — Example / Integration Test")
    print("=" * 65)

    rng = np.random.default_rng(0)
    N, C = 2000, 5

    # ── 예시 데이터 생성 (실제 사용 시 모델 출력으로 교체) ──────────────
    y_true_mc = (rng.random((N, C)) > 0.7).astype(int)
    # 모델 A가 약간 더 잘하도록 설계
    y_prob_a = np.clip(y_true_mc * 0.6 + rng.random((N, C)) * 0.4, 0, 1)
    y_prob_b = np.clip(y_true_mc * 0.55 + rng.random((N, C)) * 0.45, 0, 1)

    # 1. Bootstrap AUROC CI ────────────────────────────────────────────────
    print("\n[1] Bootstrap AUROC CI (CNN-CBAM-GRU vs ResNet1D)")
    res_auc = bootstrap_auroc_ci(
        y_true_mc, y_prob_a, y_prob_b,
        n_bootstrap=5000, ci=0.95, seed=42
    )
    print(f"  Model A AUROC: {res_auc['auc_a']:.4f}  "
          f"95% CI: [{res_auc['ci_a'][0]:.4f}, {res_auc['ci_a'][1]:.4f}]")
    print(f"  Model B AUROC: {res_auc['auc_b']:.4f}  "
          f"95% CI: [{res_auc['ci_b'][0]:.4f}, {res_auc['ci_b'][1]:.4f}]")
    print(f"  Diff (A-B):   {res_auc['diff_obs']:+.4f}  "
          f"95% CI: [{res_auc['ci_diff'][0]:+.4f}, {res_auc['ci_diff'][1]:+.4f}]")
    print(f"  Significant: {res_auc['significant']}")

    # 2. Paired t-test ─────────────────────────────────────────────────────
    print("\n[2] Paired t-test (3 runs example)")
    # 예시: 3회 반복 실험 Macro F1 (%)
    f1_cnn    = [74.52, 74.83, 75.01]
    f1_resnet = [74.37, 74.61, 74.90]
    res_tt = paired_ttest(
        f1_cnn, f1_resnet,
        metric_name="Macro F1 (%)",
        model_a_name="CNN-CBAM-GRU",
        model_b_name="ResNet1D",
    )
    print_ttest_result(res_tt)

    # 3. McNemar 검정 ──────────────────────────────────────────────────────
    print("\n[3] McNemar test (HYP class binary predictions)")
    # 예시: HYP 클래스 이진 예측
    thr = 0.5
    y_true_hyp  = y_true_mc[:, 4]
    y_pred_a_hyp = (y_prob_a[:, 4] >= thr).astype(int)
    y_pred_b_hyp = (y_prob_b[:, 4] >= thr).astype(int)
    res_mc = mcnemar_test(y_true_hyp, y_pred_a_hyp, y_pred_b_hyp,
                          exact=False, correction=True)
    print_mcnemar_result(res_mc, label_name="HYP")

    # 모든 클래스에 대해 McNemar 검정
    LABELS = ["NORM", "STTC", "MI", "CD", "HYP"]
    print("\n[3b] McNemar test — all classes")
    for ci_idx, lbl in enumerate(LABELS):
        yt  = y_true_mc[:, ci_idx]
        pa  = (y_prob_a[:, ci_idx] >= thr).astype(int)
        pb  = (y_prob_b[:, ci_idx] >= thr).astype(int)
        res = mcnemar_test(yt, pa, pb, exact=False, correction=True)
        sig = "*" if res["significant"] else " "
        print(f"  {lbl:4s} | b={res['b']:4d} c={res['c']:4d} | "
              f"chi2={res['statistic']:6.3f} p={res['p_value']:.4f} {sig}")

    print("\nDone.")
