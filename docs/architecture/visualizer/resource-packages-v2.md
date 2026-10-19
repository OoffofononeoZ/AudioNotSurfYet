# Visualizer 可执行资源包 V2

2026-10-19，owner 批准项目内可加载算法资源包计划：原生浏览器隔离执行，工程内嵌算法，新格式替换旧格式。不增加后端、外部 URL 或磁盘资源包加载，不修改内容生成 skill。

## 格式基础

- 包仍为 `audiosurf-visualizer-resource`，schemaVersion 为 2，包含 algorithms、elements、presets。算法以精确 `{id,version,hash}` 引用；元素定义引用算法，预设引用元素。
- AlgorithmDefinition 包含 apiVersion:1、contract、source 和 programs。contract 声明参数能力、共同处理字段与历史输入；programs 保存具名 Shader、几何类型和 uniform 类型。
- source 为自包含 ES Module，导出 create 工厂；源码、Shader、契约共同参与规范化 JSON SHA-256。哈希用于身份，不是作者认证。校验和解析不执行源码。
- 作者文件独立维护 JS、Shader 和 JSON，封装器把文本内嵌进生成包。输入路径限制在作者目录内，模块禁止外部导入，跨包引用按算法→元素→预设顺序封装。
- [Project V5](project-format-v5.md)保存元素、预设和算法快照，恢复不依赖商城目录。旧 V4/V1 不迁移；生成 skill 暂时仍描述旧格式。

## 作者目录与封装

作者源在 `resources/visualizer/`，catalog.json 登记平级包文件。每个包声明算法契约、entry、可选 includes 和具名 programs；程序以 vertexFile/fragmentFile 指向目录内文本。封装器按 includes 顺序连接辅助源码及 entry，形成不含 import 的单个 ES Module；代码、Shader 和 JSON 均在资源目录维护，不从应用源码导入。

`npm run visualizer:resources` 生成 `public/visualizer-resources/v2/`；dev/build 前自动执行。`npm run visualizer:resources:check` 对比源和产物，只读检查。工具封装身份和引用，不代替运行时 schema、依赖、模块初始化及画面验证。

当前 13 个算法及两套预设已迁移。商城只请求同一项目目录内索引和 JSON，不接受任意 URL；包整体通过校验和隔离初始化后注册。磁盘资源包及旧导入库入口暂时隐藏，不读取或清空旧库；工程文件 IO 继续有效。

## 隔离与帧契约

算法在不授予同源权限的 iframe 所属 Worker 执行；CSP 禁止网络，宿主不在主页面求值算法。Worker 只获得当前工程获准的参数及分块历史输入，返回 DrawPacket。宿主校验身份、数值、缓冲与目标后，通过现有单 Canvas/WebGLRenderer 绘制。

- 模块导出同步 create 工厂；实例实现 prepareFrame，可选 reset/dispose。帧输入包含绝对歌曲时间、seed、binding revision、输出尺寸、有效时段和已解析参数/单位。
- 历史请求只允许 contract.historyParameters 中的参数，固定 60 Hz，每次不超过一秒且不越过目标歌曲时间；宿主提供分块结果，不提供整曲 PCM。当前弦线保持原 60 Hz 输入、120 Hz 积分与逐秒 checkpoint。
- DrawPacket 的 passes 只能引用包内程序；uniform 类型和数组长度按程序声明校验，纹理只能引用当前效果输入。三角网格必须使用有限 Float32 缓冲并遵守顶点容量。
- 算法不能访问 DOM、网络或应用存储，Worker/OffscreenCanvas 等旁路在运行前关闭。算法源码只通过消息进入隔离 Worker，不插入主页面或桥接 HTML。
- GPU 材质/几何按程序内容复用，合成器只管理图层、目标及转场仲裁，不按算法 ID 分派。算法实例和历史缓存按叶 UUID 独立。

预览保留单在途任务和最新待办，跳转/绑定/身份变化使旧结果失效；离线导出逐帧等待计算与绘制，不跳帧。实例按 UUID 隔离，历史输入和 checkpoint 保持确定性。原生方案不承诺硬性 JS 内存或 GPU 时间配额；沿用 65,536 顶点容量，算法计算等待累计超过 10 秒中止，宿主输入准备单独计时。

资源缺失、初始化、计算超时、Shader 编译、context loss 或取消均明确失败并释放对应运行资源，不降档或回退旧算法。新增内容仍需具体内容合同；本页不授予新增视觉内容或发布授权。
