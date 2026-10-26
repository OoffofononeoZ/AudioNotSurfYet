# 3D 场景、镜头与深度

DEC-104：资源声明场景、工程保存实例、宿主统一执行。Project V6 与 RealtimeStyle V2 保存镜头和场景归属；资源包保持 V2。旧 ABI 1–3 的屏幕空间行为不变，新世界空间资源使用 ABI 4。

## 场景与保存

`Scene3dItem` 是组合中的独立渲染单元，包含 UUID、名称、显隐、连续 children、起止秒数和 camera。可位于顶层或预设的 scenes3d 内；预设 children 保留所有叶元素的连续顺序。场景不嵌套，每个世界元素恰属一个场景，二维元素不得加入。预设共同控件继续批量修改叶元素绑定。

世界元素定义必须包含 scene3dDefaults.camera，独立添加时复制到场景实例。预设使用 scenes3d 声明 camera、相对时段和成员 key，只引用已完成的元素。实例 transform3d 保存 position、rotationDegrees、scale；采用右手坐标、Y 向上，几何保留本地三维坐标，模型变换由宿主执行。

工程/草稿 V5 在输入边界显式转换为 V6，实时样式 V1 转换为 V2。原文件不写回，资源快照、绑定及二维图层不替换；草稿正常保存成功后写新版本，失败保留原文。V1–V4 工程的原有不迁移边界不扩张。

## 镜头与时间

透视 camera 保存 position、target、up、fov、near、far。轨迹 animation 保存 durationSeconds、loop 和至少两个 keyframes；关键帧包含 timeSeconds、position、target、fov，严格递增并包含零时刻及末时刻。位置、目标及 FOV 线性插值，up 和裁剪范围固定。FOV 位于 (0,180)，near>0、far>near，视线与 up 不得退化。

歌曲镜头使用绝对歌曲时间减场景起点；实时镜头从会话零时刻推进。轨迹保持独立秒数，不按歌曲长度缩放；循环取模，不循环则末帧停留。每帧只解析一次场景镜头，成员读取相同的只读 CameraFrame（含视图和投影矩阵）；Worker 内冻结镜头数据，不能通过修改共享输入影响其他元素。轨迹中途出现退化方向也明确失败，不回退固定镜头。

## ABI 4 绘制

场景行可展开选择成员，属性区提供名称、起止时间、镜头位置/目标/up、裁剪范围与关键帧表。轨迹首末时间由时长固定，中间关键帧可添加或删除；改时长同比调整关键帧时间。成员属性提供模型变换及“所属三维场景”，只允许在同一预设或顶层内移入其他场景，也可新建独立场景；空场景删除。选中场景后添加世界元素直接加入该场景，原预设共同控件、二维列表和导出锁保持。

算法继承 ABI 3 的输入、媒体、标记及 executionModes 能力，contract 必须为 visual 且 renderSpace:'world'。DrawPacket 使用 triangles，不提前投影或清零 z；单 mesh 保持 65,536 顶点容量和有限 Float32 缓冲限制。顶点 Shader 使用宿主的 projectionMatrix/modelViewMatrix。

世界 fragment 定义 `vec4 shade()` 返回直通 RGBA，不定义 main。程序必须声明 alphaMode:'opaque' 或 'mask'；mask 可声明 [0,1] 的 alphaCutoff，默认 0.5。宿主生成 main：裁剪模式先 discard 低 alpha 像素，存活像素输出 alpha=1；不透明模式不以 alpha 丢弃。材质开启深度测试及写入。首轮不支持半透明混合、阴影、PBR、模型加载或新的几何属性。

场景开始清颜色和深度，所有成员/pass 向同一目标追加，内部不清深度。完成后场景作为一层参与二维合成，不同场景之间清空并隔离深度。二维效果可引用 scenes3d 目标或整体；不得对单个世界成员先做二维后处理。

GPU 仍由单 renderer/Canvas/视觉 RAF 管理；预览、离线视频、实时展示和壁纸复用同一合成器。resize、context 恢复、失败及离页按所有权重建或释放深度目标和材质。

相关类型和校验见 [场景类型](../../../src/visualizer/scene3dTypes.ts)、[场景 codec](../../../src/visualizer/scene3dCodec.ts)、[组合器](../../../src/visualizer/compositionScene.ts)。
