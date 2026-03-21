"""
Measure CareLink AI inference latency and HomePage cache-first loading timings.

This script is tailored to the current local codebase:
  - AI ECG inference endpoint shape matches frontend/app/(tabs)/Home/ECGSimulatorScreen.tsx
  - HomePage cache-first flow matches frontend/app/(tabs)/Home/HomePage.tsx

What it measures
1. AI inference latency
   - Calls POST /predict_window on the AI server directly, or
   - Calls POST /api/ecg/predict_window through the backend proxy

2. Mobile HomePage loading timings (cache-first approximation)
   - "cache_read_ms": time to read locally cached values from a JSON file
   - "network_refresh_ms": time until the same data the app fetches is refreshed from backend
   - "perceived_first_paint_ms": same as cache_read_ms
   - "full_sync_ms": same as network_refresh_ms

Important note
This Python script cannot read AsyncStorage directly from a running Expo app/device.
So the mobile metric is an approximation of the HomePage loading path using:
  - local JSON file as the cache layer
  - backend API calls identical to the screen's network flow

For exact on-device UI timings, add in-app instrumentation later.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import time
from pathlib import Path
from typing import Any

import numpy as np
import requests


DEFAULT_CACHE = {
    "userName": "Cached User",
    "profileImageId": 1,
    "caregivers:list": [
        {"id": "cg-1", "name": "Guardian One", "phone": "01000000000", "avatarId": 1},
        {"id": "cg-2", "name": "Guardian Two", "phone": "01000000001", "avatarId": 2},
    ],
}


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Measure CareLink performance metrics")
    p.add_argument("--backend-url", default="http://localhost:8080", help="Spring backend base URL")
    p.add_argument("--ai-url", default="", help="AI base URL, e.g. https://...hf.space")
    p.add_argument("--token", default="", help="JWT token for backend-proxied calls")
    p.add_argument("--user-id", default="", help="User ID used by HomePage API calls")
    p.add_argument("--password", default="", help="Password for auto login if token is omitted")
    p.add_argument("--iterations", type=int, default=10, help="Number of repeated measurements")
    p.add_argument("--rounds", type=int, default=3, help="Number of benchmark rounds")
    p.add_argument("--warmup", type=int, default=2, help="Warmup requests per round to discard")
    p.add_argument("--interval-ms", type=int, default=150, help="Sleep between measured requests in milliseconds")
    p.add_argument(
        "--ai-mode",
        choices=("direct", "backend"),
        default="direct",
        help="'direct' calls AI /predict_window, 'backend' calls backend /api/ecg/predict_window",
    )
    p.add_argument(
        "--cache-file",
        default="scripts/mobile_home_cache_sample.json",
        help="Local JSON file that approximates AsyncStorage values used by HomePage",
    )
    p.add_argument(
        "--output",
        default="carelink_measured_metrics.json",
        help="Where to save the measurement report",
    )
    p.add_argument("--timeout", type=int, default=90, help="HTTP timeout in seconds")
    p.add_argument("--retries", type=int, default=2, help="Retries per AI request after timeout/error")
    p.add_argument(
        "--skip-mobile",
        action="store_true",
        help="Measure only AI inference and skip HomePage loading timings",
    )
    return p.parse_args()


def load_simple_env(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    data: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def load_benchmark_defaults(path: Path) -> dict[str, str]:
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    out: dict[str, str] = {}
    base_url = raw.get("base_url")
    ai_url = raw.get("ai_url")
    if isinstance(base_url, str) and base_url:
        out["backend_url"] = base_url
    if isinstance(ai_url, str) and ai_url:
        out["ai_url"] = ai_url
    return out


def normalize_base_url(url: str) -> str:
    url = url.strip().rstrip("/")
    if not url:
        return url
    if url.count(":") == 1 and url.startswith("http"):
        return f"{url}:8080"
    return url


def resolve_runtime_defaults(args: argparse.Namespace) -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[1]
    frontend_env = load_simple_env(repo_root / "frontend" / "carelink-app" / ".env")
    root_env = load_simple_env(repo_root / ".env")
    benchmark = load_benchmark_defaults(repo_root / "benchmark_results.json")

    if not args.backend_url or args.backend_url == "http://localhost:8080":
        candidate = (
            benchmark.get("backend_url")
            or frontend_env.get("EXPO_PUBLIC_API_BASE_URL")
            or root_env.get("EXPO_PUBLIC_API_BASE_URL")
            or args.backend_url
        )
        args.backend_url = normalize_base_url(candidate)

    if not args.ai_url:
        candidate = (
            benchmark.get("ai_url")
            or frontend_env.get("EXPO_PUBLIC_AI_API_BASE_URL")
            or root_env.get("EXPO_PUBLIC_AI_API_BASE_URL")
            or ""
        )
        args.ai_url = candidate.rstrip("/")

    return args


def percentile(values: list[float], pct: float) -> float:
    return float(np.percentile(values, pct))


def summarize(values: list[float]) -> dict[str, float]:
    return {
        "avg_ms": round(statistics.mean(values), 2),
        "p50_ms": round(statistics.median(values), 2),
        "p95_ms": round(percentile(values, 95), 2),
        "min_ms": round(min(values), 2),
        "max_ms": round(max(values), 2),
    }


def summarize_status_codes(status_codes: list[int]) -> dict[str, Any]:
    total = len(status_codes)
    success = sum(1 for code in status_codes if 200 <= code < 300)
    return {
        "total_requests": total,
        "success_count": success,
        "error_count": total - success,
        "success_rate_pct": round((success / total) * 100, 2) if total else 0.0,
    }


def sleep_interval(interval_ms: int) -> None:
    if interval_ms > 0:
        time.sleep(interval_ms / 1000.0)


def ensure_cache_file(path: Path) -> None:
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(DEFAULT_CACHE, indent=2), encoding="utf-8")


def login_if_needed(base_url: str, user_id: str, password: str, timeout: int) -> str:
    if not user_id or not password:
        raise ValueError("Token not provided, and user credentials are incomplete.")

    url = f"{base_url.rstrip('/')}/api/auth/login"
    payload = {"userId": user_id, "password": password}
    res = requests.post(url, json=payload, timeout=timeout)
    res.raise_for_status()
    body = res.json()
    token = body.get("token") or body.get("accessToken")
    if not token:
        raise RuntimeError(f"Login succeeded but token was missing: {body}")
    return token


def build_backend_headers(token: str) -> dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }


def make_fake_ecg_payload() -> dict[str, Any]:
    rng = np.random.default_rng()
    x = rng.standard_normal((12, 5000)).tolist()
    return {"x": x, "fs": 500}


def post_with_retries(
    url: str,
    *,
    json_body: dict[str, Any],
    headers: dict[str, str] | None,
    timeout: int,
    retries: int,
) -> requests.Response:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            return requests.post(url, json=json_body, headers=headers, timeout=timeout)
        except requests.RequestException as exc:
            last_error = exc
            if attempt >= retries:
                raise
            time.sleep(1.5 * (attempt + 1))
    assert last_error is not None
    raise last_error


def build_round_summary(samples: list[float]) -> dict[str, float]:
    return summarize(samples) if samples else {}


def measure_ai_inference_direct(
    ai_url: str,
    iterations: int,
    rounds: int,
    warmup: int,
    interval_ms: int,
    timeout: int,
    retries: int,
) -> dict[str, Any]:
    if not ai_url:
        raise ValueError("--ai-url is required when --ai-mode=direct")

    url = f"{ai_url.rstrip('/')}/predict_window"
    latencies: list[float] = []
    errors: list[str] = []
    round_results: list[dict[str, Any]] = []

    for round_index in range(rounds):
        round_latencies: list[float] = []

        for _ in range(warmup):
            try:
                post_with_retries(
                    url,
                    json_body=make_fake_ecg_payload(),
                    headers=None,
                    timeout=timeout,
                    retries=retries,
                ).raise_for_status()
            except requests.RequestException as exc:
                errors.append(str(exc))
            sleep_interval(interval_ms)

        for _ in range(iterations):
            t0 = time.perf_counter()
            try:
                res = post_with_retries(
                    url,
                    json_body=make_fake_ecg_payload(),
                    headers=None,
                    timeout=timeout,
                    retries=retries,
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000
                res.raise_for_status()
                latencies.append(elapsed_ms)
                round_latencies.append(elapsed_ms)
            except requests.RequestException as exc:
                errors.append(str(exc))
            sleep_interval(interval_ms)

        round_results.append(
            {
                "round": round_index + 1,
                "success_count": len(round_latencies),
                **build_round_summary(round_latencies),
            }
        )

    result = {
        "mode": "direct",
        "endpoint": url,
        "iterations_per_round": iterations,
        "rounds": rounds,
        "warmup_per_round": warmup,
        "measured_requests": iterations * rounds,
        "success_count": len(latencies),
        "error_count": len(errors),
        "round_results": round_results,
    }
    if latencies:
        result.update(summarize(latencies))
    if errors:
        result["last_error"] = errors[-1]
    return result


def measure_ai_inference_backend(
    backend_url: str,
    token: str,
    iterations: int,
    rounds: int,
    warmup: int,
    interval_ms: int,
    timeout: int,
    retries: int,
) -> dict[str, Any]:
    url = f"{backend_url.rstrip('/')}/api/ecg/predict_window"
    headers = build_backend_headers(token)
    latencies: list[float] = []
    errors: list[str] = []
    round_results: list[dict[str, Any]] = []

    for round_index in range(rounds):
        round_latencies: list[float] = []

        for _ in range(warmup):
            try:
                post_with_retries(
                    url,
                    json_body=make_fake_ecg_payload(),
                    headers=headers,
                    timeout=timeout,
                    retries=retries,
                ).raise_for_status()
            except requests.RequestException as exc:
                errors.append(str(exc))
            sleep_interval(interval_ms)

        for _ in range(iterations):
            t0 = time.perf_counter()
            try:
                res = post_with_retries(
                    url,
                    json_body=make_fake_ecg_payload(),
                    headers=headers,
                    timeout=timeout,
                    retries=retries,
                )
                elapsed_ms = (time.perf_counter() - t0) * 1000
                res.raise_for_status()
                latencies.append(elapsed_ms)
                round_latencies.append(elapsed_ms)
            except requests.RequestException as exc:
                errors.append(str(exc))
            sleep_interval(interval_ms)

        round_results.append(
            {
                "round": round_index + 1,
                "success_count": len(round_latencies),
                **build_round_summary(round_latencies),
            }
        )

    result = {
        "mode": "backend",
        "endpoint": url,
        "iterations_per_round": iterations,
        "rounds": rounds,
        "warmup_per_round": warmup,
        "measured_requests": iterations * rounds,
        "success_count": len(latencies),
        "error_count": len(errors),
        "round_results": round_results,
    }
    if latencies:
        result.update(summarize(latencies))
    if errors:
        result["last_error"] = errors[-1]
    return result


def measure_mobile_homepage_loading(
    backend_url: str,
    token: str,
    user_id: str,
    cache_file: Path,
    iterations: int,
    rounds: int,
    warmup: int,
    interval_ms: int,
    timeout: int,
) -> dict[str, Any]:
    if not user_id:
        raise ValueError("--user-id is required for mobile HomePage timing")

    headers = build_backend_headers(token)
    backend_url = backend_url.rstrip("/")
    cache_read_times: list[float] = []
    network_refresh_times: list[float] = []
    round_results: list[dict[str, Any]] = []

    def run_once() -> tuple[float, float]:
        t0 = time.perf_counter()
        with cache_file.open("r", encoding="utf-8") as f:
            _cache = json.load(f)
        cache_ms = (time.perf_counter() - t0) * 1000

        t1 = time.perf_counter()
        user_res = requests.get(
            f"{backend_url}/api/users/{user_id}",
            headers=headers,
            timeout=timeout,
        )
        user_res.raise_for_status()
        _user = user_res.json()

        insights_res = requests.get(
            f"{backend_url}/api/vitals/insights",
            headers=headers,
            params={"userId": user_id, "range": "7d"},
            timeout=timeout,
        )
        insights_res.raise_for_status()
        _insights = insights_res.json()
        network_ms = (time.perf_counter() - t1) * 1000
        return cache_ms, network_ms

    for round_index in range(rounds):
        round_cache: list[float] = []
        round_network: list[float] = []

        for _ in range(warmup):
            run_once()
            sleep_interval(interval_ms)

        for _ in range(iterations):
            cache_ms, network_ms = run_once()
            cache_read_times.append(cache_ms)
            network_refresh_times.append(network_ms)
            round_cache.append(cache_ms)
            round_network.append(network_ms)
            sleep_interval(interval_ms + random.randint(0, 50))

        round_results.append(
            {
                "round": round_index + 1,
                "cache_read_ms": build_round_summary(round_cache),
                "network_refresh_ms": build_round_summary(round_network),
            }
        )

    return {
        "screen": "HomePage",
        "flow_basis": [
            "cache keys: userName, profileImageId, caregivers:list",
            "network calls: GET /api/users/{userId}, GET /api/vitals/insights?userId=...&range=7d",
        ],
        "iterations_per_round": iterations,
        "rounds": rounds,
        "warmup_per_round": warmup,
        "measured_requests": iterations * rounds,
        "cache_read_ms": summarize(cache_read_times),
        "network_refresh_ms": summarize(network_refresh_times),
        "perceived_first_paint_ms": summarize(cache_read_times),
        "full_sync_ms": summarize(network_refresh_times),
        "round_results": round_results,
    }


def timed_get(url: str, headers: dict[str, str], timeout: int, *, params: dict[str, Any] | None = None) -> tuple[float, int]:
    t0 = time.perf_counter()
    res = requests.get(url, headers=headers, params=params, timeout=timeout)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    return elapsed_ms, res.status_code


def measure_backend_api_timings(
    backend_url: str,
    token: str,
    user_id: str,
    iterations: int,
    rounds: int,
    warmup: int,
    interval_ms: int,
    timeout: int,
) -> dict[str, Any]:
    if not user_id:
        raise ValueError("--user-id is required for backend API timings")

    headers = build_backend_headers(token)
    backend_url = backend_url.rstrip("/")
    specs = [
        {
            "name": "user_profile",
            "url": f"{backend_url}/api/users/{user_id}",
            "params": None,
        },
        {
            "name": "vitals_insights_7d",
            "url": f"{backend_url}/api/vitals/insights",
            "params": {"userId": user_id, "range": "7d"},
        },
        {
            "name": "notifications",
            "url": f"{backend_url}/api/notification/{user_id}",
            "params": None,
        },
    ]

    results: dict[str, Any] = {}
    for spec in specs:
        latencies: list[float] = []
        status_codes: list[int] = []
        last_error = ""
        round_results: list[dict[str, Any]] = []
        for round_index in range(rounds):
            round_latencies: list[float] = []
            round_codes: list[int] = []

            for _ in range(warmup):
                try:
                    _, status_code = timed_get(
                        spec["url"],
                        headers,
                        timeout,
                        params=spec["params"],
                    )
                    round_codes.append(status_code)
                    status_codes.append(status_code)
                except requests.RequestException as exc:
                    round_codes.append(0)
                    status_codes.append(0)
                    last_error = str(exc)
                sleep_interval(interval_ms)

            for _ in range(iterations):
                try:
                    elapsed_ms, status_code = timed_get(
                        spec["url"],
                        headers,
                        timeout,
                        params=spec["params"],
                    )
                    latencies.append(elapsed_ms)
                    round_latencies.append(elapsed_ms)
                    round_codes.append(status_code)
                    status_codes.append(status_code)
                except requests.RequestException as exc:
                    round_codes.append(0)
                    status_codes.append(0)
                    last_error = str(exc)
                sleep_interval(interval_ms)

            round_results.append(
                {
                    "round": round_index + 1,
                    **summarize_status_codes(round_codes),
                    **build_round_summary(round_latencies),
                }
            )

        row: dict[str, Any] = {
            "endpoint": spec["url"],
            "iterations_per_round": iterations,
            "rounds": rounds,
            "warmup_per_round": warmup,
            "measured_requests": iterations * rounds,
            **summarize_status_codes(status_codes),
            "round_results": round_results,
        }
        if latencies:
            row.update(summarize(latencies))
        if last_error:
            row["last_error"] = last_error
        results[spec["name"]] = row

    return results


def compute_derived_metrics(report: dict[str, Any]) -> dict[str, Any]:
    derived: dict[str, Any] = {}

    ai = report.get("ai_inference", {})
    measured_requests = ai.get("measured_requests", 0)
    if measured_requests:
        derived["ai_success_rate_pct"] = round(
            (ai.get("success_count", 0) / measured_requests) * 100, 2
        )

    mobile = report.get("mobile_home_loading")
    if mobile:
        first_paint_avg = mobile["perceived_first_paint_ms"]["avg_ms"]
        full_sync_avg = mobile["full_sync_ms"]["avg_ms"]
        if full_sync_avg > 0:
            derived["cache_first_improvement_pct"] = round(
                ((full_sync_avg - first_paint_avg) / full_sync_avg) * 100, 2
            )
            derived["cache_first_speedup_x"] = round(full_sync_avg / max(first_paint_avg, 0.01), 2)

    return derived


def main() -> None:
    args = resolve_runtime_defaults(parse_args())
    cache_file = Path(args.cache_file)
    ensure_cache_file(cache_file)

    token = args.token
    if not token and args.ai_mode == "backend":
        token = login_if_needed(args.backend_url, args.user_id, args.password, args.timeout)
    if not token and args.user_id and args.password:
        token = login_if_needed(args.backend_url, args.user_id, args.password, args.timeout)

    report: dict[str, Any] = {
        "measured_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "backend_url": args.backend_url,
        "ai_url": args.ai_url,
    }

    if args.ai_mode == "direct":
        report["ai_inference"] = measure_ai_inference_direct(
            args.ai_url,
            args.iterations,
            args.rounds,
            args.warmup,
            args.interval_ms,
            args.timeout,
            args.retries,
        )
    else:
        if not token:
            raise ValueError("Backend AI mode requires --token or valid --user-id/--password")
        report["ai_inference"] = measure_ai_inference_backend(
            args.backend_url,
            token,
            args.iterations,
            args.rounds,
            args.warmup,
            args.interval_ms,
            args.timeout,
            args.retries,
        )

    if not args.skip_mobile:
        if not token:
            raise ValueError("Mobile HomePage measurement requires --token or valid --user-id/--password")
        report["mobile_home_loading"] = measure_mobile_homepage_loading(
            args.backend_url,
            token,
            args.user_id,
            cache_file,
            args.iterations,
            args.rounds,
            args.warmup,
            args.interval_ms,
            args.timeout,
        )
        report["backend_api_timings"] = measure_backend_api_timings(
            args.backend_url,
            token,
            args.user_id,
            args.iterations,
            args.rounds,
            args.warmup,
            args.interval_ms,
            args.timeout,
        )

    report["derived_metrics"] = compute_derived_metrics(report)

    output_path = Path(args.output)
    output_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    ai = report["ai_inference"]

    print("[AI inference]")
    print(f"  endpoint: {ai['endpoint']}")
    if "avg_ms" in ai:
        print(
            f"  avg={ai['avg_ms']}ms p50={ai['p50_ms']}ms "
            f"p95={ai['p95_ms']}ms success={ai['success_count']} error={ai['error_count']}"
        )
    else:
        print(
            f"  no successful measurements; success={ai['success_count']} "
            f"error={ai['error_count']}"
        )
        if "last_error" in ai:
            print(f"  last_error={ai['last_error']}")

    mobile = report.get("mobile_home_loading")
    if mobile:
        print("\n[Mobile HomePage loading]")
        print(
            "  cache-first(first paint) "
            f"avg={mobile['perceived_first_paint_ms']['avg_ms']}ms "
            f"p95={mobile['perceived_first_paint_ms']['p95_ms']}ms"
        )
        print(
            "  full sync(network refresh) "
            f"avg={mobile['full_sync_ms']['avg_ms']}ms "
            f"p95={mobile['full_sync_ms']['p95_ms']}ms"
        )

        derived = report.get("derived_metrics", {})
        if "cache_first_improvement_pct" in derived:
            print(
                "  improvement "
                f"{derived['cache_first_improvement_pct']}% "
                f"(speedup x{derived['cache_first_speedup_x']})"
            )

        api_timings = report.get("backend_api_timings", {})
        if api_timings:
            print("\n[Backend API timings]")
            for name, row in api_timings.items():
                if "avg_ms" in row:
                    print(
                        f"  {name}: avg={row['avg_ms']}ms "
                        f"p95={row['p95_ms']}ms success={row['success_rate_pct']}%"
                    )
                else:
                    print(
                        f"  {name}: no successful measurements "
                        f"success={row['success_rate_pct']}%"
                    )
    print(f"\nSaved report: {output_path}")


if __name__ == "__main__":
    main()
