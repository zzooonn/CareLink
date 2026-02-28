# 🧠 CareLink AI: ECG Analytics Engine

> **CNN–CBAM–GRU 하이브리드 모델 기반 멀티라벨 심전도 분석 서버**

CareLink AI는 12-lead 심전도 신호를 분석하여 5가지 주요 심장 질환 계열을 진단하는 고성능 추론 엔진입니다.

---

## 🔬 1. Model Architecture

단순한 특징 추출을 넘어, 시간적 문맥과 채널 간 상관관계를 모두 고려한 하이브리드 구조를 채택했습니다.

### 🛰️ Key Components

1. **Spatial-Temporal Encoder (CNN + CBAM)**:
* **Conv1D Blocks**: 리드별 국소 형태 특징 추출.
* **CBAM (Convolutional Block Attention Module)**: 전처리된 신호 중 진단에 유의미한 채널(Lead)과 시간 구간에 집중(Attention)하여 노이즈 내성을 강화합니다.


2. **Sequential Context (BiGRU)**:
* 양방향 GRU를 통해 심박의 주기적 패턴과 부정맥 등 장기 의존성(Long-term dependency)을 학습합니다.


3. **Domain Knowledge Fusion (Amplitude Injection)**:
* 딥러닝이 놓칠 수 있는 수치적 통계(`PTP`, `RMS`, `STD`) 36가지를 직접 결합(Concatenation)하여 진단 정확도를 보강합니다.



---

## 📊 2. Data Pipeline (PTB-XL)

세계적인 심전도 데이터셋인 **PTB-XL**을 활용하여 실제 임상 환경과 유사한 학습 환경을 구축했습니다.

* **Dataset**: PTB-XL (12-lead, 500Hz, 21,837 records)
* **Preprocessing**:
* Band-pass Filter (0.5Hz ~ 45Hz) 적용
* Z-score 정규화 및 10초 세그먼트 추출


* **Labeling**: 멀티라벨 분류를 위한 5대 Superclass(`NORM`, `STTC`, `MI`, `CD`, `HYP`) 매핑

---

## ⚡ 3. Inference API (FastAPI)

학습된 모델을 실시간 서비스에 적용하기 위해 가벼운 **FastAPI** 서버를 구축했습니다.

### 주요 엔드포인트

* `POST /predict_window`: 10초 분량의 ECG 데이터를 받아 진단 결과 반환.
* `GET /sample_window`: 테스트 및 데모를 위한 특정 질환 샘플 데이터 로드.

### Response Example

```json
{
  "active_labels": ["MI", "STTC"],
  "risk_level": "High",
  "top_confidence": 0.89,
  "thresholds": {"MI": 0.5, "STTC": 0.45, ...}
}

```

---

## 📈 4. Performance Strategy

모델의 실효성을 높이기 위해 다음과 같은 최적화 기법을 적용했습니다.

* **Dynamic Thresholding**: 고정된 0.5 임계값이 아닌, 각 클래스별 최적의 F1-score를 내는 임계값을 탐색하여 적용.
* **Class Imbalance Handling**: 데이터 불균형 해소를 위해 `pos_weight`를 적용한 BCE Loss 사용.
* **Early Stopping**: Validation loss 기준 최적 시점에서 학습을 종료하여 일반화 성능 극대화.

---

## ⚙️ 5. How to Run

### 🛠 Environment

* Python 3.9+
* PyTorch 2.0+
* FastAPI & Uvicorn

### 🏃 Execution

```bash
# 의존성 설치
pip install -r requirements.txt

# 데이터 전처리
python src/step1_loader.py
python src/step2_preprocess.py

# 서버 실행
cd src
uvicorn server:app --host 0.0.0.0 --port 8000

```

---

## 🔮 6. Future Roadmap

* **Grad-CAM 시각화**: 모델이 심전도의 어느 부분을 보고 진단했는지 히트맵으로 제공.
* **Quantization**: 모바일 온디바이스 추론을 위한 모델 경량화(FP16/INT8).
* **Multi-modal Expansion**: 사용자 활동 데이터(Step count, Sleep heart rate)와 결합한 복합 위험도 산출.

---

### 💡 안내사항

이 AI 서버는 **진단 보조 도구**입니다. 모든 AI 분석 결과는 최종적으로 전문 의료진의 확인이 필요합니다.

---
