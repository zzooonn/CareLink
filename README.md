# 🏥 CareLink: AI-Powered Mobile Healthcare

> **통합 모바일 헬스케어 솔루션** > `React Native` + `Spring Boot` + `FastAPI` 기반의 실시간 ECG 진단 및 건강 관리 플랫폼


## 🚀 1. 프로젝트 개요 (Overview)

CareLink는 단순한 건강 기록 앱을 넘어, **딥러닝 기반의 ECG(심전도) 분석** 기능을 갖춘 통합 헬스케어 시스템입니다.

* **🎯 핵심 목표**: 사용자 건강 데이터 관리, 복약 알림, 보호자 연결 및 AI 기반 심전도 이상 징후 감지.
* **🩺 AI 진단**: 12-lead ECG 데이터를 분석하여 5가지 주요 진단 계열(`NORM`, `STTC`, `MI`, `CD`, `HYP`)을 멀티라벨로 예측.
* **📱 사용자 경험**: 예측 확률과 임계값을 바탕으로 실시간 위험도(`Risk Level`)를 산출하여 직관적인 UI 제공.


## 🛠 2. 기술 스택 (Tech Stack)

| 구분 | 기술 환경 |
| --- | --- |
| **Frontend** |  |
| **Backend** |  |
| **AI Server** |  |
| **Pipeline** | PTB-XL Dataset, Band-pass Filtering, Z-score Normalization |



## 🧠 3. 핵심 경쟁력: CNN–CBAM–GRU 모델

CareLink의 핵심은 단순한 수치 비교가 아닌, **국소 패턴 + 주의 집중 + 시계열 문맥 + 수치 특징**을 모두 결합한 하이브리드 아키텍처입니다.

### ✅ 아키텍처 설계 포인트

1. **Conv1D + BN + ReLU**: 리드별 국소 형태학적 특징(QRS morphology) 추출.
2. **CBAM (Attention Mechanism)**: 중요한 채널(Lead)과 시간대에 가중치를 부여해 노이즈 억제.
3. **BiGRU (Bidirectional)**: 심장 박동 간의 전후 문맥 정보를 반영하여 정밀도 향상.
4. **Feature Injection**: 딥러닝 특징 외에 36차원의 통계 데이터(`PTP`, `STD`, `RMS`)를 결합(Concat)하여 모델의 안정성 확보.
5. **Multi-label Head**: 실제 환자에게 동시에 나타날 수 있는 복합 이상 증상을 정밀하게 포착.


## 📂 4. 레포지토리 구조 (Project Structure)

```text
CareLink/
├─ 📱 frontend/carelink-app/        # React Native 모바일 앱
├─ ⚙️ backend/healthcare-server/    # Spring Boot API 서버
├─ 🤖 ai/
│  ├─ 🛠️ src/
│  │  ├─ step1_loader.py            # PTB-XL 데이터 로딩
│  │  ├─ step2_preprocess.py        # 5클래스 멀티라벨 전처리
│  │  ├─ train_local.py             # CNN-CBAM-GRU 학습 스크립트
│  │  └─ server.py                  # FastAPI 추론 서버 (Inference)
│  ├─ 💾 models/                    # 학습된 .pth 모델 저장소
│  └─ 📊 data/                      # 처리된 데이터셋 (npy/csv)
└─ README.md

```

---

## 🔄 5. 시스템 워크플로우 (Data Flow)

1. **데이터 입력**: 사용자의 12리드 ECG 신호 입력 (500Hz, 10초).
2. **전처리**: Band-pass Filter 적용 및 Amplitude Feature(36-dim) 추출.
3. **추론**: AI 서버에서 확률값(`probs`) 및 임계값(`thresholds`) 기반 라벨링 수행.
4. **결과 제공**: 백엔드를 거쳐 앱에서 `Risk Level` (Low/Medium/High) 시각화.

---

## 🛠️ 6. 빠른 시작 가이드 (Quick Start)

### 1️⃣ AI Inference Server

```bash
cd ai/src
python server.py  # Port: 8000

```

### 2️⃣ Backend Server

```bash
cd backend/healthcare-server
./gradlew bootRun  # Port: 8080

```

### 3️⃣ Frontend App

```bash
cd frontend/carelink-app
npm install && npm run start

```

---

## 🌟 7. 향후 고도화 계획 (Future Roadmap)

* **시각화 강화**: CBAM Attention Map을 활용한 심전도 내 주요 이상 부위 히트맵 제공.
* **신뢰성 지표**: Uncertainty Estimation(MC Dropout) 도입으로 진단의 신뢰도 수치화.
* **MLOps**: 모델 성능 모니터링 및 신규 데이터 자동 수집/재학습 파이프라인 구축.

---

> **⚠️ 주의사항**: 본 프로젝트의 AI 모델 출력은 **자가 건강 관리 보조 도구**이며, 최종 진단은 반드시 전문 의료진의 판단을 따라야 합니다.

---

