# 📱 CareLink Frontend: Mobile App

> **React Native & Expo 기반의 사용자 헬스케어 대시보드**

CareLink 모바일 앱은 사용자의 실시간 생체 데이터를 시각화하고, 복약 알림 및 보호자 긴급 연락 기능을 제공하는 통합 헬스케어 인터페이스입니다.

---

## 🛠 1. Tech Stack

* **Framework**:
* **Language**:
* **Navigation**: Expo Router (File-based Routing)
* **Storage**: AsyncStorage (사용자 세션 및 로컬 설정)
* **HTTP Client**: Axios

---

## ✨ 2. 주요 기능 (Main Features)

* **📊 ECG 실시간 모니터링**: 백엔드와 연동하여 AI가 분석한 ECG 파형과 진단 결과(5개 클래스)를 그래프로 시각화.
* **🔔 복약 및 건강 알림**: 푸시 알림을 통해 정해진 시간에 복약 여부를 확인하고 건강 습관 가이드 제공.
* **👨‍👩‍👧‍👦 보호자 모드**: 보호자 계정과 연결하여 위험 징후(High Risk) 발생 시 실시간 상태 공유.
* **📈 건강 인사이트**: 주간/월간 비탈 데이터(혈압, 혈당 등) 통계 리포트 제공.

---

## 📂 3. 프로젝트 구조 (Directory)

```text
carelink-app/
├─ app/                     # Expo Router 기반 페이지 (Home, Login, ECG, Profile)
├─ components/              # 재사용 가능한 UI 컴포넌트 (Charts, Modals, Buttons)
├─ constants/               # API URL, 컬러 시스템, 텍스트 스타일
├─ hooks/                   # Custom Hooks (API 데이터 페칭, Auth 로직)
├─ services/                # Axios 기반 API 통신 모듈
├─ utils/                   # 날짜 포맷팅, 데이터 변환 유틸리티
└─ assets/                  # 이미지, 아이콘 및 폰트 파일

```

---

## ⚙️ 4. 시작 가이드 (Getting Started)

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 백엔드 서버 주소를 입력합니다.

```env
EXPO_PUBLIC_API_BASE_URL=http://your-backend-ip:8080

```

### 설치 및 실행

```bash
# 의존성 설치
npm install

# Expo 개발 서버 실행
npm run start

```

> **Tip**: 터미널에 나타나는 QR 코드를 **Expo Go** 앱(iOS/Android)으로 스캔하여 실기기에서 테스트할 수 있습니다.

---

## 🔗 5. 주요 API 연동 흐름

앱은 다음과 같은 순서로 데이터를 주고받습니다.

1. **인증**: 로그인 성공 시 서버에서 받은 `userId`와 `JWT Token`을 **AsyncStorage**에 보안 저장.
2. **데이터 요청**: 메인 화면 진입 시 사용자의 최근 Vital 데이터를 `GET /api/vitals/summary`로 호출.
3. **AI 분석**: 심전도 데이터 전송 후 `POST /api/vitals/insights`를 통해 분석 결과 수신 및 대시보드 업데이트.

---

## 🎨 6. 디자인 가이드

* **Main Color**: `#4A90E2` (신뢰감을 주는 블루 톤)
* **Alert Color**: `#D0021B` (위험 징후 강조)
* **Font**: Pretenard (가독성을 고려한 샌드세리프체)

---

## 💡 개발 시 주의사항

* **네트워크**: 로컬 개발 시 `localhost` 대신 실제 컴퓨터의 **IP 주소**를 사용해야 실제 기기(모바일)에서 백엔드에 접속이 가능합니다.
* **성능**: ECG 그래프와 같이 고주파 데이터를 렌더링할 때는 `React.memo`나 `useMemo`를 활용해 불필요한 리렌더링을 방지합니다.

---
