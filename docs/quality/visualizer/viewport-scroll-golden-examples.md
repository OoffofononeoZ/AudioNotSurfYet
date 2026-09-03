---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/viewport-scroll-eval-plan.md"
next_action: "自动化 VR-G01–VR-G06 已固定；等待 owner 视觉确认"
---

# Visualizer Viewport Scroll Golden Examples

| ID | Type | Input | Expected result | Why it matters |
| --- | --- | --- | --- | --- |
| VR-G01 | success | 1280×900 ready Visualizer | 页面一屏；左右栏可见，只有栏内内容滚动 | 对应截图主问题 |
| VR-G02 | boundary | 1024×720 打开参数抽屉 | 抽屉位于 workspace grid，录制栏和 transport 可见且不被覆盖 | 固定 compact 几何 |
| VR-G03 | boundary | 1920×1080、DPR 2 | 页面无纵向滚动，preview 仍为 16:9 且只有一个 Canvas | 防止宽屏/DPR 回归 |
| VR-G04 | exception | 右栏滚到底后继续 wheel | `window.scrollY` 和左栏 scrollTop 保持不变 | 防止 scroll chaining |
| VR-G05 | success | 左右栏分别注入测试专用溢出内容 | 只改变当前目标栏 scrollTop | 证明滚动上下文独立 |
| VR-G06 | regression | Analyzer 展开精确值表 | 与 Visualizer 两栏共享 Firefox/WebKit scrollbar 样式 | 防止复制样式漂移 |

## Result

VR-G01–VR-G06 已在 clean implementation commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 的 Chrome/Edge 专项中通过；Analyzer M7 Chrome 5/5 进一步确认 VR-G06。该结果是自动化证据，不替代 owner 视觉确认。
