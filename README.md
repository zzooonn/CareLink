CareLink: 노인 건강 모니터링 및 AI 기반 심전도 진단 플랫폼 — 시스템 전체 기술 명세
1. 시스템 개요 및 아키텍처
CareLink는 환자(Patient)와 보호자(Guardian)를 연결하는 실시간 헬스케어 플랫폼으로, 세 개의 독립 서버로 구성된 3-Tier 마이크로서비스 아키텍처를 채택한다.


┌────────────────────────────────────────────────────────────────┐
│             React Native / Expo (Mobile Client)                │
│    iOS / Android — Expo Router + Context API + AsyncStorage    │
└────────────┬──────────────────────────────┬────────────────────┘
             │  REST (JWT)                  │  REST (JSON)
             ↓                              ↓
┌─────────────────────────┐    ┌──────────────────────────────┐
│  Spring Boot Backend    │    │  Python FastAPI AI Server    │
│  Java · PostgreSQL      │    │  PyTorch · CNN-CBAM-GRU      │
│  Port 8080              │    │  Port 8000 (HuggingFace)     │
└─────────────────────────┘    └──────────────────────────────┘
             │  JPA/Hibernate               │  PTB-XL Dataset
             ↓                              ↓
      PostgreSQL DB              best_model_multilabel.pth
2. 프론트엔드 — React Native / Expo
2.1 기술 스택
항목	사용 기술
프레임워크	React Native + Expo SDK
라우팅	Expo Router (파일 기반 라우팅)
상태 관리	React Context API + useState/useMemo/useCallback
로컬 저장	AsyncStorage
알림	expo-notifications (Daily Scheduled)
아이콘	@expo/vector-icons (Ionicons)
네트워킹	fetch API + authFetch 래퍼 (JWT 자동 첨부)
2.2 앱 전체 네비게이션 구조
앱은 Expo Router의 파일 기반 라우팅을 사용하며, 루트 레이아웃(_layout.tsx)에서 FontSizeProvider와 AuthProvider로 전체를 감싼다. 세션 만료 시 Toast 알림 후 자동으로 로그인 화면으로 리다이렉트한다.


RootLayout (_layout.tsx)
 └─ (tabs) 그룹
     ├─ index.tsx            — 웰컴 화면 (비로그인)
     ├─ auth/
     │   ├─ login.tsx        — 로그인
     │   ├─ signup.tsx       — 회원가입
     │   ├─ data-agreement   — GDPR 데이터 동의
     │   ├─ find-id          — 아이디 찾기
     │   ├─ forgot-password  — 비밀번호 찾기
     │   ├─ reset-password   — 비밀번호 재설정
     │   └─ Profile          — 프로필 조회/편집
     ├─ Home/
     │   ├─ HomePage         — 메인 대시보드
     │   ├─ Vitals           — 혈압/혈당 입력·분석
     │   ├─ Insights         — 시계열 건강 점수 차트
     │   ├─ Medication       — 약물 관리 + 알림
     │   ├─ Caregivers       — 보호자 관리
     │   ├─ Emergency        — 비상 연락 + SOS
     │   ├─ Notification     — 알림 센터
     │   ├─ News             — 맞춤형 질병 뉴스
     │   └─ ECGSimulatorScreen — AI 심전도 진단
     └─ setting/
         ├─ SettingsScreen   — 설정 허브
         └─ BrainTraining    — 인지기능 게임
2.3 인증 및 세션 관리
로그인 성공 시 서버에서 반환된 JWT 토큰과 userId를 AsyncStorage에 저장한다. 이후 모든 API 요청은 authFetch 유틸리티를 통해 Authorization: Bearer {token} 헤더를 자동으로 첨부한다. 서버가 401을 반환하면 AuthContext의 onSessionExpired 콜백이 호출되어 토큰을 삭제하고 웰컴 화면으로 이동한다.


// utils/api.ts — authFetch 핵심 로직
const token = await AsyncStorage.getItem("token");
const res = await fetch(API_BASE_URL + url, {
  headers: { "Authorization": `Bearer ${token}`, ... }
});
if (res.status === 401) onSessionExpired(); // 세션 만료 처리
비밀번호 검증 정책: /^(?=.*[A-Za-z])(?=.*\d).{8,}$/ — 영문자와 숫자 포함, 최소 8자.

2.4 주요 화면별 기능 상세
(1) 홈 대시보드 (HomePage.tsx)
useFocusEffect 훅으로 화면 포커스 시마다 데이터를 갱신한다. 캐시-우선(Cache-First) 전략을 적용하여 AsyncStorage에 저장된 프로필 정보를 즉시 렌더링한 후 백엔드에서 최신 데이터로 동기화한다.

캐루셀 카드 4종: Disease Trends(뉴스), Vitals Snapshot(생체지표), Brain Training(인지훈련), ECG Simulator(AI 진단)
건강 인사이트 메타 표시: 7일 종합 점수 구간별 조건부 메시지
≥80: "Amazing work!" (초록, happy 아이콘)
≥60: "Doing well. Stay consistent." (주황, thumbs-up)
≥40: "Irregular trends detected. Consider consulting your caregiver." (빨강, warning)
<40: "High risk. Alert your caregiver." (빨강, alert)
Family Connections: caregivers:list AsyncStorage에서 보호자 아바타 최대 3개 스택 표시
Insights 점수 가중치 계산 (클라이언트):


총점_i = glucose_i × 0.35 + bp_i × 0.35 + ecg_i × 0.30
주간 평균 = Σ총점_i / N
(2) 생체지표 입력 (Vitals.tsx)
혈압과 혈당 수치를 입력하면 클라이언트에서 즉시 분류 결과를 시각화하고 백엔드에 저장한다.

혈압 분류 기준:

상태	조건	색상
Hypotension	SYS < 90 또는 DIA < 60	파랑
Normal BP	SYS < 120 and DIA < 80	초록
Elevated BP	SYS 120–129 and DIA < 80	주황
Pre-hypertension	SYS 130–139 또는 DIA 80–89	주황
Hypertension	SYS ≥ 140 또는 DIA ≥ 90	빨강
혈당 분류 기준 (공복/식후 구분):

상태	공복(Fasting)	식후(Post-meal)
Hypoglycemia	< 70 mg/dL	< 70 mg/dL
Normal	70–99	70–139
Prediabetes	100–125	140–199
Suspected Diabetes	≥ 126	≥ 200
(3) 건강 인사이트 차트 (Insights.tsx)
기간 선택(7d/30d/365d)에 따라 백엔드에서 일별 점수 배열을 수신하고 막대 차트로 시각화한다. 혈당(노랑), 혈압(초록), ECG(보라) 3색으로 구분하며 Y축은 0–100으로 정규화된다.

(4) 약물 관리 (Medication.tsx)
약물 이름, 용량, 복용 시간을 등록하면 expo-notifications의 DAILY 트리거로 매일 알림을 스케줄링한다. 각 약물에 notificationId를 매핑하여 수정/삭제 시 기존 알림을 취소하고 재등록한다.


await Notifications.scheduleNotificationAsync({
  content: { title: "Medication", body: `Take ${name} (${dosage})` },
  trigger: { type: DAILY, hour: h, minute: m }
});
(5) AI 심전도 진단 (ECGSimulatorScreen.tsx)
세 가지 신호 소스를 지원하는 실시간 ECG 분석 화면이다.

소스	설명
SIM_CLEAN	클라이언트 생성 깨끗한 합성 ECG
SIM_NOISY	가우시안 노이즈 추가 합성 ECG
SERVER_SAMPLE	AI 서버에서 수신한 실제 PTB-XL 샘플 (6초마다 갱신)
클라이언트는 12리드 × 5000샘플 순환 버퍼(buf12Ref)를 유지하며, 2초마다 AI 서버의 /predict_window 엔드포인트에 추론 요청을 전송한다. 응답으로 수신한 5개 클래스 확률을 임계값과 비교하여 활성 라벨을 결정하고 위험 레벨 뱃지를 표시한다.

합성 ECG 생성 수식 (Lead II 기준):


beat(t) = 0.12·e^{-(t-0.18)²/0.0018}    // P파
         − 0.15·e^{-(t-0.38)²/0.000288}  // Q파
         + 1.00·e^{-(t-0.40)²/0.0002}    // R피크
         − 0.25·e^{-(t-0.43)²/0.000392}  // S파
         + 0.30·e^{-(t-0.68)²/0.005}     // T파
(6) 인지기능 게임 (BrainTraining.tsx)
4×6 카드 그리드(24장 = 12쌍)에서 짝 맞추기 게임을 수행한다. React Native의 Animated API를 사용하여 3D 뒤집기 효과(rotateY, perspective)를 구현하고, 게임 시작 시 70ms 간격 스태거 애니메이션으로 카드를 순차 공개한다.

점수 계산: score = max(0, 100 - moves). 완료 시 백엔드에 저장하고 최고 점수를 동기화한다.

(7) 보호자 관리 (Caregivers.tsx)
보호자 추가 시 상대방의 userId를 입력하면 GET /api/users/{cgUserId}로 실제 가입 여부를 확인("Verified: {userId}" 표시)한 후, POST /api/guardian/connect로 환자-보호자 연결을 등록한다. 보호자 목록은 AsyncStorage의 caregivers:list 키에 로컬 캐시로 관리된다.

2.5 전역 상태 관리
AuthContext: signOut() 함수와 세션 만료 콜백 제공. 로그아웃 시 AsyncStorage.multiRemove(["userId","token","profileImageId"]) 실행.

FontSizeContext: Small(×1.0) / Normal(×1.2) / Large(×1.4) 세 단계 폰트 배율을 전역 제공. 모든 텍스트는 ScaledText 컴포넌트를 통해 반응형으로 렌더링된다.

2.6 반응형 레이아웃 설계
Dimensions.get("window")로 화면 크기를 측정하여 모든 여백, 폰트, 버튼 크기를 비율로 계산한다. 노인 사용자를 고려해 최소 폰트 크기를 Math.max(base, screenW * ratio) 방식으로 보장한다.


const FS_H1 = W * 0.052;     // 헤더 텍스트 (~20px on 375px 기기)
const FS_BODY = W * 0.042;   // 본문 텍스트 (~16px)
const BTN_PV = Math.max(12, H * 0.016); // 버튼 패딩
3. 백엔드 — Spring Boot (Java)
3.1 기술 스택
항목	사용 기술
프레임워크	Spring Boot 3.x
ORM	Hibernate/JPA
데이터베이스	PostgreSQL
인증	JWT (HMAC-SHA, 24시간 만료)
암호화	BCryptPasswordEncoder
외부 API	NewsAPI.org, Hugging Face (AI 서버)
스케줄링	Spring @Scheduled (매일 09:00)
빌드	Gradle
3.2 보안 아키텍처
JWT 처리 흐름:

로그인 성공 → JwtProvider.generateToken(userId, role) → HMAC-SHA 서명 토큰 발급
모든 인증 필요 요청 → JwtAuthFilter → Authorization: Bearer 파싱 → 서명·만료 검증 → SecurityContext 등록
토큰 Claim: subject(userId), role(PATIENT/GUARDIAN), issuedAt, expiration
접근 제어 (AccessControlService):

메서드	허용 조건
ensureSelf(userId)	토큰의 userId == 요청 userId
ensureSelfOrLinkedGuardian(patientId)	본인 또는 UserGuardianLink로 연결된 보호자
ensureGuardianSelf(guardianId)	본인이면서 role == GUARDIAN
ensureSelfOrConnectionParticipant(patientId, guardianId)	해당 연결의 당사자(환자 또는 보호자)
CORS 설정: 모든 출처(*) 허용, 세션 비활성화(STATELESS), CSRF 비활성화.

3.3 데이터베이스 스키마
핵심 테이블 구조:


users                        user_health
─────────────────────────    ────────────────────────────
id (PK)                      id (PK)
userId (UK)                  user_id (FK → users, UK)
password (BCrypt)            avgBpSys, avgBpDia
name, gender, birthDate      avgGlucose
phone, address               lastBpSys, lastBpDia
role (PATIENT|GUARDIAN)
profileImageId (1–12)
bloodType, allergies
medicalConditions

user_health_records           user_guardian_link
──────────────────────────    ──────────────────────────
id (PK)                       id (PK)
user_id (FK)                  patient_id (FK → users)
bpSys, bpDia, glucose         guardian_id (FK → users)
bpAbnormal, glucoseAbnormal   UNIQUE(patient_id, guardian_id)
ecgRiskScore (0.0–1.0)
ecgAbnormal, ecgAnomalyType
overallAbnormal
anomalyType, anomalyReason
measuredAt
INDEX(user_id, measuredAt DESC)

user_medications              user_health_alerts
──────────────────────────    ──────────────────────────────
id (PK)                       id (PK)
user_id (FK)                  patient_id (FK → users)
name, dosage, memo            receiver_id (FK → users)
isActive (Soft Delete)        alertType (HEALTH_ANOMALY, etc.)
                              title, message (≤1000자)
user_medication_schedules     createdAt, readAt (nullable)
──────────────────────────
medication_id (FK)            disease_trend
timeOfDay (LocalTime)         ──────────────────────────────
daysOfWeek (EVERYDAY 등)      user_id (FK)
timezone                      diseaseName, diseaseCode
                              riskLevel, advisoryType (NEWS/VACCINE)
brain_training_games          sourceUrl, advisoryText
──────────────────────────    INDEX(user_id, advisoryType, id DESC)
user_id (FK)
score (Long)
createdAt
3.4 전체 API 엔드포인트 명세
인증 API (/api/auth) — 인증 불필요
메서드	URL	기능	Request Body	주요 응답
POST	/api/auth/login	로그인	{userId, password}	{success, token, userId}
POST	/api/auth/signup	회원가입	{userId, password, name, gender, birthDate, phone, address, role, profileImageId, guardianId?}	{success, userId} (201)
POST	/api/auth/find-id	아이디 찾기	{name, birthDate, phone}	{success, userId}
POST	/api/auth/forgot-password	비밀번호 재설정 요청	{userId, birthDate}	{success, resetToken}
POST	/api/auth/reset-password	비밀번호 변경	{userId, newPassword, resetToken}	{success}
비밀번호 재설정 토큰: UUID 방식, 기본 10분 만료(PASSWORD_RESET_TOKEN_EXPIRATION_MS=600000), 1회 사용 후 무효화.

사용자 API (/api/users) — JWT 필수
메서드	URL	기능	접근 제어
GET	/api/users/{userId}	프로필 조회	본인 또는 연결된 보호자
PUT	/api/users/{userId}	프로필 수정	본인만
수정 가능 필드: name, gender, birthDate, phone, address, profileImageId, bloodType, allergies, medicalConditions (null 필드 무시, Partial Update).

건강정보 API (/api/vitals) — JWT 필수
메서드	URL	기능
POST	/api/vitals	측정값 저장 + 이상 판정 + 알림 발송
GET	/api/vitals/summary?userId=	요약 (평균값, 최근값)
GET	/api/vitals/insights?userId=&range=	기간별 일별 점수 배열
측정값 저장 비즈니스 로직:


Request: {userId, bpSys, bpDia, glucose, isFasting, heartRate, ecgRiskScore, ecgAbnormal, ecgAnomalyType}

1. 이상 판정:
   bpAbnormal      = (sys≥140 or dia≥90) → HIGH_BP
                   = (sys<90 or dia<60)  → LOW_BP
   glucoseAbnormal = (glucose≥200) → HIGH_GLUCOSE
                   = (glucose≤70)  → LOW_GLUCOSE
   overallAbnormal = bpAbnormal OR glucoseAbnormal OR ecgAbnormal

2. 평균값 업데이트: UserHealth 테이블 (모든 기록 평균 재계산)

3. 이상 감지 시: NotificationService.sendEmergencyAlert()
   → 환자 본인 + 연결된 모든 보호자에게 UserHealthAlert 레코드 생성
Insights 점수 계산 (서버):

지표	이상적 값	점수 산식
혈당	110 mg/dL	`100 − min(100,
혈압	120/80 mmHg	100 − (sys_diff × 0.7 + dia_diff × 1.0)
ECG	riskScore=0	(1 − riskScore) × 100 (riskScore 없으면 abnormal=true → 20점)
약물 API (/api/medications/{userId}) — JWT 필수
메서드	URL	기능	접근 제어
GET	/{userId}	약물 목록 (isActive=true만)	본인/보호자
POST	/{userId}	약물 추가 + 스케줄 생성	본인만
PUT	/{userId}/{medId}	약물 수정 + 스케줄 재생성	본인만
DELETE	/{userId}/{medId}	Soft Delete (isActive=false)	본인만
freq 필드 제공 시 UserMedicationSchedule 자동 생성 (timeOfDay=HH:mm, daysOfWeek=EVERYDAY, timezone=Asia/Seoul).

보호자 API (/api/guardian) — JWT 필수
메서드	URL	기능
POST	/connect	환자-보호자 연결 (보호자 role 검증, 중복 409)
GET	/my-patients/{guardianId}	내 환자 목록 (보호자용)
GET	/my-guardians/{patientId}	내 보호자 목록 (환자용)
알림 API (/api/notification) — JWT 필수
메서드	URL	기능
POST	/send	긴급 알림 수동 발송
GET	/{userId}	알림 목록 (createdAt DESC)
PATCH	/{userId}/{alertId}/read	읽음 처리 (readAt 갱신)
뇌 트레이닝 API (/api/brain-training) — JWT 필수
메서드	URL	기능	응답
POST	/{userId}	점수 저장	{score, bestScore}
GET	/{userId}	점수 조회	{bestScore, recent[10]}
뉴스 API (/api/news) — JWT 필수
메서드	URL	기능
POST	/refresh?userId=	사용자 질병 기반 뉴스 즉시 갱신
GET	?userId=&limit=	최신 뉴스 목록 (default: 5개, max: 20개)
3.5 자동 스케줄러
뉴스 자동 수집 (매일 09:00):

전체 UserDisease 레코드 조회
사용자별로 그룹핑
각 사용자의 질병 코드를 키워드로 변환 (DM→diabetes, HTN→hypertension 등)
NewsAPI.org 호출 (/v2/everything?language=en&sortBy=publishedAt)
관련도 점수 계산 후 상위 5개 DiseaseTrend 레코드로 저장
질병 트렌드 알림 (매일 09:00):

riskLevel="HIGH" 인 DiseaseTrend 조회
targetGroup 필터로 대상 환자 선정
환자 + 보호자에게 alertType=DISEASE_TREND 알림 발송
4. AI 서버 — Python FastAPI + PyTorch
4.1 기술 스택
항목	사용 기술
서버 프레임워크	FastAPI 0.115.5 + Uvicorn
딥러닝	PyTorch 2.5.1
신호 처리	NumPy 2.1.3, SciPy 1.14.1
데이터 처리	WFDB (PhysioNet 포맷), scikit-learn
배포	Hugging Face Spaces (https://zoon1-carelink-ai.hf.space)
학습 데이터	PTB-XL (약 21,837건, 500Hz, 12-리드, 10초)
4.2 데이터셋 및 전처리 파이프라인
PTB-XL 데이터셋 구성:

수집: wfdb.rdsamp() 로 WFDB 포맷 로드
형상: (T, 12) → 세그먼트화 후 (N, 5000, 12)
품질 검증: NaN/Inf 제거, 7개 이상 리드에서 std < 0.05mV인 평탄선 제거
5-클래스 멀티라벨 체계:

클래스	인덱스	임상 의미
NORM	0	정상 심전도
STTC	1	ST분절 변화 (ST-segment/T-wave changes)
MI	2	심근경색 (Myocardial Infarction)
CD	3	전도 이상 (Conduction Disturbance)
HYP	4	심실비대 (Hypertrophy)
라벨 생성 규칙: SCP 코드 중 diagnostic=1이고 신뢰도 ≥50인 코드만 사용. 각 클래스는 독립 이진 라벨 {0,1} → 최종 레이블 벡터 y ∈ {0,1}^5.

데이터 분할: StratifiedGroupKFold(n_splits=8), 환자 단위 그룹화로 동일 환자의 데이터가 Train/Val/Test에 분산되지 않도록 보장. 비율: 약 75% / 12.5% / 12.5%.

4.3 신호 전처리
1단계 — 밴드패스 필터링 (Butterworth 2차):

통과대역: 0.5 Hz ~ 45.0 Hz
목적: 60Hz 전원잡음(power-line noise) 및 베이스라인 변동(baseline wander) 제거
적용: scipy.signal.filtfilt() (양방향, 위상 왜곡 없음)
$$b, a = \text{butter}(2,\ [0.5/250,\ 45.0/250],\ \text{btype}=\text{band})$$

2단계 — Z-score 정규화 (리드별):
$$\hat{x}{l,t} = \frac{x{l,t} - \mu_l}{\sigma_l + \epsilon}, \quad \epsilon = 10^{-6}$$

3단계 — 리샘플링 (필요시): 500Hz가 아닌 입력은 resample_poly(x, up, down, axis=1)로 변환.

4단계 — 진폭 특성 추출 (Amplitude Features, 36차원):
12개 리드 각각에 대해 Peak-to-Peak(PTP), 표준편차(STD), 실효값(RMS)을 계산하여 수공학 특성 벡터 amp ∈ ℝ^{36}을 구성한다.


ptp = x.max(axis=1) − x.min(axis=1)          # (12,)
std = x.std(axis=1)                           # (12,)
rms = √(mean(x², axis=1) + 1e-8)             # (12,)
amp = concat([ptp, std, rms])                 # (36,)
4.4 딥러닝 모델: CNN-CBAM-GRU
본 시스템의 핵심 모델은 1D CNN(특성 추출), CBAM 주의 메커니즘(채널·공간 가중치), 양방향 GRU(시간 의존성 모델링)를 통합한 하이브리드 아키텍처이다.

전체 순전파 흐름:


입력 x: (B, 12, 5000)   amp: (B, 36)

[Stage 1: CNN 특성 추출]
ConvBlock1: Conv1d(12→32, k=3) → BN → ReLU → MaxPool(2) → CBAM
  출력: (B, 32, 2500)
ConvBlock2: Conv1d(32→32, k=3) → BN → ReLU → MaxPool(2) → CBAM
  출력: (B, 32, 1250)

[Stage 2: 시간 모델링]
Permute: (B, 32, 1250) → (B, 1250, 32)
GRU(bidirectional, 2-layer, hidden=64, dropout=0.5):
  출력: (B, 1250, 128)
Global Mean Pool (time axis):
  출력: (B, 128)

[Stage 3: 분류 헤드]
Concat([GRU_out(128), amp(36)]): (B, 164)
FC(164→128) → ReLU → Dropout(0.5) → FC(128→5)
  출력: (B, 5) logits
파라미터 규모: ~567K (학습된 모델 파일 best_model_multilabel.pth: 567KB)

CBAM (Convolutional Block Attention Module) 수식:

채널 주의:
$$\text{CA}(F) = \sigma!\left(FC!\left(\text{AvgPool}(F)\right) + FC!\left(\text{MaxPool}(F)\right)\right)$$

공간 주의:
$$\text{SA}(F) = \sigma!\left(\text{Conv}_{7}!\left[\text{AvgPool}_C(F);\ \text{MaxPool}_C(F)\right]\right)$$

CBAM 통합:
$$\text{CBAM}(F) = F \odot \text{SA}(F \odot \text{CA}(F))$$

GRU 수식:

$$r_t = \sigma(W_{ir}x_t + W_{hr}h_{t-1})$$
$$z_t = \sigma(W_{iz}x_t + W_{hz}h_{t-1})$$
$$\tilde{h}t = \tanh(W{ih}x_t + r_t \odot W_{hh}h_{t-1})$$
$$h_t = (1 - z_t) \odot \tilde{h}t + z_t \odot h{t-1}$$

4.5 학습 설정
항목	값
손실 함수	BCEWithLogitsLoss (pos_weight 적용, clamp [1.0, 3.0])
최적화	Adam (lr=3×10⁻⁴, weight_decay=10⁻⁴)
LR 스케줄러	ReduceLROnPlateau (mode=max, factor=0.1, patience=10)
배치 크기	64
최대 에폭	200 (Early Stopping patience=30)
Gradient Clipping	1.0
혼합 정밀도	AMP (torch.amp.autocast, GradScaler)
클래스 불균형 처리:
$$\text{pos_weight}c = \text{clamp}!\left(\frac{N{neg,c}}{N_{pos,c}+\epsilon},\ 1.0,\ 3.0\right)$$

데이터 증강 (학습 데이터만):

스케일링: ×[0.95, 1.05] 균등 랜덤
시간 시프트: ±10 샘플
가우시안 노이즈: σ=0.01
4.6 임계값 최적화 (Per-class Threshold Tuning)
각 클래스의 최적 분류 임계값을 검증 세트에서 독립적으로 탐색한다.


for c in range(5):
    for t in linspace(0.05, 0.95, 19):
        pred = (y_prob[:, c] >= t).astype(int)
        f1 = f1_score(y_true[:, c], pred)
        # best_t[c] = argmax F1
적용된 기본 임계값: [0.60, 0.45, 0.50, 0.60, 0.70] (NORM, STTC, MI, CD, HYP 순)

4.7 REST API 엔드포인트
서버 기반 URL: https://zoon1-carelink-ai.hf.space

메서드	URL	기능
GET	/health	서버 상태 및 모델 로드 여부 확인
GET	/sample_window?label={LABEL}	클래스별 PTB-XL 샘플 반환
POST	/predict_window	ECG 신호 → 5-클래스 확률 추론
/predict_window 요청/응답:


// 요청
{
  "x": [[리드1_t0, ..., 리드1_t4999], ..., [리드12_t0, ..., 리드12_t4999]],
  "fs": 500
}

// 응답
{
  "probs": [0.95, 0.12, 0.78, 0.23, 0.89],
  "thresholds": [0.6, 0.45, 0.5, 0.6, 0.7],
  "active_labels": ["NORM", "MI", "HYP"],
  "risk_level": "high",
  "top_label": "NORM",
  "top_confidence": 0.95
}
위험도 판정 로직:


abnormal = max(probs[STTC], probs[MI], probs[CD], probs[HYP])
if abnormal >= 0.8: return "high"
elif abnormal >= 0.6: return "medium"
else: return "low"
5. 세 서버 간 통합 데이터 흐름
5.1 ECG 진단 통합 시나리오

[프론트엔드 ECGSimulatorScreen]
  1. 2초마다 buf12Ref (12×5000) 배열 준비
     (합성 신호 또는 AI 서버에서 수신한 샘플)

  2. POST https://ai-server/predict_window
     body: {x: [[...×5000]×12], fs: 500}

  3. AI 서버 내부:
     a. bandpass 필터 (0.5-45Hz)
     b. amp 특성 추출 (36차원)
     c. Z-score 정규화
     d. CNN-CBAM-GRU 추론
     e. sigmoid → probs (5차원)
     f. 임계값 비교 → active_labels
     g. risk_level 판정

  4. 응답 수신 → 클라이언트 뱃지 업데이트
     (NORMAL/STTC/MI/CD/HYP + low/medium/high)

  5. 이상 감지 시:
     POST https://backend/api/vitals
     body: {ecgRiskScore, ecgAbnormal, ecgAnomalyType, ...}

  6. 백엔드 → NotificationService.sendEmergencyAlert()
     → 환자 + 보호자 UserHealthAlert 레코드 생성
5.2 건강 측정 → 알림 전파 시나리오

[Vitals 화면] 혈압/혈당 입력
  ↓
POST /api/vitals
  ↓
[UserHealthService.saveHealthRecord()]
  ├─ 이상 판정: HIGH_BP / LOW_GLUCOSE / ECG_ABNORMAL 등
  ├─ UserHealthRecord 저장
  ├─ UserHealth 평균 갱신
  └─ overallAbnormal == true 시
       → NotificationService.sendEmergencyAlert()
           → 환자 UserHealthAlert 생성
           → 연결된 모든 보호자 UserHealthAlert 생성
  ↓
[보호자 앱] GET /api/notification/{guardianId}
  → 알림 목록 수신 → 환자 상태 확인
5.3 뉴스 수집 → 맞춤 피드 시나리오

[매일 09:00 스케줄러]
  ↓
NewsAutoCollectorScheduler.run()
  ↓
각 사용자의 UserDisease (질병 코드) 조회
  ↓
NewsAPI.org 검색 (질병 키워드별)
  ↓
관련도 점수 계산 → 상위 5개 DiseaseTrend 저장
  ↓
[프론트엔드 News 화면] GET /api/news?userId=&limit=5
  → 질병별 맞춤 뉴스 카드 표시 → Linking.openURL
6. 성능 및 기술적 특성 요약
항목	상세
모바일 반응성	Cache-First 전략으로 네트워크 지연 없이 즉시 렌더링
오프라인 대응	AsyncStorage 캐시로 보호자 목록·프로필 오프라인 표시 가능
ECG 실시간 처리	2초 주기 추론, 12리드 5000샘플 전처리 포함 end-to-end
AI 모델 경량화	CNN-CBAM-GRU: ~567K 파라미터 (ResNet1D 대비 약 63배 경량)
데이터 보안	JWT 24시간 만료, BCrypt 비밀번호 해시, GDPR 동의 화면
알림 자동화	측정값 이상 감지 즉시 + 질병 트렌드 매일 09:00 자동 발송
접근성	3단계 폰트 배율(Small/Normal/Large), 노인 최소 폰트 보장
인지 훈련	카드 뒤집기 게임, 점수 백엔드 저장·최고 점수 추적
뉴스 개인화	사용자 등록 질병 코드 기반 NewsAPI 자동 수집·필터링
논문 작성 시에는 각 섹션(프론트엔드 아키텍처, 백엔드 API 설계, AI 모델 구조, 시스템 통합)을 독립된 절로 구성하고, 위의 수식들(GRU 게이트 방정식, CBAM 주의 메커니즘, Insights 점수 산식)을 LaTeX로 변환하여 인용하면 됩니다.