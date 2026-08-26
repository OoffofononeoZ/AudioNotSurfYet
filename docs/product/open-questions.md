---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
next_action: "以已批准 Editor 架构进入 E1–E6 execution planning；PROD-015 继续阻断 Analyzer 正式上线"
---

# Open Questions

## Open, Non-Blocking

| ID | Question | Why it remains open | Impact | Blocks current next stage? | Owner | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| PROD-013 | 未来是否提供上传、云端处理、账户或跨设备同步？ | 当前只批准浏览器本地处理；未来能力尚无目标用户、隐私或服务设计 | 若进入范围，将改变产品数据边界、架构、合规和发布要求 | 否 | project-owner | 提议任何远端音频或账户能力时 |
| PROD-014 | Visualizer 和其他未定义空白 Tab 分别解决什么用户问题？ | Editor 问题已进入 E0；其余 Tab 仍没有已批准用例，继续推断会造成范围漂移 | 未来产品范围、导航和架构 | 否 | project-owner | 任一未定义 Tab 被提议进入交付时 |
| PROD-015 | 正式发布使用哪个静态托管平台、域名和 SPA fallback 配置？ | Analyzer readiness 已获有条件批准，但当前只要求 HTTPS 或 localhost，尚无生产托管决策 | 部署、监控、回滚和运行配置 | 不阻断 Editor E0；继续阻断 Analyzer 正式上线 | project-owner | owner 决定开始 release and feedback 时 |
| PROD-016 | 是否需要在 owner-only 验证之外证明普遍学习效果？ | 当前成功标准只由 owner 对 3/3 黄金片段验证 | 用户研究样本、测量设计和对外表述 | 否 | project-owner | 需要对外声称学习效果或扩大目标人群时 |
| PROD-017 | Editor 何时需要 JSON 之外的工程格式？ | 首版选择器只展示已注册的 JSON；当前没有第二种格式的用户任务或交换对象 | codec 注册、导入导出 UI、兼容与测试矩阵 | 否 | project-owner | 出现明确的外部工具交换格式或用户任务时 |
| PROD-018 | 内部 BPM 估计不足时是否引入第三方依赖？ | owner 要求安装前先审批；目前尚无内部算法及准确性证据 | 包体、许可、精度、Worker 和 fixture | 否；E2 先实现并评估内部估计 | project-owner | E2 golden 证明内部估计达不到批准阈值时 |
| PROD-019 | 是否增加同类范围重叠、自动合并、裁剪或自由时间精度？ | 首版已选择同类不重叠、自适应网格和无自动合并；更复杂语义尚无任务证据 | RangeEvent 数据语义、编辑状态机和兼容性 | 否 | project-owner | 用户提出具体复合效果或非节拍事件任务时 |

## Closed in Prior Reviews

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

## Closed in Editor E0 Review

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-014E | Editor 定义为对已有歌曲进行点/范围时间标注的“逆向制曲”工具，不修改音频 | 2026-08-26 由 `project-owner` 批准；system design 随后获批并开放 execution planning，不开放实现 |
| PROD-020 | 范围事件以两次左键选择严格向后的起止位置；`Esc`/空白右键取消；端点沿自适应网格；同 lane/inner class 不重叠，不自动合并 | 2026-08-26 由 `project-owner` 批准；更复杂范围语义继续由 PROD-019 跟踪 |

## Gate State

Analyzer-only readiness 已获批准，但 PROD-015 继续阻断正式上线。`project-owner` 于 2026-08-26 先批准 Editor E0 产品意图，随后明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”Editor 产品和 architecture 门禁据此关闭，delivery planning 已开放；planning 获批前 E1、依赖安装、Editor quality 与 release 仍未开放。现有 Analyzer architecture、delivery、quality 与 readiness 继续作为历史范围证据，不能代表 Editor。
