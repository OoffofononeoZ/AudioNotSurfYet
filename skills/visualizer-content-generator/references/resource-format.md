# 外部资源格式与 ABI 1/2

元素、预设、绑定、共同控件及 Analyzer 能力的完整字段见 [V2 定义与输入](resource-definitions.md)。

## 目录

assets/elements/<id>/ 和 assets/presets/<id>/ 各包含：

- resource-info.json：schemaVersion:1、resource:{id,version,hash}、kind（visual/modifier/transition/preset）、title、description、creator、createdAt（ISO 8601）、previewPath（可选）、sourceEntry、packagePath、dependencies（元素精确引用数组）、order（非负安全整数）。
- 可选封面：PNG、JPEG、WebP 或独立 SVG；推荐准确表达素材视觉效果，不强制制作。SVG 禁止脚本和外部链接/嵌入。
- source/resource.json：V2 作者定义。算法 entry、可选 includes、programs 的 vertexFile/fragmentFile 都相对资源根，位于自身 source/ 内。禁止绝对路径、反斜线、点段及链接逃逸。
- resource-package.json：format:audiosurf-visualizer-resource、schemaVersion:2、id、version、algorithms、elements、presets。运行包内嵌算法/Shader 文本。

封面优先使用安全的 previewPath（可指向自身子目录）；未指定或不可用时，只在资源根目录按 cover.*、preview.*、其余文件名顺序寻找可用图片。缺失或损坏封面不阻断合法资源；宿主使用播放器同一张 /default_cover.png。封面不参与运行包身份，工具不生成或改写图片。

元素文件夹恰有一个元素，携带自身直接引用的算法，无预设，dependencies 为空。预设文件夹恰有一个预设，algorithms/elements 为空；dependencies 恰为去重的子项元素精确引用。封装顺序算法→元素→预设，更新 hash/ref/info，不修改 createdAt。迁移已有资源时必须保留原运行包身份和参数。

哈希是删除自身 hash 后、对象 key 排序的规范 JSON 的 UTF-8 SHA-256，不是作者认证。版本为正安全整数；同 ID/version 不得对应不同 hash。

## 算法

AlgorithmDefinition 为 {id,version,hash,apiVersion:1或2,contract,source,programs}。contract 为 kind、parameters、可选 inputParameter、sharedParameters、historyParameters。参数为 id、valueKind、allowedSourceKinds 和适用的 range/vectorElementRange/allowEmptyVector/allowedAnalysisComponents/allowedAnalysisProjections。元素参数另含 label、defaultValue、可选 defaultBinding，能力只能收窄算法声明。

source 是自包含 ES Module，禁止 import/export-from/dynamic-import。同步 create() 返回有 prepareFrame(frame,input) 的实例，可选 reset()/dispose()。不得获取 DOM、网络、存储或自建 Worker/Canvas/音频对象。

frame 包含 time（绝对秒）、seed、revision、width、height、range（{startSeconds,endSeconds} 或 null）、parameters（ID → {value,unit?}）。prepareFrame 同步/异步返回 {passes,state?}，state 可为有限数值数组。

programs 的每项为 {vertex,fragment,geometry,uniforms}。geometry 为 quad/triangles。uniform 类型为 number/int/boolean/color/vec2/vec3/array/source，array 的 length 为 1–65536，source 只能引用当前效果输入。

DrawPass 为 {program,uniforms,mesh?}；mesh 含 Float32Array positions/colors/edges，最多 65,536 顶点。宿主校验身份、数值、程序及缓冲后绘制。

input.history({parameterId,startTick,endTick}) 仅允许 historyParameters，60 Hz、每次最多一秒、不得越过目标时间；返回 {time,value,unit?} 数组。计算等待累计超过 10 秒失败，不承诺硬性 JS 内存或 GPU 时间配额。

## 输入和工程

constant 支持 descriptor 允许的数值/布尔/颜色/数值向量。analysis 使用宿主已提供的 FeatureId/component/projection/transform；具体可用特征由实际宿主确认。native 仅 frequency/waveform，保留频谱 byte 和有符号波形单位，不带 analysis transform。Editor 事件不是参数来源。

随 skill 提供当前 V2 codec 的独立校验快照；未来 ABI/输入变更须同步工具和参考。工具不执行算法，隔离初始化/GPU/媒体在 Chrome/Edge 宿主中验证。V5 工程自包含全部算法、Shader、元素及预设快照；刷新库只更新可添加内容。只支持用户选择的只读文件夹，不支持 ZIP、任意 URL、后端或浏览器写库。

ABI 2 的 markerInputs、timingInput 和 input.markers 见 [工程内标记输入](editor-marker-inputs.md)。外部资源只声明能力，实际标记绑定只能保存在工程中。
