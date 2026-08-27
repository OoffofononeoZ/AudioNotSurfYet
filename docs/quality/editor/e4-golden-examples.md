---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e4-eval-plan.md"
  - "docs/architecture/adrs/0009-editor-overlay-renderer-boundary.md"
next_action: "生成并核对 E4 fixture、renderer family 与 overlay 交互 golden"
---

# Editor E4 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E4-G01 | success | overlay `null` | active set 只有 Buffer；不显示 overlay canvas | 固定关闭语义 |
| E4-G02 | dedupe | overlay 选择 Buffer | active set 仍只有一个 Buffer | 防止重复 Worker 特征 |
| E4-G03 | success | 任一非 Buffer 特征 | active set 为 Buffer + 该特征，选择器只显示一个当前项 | 固定单选契约 |
| E4-G04 | exhaustiveness | 21 个 FeatureId | 全部映射到 scalar、frequency/category、waveform、loudness 或 complex renderer | 防止 registry/UI 漏项 |
| E4-G05 | boundary | top 0.10、height 0.35 | overlay 位于标记区域 10%–45% | 固定默认几何 |
| E4-G06 | boundary | 把 top/bottom 拖过边界 | top/height 被限制且 height 不小于 0.12 | 防止不可恢复布局 |
| E4-G07 | keyboard | 手柄方向键与 Shift | 普通变化 0.01，Shift 变化 0.05，结果仍合法 | 固定键盘等价操作 |
| E4-G08 | cancel | pointercancel/blur/Esc | 恢复拖动前 top/height，不遗留 capture/pressed | 固定异常清理 |
| E4-G09 | pointer-through | Canvas 上左键 point cell | 与隐藏 overlay 时创建相同规范化秒数的 point | 证明覆盖层不夺取编辑 |
| E4-G10 | geometry | zoom/DPR/resize 后同一时间 | overlay cursor、grid 和 point x 差不超过 1 CSS px | 防止视觉误导 |
| E4-G11 | stale | 快速从 RMS 切到 Chroma | RMS 迟到 series/exact 不显示为 Chroma | 固定 identity 隔离 |
| E4-G12 | failure | overlay renderer payload shape 错误 | 只显示可重试 overlay 错误，Buffer/point/播放仍可用 | 固定故障边界 |
| E4-G13 | persistence | 保存 feature/top/height 后刷新 | overlay 与 viewport/point 一并恢复 | 固定草稿事实 |
| E4-G14 | route | Editor → Analyzer → Editor | Analyzer 卡片未被改写，Editor 保存 overlay 恢复 | 固定 consumer 所有权 |

版本化 fixture `editor-e4-overlay.v1.json` 固定歌曲内容、point 工程、共享时间锚点和 renderer family 覆盖；运行时生成 `artifacts/fixtures/editor-e4-overlay-v1.wav` 与匹配的 JSON 工程，不提交大型二进制。
