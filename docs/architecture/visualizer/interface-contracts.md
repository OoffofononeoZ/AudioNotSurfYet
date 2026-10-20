# Visualizer 页面接口契约

核查日期：2026-10-20。当前为 Project V5、可执行资源包 V2、隔离算法运行和离线确定性导出。

## 路由与所有权

- `/visualizer/:trackId?` 复用共享歌曲与 repeat-one lease；普通页保留 MusicBar，全屏复用同一画面。离页恢复用户偏好，取消换歌保持工程和未处理输出。
- [VisualizerSessionController](../../../src/visualizer/visualizerSessionController.ts)管理歌曲、单草稿、分析消费者、binding 与导出快照；运行时对象留在 store 外。公共边界见[共享契约](../shared-runtime-contracts.md)。
- 单 RendererHost、Canvas、WebGLRenderer 与视觉 RAF；效果复用 render targets，不为元素/预设另建 renderer。布局、抽屉、选择和全屏见[组合工作区](../../context/visualizer-composition.md)。

## 工程与资源

- 数据定义见 [compositionTypes.ts](../../../src/visualizer/compositionTypes.ts)、[resourceTypes.ts](../../../src/visualizer/resourceTypes.ts)和 strict codec；完整契约见 [Project V5](project-format-v5.md)。
- 只接受 V5。elements 保存一次完整记录，items/children 决定归属与连续图层；预设保留组身份和共同处理控件，批量修改完整校验后原子提交。
- 工程内嵌算法源码、Shader、定义及精确 hash，恢复不依赖全局库。外部文件夹、隔离权限和 ABI 见[资源包 V2](resource-packages-v2.md)；纯 codec 不执行代码。候选先初始化、验证后提交；导入期间编辑锁与 aria-busy 保持到完成。
- V1–V4 工程不迁移，旧草稿视为没有可恢复草稿。无效 V5 草稿保留显式处理入口，同歌/异歌草稿和保存失败继续保护数据。
- 新增原子元素或组合预设，包括纯复用预设，都先校验 VisualizerContentBriefV2 并批准具体合同，见[内容生成](content-generation.md)。

## Binding 与确定性

- constant、Analyzer、native 与适用 Editor 引用按 [types.ts](../../../src/visualizer/types.ts)、[原生输入](../../context/visualizer-native-input.md)和[算法契约](../../../src/visualizer/algorithmTypes.ts)声明单位、映射、平滑与历史准备要求，不按算法名称分派。
- ABI 2 的点/范围输入由工程绑定轨道/分类/事件，通过 prepareFrame 内 input.markers 查询；外部包和初始化不读取实际标记。具体字段及分页见[标记契约](../../../skills/visualizer-content-generator/references/editor-marker-inputs.md)。
- 全工程最多四种不同 Analyzer 特征，native 和标记不占额度。缺失引用/未准备数据显式反馈，不自动改绑、降档或禁用其他内容绕过校验。
- 绝对歌曲时间、seed 和算法快照决定结果；seek、循环、离线导出同源求值。预览合并在途请求，失效结果不绘制；导出逐帧等待算法与 GPU。诊断 hash 使用与视口无关的参数及状态；画面正确性仍以数值基线和 GPU 像素验证。Editor snapshot 同歌校验，显式替换且完整验证。

## 导出与验证

视频输出见[离线导出](../../context/visualizer-offline-export.md)：解码 PCM、indexed frame times、同 renderer 手动租约、WebCodecs/Mediabunny 与 OPFS WebM File。独立实时样式和本站展示地址按[实时样式](../../context/visualizer-realtime.md)使用独立快照与会话时间，预设库显示由合同/绑定/时段计算的用途分类。

- export transport 锁定歌曲/播放/seek，取消或失败释放编码器、帧、文件和租约。四档能力按实际编码配置查询，保留帧数、PTS、同步和时长阈值。
- 类型见 [exportTypes.ts](../../../src/visualizer/exportTypes.ts)；MediaRecorder/tap/ready Blob 已退出现行接口。
- [历史 evidence](../../quality/visualizer/evidence-index.md)和 [readiness](../../quality/visualizer/release-readiness.md)只证明原候选，不证明 V5、可执行资源包与离线输出整体就绪。
