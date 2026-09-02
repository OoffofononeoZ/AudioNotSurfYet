---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/visualizer/project-format-v1.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "在 V1/V2 delivery planning 中固定 strict JSON、快照、单草稿与绑定验收；规划批准前不实现"
---

# ADR-0015: Visualizer Project and Binding Boundary

## Context

Visualizer 必须交换可复现配置，但 Analyzer 数据量大，Editor 草稿会继续变化，外部脚本又会把首版扩大为不安全插件宿主。Analyzer session 与 Editor draft 已有独立、获验证的持久化边界。

## Decision

- 新建 strict `VisualizerProjectV1` JSON：保存歌曲 identity、固定 16:9 输出预设、单一模板 ID/version、seed、完整绑定和可选同歌 EditorProjectV1 快照；不保存 Analyzer arrays、File/PCM/cache、renderer 或 Blob。
- 使用独立 `audionotsurfyet-visualizer` IndexedDB V1 的唯一 `draft/latest`，250ms autosave；同歌恢复、异歌导出/覆盖/取消，导入原子替换。
- Editor 数据只在进入或显式 reload 时复制验证，不实时监听。推荐 lane 保持未绑定，用户按 ID 手动选择；不猜测名称或顺序。
- binding 只允许 constant、analysis 和 editor-event 判别联合，以及受控 projection/transform；禁止任意表达式、JavaScript、Vue、shader 或外部 renderer。

## Consequences

- Positive：工程可以离线交换并稳定复现，不扩大已有 Analyzer/Editor DB，也不引入代码执行面。
- Negative：Editor 后续修改不会自动同步；用户需要显式 reload，工程中可能包含较大的 Editor 快照。
- Failure boundary：未知字段/版本/模板、错歌、无效引用、重复参数或超过四特征全部拒绝，当前内存与 durable draft 不变。

## Alternatives Rejected

- 只保存 Editor draft 引用：导出工程无法独立复现且会被后续编辑静默改变。
- 实时监听 Editor DB：引入跨页面竞态和不可预期输出变化。
- 多草稿工程库：首版没有管理任务，会扩大 identity、清理和 UI 范围。
- 保存 Analyzer arrays：工程体积、兼容与缓存 identity 失控。

## Approval

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。本 ADR 与 [Visualizer Project Format V1](../visualizer/project-format-v1.md) 据此为 `approved`，但不构成 V1/V2 实现授权。
