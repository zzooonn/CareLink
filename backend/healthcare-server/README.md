# 📂 CareLink Backend: Healthcare Server

> **Spring Boot 기반의 의료 데이터 및 사용자 관리 엔진**

CareLink 프로젝트의 중추 역할을 하며 모바일 앱의 요청을 처리하고, AI 추론 서버와 통신하여 사용자에게 건강 인사이트를 제공합니다.

---

## 🛠 1. Tech Stack

* **Framework**: Spring Boot 3.x
* **Language**: Java 17
* **Security**: Spring Security & JWT (Json Web Token)
* **Data**: Spring Data JPA, PostgreSQL
* **Build Tool**: Gradle

---

## 🏛 2. Architecture & Service Flow

백엔드는 크게 3가지 레이어로 구성되어 데이터의 정합성과 확장성을 보장합니다.

1. **Auth Layer**: JWT 기반의 보안 인증 및 회원가입 처리.
2. **Domain Layer**: 심박수, ECG 진단 결과, 복약 정보 등 의료 도메인 로직 처리.
3. **Integration Layer**: FastAPI 서버(AI)로 ECG 데이터를 전송하고 분석 결과를 수신하는 REST Client.

---

## 🔐 3. Core Features

* **🔐 보안 및 인증**: JWT를 이용한 Stateless 인증 시스템으로 모바일 앱과의 보안 통신 강화.
* **🩺 비탈 데이터 관리**: 사용자의 혈압, 혈당 등 기본 생체 지표 저장 및 조회 API.
* **🤝 보호자 연결 시스템**: 환자와 보호자를 매핑하여 실시간 알림 및 상태 공유 기능 제공.
* **🤖 AI 서버 연동**: AI 서버에서 분석된 ECG 멀티라벨 데이터를 가공하여 위험도(Risk Level) 및 인사이트 생성.
* **📢 알림 서비스**: 건강 이상 징후 발생 시 푸시 알림 트리거 로직.

---

## 🔗 4. API Endpoints (Core)

| Category | Endpoint | Method | Description |
| --- | --- | --- | --- |
| **Auth** | `/api/auth/login` | `POST` | 사용자 로그인 및 토큰 발급 |
| **Vitals** | `/api/vitals/summary` | `GET` | 최근 생체 지표 요약 정보 |
| **ECG** | `/api/vitals/insights` | `POST` | AI 서버 연동 결과 조회 |
| **Guardian** | `/api/guardian/connect` | `POST` | 보호자-환자 계정 연결 |
| **News** | `/api/news` | `GET` | 맞춤형 건강 정보 피드 |

---

## ⚙️ 5. Getting Started

### Prerequisites

* JDK 17+
* PostgreSQL 14+

### Environment Settings (`application.properties`)

실행 전 `src/main/resources/application.properties` 파일에 다음 설정을 완료해야 합니다.

```properties
# Database
spring.datasource.url=jdbc:postgresql://localhost:5432/carelink
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}

# JWT
jwt.secret=${JWT_SECRET_KEY}

# External AI Server
ai.server.url=http://huggingface-spaces-ip:8000

```

### Run

```bash
./gradlew clean bootRun
```

---

## 📊 6. ERD (Database Schema)

백엔드 데이터 구조는 확장성을 위해 정규화되어 있으며, 주요 엔티티는 다음과 같습니다.

* **User**: 계정 정보 및 개인 설정
* **VitalSign**: ECG, 혈압 등 시계열 건강 데이터
* **GuardianRelation**: 보호자-피보호자 매핑 테이블
* **Medication**: 복약 스케줄 및 기록

---

## 💡 개발 시 주의사항

* **보안**: `application.properties`의 민감한 정보는 절대 깃허브에 직접 커밋하지 마세요. (환경 변수 활용 권장)
* **예외 처리**: AI 서버와의 통신 중 발생할 수 있는 타임아웃이나 에러에 대해 `GlobalExceptionHandler`를 통해 대응하고 있습니다.
* **트랜잭션**: 의료 데이터의 중요성을 고려하여 데이터 생성/수정 로직에는 반드시 `@Transactional`을 적용합니다.

---
