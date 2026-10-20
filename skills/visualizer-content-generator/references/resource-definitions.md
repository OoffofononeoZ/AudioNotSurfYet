# V2 定义与输入字段

本页与 [ABI](resource-format.md) 配合使用。所有对象采用严格字段校验，不允许自行添加字段。身份均为 `{id,version,hash}`，ID 使用小写字母/数字及点、下划线、短横线，version 为正安全整数。

## ElementDefinition

必填 id、version、hash、algorithm（精确算法引用）、kind、title、icon、parameters；可选 inputParameter 须与算法契约相同。kind 为 visual/modifier/transition。算法声明 markerInputs 时元素须按相同顺序提供同名、同类型、可收窄模式的声明及 label；字段见[标记输入](editor-marker-inputs.md)。

icon 保留现有格式枚举：square、strings、dots、rings、radial、orbit、wireform、arcs、tunnel、stars、scale、blur、fade。独立预览由 resource-info.previewPath 提供，不把新图形写进应用图标表。

parameters 顺序及数量必须与算法契约一致。每项含 id、label、valueKind、defaultValue、allowedSourceKinds，可有 range、vectorElementRange、allowEmptyVector、allowedAnalysisComponents、allowedAnalysisProjections、defaultBinding。数值范围为 `{min,max,integer?,editingPrecision?}`。元素只能收窄算法能力；defaultBinding 是移除 parameterId 的绑定对象。

## Binding

每个参数恰有一项 `{parameterId,source,transform?}`，顺序与 descriptor 一致。

| source   | 字段与限制                                                                                        |
| -------- | ------------------------------------------------------------------------------------------------- |
| constant | `{kind:'constant',value}`；类型和范围符合 descriptor                                              |
| analysis | `{kind:'analysis',featureId,component?,projection}`；descriptor 必须允许 analysis                 |
| native   | `{kind:'native',featureId:'frequency'或'waveform'}`；仅允许 native 的 vector 参数，不带 transform |
| unbound  | `{kind:'unbound'}`；仅允许 analysis 的参数，不带 transform，启用时阻止导出                        |

projection 为 `{kind:'scalar'}`、`{kind:'full'}`、`{kind:'mean'或'max'或'peak'}`、`{kind:'bin',index}` 或 `{kind:'band',start,end}`。索引、维度及 component 必须适配特征和 descriptor；标量特征用 scalar，向量输入用 full 或获准的标量投影。

component 为 default/total/specific/real/imag/magnitude/phase；loudness 区分 total 标量及 specific 向量，complexSpectrum 使用 real/imag/magnitude/phase。普通向量不伪造复数分量。完整 Buffer 是 1024 点，不使用包络替代。

transform 适用于 number 参数或 full analysis 向量，完整字段为 inputMin、inputMax、outputMin、outputMax、clamp、invert、attackSeconds、releaseSeconds。数值须有限，输入区间严格递增，输出端点须位于 descriptor 的数值或向量分量范围，时间非负，布尔字段为布尔。full 向量的 attackSeconds/releaseSeconds 必须为零；color/boolean 不使用数值 transform。原生输入和 unbound 均不带 transform。

当前 Analyzer FeatureId：wallpaperEngineSpectrum、rms、zcr、energy、amplitudeSpectrum、powerSpectrum、spectralCentroid、spectralFlatness、spectralFlux、spectralSlope、spectralRolloff、spectralSpread、spectralSkewness、spectralKurtosis、spectralCrest、chroma、loudness、perceptualSpread、perceptualSharpness、mfcc、complexSpectrum、buffer。具体 component/projection/长度须由随 skill 的 V2 codec 核对；不支持的组合不能通过改名或 fallback 绕过。

## PresetDefinition

必填 id、version、hash、title、description、preview、elements、controls。preview 保留 geometric/cinematic 格式枚举；显示的独立 SVG 仍来自 resource-info。elements 非空；每项为：

- key：本预设内唯一 ID；element：已存在元素的精确引用。
- name、enabled：非空名称和布尔值。
- bindings：完整参数绑定，遵守 descriptor 顺序、默认精度和四特征预算。
- markerBindings：声明独立标记输入时必填，每个输入 ID 对应 `{kind:'unbound'}`；timingInput 不重复保存。模板不包含实际工程引用。
- timing：普通子项为 `{kind:'relative',start,end}`，满足 `0 ≤ start < end ≤ 1`；转场必须 `{kind:'unbound'}`，添加后由用户选择实际范围。
- targets：visual 禁止；效果必填 `{kind:'composition'}` 或 `{kind:'elements',ids:[子项key]}`，仅引用本预设的视觉项。空 ids 是明确待选状态，启用时阻止导出。

预设运行包 algorithms/elements 为空，仅 presets 含此定义。resource-info.dependencies 是子项精确元素引用去重集合。缺少元素先完成单独元素审批/封装/验证，不在预设包补齐。

controls 可为空。每项含唯一 id、label、kind、parameterId、targets（非空且不重复的子项 key）、value，可选 field：

- value：只允许算法 sharedParameters 中的 number 处理参数，不提升样式常量；value 为有限处理数值。
- binding：只允许算法 inputParameter；value 为移除 parameterId 的完整绑定。
- transform：只允许数值 analysis inputParameter 的一个变换字段，field 为 transform 的八个字段之一，value 是对应数值或布尔。

共同控件不得重叠控制同一字段，整个 binding 和它的 transform 字段不能分别归不同控件。每个默认子项的当前值须与控件 value 一致。运行时批量写入、独立编辑后提示差异，不建立继承。
