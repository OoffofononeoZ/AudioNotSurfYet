---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "project-owner 批准或拒绝纯 renderer adapter、共享 geometry 和 pointer-through overlay"
---

# ADR-0009: Shared Renderer Adapter and Pointer-Through Editor Overlay

## Context

Editor 要把任一现有 21 项分析结果对齐到标记区域，同时让 overlay 大部分区域的鼠标事件穿透到底层。直接复用整张 `MeydaCard` 会携带卡片布局、详情 DOM、焦点和 pointer handler；重新实现 21 套 renderer 则会让 Analyzer 与 Editor 的 feature shape、颜色域和时间映射漂移。

## Decision

- 从 Analyzer 卡片中抽取纯 Canvas renderer/data adapter；FeatureRegistry、AnalysisSeries 解码和 exact cursor 语义保持单一来源。
- Renderer 只接收 feature、series、viewport、CSS 尺寸、DPR 和 cursor/exact value，不读取 route、store、DOM 或 pointer 状态。
- 波形、tempo、事件和 overlay 共用同一 `EditorTimelineGeometry`，误差目标不超过 1 CSS px。
- Overlay Canvas、说明、图例和空白为 pointer-through；只有 feature selector 与 top/move/bottom 三个手柄接收 pointer/keyboard。
- Overlay analysis/renderer failure 是单层可重试边界，不影响播放、标记、工程、草稿或导出。

## Consequences

- Positive：21 项 renderer 语义不复制，Editor 命中保持底层时间坐标，Canvas/DPR 和错误隔离可统一测试。
- Negative：MeydaCard 中现有绘制逻辑需要重构为纯函数；DOM 说明仍需 Editor 自己的轻量适配，不能直接共享整张卡片。
- Follow-up：E4 完成 renderer 抽取、overlay 选择/手柄和 1px 几何验证；E6 回归全部 family、DPR、reduced motion 与错误注入。

## Alternatives

- 复用 MeydaCard DOM：拒绝，布局和 pointer/focus 语义不符合 overlay。
- 为 Editor 复制 21 套 renderer：拒绝，长期漂移和包体成本过高。
- SVG/DOM 重画全部图表：拒绝，高密度热图、波形和复杂结构成本不合适。

## Approval

本 ADR 保持 `in-review`；ADR-0004 的 Analyzer renderer family 历史决定继续有效，本 ADR 只定义 Editor 的复用边界。
