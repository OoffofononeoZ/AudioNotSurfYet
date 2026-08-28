---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/architecture/adrs/0010-editor-compact-workbench.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e6-eval-plan.md"
next_action: "完成 E7 provisional 与 clean 44 步 canonical，登记 density/geometry/feedback evidence"
---

# Editor E7 Eval Plan

## Boundary

E7 只评价 Editor 紧凑工作台表现层：双层工具栏、平面分区、紧凑时间轴/tempo/point/range/overlay 与响应式。路由、JSON V1、IndexedDB、播放/分析 lease、tempo、point/range、Meyda 和 E6 支持范围不得改变。参考图只用于人工方向判断，不作为资产或像素 golden。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E7-EV-TOOLBAR | ready 状态双层工具栏 | normal + long metadata + persistence/error | Chrome/Edge computed geometry | 两行合计 `<=84px`；信息可截断但状态和操作可达 | AC-E701；R-025 |
| E7-EV-DENSITY | 平面 section、控制与轨道密度 | ready + empty + conflict + multiple lanes | computed style + DOM probe | 主区域 radius `0–2px`；控件 `<=4px`；point/range 行 `44px`；桌面波形 `176px` | AC-E701/E702；R-024/025 |
| E7-EV-RESPONSIVE | 390/1024/1280/1920 与 DPR | narrow + desktop + wide + resize | Chrome/Edge E2E | 无关键遮挡；窄屏只有受控横向滚动；Canvas backing store 正确 | AC-E703；R-024 |
| E7-EV-TASK | tempo、point/range、overlay、file、keyboard | pointer + keyboard + reduced motion | E7 task + E1–E6 regression | 行为、焦点、右键优先级和 pointer-through 不变 | AC-E704；R-024/025/027 |
| E7-EV-STRESS | 10,000 事件与 route 生命周期 | capacity + resource | E6 browser regression | 反馈 `<=100ms`；长任务 0；可见 DOM/资源不单调累积 | AC-E704；R-025/027 |
| E7-EV-ADJACENT | Analyzer M12 与全量历史契约 | regression | 44 步 clean canonical | E6 40 步 + E7 Chrome/Edge + M12 unit/双浏览器全部通过 | AC-E704；R-028 |

## Evidence Contract

- `eval:e7:provisional` 允许 dirty worktree，只作为实现反馈；正式 evidence 只接受 clean commit 上的 `eval:e7`。
- canonical 固定 44 步：E6 40 步，加 E7 Chrome、E7 Edge、M12 unit 和 M12 双浏览器回归。
- 记录 run ID、commit、环境、双浏览器、toolbar/row/waveform/radius、geometry、Canvas、feedback、long task、DOM、resource、日志和 summary SHA-256。
- 截图只写入 Git 忽略 artifact 供 owner 复核，不作为跨系统唯一判据。
- E7 evidence 获 owner 批准前保持 `In Progress`，不得创建包含 Editor 的 release-readiness。
