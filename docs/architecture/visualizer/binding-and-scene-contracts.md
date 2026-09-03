---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/visualizer/project-format-v1.md"
next_action: "V6 54 步 dirty provisional 已通过；提交实现并在 clean HEAD 运行 canonical"
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

interface SceneParameterDescriptor {
  // Omitted means the existing constant defaultValue binding.
  defaultBinding?: Omit<VisualizerParameterBindingV1, 'parameterId'>
}

interface VisualizerScene {
  render(input: {
    timeSeconds: number
    values: ReadonlyMap<string, unknown>
    bindingRevision: number
  }): void
  resize(width: number, height: number, dpr: number): void
  dispose(): void
}
```

`VisualizerRendererHost` 独占现有 16:9 Canvas、一个 Three.js `WebGLRenderer` 和一个可取消视觉 RAF。host 读取共享 `PlaybackSnapshot`，不建立第二播放时钟；播放时连续绘制，暂停、seek、参数变更和 resize 只请求单帧。drawing DPR 固定为 `min(max(devicePixelRatio,1),2)`，CSS 尺寸和输出几何继续保持 16:9。

父级每个绘制时点只调用一次 `resolveParameters(timeSeconds)`，把同一份只读 resolved map 同时交给 scene 与 inspector；scene 不能读取 store、Worker、Editor DB、音频节点或 exact cursor。scene create/render/resize 异常进入可重试错误层，transport、模板选择、工程导入导出和草稿继续可用；重试先 dispose 旧 scene，再在同一 host 中重建。

首版 registry 只允许：

### Orthogonal Lines @1

- horizontal/vertical 各自声明 enabled、source intensity、color、thickness、brightness、decay；`horizontalDecay`、`verticalDecay` 的单位均为秒，字段名和 JSON V1 保持不变。
- 单个全屏 quad/shader 在固定背景 `#020403` 上绘制两条中心正交线。每个方向的 intensity 先裁剪到 `0…1`，可见长度为对应画布轴长度乘 display intensity，并从中心向两端伸展；主线 alpha 为 `clamp(displayIntensity × brightness,0,1)`。
- thickness 使用 CSS px，DPR/resize 后视觉宽度不变；brightness 大于 1 时继续增强外围 halo，避免主线 alpha 饱和后失效。交点使用加法混合，但 horizontal/vertical 参数与状态互不回写。
- `enabled=false` 时该方向完全隐藏。推荐 horizontal 选择主要音色 lane，vertical 选择 drum lane/class；新工程 intensity 仍为 constant 0，并显示“请选择主要音色/鼓点数据源”，不按名称或顺序自动绑定。
- V2 point 先沿用默认 120ms release，range 在 `[start,end)` 内保持 gate；V3 再对 resolved intensity 应用视觉余辉。视觉余辉不修改 V2 resolved value。
- 每个方向以固定 60Hz 更新 `E_n = max(I_n, E_(n-1) × exp(-4 × Δt / decaySeconds))`；decay 0 时 `E_n = I_n`，经过一个 decaySeconds 后历史余辉约剩 2%。每秒建立 checkpoint，并按歌曲身份、template 与 binding revision 隔离。
- seek、刷新和暂停单帧从确定性 checkpoint 重放到绝对歌曲时间；禁止使用 RAF delta。同一工程、歌曲和时间产生相同 renderer-neutral frame-state hash。
- reduced motion 只关闭工作台装饰过渡，不关闭用户主动播放产生的场景响应。
- 同一场景只使用一个 renderer/canvas/RAF；scene dispose 必须释放自己的 geometry/material。

### Cube Swarm @1

- center spectrum structure 默认绑定 `amplitudeSpectrum` full vector。
- `coreScale` 推荐绑定用户手动选择的 drum main lane；默认未绑定。
- peripheral `riseSpeed` 默认绑定 `energy` scalar。
- three satellites 的 `orbitSpeed` 默认 constant，也允许用户改绑。
- cube count、colors、base size、camera distance、background 是 constant 参数。
- 默认分析集合只有 Amplitude Spectrum 与 Energy，为用户保留两个 feature 名额。

DEC-041 将 V4 首版视觉细化为“核心环群”，其中 `B = baseSize`：

- 一个共享 `BoxGeometry`、两个 `MeshStandardMaterial` 和三个 `InstancedMesh` 分别绘制 64 个中心频谱方块、`cubeCount` 个外围方块和三颗卫星；固定环境光/方向光，不加载 texture 或外部资产。
- 任意长度的 `centerSpectrum` 等分为 64 个连续区间，每段取有限非负最大值；空段为 0，规范值为 `clamp(log1p(value) / log1p(128), 0, 1)`。中心环半径为 `0.85B`，径向长度为 `0.12B + 0.68B * amplitude`，横截面为 `0.08B`，整体视觉缩放为 `sqrt(clamp(coreScale,0,8))`。
- seed 为每个外围方块固定左右区域、深度、初始高度、`0.08B…0.20B` 尺寸和朝向；`cubeCount` 只改变外围实例数量。高度使用 `-3B + mod(seedOffset + B * integratedRise, 6B)`。
- 三颗卫星的轨道半径为 `1.8B`、`2.35B`、`2.9B`，轨道平面倾角为 `-25°`、`20°`、`55°`；seed 决定初相位，`orbitSpeed` 单位为 rad/s。
- 相机使用 45° perspective FOV，位置为 `(0,0.8B,cameraDistance)` 并看向原点；resize 只更新 aspect/projection。背景、核心/卫星颜色与外围颜色分别读取批准的 constant 参数。
- rise/orbit 均按固定 60Hz 从歌曲 0 秒积分 resolved speed，每秒建立 checkpoint 并按 binding revision 隔离；中心频谱和 coreScale 使用当前 resolved value。相同 seed、工程、数据、binding revision 与绝对时间必须产生相同状态，禁止 RAF delta。
- renderer-neutral hash 以 `1e-6` 量化布局、频谱、积分相位、颜色和相机状态后稳定生成。binding loading/error 或非有限值按 descriptor 默认值降级；错误仍保留在 inspector，不污染其他参数。

Cube 默认 binding 由 descriptor 声明：`centerSpectrum` 使用 `amplitudeSpectrum/default/full`；`riseSpeed` 使用 `energy/default/scalar`，transform 为输入 `[0,25]`、输出 `[0.25,3]`、clamp 开启且无 smoothing；其余参数使用现有 constant default。`SceneRegistry.createDefaultBindings()` 读取该声明，首次切换到 Cube 后 active analysis set 必须恰为两项；strict JSON 导入与草稿恢复保留工程原绑定，不应用默认值覆盖。

V6 在不升级 JSON V1 的前提下增加 controller-local 模板 binding 缓存。当前歌曲会话中，离开模板前保存其完整 bindings，切回时精确恢复；目标模板尚无会话缓存时才使用 descriptor 默认 bindings。同歌工程导入只替换导入模板的缓存并保留另一模板状态；离页、重新进入或歌曲 content hash 变化时清空缓存。持久化工程仍只包含当前模板，刷新后的非当前模板状态不被承诺恢复。

V3 canonical 阶段曾以明确的 V4 中性预览验证 scene disposal 与单 host/renderer/Canvas；该历史 artifact 不改写。V4 已用 DEC-041 的真实 Cube Swarm 替换中性预览，V3 前向回归验证真实 Cube 切换仍保留同一 host/renderer/Canvas；V4 34/34 clean canonical 与 owner 门禁已获批准。

## Renderer Host and Lifecycle

- 一个 Visualizer 页面只有一个 16:9 Canvas、一个 Three.js `WebGLRenderer` 和一个 cancellable RAF。scene 不能创建 renderer、AudioContext、Worker 或额外 RAF。
- 播放时 host 用 PlaybackSnapshot 的 AudioContext 基准时间渲染；录制 capture lease 存续期间，同一个 host RAF 在 recorder 启动/收尾的暂停窗口也保持画布帧节奏，lease 释放后恢复“暂停、seek、参数变更和 resize 只触发一次 request-render”。
- template switch 先停止旧 scene 更新、dispose geometry/material/texture/scene，再在同一 host 创建新 scene。DOM inspector 与 transport 不由 scene 管理。
- seed 决定初始布局；粒子位置、rise 和 orbit 使用绝对时间公式或确定性积分/checkpoint，不依赖 frame count。
- 开发诊断在每次成功绘制后记录 `lastSongTimeSeconds` 和 `lastFrameAtMs`，并继续通过 `__VISUALIZER_DIAGNOSTICS__` 与兼容别名 `__VISUALIZER_V3_DIAGNOSTICS__` 暴露同一对象；该追加不改变生产公共接口。
- `webglcontextlost` 阻止默认销毁、取消 pending visual RAF、进入带文字的 `recovering` 状态并保留工程/播放；不暂停或 seek transport。Three.js 先在同一 `WebGLRenderer` 对象内恢复 GL 内部状态，host 的 `webglcontextrestored` 处理随后 dispose 旧 scene、重建 scene GPU 资源并从当前绝对时间绘制。录制期间 context loss 进入 error 并丢弃未完成 Blob。
- 所有图片/纹理必须为本地、同源或 origin-clean；否则在加载时拒绝，不能等到 `captureStream()` 才失败。

## Error Isolation

- 参数/绑定错误隔离到参数并显示可修复状态；scene renderer error 隔离到当前 scene，transport、工程导入导出和模板选择继续可用。
- 旧 template/binding revision 的分析或 resolver completion 必须丢弃。
- dispose、context restore 或 binding retry 失败不得创建第二 host；若唯一 host 无法恢复，页面保持可导出工程的明确错误状态。

## Approval State

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。本契约据此为 `approved`。V3 implementation commit 与 30/30 clean canonical 已于 2026-09-03 获 owner 批准，V3 关闭并开放 V4；同日 owner 选择并批准 DEC-041“核心环群”细化及 V4 quality contract。V4 Cube Swarm 34/34 clean canonical 与 owner 门禁随后获批。V5 40/40 clean canonical 和人工门禁也于 2026-09-03 获批，V5 已关闭并开放 V6；V6 当前只实施既有契约内的 final hardening，尚未形成 canonical。
