# Visualizer 验证

核查日期：2026-10-19。当前事实以[页面接口](../../architecture/visualizer/interface-contracts.md)、[Project V5](../../architecture/visualizer/project-format-v5.md)、[资源包](../../architecture/visualizer/resource-packages-v2.md)和[离线导出](../../context/visualizer-offline-export.md)为准。

## 领域覆盖

| 范围        | 验证要求                                                                                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工程/草稿   | V5 strict schema、歌曲 identity、候选完整初始化后原子导入、同歌/异歌/损坏草稿、quota/取消与离页保护；旧 V1–V4 文件拒绝、旧草稿不提示恢复                                                                |
| 资源        | 外部目录选择/取消、只读权限恢复/拒绝、句柄保存失败、刷新/切换/stale、路径/损坏/哈希/依赖/ABI/预设仅引用限制、模块与 Shader 失败、URL 释放及工程快照独立恢复；无 ZIP 或任意 URL 加载入口                 |
| 算法隔离    | 未注册算法/新参数经完整工程路径绘制；opaque iframe + Worker + CSP 限制 DOM/网络/存储/嵌套 Worker；取消/超时终止，DrawPacket 拒绝非法程序、uniform 和 mesh；主页面仅执行通用 GPU 渲染                    |
| 分组/控件   | 叶元素恰好归属一次、连续 layer、整组移动/隐藏、子项排序/删除、effect 引用清理；共同处理参数完整校验后批量应用，差异提示与重新应用                                                                       |
| Binding     | constant/analysis/native、projection/component/单位/transform、缺失/未就绪/错误隔离；全工程四种 Analyzer 特征硬上限，不自动清空其他元素                                                                 |
| Editor 标记 | ABI 1/2 声明权限、外部包无工程引用、单点/范围与分类集合、半开窗口/256 项分页/空集合、过期游标/实例隔离；V5 往返、快照原子刷新及禁用元素移除保护；fade 插值/终值和重叠接管                               |
| 确定性      | 相同 seed/绝对时间/配置的 seek、刷新、暂停单帧和导出一致；固定步长/checkpoint 在包内执行，历史由宿主按合同准备，golden hash 采用既定1e-6量化，纯状态比较不依赖 RAF delta；迁移对照旧算法几何缓冲 golden |
| 预览        | 视觉响应≤50ms、设置反馈≤100ms；约15分钟四重特征压力单帧<60ms，无可归因任务>50ms；旧 canonical 测量只绑定其候选                                                                                          |
| 资源/故障   | 单 renderer/Canvas/视觉 RAF，20 次 route/元素/歌曲/导出生命周期不单调累积；context loss、stale/cancel、renderer 与数据错误保持可恢复                                                                    |
| 页面        | 支持≥1024px 工作区内单100dvh，左右独立滚动且阻止 chaining、共享 app-scrollbar；按可用宽度抽屉，16:9、DPR、焦点/键盘/reduced motion                                                                      |
| 全屏        | Fullscreen API 状态同步、同 Canvas、letterbox、播放静止2000ms隐藏、底部96px唤醒、暂停常驻、Escape/拒绝/重复点击与卸载；以当前组合工作区为准                                                             |

## 离线媒体门槛

- 720p/1080p ×30/60fps 四档分别查实际编码能力，VP9 优先/VP8 次选，Opus 音轨；不可用明确反馈，不静默降低用户选择。
- 帧数 `ceil(D×fps)`，第 i 帧 `i/fps`，末帧截到 D；无丢帧、重复/错位时间戳。以解码 PCM/帧编号为基准，页面静音不影响导出音轨。
- 实际文件验证 codec、尺寸、双轨、解码/回放、源时长差≤250ms，源事件/音画同步及结尾误差≤100ms；跨多个输入窗口检查累计漂移。相对 A/V 接近不能掩盖共同延迟。
- 当前离线精确帧/PTS 门槛取代实时 capture pacing。旧实时 V5 两帧/V6 四帧 packet gap、平均 fps±5% 及 DEC-080 原始失败值仅作[历史输出测量](../../context/visualizer-output.md)，不作为当前编码链的替代通过条件。
- 独占 transport/renderer，逐帧 await 隔离算法和输入准备后绘制/截图；preflight、算法/encoder/存储失败、取消/换歌/离页、OPFS 清理、保存取消/重试和未处理输出保护；文件完成前不发布 ready。
- 采用 tests/visualizer、当前 e2e 与媒体检查工具；输入事件、预期音频和视频时间独立计算，不用待测输出生成 oracle。

## 新内容与正式评审

新增元素/预设按[内容生成 skill](../../../skills/visualizer-content-generator/SKILL.md)先校验 brief、再批准具体合同，包含纯复用预设；未获具体批准不生成。按实际算法/组合风险选映射、golden、资源、浏览器和短导出，不为每个内容建立里程碑或 readiness。

OS 原生保存/取消/覆盖、最终构图、辅助技术和长时操作需要适用人工记录。历史 V1–V6 canonical、媒体 hash 与批准保存在 [evidence](evidence-index.md)，未关闭的视觉/全屏及上线边界见 [readiness](release-readiness.md)。正式评审另行绑定当前 clean candidate，历史通过不自动继承。

## 2026-10-19 算法资源包迁移反馈

既有 13 个算法、两套预设迁至 V2 包与 V5 工程。116 项领域单元/集成及 54 项工具检查通过；补充最后元素删除的运行时释放后，相关 20 项复测通过，领域用例共 117 项。迁移缓冲 golden 对照旧实现，包含六种几何算法及弦线反向 seek。类型、资源产物一致性、显式文件格式、文档与仓库检查通过。

Chrome/Edge 常规专项各 40 项通过、5 项按配置跳过，覆盖未注册算法与新参数的完整工程导入/GPU 像素、模块/Shader 错误保留原工程、opaque 隔离权限、死循环取消与 10 秒超时、分组、草稿独立恢复及原生历史离线导出。六份 720p30 VP9/48kHz 双声道 Opus 完整解码通过：两预设各浏览器各 90 帧，原生弦线各 360 帧，逐帧 PTS 与源时长检查通过；预设截图已查看。原始媒体及检查记录保留在忽略目录 `artifacts/visualizer-composition/`。

生产构建及基于 preview 的 Chrome/Edge 六项回归通过，覆盖 catalog 初始化、分组恢复、商城不可用时的算法快照恢复及短导出；首次构建的 Windows 系统临时文件清理权限错误通过本次进程使用项目内临时目录解决，既有 Browserslist/大 chunk 提示保留。本轮不重跑完整四档矩阵、十五分钟或可选用户音乐评审，不将旧测量继承为本次性能/同步或正式 readiness 通过。
