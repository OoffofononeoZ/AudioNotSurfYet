---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/architecture/system-design.md"
next_action: "V6 clean canonical 已验证接口前向回归；等待 owner 人工门禁"
---

# Interface Contracts

以下是内部 TypeScript 目标契约。字段名可在实现评审中做非语义调整；身份、所有权、失败语义和不变量不能绕过 ADR 直接改变。

## Shared Primitives

```ts
type TrackId = string
type TrackHash = string       // SHA-256 content identity
type ConfigHash = string      // canonical AnalysisConfig identity
type FeatureId =
  | 'rms' | 'zcr' | 'energy'
  | 'amplitudeSpectrum' | 'powerSpectrum'
  | 'spectralCentroid' | 'spectralFlatness' | 'spectralFlux'
  | 'spectralSlope' | 'spectralRolloff' | 'spectralSpread'
  | 'spectralSkewness' | 'spectralKurtosis' | 'spectralCrest'
  | 'chroma' | 'loudness' | 'perceptualSpread'
  | 'perceptualSharpness' | 'mfcc' | 'complexSpectrum' | 'buffer'

type RestoreState =
  | 'available'
  | 'permission-required'
  | 'permission-denied'
  | 'file-missing'
  | 'content-changed'
  | 'not-persisted'
  | 'decode-error'
```

所有 hash 由明确版本的 canonical encoder 生成。不得使用对象属性遍历顺序或展示标签作为缓存身份。

## TrackRecord

```ts
interface TrackRecord {
  id: TrackId
  name: string
  mimeType: string
  byteSize: number
  lastModified: number
  durationSeconds?: number
  encodedSampleRate?: number
  metadata: {
    title?: string
    artist?: string
    album?: string
    artworkMimeType?: string
  }
  trackHash?: TrackHash
  handleKey?: string
  restoreState: RestoreState
}
```

Invariants:

- `id` 是 session 内稳定身份，`trackHash` 是内容身份；二者不可互换。
- `handleKey` 只引用 IndexedDB 中的 handle，不把句柄放进 Pinia/localStorage。
- `trackHash` 未完成时不得命中分析缓存。
- 文件重新读取后若内容 hash 改变，旧分析缓存必须失效。

## PlaybackSnapshot

```ts
type PlaybackState = 'empty' | 'loading' | 'paused' | 'playing' | 'ended' | 'error'

interface PlaybackSnapshot {
  trackId: TrackId | null
  state: PlaybackState
  currentTimeSeconds: number
  durationSeconds: number
  volume: number
  error?: {
    code: 'decode' | 'context' | 'source' | 'unsupported'
    message: string
  }
}
```

Invariants:

- 时间使用秒并以 AudioContext 基准计算。
- `currentTimeSeconds` 始终被裁剪到 `[0, durationSeconds]`。
- store 只保存快照；真实 AudioNode 保留在 AudioEngine。
- 刷新恢复后的首个快照必须为 `paused`、时间 0。

## AudioEngine

```ts
interface AudioEngine {
  load(input: {
    trackId: TrackId
    encodedAudio: ArrayBuffer
  }): Promise<'loaded' | 'stale'>
  play(): Promise<void>
  pause(): void
  seek(seconds: number): Promise<void>
  setVolume(volume: number): void
  getSnapshot(): PlaybackSnapshot
  getTimeDomainFloatData(): Float32Array | null
  getDecodedAudioDescriptor(): DecodedAudioDescriptor | null
  copyDecodedChannelRange(input: {
    revision: number
    channel: number
    start: number
    length: number
  }): Float32Array | null
  subscribe(listener: (snapshot: PlaybackSnapshot) => void): () => void
  unload(): void
  dispose(): Promise<void>
}

interface DecodedAudioDescriptor {
  trackId: TrackId
  revision: number
  sampleRate: number
  length: number
  channelCount: number
  durationSeconds: number
}
```

Invariants:

- AudioContext、Gain、Analyser 和当前 AudioBuffer 延迟创建；设置初始音量不得提前创建上下文。
- `load()` 使用 generation；旧解码只能返回 `stale`，不得覆盖当前 track、buffer 或 snapshot。
- `play()` 幂等；自然 ended 只发布一次，主动 stop/unload 不发布 ended。
- 播放时间由 AudioContext `currentTime` 和起始 offset 计算，不累计 RAF delta。
- `dispose()` 关闭现有上下文、断开节点且不立即创建替代上下文。
- `AudioBuffer` 仍由 engine 独占；coordinator 只能按 16,384 samples 分块复制各声道并平均。每次复制都核对 revision，换歌、loading、error、清空或 dispose 后旧 revision 返回 `null`。

## AudioSessionService

```ts
interface LocalAudioInput {
  file: File
  handle?: FileSystemFileHandle
}

interface AudioSessionService {
  initialize(): Promise<StoredAnalysisCache | undefined>
  selectAndImportFiles(): Promise<'imported' | 'cancelled'>
  importFiles(inputs: LocalAudioInput[]): Promise<void>
  playTrack(trackId: TrackId): Promise<void>
  togglePlayback(): Promise<void>
  next(): Promise<void>
  previous(): Promise<void>
  seek(seconds: number): Promise<void>
  setVolume(percent: number): void
  restoreAccess(trackId: TrackId): Promise<void>
  reselectTrack(trackId: TrackId): Promise<void>
  deleteTrack(trackId: TrackId): Promise<void>
  clear(): Promise<void>
  clearPersistedSession(): Promise<void>
  dispose(): Promise<void>
}
```

Invariants:

- MainLayout 创建、provide 并 dispose 唯一 service；MusicBar 与后续 Analyzer 不自行创建 engine。
- runtime File 与封面对象 URL 留在 store 外；`audioSessionStore.$state` 必须可 JSON 序列化。
- service 只有一个可取消 RAF，同时刷新 PlaybackSnapshot 和 Meyda energy；暂停、错误、清空和 dispose 时 energy 为 0。
- 空队列导入自动播放首项；非空队列导入只追加。快速切歌以最后 command generation 为准。
- 音量命令输入为 0–100 配置值，PlaybackSnapshot 保存 0–1 Gain 值。
- UI 只调用 `selectAndImportFiles()`；缺少 File System Access API 时显示非阻塞错误，不回退到隐藏 input。
- `initialize()` 只查询权限，不触发 `requestPermission()`；后者只允许由 `restoreAccess()` 的用户手势触发。
- 返回值只作为当前恢复周期的 cache bootstrap；File、Blob、PCM、AudioBuffer 和 Worker 不进入 Pinia。

## AnalysisConfig

```ts
interface AnalysisConfig {
  schemaVersion: 1
  frameSize: 1024
  hopSize: 512
  windowingFunction: 'hanning'
  numberOfMFCCCoefficients: 13
  channelMode: 'average-mono'
  sampleRate: number
  configHash: ConfigHash
}
```

Invariants:

- 首版除 `sampleRate` 随音频而定外均为固定字面量。
- `sampleRate` 是传入 Worker 的 PCM 采样率，并在 UI 可见。
- `configHash` 不包含展示语言或颜色，只包含会改变分析结果的字段。
- SHA-256 输入固定为 `analysis-config:v1|frame=1024|hop=512|window=hanning|mfcc=13|channel=average-mono|sampleRate=<actual>`。

## FeatureDefinition

```ts
type FeatureShape =
  | 'scalar'
  | 'frequency-vector'
  | 'category-vector'
  | 'waveform'
  | 'loudness-structure'
  | 'complex-spectrum'

type RendererId =
  | 'scalar-line'
  | 'frequency-heatmap'
  | 'chroma-heatmap'
  | 'waveform'
  | 'loudness'
  | 'complex-spectrum'

interface FeatureDefinition<T extends FeatureId = FeatureId> {
  id: T
  meydaKey: T
  label: string
  description: string
  outputShape: FeatureShape
  renderer: RendererId
  range: { min?: number; max?: number; unit?: string; signed?: boolean }
  dependencies: readonly FeatureId[]
  dimensions(config: AnalysisConfig): readonly number[]
  deliveryMilestone: 'M7' | 'M8' | 'M9' | 'M10'
  workerSupported: boolean
  extractionSource: 'meyda' | 'project-spectral-flux-v1'
  zeroEnergyValue?: 0
}
```

Invariants:

- 注册表对全部 `FeatureId` 穷尽且 key 唯一。
- `meydaKey` 对 `extractionSource: 'meyda'` 必须与当前 Meyda 版本支持的提取器匹配；项目 Flux 保留稳定 FeatureId，但不得调用有缺陷的 Meyda extractor。
- renderer 与 payload shape 的映射通过编译期类型和 runtime assertion 验证。
- M6 历史支持集为 `rms`、`energy`、`amplitudeSpectrum`、`chroma`；M10 当前 Worker 支持累计 21 项，活动 job 仍最多四项且唯一。历史里程碑常量保持不变，当前入口使用 `M10_AVAILABLE_FEATURE_IDS`。
- Meyda 5.6.3 实际维度固定为：Amplitude/Power Spectrum 512、Chroma 12、MFCC 13、Buffer 1024、Loudness 24 specific + total、Complex Spectrum real/imag 各 1024。`@types/meyda` 缺少 `spectralCrest`，实现使用项目内窄 adapter，不升级依赖。
- `M9_FEATURE_IDS` 固定为 Power Spectrum、MFCC、Buffer；`M9_AVAILABLE_FEATURE_IDS` 是累计 19 项。Power Spectrum 使用 `frequency-u16`，MFCC 使用 signed `category-u16`，Buffer 使用 `waveform-envelope`，exact cursor 分别返回 512、13、1024 个有限值。
- `M10_FEATURE_IDS` 固定为 Loudness、Complex Spectrum；`M10_AVAILABLE_FEATURE_IDS` 是累计 21 项。Loudness 使用 `loudness` payload，exact cursor 返回 total 与 24 个 specific bands；Complex Spectrum 使用 `complex-derived` payload，exact cursor 返回 real/imag 各 1024。结构字段、维度和值必须全部有限；零能量帧返回项目零值语义。

## AnalysisSeries

```ts
type CompactPayload =
  | { kind: 'scalar-f32'; values: Float32Array }
  | { kind: 'frequency-u16'; values: Uint16Array; width: number; scale: number; offset: number }
  | { kind: 'category-u16'; values: Uint16Array; width: number; scale: number; offset: number }
  | { kind: 'waveform-envelope'; min: Int16Array; max: Int16Array; scale: number }
  | { kind: 'loudness'; total: Float32Array; specific: Uint16Array; bands: 24; scale: number; offset: number }
  | { kind: 'complex-derived'; magnitude: Uint16Array; phase: Int16Array; bins: number; magnitudeScale: number }

interface AnalysisSeries {
  schemaVersion: 1
  trackHash: TrackHash
  configHash: ConfigHash
  featureId: FeatureId
  startTimeSeconds: 0
  sampleStepSeconds: number
  sampleCount: number
  dimensions: readonly number[]
  payload: CompactPayload
}
```

Invariants:

- `sampleCount * payload width` 与 typed-array 长度必须一致。
- 展示结果最多 30 samples/second；不能把逐 hop 原始频谱作为长期 payload。
- 量化的 scale/offset 必须可确定性反解，黄金测试覆盖边界和饱和行为。
- 缓存 key 为 `${trackHash}:${configHash}:${featureId}`。
- 缓存二进制为 `4-byte little-endian header length + UTF-8 JSON header + contiguous typed-array bytes`。header 必须记录 schema、完整身份、payload kind、dimensions、scale/offset 和 byte ranges；decoder 拒绝 schema/身份不符、错位、长度错误、缺失及尾随数据。
- U16 使用 series 实际 min/max；常量 series 的 `scale` 为 0。调用方提供显式 bounds 时，越界必须失败，不能静默裁剪。
- Loudness `total.length === sampleCount`，`specific.length === sampleCount * 24`；Complex `magnitude.length === phase.length === sampleCount * 1024`。phase 使用 Int16 映射 `[-π, π]`，跨 ±π 聚合使用圆周平均。

## Worker Messages

```ts
interface AnalysisJobRequest {
  kind: 'analyze'
  jobId: string
  generation: number
  trackHash: TrackHash
  config: AnalysisConfig
  featureIds: readonly FeatureId[]       // 0..4 unique cache misses
  cursorFeatureIds: readonly FeatureId[] // 0..4 unique active features
  pcm: ArrayBuffer                // Float32 mono, transferred
  durationSeconds: number
}

interface AnalysisJobCancel {
  kind: 'cancel'
  jobId: string
  generation: number
}

interface AnalysisJobProgress {
  kind: 'progress'
  jobId: string
  generation: number
  completedFrames: number
  totalFrames: number
}

interface AnalysisJobResult {
  kind: 'result'
  jobId: string
  generation: number
  trackHash: TrackHash
  configHash: ConfigHash
  series: AnalysisSeries[]
}

interface AnalysisJobError {
  kind: 'error'
  jobId: string
  generation: number
  code: 'invalid-request' | 'unsupported-feature' | 'extract-failed' | 'cancelled' | 'worker-failed'
  message: string
  recoverable: boolean
}
```

Worker 每批 frame 后必须检查取消并让出事件循环。取消的 job 可以返回 `cancelled`，但 coordinator 仍必须通过 generation 隔离所有消息。

M6 runtime rules:

- 请求必须校验 PCM、实际 sample rate、config hash、duration、完整身份、0–4 个唯一 `featureIds`/`cursorFeatureIds`，并要求所有提取项属于 cursor 活动集；任何失败都不写部分 cache。
- frame count 为 `max(1, 1 + ceil((length - 1024) / 512))`，最后一帧零填充。
- 同一 frame 一次调用 Meyda；聚合因子为 `max(1, ceil(sampleRate / (hopSize * 30)))`。
- Worker 最多处理 32 frames 或连续运行 8ms 就报告 progress、检查取消并让出事件循环。
- Meyda 5.6.3 的 `spectralFlux` 已在固定测试中复现 `ReferenceError: x is not defined`；M6 不 patch、启用或伪造通过，它是 M8 阻断风险。
- M8 使用 ADR-0005 的项目 `spectralFlux`：第一帧 0，后续为相邻幅度频谱正向 L1 差；exact cursor 对非首帧同时提取 previous/current frame。
- 零能量 frame 的 M8 标量统一为 0；非零能量的非有限值返回 `extract-failed`，不得写入 series/cache。

### Exact cursor value

```ts
interface AnalysisCursorValueRequest {
  kind: 'cursor-value'
  requestId: string
  generation: number
  trackHash: TrackHash
  config: AnalysisConfig
  featureId: FeatureId
  timeSeconds: number
}

interface AnalysisCursorValueResult {
  kind: 'cursor-value-result'
  requestId: string
  generation: number
  trackHash: TrackHash
  configHash: ConfigHash
  featureId: FeatureId
  frameStartSeconds: number
  value: number | number[] | { total: number; specific: number[] } | { real: number[]; imag: number[] }
}
```

精确值不量化，只用于当前游标详情；快速移动时允许合并请求，过期 request ID 必须丢弃。

游标选择“不晚于目标时间的最后合法 frame”；`duration` 映射到最后一帧。Worker 保留当前 mono PCM；每个 feature 只保留最新 cursor request，旧请求或过期身份返回 `null`。

## AnalysisCoordinator

```ts
interface AnalysisCoordinator {
  setActiveFeatures(ids: readonly FeatureId[]): Promise<void>
  retry(): Promise<void>
  requestCursorValue(
    featureId: FeatureId,
    timeSeconds: number
  ): Promise<AnalysisCursorValueResult | null>
  getSeries(featureId: FeatureId): AnalysisSeries | null
  getSnapshot(): AnalysisCoordinatorSnapshot
  subscribe(listener: AnalysisListener): () => void
  dispose(): Promise<void>
}
```

Invariants:

- 接受 0–4 个唯一 ID；重复、超过四项或 M6 未支持 ID 返回 typed error。
- Coordinator 持有 typed-array series；Pinia 只保存可序列化进度、错误、身份、cache 状态和活动特征意图。
- cache 逐 feature 部分复用，只把 miss 作为提取项发送到 Worker；全命中时使用 0-feature job 仅保留当前 PCM 供 exact cursor，不重复 Meyda 提取。损坏项按 miss 重算；默认活动集为空时不创建 Worker。
- 切歌、loading、error、清空、活动特征变化和 dispose 都 cancel、递增 generation 并丢弃旧 progress/result/error/cursor。
- MainLayout 创建同一个 AudioEngine、SessionRepository、AudioSessionService 和 AnalysisCoordinator；dispose 顺序为 coordinator 先于 engine/session。

## Active feature queue and V1 carrier

```ts
interface ActiveAnalysisCard {
  slot: 0 | 1 | 2 | 3
  featureId: FeatureId
}

type ActiveFeatureQueue = FeatureId[]
```

Invariants:

- runtime 只使用 `ActiveFeatureQueue`；数组最多四项、feature ID 唯一，顺序表示 FIFO 年龄。
- `ActiveAnalysisCard` 只保留为 `PersistedSessionV1.activeCards` 的 V1 carrier。restore 按 slot 排序后提取 feature ID；save 按 queue index 生成 slot 0–3。
- reducer 语义固定：已展开项点击后删除；未展开且少于四项追加；已满时移除队首再追加目标。一次提交不得短暂产生五项。
- M7–M12 的 slot 交互是历史证据；M13 UI 不暴露 slot、换卡、移除或特征选择契约。

## AnalysisWorkspaceSnapshot

```ts
interface AnalysisWorkspaceSnapshot {
  initialized: boolean
  activeFeatureQueue: FeatureId[]
  featureOrder: FeatureId[]
  viewport: Pick<TimelineViewport, 'startSeconds' | 'endSeconds' | 'zoom'> | null
}
```

Invariants:

- `initialized: false` 表示从未保存过工作区，Analyzer 首次进入时建立空活动队列。
- `initialized: true` 且 `activeFeatureQueue: []` 是有效的已保存空工作区，刷新后必须保持为空。
- `featureOrder` 必须恰好包含全部 21 个唯一 `FEATURE_IDS`；顺序只表示卡片逻辑位置，不表示 FIFO 年龄。
- `AudioSessionService.updateAnalysisWorkspace(...)` 先用不可变快照更新内存，再把 queue 映射为 V1 cards 并保存完整 feature order；只有最新 revision 可以发布 `ready`/`not-persisted`。
- runtime validation 接受 0–4 个唯一 feature；viewport 所有值有限、`0 <= start < end`、`zoom > 0`。

## TimelineViewport

```ts
interface TimelineViewport {
  startSeconds: number
  endSeconds: number
  cursorSeconds: number
  zoom: number
}
```

Invariants:

- `0 <= start < end <= track.duration`.
- `cursorSeconds` 裁剪到 track duration，但可以在当前 viewport 之外。
- 所有卡读取同一对象；renderer 不保存私有 zoom。
- zoom 交互范围为 1–64；平移步长为当前窗口 25%，换歌时 viewport 裁剪到新 duration。
- `cursorSeconds` 始终来自播放快照，不进入 `PersistedSessionV1`。

## PersistedSessionV1

```ts
interface PersistedSessionV1 {
  schemaVersion: 1
  savedAt: string
  queue: TrackRecord[]
  currentTrackId: TrackId | null
  activeCards: ActiveAnalysisCard[]
  featureOrder?: FeatureId[]
  analysisConfig: Omit<AnalysisConfig, 'sampleRate' | 'configHash'>
  viewport: Pick<TimelineViewport, 'startSeconds' | 'endSeconds' | 'zoom'> | null
  handles: Array<{ trackId: TrackId; handleKey: string }>
  currentBlob?: { trackId: TrackId; blobKey: string; trackHash: TrackHash }
  currentAnalysisCache?: {
    trackId: TrackId
    trackHash: TrackHash
    configHash: ConfigHash
    featureIds: FeatureId[]
    cacheKeys: string[]
  }
}
```

Persistence rules:

- 播放时间和 playing 状态不持久化；恢复始终从 0 paused 开始。
- `currentBlob.trackId` 与 `currentTrackId` 不一致时忽略 Blob。
- 只允许一个 current Blob 和一个 current cache manifest。
- 写入 current track 时先建立新记录，再在同一事务删除旧记录；事务失败不得删除仍有效的旧持久化状态。
- `playTrack()` 一旦发布新的 `currentTrackId`，必须同步把 persistence state 置为 `saving`；调用方只有在同一 command generation 进入 `ready` 或 `not-persisted` 后，才能把刷新视为已持久化。
- 旧 generation、已取消命令或 disposed service 的 repository completion 不得更新当前 track 的 persistence state。
- schema version 未识别时进入可恢复错误，不能尝试猜测字段。
- `activeCards` schema 不变；其 slot 只承载 FIFO 索引。旧记录恢复时按 slot 排序，重复、未知或超过四项继续由严格 validator 拒绝。
- `featureOrder` 为 V1 可选扩展：缺失代表旧会话并恢复 `FEATURE_IDS`；存在时必须是 21 项完整唯一 permutation。新版本保存始终写入，非法字段使 session 无效。

## Analyzer card order interaction

```ts
type FeatureOrderAction = 'up' | 'down' | 'first' | 'last'
type DropEdge = 'before' | 'after'
```

- 纯 reducer 接收完整 order、source feature、target feature/edge 或 action，返回新的完整 order；无效输入抛出，边界/no-op 返回等值副本且不触发持久化。
- `MeydaCard` 只新增命名 header-action slot；既有 props 与 `toggle`/`seek` emit 不变。Analyzer 拥有 handle、popup、pointer state、hit-test、live text 和持久化。
- wrapper 继续以 feature ID 为 key，并保留 `data-slot=featureId`；`data-order-index` 是一基位置。drop 后 DOM 顺序与该 index、屏幕阅读顺序和 masonry 输入一致。
- 一次只允许一个 popup 或 drag；排序提交保持 source handle 焦点。排序不发出 analysis consumer message。

## Session Repository Results

Repository 不通过异常表达预期权限状态：

```ts
type RestoreResult<T> =
  | { ok: true; value: T; source: 'blob' | 'handle' | 'cache' }
  | { ok: false; state: Exclude<RestoreState, 'available'>; recoverable: boolean; detail?: string }
```

程序错误、数据库损坏和事务失败可以抛出 typed error；`prompt`、`denied`、用户取消和缺失文件必须返回显式状态供 UI 表达。

## SessionRepository

```ts
interface SessionPersistenceSnapshot {
  state:
    | 'idle'
    | 'restoring'
    | 'ready'
    | 'saving'
    | 'not-persisted'
    | 'unsupported-schema'
    | 'restore-error'
  message?: string
}

interface SessionRepositoryPort {
  restore(): Promise<RestoredSessionBundle | null>
  saveQueue(input: PersistedQueueInput): Promise<void>
  replaceCurrent(input: PersistedCurrentInput): Promise<void>
  replaceCurrentAnalysisCache(input: {
    trackId: TrackId
    trackHash: TrackHash
    configHash: ConfigHash
    payloads: Array<{
      featureId: FeatureId
      cacheKey: string
      payload: ArrayBuffer
    }>
  }): Promise<'stored' | 'stale'>
  removeTrack(trackId: TrackId): Promise<void>
  clear(): Promise<void>
}
```

Invariants:

- 原生 IndexedDB V1 使用 `session`、`handles`、`current-blob` 和 `current-analysis-cache` 四个 object store。
- current Blob 与 current analysis cache 使用固定键；`replaceCurrent()` 在单一事务中写新 session/handles 并替换或清除旧 current 记录。
- `replaceCurrentAnalysisCache()` 在单一事务内核对 persisted current track/hash、更新 session manifest 和固定 current cache，同时保持 current Blob 不变。身份改变返回 `stale`；quota/abort 保留旧记录。
- `removeTrack()` 在仓储事务内同步移除 session queue entry、handle descriptor 和 handle record。
- `clear()` 只有在四个 store 全部清空后才算成功；失败时调用方保持内存队列。
- `restore()` 必须先通过 `PersistedSessionV1` runtime validation；未知 schema 抛 `UnsupportedSessionSchemaError`，不得猜测迁移。

## Editor Contract Status

本文件前述 Analyzer 契约是 2026-07-24 已批准并由 M3–M11 验证的历史基线。以下 Editor 扩展于 2026-08-26 获批；类型名用于锁定后续实现边界，但当前源码中尚不存在。

## Editor Route and Playback Lease

```ts
type EditorRouteTarget =
  | { kind: 'empty' }
  | { kind: 'track'; trackId: TrackId }

interface EditorPlaybackLease {
  token: string
  trackId: TrackId
  release(): void
}

interface AudioSessionServiceEditorExtension {
  acquireEditorPlayback(trackId: TrackId): Promise<EditorPlaybackLease>
}
```

Invariants:

- `/editor/:trackId?` 只以 `trackId` 查找当前 session；工程匹配使用 `trackHash`，不能把两种身份互换。
- Header 入口用当前 track ID 导航且不隐式改变播放/暂停；播放列表“去编辑”必须先在同一用户手势中调用现有 `playTrack(trackId)`，成功后再导航。
- 直接打开或刷新带 ID 路由时，可以用现有 session/handle/blob 恢复目标 track，但保持 0 秒 paused；未知、不可恢复或身份无效时返回显式不可用状态。
- acquire 只有在 track 存在、内容 hash 已知且可解码/恢复时成功；失败不得切换到其他歌曲。
- 当前 lease 将 ended policy 改为 repeat-one；同一个已解码 buffer 从 0 再次 `play()`，不调用 `next()`、不重新解码。
- 只有当前 token 的 `release()` 生效；重复 release 幂等，旧 token 不改变当前策略。
- lease 是 runtime 状态，不进入 `PersistedSessionV1`。刷新依照现有规则恢复 0 秒 paused，再由 Editor route 获取新 lease。
- 只有有效 track 的 lease 存在时隐藏 MusicBar；`empty`/不可用状态保留 MusicBar，Editor 页内控件不创建隐藏媒体元素。

## Analysis Consumer Lease and Tempo Messages

```ts
type AnalysisConsumer = 'analyzer' | 'editor'

interface AnalysisConsumerLease {
  token: string
  consumer: AnalysisConsumer
  setActiveFeatures(ids: readonly FeatureId[]): Promise<void>
  requestCursorValue(
    featureId: FeatureId,
    timeSeconds: number,
  ): Promise<AnalysisCursorValueResult | null>
  requestTempoEstimate(): Promise<TempoEstimateResult | null>
  getSeries(featureId: FeatureId): AnalysisSeries | null
  subscribe(listener: AnalysisListener): () => void
  release(): void
}

interface AnalysisCoordinatorConsumerExtension {
  acquireConsumer(consumer: AnalysisConsumer): AnalysisConsumerLease
}

interface TempoEstimateRequest {
  kind: 'tempo-estimate'
  requestId: string
  generation: number
  trackHash: TrackHash
  configHash: ConfigHash
}

type TempoEstimateResult =
  | {
      kind: 'tempo-estimate-result'
      requestId: string
      generation: number
      trackHash: TrackHash
      configHash: ConfigHash
      state: 'reliable'
      bpm: number
      confidence: number
    }
  | {
      kind: 'tempo-estimate-result'
      requestId: string
      generation: number
      trackHash: TrackHash
      configHash: ConfigHash
      state: 'low-confidence'
      confidence: number
    }
```

Invariants:

- 一个时刻只有最新 route 的 consumer lease 可以发出有效请求；旧 token 的 set/request/release 返回 stale/no-op，不改变快照或 cache。
- Analyzer 仍接受 0–4 个唯一特征。Editor 只接受 `unique(['buffer', overlayFeatureId])`，因此为 1–2 项。
- Editor lease 不写 `analysisWorkspace.activeCards`；Analysis cache 仍可按当前 0–2 项原子替换，返回 Analyzer 后由 Analyzer workspace 重新激活。
- tempo 请求只读取当前 Worker retained PCM；没有匹配 PCM、身份过期、取消或 Worker error 时返回 `null`/typed error，不启动第二个 Worker。
- reliable BPM 必须有限且在 20–300；confidence 必须有限且在 0–1。阈值由 E2 配置/golden 决定，不持久化。

## Editor Project and Codec

```ts
interface EditorFormatCodec<TProject = EditorProjectV1> {
  id: 'json-v1'
  label: 'JSON'
  extension: '.audiosurf-editor.json'
  mimeType: 'application/json'
  encode(project: TProject): Uint8Array
  decode(input: Uint8Array): TProject
}

interface EditorFormatCodecRegistry {
  list(): readonly EditorFormatCodec[]
  get(id: string): EditorFormatCodec | null
}

interface EditorDraftRepository {
  restore(): Promise<EditorDraftEnvelopeV1 | null>
  replace(input: EditorDraftEnvelopeV1): Promise<void>
  clear(): Promise<void>
  getLeaveWarningSuppressed(): Promise<boolean>
  setLeaveWarningSuppressed(value: boolean): Promise<void>
}
```

`EditorProjectV1`、tempo/point/range 判别联合、canonical seconds、strict validator、JSON 编码顺序和独立 IndexedDB V1 详见 [Editor Project Format V1](editor/project-format-v1.md)。

Invariants:

- codec decode 是纯验证边界；调用方只有在完整 decode 和当前 track hash 匹配后才能替换内存工程。
- registry 首版恰好包含 `json-v1`，不因 UI 存在选择器而伪造其他格式。
- draft repository 使用 `audionotsurfyet-editor`，不得读取或升级 `audionotsurfyet-session`。
- replace 使用单一事务；abort/quota 保留旧 durable draft。内存工程由 controller 持有，不因写入失败回滚。

## Editor Timeline and Renderer Contracts

```ts
type EditorSubdivision = 1 | 2 | 4 | 8 | 16

interface EditorTimelineGeometry {
  viewport: PersistedTimelineViewport
  widthCssPixels: number
  devicePixelRatio: number
  timeToX(timeSeconds: number): number
  xToTime(xCssPixels: number): number
}

interface EditorWaveformVerticalGeometry {
  centerY: number        // heightCssPixels / 2
  amplitude: number      // max(0, (heightCssPixels - 12) / 2)
  padding: 6
}

type EditorUnavailableRecoveryDecision =
  | { kind: 'retry-route'; trackId: TrackId; signature: string }
  | { kind: 'offer-current'; trackId: TrackId; title: string }
  | { kind: 'none' }

interface EditorRenderRequest {
  feature: FeatureDefinition
  series: AnalysisSeries
  viewport: PersistedTimelineViewport
  widthCssPixels: number
  heightCssPixels: number
  devicePixelRatio: number
}

interface EditorRendererAdapter {
  drawStatic(request: EditorRenderRequest, target: CanvasRenderingContext2D): void
  drawCursor(
    request: EditorRenderRequest,
    cursorSeconds: number,
    exactValue: AnalysisCursorValueResult | null,
    target: CanvasRenderingContext2D,
  ): void
}
```

Invariants:

- waveform、tempo grid、point/range 与 overlay 必须共享同一个 geometry 实例/纯函数，CSS x 差异目标不超过 1 px。
- waveform stage 在 `>=900px` 固定为 `88px`、`<900px` 固定为 `72px`；波形以 `height / 2` 为中心，上下各保留 `6px`，归一化 `+1/-1` 不被裁切。
- Canvas backing store 为 CSS 尺寸乘 DPR；renderer 只接收绘制输入，不读 route、store、DOM 或 pointer 状态。
- 不可用 route 的同歌曲恢复只允许合并后的 `retry-route`，成功保持 paused 且不得触发播放；另一首可播放歌曲只返回 `offer-current`，必须由用户点击后 `router.replace`，不得静默改路由。
- point 事件时间 X、marker button 中心、菱形中心和候选框中心的误差不超过 `1 CSS px`；菱形 Y 中心误差同样不超过 `1 CSS px`，引线不参与菱形旋转或中心计算。
- overlay 的数据 Canvas、说明和空白不接收 pointer；selector 与三个垂直手柄是唯一交互层。
- Canvas failure 只使 overlay 进入可重试错误；底层工程、事件、播放和导出继续。
- pointer/keyboard 状态机、右键优先级、12px 自适应网格和 cleanup 详见 [Editor Interaction Contracts](editor/interaction-contracts.md)。

## Editor Architecture Approval

`project-owner` 于 2026-08-26 明确批准 Editor E0 系统设计、接口契约、风险与 ADR，并同意进入 E1–E6 execution planning。上述 Editor 接口据此获批；Analyzer 历史契约继续有效，但设计批准不能作为 Editor 代码已实现或验证的证据。

`project-owner` 于 2026-09-03 以实施指令批准 ADR-0018 与上述 E8 内部契约，并开放 E8 实现。E8 25/25 clean canonical 通过后，owner 又明确批准 evidence 与人工门禁；E8 已关闭，相关风险改为 `Mitigated`。

## Visualizer Contract Status（approved）

下列 Visualizer 接口是已批准的目标契约；Analyzer/Editor 上述接口仍是历史批准基线。当前 `/comingsoon` 不实现这些接口；本次批准只允许创建 delivery planning，规划获批前不得开始代码实现。

### Route playback and analysis leases

```ts
type RoutePlaybackConsumer = 'editor' | 'visualizer'
type RouteEndedPolicy = 'repeat-one' | 'pause-at-end'

interface RoutePlaybackLease {
  readonly token: string
  readonly consumer: RoutePlaybackConsumer
  readonly trackId: string
  readonly endedPolicy: RouteEndedPolicy
  release(): void
}

type AnalysisConsumer = 'analyzer' | 'editor' | 'visualizer'
```

- `AudioSessionService.acquireRoutePlayback(...)` 校验当前 track 后才返回 lease；只有当前 token 的 release 生效。Visualizer ended 保留 current track 并发布 `ended`，再次 play 从 0 秒开始；不得调用 `next()`。
- V1 原子迁移 Editor 调用方到通用 lease，不提供长期 Editor compatibility adapter。
- Visualizer analysis lease 只提交去重后的 0–4 个 `FeatureId`。第五项在 Coordinator 前返回 typed validation error；多个参数共享一个 feature 不增加活动数。
- Visualizer 只按绝对播放时间采样 compact series，不建立 30Hz exact cursor polling。换歌、route、template 或 binding revision 变化使旧响应 stale。

### Project, binding and scene contracts

- `VisualizerProjectV1`、strict codec、歌曲 identity、单草稿和原子导入见 [Visualizer Project Format V1](visualizer/project-format-v1.md)。
- constant/analysis/editor-event 联合、向量投影、确定性变换、四特征 planner、两个 scene descriptor 与 renderer host 见 [Binding and Scene Contracts](visualizer/binding-and-scene-contracts.md)。
- 模板 registry 必须穷尽参数并提供 scene factory。renderer 只能接收已经解析的逐帧值、绝对时间、binding revision 和 seed，不能访问 store、Worker、Editor DB、音频节点、exact cursor 或任意脚本；父级同帧只解析一次参数并让 scene/inspector 共享同一只读 map。

### Recording contracts

```ts
type VisualizerRecordingState =
  | { status: 'idle' }
  | { status: 'preparing' }
  | { status: 'recording'; startedAtContextTime: number }
  | { status: 'finalizing' }
  | { status: 'ready'; mimeType: string; byteLength: number }
  | { status: 'error'; code: string; message: string }
```

- `AudioEngine.acquireRecordingTap()` 返回唯一 pre-Gain audio stream lease；第二持有者必须失败，release 对称停止/断开录制节点而不影响 destination 播放。
- recorder 只进行 VP9+Opus 到 VP8+Opus codec fallback，不改变用户选择的分辨率/fps。preflight、状态机、锁定动作、比特率和 Blob 生命周期见 [Recording Contract](visualizer/recording-contract.md)。
- `VisualizerSessionSnapshot.recording` 只保存可序列化状态；MediaRecorder、MediaStream、tracks、capture lease 和 Blob 均由 controller 内存运行时持有，不进入 Pinia、JSON V1 或 IndexedDB。
- RendererHost recording capture lease 临时使用 preset 原生 backing size/DPR 1并同步绘制首帧；释放后恢复最新响应式预览尺寸。该 lease 不创建 Canvas、renderer 或 RAF。
- preparing 失败恢复录制前 playback checkpoint；recording/finalizing 取消或错误停在当前时间 paused。UI 与命令层共同执行 `recording-locked`。

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017，并同意进入 V1–V6 execution planning。本节据此为 `approved`，但不是实现或 quality evidence。
