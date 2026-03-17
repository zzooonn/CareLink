"""
CareLink API 성능 벤치마크 스크립트
--------------------------------------
용도: 논문 6장 실험 데이터 수집
  - 백엔드 API 응답시간 측정 (동시 사용자별)
  - ECG 추론 지연시간 측정
  - EC2 Lite 환경 피크 TPS 측정

사용법:
  pip install requests numpy
  python benchmark_api.py --base-url http://<EC2-IP>:30080 --token <JWT>

결과: benchmark_results.json (논문 표/그래프 원본 데이터)
"""

import argparse
import json
import statistics
import threading
import time
from datetime import datetime

import numpy as np
import requests


# ---------------------------------------------------------------------------
# 1. 인자 파싱
# ---------------------------------------------------------------------------
def parse_args():
    p = argparse.ArgumentParser(description="CareLink API Benchmark")
    p.add_argument("--base-url", default="http://localhost:8080",
                   help="백엔드 base URL (e.g. http://3.x.x.x:8080)")
    p.add_argument("--ai-url", default="http://localhost:8000",
                   help="AI 서버 base URL")
    p.add_argument("--token", default="",
                   help="JWT Bearer 토큰 (생략 시 자동 로그인)")
    p.add_argument("--ai-key", default="",
                   help="AI 서버 X-API-Key")
    p.add_argument("--user-id", default="benchuser",
                   help="테스트 계정 userId")
    p.add_argument("--password", default="Bench1234!",
                   help="테스트 계정 password")
    p.add_argument("--concurrency", type=int, nargs="+", default=[1, 5, 10, 20],
                   help="동시 사용자 수 목록 (기본: 1 5 10 20)")
    p.add_argument("--requests-per-thread", type=int, default=20,
                   help="스레드당 요청 수 (기본: 20)")
    p.add_argument("--ecg-samples", type=int, default=30,
                   help="ECG 추론 반복 횟수 (기본: 30)")
    p.add_argument("--out", default="benchmark_results.json",
                   help="결과 저장 파일명")
    return p.parse_args()


# ---------------------------------------------------------------------------
# 2. HTTP 헬퍼
# ---------------------------------------------------------------------------
def make_headers(token: str) -> dict:
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


def timed_get(url: str, headers: dict, timeout: int = 10) -> tuple[float, int]:
    """(latency_ms, status_code)"""
    t0 = time.perf_counter()
    try:
        r = requests.get(url, headers=headers, timeout=timeout)
        return (time.perf_counter() - t0) * 1000, r.status_code
    except Exception:
        return (time.perf_counter() - t0) * 1000, 0


# ---------------------------------------------------------------------------
# 3. 동시 부하 테스트 워커
# ---------------------------------------------------------------------------
def load_worker(url: str, headers: dict, n: int, results: list, lock: threading.Lock):
    local = []
    for _ in range(n):
        lat, code = timed_get(url, headers)
        local.append({"latency_ms": round(lat, 2), "status": code})
    with lock:
        results.extend(local)


def run_concurrent_test(url: str, headers: dict, concurrency: int,
                        requests_per_thread: int) -> dict:
    results = []
    lock = threading.Lock()
    threads = [
        threading.Thread(target=load_worker,
                         args=(url, headers, requests_per_thread, results, lock))
        for _ in range(concurrency)
    ]
    t0 = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    elapsed = time.perf_counter() - t0

    latencies = [r["latency_ms"] for r in results]
    success = sum(1 for r in results if 200 <= r["status"] < 300)
    total = len(results)

    return {
        "concurrency": concurrency,
        "total_requests": total,
        "success_requests": success,
        "error_rate_pct": round((total - success) / total * 100, 2),
        "elapsed_sec": round(elapsed, 2),
        "tps": round(total / elapsed, 2),
        "latency_avg_ms": round(statistics.mean(latencies), 2),
        "latency_p50_ms": round(statistics.median(latencies), 2),
        "latency_p95_ms": round(np.percentile(latencies, 95), 2),
        "latency_p99_ms": round(np.percentile(latencies, 99), 2),
        "latency_max_ms": round(max(latencies), 2),
    }


# ---------------------------------------------------------------------------
# 4. ECG 추론 지연시간 측정
# ---------------------------------------------------------------------------
def make_fake_ecg_payload() -> dict:
    """12-lead, 5000 샘플 (10s @ 500Hz) 랜덤 ECG"""
    rng = np.random.default_rng()
    x = rng.standard_normal((12, 5000)).tolist()
    return {"x": x, "fs": 500}


def benchmark_ecg_inference(ai_base_url: str, ai_key: str, n_samples: int) -> dict:
    url = f"{ai_base_url}/predict_window"
    headers = {"Content-Type": "application/json"}
    if ai_key:
        headers["X-API-Key"] = ai_key

    latencies = []
    errors = 0

    print(f"\n[ECG] {n_samples}회 추론 지연시간 측정 중...")
    for i in range(n_samples):
        payload = make_fake_ecg_payload()
        t0 = time.perf_counter()
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=60)
            lat = (time.perf_counter() - t0) * 1000
            if r.status_code == 200:
                latencies.append(lat)
            else:
                errors += 1
        except Exception:
            errors += 1
        if (i + 1) % 5 == 0:
            print(f"  {i+1}/{n_samples} 완료...")

    if not latencies:
        return {"error": "모든 요청 실패", "errors": errors}

    return {
        "endpoint": url,
        "n_samples": n_samples,
        "success": len(latencies),
        "errors": errors,
        "latency_avg_ms": round(statistics.mean(latencies), 2),
        "latency_p50_ms": round(statistics.median(latencies), 2),
        "latency_p95_ms": round(np.percentile(latencies, 95), 2),
        "latency_p99_ms": round(np.percentile(latencies, 99), 2),
        "latency_min_ms": round(min(latencies), 2),
        "latency_max_ms": round(max(latencies), 2),
    }


# ---------------------------------------------------------------------------
# 5. 경계값 오류 테스트 (이상 입력)
# ---------------------------------------------------------------------------
def run_boundary_tests(ai_base_url: str, ai_key: str) -> list:
    url = f"{ai_base_url}/predict_window"
    headers = {"Content-Type": "application/json"}
    if ai_key:
        headers["X-API-Key"] = ai_key

    cases = [
        ("빈 배열",           {"x": [], "fs": 500}),
        ("NaN 포함",          {"x": [[float("nan")] * 5000] * 12, "fs": 500}),
        ("잘못된 lead 수 (6)", {"x": [[0.0] * 5000] * 6, "fs": 500}),
        ("길이 불일치",        {"x": [[0.0] * 100, [0.0] * 200] + [[0.0] * 5000] * 10, "fs": 500}),
        ("잘못된 샘플링 주파수", {"x": [[0.0] * 1000] * 12, "fs": 0}),
    ]

    results = []
    print("\n[경계값 테스트]")
    for name, payload in cases:
        try:
            r = requests.post(url, json=payload, headers=headers, timeout=15)
            status = r.status_code
            body = r.text[:120]
        except Exception as e:
            status = -1
            body = str(e)
        ok = status in (400, 422, 500)  # 서버가 graceful하게 오류를 반환해야 함
        result = {"case": name, "status": status, "graceful": ok, "body": body}
        results.append(result)
        mark = "✅" if ok else "❌"
        print(f"  {mark} [{name}] → HTTP {status}")

    return results


# ---------------------------------------------------------------------------
# 6. 메인
# ---------------------------------------------------------------------------
def auto_login(base_url: str, user_id: str, password: str) -> str:
    """테스트 계정 자동 생성 후 JWT 반환"""
    headers = {"Content-Type": "application/json"}

    # 회원가입 시도 (이미 있으면 409, 무시)
    try:
        requests.post(f"{base_url}/api/auth/signup", json={
            "userId": user_id, "password": password,
            "name": "BenchUser", "email": f"{user_id}@bench.test",
            "birthDate": "1990-01-01",
            "phone": "01000000000",
            "role": "PATIENT"
        }, headers=headers, timeout=15)
    except Exception:
        pass

    # 로그인
    try:
        r = requests.post(f"{base_url}/api/auth/login", json={
            "userId": user_id, "password": password
        }, headers=headers, timeout=15)
        if r.status_code == 200:
            data = r.json()
            token = data.get("token") or data.get("accessToken") or data.get("jwt", "")
            if token:
                print(f"  ✅ 자동 로그인 성공 (userId={user_id})")
                return token
        print(f"  ⚠️  로그인 응답: HTTP {r.status_code} — 인증 없이 진행")
    except Exception as e:
        print(f"  ⚠️  로그인 실패: {e} — 인증 없이 진행")
    return ""


def main():
    args = parse_args()
    report = {
        "generated_at": datetime.now().isoformat(),
        "base_url": args.base_url,
        "ai_url": args.ai_url,
    }

    print("=== CareLink API 벤치마크 ===")

    # --- 6-1. 백엔드 헬스 확인 ---
    health_url = f"{args.base_url}/actuator/health"
    lat, code = timed_get(health_url, {})
    print(f"[Health] {health_url} → HTTP {code} ({lat:.1f}ms)")
    report["backend_health"] = {"status": code, "latency_ms": round(lat, 2)}

    # --- 6-2. JWT 토큰 확보 ---
    token = args.token
    if not token:
        print("\n[인증] JWT 토큰 자동 발급 중...")
        token = auto_login(args.base_url, args.user_id, args.password)
    headers = make_headers(token)

    # --- 6-3. 주요 API 동시 부하 테스트 ---
    endpoints = {
        "health_check": f"{args.base_url}/actuator/health",
        "user_health_records": f"{args.base_url}/api/user-health/{args.user_id}/records?range=7d",
    }

    report["load_test"] = {}
    for ep_name, url in endpoints.items():
        # health_check는 인증 불필요
        ep_headers = {} if ep_name == "health_check" else headers
        print(f"\n[부하테스트] {ep_name}")
        ep_results = []
        for c in args.concurrency:
            print(f"  동시 {c}명 × {args.requests_per_thread}회 요청...")
            r = run_concurrent_test(url, ep_headers, c, args.requests_per_thread)
            ep_results.append(r)
            print(f"    → avg {r['latency_avg_ms']}ms | p95 {r['latency_p95_ms']}ms | "
                  f"TPS {r['tps']} | 에러율 {r['error_rate_pct']}%")
        report["load_test"][ep_name] = ep_results

    # --- 6-3. ECG 추론 지연시간 ---
    report["ecg_inference"] = benchmark_ecg_inference(
        args.ai_url, args.ai_key, args.ecg_samples
    )
    ecg = report["ecg_inference"]
    if "latency_avg_ms" in ecg:
        print(f"\n[ECG 추론] avg {ecg['latency_avg_ms']}ms | "
              f"p95 {ecg['latency_p95_ms']}ms | max {ecg['latency_max_ms']}ms")

    # --- 6-4. 경계값 오류 테스트 ---
    report["boundary_tests"] = run_boundary_tests(args.ai_url, args.ai_key)

    # --- 6-5. 결과 저장 ---
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n✅ 결과 저장 완료: {args.out}")

    # --- 6-6. 요약 출력 ---
    print("\n=== 논문 수록용 요약 ===")
    for ep_name, results in report["load_test"].items():
        print(f"\n{ep_name}:")
        print(f"  {'동시접속':>6} | {'avg(ms)':>8} | {'p95(ms)':>8} | {'TPS':>7} | {'에러율':>6}")
        print(f"  {'-'*50}")
        for r in results:
            print(f"  {r['concurrency']:>6} | {r['latency_avg_ms']:>8} | "
                  f"{r['latency_p95_ms']:>8} | {r['tps']:>7} | {r['error_rate_pct']:>5}%")
    if "latency_avg_ms" in report["ecg_inference"]:
        e = report["ecg_inference"]
        print(f"\nECG 추론 지연시간 (n={e['n_samples']}):")
        print(f"  avg={e['latency_avg_ms']}ms  p50={e['latency_p50_ms']}ms  "
              f"p95={e['latency_p95_ms']}ms  max={e['latency_max_ms']}ms")


if __name__ == "__main__":
    main()
