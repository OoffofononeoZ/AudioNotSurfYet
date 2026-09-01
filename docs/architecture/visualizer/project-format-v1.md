---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "复核 Visualizer JSON V1、歌曲 identity、Editor 快照和单草稿边界；批准前不实现 codec"
---

# Visualizer Project Format V1

## Purpose and Boundary

`VisualizerProjectV1` 是单首本地歌曲、单一内置场景的可移植工程。它保存输出预设、模板版本、确定性 seed、完整参数绑定和可选的已验证 Editor 快照；不保存 File、PCM、AudioBuffer、Analyzer 数组/cache、Worker、WebGL 对象、MediaStream 或录制 Blob。

建议文件名为 `<歌曲名>.audiosurf-visualizer.json`。首版只注册 JSON codec，不安装格式依赖，也不提供可执行模板或脚本字段。

## Canonical Type

```ts
type VisualizerTemplateId = 'orthogonal-lines' | 'cube-swarm'
type VisualizerResolution = '720p' | '1080p'
type VisualizerFrameRate = 30 | 60

interface VisualizerProjectV1 {
  format: 'audiosurf-visualizer'
  schemaVersion: 1
  projectId: string
  createdAt: string
  updatedAt: string
  track: EditorTrackIdentityV1
  output: {
    aspectRatio: '16:9'
    resolution: VisualizerResolution
    frameRate: VisualizerFrameRate
  }
  scene: {
    templateId: VisualizerTemplateId
    templateVersion: 1
    seed: number
    bindings: VisualizerParameterBindingV1[]
  }
  editorSnapshot?: {
    capturedAt: string
    project: EditorProjectV1
  }
}
```

`EditorTrackIdentityV1` 与 Editor V1 使用相同的 `contentHash`、`fileName`、可选 title/artist、`durationSeconds` 和可选 sample rate 语义。Visualizer 不复制第二种歌曲身份算法。

## Canonical Encoding

- `projectId` 使用 `crypto.randomUUID()`；时间字段使用有效 ISO 8601 UTC 字符串。
- `seed` 是 `0` 到 `2^32 - 1` 的整数。所有随机场景状态只从该 seed 派生。
- JSON 使用确定字段顺序、两空格缩进和末尾换行。对象 key 顺序不作为语义，但 canonical encoder 输出稳定。
- `scene.bindings` 按模板 registry 的 parameter 顺序保存。每个已声明参数必须恰好出现一次；新工程工厂把 registry 默认值物化为 `constant` binding。
- 数值必须有限；JSON `null`、NaN/Infinity 替代、稀疏数组和 `-0` 不作为合法数值。时间和 Editor 子工程继续按 Editor V1 微秒规则规范化。
- `EditorProjectV1` 作为快照原样嵌入并执行其 strict validator；Visualizer 不修改 Editor schemaVersion。

## Validation Order

导入必须先构造隔离候选，按以下顺序完成全部检查，再一次替换内存工程并立即保存草稿：

1. 顶层 format/schema/未知字段和必填字段。
2. UUID、时间、输出枚举、固定 16:9、seed 与有限数值。
3. 当前歌曲 `contentHash`、时长与可选 sample rate identity。
4. template ID/version 是否存在于 `SceneRegistry`。
5. bindings 是否完整、parameter ID 是否唯一、类型/范围/可绑定来源是否符合 descriptor。
6. analysis FeatureId、component/projection/index/band 是否与 FeatureRegistry shape 相容；去重后的唯一特征数不得超过四。
7. Editor snapshot 的完整 Editor V1 校验、同歌校验，以及 editor-event lane/innerClass 引用。
8. 所有 transform 的输入/输出范围、clamp/invert 与 smoothing 约束。

任一步失败都返回 typed error，当前内存工程、当前场景、活动分析集合和 durable draft 不改变。不存在“接受合法字段、忽略非法字段”的 partial import。

## Editor Snapshot Semantics

- 直接读取 Editor 数据时只在进入 Visualizer 或用户显式选择“重新载入 Editor 数据”执行一次 copy + validation；不订阅 Editor IndexedDB，也不在 Editor autosave 后自动刷新。
- 直接草稿和导入 JSON 都必须绑定当前歌曲。未找到同歌数据时，推荐绑定保持未绑定并显示选择提示；不得按 lane 名称、inner class 名称或数组顺序猜测“主要音色”或“drum”。
- 工程导出把当前已验证 Editor 数据作为 snapshot 保存。重新打开时优先使用工程快照；用户可显式替换为当前同歌 Editor 草稿。
- Editor 快照缺失是合法状态；任何 `editor-event` binding 在缺失或引用无效时都使项目校验失败，而不是在运行时悄悄输出 0。

## Draft Repository

Visualizer 使用独立原生 IndexedDB：

- database：`audionotsurfyet-visualizer`
- version：`1`
- store/key：`draft/latest`
- payload：完整 canonical `VisualizerProjectV1` 与 repository metadata
- autosave debounce：`250ms`

只保留一个最新草稿。同歌进入自动恢复；进入不同歌曲且存在草稿时必须选择：导出旧工程、覆盖旧草稿或取消进入。导出成功后仍需再次确认覆盖。取消优先回到旧工程歌曲；旧歌不可恢复时保留草稿并返回进入前页面。

内存工程始终先更新。单写入队列合并最新 pending snapshot；template/binding/output 确认、import 完成和 route leave 立即 flush。quota/abort 保留当前内存结果与旧 durable draft，并发布 `not-persisted`；`beforeunload` 只在写入 pending/in-flight 时启用。

## Compatibility and Migration

- schemaVersion 未知时拒绝，不猜测升级。
- V1 不复用 Analyzer session DB 或 Editor draft DB，避免扩大已验证事务和清理边界。
- templateVersion 是 scene compatibility identity。registry 没有完全相同版本时拒绝；不把旧参数映射到新模板。
- 未来取消四特征上限、增加模板或工程格式时必须走新的产品/架构评审；不能用宽松 validator 改写 V1 含义。

## Approval State

本格式为 Visualizer V0 架构草案。`project-owner` 批准 system design、interface contracts、风险和 ADR 前，不得实现 codec、数据库或导入导出 UI。
