# CareLink Docker + Kubernetes 시작 가이드

이 문서는 **Docker가 처음인 팀원**을 위한 실전 가이드입니다.

## 1) 먼저 결론: Kubernetes를 지금 당장 해야 하나?

짧은 답: **아니요. 처음에는 Docker + docker-compose로 충분합니다.**

- 지금 프로젝트는 개발/데모 단계에서
  - `backend`(Spring Boot),
  - `ai`(FastAPI),
  - `postgres` 3개 서비스만 안정적으로 올리면 됩니다.
- 이 정도 규모는 docker-compose가 가장 빠르고 단순합니다.
- Kubernetes는 아래 상황에서 도입하세요.
  - 트래픽 증가로 자동 확장 필요
  - 무중단 배포, 롤백, 운영 모니터링 체계 필요
  - 여러 환경(dev/staging/prod)과 다수 서비스 운영 필요

## 2) 구성된 파일

- `docker-compose.yml`: 로컬에서 3개 컨테이너를 한 번에 실행.
- `backend/healthcare-server/Dockerfile`: Spring Boot 이미지를 빌드.
- `ai/Dockerfile`: FastAPI 이미지를 빌드.
- `ai/requirements.txt`: AI 서버 파이썬 의존성.

## 3) 사전 준비

- Docker Desktop 설치 (Windows/Mac) 또는 Docker Engine (Linux)
- 설치 확인:

```bash
docker --version
docker compose version
```

## 4) 첫 실행 (가장 쉬운 방법)

프로젝트 루트(`/workspace/CareLink`)에서:

```bash
docker compose up --build
```

실행 후 포트:
- Backend: `http://localhost:8080`
- AI: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

종료:

```bash
docker compose down
```

데이터까지 삭제:

```bash
docker compose down -v
```

## 5) 중요한 환경 변수

`docker-compose.yml`에서 아래 값은 운영 전 반드시 바꾸세요.

- `NEWS_API_KEY`
- `JWT_SECRET`
- Postgres 비밀번호 (`POSTGRES_PASSWORD`)

또한 `application.properties`는 환경변수 우선으로 읽도록 바꿔두었습니다.

## 6) 자주 하는 실수

1. **모바일 앱에서 localhost 사용**
   - 실기기 Expo 앱에서 `localhost`는 폰 자신을 뜻합니다.
   - 폰에서 접속하려면 개발 PC의 IP로 백엔드 주소를 지정하세요.
2. **AI 모델 파일 누락**
   - `ai/models/best_model_multilabel.pth`가 없으면 AI 서버 추론 실패.
3. **DB 접속값 불일치**
   - compose의 DB 계정/비밀번호와 백엔드 env가 같아야 합니다.

## 7) Kubernetes는 이렇게 “다음 단계”로

Docker로 안정화된 뒤 아래 순서 권장:

1. 이미지를 레지스트리에 push (Docker Hub/GHCR/ECR)
2. K8s 매니페스트 작성
   - `Deployment` (backend, ai)
   - `Service` (ClusterIP)
   - `Secret` (JWT, API 키, DB 비밀번호)
   - `ConfigMap` (일반 설정)
3. Ingress/Nginx로 외부 노출
4. 모니터링(Prometheus/Grafana), 로그(ELK/Loki) 도입

> 즉, **Docker = 패키징/실행 표준화**, **Kubernetes = 대규모 운영 자동화**입니다.

## 8) 추천 학습 순서 (처음 시작 기준)

1. `docker run`으로 단일 컨테이너 개념 이해
2. `docker compose up`으로 멀티 컨테이너 운영
3. 이미지 최적화(멀티 스테이지, 캐시)
4. CI/CD에서 Docker 이미지 자동 빌드
5. Kubernetes 입문(minikube or kind)


## 9) EC2 프리티어(저메모리)에서 Docker가 안 올라갈 때

결론부터: **Docker를 포기할 필요 없습니다.** 대신 아래처럼 경량 운영으로 바꾸면 됩니다.

### A. EC2에서 `build` 하지 말고, 이미지 `pull`만 하세요

- EC2에서 `docker compose up --build`는 메모리를 가장 많이 씁니다.
- 권장 방식:
  1) 로컬/CI(GitHub Actions)에서 이미지 빌드
  2) 레지스트리(Docker Hub/GHCR)에 push
  3) EC2에서는 pull 후 실행

이 저장소에는 이를 위해 `docker-compose.ec2-lite.yml`을 추가했습니다.

```bash
# 기본(backend + postgres)만 실행
docker compose -f docker-compose.ec2-lite.yml up -d

# AI까지 필요할 때만 profile로 추가 실행
docker compose -f docker-compose.ec2-lite.yml --profile ai up -d
```

### B. 스왑(swap) 2GB 추가 (프리티어 필수 팁)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
```

재부팅 후에도 유지하려면 `/etc/fstab`에 아래 1줄 추가:

```bash
/swapfile none swap sw 0 0
```

### C. 메모리 절약 체크리스트

1. AI 컨테이너는 평소 꺼두고 필요할 때만 profile로 실행
2. Postgres 튜닝(`shared_buffers=64MB`) 적용
3. Spring Boot JVM 제한 (`JAVA_TOOL_OPTIONS`) 적용
4. 필요 없는 컨테이너/로그 정리

```bash
docker ps
docker stats
docker system prune -af
```

### D. 그래도 부족하면 현실적인 선택지

- DB를 RDS로 분리해서 EC2에는 backend만 실행
- AI는 별도 인스턴스/서비스로 분리
- 인스턴스를 t3.small 이상으로 상향 (운영 시 가장 안정적)

