---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
next_action: "审阅 readiness 中的 PROD-015 部署 blocker；获批后进入 Editor E0 处理 PROD-014"
---

# Open Questions

## Open, Non-Blocking

| ID | Question | Why it remains open | Impact | Blocks current next stage? | Owner | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| PROD-013 | 未来是否提供上传、云端处理、账户或跨设备同步？ | 当前只批准浏览器本地处理；未来能力尚无目标用户、隐私或服务设计 | 若进入范围，将改变产品数据边界、架构、合规和发布要求 | 否 | project-owner | 提议任何远端音频或账户能力时 |
| PROD-014 | Visualizer、Editor 和其他空白 Tab 分别解决什么用户问题？ | 当前没有已批准用例，继续推断会造成范围漂移 | 未来产品范围、导航和架构 | 否 | project-owner | 任一 Tab 被提议进入交付时 |
| PROD-015 | 正式发布使用哪个静态托管平台、域名和 SPA fallback 配置？ | 当前只要求 HTTPS 或 localhost，托管选择属于 release 准备 | 部署、监控、回滚和运行配置 | 不阻断 Analyzer readiness review；会阻断正式上线 | project-owner | readiness 获批后若开始 release and feedback |
| PROD-016 | 是否需要在 owner-only 验证之外证明普遍学习效果？ | 当前成功标准只由 owner 对 3/3 黄金片段验证 | 用户研究样本、测量设计和对外表述 | 否 | project-owner | 需要对外声称学习效果或扩大目标人群时 |

## Closed in This Review

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-001 | 目标用户与核心问题 | 音频分析学习者；把 Meyda 输出对应到具体时刻、听感和音色变化 |
| PROD-002 | 首批范围 | Analyzer 为主，播放器、队列和共享时间轴为基础；Editor/Visualizer 等未定义页面排除 |
| PROD-003 | 成功标准 | 黄金一致性、100ms 游标、主线程响应、owner 脚本任务和 3/3 学习解释 |
| PROD-004 | 支持矩阵 | 本地 MP3/WAV/FLAC、约 15 分钟、最新 Chrome/Edge 桌面、1024/1280/1920 CSS px |
| PROD-005 | 数据边界 | 当前批准范围内音频、元数据和分析结果只在浏览器本地处理 |
| PROD-006 | 持久化 | 最近一次会话；全部句柄，当前 Blob 与当前分析缓存；刷新归零暂停 |
| PROD-007 | 可访问性 | 核心任务键盘可用、焦点可见、非纯颜色表达、支持 reduced motion |
| PROD-008 | 批准人 | `project-owner` 负责产品、技术和阶段批准 |
| PROD-009 | 性能目标 | 输入反馈 100ms 内、无分析归因主线程长任务；不设置分析完成 wall-clock SLA |
| PROD-010 | 测试音频 | 合成 PCM 加有 provenance/hash 的同源 MP3/WAV/FLAC 短 fixture |
| PROD-011 | 当前运行环境 | 静态 SPA 运行在 HTTPS 或 localhost；正式托管延后到 release 阶段 |
| PROD-012 | Analyzer 核心任务 | 学习和比较；最终覆盖 21 项，首批 RMS、Amplitude Spectrum、Chroma |

## Gate State

本轮没有阻断 system design 的开放产品问题。任何开放问题被提议进入当前范围时，必须先更新并重新批准 [problem brief](problem-brief.md)、[scope](scope.md) 或 [success metrics](success-metrics.md)，然后复核下游文档。
