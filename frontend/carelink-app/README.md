# CareLink Frontend

CareLink 프론트엔드는 React Native + Expo 기반의 모바일 애플리케이션입니다. 환자와 보호자가 건강 기록, 인사이트, 복약 일정, 알림, ECG 추론 결과를 모바일 환경에서 확인할 수 있도록 구현되어 있습니다.

## Overview

- Framework: React Native + Expo
- Language: TypeScript
- Navigation: Expo Router
- Local Storage: AsyncStorage
- Notifications: expo-notifications
- Networking: native `fetch` + custom `authFetch`

중요한 구현 사실:

- 현재 프론트는 Axios가 아니라 `fetch` 기반으로 동작합니다.
- ECG 요청은 모바일 앱이 AI 서버를 직접 호출하지 않고, 백엔드의 `/api/ecg` 프록시를 통해 전달합니다.

## Main Features

### 1. Authentication

- 로그인 및 회원가입
- 아이디 찾기 / 비밀번호 재설정
- JWT 기반 세션 유지
- 401 응답 시 refresh 재시도 후 자동 로그아웃

관련 구현:

- `utils/api.ts`
- `contexts/AuthContext.tsx`
- `app/(tabs)/auth/*`

### 2. Home Dashboard

- 사용자 프로필 및 요약 정보 표시
- 주간 health insights 조회
- 보호자 연결 상태 요약
- Cache-First 전략 기반 초기 로딩 최적화

관련 구현:

- `app/(tabs)/Home/HomePage.tsx`

### 3. Vitals and Insights

- 혈압, 혈당, 심박수, ECG 기록 흐름 연동
- 기간별 인사이트 조회
- 상태 점수 기반 메시지 표시

관련 구현:

- `app/(tabs)/Home/Vitals.tsx`
- `app/(tabs)/Home/Insights.tsx`

### 4. Medication Reminder

- 복약 일정 등록 및 수정
- Expo notifications 기반 예약 알림
- 복용 활성화 상태 관리

관련 구현:

- `app/(tabs)/Home/Medication.tsx`

### 5. Guardian and Emergency

- 보호자 연결
- 보호자 목록 관리
- 비상 연락 및 알림 흐름

관련 구현:

- `app/(tabs)/Home/Caregivers.tsx`
- `app/(tabs)/Home/Emergency.tsx`

### 6. ECG Simulator

- 샘플 ECG 데이터 로드
- ECG 시뮬레이터 표시
- 주기적 추론 요청
- 위험도 및 추론 결과 시각화

관련 구현:

- `app/(tabs)/Home/ECGSimulatorScreen.tsx`

## Frontend Request Flow

실제 요청 흐름은 아래와 같습니다.

```text
React Native App
    |
    | authFetch() with JWT
    v
Spring Boot Backend
    |
    | /api/ecg proxy
    v
FastAPI AI Server
```

설명:

- 일반 비즈니스 API는 백엔드로 직접 요청합니다.
- ECG 관련 요청은 `/api/ecg/predict_window`, `/api/ecg/sample_window`를 통해 백엔드를 거칩니다.
- 따라서 문서나 포트폴리오에서도 `모바일 -> 백엔드 -> AI` 구조로 설명하는 것이 맞습니다.

## Project Structure

```text
carelink-app/
├─ app/
│  ├─ (tabs)/
│  │  ├─ auth/
│  │  └─ Home/
│  └─ _layout.tsx
├─ assets/
├─ components/
├─ constants/
├─ contexts/
├─ hooks/
├─ utils/
├─ package.json
└─ README.md
```

주요 디렉터리:

- `app/`: 라우팅 및 화면 구성
- `components/`: 공통 UI 컴포넌트
- `contexts/`: 인증 및 전역 상태
- `utils/`: API 유틸리티와 공통 함수
- `assets/`: 이미지 및 정적 리소스

## Key Implementation Notes

### Cache-First Home Loading

홈 화면은 AsyncStorage에 저장된 캐시를 먼저 보여주고, 이후 네트워크 응답으로 동기화합니다.

실사용 흐름 반복 측정 기준:

- first paint avg: `0.29ms`
- first paint p95: `0.35ms`
- full sync avg: `604.3ms`
- full sync p95: `636.25ms`
- relative improvement: `99.95%`

주의:

- 위 수치는 현재 HomePage의 Cache-First 흐름을 기준으로 근사 측정한 값이며, OS 수준 프레임 렌더 계측은 아닙니다.

### Session Handling

`authFetch()`는 다음을 담당합니다.

- access token 자동 첨부
- 401 응답 시 refresh 시도
- refresh 실패 시 세션 제거 및 로그인 화면 이동

관련 파일:

- `utils/api.ts`

### ECG Inference Routing

현재 프론트 구현은 아래 경로를 사용합니다.

- `authFetch('/api/ecg/predict_window')`
- `authFetch('/api/ecg/sample_window')`

즉, ECG 추론은 프론트에서 직접 AI 서버를 호출하는 구조가 아닙니다.

## Environment Variables

`.env` 예시:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
EXPO_PUBLIC_AI_API_BASE_URL=http://localhost:8080
```

설명:

- 현재 앱은 백엔드 주소를 기준 진입점으로 사용합니다.
- `EXPO_PUBLIC_AI_API_BASE_URL`는 기존 환경 구성과의 호환성을 위해 남아 있을 수 있지만, 실제 ECG 요청도 백엔드를 통해 전달됩니다.

## Running the App

### Install

```bash
npm install
```

### Start

```bash
npm run start
```

### Platform Commands

```bash
npm run android
npm run ios
npm run web
```

## Main API Usage

프론트에서 자주 사용하는 API:

- `GET /api/users/{userId}`
- `GET /api/vitals/insights?userId=...&range=7d`
- `GET /api/notification/{userId}`
- `GET /api/medications/{userId}`
- `POST /api/ecg/predict_window`
- `GET /api/ecg/sample_window`

## Current Performance Snapshot

2026-03-21 기준:

- `user_profile` avg `294.55ms`, p95 `305.96ms`
- `vitals_insights` avg `321.11ms`, p95 `330.99ms`
- `notifications` avg `302.52ms`, p95 `323.45ms`
- ECG inference avg `2382.85ms`, p95 `2698.16ms`

## Known Gaps / Future Improvements

- 디바이스 렌더링 기준의 실제 UI 계측 강화
- ECG 추론 응답시간 2초 이하 최적화
- NaN / Inf 입력에 대한 에러 메시지 개선
- 로딩 상태 메시지와 skeleton UX 보강

## Summary

CareLink 프론트엔드는 건강 기록, 보호자 연결, 복약 알림, ECG 추론 결과 확인을 하나의 모바일 경험으로 통합한 앱입니다. 현재 구현은 AsyncStorage 기반 Cache-First UX, JWT 인증 흐름, 그리고 백엔드 프록시를 통한 ECG 추론 라우팅을 중심으로 동작합니다.
