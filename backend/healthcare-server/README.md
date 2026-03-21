# CareLink Backend

CareLink 백엔드는 Spring Boot 기반의 API 서버입니다. 인증, 사용자 프로필, 건강 기록, 보호자 연결, 알림, 복약 관리, ECG AI 프록시 기능을 담당하며, 모바일 앱과 AI 추론 서버 사이의 중심 계층 역할을 합니다.

## Overview

- Framework: Spring Boot 3
- Language: Java 21
- Security: Spring Security + JWT
- ORM: JPA / Hibernate
- Database: PostgreSQL
- Build: Gradle

백엔드의 핵심 역할:

- 모바일 앱의 인증 및 비즈니스 로직 처리
- 건강 데이터 및 사용자 정보 관리
- 보호자-환자 관계 기반 접근 제어
- 알림 생성 및 조회
- FastAPI AI 서버로 ECG 추론 요청 프록시

## Architecture Role

전체 시스템에서 백엔드는 아래 위치를 담당합니다.

```text
React Native App
    |
    | HTTPS + JWT
    v
Spring Boot Backend
    |
    +--> PostgreSQL
    |
    +--> FastAPI AI Server (/api/ecg proxy)
```

중요한 구현 포인트:

- 프론트엔드는 ECG 추론을 위해 AI 서버를 직접 호출하지 않습니다.
- 백엔드의 `/api/ecg/predict_window`, `/api/ecg/sample_window`가 AI 프록시 역할을 수행합니다.
- 현재 JPA 설정은 `spring.jpa.open-in-view=false`이므로, 컨트롤러에서 LAZY 연관 객체를 직접 다루지 않도록 주의가 필요합니다.

## Core Modules

### Authentication

- 로그인 및 회원가입
- JWT 발급 및 refresh 처리
- 비밀번호 재설정 토큰 발급

주요 컨트롤러:

- `AuthController`

### User and Profile

- 사용자 프로필 조회 및 수정
- 권한 기반 자기 계정 접근 제어

주요 컨트롤러:

- `UserController`

### Health / Vitals

- 건강 데이터 저장
- 요약 및 인사이트 계산
- 이상 징후 감지 기반 알림 연동

주요 컨트롤러:

- `UserHealthController`

### Guardian

- 환자-보호자 연결
- 보호자 관점 환자 조회

주요 컨트롤러:

- `GuardianController`

### Notification

- 비상 알림 생성
- 사용자별 알림 조회
- 읽음 처리

주요 컨트롤러:

- `NotificationController`

### Medication

- 복약 일정 CRUD
- 활성화 상태 관리

주요 컨트롤러:

- `MedicationController`

### ECG Proxy

- AI 서버 추론 요청 전달
- 샘플 ECG 데이터 요청 전달

주요 구현:

- `EcgController`
- `EcgAnalysisService`

## Security Model

### JWT Authentication

기본 인증 방식은 JWT입니다.

- 로그인 성공 시 access token 발급
- 대부분의 API는 JWT가 필요
- 프론트는 `Authorization: Bearer <token>` 형식으로 요청

관련 설정:

- `jwt.secret`
- `jwt.expiration`
- `jwt.refresh-expiration`

### Access Control

`AccessControlService`에서 주요 접근 제어를 담당합니다.

- `ensureSelf(userId)`
- `ensureSelfOrLinkedGuardian(patientUserId)`
- `ensureGuardianSelf(guardianUserId)`
- `ensureSelfLinkedOrViewingGuardian(targetUserId)`
- `ensureSelfOrConnectionParticipant(patientId, guardianId)`

즉, 단순 인증뿐 아니라 환자-보호자 관계까지 포함한 리소스 권한 제어가 적용됩니다.

## Important API Endpoints

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
- `GET /api/vitals/insights?userId=...&range=7d|30d|365d`

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

## ECG Proxy Notes

백엔드는 ECG 요청을 AI 서버로 전달하는 중간 계층입니다.

현재 구현 개요:

- Controller: `/api/ecg/*`
- Service: `EcgAnalysisService`
- AI target: `${AI_ECG_SERVER_URL}`

중요한 점:

- `EcgAnalysisService`는 설정값에 `/predict_window`가 포함되어 있어도 내부에서 base URL로 정규화한 뒤 `/predict_window`, `/sample_window`를 각각 호출합니다.
- 프록시 구조 덕분에 프론트는 인증, 에러 처리, API 진입점을 백엔드 하나로 통일할 수 있습니다.

관련 환경 변수:

- `AI_ECG_SERVER_URL`
- `AI_ECG_API_KEY`
- `AI_ECG_CONNECT_TIMEOUT_MS`
- `AI_ECG_READ_TIMEOUT_MS`

## Notification API Notes

알림 조회 API는 최근 DTO 기반 응답으로 정리되었습니다.

의도:

- 컨트롤러에서 LAZY 연관 객체를 직접 따라가지 않도록 정리
- `spring.jpa.open-in-view=false` 환경에서도 안정적으로 응답 생성
- null-safe 응답 구조 확보

관련 클래스:

- `NotificationController`
- `NotificationResponseDto`
- `UserHealthAlertRepository`

## Database

기본 DB는 PostgreSQL입니다.

주요 테이블:

- `users`
- `user_health`
- `user_health_records`
- `user_guardian_link`
- `user_health_alert`
- `user_medications`
- `user_medication_schedules`
- `disease_trend`
- `brain_training_games`

Flyway로 마이그레이션을 관리합니다.

## Configuration

주요 설정 파일:

- `src/main/resources/application.properties`

중요한 설정:

- `server.port=8080`
- `spring.jpa.open-in-view=false`
- `management.endpoints.web.exposure.include=health`
- `cors.allowed-origins=...`
- `ai.ecg.server-url=...`

## Environment Variables

대표 환경 변수 예시:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/healthcare
SPRING_DATASOURCE_USERNAME=appuser
SPRING_DATASOURCE_PASSWORD=your_password

JWT_SECRET=your_secret
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

PASSWORD_RESET_TOKEN_EXPIRATION_MS=600000

NEWS_API_KEY=your_news_api_key

AI_ECG_SERVER_URL=http://localhost:8000
AI_ECG_API_KEY=
AI_ECG_CONNECT_TIMEOUT_MS=5000
AI_ECG_READ_TIMEOUT_MS=30000

CORS_ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19006,exp://localhost:8081
```

## Run Locally

### 1. Boot with Gradle

```bash
cd backend/healthcare-server
./gradlew bootRun
```

Windows:

```bash
cd backend/healthcare-server
gradlew.bat bootRun
```

기본 포트:

- `8080`

### 2. Build

```bash
cd backend/healthcare-server
./gradlew build
```

### 3. Docker

프로젝트 루트의 `docker-compose.yml` 기준으로 백엔드, AI, DB를 함께 실행할 수 있습니다.

```bash
docker compose up -d
```

## Health Check

백엔드 상태 확인:

- `GET /actuator/health`

## Current Benchmark Snapshot

2026-03-21 기준 주요 백엔드 API 수치:

### `user_profile`

- avg `294.55ms`
- p95 `305.96ms`
- 20 concurrent users TPS `66.08`
- error `0.0%`

### `vitals_insights`

- avg `321.11ms`
- p95 `330.99ms`
- 20 concurrent users TPS `64.21`
- error `0.0%`

### `notifications`

- avg `302.52ms`
- p95 `323.45ms`
- 20 concurrent users TPS `56.23`
- error `0.0%`

### `health_check`

- avg `298.45ms`
- p95 `319.02ms`
- 20 concurrent users TPS `66.41`
- error `0.0%`

## Troubleshooting Notes

### 1. Notification API

과거에는 응답 생성 방식 때문에 알림 조회 실패 가능성이 있었지만, 현재는 DTO 기반 조회/응답 구조로 정리되어 있습니다.

### 2. AI Proxy Timeout

ECG 추론 응답이 지연될 경우 다음을 우선 확인해야 합니다.

- AI 서버 상태
- `AI_ECG_CONNECT_TIMEOUT_MS`
- `AI_ECG_READ_TIMEOUT_MS`
- Hugging Face Space 또는 원격 AI 서버 네트워크 상태

### 3. CORS

모바일, 웹, Expo 환경별 origin 차이로 인해 CORS 문제가 발생할 수 있으므로 `CORS_ALLOWED_ORIGINS`를 실행 환경에 맞게 설정해야 합니다.

## Known Gaps / Next Improvements

- AI 프록시 오류 구분을 더 명확한 응답으로 개선
- NaN / Inf 입력에 대한 AI 서버 validation 보강
- 추가 사용자 흐름까지 벤치마크 범위 확장
- 에러 응답 구조의 일관성 추가 정리

## Summary

CareLink 백엔드는 인증, 건강 기록, 보호자 연결, 알림, 복약 관리, ECG AI 프록시를 담당하는 핵심 비즈니스 계층입니다. 현재 구현은 JWT 기반 보안, PostgreSQL 중심 데이터 관리, 그리고 FastAPI 기반 ECG 추론 서버와의 분리된 통신 구조를 바탕으로 안정적으로 동작하도록 설계되어 있습니다.
