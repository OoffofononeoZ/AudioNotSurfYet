# Visualizer 可执行资源包 V2

DEC-087 批准 V2 算法包、V5 自包含工程及原生隔离。2026-10-20 的 DEC-088 批准外部文件夹、只读目录加载和独立 skill 2.0.0，替代仅项目内 catalog 及暂不升级 skill 的限制；不授权未来具体内容、ZIP、后端、任意 URL 或发布。

## 格式基础

- 包仍为 `audiosurf-visualizer-resource`，schemaVersion 为 2，包含 algorithms、elements、presets。算法以精确 `{id,version,hash}` 引用；元素定义引用算法，预设引用元素。
- AlgorithmDefinition 包含 apiVersion:1 或 2、contract、source 和 programs。ABI 1 保留历史参数/历史帧接口；ABI 2 新增工程内标记声明。programs 保存具名 Shader、几何类型和 uniform 类型。
- source 为自包含 ES Module，导出 create 工厂；源码、Shader、契约共同参与规范化 JSON SHA-256。哈希用于身份，不是作者认证。校验和解析不执行源码。
- 作者文件独立维护 JS、Shader 和 JSON，封装器把文本内嵌进生成包。输入路径限制在作者目录内，模块禁止外部导入，跨包引用按算法→元素→预设顺序封装。
- [Project V5](project-format-v5.md)保存元素、预设和算法快照，恢复不依赖商城目录。旧 V4/V1 不迁移；生成 skill 2.2.0 使用 VisualizerContentBriefV2，不兼容旧输入。

## 外部文件夹与封装

默认库为 `C:\Users\Ryan\Desktop\WheresYourElements\assets`。元素放 `elements/<id>/`，预设放 `presets/<id>/`，各包含 `resource-info.json`、`preview.svg`、`source/`、`resource-package.json`。完整信息格式见独立 skill 的[资源格式与 ABI](../../../skills/visualizer-content-generator/references/resource-format.md)。

信息 schemaVersion:1，含精确 resource、kind、title、description、creator、createdAt、previewPath、sourceEntry、packagePath、dependencies 和 order。creator 默认 default；createdAt 是实际创建时间，重新封装不重置。路径相对自身资源根，不接受点段、绝对路径或跨资源依赖。元素包含完整辅助源码及 Shader；预设包只含组合定义，不含算法或元素，dependencies 恰为已有元素的去重精确引用。

`npm run visualizer:resources` 封装外部库，`npm run visualizer:resources:check` 只读核对，`VISUALIZER_ASSETS_DIR` 覆盖默认位置。独立 skill 可运行 `node <skill>/scripts/resource-library.mjs --build|--check <assets>`。dev/build 不执行封装、不复制外部库；仓库不保存资源库的源码、运行包和专用预览。

## 目录加载与所有权

“添加元素”首次提示选择 assets，由“选择文件夹”调用 `showDirectoryPicker({mode:'read'})`。独立 `audionotsurfyet-resource-directory` IndexedDB 仅保存目录句柄，不复制资源库。进入页面只 `queryPermission`，授权有效时自动恢复；失效时由可见“恢复访问”按钮 `requestPermission`。权限语义依据 [Chrome File System Access 说明](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)。

读取信息、预览、运行包及源码入口存在性，校验路径、身份/依赖、重复项、预设组成及算法/Shader 初始化，整体通过才替换可添加库。取消、失败、迟到结果及离页不得覆盖当前可用库；句柄保存失败只提示下次需重新选择。“重新加载”读取外部新增/修改，失败保留当前库；浏览器不写外部文件。

Visualizer 页面统一拥有资源库、任务和预览对象 URL，商城/列表共享元数据与 URL。成功刷新/切换释放旧 URL，失败保留；离页取消任务并释放。未连接库时列表显示通用资源标记；V5 工程和草稿依靠内嵌快照继续渲染与导出，工程格式和隔离接口不变。

## 隔离与帧契约

算法在不授予同源权限的 iframe 所属 Worker 执行；CSP 禁止网络，宿主不在主页面求值算法。Worker 只获得当前工程获准的参数、分块历史输入和已绑定标记，返回 DrawPacket。宿主校验身份、数值、缓冲与目标后，通过现有单 Canvas/WebGLRenderer 绘制。

- 模块导出同步 create 工厂；实例实现 prepareFrame，可选 reset/dispose。帧输入包含绝对歌曲时间、seed、binding revision、输出尺寸、有效时段和已解析参数/单位。
- 历史请求只允许 contract.historyParameters 中的参数，固定 60 Hz，每次不超过一秒且不越过目标歌曲时间；宿主提供分块结果，不提供整曲 PCM。当前弦线保持原 60 Hz 输入、120 Hz 积分与逐秒 checkpoint。
- DEC-089 批准 ABI 2 的 markerInputs/timingInput。外部包只声明点/范围及 single/collection 能力；用户在工程内绑定同歌快照。input.markers 只在当前实例的 prepareFrame 有效，集合按窗口/分类查询并以 256 项分页。完整字段、半开窗口和游标边界见[独立标记契约](../../../skills/visualizer-content-generator/references/editor-marker-inputs.md)。不提供整份 Editor、BPM、候选或音色字段；初始化阶段没有接口。
- DrawPacket 的 passes 只能引用包内程序；uniform 类型和数组长度按程序声明校验，纹理只能引用当前效果输入。三角网格必须使用有限 Float32 缓冲并遵守顶点容量。
- 算法不能访问 DOM、网络或应用存储，Worker/OffscreenCanvas 等旁路在运行前关闭。只有可信 bootstrap 持有消息传输；每帧回调结束即撤销，不能借用其他实例的输入。算法源码只通过消息进入隔离 Worker，不插入主页面或桥接 HTML。
- GPU 材质/几何按程序内容复用，合成器只管理图层、目标及转场仲裁，不按算法 ID 分派。算法实例和历史缓存按叶 UUID 独立。

预览保留单在途任务和最新待办，跳转/绑定/身份变化使旧结果失效；离线导出逐帧等待计算与绘制，不跳帧。实例按 UUID 隔离，历史输入和 checkpoint 保持确定性。原生方案不承诺硬性 JS 内存或 GPU 时间配额；沿用 65,536 顶点容量，算法计算等待累计超过 10 秒中止，宿主输入准备单独计时。

资源缺失、初始化、计算超时、Shader 编译、context loss 或取消均明确失败并释放对应运行资源，不降档或回退旧算法。新增内容仍需具体内容合同；本页不授予新增视觉内容或发布授权。
