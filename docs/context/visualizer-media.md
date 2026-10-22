# Visualizer 媒体输入

2026-10-22 owner 以“Implement the plan.”批准 Circular Visualizer 预设、图片／视频背景及全部现有输出场景；选择继续自包含 JSON。资源包 V2、工程 V5、RealtimeStyleV1 的版本保留，以可选字段扩展，已有资源身份不变。

## 数据与权限

ABI 3 继承 ABI 2，增加 executionModes（timeline/realtime）和 mediaInputs。元素提供同序输入定义及标签，可收窄类型与多选能力。媒体独立于 number/boolean/color/vector 参数与音频 binding，不计 Analyzer 特征数。

实例 mediaBindings 对每个声明的输入恰有一项：none 表示明确无素材；media 保存素材 ID 列表、fit、intervalSeconds、crossfadeSeconds。多选仅用于图片轮播，单个视频循环；外部预设只保存 none，不包含用户文件。工程／实时样式的可选 mediaAssets 表以原始字节 SHA-256 去重，保存名称、MIME 与 Base64；哈希和引用在恢复时校验。支持 PNG/JPEG/WebP 与 MP4/WebM，实际编码须通过解码检查。

算法 Worker 只收到 mode 与媒体可用性、尺寸、淡化比例、填充方式等元数据。Shader media uniform 静态声明 inputId 和 current/next slot，DrawPacket 必须返回相同输入 ID。宿主解析纹理，算法不得接触文件、URL、解码器、DOM 或像素。目录与算法初始化不读取用户媒体。

## 时间与所有权

歌曲预览与离线视频使用既有 mediabunny@1.61.6 按目标时间解码，每帧等待准备；实时与壁纸使用宿主静音 HTMLVideoElement，按会话时钟对齐。视频音轨不进入导出或分析。歌曲媒体时间相对元素起点，实时媒体时间为会话时间，视频按时长循环。轮播按固定间隔切换，区间末尾交叉淡化；fit 为 cover/contain/initial。

媒体运行时只保留活动素材和所需视频帧，不预解码整段视频。元素隐藏、替换、离页、context loss 和取消释放帧、解码器、ImageBitmap、纹理与对象 URL，迟到结果不得覆盖当前场景。继续复用单 Canvas、RendererHost 和视觉 RAF。

媒体纹理沿用现有 DrawPacket shader 与合成器的显示编码 RGB，设置 NoColorSpace，避免额外的 sRGB 到线性转换压暗中间色。实时视频使用 VideoTexture 更新原生视频帧，歌曲和离线帧由宿主显式更新纹理。

歌曲模式允许合同声明的历史重建；实时模式只允许 ABI 3 显式声明 realtime 的历史算法采用因果分支，运行时仍拒绝历史和标记查询。既有 ABI 1/2 的实时能力限制不变。

## 编辑与保存

属性面板由宿主选择、验证并原子替换媒体；取消或失败保留当前配置。提供填充、轮播间隔和淡化设置，清除回到 none。缺失引用、损坏媒体、解码和配额错误明确失败，不静默改用背景色。禁用元素不解码。

媒体随工程草稿、JSON、实时样式及 Wallpaper Engine 的 style-data.js 携带；不依赖原路径、资源站或网络。Base64 会增加文件体积和读写内存，这是本轮选择的自包含代价。素材按引用去重，移除最后引用后从新快照清除；已保存的独立样式不跟随原工程修改。

## 工具

以 AudioSurf resourceCodec.ts 为事实源，npm run visualizer:skill-codec 生成外部 skill 的独立 codec；visualizer:skill-codec:check 只读比较。外部 skill 继续独立封装，不在运行时导入宿主源码。

本专题描述接口，不将未执行的浏览器／媒体验证记录为通过。相关现有合同见[资源包](../architecture/visualizer/resource-packages-v2.md)、[实时样式](visualizer-realtime.md)和[离线导出](visualizer-offline-export.md)。

## 本次验证与范围

Visualizer 单元与集成测试 195 项、外部 skill 测试、Chrome／Edge 专项及生产构建通过；浏览器验证覆盖媒体导入、轮播、视频定位、工程／实时样式恢复、Logo 裁切与 context 恢复。四档离线视频在两个浏览器生成的八份文件均完整解码，分辨率、帧数与时间戳符合目标。2026-10-22 owner 明确 Wallpaper Engine 导出后运行时已有问题属于其他范围，本次不以该运行时作为验收条件，不继续相关测试。
