---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-14
upstream_docs:
  - "AGENTS.md"
next_action: "旧设计资料已移至本地 trash 并停止引用；后续设计方向由 owner 另行确定"
---

# Repository Context Index

## Purpose

AudioNotSurfYet 当前是一个单仓库 Vue/Vite 浏览器前端。Editor E1–E9 canonical 与适用人工门禁均已获批准并关闭；E10 已由 DEC-057/ADR-0022 打开，增加单 lane/class 的小节批量选择、原子复制/移动和深色站内离页 dialog。E9 revised 29/29 canonical 保持历史身份，原 Editor readiness 候选只保留为 `pre-E10`。Analyzer M14 和 Visualizer V1–V6 的已批准基线不变。

DEC-058/ADR-0023 另把 Visualizer 原生全屏登记为 post-V6 readiness 修订：只复用同一预览与 transport，不创建 V7。原 Visualizer candidate 标为 `pre-fullscreen`；本轮只做可运行门禁，交互与视觉由 owner 自行审阅。

DEC-059/DEC-061 对应的旧设计指导和交付计划已归档，停止作为后续设计任务的依据。已经实现的样式仍是当前代码事实；新的设计方向由 owner 另行确定。

本目录维护仓库事实、边界和工作记忆；生命周期路由与通用方法由 [AGENTS.md](../../AGENTS.md) 负责。当前代码事实与目标架构必须区分：现状见 [system map](system-map.md)，批准的目标见 [system design](../architecture/system-design.md)。

## Current Stage

- Repository context：入口、决策注册表、system map、glossary 与 working agreements 均已批准。
- Product intent：Analyzer/Editor 历史范围与 Visualizer V0 均已批准；PROD-014V 已关闭，PROD-022 保留为非阻断未来问题。
- System design：Analyzer、Visualizer 与 Editor E1–E9 设计保持已批准基线；ADR-0019 保留删除语义，ADR-0020 的紧凑 BPM 标记条已获实现与人工门禁批准，不升级 JSON V1。
- Execution planning：M1–M14、Editor E0-D/E1–E9、Visualizer V0-D/V1–V6 均为 `Complete`。
- Quality and evals：M3–M14、Editor E1–E9 与 Visualizer V1–V6 evidence 均已批准；E9 revised run `E9-2026-09-04T03-51-33-088Z-13614673` 为 29/29、`approved`，首个 run `E9-2026-09-04T02-49-18-960Z-cf0a79b1` 保持 `pre-revision`。
- Implementation：Editor E9 的删除、三级展示、28px 紧凑 BPM 标记条和标记修订已在 commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 实现并通过 revised canonical。E8 与 Visualizer V1–V6 保持已完成。post-V6 viewport 修订已在 clean commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 通过 Chrome/Edge 专项。
- Design remake：旧设计资料已在本地归档，相关历史仍可由 Git 记录追溯；后续视觉方向待 owner 确定。
- Readiness、release、retrospective：Analyzer M14 为 `Ready with waivers`；Editor 已获准进入独立 release-readiness 评审；PROD-015 仍阻断上线。

## Key Documents

| Path | Purpose | Owner / status | Review trigger |
| --- | --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | 根工作指南和 Harness 门禁 | project-owner / active | 工作流、门禁、文档位置或跨阶段测试纪律变化 |
| [system-map.md](system-map.md) | 当前子系统、接口和外部依赖 | project-owner / approved | 当前代码边界变化 |
| [glossary.md](glossary.md) | 当前项目词汇与代码含义 | project-owner / approved | 术语、状态或类型含义变化 |
| [decision-registry.md](decision-registry.md) | 产品、架构和交付决策入口 | project-owner / approved | 形成、撤销或替代重要决策 |
| [working-agreements.md](working-agreements.md) | 本地开发、验证和 Git 约定 | project-owner / approved | 工具链或验证能力变化 |
| [problem-brief.md](../product/problem-brief.md) | Analyzer/Editor 历史意图与获批 Visualizer V0 用户、问题和结果 | project-owner / approved | Visualizer 目标用户或核心问题变化 |
| [scope.md](../product/scope.md) | Analyzer/Editor 历史边界与获批 Visualizer 单场景、0–4 特征、两个模板和 WebM 路线 | project-owner / approved | Visualizer 能力、数据或兼容范围变化 |
| [success-metrics.md](../product/success-metrics.md) | 历史指标与获批 Visualizer 绑定、场景、同步、录制和资源目标 | project-owner / approved | Visualizer 阈值、样本或观测方法变化 |
| [open-questions.md](../product/open-questions.md) | PROD-014V 已关闭、PROD-022 四特征未来复核及其他开放问题 | project-owner / approved | 新能力进入范围或 release 开始 |
| [system-design.md](../architecture/system-design.md) | Analyzer/Editor 历史基线与 Visualizer runtime/project/scene/recording 目标架构 | project-owner / approved | Visualizer 核心系统边界变化 |
| [interface-contracts.md](../architecture/interface-contracts.md) | Analyzer/Editor 历史契约与 Visualizer route lease、project/binding、scene、recording 接口 | project-owner / approved | Visualizer 消息、schema、身份或失败语义变化 |
| [Visualizer Project V1](../architecture/visualizer/project-format-v1.md) | strict JSON、歌曲 identity、Editor snapshot、单草稿与原子导入 | project-owner / approved | Visualizer schema、草稿数量、快照或兼容策略变化 |
| [Visualizer binding and scenes](../architecture/visualizer/binding-and-scene-contracts.md) | 受控 binding、四特征 planner、绝对时间确定性、双模板与单 RendererHost | project-owner / approved | source/projection、特征上限、模板或 renderer ownership 变化 |
| [Visualizer recording](../architecture/visualizer/recording-contract.md) | pre-Gain audio tap、严格预设、MediaRecorder 状态机与 WebM 生命周期 | project-owner / approved | 录制音量、codec、preset、状态机或保存边界变化 |
| [Editor Project V1](../architecture/editor/project-format-v1.md) | JSON schema、validator、歌曲 identity、codec 与独立 draft DB | project-owner / approved | 工程字段、时间、格式、身份或草稿策略变化 |
| [Editor interactions](../architecture/editor/interaction-contracts.md) | tempo/grid、pointer/keyboard、point/range 和 overlay 状态机 | project-owner / approved | 手势、吸附、重叠、DOM/Canvas 或键盘规则变化 |
| [risk-register.md](../architecture/risk-register.md) | Analyzer/Editor 历史风险与 Visualizer R-034–R-041 | project-owner / approved | Visualizer 每个里程碑及新高影响风险 |
| [execution-plan.md](../delivery/execution-plan.md) | Q0、M1–M14 实施顺序和门禁 | project-owner / approved | 范围、架构或任务依赖变化 |
| [acceptance-criteria.md](../delivery/acceptance-criteria.md) | 可测量验收与阈值 | project-owner / approved | 成功指标、容差或支持矩阵变化 |
| [test-strategy.md](../delivery/test-strategy.md) | 测试层级、fixture 和证据策略 | project-owner / approved | 工具、fixture 或验证能力变化 |
| [milestone-plan.md](../delivery/milestone-plan.md) | 相对目标、状态和退出证据 | project-owner / approved | 里程碑关闭或阻塞状态变化 |
| [Editor execution plan](../delivery/editor/execution-plan.md) | E1–E9 实施顺序、固定参数和逐里程碑证据节奏 | project-owner / approved | Editor 范围、架构、切片或依赖变化 |
| [Editor acceptance criteria](../delivery/editor/acceptance-criteria.md) | AC-E101–AC-E905、阈值、证据方法和风险映射 | project-owner / approved | Editor 指标、容差、容量或支持矩阵变化 |
| [Editor test strategy](../delivery/editor/test-strategy.md) | E1–E9 测试层级、fixture、浏览器、性能与 evidence cadence | project-owner / approved | 测试工具、fixture、浏览器或证据能力变化 |
| [Editor milestone plan](../delivery/editor/milestone-plan.md) | E0-D 与 E1–E9 状态、依赖和退出清单 | project-owner / approved | 里程碑关闭、阻塞或开放状态变化 |
| [Visualizer execution plan](../delivery/visualizer/execution-plan.md) | V1–V6 切片、固定参数、证据节奏与范围控制 | project-owner / approved | Visualizer 范围、架构、切片或依赖变化 |
| [Visualizer acceptance criteria](../delivery/visualizer/acceptance-criteria.md) | AC-V101–AC-V607、阈值、证据方法和 R-034–R-041 映射 | project-owner / approved | Visualizer 指标、阈值、preset 或支持矩阵变化 |
| [Visualizer test strategy](../delivery/visualizer/test-strategy.md) | V1–V6 测试层级、fixture、Chrome/Edge、WebM 与资源策略 | project-owner / approved | 测试工具、fixture、浏览器或证据能力变化 |
| [Visualizer milestone plan](../delivery/visualizer/milestone-plan.md) | V0-D 与 V1–V6 状态、依赖、阻塞和退出证据 | project-owner / approved | 里程碑开放、关闭或 blocked 状态变化 |
| [Visualizer V1 eval plan](../quality/visualizer/eval-plan.md) | AC-V101–AC-V108 的 route、lease、project、draft、layout 与 resource 契约 | project-owner / approved | V1 行为、阈值、浏览器或证据能力变化 |
| [Visualizer V1 golden](../quality/visualizer/golden-examples.md) | 默认/完整/无效工程、lease、草稿和 breakpoint 规范样例 | project-owner / approved | V1 schema、identity、布局或恢复语义变化 |
| [Visualizer V1 failure taxonomy](../quality/visualizer/failure-taxonomy.md) | route、lease、project、draft、file、layout、resource 失败分类 | project-owner / approved | V1 失败域或严重度响应变化 |
| [Visualizer V2 eval plan](../quality/visualizer/v2-eval-plan.md) | AC-V201–AC-V208 的 inspector、projection、planner、Editor snapshot 与 resolver 契约 | project-owner / approved | V2 行为、算法、阈值或证据能力变化 |
| [Visualizer V2 golden](../quality/visualizer/v2-golden-examples.md) | 0–4、21 项 projection、point/range、stale 与 deterministic hash 规范样例 | project-owner / approved | V2 fixture、默认映射或时间语义变化 |
| [Visualizer V2 failure taxonomy](../quality/visualizer/v2-failure-taxonomy.md) | inspector、planner、projection、snapshot、transform、determinism 与 resource 分类 | project-owner / approved | V2 失败域或严重度响应变化 |
| [Visualizer V3 eval plan](../quality/visualizer/v3-eval-plan.md) | AC-V301–AC-V305 的 Orthogonal Lines、单 RendererHost、确定性余辉与错误隔离契约 | project-owner / approved | V3 映射、余辉、host、阈值或证据能力变化 |
| [Visualizer V3 golden](../quality/visualizer/v3-golden-examples.md) | 横竖映射、point/range、decay、seek/hash、DPR、切换与重试规范样例 | project-owner / approved | V3 fixture、scene state、checkpoint 或视觉映射变化 |
| [Visualizer V3 failure taxonomy](../quality/visualizer/v3-failure-taxonomy.md) | mapping、trail、determinism、host、switch、scene、responsive 与 performance 分类 | project-owner / approved | V3 失败域或严重度响应变化 |
| [Visualizer V4 eval plan](../quality/visualizer/v4-eval-plan.md) | AC-V401–AC-V406 的核心环、默认两项分析、确定性积分、资源与 context recovery 契约 | project-owner / approved | V4 映射、积分、context、阈值或证据能力变化 |
| [Visualizer V4 golden](../quality/visualizer/v4-golden-examples.md) | 64-band 核心、seed 外围、三卫星、默认绑定、hash、context 与响应式规范样例 | project-owner / approved | V4 fixture、state、checkpoint、几何或默认绑定变化 |
| [Visualizer V4 failure taxonomy](../quality/visualizer/v4-failure-taxonomy.md) | default、core、rise、orbit、determinism、resource、context 与 performance 分类 | project-owner / approved | V4 失败域或严重度响应变化 |
| [Visualizer V5 eval plan](../quality/visualizer/v5-eval-plan.md) | AC-V501–AC-V509 的 pre-Gain、MediaRecorder、保存、双浏览器与媒体阈值 | project-owner / approved | V5 状态机、preset、阈值或证据能力变化 |
| [Visualizer V5 golden](../quality/visualizer/v5-golden-examples.md) | 3 秒 A/V fixture、准备回滚、命令锁、abort、save 与 lifecycle 规范样例 | project-owner / approved | V5 fixture、恢复、离页或媒体事实变化 |
| [Visualizer V5 failure taxonomy](../quality/visualizer/v5-failure-taxonomy.md) | tap、capability、preflight、sequence、abort、container、sync 与 resource 分类 | project-owner / approved | V5 失败域或严重度响应变化 |
| [Visualizer V6 eval plan](../quality/visualizer/v6-eval-plan.md) | AC-V601–AC-V607 的三格式、双浏览器、长时压力、资源与 54 步 canonical 契约 | project-owner / approved | V6 压力工程、资源阈值、浏览器或证据能力变化 |
| [Visualizer V6 golden](../quality/visualizer/v6-golden-examples.md) | 四特征切换、三格式、20 次生命周期、六文件与故障矩阵规范样例 | project-owner / approved | V6 fixture、binding、生命周期或媒体事实变化 |
| [Visualizer V6 failure taxonomy](../quality/visualizer/v6-failure-taxonomy.md) | format、binding、clock、resource、recovery、a11y、media 与 evidence 分类 | project-owner / approved | V6 失败域或严重度响应变化 |
| [Visualizer evidence index](../quality/visualizer/evidence-index.md) | V1–V6 canonical 身份、hash、环境和 reviewer 记录 | project-owner / approved | 新 Visualizer run、artifact 或审批状态变化 |
| [Visualizer viewport scroll eval](../quality/visualizer/viewport-scroll-eval-plan.md) | post-V6 一屏工作台、独立侧栏滚动与共享 scrollbar 契约 | project-owner / approved | 支持断点、滚动所有权或共享样式变化 |
| [Visualizer viewport scroll golden](../quality/visualizer/viewport-scroll-golden-examples.md) | 页面无纵向滚动、双侧隔离、compact drawer 与样式复用样例 | project-owner / approved | 几何、溢出或样式 token 变化 |
| [Visualizer viewport scroll failure taxonomy](../quality/visualizer/viewport-scroll-failure-taxonomy.md) | viewport、scroll ownership、scroll chaining、style drift 与 regression 分类 | project-owner / approved | failure 域、严重度或响应变化 |
| [Visualizer release readiness](../quality/visualizer/release-readiness.md) | V1–V6 已批准基线与 DEC-050 修订状态 | project-owner / in-review | 修订 evidence、waiver、PROD-015 或 owner 结论变化 |
| [eval-plan.md](../quality/eval-plan.md) | M3–M14 评估、FIFO/order/geometry/lifecycle 门禁与 canonical 规则 | project-owner / approved | 验收、测试覆盖或风险变化 |
| [golden-examples.md](../quality/golden-examples.md) | 成功、失败、边界和异常黄金样例 | project-owner / approved | fixture、Meyda、参数或用户任务变化 |
| [failure-taxonomy.md](../quality/failure-taxonomy.md) | 稳定失败类型、S0–S3、M14 order/pointer/a11y/persistence 失败和门禁响应 | project-owner / approved | 失败分类或风险接受规则变化 |
| [evidence-index.md](../quality/evidence-index.md) | M3–M13 历史 canonical 与当前 M14 19/19 record | project-owner / approved | 新 run、artifact retention 或里程碑审批 |
| [release-readiness.md](../quality/release-readiness.md) | M14 Ready with waivers 与 PROD-015 上线边界 | project-owner / approved | 候选代码、证据、风险接受或部署边界变化 |
| [Editor E1 eval plan](../quality/editor/eval-plan.md) | AC-E101–AC-E108 的成功、失败、边界、异常与 canonical 契约 | project-owner / approved | E1 行为、阈值、浏览器或证据能力变化 |
| [Editor E1 golden examples](../quality/editor/golden-examples.md) | JSON、identity、lease、草稿和文件异常规范样例 | project-owner / approved | E1 schema、identity 或恢复语义变化 |
| [Editor E1 failure taxonomy](../quality/editor/failure-taxonomy.md) | Editor 路由、lease、schema、草稿、文件和生命周期失败分类 | project-owner / approved | Editor 失败域或严重度响应变化 |
| [Editor evidence index](../quality/editor/evidence-index.md) | E1–E9 canonical 身份、hash、环境与 reviewer 记录 | project-owner / approved | 新 Editor run、artifact 或审批状态变化 |
| [Editor release readiness](../quality/editor/release-readiness.md) | 固定 E9 runtime candidate、24 步审计与 W-ED-001–W-ED-006 审批边界 | project-owner / in-review | 候选 identity、审计结果、waiver 或 owner 结论变化 |
| [Editor E2 eval plan](../quality/editor/e2-eval-plan.md) | AC-E201–AC-E206 的 geometry、tempo、BPM、竞态与回归契约 | project-owner / approved | E2 行为、阈值、算法或证据能力变化 |
| [Editor E2 golden examples](../quality/editor/e2-golden-examples.md) | viewport、tempo map、BPM reliable/low-confidence 规范样例 | project-owner / approved | E2 fixture、拍号、阈值或边界语义变化 |
| [Editor E2 failure taxonomy](../quality/editor/e2-failure-taxonomy.md) | E2 geometry、pointer、tempo、estimator 和 consumer 失败分类 | project-owner / approved | E2 失败域或严重度响应变化 |
| [Editor E3 eval plan](../quality/editor/e3-eval-plan.md) | AC-E301–AC-E306 的 lane、snapping、point、pointer、DOM 与回归契约 | project-owner / approved | E3 point 行为、阈值或证据能力变化 |
| [Editor E3 golden examples](../quality/editor/e3-golden-examples.md) | point/class/migration、1/16–1 beat、键盘、可见 DOM 与 range 保留样例 | project-owner / approved | E3 fixture、交互或边界语义变化 |
| [Editor E3 failure taxonomy](../quality/editor/e3-failure-taxonomy.md) | E3 lane、migration、snap、point、focus 与 visible DOM 失败分类 | project-owner / approved | E3 失败域或严重度响应变化 |
| [Editor E4 eval plan](../quality/editor/e4-eval-plan.md) | AC-E401–AC-E405 的 renderer、consumer、bounds、hit-test、cursor 与 isolation 契约 | project-owner / approved | E4 feature、renderer、交互或证据能力变化 |
| [Editor E4 golden examples](../quality/editor/e4-golden-examples.md) | 21 项、Buffer 去重、三手柄、穿透、stale、错误隔离与恢复样例 | project-owner / approved | E4 fixture、geometry 或错误语义变化 |
| [Editor E4 failure taxonomy](../quality/editor/e4-failure-taxonomy.md) | E4 renderer、consumer、bounds、hit、cursor 与 isolation 失败分类 | project-owner / approved | E4 失败域或严重度响应变化 |
| [Editor E5 eval plan](../quality/editor/e5-eval-plan.md) | AC-E501–AC-E505 的 range state、interval、overlap、handle、persistence 与 regression 契约 | project-owner / approved | E5 交互、fixture、阈值或证据能力变化 |
| [Editor E5 golden examples](../quality/editor/e5-golden-examples.md) | 两阶段创建、半开相邻、重叠矩阵、端点、迁移、round-trip 与 overlay 穿透样例 | project-owner / approved | E5 fixture、范围或交互语义变化 |
| [Editor E5 failure taxonomy](../quality/editor/e5-failure-taxonomy.md) | E5 range lane/state/interval/overlap/handle/persistence 失败分类 | project-owner / approved | E5 失败域或严重度响应变化 |
| [Editor E6 eval plan](../quality/editor/e6-eval-plan.md) | AC-E601–AC-E606 的双浏览器、三格式、10,000 事件、性能、资源、无障碍与 canonical 契约 | project-owner / approved | E6 历史身份或批准边界变化 |
| [Editor E6 golden examples](../quality/editor/e6-golden-examples.md) | 三格式、native flow、压力、DOM、资源、geometry、键盘与证据身份样例 | project-owner / approved | E6 fixture 或批准边界变化 |
| [Editor E6 failure taxonomy](../quality/editor/e6-failure-taxonomy.md) | E6 browser/format、native、stress、performance、resource、a11y 与 evidence 失败分类 | project-owner / approved | E6 失败域或严重度响应变化 |
| [Editor E7 eval plan](../quality/editor/e7-eval-plan.md) | AC-E701–AC-E708 的紧凑密度、全屏浮层、visibility、响应式与 46 步 canonical 契约 | project-owner / approved | E7 布局、浮层、阈值或证据能力变化 |
| [Editor E8 eval plan](../quality/editor/e8-eval-plan.md) | AC-E801–AC-E805 的时间轴、恢复、marker 几何与 scoped/canonical 契约 | project-owner / approved | E8 高度、恢复、几何、浏览器或证据能力变化 |
| [Editor E8 golden examples](../quality/editor/e8-golden-examples.md) | 四视口波形、同/异歌恢复与 marker 中心规范样例 | project-owner / approved | E8 输入、结果、容差或 fixture 变化 |
| [Editor E8 failure taxonomy](../quality/editor/e8-failure-taxonomy.md) | E8 恢复竞态、几何、裁切、可访问性与回归失败分类 | project-owner / approved | E8 失败域、严重度或响应变化 |
| [Editor E7 golden examples](../quality/editor/e7-golden-examples.md) | 双层工具栏、平面分区、行高、波形、多视口与任务回归样例 | project-owner / approved | E7 golden、断点或视觉令牌变化 |
| [Editor E7 failure taxonomy](../quality/editor/e7-failure-taxonomy.md) | E7 density、overflow、geometry、interaction 与 resource 失败分类 | project-owner / approved | E7 失败域或严重度响应变化 |

## Architecture Decisions

- [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md)：单一 AudioEngine 与共享 session state。
- [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md)：Worker 全曲分析、取消与 stale 隔离。
- [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md)：IndexedDB 文件句柄和当前 Blob 混合恢复。
- [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md)：类型化特征注册表和 Canvas 2D renderer family。
- [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md)：项目 Flux v1 与零能量标量语义。
- [ADR-0006](../architecture/adrs/0006-editor-runtime-leases.md)：Editor route-scoped playback/analysis lease 与单 engine/Worker。
- [ADR-0007](../architecture/adrs/0007-editor-project-and-draft-boundary.md)：版本化 JSON、歌曲 hash 和独立单草稿边界。
- [ADR-0008](../architecture/adrs/0008-editor-time-and-event-model.md)：秒数事实、tempo 派生网格与 point/range 状态机。
- [ADR-0009](../architecture/adrs/0009-editor-overlay-renderer-boundary.md)：共享 renderer adapter 与 pointer-through overlay。
- [ADR-0010](../architecture/adrs/0010-editor-compact-workbench.md)：Editor 紧凑双层工具栏、平面细线分区与响应式密度令牌。
- [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md)：Editor 窗口级全屏灰色浮层、复合入口、按歌曲 visibility 与 Buffer-only 关闭状态。
- [ADR-0012](../architecture/adrs/0012-analyzer-all-cards-fifo-active-analysis.md)：Analyzer 21 张稳定折叠卡、最多四项 FIFO 与 V1 carrier。
- [ADR-0013](../architecture/adrs/0013-analyzer-accessible-card-reordering.md)：Analyzer 自定义顺序、可访问排序与 V1 optional field。
- [ADR-0014](../architecture/adrs/0014-visualizer-runtime-leases.md)：Visualizer route playback/analysis lease 与单 engine/Worker。
- [ADR-0015](../architecture/adrs/0015-visualizer-project-and-binding-boundary.md)：strict JSON、同歌 Editor 快照、单草稿与非可执行 binding。
- [ADR-0016](../architecture/adrs/0016-deterministic-scene-registry.md)：双模板 registry、单 RendererHost 与绝对时间确定性。
- [ADR-0017](../architecture/adrs/0017-realtime-webm-recording.md)：pre-Gain 原音量、codec-only fallback 与严格 WebM preset。
- [ADR-0018](../architecture/adrs/0018-editor-timeline-recovery-and-marker-alignment.md)：Editor `88px/72px` 时间轴、同/异歌恢复决策与 point marker 中心对齐。
- [ADR-0023](../architecture/adrs/0023-visualizer-fullscreen-playback.md)：Visualizer 原生全屏、同 Canvas/RendererHost/RAF 与 2 秒自动隐藏 transport。

## Repository Areas

| Area | Current role | Target/change source |
| --- | --- | --- |
| `src/views/` | Analyzer 21 卡折叠/FIFO/排序与 M12 masonry，以及 E1–E8 Editor 页面 | system design + M7–M14 + E1–E8 |
| `src/layouts/` | Header、页面内容与按有效 Editor/Visualizer route playback lease 条件隐藏的 MusicBar 共享外壳 | ADR-0001/0006/0014；E1/V1 |
| `src/components/` | 播放 UI、列表、“去编辑”入口、Editor timeline/point workspace、动画及 Canvas/WebGL 可视化 | ADR-0001/0004/0006/0008 |
| `src/audio/` | 单一 AudioEngine 与 MainLayout-owned AudioSessionService；文件恢复及通用 Editor repeat-one / Visualizer pause-at-end route lease | ADR-0001/0003/0006/0014；E1/V1 |
| `src/analysis/` | 21 项分析平台、M14 feature-order 纯模型及 Analyzer/Editor 单一 active consumer lease；Editor 复用 Buffer retained PCM 与 tempo request | ADR-0002/0004/0005/0006/0013；M14/E1/E2 |
| `src/editor/` | JSON V1 strict codec、原生文件 gateway、独立单草稿、route controller、timeline/tempo、point 命令与 overlay bounds/feature 契约 | ADR-0007–0009；E1–E4 |
| `src/visualizer/` | V1 route/project/draft、V2 binding resolver、V3 Orthogonal Lines、V4 Cube Swarm、V5 recorder 与 V6 双模板恢复/时间诊断均已实现并获批准；post-V6 场景只允许按 ADR-0021 受控追加 | ADR-0014–0017、0021；V1–V6 approved |
| `src/persistence/` | 原生 IndexedDB V1 SessionRepository 与 runtime validator | ADR-0003；M5 |
| `src/stores/` | 持久化 config 与可序列化 audioSessionStore/恢复/analysis 状态 | ADR-0001/0002/0003 |
| `src/utils/` | 事件总线、M12 masonry placement 与其他纯工具函数 | 实现时按实际边界维护 |
| `src/data/` | `analyzerData.ts` 的 21 项 Meyda 说明，由 M6 registry 穷尽映射 | M6 FeatureRegistry |
| `tests/` | M3–M14 本地测试、fixture、golden、Chrome/Edge 浏览器 harness 和 eval runner | [tests README](../../tests/README.md) |
| `skills/audio-visualizer-dev/` | 本项目开发、验证和文档路由 Skill | [SKILL.md](../../skills/audio-visualizer-dev/SKILL.md) |
| `skills/visualizer-scene-generator/` | 新内置 Visualizer 场景的输入门禁、合同审批、代码与测试生成 Skill | [SKILL.md](../../skills/visualizer-scene-generator/SKILL.md) |

## Lifecycle Entry Points

- Product intent：[problem brief](../product/problem-brief.md)、[scope](../product/scope.md)、[success metrics](../product/success-metrics.md) 中的 Visualizer V0 已于 2026-09-02 获批
- System design：[system design](../architecture/system-design.md)、[interface contracts](../architecture/interface-contracts.md)、Visualizer 三份子契约与 ADR-0014–0017 已于 2026-09-02 获批
- Delivery planning：Analyzer M14、Editor E1–E9、Visualizer V0-D/V1–V6 均已批准并关闭
- Quality design：[eval plan](../quality/eval-plan.md) 已覆盖 M3–M14 并获批准
- Quality evidence：[evidence index](../quality/evidence-index.md) 的 M3–M13 为历史，M14 当前 record 已批准
- Editor E1 quality：[eval plan](../quality/editor/eval-plan.md)、[golden](../quality/editor/golden-examples.md)、[failure taxonomy](../quality/editor/failure-taxonomy.md) 与 [evidence](../quality/editor/evidence-index.md) 已获批准
- Editor E2 quality：[eval plan](../quality/editor/e2-eval-plan.md)、[golden](../quality/editor/e2-golden-examples.md)、[failure taxonomy](../quality/editor/e2-failure-taxonomy.md) 与 canonical record 已获批准
- Editor E3 quality：[eval plan](../quality/editor/e3-eval-plan.md)、[golden](../quality/editor/e3-golden-examples.md)、[failure taxonomy](../quality/editor/e3-failure-taxonomy.md) 与 26/26 canonical record 均已获批准
- Editor E4 quality：[eval plan](../quality/editor/e4-eval-plan.md)、[golden](../quality/editor/e4-golden-examples.md)、[failure taxonomy](../quality/editor/e4-failure-taxonomy.md) 与 31/31 canonical record 均已获批准
- Editor E5 quality：[eval plan](../quality/editor/e5-eval-plan.md)、[golden](../quality/editor/e5-golden-examples.md)、[failure taxonomy](../quality/editor/e5-failure-taxonomy.md) 与 35/35 canonical record 已获批准
- Editor E6 quality：[eval plan](../quality/editor/e6-eval-plan.md)、[golden](../quality/editor/e6-golden-examples.md)、[failure taxonomy](../quality/editor/e6-failure-taxonomy.md) 与 40/40 canonical record 已获批准
- Editor E7 quality：[eval plan](../quality/editor/e7-eval-plan.md)、[golden](../quality/editor/e7-golden-examples.md)、[failure taxonomy](../quality/editor/e7-failure-taxonomy.md) 与修订版 46/46 canonical 已获批准；44/44 run 保留为 `pre-revision`
- Editor E8 quality：[eval plan](../quality/editor/e8-eval-plan.md)、[golden](../quality/editor/e8-golden-examples.md)、[failure taxonomy](../quality/editor/e8-failure-taxonomy.md) 已批准；25/25 canonical record 与 owner 门禁均为 `approved`
- Editor E9 quality：[eval plan](../quality/editor/e9-eval-plan.md)、[golden](../quality/editor/e9-golden-examples.md)、[failure taxonomy](../quality/editor/e9-failure-taxonomy.md) 已批准；revised 29/29 canonical 与 owner 门禁为 `approved`，旧 run 保持 `pre-revision`
- Visualizer quality：V1–V6 契约、canonical 与 owner 门禁均已批准；整体 release-readiness review 已创建并为 `in-review`
- Visualizer scene extension：DEC-056/ADR-0021 已批准输入完整性与 Scene Contract 双门禁；当前只开放生成 Skill，不存在第三个已批准场景
- Visualizer V6 quality：[eval plan](../quality/visualizer/v6-eval-plan.md)、[golden](../quality/visualizer/v6-golden-examples.md) 与 [failure taxonomy](../quality/visualizer/v6-failure-taxonomy.md) 已获批准；54/54 canonical 与 owner 人工门禁均已批准
- Quality readiness：[Analyzer release readiness](../quality/release-readiness.md) 已按 M14 恢复 `Ready with waivers`；[Editor release readiness](../quality/editor/release-readiness.md) 已创建并为 `in-review`；M13 结论只作历史
- Release operations：`docs/release/` 尚未创建；PROD-015 的托管平台、域名和 SPA fallback 解决前不进入正式上线
- Retrospectives：`docs/retrospectives/` 尚未创建；有发布、事故或重复摩擦证据后生成

2026-09-01，M14 implementation commit `0e991307d9045a1ec84ddaae0515612240894a92` 与 clean canonical `M14-2026-09-01T02-36-49-995Z-0e991307` 19/19 通过；evidence/readiness 和 R-031–R-033 已复核，M14 关闭且未推送远端。

2026-09-02，owner 要求把 Visualizer 的单场景制作台、两个内置模板、最多四个唯一 Analyzer 特征、Editor 事件绑定和实时 WebM 路线转写为产品意图，并明确批准该 V0 产品意图、关闭 PROD-014V、开放 system design。随后 owner 明确批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017，并批准 V1–V6 delivery planning、同意开始 V1。V1 clean canonical `V1-2026-09-02T07-03-26-973Z-fd44c892` 在 commit `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` 上 21/21 通过，summary SHA-256 为 `14c9ed2258baf6c9a2a3a20dfcaba65a0c643029f8510a1d9e4c6662c9c90300`；同日 owner 批准 V1 evidence 与人工门禁，V1 关闭并开放 V2。V2 clean canonical `V2-2026-09-02T08-46-21-778Z-769faafe` 在 commit `769faafeef576bf9b98a95f6904cdb9886298530` 上 26/26 通过，summary SHA-256 为 `18b7d83d68f068ac615c56e1bb844a3c80bb1460ac884116d94cb460dd07bafb`；同日 owner 批准 V2 evidence，V2 关闭并开放 V3。随后 V3 Orthogonal Lines 在 implementation commit `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` 上完成 clean canonical `V3-2026-09-02T13-32-42-513Z-89be30eb`，固定 30 步全部通过，summary SHA-256 为 `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84`。`project-owner` 于 2026-09-03 明确批准该 canonical evidence、Orthogonal Lines、确定性余辉与单 RendererHost；V3 据此为 `Complete`、R-037/R-038 为 `Mitigated`，V4 为 `In Progress`。V4 clean canonical `V4-2026-09-02T17-47-40-271Z-5c2d24a3` 在 commit `5c2d24a3f1f413dba236563b3686237c6b8f2e21` 上 34/34 通过，summary SHA-256 为 `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2`；owner 于 2026-09-03 批准 evidence 并关闭 V4、开放 V5。R-039 因录制中 context loss 尚待实现仍为 `Open`。

2026-09-03，Editor E8 implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 交付 `88px/72px` 时间轴、6px 波形安全区、同歌 paused 恢复、异歌显式 replace 与中心对齐 marker。clean canonical `E8-2026-09-03T04-07-28-904Z-84d9435c` 25/25 通过，summary SHA-256 为 `ba9ff8db30868c8bf34140a3db2bf8cd7e3d56557ca7ac8682dfa6c3ce664a42`；owner 随后批准 evidence 与人工门禁，E8 关闭，R-022/R-024/R-025 改为 `Mitigated`。

同日，owner 批准 Visualizer V5 clean canonical 与双浏览器回放、页面静音音轨、同步、命令锁、取消/context 清理和原生保存人工门禁。run `V5-2026-09-03T03-49-31-211Z-9b5af09c`、implementation/evidence commit 与 summary SHA-256 保持不变且无需重跑；V5 关闭，R-039/R-040 改为 `Mitigated`，V6 final hardening 开放实施，R-041 保持 `Open`。

## Current Known Gaps

- M8 已实现四槽最多四张、累计 16 项、通用 scalar renderer、项目 Flux、零能量 0 与 UI hardening；clean canonical 与 Windows Chrome/owner 审批均已完成。
- M9 已实现首页透明/非首页 Header blur、Power Spectrum、MFCC 与 Buffer，使 UI/Worker 累计开放 19 项；provisional 与 clean canonical 均 32/32 通过并获 owner 批准，M9 已为 `Complete`。
- M10 已交付 Loudness 与 Complex Spectrum：Worker/UI 累计开放 21 项，结构 exact cursor 分别固定 total+24 bands 与 real/imag 各 1024；provisional 与 clean canonical 均 36/36 通过，并于 2026-08-25 获 owner 批准，M10 已为 `Complete`。
- 当前 Meyda `spectralFlux` 对有效输入仍抛出 `x is not defined`；产品已按 ADR-0005 实现并由 canonical 缓解 R-020，不得声称上游缺陷已修复。
- 超出约 15 分钟支持边界的长音频未开始播放只作为非门禁压力观察；它不表示长音频被规定为必须失败，也不改变当前产品范围。
- M11 clean canonical 已在 Chrome/Edge 上 38/38 通过，其中 Edge 全量为 31/31；原生 Edge 权限、辅助技术与人工长会话补偿门禁已于 2026-08-26 获 owner 签字，M11 为 `Complete`。
- Analyzer M12/M13 clean canonical 保留为历史；M14 clean canonical `M14-2026-09-01T02-36-49-995Z-0e991307` 在 commit `0e991307d9045a1ec84ddaae0515612240894a92` 上 19/19 通过，R-031/R-032/R-033 已缓解，readiness 恢复。
- Editor E1–E6 已实现并获批准；E6 双浏览器、三格式、10,000 事件、资源与无障碍 clean canonical 为 40/40。
- Editor E1–E9 均为 `Complete`；E9 revised 29/29 clean canonical 与 owner 门禁已批准。E9 只调整 BPM/波形布局和交互，不改变 JSON/IndexedDB/runtime ownership。
- Visualizer V1 已从 `/comingsoon` 迁移到 `/visualizer/:trackId?`，并实现通用 route lease、strict JSON/单草稿、三栏/抽屉和中性单 Canvas；V1 canonical 已批准。V2 已实现同歌 Editor snapshot、constant/analysis/editor-event、0–4 planner 和绝对时间 resolver，canonical 已获批准；V3 Orthogonal Lines、V4 Cube Swarm、V5 pre-Gain WebM 与 V6 final hardening canonical/人工门禁均已获批准。
- DEC-056 允许 post-V6 受控追加内置场景，但不改变默认模板、JSON V1、单 renderer/RAF/AudioContext/Worker 或四特征上限；新场景完成后必须重新评审 Visualizer readiness，R-043 在首个实际场景前保持 `Open`。
- E1 clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 clean commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过，summary SHA-256 为 `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6`，并于 2026-08-26 获 owner 批准。
- E2 clean canonical `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 在 clean commit `9fc5c0a81fcf90abfbc665412277147cd958200f` 上 22/22 通过，summary SHA-256 为 `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660`；2026-08-27 owner 批准后 E2 为 `Complete`，E3 已开放。
- E3 clean canonical `E3-2026-08-27T02-53-58-176Z-c670ddf5` 在 clean commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 上 26/26 通过，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`；2026-08-27 owner 批准后 E3 为 `Complete`，E4 已开放。
- E4 clean canonical `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 在 clean commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` 上 31/31 通过，summary SHA-256 为 `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff`；2026-08-27 owner 批准后 E4 为 `Complete`，E5 已开放。
- E5 clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 在 clean commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 上 35/35 通过，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`；2026-08-27 owner 批准后 E5 为 `Complete`，E6 已开放。
- E7 旧 44/44 run 因 ADR-0011 修订为 `pre-revision`；修订版 `E7-2026-08-29T05-23-03-986Z-080f577f` 46/46 通过并于 2026-08-31 获 owner 批准，E7 为 `Complete`。
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

随后 M9 provisional 与 clean canonical 均 32/32 通过；clean run `M9-2026-08-21T09-14-14-110Z-f88ca331` 绑定 commit `f88ca33149619b1a71eb30d74a1b8e266fb41a65`，summary SHA-256 为 `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e`。`project-owner` 于 2026-08-23 明确批准 M9 canonical evidence 与非首页导航栏模糊效果；该签字确认前述 Windows Chrome 视觉/学习清单通过，但不补写用户未提供的逐项数值或解释原文。M9 据此改为 `Complete`，M10 门禁开放但编码前保持 `Planned`。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”明确要求实施 M10 21/21 特征计划，并选择 Complex Spectrum 主图完整展示 1024 bins。M10 据此进入 `In Progress`；该授权不构成 M10 canonical 或 release readiness 通过。

随后 M10 clean canonical run `M10-2026-08-22T18-25-01-873Z-8830e2a2` 在 clean commit `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` 上 36/36 通过，summary SHA-256 为 `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1`。正式 evidence 已登记为 `in-review`；M10 人工任务和 owner 审批完成前，M10 保持 `In Progress`，M11 保持 `Planned`。

2026-08-25，`project-owner` 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”M10 evidence 据此改为 `approved`，M10 改为 `Complete`，M11 门禁开放但开始实施前保持 `Planned`。该批准不增加新的自动化测量，也不构成 Edge、M11 或 release readiness 通过。

同日，owner 确认已安装 Edge 并明确要求“按 M11 最终加固计划开始实施”。本机检测到 Microsoft Edge 151.0.4129.107，M11 据此改为 `In Progress`；该检测不等于 Edge 矩阵、原生权限或 M11 canonical 已通过。

随后 M11 dirty-worktree provisional run `M11-2026-08-25T09-47-44-125Z-1b3691f9-provisional` 38/38 通过，真实 Edge 全量 M3–M11 为 31/31；该结果只作实现反馈，M11 仍需 clean-commit canonical、正式 `in-review` evidence、Edge 原生权限与辅助技术人工签字。

M11 canonical run `M11-2026-08-25T10-05-12-783Z-99c67792` 随后在 clean commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过，summary SHA-256 为 `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5`。

2026-08-26，`project-owner` 明确回复：“我批准 M11 canonical evidence、Edge 原生权限与最终加固结果；同意将 M11 标记为 Complete 并创建 release-readiness。”M11 evidence 据此改为 `approved`，M11 改为 `Complete`。本批准只开放 Analyzer readiness review，不预先接受其豁免，也不构成生产上线授权。

同日，`project-owner` 明确回复：“我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。”Analyzer readiness 据此改为 `approved`，W-001–W-007 获接受。该批准只覆盖既有 Analyzer 候选；PROD-015 继续阻断上线，Editor 只进入产品意图阶段。

随后 owner 要求把 Editor 定义为对已有歌曲进行点/范围时间标注的“逆向制曲”工具，并补充长音色/效果的两次点击创建、端点手柄和右键删除；owner 又确认同类不重叠、`Esc`/空白右键取消及端点沿用自适应网格。`project-owner` 于 2026-08-26 进一步明确回复：“我批准 Editor E0 产品意图、点事件与范围事件规则、成功指标和开放问题；同意进入 Editor E0 架构设计。”Editor 产品文档据此获批并开放 system design；当前代码事实不变，E1–E6 仍未开放。

同日，Editor target architecture 已按批准范围写入 system design、interface contracts、R-022–R-027、ADR-0006–0009 与两个详细子契约。`project-owner` 随后明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”架构据此改为 `approved`，R-022–R-027 仍为 `Open`；该批准只开放 delivery planning，不构成 E1 实现、质量证据或 Editor readiness。

随后建立 `docs/delivery/editor/` 四份专属规划，按 owner 固定选择记录 10,000 事件 E6 压力门禁、overlay 默认 35%/最小 12% 和 E1–E6 各自 provisional、clean canonical、owner 审批。`project-owner` 于 2026-08-26 明确回复：“我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。”四份文档据此获批，E1 改为 `In Progress`，E2–E6 保持 `Planned`。

随后 E1 runtime、工程和测试完成；clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过，summary SHA-256 为 `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6`。该事实已登记为 `in-review` evidence；原生 picker、离页提示和 owner 人工任务获批前，E1 仍为 `In Progress`、E2 仍为 `Planned`。

同日，`project-owner` 明确批准 E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果，同意将 E1 标记为 `Complete` 并开放 E2。E2 据此改为 `In Progress`；E3–E6 保持 `Planned`。

2026-08-27，E2 时间轴、tempo map、Buffer consumer 与 BPM estimator 实现已提交；dirty provisional 与 clean canonical 均 22/22 通过。clean run `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 绑定 commit `9fc5c0a81fcf90abfbc665412277147cd958200f`，summary SHA-256 为 `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660`。该事实只形成 `in-review` evidence；owner 人工任务和批准前不关闭 E2、不开放 E3。

同日，`project-owner` 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 结果并开放 E3。E2 据此为 `Complete`，R-026 改为 `Mitigated`；E3 为 `In Progress`，E4–E6 保持 `Planned`。该原文不被扩写为用户未提供的逐项人工测量。

同日，E3 实现 commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 完成 point lane/class、自适应 1/16–1 beat 网格、鼠标/右键/键盘标记、分类迁移与 viewport-visible DOM。clean canonical run `E3-2026-08-27T02-53-58-176Z-c670ddf5` 26/26 通过，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`。该事实只登记 `in-review` evidence；owner 人工任务和批准前 E3 不关闭、E4 不开放。

同日，`project-owner` 明确批准 E3 canonical evidence、point lane、inner class、自适应网格与点标记结果，同意关闭 E3 并开放 E4。E4 据此为 `In Progress`；该批准不构成 E4 evidence 或 E5 门禁通过。

同日，E4 实现 commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` 交付 21 项单选半透明 overlay、六类共享 Canvas renderer、三手柄、Buffer 去重、exact cursor、pointer-through 与单层错误隔离。clean canonical run `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 31/31 通过，summary SHA-256 为 `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff`。该事实只登记 `in-review` evidence；owner 人工任务和批准前 E4 不关闭、E5 不开放。

同日，`project-owner` 明确批准 E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果，同意关闭 E4 并开放 E5。E5 据此为 `In Progress`；该批准不构成 E5 evidence 或 E6 门禁通过。

随后 E5 实现 commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 交付 range lane/class、两阶段创建、preview/取消、端点调整/回滚、半开重叠、键盘和持久化。clean canonical run `E5-2026-08-27T11-03-22-177Z-78124177` 35/35 通过，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`。该事实只登记 `in-review` evidence；owner 人工任务与批准前 E5 不关闭、E6 不开放。

同日，`project-owner` 明确批准 E5 canonical evidence、范围事件创建/调整、重叠校验、键盘与持久化结果，并同意将 E5 标记为 `Complete`、开放 E6。E6 据此进入 `In Progress`；本批准不提前形成 Editor release-readiness。

2026-08-28，E6 clean canonical `E6-2026-08-27T15-52-33-466Z-17d7fe10` 在 commit `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` 上 40/40 通过，summary SHA-256 为 `8f81b877dc5993bcdd4d04064e85c96156c946f2c62066c2b8571dfbc8473b6e`。自动化覆盖真实 Chrome/Edge、WAV/MP3/FLAC、10,000 事件、性能、资源和键盘/reduced-motion；原生 OS picker、`beforeunload`、辅助技术与长会话仍等待 owner 补偿签字，因此 E6 不提前关闭。

同日，`project-owner` 明确先批准 E6 修改与人工补偿，再要求按紧凑工作台计划实施 E7。E6 据此改为 `Complete`，R-024、R-025、R-027 改为 `Mitigated`；E7 改为 `In Progress`。该批准不改写 E6 canonical 身份，也不构成 Editor readiness 或生产上线授权。

随后 E7 实现 commit `78bc7f06311a09948e5efae941a14599305b81a5` 将 Editor 收敛为紧凑双层工具栏、平面分区、44px point/range 行与受控窄屏滚动。clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 44/44 通过，summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`；该事实只形成 `in-review` evidence，不替代 owner 视觉判断，也不创建 Editor readiness。

2026-08-29，owner 批准 DEC-033/ADR-0011，把 overlay 修订为窗口级全屏 fixed 灰色层、左上复合入口和按歌曲 visibility。44/44 run 保留为 `pre-revision`，正式 E7 evidence 改为 46 步；本决定不升级 JSON/IndexedDB，也不授权 readiness 或上线。

同日，`project-owner` 接受 Analyzer M12 布局计划并明确要求实施。代码随后删除开场文案，把状态并入 sticky 时间轴，使用稳定四槽 DOM、实际高度最短列和 ResizeObserver/RAF 合并重排。dirty-worktree provisional run `M12-2026-08-28T07-12-30-657Z-45f51908-provisional` 12/12 通过，summary SHA-256 为 `055951e16e9749bf89f189516f3975bb340721fe05e47922f5e34148ed47d9fd`；该结果只作实现反馈。

首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 因 M7 短 fixture 在观察前可能已接近结束、exact-cursor 计数窗口缺少播放输入而失败；失败 artifact 保留。测试先把进度归零并确认 `playing` 后，专项连续 5/5 通过，修复 commit 为 `be655e6765a63493fb1a3a4ee99992073b06e54e`。随后 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 在该 clean commit 上 12/12 通过，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`。

`project-owner` 已明确要求“自行提交并完成后续即可”，并说明“可以不上传远程仓库”。该授权在 M12 canonical 全绿后登记为 evidence/readiness 复核：M12 改为 `Complete`，R-028 为 `Mitigated`，Analyzer 恢复 `Ready with waivers`；本轮仅做本地提交，不推送。PROD-015 继续阻断上线，Editor readiness 等待 E7。
