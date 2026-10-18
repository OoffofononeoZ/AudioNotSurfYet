# 内容生成规则

## 事实源与按需读取

先读 [Project V4](../../../docs/architecture/visualizer/project-format-v4.md)、[资源包 V1 过渡版](../../../docs/architecture/visualizer/resource-packages-v1.md)、资源 codec、kernelContracts 和最相近 JSON/测试。新绘制算法仍需应用代码，当前资源包不是最终 DSL/Shader 自由发布方案。

- 预设：读现有 presets JSON、共同控件实现和 session 的 `addPreset`；不要重建编译期内容配置工厂。
- Analyzer：读 FeatureRegistry、`compositionResolver.ts`、projection 和 signal 单位适配。
- native：读 [原生输入](../../../docs/context/visualizer-native-input.md) 及当前支持参数，不复制 OfflineAudioContext 处理链。
- 渲染/确定性：读 `compositionScene.ts`、相关纯状态模块及 `rendererTypes.ts`。
- 输出：读 [离线导出](../../../docs/context/visualizer-offline-export.md)，不以历史实时录制合同规划新内容。

当前生成契约见 [内容生成](../../../docs/architecture/visualizer/content-generation.md)。旧场景与 V1–V6 文档仅解释历史，不能覆盖当前接口。

## Content Contract

合同必须让实现者无需猜测地完成本次内容，并在批准前明确：

1. element/preset ID、标题、视觉目标和复用/新增拆分。多个对象不自动等于一个新元素：可独立编辑的行为优先拆分，先核对已有能力。
2. 每个新增类型的 ElementKind、参数 ID/标签、valueKind、默认值、范围/单位、editingPrecision、允许来源与完整默认 binding。颜色/布尔等按当前 descriptor 能力配置，不发明 enum/string 类型。
3. 数据改变的属性、静音/低/高或静态表现；Analyzer 的具体 FeatureId/component/projection/transform，native 的 featureId/单位/声道布局，向量到对象/频段的分配。
4. 手动时段、转场的显式单范围或 unbound、视觉目标或整体目标；转场前后终值、重叠接管、排序/层级语义遵守现有组合器。
5. seed 和绝对时间模型、需要的纯状态/checkpoint identity、重置及同时间确定性判据；direct 不强制积分，有历史状态时才定义固定步进。
6. 最大几何/实例与每帧工作量、组合后的资源/特征预算、dispose 所有权、resize/context recovery 和离线逐帧输入准备方式。预算是本内容的获批限制，不修改全局性能承诺。
7. 资源 ID/版本、精确依赖、内核 ABI 和是否扩展代码；预设组内名称、绑定、顺序、相对时段、内部目标映射与共同控件目标/默认值。未选择的 Editor 标记保持 unbound，不按名称猜测。
8. 具体单元/集成/浏览器/媒体检查、视觉参考状态、现有阈值、需要的 owner 输入，以及无法验证的部分。

展示后输出 `AWAITING_APPROVAL`；批准后轻量合同保存用户批准来源，不要求统一 frontmatter、阶段文件或每内容 readiness。

## 元素与参数

- 优先编写引用已有 kernelId/version 的 JSON 元素定义，提供完整参数与默认绑定。新算法才扩展 ElementType 内核、kernelContracts 与组合器分派。绘制与历史输入判断按内核身份，不按资源 ID；工程使用内嵌定义，不读取商城当前版本。
- visual 不含 targets；modifier/transition 只能影响视觉元素 ID 或 composition，不能影响其他效果。删除视觉元素时沿用原子清理引用；空目标可保存、启用时阻止导出。
- 普通元素使用手动歌曲时段；transition 仅引用同歌 Editor 快照中的一个 range。snapshot 只显式刷新，时间引用不是 editor-event 参数来源。
- 新默认常量和预设常量遵守参数 editingPrecision；载入的工程/草稿和歌曲时长不量化。默认绑定只用于新增，不改绑既有工程。
- 参数未就绪沿用当前 resolver/合成器的 loading/error、提示和跳过行为；不要复制旧场景的 descriptor-default 静默 fallback。启用的未配置元素或缺失输入不能伪装成可导出。

## 输入与预算

- 使用现有 constant/analysis 和受支持参数的 native source；不得把旧公共类型中残留的 editor-event 当作 V4 能力。
- 四种不同 Analyzer 特征是**全工程**上限，严格导入校验包含禁用元素；运行时只请求启用元素需要的集合。多个元素共享同一特征只计一项，native 不计入。
- 预设须核对已有工程与新增内容的特征并集，沿用完整校验、失败不替换工程的行为，不自动禁用/改绑元素腾额度。
- 参数真实单位由当前 resolver/渲染层处理；完整向量、投影标量、原生 byte 频谱与有符号波形不能混为同一量纲。沿用已有 analysisSignal/适配，不重复换算。
- 某个复刻预设的 0.6、wallpaperEngineSpectrum 或四段分镜不是全局默认。没有明确节拍/副歌来源时，分镜只称手动默认时段。

## 预设、确定性与资源

- 使用数据驱动实例化器：每次生成组与子元素新 UUID，在现有顶层项上方添加整组，内部效果引用映射到本次 UUID。组内顺序决定连续图层，不与其他顶层项交错。
- V4 持久化预设身份、子元素归属、资源快照和最后共同值。子元素仍可编辑/删除；共同值批量写入，单独更改显示差异，重新应用覆盖相应字段。删除清理效果和控件目标；隐藏组不改写子元素开关。
- 共同控件只声明内核允许的处理字段，显式选择目标，不自动把同名样式字段提升到组级。不同输入设计拆分控件，保持初始值与各目标一致。
- 用 `node scripts/visualizer-resource-package.mjs <package.json>` 封装哈希，再用 `--check` 只读核对；升级内容版本并同步跨文件引用。封装不代替 strict 导入、运行时验证或具体内容批准。
- 视觉随机性使用持久化 seed 与绝对歌曲时间；UUID 仅为持久化身份。不得使用未固定随机或 RAF delta 推进视觉状态。
- 使用现有 CompositionResolver/Scene、单 RendererHost/Canvas/WebGLRenderer/视觉 RAF 和三个可复用 render targets。纯状态不读取 store、wall clock、AudioNode 或自建 Worker。
- 带历史的行为定义固定步进和缓存身份（歌曲/decoded revision、元素配置/绑定 revision、seed、算法），seek/循环/导出从确定状态恢复；不要把弦线的特定积分频率泛化给所有元素。
- 元素不能自建音频/导出服务。原生输入使用已有共享任务、缓存及取消；新历史需求超出当前原生准备接口时先明确接口影响并评审，不能拿当前帧或零填补历史。
- geometry/material/texture 等自有资源幂等释放；共享资源由组合器所有者释放。移除、重建、context recovery 和离页后回到对应基线。
- 预览与导出复用同一 renderer；导出使用手动租约、`i/fps` 绝对帧时间、输入准备和现有 WebCodecs/OPFS 链路。不得调用 captureStream/MediaRecorder 或新建实时 tap。

不新增兼容迁移、远端资产、依赖或用户脚本。需要改变来源类型、工程格式、拓扑、支持矩阵或阈值时先提交独立决定，不把 `READY_FOR_CONTRACT` 解释成架构授权。
