# Scene Generation Rules

## Canonical Sources

实现前读取仓库当前版本的：

- `docs/architecture/adrs/0021-controlled-visualizer-scene-generation.md`
- `docs/architecture/visualizer/project-format-v1.md`
- `docs/architecture/visualizer/binding-and-scene-contracts.md`
- `src/analysis/featureRegistry.ts`
- `src/visualizer/types.ts`
- `src/visualizer/projectCodec.ts`
- `src/visualizer/sceneRegistry.ts`
- 两个最相近的现有 scene/state resolver 与测试

本 reference 是生成检查表；发生差异时以已批准仓库架构和当前源码事实为准，不自行放宽接口。

## Scene Contract Contents

合同必须足以让另一位实现者无猜测地完成代码：

1. kebab-case `templateId`、显示名、`templateVersion: 1` 与视觉目标。
2. 主要和装饰效果逐项映射：输入状态、视觉对象、被驱动属性、低/高表现与参数隔离。
3. 完整参数表：ID、标签、类型、default、范围、允许来源、默认 binding、单位与错误 fallback。
4. 每个 analysis binding 的现有 `FeatureId`、component、projection 和 transform；每个 Editor binding 的 point/range 语义与中性未选状态。
5. direct、attack-release 或 integrated 时间模型；seed 分工、60Hz/checkpoint 规则与 renderer-neutral hash 字段。
6. geometry/material/instance/light/camera 方案，最大对象/实例数、每帧更新成本、dispose 所有权和 context/recording resize 行为。
7. 静音、低、高、歌曲首尾、seek、暂停、刷新、错误和 reduced-motion golden 状态。
8. unit、integration、Chrome/Edge 与 V1/V2/V5/V6 回归清单，以及无法自动化的 owner 项。

合同状态在展示时为 `AWAITING_APPROVAL`。批准后保存的 Markdown 使用 `status: approved`、`owner`、`last_reviewed`、`upstream_docs` 与 `next_action` frontmatter。

## Binding and Parameter Rules

- 参数 descriptor 完整声明 ID、label、type、defaultValue、范围、可绑定来源和 `defaultBinding`。字符串、布尔、颜色与枚举默认只允许 constant。
- 默认分析集合应最少，通常不超过两个；三或四项必须写出不可由共享 FeatureId、projection 或 constant 代替的理由。四项是硬上限。
- `analysis-scalar`/`analysis-vector` 只是 brief 分类；合同必须落到现有 Feature Registry。找不到兼容 shape/component/projection 时停止，不发明新类型。
- `editor-point`/`editor-range` 不按 lane 名称、分类名称或顺序猜测 ID。若需要用户选择，default 使用中性 constant 并在 inspector 提示。
- 单参数 source loading/error/non-finite 时使用 descriptor default 继续渲染，同时保留参数级 inspector 错误；录制 preflight 仍要求 active analysis ready。
- `SceneRegistry.createDefaultBindings()` 只应用于新建/首次选择且无持久化状态的模板；导入、草稿恢复和会话模板缓存必须原样保留已有 binding。

## Determinism

- 随机布局只使用工程持久化 uint32 seed；不得调用未固定的 `Math.random()`。
- scene 只接收 `timeSeconds`、resolved values 和 binding revision；不得读取 wall clock、RAF delta、store、Worker、Editor DB、AudioNode 或 exact cursor。
- direct 使用当前绝对时间采样；attack-release 与 integrated 从歌曲 0 秒按固定 60Hz 重放并每秒 checkpoint。checkpoint identity 至少包含歌曲、template、binding revision 和算法版本。
- renderer-neutral state 对布局、积分相位、resolved state、颜色和相机等合同字段按 `1e-6` 量化后稳定哈希。同一工程、歌曲、revision、resolved values 与时间必须跨播放/seek/暂停/刷新一致。

## Renderer and Resources

- 新场景使用独立纯状态解析器与 Renderer，实现现有 `render/resize/dispose` 接口并注册到唯一 `SceneRegistry`。
- 复用 host 的唯一 Canvas、WebGLRenderer 和视觉 RAF。scene 不创建 AudioContext、Worker、RAF、第二 Canvas/renderer 或产品全局 API。
- 重复对象优先共享 geometry/material 并使用 `InstancedMesh`。预算在合同中给出对象/instance 上限和预期每帧更新量。
- `dispose()` 幂等释放 scene 自有 geometry、material、texture 和 listener；模板切换、20 次循环、context restore 与 renderer retry 后 live 资源回到 route 基线。
- 支持 host resize、DPR 1/2、720p recording capture size、release 后预览恢复和同一 host 的 context recovery。
- 默认不增加依赖、纹理、模型或远端资产。样式参考图不自动成为产品资产。

## Project Compatibility

- 扩展 `VisualizerTemplateId`、`SceneRegistry` 和 Project V1 strict whitelist；JSON `schemaVersion` 与 scene `templateVersion` 仍为 1。
- 默认模板继续是 `orthogonal-lines`。旧工程和已保存 template binding 不改变；未知模板仍原子拒绝。
- 新场景不改写 V1–V6 evidence，不自动成为 release-ready candidate。实现后显式重评 Visualizer readiness。
