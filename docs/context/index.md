---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "AGENTS.md"
next_action: "由项目负责人确认仓库 owner、文档 review cadence 和当前产品阶段"
---

# Repository Context Index

## Purpose

AudioNotSurfYet 当前是一个单仓库浏览器前端：用户选择本地音频后，应用提供播放队列、元数据、进度与音量控制，并把实时能量用于音乐条和背景可视化。该描述来自当前代码，不代表已获批准的产品定位。

本目录只维护仓库本地事实、边界和工作记忆；生命周期路由与通用方法由 [AGENTS.md](../../AGENTS.md) 负责。

## Current Stage

- 阶段一仓库上下文：本目录文档均为 `draft`，owner 与 review cadence 待确认。
- 阶段二产品意图：`docs/product/` 已建立草稿，但 problem brief 与 scope 尚未批准。
- 阶段三及以后：门禁未满足，未创建实质文档。

## Key Documents

| Path | Purpose | Owner | Review cadence |
| --- | --- | --- | --- |
| [AGENTS.md](../../AGENTS.md) | 根工作指南和 Harness 入口 | unknown | 待人工确认 |
| [glossary.md](glossary.md) | 项目词汇与代码含义 | unknown | 术语或状态含义变化时 |
| [system-map.md](system-map.md) | 子系统、接口和外部依赖 | unknown | 架构边界变化时 |
| [decision-registry.md](decision-registry.md) | 已确认工程决策及复查触发器 | unknown | 形成或撤销重要决策时 |
| [working-agreements.md](working-agreements.md) | 本仓库开发、验证和 Git 约定 | unknown | 工具链或验证能力变化时 |
| [problem-brief.md](../product/problem-brief.md) | 产品问题草稿 | unknown | 产品评审时 |
| [scope.md](../product/scope.md) | 范围与非目标草稿 | unknown | 范围评审时 |
| [success-metrics.md](../product/success-metrics.md) | 候选成功信号 | unknown | 指标评审时 |
| [open-questions.md](../product/open-questions.md) | 需人工决定的产品问题 | unknown | 每次阶段评审前 |

## Repository Areas

| Area | What lives here | Primary owner | Supporting docs |
| --- | --- | --- | --- |
| `src/views/` | 路由页面和试验入口 | unknown | [system map](system-map.md) |
| `src/layouts/` | Header、页面内容与 MusicBar 的共享外壳 | unknown | [system map](system-map.md) |
| `src/components/` | 播放 UI、列表、动画及 Canvas/WebGL 可视化 | unknown | [glossary](glossary.md) |
| `src/audio/` | Web Audio 播放、时域/频域数据接口 | unknown | [system map](system-map.md) |
| `src/stores/` | 持久化配置与共享音频能量 | unknown | [system map](system-map.md) |
| `src/utils/` | 事件总线与纯工具函数 | unknown | [glossary](glossary.md) |
| `src/data/` | Analyzer 使用的静态 Meyda 说明 | unknown | [system map](system-map.md) |
| `skills/audio-visualizer-dev/` | 本项目专属开发 Skill 源码 | unknown | [SKILL.md](../../skills/audio-visualizer-dev/SKILL.md) |

## Lifecycle Entry Points

- Product intent：[problem-brief.md](../product/problem-brief.md)
- System design：`docs/architecture/system-design.md`，门禁满足后再创建
- Delivery planning：`docs/delivery/execution-plan.md`，门禁满足后再创建
- Quality gates：`docs/quality/release-readiness.md`，门禁满足后再创建
- Release operations：`docs/release/launch-plan.md`，门禁满足后再创建
- Retrospectives：`docs/retrospectives/post-release-review.md`，有证据后再创建

## Open Documentation Gaps

- 项目、产品、子系统和文档均没有已证实 owner。
- 没有正式 CI、测试目录、部署说明、浏览器支持矩阵或性能预算。
- Analyzer、Visualizer、Editor 与试验页的产品边界未批准。
- 具体产品决策集中在 [产品开放问题](../product/open-questions.md)；工程事实缺口集中在 [Skill 项目差异](../../skills/audio-visualizer-dev/references/99-open-questions-and-project-deltas.md)。
