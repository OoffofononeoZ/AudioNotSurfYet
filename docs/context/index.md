---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-21
upstream_docs:
  - "AGENTS.md"
next_action: "M9 Header blur 与三类新卡已实现；运行 provisional、提交实现并执行 clean canonical"
---

# Repository Context Index

## Purpose

AudioNotSurfYet 当前是一个单仓库 Vue/Vite 浏览器前端：用户选择本地音频后，应用提供播放队列、元数据、进度与音量控制，并把实时能量用于 MusicBar 和背景可视化。已批准的产品方向是在这些基础上建设面向音频分析学习者的 Analyzer，把 Meyda 结果对应到歌曲具体时刻、听感和音色变化。

本目录维护仓库事实、边界和工作记忆；生命周期路由与通用方法由 [AGENTS.md](../../AGENTS.md) 负责。当前代码事实与目标架构必须区分：现状见 [system map](system-map.md)，批准的目标见 [system design](../architecture/system-design.md)。

## Current Stage

- Repository context：入口、决策注册表、system map、glossary 与 working agreements 均已批准。
- Product intent：problem brief、scope 和 success metrics 已由 `project-owner` 批准；开放问题只保留未来上传、未定义 Tab、托管和扩展研究等非当前门禁事项。
- System design：system design、接口契约、风险和五个 ADR 已批准。
- Execution planning：execution plan、acceptance criteria、test strategy 和 milestone plan 均为 approved。
- Quality and evals：M3–M8 的适用 canonical/人工证据已获批准；M8 clean canonical 28/28 与 Windows Chrome 界面稳定化结果已由 owner 签字。
- Implementation：M3–M8 已 `Complete`；M9 已按 owner 实施请求进入 `In Progress`，先执行非首页 Header blur，再交付三类 vector/waveform。
- Readiness、release、retrospective：`release-readiness.md` 等待 M11 执行证据，不创建 release 或 retrospective 文档。

## Key Documents

| Path | Purpose | Owner / status | Review trigger |
| --- | --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | 根工作指南和 Harness 门禁 | project-owner / active | 工作流、门禁、文档位置或跨阶段测试纪律变化 |
| [system-map.md](system-map.md) | 当前子系统、接口和外部依赖 | project-owner / approved | 当前代码边界变化 |
| [glossary.md](glossary.md) | 当前项目词汇与代码含义 | project-owner / approved | 术语、状态或类型含义变化 |
| [decision-registry.md](decision-registry.md) | 产品、架构和交付决策入口 | project-owner / approved | 形成、撤销或替代重要决策 |
| [working-agreements.md](working-agreements.md) | 本地开发、验证和 Git 约定 | project-owner / approved | 工具链或验证能力变化 |
| [problem-brief.md](../product/problem-brief.md) | 目标用户、问题和期望结果 | project-owner / approved | 目标用户或核心问题变化 |
| [scope.md](../product/scope.md) | 当前范围、纵向切片和非目标 | project-owner / approved | 能力、数据或兼容范围变化 |
| [success-metrics.md](../product/success-metrics.md) | 正确性、同步、响应和学习指标 | project-owner / approved | 阈值、样本或观测方法变化 |
| [open-questions.md](../product/open-questions.md) | 非当前门禁问题与已关闭决策 | project-owner / in-review | 新能力进入范围或 release 开始 |
| [system-design.md](../architecture/system-design.md) | 目标组件、数据流、失败和恢复 | project-owner / approved | 产品意图或核心系统边界变化 |
| [interface-contracts.md](../architecture/interface-contracts.md) | 内部 TypeScript 和 Worker/存储契约 | project-owner / approved | 消息、schema、身份或失败语义变化 |
| [risk-register.md](../architecture/risk-register.md) | 技术风险、触发器和缓解证据 | project-owner / approved | 每个里程碑及新高影响风险 |
| [execution-plan.md](../delivery/execution-plan.md) | Q0 与 M1–M11 实施顺序和门禁 | project-owner / approved | 范围、架构或任务依赖变化 |
| [acceptance-criteria.md](../delivery/acceptance-criteria.md) | 可测量验收与阈值 | project-owner / approved | 成功指标、容差或支持矩阵变化 |
| [test-strategy.md](../delivery/test-strategy.md) | 测试层级、fixture 和证据策略 | project-owner / approved | 工具、fixture 或验证能力变化 |
| [milestone-plan.md](../delivery/milestone-plan.md) | 相对目标、状态和退出证据 | project-owner / approved | 里程碑关闭或阻塞状态变化 |
| [eval-plan.md](../quality/eval-plan.md) | 七组评估、阈值、AC/risk 映射和证据缺口 | project-owner / approved | 验收、测试覆盖或风险变化 |
| [golden-examples.md](../quality/golden-examples.md) | 成功、失败、边界和异常黄金样例 | project-owner / approved | fixture、Meyda、参数或用户任务变化 |
| [failure-taxonomy.md](../quality/failure-taxonomy.md) | 稳定失败类型、S0–S3 和门禁响应 | project-owner / approved | 失败分类或风险接受规则变化 |
| [evidence-index.md](../quality/evidence-index.md) | M3–M11 canonical run 摘要、环境、hash 和 reviewer | project-owner / in-review | 新 run、artifact retention 或里程碑审批 |

## Architecture Decisions

- [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md)：单一 AudioEngine 与共享 session state。
- [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md)：Worker 全曲分析、取消与 stale 隔离。
- [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md)：IndexedDB 文件句柄和当前 Blob 混合恢复。
- [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md)：类型化特征注册表和 Canvas 2D renderer family。
- [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md)：项目 Flux v1 与零能量标量语义。

## Repository Areas

| Area | Current role | Target/change source |
| --- | --- | --- |
| `src/views/` | 路由页面；Analyzer 以四槽共享时间轴承载默认三卡，并可从 M9 累计 19 项选择最多四张 | system design + M7–M9 |
| `src/layouts/` | Header、页面内容与 MusicBar 的共享外壳 | M4/M7 回归 |
| `src/components/` | 播放 UI、列表、动画及 Canvas/WebGL 可视化 | ADR-0001/0004 |
| `src/audio/` | 单一 AudioEngine 与 MainLayout-owned AudioSessionService；文件句柄导入与恢复编排 | ADR-0001/0003 |
| `src/analysis/` | FeatureRegistry、config identity、PCM/frame、codec、Worker/coordinator、共享时间轴，以及 M9 累计 19 项/项目 Flux/scalar/vector/waveform renderer 数据 | ADR-0002/0004/0005；M6–M9 |
| `src/persistence/` | 原生 IndexedDB V1 SessionRepository 与 runtime validator | ADR-0003；M5 |
| `src/stores/` | 持久化 config 与可序列化 audioSessionStore/恢复/analysis 状态 | ADR-0001/0002/0003 |
| `src/utils/` | 事件总线与纯工具函数 | 实现时按实际边界维护 |
| `src/data/` | `analyzerData.ts` 的 21 项 Meyda 说明，由 M6 registry 穷尽映射 | M6 FeatureRegistry |
| `tests/` | M3–M9 本地测试、fixture、golden、浏览器 harness 和 eval runner | [tests README](../../tests/README.md) |
| `skills/audio-visualizer-dev/` | 本项目开发、验证和文档路由 Skill | [SKILL.md](../../skills/audio-visualizer-dev/SKILL.md) |

## Lifecycle Entry Points

- Product intent：[problem brief](../product/problem-brief.md)
- System design：[system design](../architecture/system-design.md)
- Delivery planning：[execution plan](../delivery/execution-plan.md)
- Quality design：[eval plan](../quality/eval-plan.md)，Q0 批准后用于 M3–M11 证据
- Quality evidence：[evidence index](../quality/evidence-index.md)，M3–M8 已批准
- Quality readiness：`docs/quality/release-readiness.md` 尚未创建；M11 证据完成后生成
- Release operations：`docs/release/` 尚未创建；release readiness 证据存在后生成
- Retrospectives：`docs/retrospectives/` 尚未创建；有发布、事故或重复摩擦证据后生成

## Current Known Gaps

- M8 已实现四槽最多四张、累计 16 项、通用 scalar renderer、项目 Flux、零能量 0 与 UI hardening；clean canonical 与 Windows Chrome/owner 审批均已完成。
- M9 已实现首页透明/非首页 Header blur、Power Spectrum、MFCC 与 Buffer，使 UI/Worker 累计开放 19 项；provisional 与 clean canonical 尚未执行，因此 M9 仍为 `In Progress`。
- 当前 Meyda `spectralFlux` 对有效输入仍抛出 `x is not defined`；产品已按 ADR-0005 实现并由 canonical 缓解 R-020，不得声称上游缺陷已修复。
- 超出约 15 分钟支持边界的长音频未开始播放只作为非门禁压力观察；它不表示长音频被规定为必须失败，也不改变当前产品范围。
- 当前机器尚未发现 Edge；没有真实 Edge 证据时不能完成 M11 双浏览器门禁。
- 正式托管平台和生产 URL 尚未决定；它们只阻断未来 release，不阻断 M3。
- 详细 context 文档的长期 owner/review cadence 尚未全部统一；代码改动时必须同步修正事实。
- 工程事实差异继续记录在 [Skill 项目差异](../../skills/audio-visualizer-dev/references/99-open-questions-and-project-deltas.md)，产品开放项见 [open questions](../product/open-questions.md)。

## Approval Record

`project-owner` 于 2026-07-24 批准了产品、架构和原执行计划，并随后要求增加 Q0 质量设计；又于 2026-07-28 明确批准三份 Q0 质量文档及两份 delivery 修订。Q0 批准只开放 M3，不代表代码实现、质量执行或 readiness 已经完成。

2026-07-28，M3 canonical run 在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过并产生正式 evidence index；该事实本身不等同于批准，批准记录如下。

`project-owner` 于 2026-07-28 明确批准 M3 evidence index 与 working agreements。M3 改为 `Complete`，当前阶段切换为已开放的 M4。

同日，M4 dirty-worktree provisional suite 通过；该结果只用于实现反馈，未追加正式 evidence index，也未关闭 M4。

2026-07-29，M4 canonical suite 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过并追加到 evidence index；`project-owner` 随后明确批准 M4 evidence 与 working agreements。M4 改为 `Complete`，当前阶段切换到 M5；该批准不包含未来 M5 evidence。

同日，M5 dirty-worktree provisional suite 16/16 通过。该结果不绑定 M5 提交，不追加正式 evidence；原生权限人工检查、clean-commit canonical 和 owner 审批仍未完成。

随后 M5 canonical suite 在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上 16/16 通过并追加到 evidence index。`project-owner` 于 2026-07-29 确认 Chrome 原生权限人工检查通过，并明确批准 M5 evidence 与 working agreements。M5 改为 `Complete`，M6 门禁开放但尚未开始实现；超范围长音频未开始播放作为非门禁观察保留。

同日，owner 要求按详细计划执行 M6。产品源码、专项 Vitest/Playwright 和 eval runner 已进入工作树；dirty-worktree provisional 20/20 通过，但当时仍需用户提交后的 clean-commit canonical、正式 evidence index 与 owner 审批。

2026-07-30，M6 canonical run `M6-2026-07-30T02-19-07-149Z-a39256ff` 在 clean commit `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` 上 20/20 通过，summary SHA-256 为 `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae`。`project-owner` 随后明确批准 M6 canonical evidence、working agreements、system map 与 glossary，并同意将 M6 标记为 `Complete`、开放 M7；M7 在明确开始实现前保持 `Planned`。

同日，`project-owner` 明确要求实施 M7 三卡学习切片。M7 据此进入 `In Progress`，固定四槽但最多三张获准活动卡；M8 仍为 `Planned`。

随后 M7 dirty-worktree provisional run `M7-2026-07-30T03-13-53-844Z-5b33575f-provisional` 24/24 通过，summary SHA-256 为 `5f49ad1d18c1c5f8096beef53a6122f242bae361b76dcbe2f9d718698e663504`。该结果只作实现反馈；M7 仍需 clean-commit canonical、正式 `in-review` evidence 与 owner 学习任务。

首次 clean run `M7-2026-07-30T03-21-14-150Z-28fc4699` 因跨进程固定 550ms exact-cursor 计时断言误判而失败；修复页面内真实时间窗断言并把 cadence 调整为 40ms 后，canonical run `M7-2026-07-30T03-30-43-095Z-f022b86e` 在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过，summary SHA-256 为 `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32`。正式记录为 `in-review`；M7 仍等待 owner 操作与 3/3 学习解释，M8 保持 `Planned`。

2026-08-21，owner 确认 M7 卡片选择/替换、zoom/pan、鼠标与键盘 seek、刷新恢复均通过，提交 3/3 正确学习解释并明确批准 M7 canonical evidence。M7 据此改为 `Complete`，M8 门禁开放；owner 同时批准 ADR-0005 和 M8 完整实施计划，M8 改为 `In Progress`。

同日，M8 provisional 与 clean canonical 均 28/28 通过；clean run `M8-2026-08-21T03-23-18-552Z-d6dcf715` 绑定 commit `d6dcf715be2e6675224f079b954e2b1b544bbebd`，summary SHA-256 为 `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef`。正式 evidence 为 `in-review`；Windows Chrome pressed 补偿验证和 owner 批准前 M8 保持 `In Progress`、M9 保持 `Planned`。

随后 `project-owner` 明确批准 M8 canonical evidence 与界面稳定化结果，同意将 M8 标记为 `Complete` 并开放 M9。本批准作为 Windows Chrome 补偿门禁的 owner 签字，不增加新的自动化测量；M9 在明确开始实现前保持 `Planned`。

同次请求中，owner 明确要求实施 M9 完整计划，并新增“首页 Header 透明、其余路由使用 18px backdrop blur”的 Slice 0。M9 据此进入 `In Progress`；该样式变更不修改 M8 canonical 身份。
