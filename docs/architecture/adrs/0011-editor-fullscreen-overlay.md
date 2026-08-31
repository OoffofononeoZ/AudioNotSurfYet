---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "E7 修订版 46/46 已批准；窗口级浮层行为变化时重开"
---

# ADR-0011: Editor Fullscreen Overlay

## Context

E4–E6 的分析叠加层挂载在标记工作区内，并以常驻特征选择器控制。E7 紧凑布局后，这个入口仍占据主工作台空间，叠加图形也会随页面纵向滚动离开窗口。Owner 要求把入口和分析层都提升为窗口级悬浮能力，同时保留底层 Header、时间轴和点/范围标记的直接操作。

## Decision

- `EditorAnalysisOverlay` 通过 Vue `Teleport` 挂载到 `body`，root 使用 `position: fixed; inset: 0`。灰色背景、Canvas、说明和空白区域全部 `pointer-events: none`；只有左上角复合入口、临时菜单、错误重试与 top/move/bottom 手柄接收输入。
- 开启时背景固定为 `rgba(132, 136, 135, 0.28)`，不使用 blur。Canvas backing store 覆盖浏览器视口，renderer 只在底层标记时间列的当前屏幕横向范围内绘制并裁剪；纵向文档滚动不移动 root、图形、入口或手柄。
- 复合入口固定在 `top: 72px; left: 12px`。主按钮使用 `aria-pressed` 直接开关；箭头以 `aria-haspopup/aria-expanded` 打开 21 项单选菜单。首次无特征时，主按钮打开菜单并聚焦第一项。
- `featureId` 继续作为 JSON V1 工程事实保存，关闭不清空它。开关状态只按歌曲 content hash 保存到现有 Editor IndexedDB V1 `preferences` store，不进入 JSON，不升级数据库。
- 关闭后 Analysis consumer 的 active features 收敛为 `buffer`，并停止 overlay exact cursor、renderer 和特征请求；重新打开时恢复上次 feature 并沿用现有 cache、generation、stale/cancel 规则。
- `topRatio` 与 `heightRatio` 的字段和校验不变，但解释改为相对浏览器视口。旧工程值可直接规范化使用；自定义垂直位置可能因坐标空间改变而产生视觉位移。

## Consequences

- Positive：主工作台不再常驻特征列表；用户滚动时仍能观察和调整同一窗口级图形，同时底层编辑能力保持可点击。
- Negative：DOM Teleport、页面/时间列滚动和全视口 Canvas 增加几何与资源风险；旧的 E7 44/44 结果不能证明新边界，必须保留为 `pre-revision` 并重新执行 46 步 canonical。
- Failure boundary：visibility 偏好写入失败只标记 `not-persisted`，不得修改工程、草稿、播放或标记。hash 不匹配的偏好被忽略；JSON 导入沿用当前歌曲本地开关。

## Alternatives

- 继续把 overlay 绝对定位在 lane workspace：拒绝，不能满足窗口固定和全屏灰色背景。
- 把开关写入 JSON V1：拒绝，它是本机同歌视图偏好，不属于可移植工程语义。
- 让全屏 root 捕获所有 pointer 再手工转发：拒绝，会破坏 Header、表单和标记的原生命中与辅助技术语义。

## Approval

2026-08-29，`project-owner` 明确要求按钮和叠加页均为窗口级悬浮，并要求实施“Editor E7 全屏悬浮分析叠加层修订计划”。本 ADR 据此为 `approved`；E7 仍为 `In Progress`，修订版 canonical 与人工验收前不得进入 Editor release-readiness。
