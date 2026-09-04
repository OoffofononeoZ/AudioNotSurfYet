---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/fullscreen-playback-eval-plan.md"
next_action: "由 owner 按 FS-G01–FS-G06 自行审阅"
---

# Visualizer Fullscreen Playback Golden Examples

| ID | Type | Input | Expected result |
| --- | --- | --- | --- |
| FS-G01 | success | paused 时点击“全屏” | 进入原生全屏，仍 paused，transport 常驻 |
| FS-G02 | success | playing 时进入后静止 2 秒 | transport 淡出并向下收起，Canvas 不变 |
| FS-G03 | success | transport 隐藏后移到屏幕底部 96px | transport 立即恢复，离开后重新计时 |
| FS-G04 | boundary | 按 Escape 退出 | `fullscreenchange` 同步按钮与布局，歌曲状态不变 |
| FS-G05 | failure | API 不支持或请求被拒绝 | 按钮禁用或显示可访问错误，不伪造全屏 |
| FS-G06 | exception | 全屏时录制锁生效或 route 离开 | 先退出全屏；录制状态机与既有离页决策继续工作 |

上述样例本轮均为 `owner-review`，没有自动化 pass 记录。
