---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
next_action: "实施 M14 featureOrder、可访问排序交互与 V1 可选字段，并形成 clean canonical"
---

# ADR-0013: Analyzer 可访问卡片排序与 V1 顺序持久化

## Context

M13 固定按 `FEATURE_IDS` 展示 21 张折叠卡。用户需要把常用特征排到更容易比较的位置，同时保持最多四项 FIFO 分析、M12 实测高度瀑布流、Canvas/焦点状态和最近会话恢复。只提供拖动不能覆盖键盘或不能持续按住指针的用户；按歌曲保存又会扩大当前全局 Analyzer workspace 与 schema 边界。

## Decision

- Runtime workspace 增加完整、唯一的 `featureOrder: FeatureId[]`。它驱动 Vue keyed DOM 顺序和最短列输入；排序只移动既有 wrapper，不重建卡片。
- Pointer 使用三横句柄、6 CSS px 阈值、capture、轻量 ghost、前后插入 marker 和滚动边缘 auto-scroll；只在合法 drop 时一次提交，不增加位移动画。
- 点击/触控句柄打开上移、下移、置顶、置底动作面板；键盘同时支持面板和 `Alt+ArrowUp/Down`、`Alt+Home/End`，独立 live region 播报位置。工具栏提供恢复 `FEATURE_IDS`。
- `PersistedSessionV1.featureOrder` 是可选完整 permutation，不升级 IndexedDB version。字段缺失代表旧 M13 会话并恢复默认顺序；字段存在但无效时严格拒绝，不静默修复。新保存始终写入完整顺序。
- 顺序属于最近 Analyzer workspace，全局跨歌曲；`activeCards` 继续只承载 FIFO 年龄。排序不得调用 Coordinator 或改变 Worker generation、cache、exact request、展开状态与播放。

## Consequences

- 自定义顺序成为视觉、DOM、键盘和读屏顺序；M13 的固定顺序断言只对默认/旧会话成立。
- 旧应用会忽略新增可选字段，回滚不会破坏既有 session；回滚期间只丢失排序呈现，不丢失音频或 FIFO carrier。
- Pointer capture、auto-scroll、popup 和第二个可取消 RAF 增加生命周期风险，必须覆盖 cancel、blur、route leave、双浏览器、四视口和资源循环。
- 不引入第三方拖动依赖，不扩展为按歌曲排序、移动端产品支持、多选或排序动画。

## Alternatives Rejected

- 两卡交换：长距离重排难以预测，拒绝。
- 只提供拖动与键盘：缺少无需按住拖动的单指针替代，拒绝。
- 按歌曲保存：需要 keyed workspace/migration，超出当前全局工作区范围，拒绝。
- 实时重排 DOM：会在不等高瀑布流中造成目标跳动并放大 Canvas/焦点风险，拒绝；采用 drop 时提交。

## Approval

2026-09-01，`project-owner` 先选择插入排序、Analyzer 工作区全局持久化和“动作面板 + 恢复默认”，随后明确要求实施完整 M14 计划，并授权本地提交、clean canonical 与 evidence/readiness 复核；不推送远程仓库。
