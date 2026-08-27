---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/adrs/0009-editor-overlay-renderer-boundary.md"
  - "docs/architecture/risk-register.md"
next_action: "E5 回归 E4 renderer、consumer、geometry、pointer-through 与错误隔离契约"
---

# Editor E4 Eval Plan

## Boundary

本计划只评价 E4 shared Canvas renderer、21 项单选 overlay、Buffer 去重、三手柄、pointer-through、exact cursor 与单层错误隔离。E1–E3 是已批准回归基线；E5 range 编辑、E6 Edge/10,000 事件和整体 readiness 不在本轮完成范围。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E4-EV-RENDER | 21 项与六类 renderer 共用纯 adapter | success + shape failure | registry/renderer unit + Chrome canvas | 21/21 有唯一 renderer；错误 payload 显式失败；Analyzer 卡片回归不漂移 | AC-E401/E405；R-024 |
| E4-EV-CONSUMER | Editor 活动集与 Buffer-first | success + rapid switch + cache/stale | controller/coordinator integration | active set 始终为 `buffer` 或 `buffer + selected`；Buffer 不重复；旧 feature/generation 不可见 | AC-E401/E404；R-027 |
| E4-EV-BOUNDS | top/move/bottom 三手柄 | success + clamp + cancel | pure bounds + pointer/keyboard E2E | 0.10/0.35/0.12、1%/5%、`top + height <= 1`；取消恢复原值 | AC-E402；R-024/025 |
| E4-EV-HIT | pointer-through 与共享 geometry | success + zoom/DPR/resize | layered hit-test + DOM/Canvas probe | selector/手柄外命中相同 point cell；任意层 x 差 `<=1 CSS px` | AC-E403；R-024/025 |
| E4-EV-CURSOR | exact cursor cadence 与 stale | playing + pause/seek + switch | fake clock integration + Chrome | 单 feature 40ms 节流；显式变化立即刷新；迟到结果不覆盖 | AC-E404；R-027 |
| E4-EV-ISOLATE | renderer/analysis/context 故障隔离 | recoverable failure | injection + Chrome | overlay 可重试；Buffer 波形、point、播放、草稿和导出继续 | AC-E405；R-024/027 |
| E4-EV-REGRESSION | E1–E3 与相邻 Analyzer | regression | canonical suite | route/lease/tempo/point、M3/M4/M6/M11 适用门禁无回归 | AC-E401–405 |

## Evidence Contract

- dirty worktree 只运行 `eval:e4:provisional`；正式 evidence 只接受 clean implementation commit 上的 `eval:e4`。
- canonical 记录 run ID、实现 commit、浏览器/Node/npm/Meyda、非敏感硬件摘要、步骤结果、geometry/feedback/cache/stale 数据、日志和 summary SHA-256。
- E4 专项使用真实 Chrome；Edge、原生 picker、辅助技术长会话、10,000 事件与完整资源循环留到 E6，并在 evidence 中明确为未自动化范围。
- `project-owner` 于 2026-08-27 明确批准 E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果；E4 据此关闭并开放 E5。真实 Edge、10,000 事件、原生 picker 与辅助技术长会话仍留到 E6。
