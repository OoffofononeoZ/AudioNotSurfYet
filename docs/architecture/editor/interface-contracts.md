# Editor 页面接口契约

核查日期：2026-10-19。公共 engine、分析消费者和即时快照见[共享运行时](../shared-runtime-contracts.md)。

## 路由与运行时

- `/editor/:trackId?` 按 session trackId 定位歌曲，工程匹配用内容 hash，不混用两种身份。进入不隐式改变播放；有效 route 持有 repeat-one lease。
- 状态定义见 [types.ts](../../../src/editor/types.ts)，不可用歌曲重试与切换遵守[交互契约](interaction-contracts.md)。
- 顶栏、MusicBar、三个页签、草稿与换歌/离页保护见[工作区](../../context/editor-workspace.md)。取消保持原歌曲与草稿；确认绑定当前歌曲/工程修订并消费一次。

## 工程、时间与编辑

- EditorProjectV2 是当前唯一写入格式；完整验证歌曲 identity、秒数、tempo、point/range union 和引用后原子替换。失败保留内存与 durable draft。
- JSON、canonical seconds、严格 validator 与独立 draft DB 见 [Project V2](project-format-v2.md)，实现为 [projectCodec.ts](../../../src/editor/projectCodec.ts)和 [editorDraftRepository.ts](../../../src/editor/editorDraftRepository.ts)。
- tempo/grid、single-beat、吸附、point/range、连续时间批量、overlay 与数字实时录入统一按[交互契约](interaction-contracts.md)；页面行为见[标记工作区](../../context/editor-marking.md)。
- waveform/tempo 使用工程 viewport；marker/overlay 使用独立只读 MarkerTimeView。播放读取 engine 快照，不逐帧改工程或保存草稿；zoom、BPM 和几何不重写事件秒数。
- seconds保存事件事实，tempo只派生网格，避免用户改BPM时移动标记。独立单草稿隔离公共会话DB；共享纯Canvas adapter保持提取/解码单一来源，overlay失败不破坏人工编辑。
- 图表精度按可见窗口与显示像素调整，顶部波形及 overlay 各自通过 controller／分析 lease 请求可取消的运行时窗口数据；连续缩放停止 150ms 后补算，播放也预取，不改变工程或持久化分析格式。精度边界与缓存所有权见[标记工作区](../../context/editor-marking.md#图表细节与时间对齐dec-094)。
- `1–9、0` 按分类行编号，playing 且歌曲匹配时录入，端点按当前细分吸附。seek、切源、失焦等取消未提交范围；暂停/曲终按既定规则收尾。

## 分离与自动标记

osu 单向谱面转换、物件映射和定时范围见 [osu 导入](osu-import.md)；源文件与音频留在运行时，候选复用 V2 validator。

- FT 与有限乐器自动标记在 Editor 内共用一个处理槽位；原曲/四轨共用 transport，保留人工标记和显式 V2 原子应用。
- 模型、PCM、缓存、结果身份和清理见 [FT 接入](../processing/editor-separation.md)、[自动标记](../processing/editor-auto-marking.md)、[模型身份](../processing/model-artifacts.md)。候选经显式确认应用，不自动覆盖人工工程。
- 当前 FT 听感/长曲耗时按 DEC-074 接受；新增识别质量仍待 owner 复核，完整 P1/P2 正式证据及后续路线不因此关闭。

## 验证边界

按[测试 skill](../../../skills/audiosurf-testing-strategy/SKILL.md)选择领域专项。[evidence](../../quality/editor/evidence-index.md)保留 E1–E9 历史身份与 readiness 失败尝试；[readiness](../../quality/editor/release-readiness.md)保留 pre-E10/owner-review 边界。已实现和专项通过不代表整体就绪或发布批准。
