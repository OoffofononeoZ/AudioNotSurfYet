---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/context/index.md"
next_action: "由项目负责人确认并补录既有产品与架构决策"
---

# Decision Registry

| Date | Decision | Owner | Status | Source doc | Revisit trigger |
| --- | --- | --- | --- | --- | --- |
| 2026-07-24 | AudioNotSurfYet 专属 Skill 源码纳入本仓库，并通过 `~/.codex/skills/audio-visualizer-dev` 软链接安装；不修改中央 skills 仓库 | unknown | active，来自用户批准计划 | [Skill](../../skills/audio-visualizer-dev/SKILL.md) | 出现第二个真实同类项目、安装位置改变或项目边界改变 |
| 2026-07-24 | 本仓库采用 Harness Engineering 阶段文档与人工门禁；阶段三不得在 problem brief 和 scope 批准前开始 | unknown | active，来自用户批准计划 | [AGENTS.md](../../AGENTS.md) | 生命周期顺序、门禁或文档位置改变 |
| 2026-07-24 | 项目文档与 Skill 默认使用中文，代码标识和命令保留原文 | unknown | active，来自用户批准计划 | [AGENTS.md](../../AGENTS.md) | 项目团队确定新的文档语言政策 |

## Missing Decision History

仓库没有 ADR 或既有决策日志，无法可靠判断当前路由、三种 MusicBar 样式、Analyzer、Editor/Visualizer 占位和部署目标分别由谁批准。补录时要链接原始证据，不从当前实现反推“已批准”。
