---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e4-eval-plan.md"
  - "docs/quality/editor/e3-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "E5/E6 回归失败继续复用 renderer、consumer、bounds、hit、cursor 与 isolation 分类"
---

# Editor E4 Failure Taxonomy

E4 继续沿用 E1–E3 的 `EFT-DRAFT`、`EFT-GEOMETRY`、`EFT-POINTER`、`EFT-FOCUS` 与 `EFT-REGRESSION`，并增加以下稳定分类。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-RENDERER | shared renderer | feature 漏映射、错误 family、payload shape 未失败或 Analyzer/Editor 绘制漂移 | exhaustive unit、renderer golden、browser canvas | 修复纯 adapter；不复制第二套 renderer |
| EFT-CONSUMER | analysis consumer | active set 不符合 Buffer + 单 feature、污染 Analyzer workspace、旧 generation 可见 | coordinator integration、route E2E | 修复 lease/generation；不得新增 Worker |
| EFT-OVERLAY-BOUNDS | overlay bounds | top/height 越界、低于最小高度、三手柄语义或键盘步长错误 | pure bounds、pointer/keyboard E2E | 修复单一 bounds 纯函数和 rollback |
| EFT-OVERLAY-HIT | pointer-through | Canvas/说明夺取 marker 事件或穿透后命中不同时间 | layered hit-test、point assertion | 收紧 pointer-events；复用共享 geometry |
| EFT-OVERLAY-CURSOR | exact cursor | cadence 超限、暂停/seek 不刷新、旧 feature/exact 覆盖当前显示 | fake clock、rapid-switch E2E | 清理 timer/value并增加 generation/request guard |
| EFT-OVERLAY-ISOLATION | failure isolation | overlay 失败导致 Buffer、point、播放、草稿或导出失效 | fault injection、browser continuation task | 保留 last-ready Buffer，收窄 error boundary |

严重度继续使用：数据损坏、错误歌曲/identity、第二 AudioContext/Worker 或底层编辑被阻断为 Blocker；几何超过 1px、键盘不可达、错误未隔离为 Major；不影响任务的视觉偏差为 Minor。2026-08-27，`project-owner` 批准 E4 canonical 与人工结果；后续回归出现 Blocker/Major 时仍须阻断对应里程碑。
