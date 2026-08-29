---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/architecture/adrs/0010-editor-compact-workbench.md"
  - "docs/architecture/adrs/0011-editor-fullscreen-overlay.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e6-eval-plan.md"
next_action: "实现并运行修订版 46 步 E7 canonical；旧 44/44 run 只作 pre-revision"
---

# Editor E7 Eval Plan

## Boundary

E7 评价 Editor 紧凑工作台与其全屏悬浮分析层：双层工具栏、平面分区、紧凑时间轴/tempo/point/range、窗口级 fixed overlay、复合开关/菜单、按歌曲 visibility 与响应式。路由、JSON V1、IndexedDB 版本、播放 lease、tempo、point/range、Meyda 和 E6 支持范围不得改变。参考图只用于人工方向判断，不作为资产或像素 golden。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E7-EV-TOOLBAR | ready 状态双层工具栏 | normal + long metadata + persistence/error | Chrome/Edge computed geometry | 两行合计 `<=84px`；信息可截断但状态和操作可达 | AC-E701；R-025 |
| E7-EV-DENSITY | 平面 section、控制与轨道密度 | ready + empty + conflict + multiple lanes | computed style + DOM probe | 主区域 radius `0–2px`；控件 `<=4px`；point/range 行 `44px`；桌面波形 `176px` | AC-E701/E702；R-024/025 |
| E7-EV-RESPONSIVE | 390/1024/1280/1920 与 DPR | narrow + desktop + wide + resize | Chrome/Edge E2E | 无关键遮挡；窄屏只有受控横向滚动；Canvas backing store 正确 | AC-E703；R-024 |
| E7-EV-TASK | tempo、point/range、overlay、file、keyboard | pointer + keyboard + reduced motion | E7 task + E1–E6 regression | 行为、焦点、右键优先级和 pointer-through 不变 | AC-E704；R-024/025/027 |
| E7-EV-STRESS | 10,000 事件与 route 生命周期 | capacity + resource | E6 browser regression | 反馈 `<=100ms`；长任务 0；可见 DOM/资源不单调累积 | AC-E704；R-025/027 |
| E7-EV-ADJACENT | Analyzer M12 与全量历史契约 | regression | 44 步 clean canonical | E6 40 步 + E7 Chrome/Edge + M12 unit/双浏览器全部通过 | AC-E704；R-028 |
| E7-EV-VISIBILITY | 旧草稿默认、hash 隔离、同歌恢复与写失败 | success + missing + quota/abort + import | unit/integration | featureId 保留；visibility 本地隔离；失败只降级 persistence | AC-E706/E707；R-023/027 |
| E7-EV-FULLSCREEN | fixed root、全屏灰层、复合入口和临时菜单 | scroll + keyboard + outside/Escape + route | Chrome/Edge geometry/a11y | root/图形/控件纵向滚动不动；无常驻 select；21 项可达 | AC-E705/E706；R-024/025 |
| E7-EV-ALIGNMENT | 全视口 Canvas 与时间列裁剪 | zoom + pan + resize + horizontal scroll | Chrome/Edge coordinate probe | 横向映射误差 `<=1 CSS px`，背景/图形 pointer-through | AC-E708；R-024/025 |

## Evidence Contract

- `eval:e7:provisional` 允许 dirty worktree，只作为实现反馈；正式 evidence 只接受 clean commit 上的 `eval:e7`。
- 修订版 canonical 固定 46 步：E7 unit、E7 integration、E7 Chrome、E7 Edge、M12 unit、M12 双浏览器与 E6 40 步基线。
- 记录 run ID、commit、环境、双浏览器、toolbar/row/waveform/radius、geometry、Canvas、feedback、long task、DOM、resource、日志和 summary SHA-256。
- 截图只写入 Git 忽略 artifact 供 owner 复核，不作为跨系统唯一判据。
- E7 evidence 获 owner 批准前保持 `In Progress`，不得创建包含 Editor 的 release-readiness。

## Execution Record

- Dirty-worktree provisional `E7-2026-08-28T14-52-46-743Z-3fdb8ac6-provisional` 44/44 通过。
- Clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 在 commit `78bc7f06311a09948e5efae941a14599305b81a5` 上 44/44 通过，起止工作树干净；summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`。
- 2026-08-29 的全屏浮层修订改变了 UI 挂载、analysis active set 与本地偏好边界，因此上述 run 现标记为 `pre-revision`，不再是正式候选；不得删除或改写其 artifact。
- Chrome/Edge 的密度结果一致：toolbar `79px`、control `30px`、point/range row `44px`、desktop waveform `176px`、major radius `0px`，并覆盖 390/1024/1280/1920。
- 10,000-event 基线最大反馈为 Chrome `6.7ms` / Edge `4.5ms`，归因长任务为 `0`；E1–E6 与 M12 相邻回归均通过。
- 修订版 46 步 clean canonical、evidence 与 owner 任务通过前，E7 保持 `In Progress`。
