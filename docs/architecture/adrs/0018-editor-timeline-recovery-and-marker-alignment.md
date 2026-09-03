---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "E8 scoped 25/25 已通过；等待 clean canonical 与 owner 验收后关闭"
---

# ADR-0018: Editor Timeline Recovery and Marker Alignment

## Context

E7 紧凑工作台仍保留 176/144px 波形轨道，实际波形只占其中一部分；Editor 在 route target 初次不可用后也不会响应同一歌曲的文件恢复。点标记的菱形用 `-65%` 垂直位移并让引线参与旋转，导致视觉中心偏离事件锚点。

## Decision

- `.timeline-stage` 在宽度 `>=900px` 固定为 `88px`，在 `<900px` 固定为 `72px`。波形垂直中心为 `height / 2`，上下各保留 `6px`，振幅为 `(height - 12) / 2`。
- route target 恢复到可获取状态时，Editor 对同一 track ID 合并执行一次 `enter(trackId)`；保持 paused，不自动播放。generation 与恢复 signature 共同丢弃重复或迟到重试。
- 若 URL target 与当前可播放歌曲不同，保持不可用状态并显示“编辑当前歌曲”；只有用户点击后才用 `router.replace` 切换 URL，禁止静默 fallback。
- 点标记按钮继续以事件时间为横向锚点。14px 菱形精确使用 `translate(-50%, -50%) rotate(45deg)`；引线由按钮伪元素独立绘制，从中心下方 8px 开始，高 14px。候选 pin 使用当前候选/事件时间，不因响应式网格重算偏离所选标记。
- 时间事件、JSON V1、IndexedDB、AudioEngine、播放/分析 lease 和导入导出格式不变。

## Consequences

- Positive：时间轴只保留波形和控制所需高度；同歌恢复无需重复导航；标记、菱形和候选 pin 在 resize/zoom/pan 后保持 `<=1 CSS px` 对齐。
- Negative：依赖旧时间轴高度或固定 Y 坐标的浏览器测试必须改为相对坐标；恢复监听需要显式防重入。
- Follow-up：E8 在 390/1024/1280/1920 和 Chrome/Edge 验证 CSS/Canvas/DPR、同歌恢复、异歌显式切换、错误恢复和 marker geometry。

## Alternatives

- 继续保留 176/144px 并只放大波形：拒绝，仍占用不必要的轨道高度。
- 当前有歌曲时自动改写无效 URL：拒绝，会破坏严格 route identity 并可能编辑错误草稿。
- 只把 `-65%` 改成 `-50%`、继续让引线随菱形旋转：拒绝，引线几何仍会影响维护和视觉锚点判断。

## Approval

2026-09-03，`project-owner` 明确要求实施 E8 完整计划，包括 88/72px、同歌恢复、异歌显式入口和 `<=1 CSS px` 标记中心门禁。本 ADR 据此为 `approved`；批准不构成 E8 canonical 或完成证据。
