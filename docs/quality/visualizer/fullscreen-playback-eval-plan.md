---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/adrs/0023-visualizer-fullscreen-playback.md"
next_action: "owner 自行审阅全屏构图、退出、自动隐藏和唤醒；本轮不执行自动化测试"
---

# Visualizer Fullscreen Playback Eval Plan

## Boundary

本修订不创建 V7，也不重跑或替换 V1–V6 canonical。依据 owner 的最新指令，本轮只用 typecheck/build 证明代码可运行，不新增或执行 fullscreen unit、integration、E2E 或 eval runner；未验证行为保持 `unverified / owner-review`。

## Owner Review Matrix

| ID | Behavior | Expected result | Status |
| --- | --- | --- | --- |
| FS-EV-ENTER | 进入/退出 | 原生全屏状态、按钮文字与 `aria-pressed` 一致；重复点击和 Escape 可退出 | owner-review |
| FS-EV-LAYOUT | 构图 | 只显示同一 16:9 Canvas 与覆盖式 transport，非 16:9 使用黑边 | owner-review |
| FS-EV-CONTROLS | 自动隐藏 | 播放静止 2 秒隐藏；底部 96px、暂停、键盘操作或键盘焦点恢复 | owner-review |
| FS-EV-STATE | 播放状态 | 进入/退出不改变播放/暂停、歌曲时间或 seek | owner-review |
| FS-EV-LIFECYCLE | 生命周期 | 录制锁、请求拒绝、route leave 与卸载不伪造状态或遗留 timer/listener | owner-review |

## Evidence Rule

- typecheck/build 成功只证明可编译和可打包，不等同于上述交互通过。
- owner 明确确认前，release readiness 保持 `in-review`，R-045 保持 `Open`。
- PROD-015 继续阻断生产上线。
