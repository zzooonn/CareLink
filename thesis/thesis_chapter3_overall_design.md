# 第3章 总体设计

## 3.1 系统总体架构

CareLink平台采用三层微服务架构（Three-Tier Microservices Architecture），将系统功能分解为相互独立、松耦合的三个服务层次，各层通过标准HTTP/RESTful接口进行通信。系统总体架构如图3.1所示。

```
┌──────────────────────────────────────────────────────────┐
│                   移动端（Frontend Layer）                 │
│         React Native + Expo (iOS / Android)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ 认证模块  │ │体征监测  │ │ECG分析   │ │照护者管理 │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTPS / RESTful API
┌──────────────────────────▼───────────────────────────────┐
│                   后端服务（Backend Layer）                │
│         Spring Boot 3.5.7 (Java 21) + PostgreSQL         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Auth模块  │ │健康数据  │ │照护者服务 │ │通知报警  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└──────────────────────────┬───────────────────────────────┘
                           │ HTTP + API Key 鉴权
┌──────────────────────────▼───────────────────────────────┐
│                AI推理服务（AI Inference Layer）            │
│             FastAPI + PyTorch (HuggingFace Spaces)       │
│         CNN-CBAM-GRU 12导联ECG多标签分类模型              │
└──────────────────────────────────────────────────────────┘
```

**图3.1 CareLink系统总体架构图**

**移动端层（Frontend Layer）：** 面向最终用户的交互入口，基于React Native（Expo框架）构建，以跨平台方式运行于iOS与Android设备。移动端负责用户界面渲染、本地状态管理、数据展示与用户交互，通过HTTPS调用后端RESTful API进行数据交换。

**后端服务层（Backend Layer）：** 系统的业务逻辑核心，基于Spring Boot 3.5.7（Java 21）构建，提供RESTful API服务。后端负责统一的身份认证与授权、健康数据的持久化与聚合分析、跨角色数据路由与通知报警、对AI推理服务的调用管理，以及与PostgreSQL数据库的数据交互。后端部署于AWS EC2实例。

**AI推理服务层（AI Inference Layer）：** 提供ECG智能分析能力的专用微服务，基于FastAPI框架与PyTorch深度学习框架构建，部署于HuggingFace Spaces平台。AI推理服务对外暴露标准化的RESTful接口，由后端服务在需要时调用，完成12导联ECG数据的多标签分类推理。

三层架构的核心优势在于关注点分离（Separation of Concerns）：AI推理服务可独立于后端进行模型更新与优化，后端可独立于移动端进行业务逻辑调整，各层的变更不会引发全局系统的重新部署。

---

## 3.2 技术选型分析

### 3.2.1 移动端技术选型

在移动端框架选型上，本课题对React Native、Flutter与原生开发三种方案进行了对比，如表3.1所示。

**表3.1 移动端技术方案对比**

| 评估维度 | React Native (Expo) | Flutter | 原生开发 (Swift/Kotlin) |
|:---|:---:|:---:|:---:|
| 跨平台能力 | ✅ iOS/Android统一 | ✅ iOS/Android统一 | ❌ 需分别开发 |
| 开发效率 | ✅ 高（热更新） | ✅ 高 | ❌ 低 |
| 生态成熟度 | ✅ 成熟（npm生态） | ⚠️ 较新 | ✅ 成熟 |
| 健康数据库集成 | ✅ expo-notifications等 | ⚠️ 部分依赖原生桥 | ✅ 原生支持 |
| 学习成本 | ✅ JavaScript/TypeScript | ⚠️ Dart语言 | ❌ 高 |

综合考量跨平台能力、开发效率与生态成熟度，本课题选择**React Native（Expo 54.0.33）+ TypeScript**方案。Expo框架提供了开箱即用的原生模块封装（推送通知、触觉反馈、字体等），Expo Router实现了基于文件系统的路由管理，显著降低了开发复杂度。

### 3.2.2 后端技术选型

后端框架方面，本课题对比了Spring Boot、Django（Python）与Node.js（Express）三种主流方案。Spring Boot在企业级应用的生产稳定性、类型安全（Java强类型）及Spring Security生态的成熟度方面具有显著优势，且与后续AI推理服务的HTTP集成无缝兼容，因此选择**Spring Boot 3.5.7（Java 21）**。

数据库方面，系统核心业务数据（用户、健康记录、照护关系、药物等）具有明确的关系模型，选择**PostgreSQL**关系型数据库，结合**Flyway**实现数据库版本化迁移管理，保证数据模式变更的可追溯性与可回滚性。

### 3.2.3 AI推理服务技术选型

AI推理服务的核心需求为：轻量、高效的HTTP接口层 + PyTorch深度学习框架的原生支持。本课题选择**FastAPI**框架，其基于Python类型注解的自动参数校验与文档生成能力，以及优秀的异步处理性能，非常适合作为深度学习模型的推理服务包装层。深度学习框架选用**PyTorch 2.x**，原生支持CPU/CUDA自动选择，模型存储格式为`.pth`（PyTorch checkpoint）。

---

## 3.3 关键问题与解决方案

### 3.3.1 关键问题一：12导联ECG的时空联合建模

**问题描述：** 12导联ECG数据具有双重复杂性：其一，12条导联之间存在相互关联的空间拓扑关系；其二，每条导联本身是随时间连续变化的生理信号，具有强烈的时序依赖性。如何在单一模型中同时有效捕获这两种维度的特征，是ECG自动分类的核心技术挑战。

**解决方案：** 本课题设计了CNN-CBAM-GRU复合架构，通过三层机制联合建模：

- **卷积层（CNN）** 在局部感受野内提取各导联的时域局部特征（如QRS波群形态）；
- **卷积块注意力模块（CBAM）** 在通道维度（12导联方向）和空间维度（时间方向）进行自适应特征加权，引导模型聚焦于诊断价值高的导联与时段；
- **双向门控循环单元（BiGRU）** 在全局时序维度对特征序列进行双向上下文建模，捕获心动周期的长程时序依赖。

此外，模型引入幅度特征注入机制，将从12导联中提取的峰峰值、均方根、标准差等36维统计特征与BiGRU输出向量拼接，弥补深度特征对生理信号绝对幅度信息的不敏感性。

### 3.3.2 关键问题二：双角色权限分离与数据隔离

**问题描述：** 系统支持患者（PATIENT）与照护者（GUARDIAN）两种角色，不同角色对数据的访问权限存在本质差异。患者只能访问本人数据，照护者只能访问其绑定患者的数据，任何跨越授权边界的数据访问都可能引发医疗数据隐私风险。

**解决方案：** 本课题采用JWT（JSON Web Token）+ Spring Security RBAC（基于角色的访问控制）双层安全机制：

- **JWT认证层：** JwtAuthFilter拦截所有请求，从Authorization请求头提取Bearer Token，解析并验证令牌有效性，将userId与UserRole注入Spring Security上下文；
- **业务访问控制层：** AccessControlService在每个业务接口调用时，根据当前请求的JWT中的userId，检查其对目标资源的访问权限——患者只能访问本人资源，照护者只能访问通过user_guardian_links表关联的患者资源，权限不足时返回HTTP 403 Forbidden。

### 3.3.3 关键问题三：老年用户的无障碍设计

**问题描述：** 老年用户普遍存在视力衰退、手部精细操作能力下降等生理特点，标准移动应用的字体大小与交互设计往往难以满足老年用户的使用需求，可能导致操作困难与用户流失。

**解决方案：** 本课题在移动端实施专项无障碍设计：

- **动态字体缩放：** 通过FontSizeContext全局上下文管理字体倍率（小×0.85/标准×1.0/大×1.2），所有文字展示组件使用ScaledText封装，确保字体大小调整全局生效；
- **触觉反馈：** 关键操作按钮集成expo-haptics触觉反馈，为视觉障碍用户提供操作确认感知；
- **最小字体保障：** ScaledText组件设置fontSize下限（minimumFontSize），防止字体缩放后文字过小而不可读；
- **高对比度配色：** 界面采用高对比度颜色方案，确保在弱光或老年视力条件下信息可读性。

---

## 3.4 数据库设计

### 3.4.1 概念数据模型

系统数据模型围绕"用户（User）"实体展开，通过关联关系将各业务实体有机连接。核心实体关系描述如下：

- **用户（User）** 是系统的核心实体，分为患者与照护者两类角色；
- 患者与**健康汇总（UserHealth）** 之间为1:1关系，存储患者的最新及平均生命体征指标；
- 患者与**健康记录（UserHealthRecord）** 之间为1:N关系，记录每次测量的详细数据；
- 用户与**药物（UserMedication）** 之间为1:N关系，药物与**服药计划（UserMedicationSchedule）** 之间为1:N关系；
- 患者与照护者之间通过**关联关系（UserGuardianLink）** 建立M:N关系；
- 患者与**健康报警（UserHealthAlert）** 之间为1:N关系，报警记录同时关联至接收方用户（可为患者本人或照护者）；
- 用户与**疾病（UserDisease）** 之间为1:N关系，记录用户确诊的慢性病信息；
- 用户与**认知训练记录（BrainTrainingGame）** 之间为1:N关系。

### 3.4.2 主要数据表设计

**表3.2 users表（用户主表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键，自增 |
| userId | VARCHAR(50) | 用户登录ID，唯一 |
| password | VARCHAR(255) | BCrypt加密后的密码 |
| name | VARCHAR(100) | 用户姓名 |
| gender | ENUM | 性别（M/F/UNKNOWN） |
| birthDate | DATE | 出生日期 |
| phone | VARCHAR(20) | 手机号 |
| role | ENUM | 角色（PATIENT/GUARDIAN） |
| profileImageId | INT | 头像编号（1~12） |
| bloodType | VARCHAR(10) | 血型（可选） |
| allergies | TEXT | 过敏史（可选） |
| medicalConditions | TEXT | 既往病史（可选） |
| createdAt | TIMESTAMP | 创建时间 |

**表3.3 user_health_records表（健康记录表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| user_id | BIGINT (FK) | 关联用户 |
| bpSys | INT | 收缩压（mmHg） |
| bpDia | INT | 舒张压（mmHg） |
| glucose | FLOAT | 血糖值（mg/dL） |
| bpAbnormal | BOOLEAN | 血压是否异常 |
| glucoseAbnormal | BOOLEAN | 血糖是否异常 |
| ecgAbnormal | BOOLEAN | ECG是否异常 |
| ecgAnomalyType | VARCHAR(50) | ECG异常类型 |
| ecgRiskScore | FLOAT | ECG综合风险分 |
| measuredAt | TIMESTAMP | 测量时间 |

**表3.4 user_guardian_links表（患者-照护者关联表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| patient_id | BIGINT (FK) | 患者用户ID |
| guardian_id | BIGINT (FK) | 照护者用户ID |
| contactPhone | VARCHAR(20) | 照护者联系电话 |
| UNIQUE | (patient_id, guardian_id) | 防重复绑定约束 |

**表3.5 user_health_alert表（健康报警表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| patient_id | BIGINT (FK) | 关联患者 |
| receiver_id | BIGINT (FK) | 通知接收方 |
| alertType | ENUM | 报警类型（HEALTH_ANOMALY / DISEASE_TREND / MEDICATION_REMINDER） |
| title | VARCHAR(255) | 通知标题 |
| message | VARCHAR(1000) | 通知内容 |
| createdAt | TIMESTAMP | 创建时间 |
| readAt | TIMESTAMP | 阅读时间（NULL表示未读） |

**表3.6 user_medications表（药物信息表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| user_id | BIGINT (FK) | 关联用户 |
| medicationName | VARCHAR(100) | 药物名称 |
| dosage | VARCHAR(50) | 剂量（如"10mg"） |
| instructions | VARCHAR(500) | 服药说明（可选） |
| createdAt | TIMESTAMP | 创建时间 |

**表3.7 user_medication_schedules表（服药计划表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| medication_id | BIGINT (FK) | 关联药物 |
| timeOfDay | TIME | 服药时间（HH:mm格式） |
| daysOfWeek | VARCHAR(50) | 服药日（EVERYDAY / 周几组合） |
| timezone | VARCHAR(50) | 时区（如"Asia/Seoul"） |

**表3.8 user_disease表（ICD诊断病历表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| user_id | BIGINT (FK) | 关联用户 |
| diseaseName | VARCHAR(200) | 疾病名称 |
| icdCode | VARCHAR(20) | ICD国际疾病分类代码（如"E11"） |
| diagnosedAt | DATE | 确诊日期 |
| createdAt | TIMESTAMP | 录入时间 |

**表3.9 brain_training_records表（认知训练记录表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| user_id | BIGINT (FK) | 关联用户 |
| score | INT | 本次训练得分 |
| createdAt | TIMESTAMP | 训练时间戳 |

**表3.10 disease_news表（疾病趋势资讯表）**

| 字段名 | 类型 | 说明 |
|:---|:---|:---|
| id | BIGINT (PK) | 主键 |
| userId | VARCHAR(50) | 目标用户ID |
| title | VARCHAR(500) | 资讯标题 |
| description | TEXT | 资讯摘要 |
| url | VARCHAR(1000) | 原文链接 |
| source | VARCHAR(100) | 数据源（NewsAPI等） |
| publishedAt | TIMESTAMP | 发布时间 |
| createdAt | TIMESTAMP | 采集入库时间 |
