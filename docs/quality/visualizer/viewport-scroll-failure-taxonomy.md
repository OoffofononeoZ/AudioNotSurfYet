---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/viewport-scroll-eval-plan.md"
  - "docs/quality/visualizer/viewport-scroll-golden-examples.md"
next_action: "实现后确认 VRFT-VIEWPORT/PANEL/CHAIN/STYLE/REGRESSION 均无未关闭 S1/S2"
---

# Visualizer Viewport Scroll Failure Taxonomy

| Type ID | Failure type | Definition | Detection | Response |
| --- | --- | --- | --- | --- |
| VRFT-VIEWPORT | viewport ownership | `>=1024px` 出现 document/body 纵向滚动或固定栏移出一屏 | VR-EV-VIEWPORT | S1；修复确定高度与 min-size chain |
| VRFT-PANEL | panel scrolling | 任一侧栏不能独立滚动、横向溢出或撑高 grid | VR-EV-PANELS | S1/S2；修复 overflow/min-height |
| VRFT-CHAIN | scroll chaining | panel 边界 wheel 改变 window 或另一 panel | VR-EV-PANELS | S2；恢复 contain 和页面裁切 |
| VRFT-STYLE | scrollbar drift | Analyzer 表或 Visualizer 未复用 `.app-scrollbar`，尺寸/颜色/gutter 不同 | VR-EV-STYLE | S2；移除局部变体并回归 computed style |
| VRFT-REGRESSION | adjacent regression | drawer 覆盖、16:9/Canvas/RAF、键盘、context 或 console 回归 | VR-EV-COMPACT/REGRESSION | S1；阻断 readiness evidence |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S1 | 一屏工作台、侧栏可用性或 Visualizer 核心行为不可完成 | 阻断 readiness evidence |
| S2 | 有明确恢复路径的局部 scroll/style/a11y 缺陷 | 修复并重跑双浏览器 targeted regression |
| S3 | 不影响行为的低等级视觉差异 | 记录并由 owner 判断，不掩盖 S1/S2 |
