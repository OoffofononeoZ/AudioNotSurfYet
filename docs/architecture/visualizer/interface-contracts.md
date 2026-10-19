# Visualizer 页面接口契约

核查日期：2026-10-19。最新方案为 Project V4、JSON 资源包 V1 过渡版与离线确定性导出。

## 路由与所有权

- `/visualizer/:trackId?` 复用共享歌曲与 repeat-one lease；普通页保留 MusicBar，全屏复用同一画面。离页恢复用户偏好，取消换歌保持工程和未处理输出。
- [VisualizerSessionController](../../../src/visualizer/visualizerSessionController.ts)管理歌曲、单草稿、分析消费者、binding 与导出快照；运行时对象留在 store 外。公共边界见[共享契约](../shared-runtime-contracts.md)。
- 单 RendererHost、Canvas、WebGLRenderer 与视觉 RAF；效果复用 render targets，不为元素/预设另建 renderer。布局、抽屉、选择和全屏见[组合工作区](../../context/visualizer-composition.md)。

## 工程与资源

- 数据定义见 [compositionTypes.ts](../../../src/visualizer/compositionTypes.ts)、[resourceTypes.ts](../../../src/visualizer/resourceTypes.ts)和 strict codec；完整契约见 [Project V4](project-format-v4.md)。
- 只接受 V4。elements 保存一次完整记录，items/children 决定归属与连续图层；预设保留组身份和共同处理控件，批量修改完整校验后原子提交。
- 工程内嵌资源定义及精确 hash，恢复不依赖全局库。请求、磁盘导入、本地库和 ABI 见[资源包 V1](resource-packages-v1.md)；JSON 不加载任意 JS、DSL 或外部 Shader。
- V1–V3 工程不迁移，旧草稿视为没有可恢复草稿。无效 V4 草稿保留显式处理入口，同歌/异歌草稿和保存失败继续保护数据。
- 新增原子元素或组合预设，包括纯复用预设，都先校验 VisualizerContentBriefV1 并批准具体合同，见[内容生成](content-generation.md)。

## Binding 与确定性

- constant、Analyzer、native 与适用 Editor 引用按 [types.ts](../../../src/visualizer/types.ts)、[原生输入](../../context/visualizer-native-input.md)和 [kernelContracts.ts](../../../src/visualizer/kernelContracts.ts)声明单位、映射、平滑与准备要求。
- 全工程最多四种不同 Analyzer 特征，native 不占额度。缺失引用/未准备数据显式反馈，不自动改绑、降档或禁用其他内容绕过校验。
- 绝对歌曲时间、seed 和 kernel 决定结果；seek、循环、离线导出同源求值。Editor snapshot 同歌校验，显式替换且完整验证。

## 导出与验证

唯一当前输出见[离线导出](../../context/visualizer-offline-export.md)：解码 PCM、indexed frame times、同 renderer 手动租约、WebCodecs/Mediabunny 与 OPFS WebM File。

- export transport 锁定歌曲/播放/seek，取消或失败释放编码器、帧、文件和租约。四档能力按实际编码配置查询，保留帧数、PTS、同步和时长阈值。
- 类型见 [exportTypes.ts](../../../src/visualizer/exportTypes.ts)；MediaRecorder/tap/ready Blob 已退出现行接口。
- [历史 evidence](../../quality/visualizer/evidence-index.md)和 [readiness](../../quality/visualizer/release-readiness.md)只证明原候选，不证明 V4 与离线输出整体就绪。
