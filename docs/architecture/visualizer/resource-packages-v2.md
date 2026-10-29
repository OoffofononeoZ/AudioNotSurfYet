# Visualizer 可执行资源包 V2

DEC-087 批准 V2 算法包、V5 自包含工程及原生隔离。2026-10-20 的 DEC-088 批准外部文件夹、只读目录加载和独立 skill 2.0.0，替代仅项目内 catalog 及暂不升级 skill 的限制；不授权未来具体内容、ZIP、后端、任意 URL 或发布。

## 格式基础

- 包仍为 `audiosurf-visualizer-resource`，schemaVersion 为 2，包含 algorithms、elements、presets。算法以精确 `{id,version,hash}` 引用；元素定义引用算法，预设引用元素。
- AlgorithmDefinition 包含 apiVersion:1、2、3、4 或 5、contract、source 和 programs。ABI 1 保留历史参数/历史帧接口；ABI 2 新增工程内标记声明。programs 保存具名 Shader、几何类型和 uniform 类型。
- source 为自包含 ES Module，导出 create 工厂；源码、Shader、契约共同参与规范化 JSON SHA-256。哈希用于身份，不是作者认证。校验和解析不执行源码。
- 作者文件独立维护 JS、Shader 和 JSON，封装器把文本内嵌进生成包。输入路径限制在作者目录内，模块禁止外部导入，跨包引用按算法→元素→预设顺序封装。
- [Project V6](project-format-v5.md)保存元素、预设和算法快照，恢复不依赖商城目录。旧 V4/V1 不迁移；生成 skill 2.7.0 使用 VisualizerContentBriefV2，不兼容旧输入。

## 外部文件夹与封装

默认库为 `C:\Users\Ryan\Desktop\WheresYourElements\assets`。元素放 `elements/<id>/`，预设放 `presets/<id>/`，各包含 `resource-info.json`、`source/`、`resource-package.json` 及封面。格式和加载允许封面缺失；正常生成交付须附至少一张实际展示图并填写 previewPath。完整编写说明见根 AGENTS 指向的外部 skill 的资源格式与 ABI 参考。

信息 schemaVersion:1，含精确 resource、kind、title、description、creator、createdAt、可选 previewPath、sourceEntry、packagePath、dependencies 和 order。creator 默认 default；createdAt 是实际创建时间，重新封装不重置。路径相对自身资源根，不接受点段、绝对路径或跨资源依赖。元素包含完整辅助源码及 Shader；预设包只含组合定义，不含算法或元素，dependencies 恰为已有元素的去重精确引用。

DEC-100 允许宿主把当前实时可用画面导出为预设：V2 子项可保存配置 seed（uint32/null，仅 usesSeed 元素），预设可内嵌 mediaAssets，mediaBindings 引用自身素材表。添加时保留 Seed、按 hash 合并媒体并适配完整歌曲时段；省略新字段的既有预设行为与身份不变。普通内容生成仍以 none 媒体为默认，不夹带用户文件。

SVG 与 PNG/JPEG/WebP 一样属于正常展示图片资源，扩展名不区分大小写。独立 SVG 支持基础图形、文字、defs、渐变、裁剪/蒙版和静态滤镜；url(#id) 和 href="#id" 只能引用同一 SVG 内已存在的定义。拒绝脚本、事件、style/CSS、外部引用/嵌入及 DTD/处理指令；SVG 以 image/svg+xml 解码，通过 Blob URL 在 img 中显示。

优先读取 previewPath（例如 preview.svg 或 images/cover.svg，相对资源自身根目录，使用 / 分隔），再按资源根目录的 cover._、preview._、其余文件名寻找可解码图片；缺失或损坏时使用共享 /default_cover.png，不阻断合法运行包。封面不参与资源身份；取消、权限及路径错误仍正常失败。

`npm run visualizer:resources` 封装外部库，`npm run visualizer:resources:check` 只读核对，`VISUALIZER_ASSETS_DIR` 覆盖默认位置。独立 skill 可运行 `node <skill>/scripts/resource-library.mjs --build|--check <assets>`。dev/build 不执行封装、不复制外部库；仓库不保存资源库的源码、运行包和专用预览。

## 目录加载与所有权

“添加元素”打开资源商城，首次由“加载资源库”、连接后由“更换文件夹”调用注入的 `DirectoryFileAccess`。Web 继续 `showDirectoryPicker({mode:'read'})`，独立 `audionotsurfyet-resource-directory` IndexedDB 保存原目录句柄；进入页面只查询权限，失效时由可见“恢复访问”按钮申请读取。权限语义依据 [Chrome File System Access 说明](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)。

Electron 使用原生目录对话框，同一 repository 保存纯数据授权引用；主进程保存路径并约束所有相对读取，renderer 不获得路径或浏览器句柄方法。重启查询已有授权，目录移除明确失败；授权丢失需重新选择目录，不能由 renderer 自行续权。两端均不复制资源库，使用同一校验/候选替换逻辑。当前只读接入已实现，实际原生操作仍受启动异常阻断，桌面预设写入待 D3，见[双端实施状态](../../context/desktop.md)。

读取信息、预览、运行包及源码入口存在性，校验路径、身份/依赖、重复项、预设组成及算法/Shader 初始化，整体通过才替换可添加库。取消、失败、迟到结果及离页不得覆盖当前可用库；句柄保存失败只提示下次需重新选择。“重新加载”读取外部新增/修改，失败保留当前库。加载保持只读；仅用户显式“导出预设”请求当前句柄的写权限，并创建 presets/<唯一新 ID>/，不改写 elements 或已有资源。导出规则见[预设](../../context/visualizer-presets.md)。

Visualizer 页面统一拥有资源库、任务和预览对象 URL，商城/列表共享元数据与 URL。成功刷新/切换释放旧 URL，失败保留；离页取消任务并释放。未连接库时列表显示通用资源标记；V5 工程和草稿依靠内嵌快照继续渲染与导出，工程格式和隔离接口不变。

## 隔离与帧契约

元素定义可声明 `usesSeed:true`，表示该元素支持的实际画面（含可选随机分支）会使用 `frame.seed`；不使用时省略，不接受 false。能力声明参与元素 hash，更新必须提升元素版本并同步预设精确引用。共享源码出现 seed 不证明该元素的绘制分支使用 Seed；未接入 Seed 的 Shader 噪声也不声明。外部封装器与应用使用同一严格校验。

算法在不授予同源权限的 iframe 所属 Worker 执行；CSP 禁止网络，宿主不在主页面求值算法。Worker 只获得当前工程获准的参数、分块历史输入和已绑定标记，返回 DrawPacket。宿主校验身份、数值、缓冲与目标后，通过现有单 Canvas/WebGLRenderer 绘制。

- 模块导出同步 create 工厂；实例实现 prepareFrame，可选 reset/dispose。工程帧输入包含绝对歌曲时间、seed、binding revision、输出尺寸、有效时段和已解析参数/单位。[实时样式](../../context/visualizer-realtime.md)接入无历史/标记/转场依赖的算法，以及 ABI 3 显式支持 realtime 且不在实时分支查询历史的算法，使用单调会话秒、当前参数和 range:null，历史与标记查询明确拒绝；工程 ABI 和离线语义不变。
- 历史请求只允许 contract.historyParameters 中的参数，固定 60 Hz，每次不超过一秒且不越过目标歌曲时间；宿主提供分块结果，不提供整曲 PCM。当前弦线保持原 60 Hz 输入、120 Hz 积分与逐秒 checkpoint。
- DEC-089 批准 ABI 2 的 markerInputs/timingInput。外部包只声明点/范围及 single/collection 能力；用户在工程内绑定同歌快照。input.markers 只在当前实例的 prepareFrame 有效，集合按窗口/分类查询并以 256 项分页。完整字段见[标记类型](../../../src/visualizer/editorMarkerTypes.ts)，半开窗口和游标边界见[标记读取](../../../src/visualizer/editorMarkerReader.ts)及外部 skill 的标记输入参考。不提供整份 Editor、BPM、候选或音色字段；初始化阶段没有接口。
- DrawPacket 的 passes 只能引用包内程序；uniform 类型和数组长度按程序声明校验，纹理只能引用当前效果输入。三角网格必须使用有限 Float32 缓冲并遵守顶点容量。
- 算法不能访问 DOM、网络或应用存储，Worker/OffscreenCanvas 等旁路在运行前关闭。只有可信 bootstrap 持有消息传输；每帧回调结束即撤销，不能借用其他实例的输入。算法源码只通过消息进入隔离 Worker，不插入主页面或桥接 HTML。
- GPU 材质/几何按程序内容复用，合成器只管理图层、目标及转场仲裁，不按算法 ID 分派。算法实例和历史缓存按叶 UUID 独立。

预览保留单在途任务和最新待办，跳转/绑定/身份变化使旧结果失效；离线导出逐帧等待计算与绘制，不跳帧。实例按 UUID 隔离，历史输入和 checkpoint 保持确定性。原生方案不承诺硬性 JS 内存或 GPU 时间配额；沿用 65,536 顶点容量，算法计算等待累计超过 10 秒中止，宿主输入准备单独计时。

### 属性编辑与状态依赖（DEC-101）

全局 bindingRevision 只负责帧的新旧校验，不直接作为所有算法的缓存版本。宿主按叶 UUID、算法身份、有效时段、相关输入配置／数据身份和绑定标记维护独立 revision；名称、输出设置、保存状态和其他元素的编辑不清空该元素历史。

AlgorithmContract 可选 `stateParameters:string[]` 声明影响累计状态的参数，列表可为空、必须去重且引用已声明参数；宿主自动并入 historyParameters。省略时保留已有资源按全部参数配置失效的语义，不改变旧资源 hash。新资源的颜色、透明度等纯绘制参数不声明；阻尼、平滑及粒子累计参数必须声明。算法自身缓存键仍须包含实际状态参数值、seed 及影响状态的模式／时段。

每帧绑定明确工程和输入身份，历史／标记查询前后检查有效性；过期输入只结束该帧，Worker 完成拒绝后继续处理最新待办，不释放沙箱。真实输入错误、越权查询、算法超时仍明确失败。资源更新提升算法／元素版本并同步预设精确引用，已有工程内嵌快照不自动替换。V6 工程、V2 资源包、既有 ABI 行为、隔离权限及单渲染器边界保持。

资源缺失、初始化、计算超时、Shader 编译、context loss 或取消均明确失败并释放对应运行资源，不降档或回退旧算法。新增内容按[内容生成](content-generation.md)默认自主完成并附实际展示图，缺图/坏图的加载容错不变；架构、许可和发布边界独立。

## ABI 3 媒体扩展

2026-10-22 的 Circular Visualizer 计划增加受控媒体输入和显式执行模式，保留现有格式版本与旧资源身份；新增媒体链路及 ABI 3 的实时因果分支见[媒体输入](../../context/visualizer-media.md)。原有仅 ABI 1/2 或无媒体内容的约束继续适用其原范围。

## ABI 4 三维场景

世界元素使用 renderSpace:world、scene3dDefaults.camera 和 triangles，fragment 返回 vec4 shade()。宿主统一模型变换、镜头和 opaque/mask 深度绘制；预设 scenes3d 保存共享关系和完整轨迹。定义及边界见[三维场景](scene3d.md)。资源包仍为 V2，既有 ABI 1–3 资源身份不变。

## ABI 5 歌词扩展

DEC-106 增加 timeline-only 的 lyricInputs、只读 cue/token 帧数据及受控 lyrics sampler。宿主负责文件、分词、图集生成与释放，算法负责运动和屏幕三角形。预设模板仅允许 unbound；完整合同见[歌词输入](../../context/visualizer-lyrics.md)。既有 ABI 和资源身份保留。
