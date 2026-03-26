# 结论与展望

## 一、主要工作总结

本文设计并实现了面向老年人健康监测的移动医疗平台CareLink，针对老年慢性病患者日常健康管理与家庭照护者协同监护的现实需求，构建了一套完整的三层微服务架构解决方案。本文的主要工作与贡献如下：

**（1）三层微服务平台架构的设计与实现**

本文提出并实现了移动端（React Native/Expo）+ 后端服务（Spring Boot 3/PostgreSQL）+ AI推理服务（FastAPI/PyTorch）的三层松耦合微服务架构，各层通过标准RESTful接口解耦，支持独立扩展与维护。后端服务实现了基于JWT双Token机制的双角色（PATIENT/GUARDIAN）认证授权体系、基于临床阈值的健康异常自动检测、以及跨角色通知报警路由机制；移动端针对老年用户实施了动态字体缩放、触觉反馈等无障碍专项设计。负载测试结果表明，系统在20名并发用户下处理量达59 TPS，边界值健壮性测试通过率100%，具备良好的实时性与可靠性。

**（2）CNN-CBAM-GRU心电分析模型的设计与验证**

本文提出了一种融合卷积块注意力机制（CBAM）、双向门控循环单元（BiGRU）与幅度特征注入的复合神经网络架构，用于12导联ECG多标签分类。模型通过CBAM在通道与空间双维度对卷积特征进行自适应加权，引导网络聚焦诊断价值高的导联与时域区段；通过BiGRU在全局时序维度建模心动周期的长程依赖；通过注入36维手工统计特征弥补深度特征对生理信号绝对幅度信息的不敏感性。模型在PTB-XL公开数据集上的五类综合Macro AUC达到0.9252（92.52%），最难判别的HYP类别AUC为0.8764，在Macro-F1等综合指标上以ResNet1D 1/13.7的参数规模达到统计等价性能，消融实验进一步验证了各关键模块的独立贡献。

**（3）患者-照护者协同监护机制的实现**

本文实现了患者与照护者之间的双向数据共享与实时异常通知机制，通过user_guardian_links关联关系动态路由健康异常报警，使照护者能够在第一时间获悉绑定患者的异常健康状态，有效弥补了传统移动健康应用在家庭照护协同管理方面的能力缺失。

## 二、研究局限性

本文现有工作存在以下局限性，有待后续改进：

**（1）ECG数据来源的局限性：** 当前系统使用模拟生成的ECG波形数据（正弦基波叠加QRS模板）进行前端演示，与真实物理ECG采集设备（如医用贴片式12导联采集仪）尚未实现硬件集成，限制了系统在真实临床场景中的适用性；

**（2）AI推理延迟的制约：** 受限于HuggingFace Spaces免费部署环境（CPU推理），当前ECG推理平均延迟约2.28秒，在需要快速响应的急救场景中存在一定局限；

**（3）部分安全机制有待完善：** 当前系统CORS配置中允许源范围有待收窄，AI推理服务与后端之间的通信有待进一步加固（如实施HTTPS双向验证），JWT刷新Token的撤销机制（Revocation）尚未实现；

**（4）长期数据验证不足：** 系统的临床有效性尚未经过真实患者群体的长期使用验证，AI模型的表现可能因地域人群特征差异而存在泛化性问题。

## 三、未来工作展望

基于上述局限性，后续工作计划从以下方向推进：

**（1）硬件ECG采集集成：** 探索与便携式12导联ECG采集设备（如蓝牙医用ECG贴片）的接口集成，实现真实生理信号的采集-传输-分析全链路；

**（2）AI推理性能优化：** 将AI推理服务迁移至支持GPU加速的云实例（如AWS EC2 G4实例），结合模型量化（INT8量化）与TorchScript优化，目标将推理延迟降至500ms以内，进一步提升实时性；

**（3）安全机制强化：** 实施JWT刷新Token黑名单机制、收窄CORS允许源配置、为后端与AI服务间通信添加mTLS双向认证，全面提升系统安全等级；

**（4）临床验证：** 与医疗机构合作，组织真实老年用户群体开展系统可用性评估与临床有效性验证研究，基于反馈数据迭代优化产品设计。

---

# 参考文献

[1] 国家统计局. 2023年国民经济和社会发展统计公报[R]. 北京：国家统计局，2024.

[2] 国家卫生健康委员会. 中国卫生健康统计年鉴2023[M]. 北京：中国协和医科大学出版社，2023.

[3] 中国疾病预防控制中心. 中国慢性病及其危险因素监测报告[R]. 北京：中国疾控中心，2022.

[4] Hannun A Y, Rajpurkar P, Haghpanahi M, et al. Cardiologist-level arrhythmia detection and classification in ambulatory electrocardiograms using a deep neural network[J]. Nature Medicine, 2019, 25(1): 65-69.

[5] 国务院. "十四五"国家老龄事业发展和养老服务体系规划[R]. 北京：国务院，2022.

[6] Klasnja P, Pratt W. Healthcare in the pocket: Mapping the space of mobile-phone health interventions[J]. Journal of Biomedical Informatics, 2012, 45(1): 184-198.

[7] Liang X, Wang G, Lin B, et al. Iot-based new elderly-care system design[A]. IEEE International Conference on Information Reuse and Integration[C]. IEEE, 2018: 241-248.

[8] Wagner P, Strodthoff N, Bousseljot R D, et al. PTB-XL, a large publicly available electrocardiography dataset[J]. Scientific Data, 2020, 7(1): 154.

[9] Ribeiro A H, Ribeiro M H, Paixão G M M, et al. Automatic diagnosis of the 12-lead ECG using a deep neural network[J]. Nature Communications, 2020, 11(1): 1760.

[10] Woo S, Park J, Lee J Y, et al. CBAM: Convolutional block attention module[A]. Proceedings of the European Conference on Computer Vision (ECCV)[C]. Munich: Springer, 2018: 3-19.

[11] Ridnik T, Ben-Baruch E, Zamir N, et al. Asymmetric loss for multi-label classification[A]. Proceedings of the IEEE/CVF International Conference on Computer Vision (ICCV)[C]. Montreal: IEEE, 2021: 82-91.

[12] Cho K, van Merrienboer B, Gulcehre C, et al. Learning phrase representations using RNN encoder-decoder for statistical machine translation[A]. Proceedings of EMNLP[C]. Doha: ACL, 2014: 1724-1734.

[13] He K, Zhang X, Ren S, et al. Deep residual learning for image recognition[A]. Proceedings of the IEEE Conference on Computer Vision and Pattern Recognition (CVPR)[C]. Las Vegas: IEEE, 2016: 770-778.

[14] Vaswani A, Shazeer N, Parmar N, et al. Attention is all you need[A]. Advances in Neural Information Processing Systems (NeurIPS)[C]. Long Beach: NIPS, 2017: 5998-6008.

[15] 国务院. 关于促进"互联网+医疗健康"发展的意见[R]. 北京：国务院，2018.

[16] Liu F, Liu C, Zhao L, et al. An open access database for evaluating the algorithms of electrocardiogram rhythm and morphology abnormality detection[J]. Journal of Medical Imaging and Health Informatics, 2018, 8(7): 1368-1373.

[17] Clifford G D, Liu C, Moody B, et al. AF classification from a short single lead ECG recording: The PhysioNet/Computing in Cardiology Challenge 2017[A]. Computing in Cardiology[C]. Rennes: IEEE, 2017: 1-4.

[18] Springenberg J T, Dosovitskiy A, Brox T, et al. Striving for simplicity: The all convolutional net[A]. ICLR Workshop[C]. San Diego, 2015.

[19] Chen T Q, Li M, Li Y, et al. MXNet: A flexible and efficient machine learning library for heterogeneous distributed systems[A]. NeurIPS Workshop[C]. Barcelona, 2015.

[20] Srivastava N, Hinton G, Krizhevsky A, et al. Dropout: A simple way to prevent neural networks from overfitting[J]. Journal of Machine Learning Research, 2014, 15(1): 1929-1958.
