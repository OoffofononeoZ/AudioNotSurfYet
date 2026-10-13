---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-12
upstream_docs:
  - "AGENTS.md"
next_action: "DEC-075功能与适用验证已完成，提供短片/标记供owner复核新增质量；旧readiness与P3/V2独立"
---

# 仓库上下文入口

## 当前目标与工作入口

AudioNotSurfYet 是 Vue / TypeScript / Vite 浏览器音频工作台；当前目标是自动优先、可人工修正且可完整手动完成的视频制作。当前实现见 [system map](system-map.md)，获批目标架构见 [system design](../architecture/system-design.md)，两者不混作完成状态。

工作规则和项目 skill 选择以 [AGENTS.md](../../AGENTS.md) 为准，运行与工具命令见 [README](../../README.md)。DEC-073 已替代通用阶段审批前置；既有技术契约、具体 Scene Contract、正式证据身份与发布边界继续有效。维护源为 `skills/`，发现入口为 `.agents/skills/`，代码定位使用 [CODEMAP](../CODEMAP.md)。

## 当前实现与证据状态

| 子系统 | 当前状态与边界 |
| --- | --- |
| 应用外壳与首页 | DEC-076：可收起侧边栏、窄屏隐藏导航和歌曲详情首页；布局及接口见 [应用外壳契约](app-shell.md)。 |
| Analyzer | M1–M14 历史切片已完成；M14 的 21 卡、FIFO 与独立排序基线获批，readiness 为 `Ready with waivers`。证据绑定历史候选。 |
| Editor | E1–E9 canonical 与适用人工门禁已批准。E10 按 DEC-057 开放单 lane/class 小节批量编辑与站内离页 dialog；E9 revised 29/29 保持历史身份，原 readiness 候选为 `pre-E10`。 |
| Visualizer | V1–V6 canonical 与适用人工门禁已批准，post-V6 viewport 修订已有 Chrome/Edge 专项证据。DEC-058 的原生全屏复用同一 Canvas/transport，不创建 V7；原 readiness 候选为 `pre-fullscreen`，交互与视觉由 owner 审阅。新场景仍须完整输入校验和确定 Scene Contract 审批。 |
| FT 与处理链 | P0-D 已完成；当前 FT 功能及汇总听感/长曲耗时按 DEC-074 接受。四原图与官方 ORT JSEP 的历史双浏览器数值门禁保留；完整 P1 正式关闭仍有独立证据缺口。 |
| Editor FT 接入 | 本轮功能收尾完成：四轨/WAV、缓存恢复、清理、取消/换歌/离页及原编辑回归，当前全量 runner 9/9，92 项非浏览器、Chrome/Edge 各 20/20。证据为工作树不变的 provisional，不冒充 clean canonical；完整 P2 及 P3–P6 独立，后者仍 `Planned`。 |
| 分轨试听与有限自动标记 | DEC-075 授权四轨共同 transport、ADT_STR WASM 鼓种、Basic Pitch 音符和六轨钢琴／吉他辅助分析；共同试听与标记闭环已实现并完成双浏览器功能/受控质量测量，新增识别质量未获owner接受。沿用 EditorProjectV1，不包含 P3、正式 readiness 或发布。 |

浏览器处理链、TypeScript 逐拍/局部 tempo、人工小节确认、只读提案与 Project V2 是获批路线，不代表后续能力已实现或可自动应用。里程碑与风险以对应合同及 evidence 为准；Editor/Visualizer 整体 readiness 独立处理，PROD-015 继续阻断上线。DEC-059/061 的旧设计资料已归档并停止作为新设计依据，既有样式仍是源码事实。

## 有效授权与未解决缺口

- DEC-075 允许本轮新增能力及其回归使用本地端口、Chrome／Edge 和必要的沙箱外执行，旧 DEC-055 readiness 限制保留。完整范围与完成证据要求见 [Editor 自动标记契约](../architecture/processing/editor-auto-marking.md)，新增识别质量待 owner 复核。
- 共同试听、候选服务/缓存/预览/修正与V1原子应用已接入；相关回归44文件243项、双浏览器30个不同场景及build通过，包含受控质量记录和15分钟源的120秒连续试听。合成snare漏标和音符多标保留，新增质量未获owner接受。当前证据和剩余工作见 [自动标记记录](../quality/processing/editor-auto-marking-evidence.md)。
- DEC-069/070 允许已批 P1–P6 按全部适用验收证据和必需人工输入自主关闭、推进；符合既定契约的后续质量文档纳入授权。重大范围、架构、兼容、阈值和发布变化仍须 owner 决定。DEC-072 只开放 Editor 接入例外，不豁免性能、质量或后续提案/V2 门禁。
- DEC-074 接受当前 FT 汇总听感：复杂音乐存在部分串音，drums 最好；本地取轨/拼接/导出检查与现有专项未发现造成串音的错误，模型及音乐复杂性是当前推断。第三首耗时按 owner 结论通过，长曲允许较长处理时间，不反复要求已接受的项目。
- 历史 Chrome 十五分钟处理 **1011.9541 秒（16分51.95秒）** 超过原 **900 秒** 的事实保留；本轮接受耗时不等同原门槛实测达标，不新增数值上限或扩大支持范围。Edge 普通 profile 完整性能和当前候选完整 P1 clean canonical 仍未补齐。
- owner 本次提供汇总结论，未提供逐曲逐轨 12 行表、第三首精确秒数或双浏览器原生 OS 保存/取消/回放记录，不补造这些事实。当前功能收尾及独立正式评审的边界见 [owner 验收](../quality/processing/evidence-index.md#owner-acceptance--2026-10-12) 与 [Editor 接入记录](../quality/processing/editor-integration-evidence.md)。
- 旧 Asyncify/provider 失败及原 `1e-3` 短段门禁失败属于历史 evidence；当前 DEC-071 上限为 max absolute ≤`1.5e-3`，仍使用原始四模型和官方运行库。R-046–R-055 保持 `Open`，不能把数值专项通过扩写为全部质量/性能通过。
- Editor readiness 的 provisional 24/24 与 clean 环境阻断分别保留；DEC-055 将 browser evidence gap 和 W-ED-001–W-ED-006 交由 owner 审阅，不申请沙箱外重跑，也不记为 clean pass。
- Meyda 上游 `spectralFlux` 的 `x is not defined` 缺陷未被修复；产品按 ADR-0005 使用项目 Flux。约十五分钟之外的长音频只作非门禁压力观察，不扩大支持范围或规定它必须失败。

其他产品开放项见 [open questions](../product/open-questions.md)，工程差异见 [Skill 项目差异](../../skills/audio-visualizer-dev/references/99-open-questions-and-project-deltas.md)。

## 文档导航

以下按职责提供入口；批准、候选身份、阈值、风险和当前结果以目标文档为准。审批原文统一查 [decision registry](decision-registry.md)，canonical 身份查对应 evidence index，provisional 与本地产物查 [tests README](../../tests/README.md#evidence-与本地产物)。历史候选不自动证明当前代码通过。

### 工作入口

| 入口 | 用途 |
| --- | --- |
| [AGENTS.md](../../AGENTS.md) | 根工作指南与项目 skill 导航 |
| [system-map.md](system-map.md) | 当前子系统、接口和外部依赖 |
| [app-shell.md](app-shell.md) | 当前侧边栏、内容边界、响应式布局与歌曲详情首页 |
| [glossary.md](glossary.md) | 当前项目词汇与代码含义 |
| [decision-registry.md](decision-registry.md) | 产品、架构和交付决策入口 |
| [working-agreements.md](working-agreements.md) | 本地开发、验证和 Git 约定 |
| [README](../../README.md) | 运行与仓库工具命令 |
| [CODEMAP](../CODEMAP.md) | 生成的文件地图与有限静态引用 |
| [tests README](../../tests/README.md) | 专项 runner、fixture、golden 和历史执行反馈 |
| [audio-visualizer-dev](../../skills/audio-visualizer-dev/SKILL.md) | 领域开发与诊断路由 |
| [visualizer-scene-generator](../../skills/visualizer-scene-generator/SKILL.md) | 新内置场景的输入校验与具体合同审批 |
| [Skill 项目差异](../../skills/audio-visualizer-dev/references/99-open-questions-and-project-deltas.md) | 实现差异与待核实工程事实 |

### 产品与共享技术契约

| 入口 | 用途 |
| --- | --- |
| [problem-brief.md](../product/problem-brief.md) | 历史意图及获批的视频产出主目标 |
| [scope.md](../product/scope.md) | 历史边界及自动优先、人工可操作的视频流程 |
| [success-metrics.md](../product/success-metrics.md) | 历史指标及获批的视频制作成功信号 |
| [open-questions.md](../product/open-questions.md) | 历史问题及已决定/延后的 PROD-024–029 |
| [system-design.md](../architecture/system-design.md) | 既有基线与获批浏览器 FT/TS 节拍、人工确认、V2、实时 WebM 链路 |
| [interface-contracts.md](../architecture/interface-contracts.md) | 历史契约与获批 browser Worker/proposal、typed error、V2 及 tempo 刷新入口 |
| [risk-register.md](../architecture/risk-register.md) | 历史风险与获批登记的 WebGPU、模型、quota、proposal、tempo/V2 风险；R-046–R-055 Open |

### Analyzer

| 入口 | 用途 |
| --- | --- |
| [execution-plan.md](../delivery/execution-plan.md) | Q0、M1–M14 实施顺序和门禁 |
| [acceptance-criteria.md](../delivery/acceptance-criteria.md) | 可测量验收与阈值 |
| [test-strategy.md](../delivery/test-strategy.md) | 测试层级、fixture 和证据策略 |
| [milestone-plan.md](../delivery/milestone-plan.md) | 相对目标、状态和退出证据 |
| [eval-plan.md](../quality/eval-plan.md) | M3–M14 评估、FIFO/order/geometry/lifecycle 门禁与 canonical 规则 |
| [golden-examples.md](../quality/golden-examples.md) | 成功、失败、边界和异常黄金样例 |
| [failure-taxonomy.md](../quality/failure-taxonomy.md) | 稳定失败类型、S0–S3、M14 order/pointer/a11y/persistence 失败和门禁响应 |
| [evidence-index.md](../quality/evidence-index.md) | M3–M13 历史 canonical 与当前 M14 19/19 record |
| [release-readiness.md](../quality/release-readiness.md) | M14 Ready with waivers 与 PROD-015 上线边界 |

### Editor

| 入口 | 用途 |
| --- | --- |
| [Editor Project V1](../architecture/editor/project-format-v1.md) | JSON schema、validator、歌曲 identity、codec 与独立 draft DB |
| [Editor interactions](../architecture/editor/interaction-contracts.md) | tempo/grid、pointer/keyboard、point/range 和 overlay 状态机 |
| [Editor execution plan](../delivery/editor/execution-plan.md) | E1–E9 实施顺序、固定参数和逐里程碑证据节奏 |
| [Editor acceptance criteria](../delivery/editor/acceptance-criteria.md) | AC-E101–AC-E905、阈值、证据方法和风险映射 |
| [Editor test strategy](../delivery/editor/test-strategy.md) | E1–E9 测试层级、fixture、浏览器、性能与 evidence cadence |
| [Editor milestone plan](../delivery/editor/milestone-plan.md) | E0-D 与 E1–E9 状态、依赖和退出清单 |
| [Editor E1 eval plan](../quality/editor/eval-plan.md) | AC-E101–AC-E108 的成功、失败、边界、异常与 canonical 契约 |
| [Editor E1 golden examples](../quality/editor/golden-examples.md) | JSON、identity、lease、草稿和文件异常规范样例 |
| [Editor E1 failure taxonomy](../quality/editor/failure-taxonomy.md) | Editor 路由、lease、schema、草稿、文件和生命周期失败分类 |
| [Editor evidence index](../quality/editor/evidence-index.md) | E1–E9 canonical 身份、hash、环境与 reviewer 记录 |
| [Editor release readiness](../quality/editor/release-readiness.md) | 历史 E9 候选审计、W-ED-001–W-ED-006 与 owner 审阅边界 |
| [Editor E2 eval plan](../quality/editor/e2-eval-plan.md) | AC-E201–AC-E206 的 geometry、tempo、BPM、竞态与回归契约 |
| [Editor E2 golden examples](../quality/editor/e2-golden-examples.md) | viewport、tempo map、BPM reliable/low-confidence 规范样例 |
| [Editor E2 failure taxonomy](../quality/editor/e2-failure-taxonomy.md) | E2 geometry、pointer、tempo、estimator 和 consumer 失败分类 |
| [Editor E3 eval plan](../quality/editor/e3-eval-plan.md) | AC-E301–AC-E306 的 lane、snapping、point、pointer、DOM 与回归契约 |
| [Editor E3 golden examples](../quality/editor/e3-golden-examples.md) | point/class/migration、1/16–1 beat、键盘、可见 DOM 与 range 保留样例 |
| [Editor E3 failure taxonomy](../quality/editor/e3-failure-taxonomy.md) | E3 lane、migration、snap、point、focus 与 visible DOM 失败分类 |
| [Editor E4 eval plan](../quality/editor/e4-eval-plan.md) | AC-E401–AC-E405 的 renderer、consumer、bounds、hit-test、cursor 与 isolation 契约 |
| [Editor E4 golden examples](../quality/editor/e4-golden-examples.md) | 21 项、Buffer 去重、三手柄、穿透、stale、错误隔离与恢复样例 |
| [Editor E4 failure taxonomy](../quality/editor/e4-failure-taxonomy.md) | E4 renderer、consumer、bounds、hit、cursor 与 isolation 失败分类 |
| [Editor E5 eval plan](../quality/editor/e5-eval-plan.md) | AC-E501–AC-E505 的 range state、interval、overlap、handle、persistence 与 regression 契约 |
| [Editor E5 golden examples](../quality/editor/e5-golden-examples.md) | 两阶段创建、半开相邻、重叠矩阵、端点、迁移、round-trip 与 overlay 穿透样例 |
| [Editor E5 failure taxonomy](../quality/editor/e5-failure-taxonomy.md) | E5 range lane/state/interval/overlap/handle/persistence 失败分类 |
| [Editor E6 eval plan](../quality/editor/e6-eval-plan.md) | AC-E601–AC-E606 的双浏览器、三格式、10,000 事件、性能、资源、无障碍与 canonical 契约 |
| [Editor E6 golden examples](../quality/editor/e6-golden-examples.md) | 三格式、native flow、压力、DOM、资源、geometry、键盘与证据身份样例 |
| [Editor E6 failure taxonomy](../quality/editor/e6-failure-taxonomy.md) | E6 browser/format、native、stress、performance、resource、a11y 与 evidence 失败分类 |
| [Editor E7 eval plan](../quality/editor/e7-eval-plan.md) | AC-E701–AC-E708 的紧凑密度、全屏浮层、visibility、响应式与 46 步 canonical 契约 |
| [Editor E8 eval plan](../quality/editor/e8-eval-plan.md) | AC-E801–AC-E805 的时间轴、恢复、marker 几何与 scoped/canonical 契约 |
| [Editor E8 golden examples](../quality/editor/e8-golden-examples.md) | 四视口波形、同/异歌恢复与 marker 中心规范样例 |
| [Editor E8 failure taxonomy](../quality/editor/e8-failure-taxonomy.md) | E8 恢复竞态、几何、裁切、可访问性与回归失败分类 |
| [Editor E7 golden examples](../quality/editor/e7-golden-examples.md) | 双层工具栏、平面分区、行高、波形、多视口与任务回归样例 |
| [Editor E7 failure taxonomy](../quality/editor/e7-failure-taxonomy.md) | E7 density、overflow、geometry、interaction 与 resource 失败分类 |
| [Editor E9 eval-plan](../quality/editor/e9-eval-plan.md) | E9 tempo/展示修订的验证契约 |
| [Editor E10 eval-plan](../quality/editor/e10-eval-plan.md) | E10 小节批量编辑与离页交互的验证契约 |
| [Editor E9 golden-examples](../quality/editor/e9-golden-examples.md) | E9 tempo/展示修订的验证契约 |
| [Editor E10 golden-examples](../quality/editor/e10-golden-examples.md) | E10 小节批量编辑与离页交互的验证契约 |
| [Editor E9 failure-taxonomy](../quality/editor/e9-failure-taxonomy.md) | E9 tempo/展示修订的验证契约 |
| [Editor E10 failure-taxonomy](../quality/editor/e10-failure-taxonomy.md) | E10 小节批量编辑与离页交互的验证契约 |

### Visualizer

| 入口 | 用途 |
| --- | --- |
| [Visualizer Project V1](../architecture/visualizer/project-format-v1.md) | strict JSON、歌曲 identity、Editor snapshot、单草稿与原子导入 |
| [Visualizer binding and scenes](../architecture/visualizer/binding-and-scene-contracts.md) | 受控 binding、四特征 planner、绝对时间确定性、双模板与单 RendererHost |
| [Visualizer recording](../architecture/visualizer/recording-contract.md) | pre-Gain audio tap、严格预设、MediaRecorder 状态机与 WebM 生命周期 |
| [Visualizer execution plan](../delivery/visualizer/execution-plan.md) | V1–V6 历史切片；新链见已批准 processing 计划 |
| [Visualizer acceptance criteria](../delivery/visualizer/acceptance-criteria.md) | 历史 AC-V101–AC-V607；新 processing/V2 验收待复核 |
| [Visualizer test strategy](../delivery/visualizer/test-strategy.md) | 历史 V1–V6；新 browser model/beat/V2 测试待复核 |
| [Visualizer milestone plan](../delivery/visualizer/milestone-plan.md) | V0-D/V1–V6 历史切片；处理链状态见 processing 与 DEC-072 |
| [Visualizer V1 eval plan](../quality/visualizer/eval-plan.md) | AC-V101–AC-V108 的 route、lease、project、draft、layout 与 resource 契约 |
| [Visualizer V1 golden](../quality/visualizer/golden-examples.md) | 默认/完整/无效工程、lease、草稿和 breakpoint 规范样例 |
| [Visualizer V1 failure taxonomy](../quality/visualizer/failure-taxonomy.md) | route、lease、project、draft、file、layout、resource 失败分类 |
| [Visualizer V2 eval plan](../quality/visualizer/v2-eval-plan.md) | AC-V201–AC-V208 的 inspector、projection、planner、Editor snapshot 与 resolver 契约 |
| [Visualizer V2 golden](../quality/visualizer/v2-golden-examples.md) | 0–4、21 项 projection、point/range、stale 与 deterministic hash 规范样例 |
| [Visualizer V2 failure taxonomy](../quality/visualizer/v2-failure-taxonomy.md) | inspector、planner、projection、snapshot、transform、determinism 与 resource 分类 |
| [Visualizer V3 eval plan](../quality/visualizer/v3-eval-plan.md) | AC-V301–AC-V305 的 Orthogonal Lines、单 RendererHost、确定性余辉与错误隔离契约 |
| [Visualizer V3 golden](../quality/visualizer/v3-golden-examples.md) | 横竖映射、point/range、decay、seek/hash、DPR、切换与重试规范样例 |
| [Visualizer V3 failure taxonomy](../quality/visualizer/v3-failure-taxonomy.md) | mapping、trail、determinism、host、switch、scene、responsive 与 performance 分类 |
| [Visualizer V4 eval plan](../quality/visualizer/v4-eval-plan.md) | AC-V401–AC-V406 的核心环、默认两项分析、确定性积分、资源与 context recovery 契约 |
| [Visualizer V4 golden](../quality/visualizer/v4-golden-examples.md) | 64-band 核心、seed 外围、三卫星、默认绑定、hash、context 与响应式规范样例 |
| [Visualizer V4 failure taxonomy](../quality/visualizer/v4-failure-taxonomy.md) | default、core、rise、orbit、determinism、resource、context 与 performance 分类 |
| [Visualizer V5 eval plan](../quality/visualizer/v5-eval-plan.md) | AC-V501–AC-V509 的 pre-Gain、MediaRecorder、保存、双浏览器与媒体阈值 |
| [Visualizer V5 golden](../quality/visualizer/v5-golden-examples.md) | 3 秒 A/V fixture、准备回滚、命令锁、abort、save 与 lifecycle 规范样例 |
| [Visualizer V5 failure taxonomy](../quality/visualizer/v5-failure-taxonomy.md) | tap、capability、preflight、sequence、abort、container、sync 与 resource 分类 |
| [Visualizer V6 eval plan](../quality/visualizer/v6-eval-plan.md) | AC-V601–AC-V607 的三格式、双浏览器、长时压力、资源与 54 步 canonical 契约 |
| [Visualizer V6 golden](../quality/visualizer/v6-golden-examples.md) | 四特征切换、三格式、20 次生命周期、六文件与故障矩阵规范样例 |
| [Visualizer V6 failure taxonomy](../quality/visualizer/v6-failure-taxonomy.md) | format、binding、clock、resource、recovery、a11y、media 与 evidence 分类 |
| [Visualizer evidence index](../quality/visualizer/evidence-index.md) | V1–V6 canonical 身份、hash、环境和 reviewer 记录 |
| [Visualizer viewport scroll eval](../quality/visualizer/viewport-scroll-eval-plan.md) | post-V6 一屏工作台、独立侧栏滚动与共享 scrollbar 契约 |
| [Visualizer viewport scroll golden](../quality/visualizer/viewport-scroll-golden-examples.md) | 页面无纵向滚动、双侧隔离、compact drawer 与样式复用样例 |
| [Visualizer viewport scroll failure taxonomy](../quality/visualizer/viewport-scroll-failure-taxonomy.md) | viewport、scroll ownership、scroll chaining、style drift 与 regression 分类 |
| [Visualizer release readiness](../quality/visualizer/release-readiness.md) | V1–V6 已批准基线与 DEC-050 修订状态 |
| [Visualizer fullscreen eval-plan](../quality/visualizer/fullscreen-playback-eval-plan.md) | post-V6 原生全屏契约与 owner 审阅边界 |
| [Visualizer fullscreen golden-examples](../quality/visualizer/fullscreen-playback-golden-examples.md) | post-V6 原生全屏契约与 owner 审阅边界 |
| [Visualizer fullscreen failure-taxonomy](../quality/visualizer/fullscreen-playback-failure-taxonomy.md) | post-V6 原生全屏契约与 owner 审阅边界 |

### FT 与处理链

| 入口 | 用途 |
| --- | --- |
| [FT model artifacts](../architecture/processing/model-artifacts.md) | 四模型固定 revision/SHA-256、专用 row、拼接/WAV 与未验证边界 |
| [Worker and V2 contracts](../architecture/processing/worker-and-project-contracts.md) | start/progress/cancel/result/error、算法候选/apply、V2/tempo 刷新 |
| [Processing execution plan](../delivery/processing/execution-plan.md) | P1–P6 路线、切片与依赖；Editor 接入例外见 DEC-072 |
| [Processing acceptance criteria](../delivery/processing/acceptance-criteria.md) | AC-P101–P604；数值/人工质量、逐拍 F1、900 秒和工程保护 |
| [Processing test strategy](../delivery/processing/test-strategy.md) | TS-P1–P6、WASM reference、fixture、故障/资源/媒体与人工补偿 |
| [Processing milestone plan](../delivery/processing/milestone-plan.md) | P0-D、P1–P6 状态与退出条件；当前状态见本页及对应 evidence |
| [Processing P1 eval plan](../quality/processing/eval-plan.md) | AC-P101–P106 的模型/runtime、独立 parity/时间/WAV、质量/性能/取消和证据要求 |
| [Processing P1 golden examples](../quality/processing/golden-examples.md) | P1-G01–P1-G24 成功、失败、边界与人工预期 |
| [Processing P1 failure taxonomy](../quality/processing/failure-taxonomy.md) | PFT 九类、独立 S0–S3 严重度、P1 阻断/补偿与重验 |
| [Editor 分离契约](../architecture/processing/editor-separation.md) | DEC-072 的 Editor 四轨工作区、缓存、导出与取消边界 |
| [Editor 接入记录](../quality/processing/editor-integration-evidence.md) | 当前双浏览器功能收尾、历史 canonical 与证据边界 |
| [P1 evidence](../quality/processing/evidence-index.md) | 固定模型的实际推断、历史失败、性能测量及人工缺口 |
| [FT kernel config](../architecture/processing/ft-kernel-config.md) | 固定 FT 参数、重采样、拼接与输出配置 |
| [Numeric review](../quality/processing/numeric-review.md) | DEC-071 的短段 parity 门禁与批准依据 |

### 架构决定

| 入口 | 用途 |
| --- | --- |
| [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 单一 AudioEngine 与共享 session state |
| [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md) | Worker 全曲分析、取消与 stale 隔离 |
| [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md) | IndexedDB 文件句柄和当前 Blob 混合恢复 |
| [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md) | 类型化特征注册表和 Canvas 2D renderer family |
| [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) | 项目 Flux v1 与零能量标量语义 |
| [ADR-0006](../architecture/adrs/0006-editor-runtime-leases.md) | Editor route-scoped playback/analysis lease 与单 engine/Worker |
| [ADR-0007](../architecture/adrs/0007-editor-project-and-draft-boundary.md) | 版本化 JSON、歌曲 hash 和独立单草稿边界 |
| [ADR-0008](../architecture/adrs/0008-editor-time-and-event-model.md) | 秒数事实、tempo 派生网格与 point/range 状态机 |
| [ADR-0009](../architecture/adrs/0009-editor-overlay-renderer-boundary.md) | 共享 renderer adapter 与 pointer-through overlay |
| [ADR-0010](../architecture/adrs/0010-editor-compact-workbench.md) | Editor 紧凑双层工具栏、平面细线分区与响应式密度令牌 |
| [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md) | Editor 窗口级全屏灰色浮层、复合入口、按歌曲 visibility 与 Buffer-only 关闭状态 |
| [ADR-0012](../architecture/adrs/0012-analyzer-all-cards-fifo-active-analysis.md) | Analyzer 21 张稳定折叠卡、最多四项 FIFO 与 V1 carrier |
| [ADR-0013](../architecture/adrs/0013-analyzer-accessible-card-reordering.md) | Analyzer 自定义顺序、可访问排序与 V1 optional field |
| [ADR-0014](../architecture/adrs/0014-visualizer-runtime-leases.md) | Visualizer route playback/analysis lease 与单 engine/Worker |
| [ADR-0015](../architecture/adrs/0015-visualizer-project-and-binding-boundary.md) | strict JSON、同歌 Editor 快照、单草稿与非可执行 binding |
| [ADR-0016](../architecture/adrs/0016-deterministic-scene-registry.md) | 双模板 registry、单 RendererHost 与绝对时间确定性 |
| [ADR-0017](../architecture/adrs/0017-realtime-webm-recording.md) | pre-Gain 原音量、codec-only fallback 与严格 WebM preset |
| [ADR-0018](../architecture/adrs/0018-editor-timeline-recovery-and-marker-alignment.md) | Editor `88px/72px` 时间轴、同/异歌恢复决策与 point marker 中心对齐 |
| [ADR-0019](../architecture/adrs/0019-editor-tempo-lane-and-boundary-deletion.md) | Editor tempo lane 与 boundary 删除 |
| [ADR-0020](../architecture/adrs/0020-editor-compact-tempo-strip.md) | Editor 紧凑 BPM 条与层级展示 |
| [ADR-0021](../architecture/adrs/0021-controlled-visualizer-scene-generation.md) | 受控场景生成与具体 Scene Contract 门禁 |
| [ADR-0022](../architecture/adrs/0022-editor-marker-block-editing.md) | Editor 单 lane/class 小节批量编辑 |
| [ADR-0023](../architecture/adrs/0023-visualizer-fullscreen-playback.md) | Visualizer 原生全屏、同 Canvas/RendererHost/RAF 与 2 秒自动隐藏 transport |
| [ADR-0024](../architecture/adrs/0024-browser-processing-runtime.md) | 浏览器 ORT WebGPU、模型下载/缓存、最多一个分离 Worker |
| [ADR-0025](../architecture/adrs/0025-audio-processing-pipeline-and-timebase.md) | 四专用模型/PCM、TypeScript 逐拍/局部 tempo、人工小节确认与待测性能 |
| [ADR-0026](../architecture/adrs/0026-processing-proposals-and-user-ownership.md) | 只读提案、逐项 apply、工程 hash 与零隐式覆盖 |
| [ADR-0027](../architecture/adrs/0027-visualizer-project-v2-processing-bindings.md) | V2、单向迁移、默认映射与显式 tempo 刷新 |
