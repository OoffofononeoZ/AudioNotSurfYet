---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "E7 已批准并关闭；布局或浮层行为变化时重开"
---

# ADR-0010: Editor Compact Workbench

## Context

E1–E6 已交付完整 Editor 能力，但页面由多个 20–24px 间距、24px 圆角和 24–28px 内边距的大卡片组成；point/range 行高分别为 68/76px，波形高 320px。该结构可以操作，却让桌面标注任务在首屏只能看到很少轨道，视觉层级也更像展示页而不是连续时间工作台。

## Decision

- Editor ready 状态使用两行紧凑工具栏：第一行承载工程/歌曲/保存状态，第二行承载 transport、时间、格式和导入导出；两行合计不超过 84px。
- 主内容区不使用独立圆角卡片。Timeline、tempo、point/range 和 overlay 依靠 1px 分隔线、轻微背景层次与固定列宽表达结构。
- 共享表现令牌固定为 30px 控件、44px point/range 行、152px lane 名称列、144px inner class 列、主区域 0–2px 圆角和控件 4px 圆角。
- 波形桌面高度为 176px，窄视口为 144px；tempo segment 使用可横向滚动的参数条，不用独立卡片。
- 菜单、确认对话框和事件标记仍可保留 8px 以内圆角，因为它们是临时浮层或语义对象，而非主布局分区。
- 布局变化不得私有化 viewport、改变时间事实、事件 schema、播放/分析 lease、pointer precedence 或 overlay pointer-through。

## Consequences

- Positive：同一桌面视口能显示更多时间与轨道，结构更接近连续编曲工作台，同时保留 AudioNotSurfYet 黑绿识别。
- Negative：既有 E2–E6 浏览器断言依赖滚动位置和元素几何，必须在不放宽产品阈值的前提下稳定；紧凑控件需要额外复核焦点与命中尺寸。
- Follow-up：E7 在 390/1024/1280/1920、Chrome/Edge、DPR 和 reduced motion 下验证 density、geometry、Canvas backing store、键盘与 10,000 事件回归。

## Alternatives

- 只缩小卡片 padding：拒绝，仍保留大量孤立圆角容器，无法形成连续工作台。
- 完整复制 FL Studio 视觉：拒绝，品牌、资产和具体控件不属于本产品；只采用高密度平面分区原则。
- 把工具栏和时间轴全部 fixed/sticky：拒绝，会新增遮挡和 z-index 风险，当前需求不需要改变滚动所有权。

## Approval

2026-08-28，`project-owner` 明确要求先批准 E6，再按 FL Studio 的紧凑工作台密度调整 Editor，并选择把介绍、歌曲信息和操作合并为双层工具栏；随后要求实施完整 E7 计划。本 ADR 据此为 `approved`。
