---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/adrs/0016-deterministic-scene-registry.md"
next_action: "实现原生全屏播放；以 typecheck/build 证明可运行，交互与视觉由 owner 自行审阅"
---

# ADR-0023: Visualizer Fullscreen Playback

## Context

Visualizer 的实时预览已经由一个 `VisualizerRendererHost`、一个 Canvas/WebGLRenderer 和一个视觉 RAF 驱动，但工作台没有只观看画面与播放控制的全屏路径。用第二个 Canvas、CSS 假全屏或新的播放循环会破坏 V3–V6 已批准的资源与确定性边界。

## Decision

- 对现有 `.visualizer-workspace` 使用浏览器原生 Fullscreen API；`fullscreenchange` 是唯一状态事实源，Escape 等浏览器退出路径必须同步 UI。
- 全屏中只显示同一个 16:9 预览和底部 transport。标题、提示、侧栏、抽屉和录制栏隐藏；非 16:9 视口使用黑色 letterbox。
- transport 进入时可见；仅在播放中且连续静止 2000ms 后淡出并向下收起。底部 96px 热区、键盘操作和键盘焦点恢复可见；paused/ended 始终可见。reduced motion 取消过渡但保留显隐状态。
- 全屏切换不调用播放、暂停或 seek。录制锁期间禁止进入；若锁在全屏中生效则先退出全屏，不取消录制。
- route 离开先退出当前页面拥有的全屏，再进入既有录制离页流程。组件卸载时移除 listener 并清除唯一自动隐藏 timer。
- Fullscreen API 缺失、请求拒绝或退出失败都以可访问错误反馈，不伪造全屏状态。

## Consequences

- Positive：观看模式复用同一渲染与播放链路，进入、退出和 Escape 不改变歌曲时间或播放状态。
- Negative：浏览器权限、用户手势和 Fullscreen API 差异成为新的 UI 生命周期风险，必须保持保守失败语义。
- Compatibility：Project JSON V1、SceneRegistry、RendererHost、录制状态机、AudioEngine、Worker 与 deterministic hash 均不改变；V1–V6 canonical 不重开。

## Alternatives

- CSS fixed 假全屏：拒绝；不能提供浏览器原生全屏语义，并会形成第二套状态事实。
- 新建全屏 Canvas/renderer：拒绝；违反单 host/renderer/RAF 资源契约。
- 进入全屏时自动播放：拒绝；全屏是显示状态，不是 transport 命令。

## Approval

2026-09-04，`project-owner` 明确要求实施 Visualizer 全屏播放与自动隐藏控制栏计划，随后把本次验证范围收敛为“无需测试，能够运行即可”。因此 DEC-058、本 ADR 与功能实现获批；自动化交互证据不产生，R-045 和 Visualizer readiness 继续等待 owner 自行审阅。
