---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/editor/project-format-v1.md"
next_action: "delivery 固定 config/评分与 codec golden，验证 Worker、quota、确认/apply、V2 迁移和 tempo 刷新"
---

# Browser Processing Worker and Project Contracts

以下为新自动处理链的内部 TypeScript 目标契约，供工程师与评审者使用；尚未实现。现有 Analyzer、Editor 和 Visualizer V1–V6 的历史契约不改写。处理通过浏览器 Worker、本地存储和工程 controller 完成，用户音频不通过网络协议传输。

## Source, Model and Runtime Identity

~~~ts
type ProcessingStemRole = 'drums' | 'bass' | 'other' | 'vocals'
type ProcessingComputeStage = 'separation' | 'beat-analysis'
type ProcessingStage = ProcessingComputeStage | 'proposal-application'

interface ProcessingSourceIdentityV1 {
  schemaVersion: 1
  trackHash: string
  pcmHash: string
  sampleRate: number
  channelCount: number
  frameCount: number
  durationSeconds: number
}

interface ProcessingModelArtifactV1 {
  role: ProcessingStemRole
  repository: string
  revision: string
  fileName: string
  byteLength: number
  sha256: string
  variant: 'fp16weights'
  outputRow: 0 | 1 | 2 | 3
  license: 'MIT'
}

interface ProcessingRuntimeManifestV1 {
  schemaVersion: 1
  separation: {
    model: 'htdemucs_ft'
    conversionSourceVersion: 'demucs-onnx-v0.3.0'
    models: Record<ProcessingStemRole, ProcessingModelArtifactV1>
    onnxRuntimeWebVersion: string
    runtimeAssetHash: string
    backend: 'webgpu'
    configHash: string
  } | null
  beatAnalysis: {
    algorithm: 'project-ts-flux-dp'
    algorithmVersion: string
    scoreVersion: string
    configHash: string
    primaryInput: 'mix'
    drumsEvidence: boolean
    drumsArtifactSha256?: string
  } | null
}

interface ProcessingPcmRefV1 {
  storage: 'opfs'
  artifactId: string
  codec: 'float32-planar-le-v1'
  sha256: string
}
~~~

- source 始终描述原始 browser-decoded PCM，duration = frameCount/sampleRate，误差不超过半个输入 sample。canonical pcmHash 对版本化 descriptor 和原始各 channel Float32 LE bytes 计算，分块大小/次序及 JSON 属性顺序不能改变 identity。
- PCM 只按有界 frame range 复制或临时 staging，接收方校验连续、无重叠、无缺帧、整曲 hash 一致。`start` 前准备的临时 PCM 纳入本地任务计时；不得 transfer/detach AudioEngine 持有的 buffer。
- [Model Artifacts](model-artifacts.md)定义唯一批准的四个 file/revision/hash/role/row。未知或缺失 provenance/schema、角色映射错误、NaN/Infinity PCM 或 tensor 均拒绝。
- separation 与 beat 的版本/config 身份各自完整；mix-only 不伪造 separation provenance。backend/ORT asset 与模型不同必须 cache miss；实际 GPU/browser 环境写入验证证据，不承诺跨设备模型字节确定性。

## Stems, Cache and Energy

~~~ts
interface ProcessingSeriesV1 {
  schemaVersion: 1
  codec: 'u16-dbfs-linear-v1'
  samplesPerSecond: 30
  minDb: -80
  maxDb: 0
  length: number
  dataBase64: string
}

interface ProcessingStemArtifactV1 {
  role: ProcessingStemRole
  artifactId: string
  internalFormat: 'float32-planar-le-v1'
  exportFormat: 'wav-float32'
  sha256: string
  sampleRate: 44100
  channelCount: 2
  frameCount: number
  durationSeconds: number
  energy: ProcessingSeriesV1
}

interface ProcessingSeparationResultV1 {
  resultId: string
  source: ProcessingSourceIdentityV1
  stems: Record<ProcessingStemRole, ProcessingStemArtifactV1>
}

interface ProcessingCacheCapacityV1 {
  configuredLimitBytes: number
  processingUsageBytes: number
  originUsageBytes: number
  originQuotaBytes: number
  estimatedWriteBytes: number
}
~~~

- separation 成功必须且只能含四个 role；模型每次仅保留对应 row。输出 frameCount = round(source.durationSeconds × 44100)，拼接/重采样不改变绝对秒数；不超过一个输出 sample 的尾部校正以外均返回 stem-duration-mismatch。
- energy length = ceil(30 × stem.durationSeconds)，payload 必须恰为 length × 2 个 little-endian bytes。末窗截至 frameCount；多声道平方均值 RMS → dBFS → [-80,0] clip → [0,1] → UInt16。静音为 0，不改动 stem 本身。
- waveform 从同一拼接 stem 生成。浏览器分块编码 IEEE float32 WAV，header、sample rate/channel/frame count 与 artifact 一致，不做隐式增益/裁剪；没有额外编码程序依赖。
- IndexedDB 保存已校验模型和 metadata/compact series；大型 stem 在 OPFS。cache key 覆盖完整 source、模型/ORT/assets/backend、算法/config，artifact checksum 复核损坏/缺失。
- 默认 10GB 以 `10 × 1024^3` bytes 表示，可配置；模型、完整结果与临时 staging 都计入 processingUsageBytes。允许写入量受 configured limit 剩余量和 origin quota 剩余量共同限制；估算只是预检查，实际写入的 quota/transaction failure 仍须处理。
- IDB 发布前，先关闭/校验 OPFS 临时文件并完成四轨；发布失败不留可命中 metadata。跨 IDB/OPFS 不假设单一事务：使用临时/complete 标记与初始化残留登记。取消不得删除旧完整结果或已校验模型。
- 显式列表/删除按歌曲、模型、大小、日期展示；running/leased entry 拒绝删除。无后台 LRU，origin 数据被浏览器清除后按 cache miss 显示并可重算。

## Beat Analysis and Human Confirmation

~~~ts
interface ProcessingBeatEventV1 {
  atSeconds: number
  kind: 'beat'
  score: number
  scoreKind: 'algorithm-score'
  evidence: {
    mix: true
    drumsAgreement: boolean | null
    agreementDeltaMs?: number
  }
}

interface ProcessingTempoCandidateV1 {
  candidateId: string
  startSeconds: number
  endSeconds: number
  bpm: number
  score: number
  scoreKind: 'algorithm-score'
  firstBeatIndex: number
  lastBeatIndex: number
}

type ProcessingWarningCodeV1 =
  | 'leading-uncertain' | 'trailing-uncertain' | 'beat-gap'
  | 'drums-empty' | 'half-double-tempo' | 'tempo-unstable'
  | 'low-confidence' | 'meter-confirmation-required'

interface ProcessingWarningV1 {
  code: ProcessingWarningCodeV1
  startSeconds: number
  endSeconds: number
}

interface ProcessingBeatResultV1 {
  resultId: string
  source: ProcessingSourceIdentityV1
  bpm: number | null
  score: number
  scoreKind: 'algorithm-score'
  beats: ProcessingBeatEventV1[]
  tempoCandidates: ProcessingTempoCandidateV1[]
  warnings: ProcessingWarningV1[]
}

interface ProcessingResultManifestV1 {
  schemaVersion: 1
  resultId: string
  source: ProcessingSourceIdentityV1
  runtime: ProcessingRuntimeManifestV1
  separation: ProcessingSeparationResultV1 | null
  beatAnalysis: ProcessingBeatResultV1 | null
  createdAt: string
}

interface ProcessingProposalV1 {
  schemaVersion: 1
  proposalId: string
  result: ProcessingResultManifestV1
  processingSnapshot: VisualizerProcessingSnapshotV1
  targetEditorProjectHash: string | null
  targetVisualizerProjectHash: string | null
}

interface ProcessingTempoConfirmationV1 {
  candidateId: string
  segmentId: string
  measureStartSeconds: number
  bpm: number
  meter: { numerator: number; denominator: MeterDenominator }
}

interface ProcessingApplySelectionV1 {
  tempoMap: boolean
  processingSnapshot: boolean
  defaultHorizontalBinding: boolean
  defaultVerticalBinding: boolean
}

interface ProcessingApplyCommandV1 {
  proposalId: string
  expectedEditorProjectHash: string | null
  expectedVisualizerProjectHash: string | null
  selection: ProcessingApplySelectionV1
  confirmedTempoMap?: EditorProjectV1['tempoMap']
  tempoConfirmations?: ProcessingTempoConfirmationV1[]
}
~~~

- 复用当前 flux/onset、自相关及可靠性判断，增加 DP tracking。全曲 BPM 在变化歌曲可仅作摘要；局部候选优先呈现原始 interval 变化，不强行拉平。无可靠 beat 时 bpm=null、beats/候选为空，并有 low-confidence 警告；只有 separation 的结果没有 beatAnalysis。
- 检测 beats 升序且在 `[0,durationSeconds)`，1ms 内重复规范化；score 有限且在 [0,1]，算法/评分定义进入 version/config，不标为模型概率。未使用 drums 时 agreement=null；±70ms agreement 仅是辅助证据，空轨/不匹配不直接删除 mix beat。
- candidates 必须有有效 beat indices、严格正长度和 Editor 支持范围内 BPM；没有 meter 或自动 downbeat 字段。静音不外推 beat，半速/倍速和不稳定区段展示候选歧义警告。
- proposal 为只读原始结果。选择 tempo 应用时，确认每个选中 metered segment 的小节起点、BPM、meter；measureStartSeconds 对应该 segment.startSeconds，构造合法从 0 秒开始的 Editor V1 map。未确认区域可为 single-beat，不默认伪造 4/4。
- apply 前验证当前 source、proposal 与目标 canonical hash；null 仅表示该目标尚不存在，若已创建则冲突。任一被选目标冲突返回 project-conflict，重新审阅 diff，不绕过检查自动重试。
- 所选字段全部准备/校验后一起更新内存工程，失败不得留下部分应用。自动 BPM 标 estimated，用户修改标 user；未选字段及所有人工 marker 保留。新 revision 可用保存的原工程恢复；持久化失败显示 dirty/export 路径。
- rerun 只产生新 proposal，不能刷新已应用 snapshot 或隐式替换 user tempo/binding；默认横/竖绑定分别确认。

## Worker Start, Progress, Cancel, Result and Error

~~~ts
interface ProcessingJobIdentityV1 {
  jobId: string
  trackId: string
  generation: number
  source: ProcessingSourceIdentityV1
}

type ProcessingWorkerCommandV1 =
  | { type: 'start'; job: ProcessingJobIdentityV1; stage: 'separation';
      pcm: ProcessingPcmRefV1; runtime: ProcessingRuntimeManifestV1 }
  | { type: 'start'; job: ProcessingJobIdentityV1; stage: 'beat-analysis';
      pcm: ProcessingPcmRefV1; drums?: ProcessingStemArtifactV1;
      runtime: ProcessingRuntimeManifestV1 }
  | { type: 'cancel'; job: ProcessingJobIdentityV1;
      reason: 'user' | 'route-change' | 'track-change' | 'superseded' }

type ProcessingWorkerEventV1 =
  | { type: 'progress'; job: ProcessingJobIdentityV1; stage: ProcessingComputeStage;
      phase: 'model-download' | 'model-verify' | 'pcm-staging' | 'model-load'
        | 'inference' | 'stitch' | 'derive' | 'beat-track' | 'persist';
      completedUnits: number; totalUnits: number | null;
      downloadElapsedMs: number; processingElapsedMs: number }
  | { type: 'result'; job: ProcessingJobIdentityV1; stage: 'separation';
      result: ProcessingSeparationResultV1; cacheHit: boolean }
  | { type: 'result'; job: ProcessingJobIdentityV1; stage: 'beat-analysis';
      result: ProcessingBeatResultV1; cacheHit: boolean }
  | { type: 'cancel'; job: ProcessingJobIdentityV1;
      status: 'cancelled'; residualArtifactIds: string[] }
  | { type: 'error'; job: ProcessingJobIdentityV1; error: ProcessingErrorV1 }
~~~

- separation 运行在最多一个专用 Worker；beat-analysis 扩展现有 analysis Worker 与 coordinator lease，不创建额外分析 Worker。ORT proxy 关闭；同一时刻只运行一个自动 stage，不抢占现有播放/工程所有权。
- start 的 descriptor、PCM ref/hash、runtime 与可选 drums identity 必须一致；不一致在推断前拒绝。controller 拥有任务，route/track/stage 重试增加 generation；所有消息同时验证 trackId、source、jobId、generation。
- running 每秒至少 progress 一次；未知总量为 null，长 segment 可报当前阶段 heartbeat，不把 heartbeat 写成伪造进度。模型下载字节与处理阶段单位分开；模型 bytes 缓存校验后可复用。
- cancel 幂等。controller 立即使旧 generation 无效，取消 fetch/排队任务、请求 Worker 释放 session/tensor；无法及时响应时终止专用 Worker。现有 analysis Worker 的取消使用原 coordinator 机制。
- 每个 start 恰有一个有效 terminal（result/error/cancel）；强制 termination 由 controller 生成 cancelled 并记录清理。迟到 result 不能应用或发布当前工程。5 秒内未完成的临时清理显示 residual IDs，并在下次初始化提供清理入口。
- result 仅在 artifact/series 完整校验后发布；四轨失败可保留已校验模型，不能发布部分 separation。beat 失败可保留此前完整 separation。任务和缓存失败不修改工程或停止仍可用的播放。
- metadata 发布还需 controller 核对当前 job/source/generation 与取消标记；取消或 superseded 任务不能仅因 OPFS 写入完成就发布 cache entry。旧任务的清理回执仅更新该任务的残留登记，不能更新当前 UI/result。

## Typed Errors

~~~ts
type ProcessingErrorCode =
  | 'invalid-request' | 'pcm-incomplete' | 'pcm-hash-mismatch'
  | 'source-identity-mismatch' | 'webgpu-unavailable' | 'webgpu-device-lost'
  | 'webgpu-out-of-memory' | 'model-download-failed' | 'model-checksum-mismatch'
  | 'model-unavailable' | 'model-incompatible' | 'runtime-asset-mismatch'
  | 'inference-failed' | 'beat-analysis-failed' | 'stem-duration-mismatch'
  | 'storage-unavailable' | 'quota-exceeded' | 'cache-full' | 'cache-corrupt'
  | 'artifact-export-failed' | 'job-cancelled' | 'project-conflict'
  | 'tempo-confirmation-required' | 'tempo-snapshot-stale' | 'unsupported-schema'

interface ProcessingErrorV1 {
  schemaVersion: 1
  code: ProcessingErrorCode
  message: string
  retryable: boolean
  action?: string
  details?: Record<string, string | number | boolean>
}
~~~

details 不包含 PCM、用户音频、歌词、绝对路径或 stack trace。GPU/model/storage 失败提供可行动反馈及人工路径；不能自动以整图 CPU、轻量模型或其他算法掩盖分离失败。模型下载取消使用 cancelled，不标为校验成功。

## Visualizer V2 Snapshot, Migration and Tempo Refresh

~~~ts
interface VisualizerTempoBeatMapV1 {
  source: 'editor-tempo-derived'
  editorProjectHash: string
  tempoMapHash: string
  derivationVersion: string
  beats: number[]
  downbeats: number[]
}

interface VisualizerProcessingSnapshotV1 {
  schemaVersion: 1
  proposalId: string
  source: ProcessingSourceIdentityV1
  runtime: ProcessingRuntimeManifestV1
  stemEnergy: Record<ProcessingStemRole, ProcessingSeriesV1> | null
  detectedBeats: ProcessingBeatEventV1[]
  warnings: ProcessingWarningV1[]
  tempoBeatMap?: VisualizerTempoBeatMapV1
}

type VisualizerProcessingSignalV1 =
  | { kind: 'stem-energy'; stem: ProcessingStemRole }
  | { kind: 'beat'; pulseSeconds: number }
  | { kind: 'downbeat'; pulseSeconds: number }

interface VisualizerProcessingSourceV1 {
  kind: 'processing'
  signal: VisualizerProcessingSignalV1
}

interface VisualizerProjectV2 {
  format: 'audiosurf-visualizer'
  schemaVersion: 2
  projectId: string
  createdAt: string
  updatedAt: string
  track: EditorTrackIdentityV1
  templateId: VisualizerTemplateId
  templateVersion: 1
  seed: number
  recordingPresetId: RecordingPresetId
  bindings: Record<string, VisualizerBindingV2>
  editorSnapshot?: VisualizerProjectV1['editorSnapshot']
  processingSnapshot?: VisualizerProcessingSnapshotV1
}

function migrateVisualizerProjectV1ToV2(input: VisualizerProjectV1): VisualizerProjectV2
~~~

- VisualizerBindingV2 保留 V1 constant/analysis/editor-event union，增加 processing source；registry 穷尽声明 allowed sources。snapshot 与 project.track 的 content hash/duration 必须一致，缺失或失配返回 typed unavailable，不把缺失替成有效 0。
- stem-energy 按 AudioContext 绝对秒数取 30Hz sample；beat/downbeat 在 `[eventTime,eventTime+pulseSeconds)` 为 1，pulseSeconds 必须有限正值并保存于 binding。
- beat 默认用 detectedBeats；用户确认/修正 tempo 并显式刷新后优先用 tempoBeatMap.beats。downbeat 仅使用 tempoBeatMap.downbeats；缺 map 时 unavailable。map 只对已确认 metered segment 按 Editor grid 派生，single-beat 区间不产生小节首拍；来源始终标明用户确认的 tempo，不称模型检测。
- 编辑 tempo 后比较当前 tempoMapHash 与 snapshot；派生 beat/downbeat、相关 Editor snapshot 标 stale，不静默继续使用旧数据或回退 detectedBeats。用户显式刷新时显示 diff，以当前歌曲有效 Editor map 同时替换 editorSnapshot 和 tempoBeatMap，保留 detectedBeats、stem energy 和用户 binding。
- recording preflight 对仍绑定 stale beat/downbeat 的工程返回 tempo-snapshot-stale；用户可刷新或显式移除受影响绑定，不能把旧结果标为可用。stem/constant/analysis 和未受影响的源继续可用。
- 默认应用分别选择 horizontalIntensity=other stem-energy、verticalIntensity=beat pulse；没有对应数据时禁止该选择，不创建无效默认绑定。不改变颜色、粗细、亮度、decay 或其他用户参数。
- 迁移无 I/O，V1 schema 改为 2，其余值/语义保持，processingSnapshot 省略；相同 V1 bytes 生成相同 canonical V2 bytes。迁移不读取 cache/Editor DB/当前歌曲，不自动加默认 processing binding。
- import 接受 V1 单向迁移和严格校验的 V2，拒绝未知版本。新建/草稿/导出只写 V2，不双写、不降级。旧 V1 工程可继续使用原 source 与 WebM；工程只嵌 compact data，不嵌 stem/model/OPFS handle。

## Approval

2026-10-04，owner 通过本轮浏览器修订计划批准这些目标接口、只读提案、小节确认、V2 与显式 tempo 刷新。实施仍需 delivery 审批和专项验证，R-046–R-055 保持 Open。
