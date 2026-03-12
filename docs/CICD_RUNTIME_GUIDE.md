# CareLink 동작 구조 + CI/CD 점검 가이드

이 문서는 현재 코드 기준으로 **실제 동작 방식**과 **CI/CD 상태**를 점검한 결과를 정리합니다.

## 1. 현재 구조가 어떻게 동작하나

## 1) Frontend (Expo React Native)
- 앱은 `EXPO_PUBLIC_API_BASE_URL` 환경변수를 기준으로 백엔드 API를 호출합니다.
- 인증/회원가입/프로필/인사이트 화면에서 모두 동일한 베이스 URL을 사용합니다.
- 실제 기기 테스트 시 `localhost`가 아니라 개발 PC 또는 서버 IP를 써야 합니다.

핵심 파일:
- `frontend/carelink-app/app/(tabs)/auth/login.tsx`
- `frontend/carelink-app/app/(tabs)/auth/signup.tsx`
- `frontend/carelink-app/app/(tabs)/Home/Insights.tsx`

## 2) Backend (Spring Boot)
- 기본 포트 `8080`.
- `/api/auth/*`, `/api/vitals/*`, `/api/news/*` 등 REST API 제공.
- 현재 `SecurityConfig`는 `anyRequest().permitAll()`이라 인증 강제는 켜져 있지 않습니다(개발 모드 성격).
- DB 접속, JWT secret, News API key는 환경변수로 오버라이드 가능하게 구성되어 있습니다.

핵심 파일:
- `backend/healthcare-server/src/main/java/com/example/demo/SecurityConfig.java`
- `backend/healthcare-server/src/main/java/com/example/demo/controller/UserHealthController.java`
- `backend/healthcare-server/src/main/resources/application.properties`

## 3) AI Server (FastAPI)
- 기본 포트 `8000`.
- ECG 윈도우 기반 추론 API(`/predict_window`)와 샘플 API를 제공합니다.
- 모델 경로/샘플 경로는 `MODEL_PATH`, `SAMPLE_DIR` 환경변수로 제어됩니다.

핵심 파일:
- `ai/src/server.py`

## 4) Compose 기준 서비스 흐름
1. Frontend(모바일) -> Backend(`:8080`)
2. Backend -> Postgres(`:5432`)
3. AI는 독립 서비스(`:8000`)이며 현재 백엔드에서 직접 호출하는 코드 연결은 문서화 대비 제한적일 수 있으므로, 실제 연동 포인트를 점검하면서 확장하는 것을 권장합니다.

---

## 2. 현재 CI/CD 상태 (중요)

현재 레포에는 활성화된 GitHub Actions 워크플로우(`.github/workflows/*.yml`)가 없습니다.
즉,
- PR 자동 테스트
- 자동 Docker 이미지 빌드
- 자동 배포
가 현재는 **미구축 상태**입니다.

---

## 3. README/문서에서 수정이 필요한 부분 (이번에 반영)

1. **CI/CD가 이미 있는 것처럼 보이지 않도록 명시**
2. **Java 버전/실행 방법을 실제 코드와 일치**
3. **로컬 개발용 compose와 EC2 저메모리 compose의 목적 분리**
4. **실무 배포 순서(빌드 위치, 이미지 push/pull, 배포) 구체화**

---

## 4. 추천 CI/CD 설계 (현실적인 최소안)

## A. CI (PR마다)
- Frontend: `npm ci`, `npm run lint`
- Backend: `./gradlew clean test` (또는 최소 `./gradlew classes`)
- Docker lint/check: `docker compose config` (self-hosted runner나 docker 가능한 환경에서)

## B. CD (main 머지 시)
1. Backend/AI Docker image build
2. GHCR or Docker Hub push
3. EC2 배포 서버에서 pull + `docker compose -f docker-compose.ec2-lite.yml up -d`

## C. EC2 프리티어일 때 추가 팁
- EC2에서 직접 build 금지 (메모리 폭증)
- swap 2GB 이상 설정
- AI는 profile로 필요할 때만 기동
- 장기적으로 DB는 RDS 분리 권장

---

## 5. 바로 실행 가능한 운영 체크리스트

1. `.env` 또는 배포 환경변수 준비
   - `EXPO_PUBLIC_API_BASE_URL`
   - `SPRING_DATASOURCE_*`
   - `JWT_SECRET`
   - `NEWS_API_KEY`
2. 로컬:
   - `docker compose up --build`
3. EC2 프리티어:
   - `docker compose -f docker-compose.ec2-lite.yml up -d`
4. 헬스 확인:
   - `docker ps`
   - `docker logs carelink-backend --tail=100`
   - `docker logs carelink-postgres --tail=100`

