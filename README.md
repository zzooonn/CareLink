# CareLink

CareLink는 환자와 보호자를 연결하는 모바일 헬스케어 플랫폼입니다. React Native 앱, Spring Boot 백엔드, FastAPI 기반 ECG 추론 서버를 분리한 3-Tier 구조로 구현되어 있으며, 건강 기록 관리, 보호자 연결, 복약 관리, 알림, ECG 기반 AI 진단 기능을 제공합니다.

## Overview

- Mobile: React Native + Expo
- Backend: Spring Boot 3 / Java 21
- AI Inference: FastAPI + PyTorch
- Database: PostgreSQL 16
- Deployment: Docker / AWS EC2 / GHCR

핵심 목표는 다음과 같습니다.

- 환자 건강 데이터의 지속적인 기록과 조회
- 보호자와 환자 간 상태 공유 및 알림 연동
- ECG 기반 AI 추론 결과 제공
- 모바일 환경에서 빠른 체감 응답성 확보

## System Architecture

현재 구현 기준 요청 흐름은 아래와 같습니다.

```text
React Native / Expo App
        |
        | HTTPS + JWT
        v
Spring Boot Backend
  - auth
  - users
  - vitals
  - guardian
  - notification
  - medication
  - /api/ecg proxy
        |
        | REST / JSON
        v
FastAPI AI Server
  - /health
  - /sample_window
  - /predict_window
        |
        v
PostgreSQL
```

중요한 구현 포인트:

- 모바일 앱은 AI 서버를 직접 호출하지 않고, Spring Boot의 `/api/ecg` 프록시 레이어를 통해 ECG 추론을 요청합니다.
- 인증은 JWT 기반이며, 프론트엔드는 `authFetch()`를 통해 토큰 자동 첨부 및 401 재시도 흐름을 처리합니다.
- 홈 화면은 AsyncStorage 기반 Cache-First 전략으로 초기 체감 로딩 속도를 개선합니다.

## Tech Stack

### Frontend

- React Native
- Expo
- TypeScript
- Expo Router
- AsyncStorage
- expo-notifications

### Backend

- Spring Boot 3
- Java 21
- Spring Security
- JPA / Hibernate
- PostgreSQL
- Gradle

### AI

- FastAPI
- PyTorch
- NumPy
- SciPy
- Uvicorn

### Infra

- Docker
- Docker Compose
- AWS EC2
- GHCR

## Key Features

### 1. Authentication and Session Handling

- JWT 기반 로그인 및 회원가입
- 비밀번호 재설정 및 토큰 기반 세션 관리
- 401 응답 시 refresh 재시도 후 실패 시 자동 로그아웃

### 2. Health / Vitals Monitoring

- 혈압, 혈당, 심박수, ECG 기록 입력
- 주간 및 장기 health insights 조회
- 상태 변화 감지 및 요약 정보 제공

### 3. Guardian Connection

- 환자-보호자 연결
- 보호자 계정에서 환자 상태 조회
- 비상 상황 알림 전송

### 4. Medication Reminder

- 복약 일정 등록, 수정, 삭제
- Expo notifications 기반 로컬 알림 스케줄링
- 복용 활성화 상태 관리

### 5. ECG AI Inference

- 12-lead ECG 데이터 입력
- FastAPI 서버에서 멀티라벨 분류 수행
- 주요 클래스: `NORM`, `STTC`, `MI`, `CD`, `HYP`
- 결과와 위험도(`low`, `medium`, `high`) 제공

### 6. Cache-First Mobile UX

- 홈 화면 진입 시 AsyncStorage 캐시 우선 표시
- 이후 서버 데이터로 비동기 동기화
- 체감 로딩 지연 감소

## ECG AI Model

현재 ECG 추론 서버는 `CNN-CBAM-GRU` 구조를 기반으로 동작합니다.

- Input: `(12, 5000)` ECG window
- Sampling rate: 500Hz
- Dataset: PTB-XL
- Task: 5-class multilabel classification

모델 출력 예시:

- class probabilities
- active labels
- top label / confidence
- risk level

## API Summary

### Auth

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/find-id`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`

### Users

- `GET /api/users/{userId}`
- `PUT /api/users/{userId}`

### Vitals

- `POST /api/vitals`
- `GET /api/vitals/summary?userId=...`
- `GET /api/vitals/insights?userId=...&range=7d`

### Guardian

- `POST /api/guardian/connect`
- `GET /api/guardian/my-patients/{guardianId}`
- `GET /api/guardian/my-guardians/{patientId}`

### Notification

- `POST /api/notification/send`
- `GET /api/notification/{userId}`
- `PATCH /api/notification/{userId}/{alertId}/read`

### Medication

- `GET /api/medications/{userId}`
- `POST /api/medications/{userId}`
- `PUT /api/medications/{userId}/{medId}`
- `DELETE /api/medications/{userId}/{medId}`

### ECG Proxy

- `POST /api/ecg/predict_window`
- `GET /api/ecg/sample_window`

### AI Server

- `GET /health`
- `GET /sample_window`
- `POST /predict_window`

## Performance Snapshot

아래 수치는 2026-03-21 기준 로컬 실측 및 부하 테스트 결과입니다.

> **참고 (측정 조건):** 여기 수치는 AWS EC2 인스턴스가 충분히 웜업된 상태에서 측정한 값입니다. 콜드 스타트 직후 첫 번째 부하 테스트 시에는 TCP 연결 풀 초기화 과정에서 10-concurrent 구간에서 평균 응답시간이 일시적으로 500~600ms대로 상승하는 현상이 관찰됩니다. 이는 AWS EC2의 정상적인 JVM JIT 컴파일 및 연결 풀 예열 효과이며, 웜업 이후에는 아래 수치로 안정화됩니다. 논문 5장의 Table 5.3 수치는 별도 측정 회차(콜드 스타트 환경)에서 채취된 값으로 이 README와 차이가 있을 수 있습니다.

### API Load Test

#### `health_check`

- 1 concurrent: avg `302.11ms`, p95 `320.03ms`, TPS `3.31`, error `0.0%`
- 5 concurrent: avg `302.16ms`, p95 `317.12ms`, TPS `16.22`, error `0.0%`
- 10 concurrent: avg `299.72ms`, p95 `316.01ms`, TPS `31.64`, error `0.0%`
- 20 concurrent: avg `298.45ms`, p95 `319.02ms`, TPS `66.41`, error `0.0%`

#### `vitals_insights`

- 1 concurrent: avg `321.11ms`, p95 `330.99ms`, TPS `3.11`, error `0.0%`
- 5 concurrent: avg `322.86ms`, p95 `357.12ms`, TPS `14.65`, error `0.0%`
- 10 concurrent: avg `310.55ms`, p95 `334.28ms`, TPS `31.57`, error `0.0%`
- 20 concurrent: avg `307.27ms`, p95 `337.81ms`, TPS `64.21`, error `0.0%`

#### `user_profile`

- 1 concurrent: avg `294.55ms`, p95 `305.96ms`, TPS `3.39`, error `0.0%`
- 5 concurrent: avg `297.15ms`, p95 `310.94ms`, TPS `16.69`, error `0.0%`
- 10 concurrent: avg `297.09ms`, p95 `314.04ms`, TPS `33.48`, error `0.0%`
- 20 concurrent: avg `298.22ms`, p95 `320.04ms`, TPS `66.08`, error `0.0%`

#### `notifications`

- 1 concurrent: avg `302.52ms`, p95 `323.45ms`, TPS `3.30`, error `0.0%`
- 5 concurrent: avg `306.06ms`, p95 `319.71ms`, TPS `15.66`, error `0.0%`
- 10 concurrent: avg `301.64ms`, p95 `315.23ms`, TPS `31.31`, error `0.0%`
- 20 concurrent: avg `314.39ms`, p95 `343.57ms`, TPS `56.23`, error `0.0%`

### ECG Inference

- Samples: `30`
- Average latency: `2382.85ms`
- P50 latency: `2303.27ms`
- P95 latency: `2698.16ms`
- Max latency: `3214.31ms`

### Mobile UX Measurement

실사용 흐름 반복 측정 기준:

- Cache-First first paint: avg `0.29ms`, p95 `0.35ms`
- Full sync after network refresh: avg `604.3ms`, p95 `636.25ms`
- Relative improvement: `99.95%`

주의:

- 위 모바일 수치는 실제 디바이스 프레임 렌더링 계측이 아니라, 현재 HomePage의 Cache-First 흐름을 기준으로 근사 측정한 값입니다.

## Boundary Tests

비정상 입력에 대한 ECG 추론 서버 경계 테스트를 별도로 수행했습니다.

- 빈 배열: 서버 에러 응답 반환
- 잘못된 lead 수: 서버 에러 응답 반환
- 길이 불일치: 서버 에러 응답 반환
- 잘못된 샘플링 주파수: 서버 에러 응답 반환

참고:

- `NaN`/`Inf` 입력에 대한 validation이 구현 완료되었습니다. `ai/src/server.py`의 `validate_request_matrix()` 함수에서 NaN/Inf 포함 입력을 감지하여 `422 Unprocessable Entity`를 반환합니다.

## Running the Project

### 1. Environment Variables

루트 `.env` 예시:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/healthcare
SPRING_DATASOURCE_USERNAME=appuser
SPRING_DATASOURCE_PASSWORD=your_password

JWT_SECRET=your_secret
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

NEWS_API_KEY=your_news_api_key

AI_ECG_SERVER_URL=http://localhost:8000
AI_ECG_API_KEY=
AI_ECG_CONNECT_TIMEOUT_MS=5000
AI_ECG_READ_TIMEOUT_MS=30000
```

프론트 `.env` 예시:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
EXPO_PUBLIC_AI_API_BASE_URL=http://localhost:8080
```

중요:

- 현재 프론트는 ECG 요청도 백엔드를 통해 전달하므로, 일반적인 실행 환경에서는 백엔드 주소를 기준 진입점으로 사용합니다.

### 2. Run with Docker Compose

```bash
docker compose up -d
```

기본 서비스 주소:

- Backend: `http://localhost:8080`
- AI: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

### 3. Frontend

```bash
cd frontend/carelink-app
npm install
npm run start
```

### 4. Backend

```bash
cd backend/healthcare-server
./gradlew bootRun
```

Windows:

```bash
cd backend/healthcare-server
gradlew.bat bootRun
```

### 5. AI Server

```bash
cd ai
python src/server.py
```

## Benchmark Scripts

### API Load Benchmark

```bash
python scripts/benchmark_api.py \
  --base-url http://localhost:8080 \
  --ai-url http://localhost:8000 \
  --user-id kevin \
  --password kevin1234
```

### Real-Usage Style Measurement

```bash
python scripts/measure_carelink_metrics.py \
  --backend-url http://localhost:8080 \
  --user-id kevin \
  --password kevin1234 \
  --rounds 5 \
  --warmup 3 \
  --iterations 20 \
  --interval-ms 200
```

## Project Structure

```text
HealthCare/
├─ ai/
│  ├─ src/
│  ├─ models/
│  └─ data/
├─ backend/
│  └─ healthcare-server/
├─ frontend/
│  └─ carelink-app/
├─ scripts/
├─ deploy/
├─ docs/
├─ docker-compose.yml
└─ README.md
```

## Known Gaps / Next Improvements

- NaN / Inf boundary validation response refinement
- ECG inference latency optimization below 2 seconds
- device-side rendering measurement accuracy improvement
- additional benchmark coverage for more user flows

## Summary

CareLink는 모바일 앱, Spring Boot 백엔드, FastAPI 기반 AI 추론 서버를 분리한 구조 위에서 동작하는 실시간 헬스케어 플랫폼입니다. 현재 구현은 인증, 보호자 연결, 알림, 복약 관리, 건강 기록, ECG AI 추론까지 하나의 통합 서비스로 연결되어 있으며, 최근 실측 기준 주요 API 응답은 약 `300ms` 수준, ECG 추론 평균 지연은 약 `2.38초`입니다.
