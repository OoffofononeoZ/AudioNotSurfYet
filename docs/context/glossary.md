# 当前项目术语

核查日期：2026-10-19。术语对应当前源码，不用历史里程碑名称替代实际接口；入口见[system map](system-map.md)。

| 术语 | 当前含义/边界 | 依据 |
| --- | --- | --- |
| AudioEngine / AudioSessionService | 唯一播放上下文/时钟与命令编排，runtime资源不进Pinia | [共享契约](../architecture/shared-runtime-contracts.md) |
| TrackId / content hash | session定位ID / 内容身份；工程按hash匹配，不混用 | [共享契约](../architecture/shared-runtime-contracts.md) |
| PlaybackSnapshot | engine时钟、播放状态、试听来源/buffering等可序列化事实 | [audio.ts](../../src/types/audio.ts) |
| route playback lease | 当前token有效，Editor/Visualizer临时repeat-one，释放恢复用户偏好 | [应用外壳](app-shell.md) |
| analysis consumer lease | Analyzer/Editor/Visualizer互斥复用同Coordinator/Worker | [共享契约](../architecture/shared-runtime-contracts.md) |
| activeFeatureQueue / activeCards | 当前最多四项FIFO / V1持久化slot carrier；无现行featureOrder字段 | [Analyzer接口](../architecture/analyzer/interface-contracts.md) |
| FeatureRegistry / FEATURE_IDS | 当前特征shape/单位/renderer/提取来源，包含Wallpaper频谱 | [分析类型](../../src/analysis/types.ts) |
| AnalysisSeries / exact cursor | ≤30Hz展示payload / 原始frame精确值，后者不用量化显示值 | [Analyzer验证](../quality/validation.md) |
| generation / revision | 任务和来源的过期防护，取消后仍检查完整身份 | [共享契约](../architecture/shared-runtime-contracts.md) |
| EditorProjectV1 | JSON V1、规范秒数、tempo、point/range及独立单草稿 | [工程契约](../architecture/editor/project-format-v1.md) |
| MarkerTimeView | marker/overlay只读独立视图，1–10秒、播放线15%，不改工程viewport | [标记页](editor-marking.md) |
| tempo / single-beat | BPM/meter派生网格 / 无内部拍网格的单个候选区间；事件秒数不随tempo移动 | [交互契约](../architecture/editor/interaction-contracts.md) |
| point / range | 同lane/class/time唯一点 / 半开[start,end)范围，同分类不重叠、相邻允许 | [Project V1](../architecture/editor/project-format-v1.md) |
| 数字实时录入 | 前十分类行1–9/0，在playing下按当前细分吸附，范围按取消/停止规则提交 | [Editor交互](../architecture/editor/interaction-contracts.md#数字键实时录入dec-085) |
| FT / other | 四专用模型分别取drums/bass/other/vocals对应row；other不称lead | [模型表](../architecture/processing/model-artifacts.md) |
| 分轨试听 / 自动标记 | 原曲/FT/辅助PCM共用transport；候选人工修正后显式V1应用，不等于P3逐拍 | [自动标记](../architecture/processing/editor-auto-marking.md) |
| proposal / tempo-derived map | 尚未完成的只读处理提案 / 人工确认小节后派生beat/downbeat，非模型识别 | [未来目标](../architecture/processing/worker-and-project-contracts.md) |
| VisualizerProjectV5 | 原子元素、顶层items、分组预设及内嵌算法/Shader/定义快照；只接受V5 | [Project V5](../architecture/visualizer/project-format-v5.md) |
| algorithm / 可执行资源包V2 | 在隔离Worker执行的算法与参数契约 / 同时包含算法、Shader和组合定义的数据包 | [资源契约](../architecture/visualizer/resource-packages-v2.md) |
| preset / 共同处理参数 | 持久化预设组 / 通过声明控件批量写子元素并提示差异，无参数继承 | [预设](visualizer-presets.md) |
| binding / native | constant/Analyzer/native/适用Editor引用及变换；native不占四Analyzer额度 | [页面接口](../architecture/visualizer/interface-contracts.md)、[原生输入](visualizer-native-input.md) |
| RendererHost / 手动导出租约 | 唯一Canvas/renderer/预览RAF所有者 / 以绝对帧编号独占绘制并恢复预览 | [离线导出](visualizer-offline-export.md) |
| OPFS WebM File | 当前编码完成后的输出文件，保存取消/失败保留重试；不是旧ready Blob链路 | [离线导出](visualizer-offline-export.md) |
| provisional / canonical / readiness | dirty反馈 / 绑定clean候选与环境的正式证据 / 独立整体评审，不自动继承历史通过 | [测试策略](../../skills/audiosurf-testing-strategy/SKILL.md) |

历史M/E/V编号仅标识原里程碑/候选，不是当前工程schema。旧Visualizer V1/V2/V3迁移、单SceneRegistry与实时MediaRecorder不再是当前术语或开发入口。
