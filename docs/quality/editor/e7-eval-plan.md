---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/architecture/adrs/0010-editor-compact-workbench.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e6-eval-plan.md"
next_action: "由 owner 在 Chrome/Edge 复核紧凑工作台；批准前 E7 保持 In Progress"
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

## Execution Record

- Dirty-worktree provisional `E7-2026-08-28T14-52-46-743Z-3fdb8ac6-provisional` 44/44 通过。
- Clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 在 commit `78bc7f06311a09948e5efae941a14599305b81a5` 上 44/44 通过，起止工作树干净；summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`。
- Chrome/Edge 的密度结果一致：toolbar `79px`、control `30px`、point/range row `44px`、desktop waveform `176px`、major radius `0px`，并覆盖 390/1024/1280/1920。
- 10,000-event 基线最大反馈为 Chrome `6.7ms` / Edge `4.5ms`，归因长任务为 `0`；E1–E6 与 M12 相邻回归均通过。
- 该执行记录只形成 `in-review` evidence；owner 视觉任务与批准仍是 E7 唯一剩余门禁。
