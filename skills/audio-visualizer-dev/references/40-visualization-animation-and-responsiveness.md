# 可视化、动画与响应式

## 当前可视化表面

| 组件 | 技术 | 当前职责 |
| --- | --- | --- |
| `LightBg.vue` | Three.js + GLSL | 全屏光线 shader；能量通过 Home 改变 `rayLength` |
| `DotGridBg.vue` | Canvas 2D + RAF | 响应鼠标距离的点阵背景 |
| `twoDTable.vue` | Three.js | 试验性柱状数据、进度线、缩放和相机跟随 |
| `MusicBar.vue` | CSS conic-gradient + GSAP | 三种外形/灯带样式、进度和信息跑马灯 |
| `AnimatedList.vue` | GSAP | 列表进入、选择和滚动可见性动画 |

`threeDTable.vue` 仍是试验表面；`MeydaCard.vue` 已是 Analyzer 21 项 Canvas/DOM renderer 容器。E4 已抽取 `analysisCanvasRenderer` 供 Analyzer card 与 Editor overlay 共用，E5 range 操作保持 overlay pointer-through；E6 已在真实 Chrome/Edge 和 10,000 事件压力下通过并获批准。E7 已把 overlay Teleport 为全视口 fixed Canvas，并在双浏览器验证 viewport backing store、marker-column clip、纵/横滚动与 `0 CSS px` 横轴 geometry；owner 视觉签字仍待完成。

Visualizer V3 已由 DEC-039 固定为中心 Orthogonal Lines，并由 30/30 canonical 与 2026-09-03 owner 人工验收关闭：现有 16:9 Canvas 由唯一 `VisualizerRendererHost` 接管，host 独占一个 Three.js renderer 和一个可取消视觉 RAF。场景使用单全屏 quad/shader、固定 `#020403` 背景；intensity 同时控制中心向两端长度与主线 alpha，thickness 为 CSS px，brightness >1 增强 halo，horizontal/vertical 互不串扰。

V3 scene-local decay 的单位为秒，固定 60Hz 计算 `max(I, previous * exp(-4 * dt / decaySeconds))`，每秒 checkpoint 并按歌曲/template/binding revision 隔离；它不改写 V2 resolved value，也不能使用 RAF delta。播放持续绘制，暂停、seek、参数和 resize 只请求单帧；DPR 上限为 2。V4 implementation candidate 已用真实 Cube Swarm 替换中性预览，并保持同一 host/renderer/Canvas 与对称资源释放；canonical 与 owner 视觉验收尚未完成。

DEC-041 固定 V4 为 64 方块中心频谱环、seed 外围上升方块与三颗分层轨道卫星。中心频谱按 64 个连续 band 的非负最大值和固定 log reference 128 映射；rise/orbit 按 60Hz 从 0 秒积分并每秒 checkpoint。Cube 使用共享 BoxGeometry、两个 MeshStandardMaterial、三个 InstancedMesh、固定灯光和 perspective camera，不使用纹理；context loss 在同 RendererHost/WebGLRenderer 内暂停视觉 RAF、恢复 scene GPU 资源并按当前绝对时间绘制。

## RAF 与 Observer

- 每个持续动画只能有一个可取消的 RAF 句柄；开始前停止旧循环，停止/卸载时清空句柄。
- `LightBg` 使用 IntersectionObserver 控制可见性，并用 window resize 更新 renderer 尺寸与 shader uniform。
- `DotGridBg` 优先使用 ResizeObserver，回退到 window resize；两条路径卸载时都要正确解除。
- MusicBar 使用 ResizeObserver 重新计算文字跑马灯；旧 GSAP tween 必须 kill。
- 监听或 Observer 的 callback 若封装过 throttle/debounce，移除时要使用同一函数引用。

## Three.js/WebGL 生命周期

创建顺序通常为 renderer、scene、camera、geometry、material、mesh；释放时至少检查：

- 停止 RAF 和事件监听。
- 从 scene 移除对象。
- `geometry.dispose()`、`material.dispose()`。
- `renderer.dispose()`，并移除 canvas。
- 清理组件持有的引用，避免可见性切换后重复 renderer。

当前 `twoDTable.vue` 会释放柱体、线材质/几何和 renderer。`LightBg.vue` 的 cleanup 已释放 renderer 并移除 canvas，但未见对 PlaneGeometry 和 ShaderMaterial 的显式 dispose；这是需要在相关改动中复核的资源风险。

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
