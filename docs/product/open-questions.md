---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
next_action: "指定产品 owner，并优先回答所有标记为阻断下一阶段的问题"
---

# Open Questions

| Question ID | Question | Current evidence | Missing decision | Impact scope | Blocks next stage? | Owner | Next human confirmation action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PROD-001 | 谁是首要目标用户，他们最需要解决的具体问题是什么？ | 只有播放、可视化、分析相关代码；没有用户研究 | 目标用户、主任务、当前痛点、为什么现在 | 全部产品意图与架构 | 是 | unknown | 由产品决策人写出一类首要用户、一个核心场景和当前替代方案 |
| PROD-002 | 首个批准范围是播放器+可视化，还是同时包含 Analyzer/Editor？ | Home/MusicBar 可运行；Analyzer 部分实现；Editor/Visualizer 指向占位 | 首版能力、非目标和优先级 | 路由、数据流、交付规模 | 是 | unknown | 对 [scope](scope.md) 的每个候选能力逐项接受或拒绝 |
| PROD-003 | 如何定义用户价值和成功阈值？ | 只有候选技术/行为指标，无基线和埋点 | 指标、目标值、样本、观测周期 | 验收、质量、发布 | 是 | unknown | 审阅 [success metrics](success-metrics.md)，至少批准一个 leading 和一个 lagging 指标 |
| PROD-004 | 需要支持哪些浏览器、设备、屏幕和音频格式？ | 代码依赖 Web Audio、WebGL、dvh 和本地 File；无矩阵 | 最低版本、移动端、无 WebGL 行为、格式列表 | 架构、UI、测试 | 是 | unknown | 建立首版支持矩阵并列出明确不支持项 |
| PROD-005 | 本地音频的隐私和数据处理承诺是什么？ | 当前代码只用本地 File/object URL，未发现上传 | 是否永不上传、元数据/封面处理、日志限制 | 架构、文案、合规、监控 | 是 | unknown | 由产品/隐私 owner 批准一段可执行的数据边界 |
| PROD-006 | 播放队列与设置需要怎样的持久化？ | volume/style 写 localStorage；队列和位置只在内存 | 刷新恢复、数据迁移、清除策略 | 状态设计、隐私、兼容 | 是 | unknown | 确认首版是否保留会话队列以及旧配置迁移政策 |
| PROD-007 | 是否要求离线、键盘操作和辅助技术可用？ | 当前有本地文件和部分鼠标/键盘逻辑，但无产品标准 | 离线、键盘、屏幕阅读器、对比度目标 | UI 架构、验收 | 是 | unknown | 指定可访问性与离线最低目标 |
| PROD-008 | 产品、技术与发布 owner 分别是谁？ | 仓库无 CODEOWNERS 或 owner 文档 | 决策人、reviewer、风险接受人 | 所有审批门禁 | 是 | unknown | 指定角色或个人并更新所有文档 frontmatter |
| PROD-009 | 性能预算是什么？ | 当前构建有约 1 MB chunk 警告；无运行预算 | bundle、首屏、RAF、内存/GPU 阈值 | 设计、质量、发布 | 否；会阻断质量阶段 | unknown | 选定目标设备并批准可测量预算 |
| PROD-010 | 自动化测试应使用哪些音频 fixture，许可如何处理？ | 无 `test.ts`，`public/audios` 被忽略 | fixture 来源、格式覆盖、是否可入库 | 测试策略、CI | 否；会阻断完整测试门禁 | unknown | 提供可合法使用的短音频样本或生成规则 |
| PROD-011 | 应部署到哪里，history 路由如何回退？ | 使用 `createWebHistory()`；无部署/CI 配置 | 托管平台、base path、SPA fallback、环境 | 架构、发布 | 是 | unknown | 指定目标托管环境与 URL 约束 |
| PROD-012 | Analyzer 输出要面向学习、诊断还是创作？ | 当前只有静态 Meyda 特征说明和试验图表 | 用户任务、输出、导出/交互边界 | Analyzer 设计与范围 | 是（若纳入首版） | unknown | 选择一个 Analyzer 核心任务，或明确排除首版 |
