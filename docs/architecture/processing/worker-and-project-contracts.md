# 处理运行时与后续提案契约

核查日期：2026-10-19。当前实现与未完成目标在本页分开。旧独立Processor、V1→V2迁移、SceneRegistry和实时录制接口已经删除；当前Editor V1、Visualizer V4及离线导出不因本页整理改变。

## 当前运行时事实

- FT的source/model/runtime/job/PCM/stem/cache/error具体类型以[src/processing](../../../src/processing)及运行时validator为准；模型revision、size、SHA/许可只维护在[模型表](model-artifacts.md)，部署资产和预处理只维护在[FT配置](ft-kernel-config.md)。
- source包含原PCM完整hash、track及sampleRate/frame/channel/duration；decoded revision防止当前读取越界/换源。刷新恢复用保存descriptor header重验完整hash，不能以旧revision读取新PCM。
- 分块原PCM读取不detach engine buffer；四模型顺序执行，input `[1,2,343980]`、output `[1,4,2,343980]`、对应role row，44.1kHz、overlap/stride/OLA与尾帧规则按FT配置。
- runtime identity涵盖实际ORT/JS/WASM/assets/backend、四模型、preprocessing/algorithm/config版本；IDB metadata与OPFS artifact验证齐全才发布。10GiB配置同时受origin quota约束，显式清理，无自动驱逐。
- energy采用u16-dbfs-linear-v1、30Hz，length=ceil(30×duration)、little-endian payload恰为length×2 bytes；同一stem的多声道平方均值RMS→dBFS→[-80,0] clip→[0,1]→UInt16，静音为0。WAV不隐式增益/裁剪。
- 一个处理任务槽位拥有FT或自动标记，最多一个专用计算Worker。analysis复用既有Worker/consumer lease，播放仍唯一AudioEngine/AudioContext；关闭ORT proxy，错误不自动整图CPU重跑。
- 每个start恰好一个result/error/cancel终态，cancel幂等；job/source/generation同时匹配。迟到结果不发布UI/cache/工程，必要时terminate专用Worker，temp五秒内清理或登记residual IDs。
- progress区分模型下载bytes、处理phase/units和elapsed；总量未知为null，running每秒heartbeat不伪造百分比。metadata发布还需当前controller身份确认，取消保留旧完整结果。
- typed errors提供可行动的GPU/model/PCM/storage/取消原因；details不含PCM、歌词、私有路径或stack。失败保留原曲及人工路径。界面与恢复行为见[Editor FT](editor-separation.md)和[自动标记](editor-auto-marking.md)。

## 尚未实现：逐拍与局部tempo

这是DEC-063–067批准目标，不是当前接口存在或验证通过的声明。

- 扩展现有TS flux/onset/自相关加DP tracking，mix主输入、drums仅提供±70ms agreement；未使用drums时agreement=null，空鼓轨不删除mix beat。
- beat含绝对seconds、算法score及适用drumsAgreement；时间升序、`[0,duration)`且1ms内去重。score有限[0,1]，明确是algorithm-score，不称模型概率。
- tempo candidate包含candidateId、start/endSeconds、bpm、score/scoreKind和first/lastBeatIndex；区间严格正长度、indices有效，BPM在Editor支持范围。无自动meter/downbeat字段。
- beat result包含resultId、source、bpm或null、score/scoreKind、beats、tempoCandidates、warnings。只有separation时beatAnalysis为空，无可靠beat不伪造BPM。
- warnings保留leading/trailing-uncertain、beat-gap、drums-empty、half-double-tempo、tempo-unstable、low-confidence、meter-confirmation-required及相应区间。首尾静音不外推，变化歌曲呈现局部候选而非强制拉平。
- manifest保存schemaVersion、resultId、source/runtime、separation/beatAnalysis和createdAt。算法评分、配置、版本及许可来源参与provenance/cache identity。

## 尚未实现：只读提案与原子应用

- proposal含proposalId、只读result、compact processing数据及targetEditorProjectHash/targetVisualizerProjectHash，null仅表示当时没有目标。
- tempo confirmation含candidateId、segmentId、measureStartSeconds、bpm、meter numerator/denominator；小节起点对应segment.startSeconds，构造合法0秒起点Editor map。未确认区域可single-beat，不默认4/4。
- apply命令带proposalId、expectedEditor/VisualizerProjectHash、所选字段及confirmedTempoMap/tempoConfirmations。分别选择tempo、processing snapshot及默认横/竖映射，呈现canonical hash与diff。
- 当前source/job/generation和任一所选目标hash冲突都拒绝，原为null但后来创建同样冲突；重新审阅，不自动重试覆盖。
- 全部准备/校验后原子替换所选内容，失败零部分应用；estimated/user来源准确，未选字段、人工marker及binding保留。保存失败显示dirty并允许导出，原工程可恢复。
- rerun只生成新proposal，不刷新已应用snapshot。缺energy/beat时相关默认映射不可选，其他选择仍可用；默认other energy/beat仅在用户明确确认后写入，颜色/尺寸等不连带覆盖。

## 尚未实现：工程携带处理数据与tempo刷新

有效目标是compact数据自包含，不恢复旧V2 schema或旧模板字段。当前V4 codec没有此processing扩展；未来具体工程字段需遵守最新格式和重大变更审批规则。

- 保存proposal/source/runtime身份、四角色30Hz UInt16 energy或null、detected beats、warnings；不嵌stem音频、权重、绝对路径或OPFS handle。payload length/finite/范围和同歌曲身份严格校验。
- tempo-derived map记录editorProjectHash、tempoMapHash、derivationVersion、beats/downbeats及`editor-tempo-derived`来源；downbeat只由人工确认的小节/meter派生，不冒充模型检测。
- stem-energy/beat/downbeat按绝对歌曲秒数求值，缺失或identity失配为typed unavailable，不填有效0。stem/constant/analysis等未受影响输入继续可用。
- stem-energy取30Hz sample；beat/downbeat在[eventTime,eventTime+pulseSeconds)为1，pulseSeconds有限正值并存binding。beat默认detectedBeats，确认并显式刷新后用tempo-derived beats；downbeat只用确认map，single-beat段不派生小节首拍。
- tempo修改使相关map/snapshot stale；显式diff后一并刷新Editor snapshot和tempo map，保留detected beats证据、energy和未选binding。无确认map的downbeat不可用，不回退旧检测结果。
- 仍绑定stale来源时当前离线导出preflight拒绝，刷新或显式解除后才继续；不增加播放AudioContext、polling、Worker或renderer。

## 验证与授权

未来逐拍/提案沿用start/progress/cancel/result/error与身份隔离原则；错误包括beat-analysis-failed、project-conflict、tempo-confirmation-required、tempo-snapshot-stale等，必须由实际代码和validator落实后才能声明存在。

有效F1/BPM/窗口、数值/时间、媒体、资源与性能门槛见[处理链验证](../../quality/processing/validation.md)，剩余顺序与授权见[路线](../../delivery/processing/roadmap.md)。DEC-074只接受当前FT功能；尚未完成目标、R-046–R-055和整体readiness不因文档精简改变状态。
