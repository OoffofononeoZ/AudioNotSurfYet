---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/quality/visualizer/evidence-index.md"
next_action: "实现 DEC-050 并在 clean implementation commit 上运行双浏览器 targeted regression"
---

# Visualizer Viewport Scroll Eval Plan

## Boundary

本计划评价 V6 关闭后的 release-readiness 布局修订，不创建 V7、不重跑或替换 V6 canonical。范围只包括支持的 `>=1024px` Visualizer 一屏高度、左右侧栏独立滚动、1024 compact drawer 边界，以及 Analyzer 精确值表与 Visualizer 对 `.app-scrollbar` 的共享复用。`<1024px` 移动端支持、Editor/歌曲列表/Analyzer 页面既有滚动条变体不在本次范围。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC |
| --- | --- | --- | --- | --- | --- |
| VR-EV-VIEWPORT | 页面滚动所有权 | boundary | DOMRect + scroll geometry | 各目标视口中 document/body/page 高度不超过 viewport，`window.scrollY === 0` | AC-VR01 |
| VR-EV-PANELS | 双侧独立滚动 | success + exception | synthetic spacer + wheel/scrollTop | 目标 panel 滚动，另一 panel 与 window 不动；边界继续滚动不 chaining | AC-VR02 |
| VR-EV-STYLE | 共享 scrollbar | success + regression | computed/pseudo style + source check | Analyzer 表与两个 panel 均使用 `.app-scrollbar`；Firefox thin、WebKit 10px、共享颜色/gutter | AC-VR03 |
| VR-EV-COMPACT | compact drawer 边界 | boundary | 1024 DOMRect + drawer interaction | 互斥抽屉完全位于 workspace grid，不覆盖 recording/transport | AC-VR04 |
| VR-EV-REGRESSION | Visualizer/Analyzer 相邻行为 | regression + exception | Chrome/Edge targeted E2E | 16:9、单 Canvas/renderer/RAF、键盘、reduced motion、context recovery、console/pageerror 不回归 | AC-VR04 |

## Evidence Rule

- dirty 运行只作反馈；正式记录绑定 clean implementation commit，登记 Chrome/Edge 版本、命令、视口几何和工作树状态。
- 目标视口为 `1024×720`、`1280×720`、`1280×900`、`1920×1080`，并覆盖 DPR 1/2。
- owner 视觉确认前 [release readiness](release-readiness.md) 保持 `in-review`；PROD-015 继续阻断上线。
