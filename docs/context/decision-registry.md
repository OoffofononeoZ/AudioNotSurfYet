---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/context/index.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/delivery/execution-plan.md"
next_action: "请 owner 复核 DEC-033/ADR-0011 的 46/46 E7 候选；批准前不进入 readiness"
---

# Decision Registry

本表是长期决策入口；详细理由、替代方案和验证要求以链接文档为准，避免在上下文层复制完整 ADR。

| ID | Date | Decision | Owner | Status | Source | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| DEC-001 | 2026-07-24 | AudioNotSurfYet 专属 Skill 源码纳入本仓库，并通过 `~/.codex/skills/audio-visualizer-dev` 软链接安装；不修改中央 skills 仓库 | project-owner | active | [Skill](../../skills/audio-visualizer-dev/SKILL.md) | 出现第二个真实同类项目、安装位置或项目边界改变 |
| DEC-002 | 2026-07-24 | 采用 Harness Engineering 阶段文档与人工门禁；未批准上游不得创建或推进下游 | project-owner | active | [AGENTS.md](../../AGENTS.md) | 生命周期顺序、门禁或文档位置改变 |
| DEC-003 | 2026-07-24 | 项目文档与 Skill 默认使用中文，代码标识和命令保留原文 | project-owner | active | [AGENTS.md](../../AGENTS.md) | 团队确定新的文档语言政策 |
| DEC-004 | 2026-07-24 | 主要用户为音频分析学习者，核心任务是把 Meyda 数值/数组对应到具体时刻、听感和音色 | project-owner | approved | [Problem brief](../product/problem-brief.md) | 目标用户、学习任务或核心问题改变 |
| DEC-005 | 2026-07-24 | 最终覆盖 `analyzerData.ts` 全部 21 项；首批 RMS、Amplitude Spectrum、Chroma；最多四张唯一卡共享时间轴 | project-owner | approved | [Scope](../product/scope.md) | 特征覆盖、首批切片、卡片或时间轴规则改变 |
| DEC-006 | 2026-07-24 | 当前只处理本地 MP3/WAV/FLAC（约 15 分钟），支持最新 Chrome/Edge 桌面；上传、移动端、非 Chromium 和未定义 Tab 排除 | project-owner | approved | [Scope](../product/scope.md) | 数据边界、格式、时长、浏览器或页面范围改变 |
| DEC-007 | 2026-07-24 | 正确性使用直接 Meyda 黄金容差；游标 ≤100ms；输入反馈 ≤100ms 且无分析归因主线程长任务；owner 完成任务并解释 3/3 片段 | project-owner | approved | [Success metrics](../product/success-metrics.md) | 阈值、黄金样本或验证人群改变 |
| ADR-0001 | 2026-07-24 | 单一实时 AudioEngine 独占音频资源，audioSessionStore 只保存可序列化状态 | project-owner | approved | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 播放所有权、时钟或状态边界改变 |
| ADR-0002 | 2026-07-24 | Worker 只分析最多四个活动特征，聚合/量化展示数据；generation 和完整身份隔离 stale result | project-owner | approved | [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md) | 分析线程、缓存身份、取消或数据分辨率改变 |
| ADR-0003 | 2026-07-24 | IndexedDB 保存全部句柄，但只保存当前 Blob/分析缓存；权限恢复必须显式可见并由用户触发 request | project-owner | approved | [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md) | 会话寿命、数据量、权限或存储边界改变 |
| ADR-0004 | 2026-07-24 | 使用 21 项穷尽 FeatureRegistry 和 Canvas 2D renderer family；DOM 承担说明、值、焦点和语义；Analyzer 不新增 Three.js | project-owner | approved | [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md) | 特征 shape、renderer 或无障碍边界改变 |
| ADR-0005 | 2026-08-21 | `spectralFlux` 使用项目 v1 正向 L1 公式；零能量 M8 标量为 0，非零能量非有限值失败；不 patch Meyda 或改变 cache schema | project-owner | approved | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) | Flux 公式、静音语义、提取来源或缓存语义改变 |
| ADR-0006 | 2026-08-26 | Editor 通过 route-scoped playback/analysis lease 复用唯一 AudioEngine、时钟、Coordinator 和 Worker | project-owner | approved | [ADR-0006](../architecture/adrs/0006-editor-runtime-leases.md) | runtime 所有权、结束策略、consumer 并发或 Worker 数量改变 |
| ADR-0007 | 2026-08-26 | Editor 使用版本化 JSON、内容 hash 绑定和独立 `audionotsurfyet-editor` V1 单草稿 | project-owner | approved | [ADR-0007](../architecture/adrs/0007-editor-project-and-draft-boundary.md) | 工程格式、identity、草稿数量、数据库或迁移策略改变 |
| ADR-0008 | 2026-08-26 | Editor 以秒数为事件事实、tempo 只派生网格，并使用 point/range 判别模型和固定右键状态机 | project-owner | approved | [ADR-0008](../architecture/adrs/0008-editor-time-and-event-model.md) | 时间 identity、吸附、重叠、range 或 pointer 语义改变 |
| ADR-0009 | 2026-08-26 | Editor 抽取纯 Canvas renderer adapter，共享 geometry，并让 overlay 除 selector/手柄外 pointer-through | project-owner | approved | [ADR-0009](../architecture/adrs/0009-editor-overlay-renderer-boundary.md) | renderer family、geometry、overlay pointer 或 Canvas/DOM 边界改变 |
| ADR-0011 | 2026-08-29 | Editor overlay Teleport 为全视口 fixed 灰色层；复合入口和 visibility 为本地按歌状态，关闭时 analysis 收敛为 Buffer | project-owner | approved | [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md) | overlay 挂载、开关/菜单、坐标空间、本地偏好或 pointer 边界改变 |
| DEC-008 | 2026-07-24 | 实施采用 M1–M11 相对门禁，不承诺日期；M3 从测试基础开始，M7 未通过不得扩展后续特征 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | 依赖、里程碑、验收门禁或交付优先级改变 |
| DEC-009 | 2026-07-24 | 当前只批准 execution planning；不预建 quality/release/retrospective，也不自动开始代码实现 | project-owner | superseded by DEC-010 | [Milestone plan](../delivery/milestone-plan.md) | 已由 owner 决定前置三份 quality design |
| DEC-010 | 2026-07-24 | 在 M3 前增加 Q0：前置 eval plan、golden examples、failure taxonomy；三份文档单独批准后开放 M3，release-readiness 仍等待 M11 证据 | project-owner | approved | [Eval plan](../quality/eval-plan.md) | 验收/测试纪律变化，或 owner 改变 Q0/readiness 时序 |
| DEC-011 | 2026-07-28 | M3 只建设本地门禁；使用 Vitest、fake-indexeddb 和正式 Chrome channel，Edge 缺失保持 evidence gap，不以 Chromium 代替 | project-owner | approved | [Tests README](../../tests/README.md) | CI 范围、浏览器矩阵或测试工具改变 |
| DEC-012 | 2026-07-28 | canonical 短 fixture 由确定性 PCM 经系统 FFmpeg 生成并使用 CC0-1.0；用户音频默认仅本地使用 | project-owner | approved | [Fixture manifest](../../tests/fixtures/fixture-manifest.json) | 编码器、fixture 来源、许可或入库政策改变 |
| DEC-013 | 2026-07-28 | 未提交状态只产生 provisional run；用户自行提交后对干净 commit 复跑，才创建正式 evidence index | project-owner | approved | [Working agreements](working-agreements.md) | Git 授权或 evidence identity 政策改变 |
| DEC-014 | 2026-07-28 | M4 快速切歌最后操作生效，非空追加不中断当前播放，metadata 失败继续解码，decode/unsupported 使用非阻塞消息 | project-owner | approved | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 队列、竞态或错误交互语义改变 |
| DEC-015 | 2026-07-29 | M5 原生文件选择不提供隐藏 input fallback；本地音频保持 Git 忽略，超出约 15 分钟的样本只作 best-effort 压力观察且不扩大范围 | project-owner | approved | [Working agreements](working-agreements.md) | 文件选择兼容策略、本地样本政策或支持时长改变 |
| DEC-016 | 2026-07-29 | M6 建立 21 项穷尽 registry、四项 Worker 支持、六类 compact codec、空默认活动集、完整 cache identity、generation 隔离和 Worker exact cursor；不实现 M7 UI，不升级 Meyda 或增加 spectralFlux fallback | project-owner | approved | [Interface contracts](../architecture/interface-contracts.md) | M6 feature 支持、frame/config、codec、缓存、精确值或 fallback 策略改变 |
| DEC-017 | 2026-07-30 | M7 固定四个 UI 槽位，但只允许 RMS、Amplitude Spectrum、Chroma 三个唯一活动特征；无保存工作区默认三卡，已保存空工作区恢复为空；第四槽与完整四特征场景顺延 M8 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | M7 活动上限、默认/恢复语义、槽位或 M8 开门规则改变 |
| DEC-018 | 2026-08-21 | M8 先修复 Analyzer shell 四项 UI 问题，再开放 13 个标量；Flux 使用项目 v1 公式，零能量 M8 标量为 0，非零能量非有限值失败；累计最多四张唯一卡 | project-owner | approved | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) | Flux 公式、静音语义、M8 feature set、shell layer 或按钮状态契约改变 |
| DEC-019 | 2026-08-21 | M9 Slice 0 让首页 Header 保持透明、所有非首页使用 18px backdrop blur；随后开放 Power Spectrum、MFCC、Buffer，累计最多四张、19/21 可用卡 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | Header 路由样式、M9 feature set、向量/波形 renderer 或累计覆盖改变 |
| DEC-020 | 2026-08-23 | M10 开放 Loudness 与 Complex Spectrum 达到 21/21；Complex Spectrum 主图与精确表完整保留 1024 bins，并以 signed Hz 解释后半负频率镜像 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | 结构 payload、FFT bin 范围、renderer 或最终 feature set 改变 |
| DEC-021 | 2026-08-26 | 批准 M11 canonical、Edge 原生权限与最终加固结果，关闭 M11 并创建 Analyzer release-readiness；readiness 豁免与生产上线仍需单独批准 | project-owner | approved | [Evidence index](../quality/evidence-index.md) | M11 evidence 身份、readiness 时序或上线授权改变 |
| DEC-022 | 2026-08-26 | 批准 Analyzer `Ready with waivers`，接受 W-001–W-007 并进入 Editor E0 产品意图；Analyzer 正式上线继续等待 PROD-015 | project-owner | approved | [Release readiness](../quality/release-readiness.md) | 候选身份、豁免条件、托管方案或 Editor 范围改变 |
| DEC-023 | 2026-08-26 | Editor E0 是单曲“逆向制曲”标注：首版本地 JSON、点事件和范围事件、tempo map、单特征叠加及 E1–E6；同 lane/inner class 范围不重叠 | project-owner | approved | [Scope](../product/scope.md) | 事件语义、数据边界、格式、依赖或里程碑改变 |
| DEC-024 | 2026-08-26 | Editor E6 固定验证 10,000 个事件；overlay 默认高度 35%、最小 12%；E1–E6 每个里程碑都必须独立 provisional、clean canonical 和 owner 审批 | project-owner | approved | [Editor execution plan](../delivery/editor/execution-plan.md) | 容量门禁、overlay 默认值、证据节奏或逐里程碑审批改变 |
| DEC-025 | 2026-08-26 | 批准 Editor E1–E6 delivery planning 并只开放 E1；E2–E6 继续逐里程碑等待 canonical 与 owner evidence 审批 | project-owner | approved | [Editor milestone plan](../delivery/editor/milestone-plan.md) | E1 范围、里程碑顺序或 evidence 门禁改变 |
| DEC-026 | 2026-08-26 | E1 canonical/人工结果获批准并开放 E2；一个 beat 固定为 `60/BPM` 秒，拍号分母只表达 beat 音符单位；tempo boundary 有合法 metered BPM 时按网格吸附，否则按微秒规范化原始时间 | project-owner | approved | [Editor interactions](../architecture/editor/interaction-contracts.md) | BPM/拍号含义、boundary 吸附、E2 范围或门禁改变 |
| DEC-027 | 2026-08-27 | 批准 E2 canonical 结果并开放 E3 point annotation；E4–E6 继续逐里程碑等待独立 canonical 与 owner 审批 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | E3 范围、point 交互或逐里程碑门禁改变 |
| DEC-028 | 2026-08-27 | 批准 E3 canonical、point lane、inner class、自适应网格与点标记结果，关闭 E3 并开放 E4 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | point 语义、E4 overlay 范围或门禁改变 |
| DEC-029 | 2026-08-27 | 批准 E4 canonical、21 项 overlay、三手柄、pointer-through 与错误隔离结果，关闭 E4 并开放 E5 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | overlay renderer、pointer-through、E5 范围或门禁改变 |
| DEC-030 | 2026-08-27 | 批准 E5 canonical、范围创建/调整、重叠校验、键盘与持久化结果，关闭 E5 并开放 E6 最终加固 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | range 语义、E6 阈值、双浏览器或最终加固门禁改变 |
| DEC-031 | 2026-08-28 | Analyzer 使用稳定 slot 0–3 DOM 和实际高度最短列；390/1024 一列、1280/1920 两列、gap 18px，ResizeObserver 以单 RAF 合并且卸载成对释放；不引入 pretext、不改变分析/持久化契约 | project-owner | approved | [System design](../architecture/system-design.md) | slot 顺序、列断点、动态高度、Observer/RAF 所有权或 Analyzer 契约改变 |
| DEC-032 | 2026-08-28 | 先批准并关闭 Editor E6，再以 E7 把 Editor 改为紧凑双层工具栏和平面细线分区；桌面控件 30px、point/range 行 44px、侧栏 152/144px、波形 176px，窄屏波形 144px；FL Studio 仅作为密度参考，不复制配色、品牌资产或控件 | project-owner | approved | [ADR-0010](../architecture/adrs/0010-editor-compact-workbench.md) | Editor 密度令牌、区域层次、断点或既有功能契约改变 |
| DEC-033 | 2026-08-29 | E7 增补窗口级全屏悬浮分析层、左上复合开关/21 项菜单、按歌曲 visibility；旧 44/44 run 保留为 pre-revision，新候选为 46 步 | project-owner | approved | [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md) | E7 浮层范围、记忆规则、canonical 步数或 owner 门禁改变 |

## Approval Evidence

`project-owner` 于 2026-07-24 通过“PLEASE IMPLEMENT THIS PLAN”明确要求将随请求给出的产品、架构、里程碑和测试决定落入仓库。本注册表记录的是批准的决策；M3–M12 的实现状态仍以 [milestone plan](../delivery/milestone-plan.md) 和可复现证据为准。

同日，`project-owner` 明确要求实施 Q0 质量设计计划，批准了 Q0 前置、四级严重度和 readiness 后置的阶段安排；同时要求三份质量文档先保持 `in-review`，经单独审阅后才生效。因此 DEC-010 的时序决定已批准，但 Q0 内容尚未批准。

`project-owner` 于 2026-07-28 明确批准 Q0 三份质量文档和两份 delivery 修订，DEC-010 的内容门禁随之生效并开放 M3。该批准不构成任何测试、浏览器或 readiness 通过证据。

## Execution Evidence

2026-07-28，DEC-011–DEC-013 约束下的首个 [M3 canonical run](../quality/evidence-index.md) 在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过。`project-owner` 随后明确批准该 evidence 与 working agreements，M3 据此关闭并开放 M4。该批准不是新的产品或架构决定，也不构成 Edge、M4–M11 或 readiness 通过。

同日，`project-owner` 明确要求实施 M4 计划，DEC-014 与 ADR-0001 的 M4 运行策略据此生效。M4 源码存在不等同于里程碑通过；仍需干净 commit canonical run、evidence 登记和 owner 批准。

M4 dirty-worktree provisional suite 随后通过，证明当前实现值得进入提交与 canonical 复跑步骤；由于它不绑定干净 commit，DEC-013 要求下不作为正式 evidence。

2026-07-29，`npm run eval:m4` 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上 13/13 步骤通过，正式记录已追加到 [evidence index](../quality/evidence-index.md)。`project-owner` 随后明确批准 M4 evidence 与 working agreements，M4 据此关闭，ADR-0003 对应的 M5 hybrid recovery 开始实施；M5 仍需自己的 provisional、clean-commit canonical 和 owner 审批。

同日，M5 dirty-worktree provisional suite 16/16 通过。依据 DEC-013，它只作为实现反馈；原生权限人工检查、用户提交、clean-commit canonical、正式 evidence 和 owner 审批仍是 M5 的关闭条件。

随后 `npm run eval:m5` 在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上 16/16 通过，正式记录已追加到 [evidence index](../quality/evidence-index.md)。`project-owner` 于 2026-07-29 确认 Chrome 原生权限人工检查通过，并明确批准 M5 evidence 与 working agreements；M5 据此关闭并开放 M6。

同次人工检查中，一段超出 DEC-006“约 15 分钟”支持边界的本地压力输入未开始播放。依据 DEC-015，该观察不计入 M5 pass/fail，不表示长音频必须失败，也不扩大支持范围；若支持范围内的有效格式复现，或失败破坏当前会话与其他歌曲可用性，则重新进入缺陷调查。

同日，`project-owner` 以“按计划执行”批准并要求实施 M6 详细计划，DEC-016 据此生效。实现源码和专项测试存在只表示进入 `In Progress`；依据 DEC-013，仍需 dirty-worktree provisional、用户提交、clean-commit canonical、正式 evidence index 与 owner 审批后才能关闭 M6。

2026-07-30，DEC-013 约束下的 M6 clean-commit canonical run 已 20/20 通过并登记到 [evidence](../quality/evidence-index.md)。`project-owner` 随后明确批准 M6 canonical evidence、working agreements、system map 与 glossary，并同意将 M6 标记为 `Complete`、开放 M7；M7 在明确开始实现前保持 `Planned`。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”明确要求实施 M7 三卡学习切片，并批准四槽三活动特征、首次默认三卡、已保存空工作区恢复为空及完整四特征场景顺延 M8 的决定。DEC-017 据此生效，M7 改为 `In Progress`；该授权不构成 M7 evidence 批准，也不开放 M8。

2026-08-21，`project-owner` 确认卡片选择/替换、zoom/pan、鼠标与键盘 seek、刷新恢复均通过，并提交 L1/L2/L3 三条正确解释；随后明确批准 M7 canonical evidence、关闭 M7并开放 M8。owner 又选择项目内 Flux 与零能量统一为 0，并要求执行 M8 完整计划。DEC-018 据此生效，M8 改为 `In Progress`；M8 evidence 在 clean canonical 与后续 owner 审批前不得标记 approved。

同日，DEC-018 的实现、golden 与 clean canonical 28/28 已完成，R-020 产品阻断标记为 `Mitigated`。M8 evidence 仍为 `in-review`，等待 Windows Chrome 补偿验证与 owner 批准；该执行事实不开放 M9。

随后 `project-owner` 批准 M8 canonical evidence 与界面稳定化结果，同意将 M8 标记为 `Complete` 并开放 M9。DEC-018 据此完成审批；R-021 由 Windows Chrome owner 签字关闭，M9 在明确开始实现前保持 `Planned`。

同次请求中，`project-owner` 明确要求实施 M9 计划，并把非首页导航栏背景模糊列为 M9 Slice 0。DEC-019 据此生效，M9 改为 `In Progress`；M8 canonical 身份不重新打开，M9 仍需自己的 provisional、clean canonical、in-review evidence 与 owner 审批。

2026-08-23，`project-owner` 明确批准 M9 canonical evidence 与非首页导航栏模糊效果，同意将 M9 标记为 `Complete` 并开放 M10。该批准关闭 DEC-019 的执行门禁，不重写 M9 canonical 身份，也不构成 M10 或 release readiness 通过。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”明确要求实施 M10，并确认 Complex Spectrum 完整展示 1024 bins。DEC-020 据此生效，M10 改为 `In Progress`；M10 provisional、clean canonical、`in-review` evidence 与 owner 审批仍分别必需。

随后 M10 provisional 与 clean canonical 均 36/36 通过，DEC-020 的完整 1024-bin 决策已由浏览器自动化复核，正式 evidence 为 `in-review`。owner 人工任务与审批仍未完成，因此 M10 保持 `In Progress`，M11 保持 `Planned`。

2026-08-25，`project-owner` 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”该批准关闭 DEC-020 的执行门禁，不改变 M10 canonical 身份，也不构成 Edge、M11 或 release readiness 通过；M11 在明确开始实施前保持 `Planned`。

同日，owner 确认 Edge 已安装并明确要求开始 M11 最终加固。该执行授权把 M11 改为 `In Progress`；真实 Edge 自动化、原生权限人工矩阵和 clean canonical 完成前，不形成新的 readiness 决策。

M11 clean canonical `M11-2026-08-25T10-05-12-783Z-99c67792` 随后在真实 Chrome/Edge 上 38/38 通过并登记为 `in-review`。该执行证据关闭“缺少真实 Edge 自动化”的缺口，但不构成 M11 owner 批准或 readiness 决策；原生 Edge 权限与辅助技术人工验收仍是下一门禁。

2026-08-26，`project-owner` 明确回复：“我批准 M11 canonical evidence、Edge 原生权限与最终加固结果；同意将 M11 标记为 Complete 并创建 release-readiness。”DEC-021 据此生效；M11 关闭。该决定只授权创建 readiness review，不表示其拟议豁免已经批准，也不构成生产发布决定。

同日，`project-owner` 明确回复：“我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。”DEC-022 据此生效，W-001–W-007 获接受，R-019 只针对当前 Analyzer 候选改为 `Accepted`。该决定允许开始 Editor 产品意图，不授权生产部署，也不授权 Editor 架构或代码。

随后 owner 要求按 Editor E0 范围事件修订计划更新产品意图。DEC-023 记录该草案：点事件与长音色/效果范围事件进入首期路线，范围创建使用严格向后的两次点击、`Esc`/空白右键取消、自适应网格端点和同类不重叠。

同日，`project-owner` 明确回复：“我批准 Editor E0 产品意图、点事件与范围事件规则、成功指标和开放问题；同意进入 Editor E0 架构设计。”DEC-023、PROD-014E 与 PROD-020 据此获批并开放 system design；该批准不构成架构、delivery、实现、质量或 Editor readiness 通过。

随后 ADR-0006–0009 与 Editor project/interaction 子契约按已批准产品范围进入评审：它们分别固定 runtime lease、JSON/草稿、秒数/tempo/event 和 overlay renderer 边界。`project-owner` 于 2026-08-26 明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”上述 ADR 与架构契约据此获批；R-022–R-027 继续为 `Open`，execution planning 已开放，但 E1 代码仍保持关闭。

同次 delivery planning 请求中，owner 固定 E6 10,000 事件容量门禁、overlay 默认 35%/最小 12%，并要求 E1–E6 各自运行 provisional、clean canonical 与 owner 审批；DEC-024 据此生效。四份 Editor delivery 文档仍为 `in-review`，DEC-024 不构成 E1 开工授权。

随后 `project-owner` 明确回复：“我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。”DEC-025 据此生效，四份 Editor delivery 文档改为 `approved`，E0-D 改为 `Complete`、E1 改为 `In Progress`。该决定不构成 E1 功能、canonical 或风险缓解证据，也不开放 E2。

DEC-025 约束下的 E1 实现已提交，clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过并登记到 Editor evidence index。该执行事实不是新产品/架构决策；owner 尚未批准人工门禁，因此 R-022/R-023/R-027 和 E1 状态不提前改变，E2 仍未开放。

同日，`project-owner` 明确回复：“我批准 Editor E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；同意将 E1 标记为 Complete 并开放 E2。”E1 据此关闭，R-022/R-023 改为 `Mitigated`，E2 改为 `In Progress`。owner 同时选择 DEC-026 的 BPM/拍号与无网格 boundary 语义；R-024/R-026/R-027 和 E3 门禁不因此提前关闭。

DEC-026 约束下的 E2 实现已提交，clean canonical `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 在 commit `9fc5c0a81fcf90abfbc665412277147cd958200f` 上 22/22 通过并登记到 Editor evidence index。该执行事实不是新产品或架构决策；owner 尚未批准人工门禁，因此 R-024/R-026/R-027、E2 状态和 E3 门禁不提前改变。

2026-08-27，`project-owner` 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 结果并开放 E3；DEC-027 据此生效。E2 改为 `Complete`，R-026 改为 `Mitigated`，E3 改为 `In Progress`；该决定不构成 E3 实现或 evidence，也不开放 E4。

同日，E3 implementation commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 与 clean canonical `E3-2026-08-27T02-53-58-176Z-c670ddf5` 已形成，26/26 通过，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`。该执行事实不新增决策；DEC-027 的 owner approval 门禁仍未满足，E3 不关闭、E4 不开放。

同日，`project-owner` 明确批准 E3 canonical evidence、point lane、inner class、自适应网格与点标记结果，DEC-028 据此关闭 E3 并开放 E4。随后 owner 明确批准 E4 canonical evidence、21 项 overlay、三手柄、pointer-through 与错误隔离结果，DEC-029 据此关闭 E4 并开放 E5。

E5 clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 随后在 implementation commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 上 35/35 通过。`project-owner` 明确批准 E5 canonical evidence、范围事件创建/调整、重叠校验、键盘与持久化结果；DEC-030 据此关闭 E5 并开放 E6。该决定不构成 E6 evidence 或 Editor release-readiness。

同日，owner 通过 M12 实施计划批准 DEC-031，并要求 agent 自行提交及完成后续、无需推送远程。首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 暴露 M7 短 fixture 未保证播放输入的测试前置条件；失败 artifact 保留。修复 commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 先使目标用例连续 5/5 通过，再由 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 完成 12/12，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`。DEC-031 据此完成验证，M12 关闭、R-028 缓解、Analyzer readiness 恢复；PROD-015 与 Editor E6 不被本决策覆盖。

2026-08-28，`project-owner` 明确要求“可以先批准之前的e6修改”，本次回复据此作为 E6 canonical、原生文件、辅助技术与长会话人工门禁的完整批准；E6 关闭，R-024、R-025、R-027 改为 `Mitigated`。同一轮需求要求 Editor 参考编曲工作台的密度与线性分区方式，DEC-032 据此开放 E7。该批准不改写 E6 canonical，也不授权生产上线；Editor release-readiness 延后到 E7 获批之后。

## Historical Evidence Gap

在本轮 ADR 之前，仓库没有可追溯记录说明当前路由、三种 MusicBar 样式、Analyzer 试验组件或 Editor/Visualizer 占位分别由谁批准。它们只能作为当前代码事实，不能被反推为已批准产品范围。若后续保留、替代或删除这些行为，应在对应实施切片中记录新决策和回归证据。
