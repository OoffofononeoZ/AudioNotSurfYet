---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/visualizer/project-format-v1.md"
next_action: "复核绑定投影、绝对时间确定性、四特征 planner 与两个场景 registry；批准前不实现 renderer"
---

# Visualizer Binding and Scene Contracts

## Binding Model

```ts
type VisualizerBindingSourceV1 =
  | { kind: 'constant'; value: number | string | boolean | number[] }
  | {
      kind: 'analysis'
      featureId: FeatureId
      component?: 'default' | 'total' | 'specific' | 'real' | 'imag' | 'magnitude' | 'phase'
      projection:
        | { kind: 'scalar' }
        | { kind: 'full' }
        | { kind: 'mean' | 'max' | 'peak' }
        | { kind: 'bin'; index: number }
        | { kind: 'band'; start: number; end: number }
    }
  | { kind: 'editor-event'; laneId: string; innerClassId?: string }

interface VisualizerNumericTransformV1 {
  inputMin: number
  inputMax: number
  outputMin: number
  outputMax: number
  clamp: boolean
  invert: boolean
  attackSeconds: number
  releaseSeconds: number
}

interface VisualizerParameterBindingV1 {
  parameterId: string
  source: VisualizerBindingSourceV1
  transform?: VisualizerNumericTransformV1
}
```

模板 descriptor 决定 parameter 的类型、范围、是否可绑定、允许的 source kind、允许的向量 component/projection 和默认 constant。字符串、布尔、颜色/枚举参数只允许 constant；数值和明确声明的 vector 参数才能使用动态 source。

## Analysis Projection

- scalar feature 只接受 `scalar`；Loudness 可用 `total` scalar 或 `specific` vector；Complex Spectrum 必须明确 real/imag/magnitude/phase；其他向量使用 `default`。
- `bin` 读取零基索引；`band` 使用半开 `[start,end)` 并对区间求 mean；index/range 必须落在注册维度内。
- `mean` 返回所有有限分量平均值；`max` 返回最大分量值；`peak` 返回主导分量的归一化位置 `index / max(1, length - 1)`，不是最大值。
- `full` 只可绑定到 descriptor 声明的 vector parameter。V1 full-vector 不允许非零 attack/release，避免对不同 shape 隐式定义数组滤波。
- display series 以绝对歌曲时间采样：标量线性插值，类别/bin/结构向量在相邻 display sample 间逐分量线性插值；歌曲边界使用最近合法 sample。非有限数据为 binding-local error。
- 分析未就绪时预览用中性 0/零向量并显示进度；失败只停止相关 binding 并可重试。录制 preflight 要求全部当前 analysis binding ready，不允许以中性值开始录制。

## Editor Event Semantics

- 指定 `innerClassId` 时只读取该分类；省略时读取 lane 全部 inner class，并以 OR/max 聚合。多个同时事件仍为 1，不相加。
- range event 在半开 `[startSeconds,endSeconds)` 内输出 1，否则 0。相邻 range 在共同端点不会同时激活。
- point event 在 `atSeconds` 产生确定性单位 impulse；attack/release resolver 把该 impulse 转为可见脉冲。不存在 Editor snapshot 或引用失效时，工程 validator 先拒绝，不进入 renderer。
- 不按 lane/class 名称推断默认绑定。“主要音色”和“drum”只作为 UI 推荐文案，必须由用户选择稳定 ID。

## Transform Order and Determinism

数值处理顺序固定为：

1. 以 `(value - inputMin) / (inputMax - inputMin)` 规范化；input range 必须有限且严格递增。
2. `clamp=true` 时裁剪到 `[0,1]`。
3. `invert=true` 时计算 `1 - normalized`。
4. 应用 attack/release smoothing。
5. 映射到 `[outputMin,outputMax]`，最后按 parameter descriptor 裁剪并检查有限值。

smoothing 以歌曲 0 秒为初态 0，基于 source 的版本化时间序列建立可重放前缀/checkpoint；求值只依赖工程、source、绝对时间和固定算法参数，不依赖前一 RAF frame。直接 seek 必须从最近确定性 checkpoint 重放到目标时间，得到与从 0 秒连续播放相同的值。模板运动同样只使用 seed 与绝对时间；禁止累计 wall-clock/RAF delta。

binding revision、template、track 或 analysis generation 变化必须丢弃旧 resolver 状态。相同 project JSON、歌曲 hash、分析 payload、Editor snapshot 和绝对时间应得到相同 resolved parameter state，可由 canonical hash 比较。

## Four-Feature Planner

`VisualizerBindingPlanner` 遍历当前模板的完整 bindings：

1. 收集 `analysis` source 的 FeatureId。
2. 按稳定 `FEATURE_IDS` 顺序去重。
3. 0–4 项返回 active set；第五项返回 `analysis-feature-limit`，不调用 Coordinator、不修改当前工程。
4. 同一 FeatureId 可被任意多个参数共享并只计算一次。
5. 替换/删除最后一个引用后，在同一次 project revision 中从 active set 释放。

constant 和 editor-event 不计入上限。PROD-022 只有在新批准场景确实需要第五项时才重新评审；V1 不能通过多个 consumer 或 Worker 绕过上限。

## Scene Registry

```ts
interface SceneTemplateDescriptor {
  id: VisualizerTemplateId
  version: 1
  title: string
  parameters: readonly SceneParameterDescriptor[]
  create(host: VisualizerRendererHost, seed: number): VisualizerScene
}

interface VisualizerScene {
  render(input: { timeSeconds: number; values: ReadonlyMap<string, unknown> }): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}
```

首版 registry 只允许：

### Orthogonal Lines @1

- horizontal/vertical 各自声明 enabled、source intensity、color、thickness、brightness、decay。
- 推荐 horizontal 选择主要音色 lane，vertical 选择 drum lane/class；两者默认保持未绑定并提示选择。
- range gate 持续显示，point 经确定性 smoothing 形成短脉冲；未绑定可以设 constant 或关闭。
- 同一场景只使用一个 renderer/canvas/RAF。

### Cube Swarm @1

- center spectrum structure 默认绑定 `amplitudeSpectrum` full vector。
- `coreScale` 推荐绑定用户手动选择的 drum main lane；默认未绑定。
- peripheral `riseSpeed` 默认绑定 `energy` scalar。
- three satellites 的 `orbitSpeed` 默认 constant，也允许用户改绑。
- cube count、colors、base size、camera distance、background 是 constant 参数。
- 默认分析集合只有 Amplitude Spectrum 与 Energy，为用户保留两个 feature 名额。

## Renderer Host and Lifecycle

- 一个 Visualizer 页面只有一个 16:9 Canvas、一个 Three.js `WebGLRenderer` 和一个 cancellable RAF。scene 不能创建 renderer、AudioContext、Worker 或额外 RAF。
- 播放/录制时 host 用 PlaybackSnapshot 的 AudioContext 基准时间渲染；暂停、seek、参数变更和 resize 只触发一次 request-render。
- template switch 先停止旧 scene 更新、dispose geometry/material/texture/scene，再在同一 host 创建新 scene。DOM inspector 与 transport 不由 scene 管理。
- seed 决定初始布局；粒子位置、rise 和 orbit 使用绝对时间公式或确定性积分/checkpoint，不依赖 frame count。
- `webglcontextlost` 阻止默认销毁、暂停绘制并保留工程/播放；restore 时重建 renderer/scene 并从当前绝对时间绘制。录制期间 context loss 进入 error 并丢弃未完成 Blob。
- 所有图片/纹理必须为本地、同源或 origin-clean；否则在加载时拒绝，不能等到 `captureStream()` 才失败。

## Error Isolation

- 参数/绑定错误隔离到参数并显示可修复状态；scene renderer error 隔离到当前 scene，transport、工程导入导出和模板选择继续可用。
- 旧 template/binding revision 的分析或 resolver completion 必须丢弃。
- dispose、context restore 或 binding retry 失败不得创建第二 host；若唯一 host 无法恢复，页面保持可导出工程的明确错误状态。

## Approval State

本契约尚待 Visualizer architecture 审批。批准只开放 delivery/quality planning，不证明两个场景已实现、确定性指标已达到或 WebGL 录制可用。
