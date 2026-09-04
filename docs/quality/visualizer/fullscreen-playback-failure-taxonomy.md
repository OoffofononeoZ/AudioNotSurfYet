---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/fullscreen-playback-eval-plan.md"
  - "docs/quality/visualizer/fullscreen-playback-golden-examples.md"
next_action: "owner 审阅后分类任何全屏失败；本轮不产生自动化结论"
---

# Visualizer Fullscreen Playback Failure Taxonomy

| Type ID | Failure type | Definition | Response |
| --- | --- | --- | --- |
| FSFT-STATE | state divergence | 浏览器 fullscreenElement、按钮或布局状态不一致 | 保持 R-045 Open，修复事件同步 |
| FSFT-LAYOUT | layout/identity | 出现非 Canvas/transport 内容、比例错误或创建第二 Canvas/host | 阻断 readiness |
| FSFT-CONTROLS | controls visibility | 计时、底部唤醒、paused/ended 或键盘焦点显隐错误 | 阻断 owner 视觉门禁 |
| FSFT-PLAYBACK | transport mutation | 全屏切换改变播放状态、时间或 seek | 阻断 readiness |
| FSFT-LIFECYCLE | cleanup/recording | timer/listener 遗留、录制锁竞态或离页挂起 | 阻断 readiness |
| FSFT-CAPABILITY | API failure | 不支持/拒绝时伪造成功或没有可访问错误 | 阻断 readiness |

本轮仅登记分类，不把未执行测试改记为通过。
