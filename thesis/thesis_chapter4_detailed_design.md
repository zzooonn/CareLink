# 第4章 详细设计与实现

## 4.1 移动端设计与实现

### 4.1.1 应用整体架构与导航

移动端采用Expo Router 6.0.23实现基于文件系统的声明式路由管理。应用的路由结构如图4.1所示：

```
app/
├── _layout.tsx              ← 根布局：全局初始化 + FontSizeProvider + AuthProvider
└── (tabs)/
    ├── _layout.tsx          ← Tab导航配置：主页/个人/设置
    ├── index.tsx            ← 欢迎/启动页（跳过Tab）
    ├── Home/
    │   ├── HomePage.tsx     ← 首页仪表盘（健康概览）
    │   ├── Vitals.tsx       ← 生命体征记录
    │   ├── ECGSimulatorScreen.tsx  ← ECG分析
    │   ├── Insights.tsx     ← 健康趋势分析
    │   ├── Medication.tsx   ← 药物管理
    │   ├── Caregivers.tsx   ← 照护者管理
    │   ├── Emergency.tsx    ← 紧急联系人
    │   └── Notification.tsx ← 通知中心
    ├── auth/
    │   ├── login.tsx        ← 登录页
    │   ├── signup.tsx       ← 注册页
    │   └── Profile.tsx      ← 个人资料管理
    └── setting/
        ├── SettingsScreen.tsx  ← 设置页（字体大小）
        └── BrainTraining.tsx   ← 认知训练游戏
```

**图4.1 移动端路由结构图**

应用根布局（`_layout.tsx`）在启动时执行全局初始化：加载AsyncStorage中缓存的Token与用户信息，检查Token有效性，决定路由至登录页或主应用页面。

### 4.1.2 全局状态管理

移动端采用React Context API管理两类全局状态，避免了引入Redux等重量级状态管理库的必要：

**（1）身份认证上下文（AuthContext）**

AuthContext维护用户的认证状态，包括userId、accessToken、refreshToken、userName及profileImageId五个关键字段。其核心业务逻辑如下：

- **登录：** 调用`POST /api/auth/login`获取Token，存入AsyncStorage持久化；
- **注销：** 清除AsyncStorage中的认证数据，跳转至登录页；
- **Token刷新：** 通过统一的API工具函数（`utils/api.ts`）拦截HTTP 401响应，自动使用refreshToken调用`POST /api/auth/refresh`获取新Token，对原请求无感重试；
- **会话过期：** refreshToken失效时，显示Toast提示并强制跳转登录页。

**（2）字体缩放上下文（FontSizeContext）**

FontSizeContext管理全局字体倍率设置，提供`scale`数值（0.85/1.0/1.2）与`setFontScale`更新函数。设置值持久化至AsyncStorage，应用重启后自动恢复。全局封装的ScaledText组件通过消费FontSizeContext，确保所有文字元素自动适配用户选择的字体大小。

### 4.1.3 ECG可视化模块

ECG分析页面（ECGSimulatorScreen）是本系统技术实现难度最高的前端模块，核心流程如下：

**（1）ECG数据生成**

系统在前端模拟生成12导联ECG数据：每条导联以正弦基波叠加QRS复合波模板的方式生成1000个采样点的时域信号，支持"正常"与"带噪声"两种模式。生成的数据以`number[][]`格式（12×1000）组织，通过API提交至后端进行AI分析。

**（2）波形SVG渲染**

12条导联波形分别通过`react-native-svg`的`Polyline`组件渲染。波形坐标计算逻辑如下：对每条导联的原始数值序列进行Min-Max归一化至SVG画布高度范围，以采样点序号映射至X轴，归一化值映射至Y轴，生成SVG折线点串（`points`属性）。每条导联配置独立的SVG视图，12条视图纵向排列，支持滚动查看。

**（3）分析结果展示**

AI分析结果包含五类标签的概率值（`probs: [norm, sttc, mi, cd, hyp]`）、激活标签列表（`active_labels`）与综合风险等级（`risk_level: low/medium/high`）。界面以颜色编码的方式展示风险等级（绿色/橙色/红色），逐类展示概率值与是否激活，并给出相应的临床建议提示。

### 4.1.4 健康趋势分析模块

健康趋势分析页面（Insights）通过以下综合评分算法将多维健康指标整合为单一评分：

```
综合健康评分 = 血糖分项得分 × 0.35 + 血压分项得分 × 0.35 + ECG分项得分 × 0.30
```

各分项得分根据临床标准计算（满分100分），例如血压得分：
- 正常（SBP 90~129, DBP 60~84）：100分
- 偏高（SBP 130~139, DBP 85~89）：75分
- 高血压Ⅰ级（SBP 140~159, DBP 90~99）：50分
- 高血压Ⅱ级及以上或低血压：25分

趋势图采用SVG折线图渲染，支持7天/30天/365天三个时间周期的数据聚合展示。

---

## 4.2 后端服务设计与实现

### 4.2.1 RESTful API层设计

后端服务共实现10个业务控制器，提供约31个RESTful API接口，主要接口规范如表4.1所示。

**表4.1 后端主要API接口列表**

| 模块 | 方法 | 路径 | 功能描述 |
|:---|:---|:---|:---|
| 认证 | POST | /api/auth/login | 用户登录，返回JWT |
| 认证 | POST | /api/auth/signup | 用户注册 |
| 认证 | POST | /api/auth/refresh | Token刷新 |
| 认证 | POST | /api/auth/forgot-password | 密码找回验证 |
| 认证 | POST | /api/auth/reset-password | 密码重置 |
| 认证 | POST | /api/auth/find-id | 通过邮箱查找用户ID |
| 用户 | GET | /api/users/{userId} | 获取用户信息 |
| 用户 | PUT | /api/users/{userId} | 更新用户信息 |
| 用户 | GET | /api/users/{userId}/health-info | 获取用户健康基本信息 |
| 用户 | PUT | /api/users/{userId}/health-info | 更新用户健康基本信息 |
| 体征 | POST | /api/vitals | 提交生命体征 |
| 体征 | GET | /api/vitals/summary | 获取健康汇总 |
| 体征 | GET | /api/vitals/insights | 获取健康趋势 |
| ECG | POST | /api/ecg/predict_window | 提交ECG进行AI分析 |
| ECG | GET | /api/ecg/sample_window | 获取样本ECG |
| 药物 | GET | /api/medications/{userId} | 获取药物列表 |
| 药物 | POST | /api/medications/{userId} | 添加药物 |
| 药物 | PUT | /api/medications/{userId}/{medId} | 更新药物 |
| 药物 | DELETE | /api/medications/{userId}/{medId} | 删除药物 |
| 照护者 | POST | /api/guardian/connect | 绑定照护者 |
| 照护者 | DELETE | /api/guardian/disconnect | 解除照护者绑定 |
| 照护者 | GET | /api/guardian/my-guardians/{patientId} | 获取照护者列表 |
| 照护者 | GET | /api/guardian/my-patients/{guardianId} | 获取患者列表 |
| 通知 | GET | /api/notification/{userId} | 获取通知列表 |
| 通知 | PATCH | /api/notification/{userId}/{alertId}/read | 标记通知已读 |
| 疾病资讯 | GET | /api/news | 获取疾病趋势新闻列表 |
| 疾病资讯 | POST | /api/news | 手动触发新闻采集 |
| 认知训练 | POST | /api/brain-training/{userId} | 提交认知训练游戏得分 |
| 认知训练 | GET | /api/brain-training/{userId} | 获取训练历史记录 |
| 疾病诊断 | GET | /api/user-disease/{userId} | 获取用户诊断病历列表 |
| 疾病诊断 | POST | /api/user-disease/{userId} | 添加ICD诊断记录 |

### 4.2.2 JWT认证与授权机制

后端认证机制基于Spring Security + JWT实现，核心流程如图4.2所示：

```
客户端请求
    │
    ▼
JwtAuthFilter（OncePerRequestFilter）
    ├─ 提取Authorization: Bearer <token>
    ├─ 调用JwtProvider.validateToken(token)
    │   ├─ 验证签名（HMAC-SHA256 + 密钥）
    │   ├─ 验证过期时间（exp claim）
    │   └─ 提取userId与role
    ├─ 构建UsernamePasswordAuthenticationToken
    └─ 写入SecurityContextHolder
         │
         ▼
   Controller处理请求
         │
         ▼
   AccessControlService
    ├─ 从SecurityContext取当前userId
    ├─ 判断目标资源归属
    └─ 患者：仅允许访问本人资源
       照护者：仅允许访问绑定患者资源
```

**图4.2 JWT认证与授权流程图**

Token规格：AccessToken有效期24小时，RefreshToken有效期7天，均采用HMAC-SHA256算法签名，载荷包含userId与UserRole两个关键Claim。

### 4.2.3 健康异常检测与报警机制

健康数据提交后，`UserHealthService`执行自动异常检测，检测逻辑如下：

```java
// 血压异常判断
boolean bpAbnormal = (bpSys >= 140 || bpDia >= 90)   // 高血压
                   || (bpSys < 90  || bpDia < 60);    // 低血压

// 血糖异常判断（非空腹标准）
boolean glucoseAbnormal = isFasting ? (glucose >= 126 || glucose <= 70)
                                    : (glucose >= 200 || glucose <= 70);

// 综合异常标记
boolean overallAbnormal = bpAbnormal || glucoseAbnormal || ecgAbnormal;
```

当`overallAbnormal`为true时，`NotificationService`执行以下操作：
1. 在`user_health_alert`表中为患者本人创建HEALTH_ANOMALY类型报警记录；
2. 查询`user_guardian_links`表获取该患者的所有绑定照护者；
3. 为每位照护者分别创建报警记录，接收方（receiver_id）设置为照护者userId；
4. （可选）通过FCM/APNs向照护者设备推送实时推送通知。

### 4.2.4 ECG数据处理与AI调用

后端ECG控制器（EcgController）接收移动端提交的ECG数据，通过`EcgAnalysisService`以HTTP POST方式调用AI推理服务的`/predict_window`端点，请求头携带预配置的`X-API-Key`。请求超时配置：连接超时5秒，读取超时30秒。AI服务返回分类结果后，后端将推理结果写入`user_health_records`表，并根据`ecgAbnormal`标志触发照护者通知。

---

## 4.3 AI模型设计与实现

### 4.3.1 数据集与预处理

**PTB-XL数据集：** 本课题使用PTB-XL公开心电图数据集进行模型训练，该数据集由德国夏里特医学大学与联邦物理技术研究院联合发布，共收录21,837份12导联ECG记录，采样频率500Hz，每份记录时长10秒（含5000个采样点），并由多名心脏科医生进行了多标签标注，涵盖NORM、STTC、MI、CD、HYP五类诊断类别[8]。

**数据预处理流程：**
1. **带通滤波：** 对原始ECG信号施加0.5~45Hz带通滤波器，滤除基线漂移（低频）与工频干扰（高频）；
2. **Z-score归一化：** 对每条导联独立进行均值-方差归一化，消除导联间的幅度差异；
3. **长度对齐：** 将所有记录统一填充或截断至TARGET_LEN=5000采样点；
4. **数据集划分：** 按PTB-XL官方推荐的10折交叉验证划分，最终以第10折作为测试集（约2183条记录）。

### 4.3.2 CNN-CBAM-GRU模型架构

模型整体架构如图4.3所示，由四个功能模块顺序连接：

**（1）时域特征提取器（CNN + CBAM）**

```
输入: (Batch, 12, 5000)  ← 12导联，每导联5000采样点
    │
    ├─ ConvBlock 1:
    │   Conv1D(12→32, kernel=7, padding=3)
    │   BatchNorm1d(32)
    │   ReLU
    │   MaxPool1d(stride=2)    → (Batch, 32, 2500)
    │   CBAM(32)               → 通道注意力 + 空间注意力
    │
    └─ ConvBlock 2:
        Conv1D(32→32, kernel=7, padding=3)
        BatchNorm1d(32)
        ReLU
        MaxPool1d(stride=2)    → (Batch, 32, 1250)
        CBAM(32)
```

CBAM模块的核心计算过程：
- **通道注意力：** 对特征图分别进行全局平均池化与全局最大池化，结果经共享MLP（32→8→32）后相加并通过Sigmoid激活，得到通道注意力权重向量，与原特征图逐通道相乘；
- **空间注意力：** 对通道注意力加权后的特征图沿通道维度分别取均值与最大值，拼接后经Conv1D（kernel=7）与Sigmoid激活，得到空间注意力掩码，与特征图逐时域点相乘。

**（2）双向序列建模器（BiGRU）**

```
输入: (Batch, 1250, 32)  ← 序列长度1250，特征维度32
    │
    Bidirectional GRU(input=32, hidden=64, num_layers=2, dropout=0.5)
    │
输出: 取最后时刻隐状态
    前向GRU: h_forward (64维)
    后向GRU: h_backward (64维)
    拼接 → context_vector (128维)
```

**（3）幅度特征注入**

从原始12导联信号中提取以下统计特征，每导联3个，共36维：
- 峰峰值（Peak-to-Peak Amplitude）
- 均方根（RMS, Root Mean Square）
- 标准差（Standard Deviation）

将36维幅度特征向量与128维context_vector拼接，得到164维融合特征向量。

**（4）分类头（FC Head）**

```
输入: (Batch, 164)
    │
    Linear(164→128) → ReLU → Dropout(0.5)
    │
    Linear(128→5)   → Sigmoid激活
    │
输出: (Batch, 5)  ← 5类标签的独立概率（多标签）
```

**多标签分类机制说明：**

本模型采用多标签（Multi-label）分类框架，与多类（Multi-class）分类在机制上存在本质区别。在多类分类中，每个样本只能归属于互斥的单一类别（通常使用Softmax激活）；而在多标签分类中，一份ECG记录可以同时被标注为多个异常类别（例如同时存在STTC与CD），因此各类别标签之间相互独立，使用Sigmoid激活函数对每个输出节点独立输出`[0,1]`范围的概率值，各类别标签是否激活由独立阈值比较决定。

PTB-XL数据集中确实存在多标签样本，例如同时具有ST段改变（STTC）和传导障碍（CD）的患者记录，多标签框架使模型能够正确处理此类共病（Comorbidity）情形。

**分类阈值设定：** 推理时使用如下各类别阈值向量，高于阈值则激活对应标签：

| 类别 | NORM | STTC | MI | CD | HYP |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 分类阈值 | 0.60 | 0.45 | 0.50 | 0.60 | 0.70 |

阈值设定原则：对于发病率较低但临床风险较高的类别（如HYP，阈值0.70），设置较高阈值以控制假阳性率；对于发病率相对较高的类别（如STTC，阈值0.45），设置较低阈值以提高召回率，优先保证不漏报。各阈值经在验证集上对不同候选值（0.4~0.8步长0.05）的F1分数进行网格搜索后确定。

### 4.3.3 训练设置

**损失函数：** 采用非对称损失函数（Asymmetric Loss，ASL）[11]，相比传统二元交叉熵，ASL对正样本与负样本的梯度贡献实施非对称加权，有效缓解多标签分类中的类别不平衡与样本负多正少问题；

**优化器：** AdamW（lr=1e-3, weight_decay=1e-4），配合余弦退火学习率调度（T_max=50 epochs）；

**训练周期：** 最大50个epoch，以验证集AUROC为指标选取最优模型权重（best_model_multilabel.pth，567KB）；

**硬件配置：** GPU加速训练（CUDA），推理阶段自动降级至CPU（HuggingFace Spaces free tier）。

### 4.3.4 FastAPI推理服务实现

AI推理服务封装为FastAPI应用，对外暴露以下两个核心接口：

**`POST /predict_window`（ECG分类推理）**

请求体：
```json
{
  "x": [[...], [...], ...],  // 2D数组：12导联 × 任意长度
  "fs": 500                   // 采样频率（可选，默认500Hz）
}
```

服务端处理流程：
1. **输入验证：** 检查数组形状合法性、数值类型有效性（拒绝NaN/Inf）；
2. **采样率适配：** 若输入采样率不等于500Hz，使用scipy.signal.resample_poly进行重采样；
3. **长度对齐：** 填充或截断至5000采样点；
4. **模型推理：** 送入CNN-CBAM-GRU模型，获取原始logits；
5. **后处理：** 经Sigmoid激活得到概率向量，与预设分类阈值（[0.6, 0.45, 0.5, 0.6, 0.7]）对比，确定激活标签；根据各异常类最大概率确定风险等级（≥0.8: high, ≥0.6: medium, <0.6: low）。

响应体：
```json
{
  "probs": [0.03, 0.62, 0.15, 0.08, 0.41],
  "thresholds": [0.6, 0.45, 0.5, 0.6, 0.7],
  "active_labels": ["STTC"],
  "risk_level": "medium",
  "top_label": "STTC",
  "top_confidence": 0.62
}
```

**`GET /sample_window`（获取样本ECG）**

支持按标签类型（NORM/STTC/MI/CD/HYP）返回预存的标准ECG样本数据，用于移动端演示与测试场景。

---

## 4.4 辅助功能模块设计与实现

### 4.4.1 认知训练模块（BrainTrainingController）

认知训练模块面向老年用户提供翻牌配对记忆训练游戏，通过持续训练延缓认知功能退化。后端设计如下：

- **数据模型：** `brain_training_records` 表存储每次训练的用户ID（user_id）、得分（score）、时间戳（created_at）；
- **接口设计：** `POST /api/brain-training/{userId}` 接收本次训练得分并持久化；`GET /api/brain-training/{userId}` 返回历史得分列表，移动端据此渲染训练曲线与历史最高分；
- **前端实现：** 采用React Native实现基于随机卡片布局的翻牌配对游戏，翻牌动画通过`Animated.timing`实现，配对成功触发触觉反馈（Haptic Feedback）。

### 4.4.2 疾病趋势资讯模块（NewsController + NewsAutoCollector）

疾病趋势资讯模块集成NewsAPI与KCDC（韩国疾病控制与预防中心）两个外部数据源，实现定期自动采集与展示。

- **自动采集机制：** `NewsAutoCollector` 组件通过Spring `@Scheduled` 定时任务，按周期调用外部API采集最新疾病趋势数据，并将结果（疾病名称、地区region、风险等级riskLevel、建议类型advisoryType）存储至 `disease_news` 表；
- **接口设计：** `GET /api/news` 返回最新5条资讯列表；`POST /api/news` 支持手动触发采集（仅限授权管理操作）；
- **通知联动：** 采集到高风险等级（riskLevel=HIGH）资讯时，自动触发 `NotificationService` 向相关用户推送 `DISEASE_TREND` 类型通知。

### 4.4.3 ICD诊断病历模块（UserDiseaseController）

ICD诊断病历模块支持用户录入与管理基于ICD（国际疾病分类）编码的既往诊断记录，为照护者查看患者完整病史、提高紧急响应效率提供数据支撑。

- **数据模型：** `user_disease` 表存储用户ID（user_id）、疾病名称（disease_name）、ICD代码（icd_code）、确诊日期（diagnosed_at）；
- **接口设计：** `GET /api/user-disease/{userId}` 返回该用户全部诊断记录；`POST /api/user-disease/{userId}` 添加新的诊断条目；
- **权限控制：** 患者本人及其绑定照护者均可查询诊断记录，遵循Spring Security角色授权规则；修改操作仅限患者本人。
