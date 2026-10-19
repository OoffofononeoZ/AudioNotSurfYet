# Visualizer 验证

核查日期：2026-10-19。当前事实以[页面接口](../../architecture/visualizer/interface-contracts.md)、[Project V4](../../architecture/visualizer/project-format-v4.md)、[资源包](../../architecture/visualizer/resource-packages-v1.md)和[离线导出](../../context/visualizer-offline-export.md)为准。

## 领域覆盖

| 范围 | 验证要求 |
| --- | --- |
| 工程/草稿 | V4 strict schema、歌曲 identity、原子导入、同歌/异歌/损坏草稿、quota/取消与离页保护；旧 V1–V3 文件拒绝、旧草稿不提示恢复 |
| 资源 | catalog 安全路径、HTTP/损坏/哈希/ABI/重复定义、磁盘导入与本地库、工程快照独立恢复；资源不能扩大内核权限或加载任意代码 |
| 分组/控件 | 叶元素恰好归属一次、连续 layer、整组移动/隐藏、子项排序/删除、effect 引用清理；共同处理参数完整校验后批量应用，差异提示与重新应用 |
| Binding | constant/analysis/native/Editor 引用、projection/component/单位/transform、同歌 ID、缺失/未就绪/错误隔离；全工程四种 Analyzer 特征硬上限，不自动清空其他元素 |
| 确定性 | 相同 seed/绝对时间/配置的 seek、刷新、暂停单帧和导出一致；固定步长/checkpoint 与弦线历史按内核执行，golden hash 采用既定1e-6量化，纯状态比较不依赖 RAF delta |
| 预览 | 视觉响应≤50ms、设置反馈≤100ms；约15分钟四重特征压力单帧<60ms，无可归因任务>50ms；旧 canonical 测量只绑定其候选 |
| 资源/故障 | 单 renderer/Canvas/视觉 RAF，20 次 route/元素/歌曲/导出生命周期不单调累积；context loss、stale/cancel、renderer 与数据错误保持可恢复 |
| 页面 | 支持≥1024px 工作区内单100dvh，左右独立滚动且阻止 chaining、共享 app-scrollbar；按可用宽度抽屉，16:9、DPR、焦点/键盘/reduced motion |
| 全屏 | Fullscreen API 状态同步、同 Canvas、letterbox、播放静止2000ms隐藏、底部96px唤醒、暂停常驻、Escape/拒绝/重复点击与卸载；以当前组合工作区为准 |

## 离线媒体门槛

- 720p/1080p ×30/60fps 四档分别查实际编码能力，VP9 优先/VP8 次选，Opus 音轨；不可用明确反馈，不静默降低用户选择。
- 帧数 `ceil(D×fps)`，第 i 帧 `i/fps`，末帧截到 D；无丢帧、重复/错位时间戳。以解码 PCM/帧编号为基准，页面静音不影响导出音轨。
- 实际文件验证 codec、尺寸、双轨、解码/回放、源时长差≤250ms，源事件/音画同步及结尾误差≤100ms；跨多个输入窗口检查累计漂移。相对 A/V 接近不能掩盖共同延迟。
- 当前离线精确帧/PTS 门槛取代实时 capture pacing。旧实时 V5 两帧/V6 四帧 packet gap、平均 fps±5% 及 DEC-080 原始失败值仅作[历史输出测量](../../context/visualizer-output.md)，不作为当前编码链的替代通过条件。
- 独占 transport/renderer，preflight、encoder/存储失败、取消/换歌/离页、OPFS 清理、保存取消/重试和未处理输出保护；文件完成前不发布 ready。
- 采用 tests/visualizer、当前 e2e 与媒体检查工具；输入事件、预期音频和视频时间独立计算，不用待测输出生成 oracle。

## 新内容与正式评审

新增元素/预设按[内容生成 skill](../../../skills/visualizer-content-generator/SKILL.md)先校验 brief、再批准具体合同，包含纯复用预设；未获具体批准不生成。按实际算法/组合风险选映射、golden、资源、浏览器和短导出，不为每个内容建立里程碑或 readiness。

OS 原生保存/取消/覆盖、最终构图、辅助技术和长时操作需要适用人工记录。历史 V1–V6 canonical、媒体 hash 与批准保存在 [evidence](evidence-index.md)，未关闭的视觉/全屏及上线边界见 [readiness](release-readiness.md)。正式评审另行绑定当前 clean candidate，历史通过不自动继承。
