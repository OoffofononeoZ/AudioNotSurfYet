---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/context/index.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/delivery/execution-plan.md"
next_action: "M3 开始时记录测试工具和 fixture provenance 决策；任何核心决策变化先复核下游文档"
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
| DEC-009 | 2026-07-24 | 当前只批准 execution planning；不预建 quality/release/retrospective，也不自动开始代码实现 | project-owner | active | [Milestone plan](../delivery/milestone-plan.md) | M11 证据完成或 owner 明确启动下一阶段 |

## Approval Evidence

`project-owner` 于 2026-07-24 通过“PLEASE IMPLEMENT THIS PLAN”明确要求将随请求给出的产品、架构、里程碑和测试决定落入仓库。本注册表记录的是批准的决策；M3–M11 的实现状态仍以 [milestone plan](../delivery/milestone-plan.md) 和可复现证据为准。

## Historical Evidence Gap

在本轮 ADR 之前，仓库没有可追溯记录说明当前路由、三种 MusicBar 样式、Analyzer 试验组件或 Editor/Visualizer 占位分别由谁批准。它们只能作为当前代码事实，不能被反推为已批准产品范围。若后续保留、替代或删除这些行为，应在对应实施切片中记录新决策和回归证据。
