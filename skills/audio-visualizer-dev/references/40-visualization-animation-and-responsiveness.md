# 可视化、动画与响应式

当前Visualizer采用[Project V5](../../../docs/architecture/visualizer/project-format-v5.md)、[V2算法资源包](../../../docs/architecture/visualizer/resource-packages-v2.md)与[离线导出](../../../docs/context/visualizer-offline-export.md)。当前实现与约束见[页面接口](../../../docs/architecture/visualizer/interface-contracts.md)，不把历史V1–V6里程碑编号当schemaVersion。

## 当前绘制边界

- V2资源包携带隔离算法与绘图程序，符合已有ABI的新算法无需增加宿主分派。新增内容包括纯复用预设，使用根AGENTS指向的外部visualizer-content-generator自主设计生成，不另设内容批准门禁。
- 预览保持单RendererHost/Canvas/WebGLRenderer/视觉RAF；CompositionResolver/Scene和复用render targets处理元素、效果与范围转场。预设组身份/共同控件不产生独立renderer。
- 绝对歌曲时间、seed、固定步长/checkpoint决定状态，seek/循环/离线输出同源。弦线历史、native FFT/waveform和绑定准备按当前kernel处理，不能用RAF delta或元素显示名称分派算法。
- 离线输出取得同一renderer手动租约、严格尺寸/DPR1和frame index时间，WebCodecs/Mediabunny写OPFS；背压不会跳帧。结束释放并恢复预览，不恢复MediaRecorder/capture RAF链路。
- Analyzer卡与Editor overlay共用analysisCanvasRenderer。overlay用MarkerTimeView和标尺几何，fixed Canvas、DPR、clip与pointer-through按当前[Editor交互](../../../docs/architecture/editor/interaction-contracts.md)，不复制旧波形/marker样式令牌。
- LightBg/DotGridBg/MusicBar等装饰分别拥有现有Three.js、Canvas或GSAP资源；TestLands/threeDTable/testcomp是试验表面，不成为生产拓扑范本。
- 数值/几何、确定性hash、媒体/反馈与资源门槛见[Visualizer验证](../../../docs/quality/visualizer/validation.md)，按实际影响挑选专项。
- 外部库通过平台目录端口读取，资源校验/预览不直接调用浏览器句柄；Web 句柄和桌面授权引用的持久化与路径边界见[资源包](../../../docs/architecture/visualizer/resource-packages-v2.md)。更改目录交互时核对双端取消、权限、恢复及 URL 释放；桌面写入与实际验证状态以双端合同为准。
- 工程/WebM 通过注入的文件端口，codec 与控制器复用；普通业务组件不探测 Electron 或具体 picker。上传/下载差异集中在 `components/platform/` 控件和平台端口，Web 保留已有 HTML 上传与下载语义。桌面大文件保持分块确认背压及提交前取消，失败不能覆盖旧输出；更改文件 IO 须检查当前工程修订、退出清理与两端真实操作缺口。
- 预设/壁纸通过目录导出端口，复用依赖校验和文件格式。库读取不授予通用写权限，桌面预设需原生确认本次新目录；保持精确清单、路径/junction 边界和整体发布，取消不得删除外部新增或改动。修改时同时核对 Web 用户手势/写权限、桌面分块与清理所有权；原生启动受阻不能借浏览器结果记为验证通过。

## RAF 与 Observer

连续播放时间、分析帧值、动画相位和指针坐标留在音频时钟、renderer、RAF 或局部非响应式引用中；只有播放状态、当前选择、可见段落等实际变化的离散事实进入 Vue/Pinia。审查高频 callback 时检查是否每帧写 store、创建数组/对象或触发组件重渲染；必须进入响应式状态的低频值先比较新旧值并明确更新节奏。暂停、隐藏、离页与导出结束后核对不再产生无用更新。

- 每个持续动画只能有一个可取消的 RAF 句柄；开始前停止旧循环，停止/卸载时清空句柄。
- `LightBg` 使用 IntersectionObserver 控制可见性，并用 window resize 更新 renderer 尺寸与 shader uniform。
- `DotGridBg` 优先使用 ResizeObserver，回退到 window resize；两条路径卸载时都要正确解除。
- MusicBar 使用 ResizeObserver 重新计算文字跑马灯；旧 GSAP tween 必须 kill。
- 监听或 Observer 的 callback 若封装过 throttle/debounce，移除时要使用同一函数引用。
- 布局测量只在尺寸或影响布局的输入真实变化时更新；缓存键须包含实际影响画面的歌曲、模板、绑定、视口和 DPR，失效时清理旧资源。

## Three.js/WebGL 生命周期

创建顺序通常为 renderer、scene、camera、geometry、material、mesh；释放时至少检查：

- 停止 RAF 和事件监听。
- 从 scene 移除对象。
- `geometry.dispose()`、`material.dispose()`。
- `renderer.dispose()`，并移除 canvas。
- 清理组件持有的引用，避免可见性切换后重复 renderer。

既有背景和试验组件按所属模块释放geometry、material、renderer及context；LightBg的显式释放已有历史修复，相关改动仍核对当前cleanup，不沿用旧“未释放”的判断。

## Canvas

- renderer backing store 要与 CSS 尺寸和 devicePixelRatio 对齐。
- ResizeObserver 回调需避免零尺寸、隐藏容器和高频重建。
- 清屏、重建点阵和 pointer 状态要在尺寸变化后保持一致。
- 大量点或逐帧分配会影响性能；没有预算时只记录测量结果，不自定阈值。

## GSAP

- 时间线状态和 Vue 响应式状态要有单一完成边界，例如在 `onComplete`/`onReverseComplete` 结束 transition guard。
- 切换动画期间避免读取尚未稳定的 DOM 几何。
- 重建 tween 前 kill 旧实例；组件卸载时 kill timeline/tween。
- CSS 变量若被 GSAP 写成内联值，暂停或切换模式时要明确是否需要复位。

## 多视口几何验证

布局或可视化改动至少验证：

- 窄视口：约 390 CSS px。
- 常见桌面：约 1024 或 1280 CSS px。
- 较宽视口：大于常见桌面宽度的一个代表值。

在每个视口：

- 用 `getBoundingClientRect()` 核对边界、锚点和覆盖关系。
- 检查 Header、路由内容、MusicBar、进度条的 z-index 和遮挡。
- 检查 canvas/WebGL drawing buffer 与 CSS 尺寸。
- 执行一次样式切换、一次 resize 和一次卸载/重进路由。
- 检查控制台 error/warn，以及 RAF/renderer/canvas 是否重复累积。

历史任务曾在 390、1024、1280 宽度验证 MusicBar 矩形进度条，但这只是历史证据；后续相关改动仍需重新验证。

## 媒体输入与 ABI 3

图片、轮播和视频由宿主管理素材、解码、纹理与释放，算法只收元数据并返回声明内的 media uniform。资源包／工程／实时样式仍自包含；歌曲与实时分别采用时间轴解码和原生静音视频，保持单渲染器。接口、模式和失败行为见[媒体输入](../../../docs/context/visualizer-media.md)，不得把素材读取移入算法 Worker。
