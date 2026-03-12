# 🏥 CareLink: AI-Powered Mobile Healthcare

CareLink는 **React Native(Expo) + Spring Boot + FastAPI** 기반의 통합 헬스케어 프로젝트입니다.

## 1) 프로젝트 구성

- `frontend/carelink-app`: 모바일 앱 (Expo + TypeScript)
- `backend/healthcare-server`: API 서버 (Spring Boot + PostgreSQL)
- `ai/src`: ECG 추론 서버 (FastAPI + PyTorch)

## 2) 현재 동작 방식 (요약)

1. 모바일 앱이 `EXPO_PUBLIC_API_BASE_URL`로 백엔드 API를 호출
2. 백엔드는 사용자/건강 데이터 CRUD 및 인사이트 API 제공
3. 백엔드는 PostgreSQL과 통신
4. AI 서버는 별도 API 서버로 실행되어 ECG 추론 처리

자세한 구조/점검 내용: `docs/CICD_RUNTIME_GUIDE.md`

---

## 3) 로컬 실행

### A. 개별 실행

#### Backend
```bash
cd backend/healthcare-server
./gradlew bootRun
```

#### AI
```bash
cd ai
pip install -r requirements.txt
cd src
uvicorn server:app --host 0.0.0.0 --port 8000
```

#### Frontend
```bash
cd frontend/carelink-app
npm install
npm run start
```

> 프론트엔드 `.env`에 `EXPO_PUBLIC_API_BASE_URL=http://<백엔드주소>:8080` 필요

### B. Docker Compose (권장)

```bash
docker compose up --build
```

- backend: `8080`
- ai: `8000`
- postgres: `5432`

---

## 4) EC2 프리티어(저메모리) 실행

프리티어에서는 일반 compose보다 `docker-compose.ec2-lite.yml` 사용을 권장합니다.

```bash
docker compose -f docker-compose.ec2-lite.yml up -d
```

상세 운영 가이드: `DEPLOYMENT_DOCKER_K8S.md`

---

## 5) CI/CD 현재 상태 (중요)

현재 레포에는 활성화된 GitHub Actions 워크플로우가 없어,
- PR 자동 테스트
- 이미지 자동 빌드
- 자동 배포
가 구성되어 있지 않습니다.

즉, 현재는 **수동 실행/수동 배포** 상태입니다.

권장 CI/CD 설계와 단계별 제안은 `docs/CICD_RUNTIME_GUIDE.md`를 참고하세요.

---

## 6) 주의사항

- AI 결과는 의료 보조 목적이며 최종 진단은 전문 의료진 판단이 필요합니다.
- `application.properties`에는 기본값이 있으나, 운영에서는 반드시 환경변수로 민감정보를 주입하세요.

