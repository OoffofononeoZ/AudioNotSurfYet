---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "docs/context/index.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/delivery/execution-plan.md"
next_action: "完成 DEC-016 的 canonical evidence；owner 批准前保持 M6 In Progress"
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
| DEC-008 | 2026-07-24 | 实施采用 M1–M11 相对门禁，不承诺日期；M3 从测试基础开始，M7 未通过不得扩展后续特征 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | 依赖、里程碑、验收门禁或交付优先级改变 |
| DEC-009 | 2026-07-24 | 当前只批准 execution planning；不预建 quality/release/retrospective，也不自动开始代码实现 | project-owner | superseded by DEC-010 | [Milestone plan](../delivery/milestone-plan.md) | 已由 owner 决定前置三份 quality design |
| DEC-010 | 2026-07-24 | 在 M3 前增加 Q0：前置 eval plan、golden examples、failure taxonomy；三份文档单独批准后开放 M3，release-readiness 仍等待 M11 证据 | project-owner | approved | [Eval plan](../quality/eval-plan.md) | 验收/测试纪律变化，或 owner 改变 Q0/readiness 时序 |
| DEC-011 | 2026-07-28 | M3 只建设本地门禁；使用 Vitest、fake-indexeddb 和正式 Chrome channel，Edge 缺失保持 evidence gap，不以 Chromium 代替 | project-owner | approved | [Tests README](../../tests/README.md) | CI 范围、浏览器矩阵或测试工具改变 |
| DEC-012 | 2026-07-28 | canonical 短 fixture 由确定性 PCM 经系统 FFmpeg 生成并使用 CC0-1.0；用户音频默认仅本地使用 | project-owner | approved | [Fixture manifest](../../tests/fixtures/fixture-manifest.json) | 编码器、fixture 来源、许可或入库政策改变 |
| DEC-013 | 2026-07-28 | 未提交状态只产生 provisional run；用户自行提交后对干净 commit 复跑，才创建正式 evidence index | project-owner | approved | [Working agreements](working-agreements.md) | Git 授权或 evidence identity 政策改变 |
| DEC-014 | 2026-07-28 | M4 快速切歌最后操作生效，非空追加不中断当前播放，metadata 失败继续解码，decode/unsupported 使用非阻塞消息 | project-owner | approved | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 队列、竞态或错误交互语义改变 |
| DEC-015 | 2026-07-29 | M5 原生文件选择不提供隐藏 input fallback；本地音频保持 Git 忽略，超出约 15 分钟的样本只作 best-effort 压力观察且不扩大范围 | project-owner | approved | [Working agreements](working-agreements.md) | 文件选择兼容策略、本地样本政策或支持时长改变 |
| DEC-016 | 2026-07-29 | M6 建立 21 项穷尽 registry、四项 Worker 支持、六类 compact codec、空默认活动集、完整 cache identity、generation 隔离和 Worker exact cursor；不实现 M7 UI，不升级 Meyda 或增加 spectralFlux fallback | project-owner | approved | [Interface contracts](../architecture/interface-contracts.md) | M6 feature 支持、frame/config、codec、缓存、精确值或 fallback 策略改变 |

## Approval Evidence

`project-owner` 于 2026-07-24 通过“PLEASE IMPLEMENT THIS PLAN”明确要求将随请求给出的产品、架构、里程碑和测试决定落入仓库。本注册表记录的是批准的决策；M3–M11 的实现状态仍以 [milestone plan](../delivery/milestone-plan.md) 和可复现证据为准。

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

## Historical Evidence Gap

在本轮 ADR 之前，仓库没有可追溯记录说明当前路由、三种 MusicBar 样式、Analyzer 试验组件或 Editor/Visualizer 占位分别由谁批准。它们只能作为当前代码事实，不能被反推为已批准产品范围。若后续保留、替代或删除这些行为，应在对应实施切片中记录新决策和回归证据。
