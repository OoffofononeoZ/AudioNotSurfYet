---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-28
upstream_docs:
  - "AGENTS.md"
next_action: "由 project-owner 审阅 M3 evidence index 与 working agreements；批准后关闭 M3 并开放 M4"
---

# Repository Context Index

## Purpose

AudioNotSurfYet 当前是一个单仓库 Vue/Vite 浏览器前端：用户选择本地音频后，应用提供播放队列、元数据、进度与音量控制，并把实时能量用于 MusicBar 和背景可视化。已批准的产品方向是在这些基础上建设面向音频分析学习者的 Analyzer，把 Meyda 结果对应到歌曲具体时刻、听感和音色变化。

本目录维护仓库事实、边界和工作记忆；生命周期路由与通用方法由 [AGENTS.md](../../AGENTS.md) 负责。当前代码事实与目标架构必须区分：现状见 [system map](system-map.md)，批准的目标见 [system design](../architecture/system-design.md)。

## Current Stage

- Repository context：入口与决策注册表已更新；working agreements 因写入 M3 真实工具事实处于 `in-review`，system map 和 glossary 仍为 `draft`。
- Product intent：problem brief、scope 和 success metrics 已由 `project-owner` 批准；开放问题只保留未来上传、未定义 Tab、托管和扩展研究等非当前门禁事项。
- System design：system design、接口契约、风险和四个 ADR 已批准。
- Execution planning：execution plan、acceptance criteria、test strategy 和 milestone plan 均为 approved。
- Quality and evals：eval plan、golden examples、failure taxonomy 已由 `project-owner` 批准；首条 M3 canonical evidence 已生成并处于 `in-review`，完整 eval 仍未完成。
- Implementation：M3 测试基础和 fixture 已在 clean commit 上通过 canonical run，当前等待 evidence review；M4 尚未开放。
- Readiness、release、retrospective：`release-readiness.md` 等待 M11 执行证据，不创建 release 或 retrospective 文档。

## Key Documents

| Path | Purpose | Owner / status | Review trigger |
| --- | --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | 根工作指南和 Harness 门禁 | project-owner / active | 工作流、门禁、文档位置或跨阶段测试纪律变化 |
| [system-map.md](system-map.md) | 当前子系统、接口和外部依赖 | unknown / draft | 当前代码边界变化 |
| [glossary.md](glossary.md) | 当前项目词汇与代码含义 | unknown / draft | 术语、状态或类型含义变化 |
| [decision-registry.md](decision-registry.md) | 产品、架构和交付决策入口 | project-owner / approved | 形成、撤销或替代重要决策 |
| [working-agreements.md](working-agreements.md) | 本地开发、验证和 Git 约定 | project-owner / in-review | 工具链或验证能力变化 |
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

## Repository Areas

| Area | Current role | Target/change source |
| --- | --- | --- |
| `src/views/` | 路由页面；Analyzer 当前主要是静态特征目录 | system design + M7 |
| `src/layouts/` | Header、页面内容与 MusicBar 的共享外壳 | M4/M7 回归 |
| `src/components/` | 播放 UI、列表、动画及 Canvas/WebGL 可视化 | ADR-0001/0004 |
| `src/audio/` | 当前 Web Audio 播放、时域/频域接口 | M4 单一 AudioEngine |
| `src/stores/` | 当前配置与共享音频能量 | M4 audioSessionStore |
| `src/utils/` | 事件总线与纯工具函数 | 实现时按实际边界维护 |
| `src/data/` | `analyzerData.ts` 的 21 项 Meyda 说明 | M6 FeatureRegistry |
| `tests/` | M3 本地测试、fixture、golden、浏览器 harness 和 eval runner | [tests README](../../tests/README.md) |
| `skills/audio-visualizer-dev/` | 本项目开发、验证和文档路由 Skill | [SKILL.md](../../skills/audio-visualizer-dev/SKILL.md) |

## Lifecycle Entry Points

- Product intent：[problem brief](../product/problem-brief.md)
- System design：[system design](../architecture/system-design.md)
- Delivery planning：[execution plan](../delivery/execution-plan.md)
- Quality design：[eval plan](../quality/eval-plan.md)，Q0 批准后用于 M3–M11 证据
- Quality evidence：[evidence index](../quality/evidence-index.md)，首条 M3 canonical run 等待 owner 审阅
- Quality readiness：`docs/quality/release-readiness.md` 尚未创建；M11 证据完成后生成
- Release operations：`docs/release/` 尚未创建；release readiness 证据存在后生成
- Retrospectives：`docs/retrospectives/` 尚未创建；有发布、事故或重复摩擦证据后生成

## Current Known Gaps

- M3 canonical run 已通过并关闭 EG-001/EG-002，但 evidence index 和 working agreements 尚待 `project-owner` 审批；M3 仍为 `In Review`。
- 当前实现尚未完成 AudioEngine/store 分离、IndexedDB 恢复、Worker 全曲分析或共享四卡时间轴。
- 当前机器尚未发现 Edge；没有真实 Edge 证据时不能完成 M11 双浏览器门禁。
- 正式托管平台和生产 URL 尚未决定；它们只阻断未来 release，不阻断 M3。
- 详细 context 文档的长期 owner/review cadence 尚未全部统一；代码改动时必须同步修正事实。
- 工程事实差异继续记录在 [Skill 项目差异](../../skills/audio-visualizer-dev/references/99-open-questions-and-project-deltas.md)，产品开放项见 [open questions](../product/open-questions.md)。

## Approval Record

`project-owner` 于 2026-07-24 批准了产品、架构和原执行计划，并随后要求增加 Q0 质量设计；又于 2026-07-28 明确批准三份 Q0 质量文档及两份 delivery 修订。Q0 批准只开放 M3，不代表代码实现、质量执行或 readiness 已经完成。

2026-07-28，M3 canonical run 在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过并产生正式 evidence index。该事实不等同于 M3 已获批准；当前仍等待 `project-owner` review。
