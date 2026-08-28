---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/risk-register.md"
  - "docs/quality/editor/e5-eval-plan.md"
next_action: "保留 E6 approved canonical；E7 独立验证紧凑工作台布局"
---

# Editor E6 Eval Plan

## Boundary

E6 只加固已批准的 E1–E5 能力：双浏览器、MP3/WAV/FLAC、原生工程文件流程、10,000 事件、性能、资源、无障碍与完整回归。不得新增工程格式、schema、数据库、分析特征、range 合并/裁剪、云同步、第二 AudioEngine/Worker 或兼容 fallback。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E6-EV-FORMAT | MP3/WAV/FLAC 的 Editor 入口、循环、分析和恢复 | success + unsupported/corrupt failure | 真实 Chrome/Edge E2E + native manual | 三格式均绑定正确歌曲；失败不破坏队列、工程或草稿 | AC-E601；R-022/023/027 |
| E6-EV-NATIVE | 原生音频/JSON picker、取消、覆盖与离页提示 | success + cancel + permission/overwrite exception | owner Chrome/Edge manual matrix | 取消无副作用；错误 identity/JSON 不替换工程；pending write 才提示离页 | AC-E601/E606；R-023 |
| E6-EV-STRESS | 15 分钟、20 lanes、160 classes、10,000 events | capacity + viewport edge + tail | deterministic generator + integration/browser | point/range 各 5,000；事实、ID、重叠与 round-trip 全部保持 | AC-E602/E603；R-023/025 |
| E6-EV-FEEDBACK | 压力下 zoom/pan/seek/create/drag/class/overlay/autosave | interaction + long-task attribution | PerformanceObserver + browser timing | 每项可见反馈 `<=100ms`；Editor/分析归因任务无单个 `>50ms` | AC-E602；R-025 |
| E6-EV-DOM | viewport-visible point/range DOM | full/zoomed/edge viewport | expected-visible model + DOM counters | 交互节点仅为相交事件及有限 focus/preview/handle 节点，不实例化 10,000 项 | AC-E603；R-025 |
| E6-EV-RESOURCE | Editor/Analyzer/Home、换歌与 overlay 生命周期 | 20-cycle + stale/cancel | instrumented Chrome/Edge E2E | 单 AudioContext/Worker；RAF/Canvas/Object URL/Observer/listener 不单调累积并回到稳定基线 | AC-E604；R-022/027 |
| E6-EV-GEOMETRY | waveform/grid/point/range/overlay 共享时间坐标 | 1024/1280/1920 + DPR + resize | geometry probe + Canvas backing-store inspection | 同一时间任意两层 x 差 `<=1 CSS px`；无关键遮挡或横向溢出 | AC-E605；R-024 |
| E6-EV-A11Y | 键盘、焦点、非颜色状态、reduced motion、辅助技术名称 | success + cleanup + native AT gap | Playwright + owner Chrome/Edge manual | 核心逆向标注任务全键盘可达；焦点不丢失；名称清晰；动画遵循偏好 | AC-E605/E606；R-025 |
| E6-EV-REGRESSION | E1–E6 与 M3–M11 关键契约 | success + failure + boundary | 40 步 clean canonical | 全部步骤 pass；dirty worktree canonical 必须拒绝；身份与 artifact hash 完整 | AC-E606；R-022–R-027 |

## Deterministic Stress Contract

- 固定 seed `0xE6002026`，duration `900s`，20 lanes，point/range 各 10 lanes，每 lane 8 inner classes。
- 精确生成 5,000 point 与 5,000 range；每个 class 分配 62 或 63 项，确保总数准确。
- 同一 range class 使用半开相邻或留隙区间，不重叠；不同 class 包含重叠；包含 0 秒、歌曲尾部、viewport 内外和跨 tempo segment 项。
- 大型 WAV、工程、trace 与 eval logs 只写入 Git 忽略的 `artifacts/`；版本化文件只保存生成参数、预期摘要和 SHA-256。

## Evidence Contract

- `eval:e6:provisional` 允许 dirty worktree，只作实现反馈；正式 evidence 只接受 clean implementation commit 上的 `eval:e6`。
- canonical 固定 40 步：E5 的 35 步基线，加 E6 unit、integration、Chrome、Edge 与真实 Edge M3–M11 关键回归。
- 记录 run ID、commit、Chrome/Edge/Node/npm/Meyda、脱敏硬件、格式、geometry、feedback、long task、DOM、resource、日志与 summary SHA-256。
- 原生 OS picker、保存覆盖提示、浏览器离页提示和辅助技术无法完全自动化；必须记录浏览器版本、步骤、结果、owner 与残余风险，OPFS/stub 不得替代签字。
- 自动化与人工证据获批前 E6 保持 `In Progress`，不得创建包含 Editor 的 release-readiness 结论。
- clean canonical `E6-2026-08-27T15-52-33-466Z-17d7fe10` 已 40/40 通过；`project-owner` 于 2026-08-28 批准 E6 canonical 与人工补偿门禁，本计划据此改为 `approved`。后续紧凑布局属于 E7，不改写本计划或本 run。
