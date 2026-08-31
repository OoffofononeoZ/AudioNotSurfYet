---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "M13 已实现并登记 canonical；M14 排序不得绕过新 ADR/schema 审批"
---

# ADR-0012: Analyzer All Cards and FIFO Active Analysis

## Context

M7–M12 用四个可替换 slot 表达“最多四项分析”。用户必须先移除或替换卡片才能浏览其他特征，且折叠展示与实际 Worker 并发上限被同一个 UI 模型耦合。Analyzer 已有 21/21 注册表、最多四项 Worker job、generation 隔离和实测高度 masonry，因此可以把“可浏览的卡片全集”与“当前活动分析集合”分开。

## Decision

- Analyzer 按 `FEATURE_IDS` 固定顺序渲染 21 个稳定 wrapper；DOM、键盘和读屏顺序不随瀑布流位置或活动状态改变。
- 运行时工作区使用有序 `activeFeatureQueue: FeatureId[]`。队列最多四项且唯一，数组顺序表示 FIFO 年龄：收起时删除；展开时追加；已满时原子移除队首并追加目标。与已展开卡的其他交互不刷新年龄。
- 每张 `MeydaCard` 始终保留输出类型、标题、简介和带 `aria-expanded`/`aria-controls` 的开关。只有展开时才挂载图表、精确值、参数与结构化明细；收起立即卸载这些资源，重新展开时内部 `details` 默认收起。
- `AnalysisCoordinator` 继续接收 0–4 个唯一 feature ID 并以一个 job 批量计算 cache miss。队列变化取消旧 generation、清除过期 exact request，并只接受最新 identity 的结果；合法 cache hit 继续复用。
- IndexedDB 仍为 `PersistedSessionV1`，不升级 schema。载入时把旧 `activeCards` 按 `slot` 排序转换为队列；保存时按队列索引生成 `{ slot, featureId }`。因此旧会话恢复原活动集合，首次无会话工作区为空。
- workspace 保存使用不可变快照、串行写入和 revision guard；旧写入完成或失败不得覆盖最新队列，也不得改写最新 persistence 状态。
- M12 的 1/2 列、18px gap、实际高度、最短列、单 RAF 与无位移动画规则保持；item identity 由 slot 改为 feature ID。

## Consequences

- Positive：21 项可直接浏览，用户只需展开感兴趣的卡；最多四项分析的资源边界在 UI 中可见并由 FIFO 自动维护。
- Positive：V1 carrier 不变，已有 session 无需迁移；运行时模型不再暴露可替换 slot。
- Negative：21 个折叠卡与频繁展开会增加 DOM、ResizeObserver、布局和保存竞态压力；必须由双浏览器资源循环、快速序列和几何测试覆盖。
- Failure boundary：队列提交必须原子；任何时刻不得出现第五个展开 body。迟到 Worker/exact/save completion 只能被丢弃，不能恢复已淘汰卡或将状态错误标为已持久化。

## Alternatives

- 保留四 slot 并增加特征浏览器：拒绝，仍要求用户执行移除/替换，不能满足一页展示全部特征。
- 同时分析 21 项：拒绝，会扩大 Worker、缓存、内存和 15 分钟性能边界。
- 为 M13 升级 IndexedDB schema：拒绝，旧 `activeCards` 足以无损承载最多四项 FIFO 队列；没有新增持久化事实需要迁移。
- 在本次加入拖动排序：延后到 M14；当前不显示三横图标、不增加排序 schema，也不实现鼠标、触控或键盘拖动。

## Approval

2026-08-31，`project-owner` 明确要求实施“Analyzer M13 全卡片折叠与 FIFO 活动分析计划”，并要求本轮默认不推送远程仓库。本 ADR、V1 兼容适配和 M14 非目标据此获批；M13 是否恢复 Analyzer `Ready with waivers` 仍只由 clean canonical evidence 决定。
