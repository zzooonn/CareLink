# 摘要与关键词

---

## 中文摘要

随着我国人口老龄化程度持续加深，老年慢性病患者的日常健康监测与家庭照护协同管理已成为亟待解决的社会问题。传统健康管理模式存在数据孤岛、照护者实时感知能力不足、专业心电分析门槛高等缺陷，难以满足老年人群的精细化健康管理需求。

本文设计并实现了一款面向老年人健康监测的移动医疗平台——CareLink。平台采用三层微服务架构，由跨平台移动端（React Native/Expo）、后端服务（Spring Boot 3/PostgreSQL）与AI推理服务（FastAPI/PyTorch）三部分构成。移动端面向患者与照护者双角色，实现了生命体征记录与异常提示、12导联ECG可视化与AI辅助分析、药物管理与推送提醒、多周期健康趋势分析、照护者绑定与紧急联络、认知训练游戏及疾病趋势资讯等功能，并针对老年用户提供三档字体缩放等无障碍特性。后端服务实现了基于JWT的双角色认证授权、健康数据聚合与异常检测及跨角色通知报警机制。AI推理服务自主设计了CNN-CBAM-GRU复合神经网络模型，融合卷积注意力机制与双向门控循环单元，在PTB-XL公开数据集（21,837条12导联ECG）上实现了对五类心电异常的多标签分类，五类平均Macro AUC达到0.9252（92.52%），其中最难类别HYP（心室肥厚）AUC为0.8764。系统测试表明，后端服务在20名并发用户下最高处理量可达59 TPS，ECG推理平均延迟约2.28秒，所有边界值异常输入均得到正确拦截，系统具备良好的实时性与健壮性。

**关键词：** 移动医疗平台　老年健康监测　心电图分类　卷积注意力机制　患者照护者协同

---

## Abstract

With the deepening of population aging in China, daily health monitoring and collaborative care management for elderly patients with chronic diseases have become urgent social issues. Traditional health management models suffer from data silos, insufficient real-time awareness for caregivers, and high barriers to professional ECG analysis, failing to meet the refined health management needs of the elderly population.

This paper designs and implements a mobile healthcare platform for elderly health monitoring, named CareLink. The platform adopts a three-tier microservices architecture consisting of a cross-platform mobile client (React Native/Expo), a backend service (Spring Boot 3/PostgreSQL), and an AI inference service (FastAPI/PyTorch). The mobile client supports dual roles—patient and caregiver—and implements vital sign recording with anomaly alerts, 12-lead ECG visualization with AI-assisted analysis, medication management with push reminders, multi-period health trend analysis, caregiver binding and emergency contact, cognitive training games, and disease trend news. Accessibility features including three-level font scaling are provided for elderly users. The backend service implements dual-role JWT authentication and authorization, health data aggregation with anomaly detection, and cross-role notification and alert mechanisms. The AI inference service employs a self-designed CNN-CBAM-GRU composite neural network that integrates convolutional block attention modules and bidirectional gated recurrent units. Trained on the PTB-XL public dataset (21,837 12-lead ECG records), the model achieves multi-label classification of five ECG abnormality categories with a five-class Macro AUC of 0.9252 (92.52%), with the most challenging category HYP (ventricular hypertrophy) achieving an AUC of 0.8764. System testing demonstrates that the backend service reaches a peak throughput of 59 TPS under 20 concurrent users, ECG inference averages approximately 2.28 seconds, and all boundary-value invalid inputs are correctly intercepted, confirming good real-time performance and robustness.

**Keywords:** Mobile healthcare platform　Elderly health monitoring　ECG classification　Convolutional attention mechanism　Patient-caregiver collaboration
