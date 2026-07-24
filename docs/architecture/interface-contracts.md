---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/architecture/system-design.md"
next_action: "实现时用 TypeScript 类型、runtime validation 和契约测试固化这些边界"
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
}
```

Invariants:

- 注册表对全部 `FeatureId` 穷尽且 key 唯一。
- `meydaKey` 必须与当前 Meyda 版本支持的提取器匹配。
- renderer 与 payload shape 的映射通过编译期类型和 runtime assertion 验证。

## AnalysisSeries

```ts
type CompactPayload =
  | { kind: 'scalar-f32'; values: Float32Array }
  | { kind: 'quantized-u16'; values: Uint16Array; width: number; scale: number; offset: number }
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
  payload: CompactPayload
}
```

Invariants:

- `sampleCount * payload width` 与 typed-array 长度必须一致。
- 展示结果最多 30 samples/second；不能把逐 hop 原始频谱作为长期 payload。
- 量化的 scale/offset 必须可确定性反解，黄金测试覆盖边界和饱和行为。
- 缓存 key 为 `${trackHash}:${configHash}:${featureId}`。

## Worker Messages

```ts
interface AnalysisJobRequest {
  kind: 'analyze'
  jobId: string
  generation: number
  trackHash: TrackHash
  config: AnalysisConfig
  featureIds: readonly FeatureId[] // 0..4, unique
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

## ActiveAnalysisCard

```ts
interface ActiveAnalysisCard {
  slot: 0 | 1 | 2 | 3
  featureId: FeatureId
}
```

Invariants:

- `slot` 和 `featureId` 各自唯一。
- 数组最多四项；顺序由 slot 决定。
- 换卡保留共享 viewport，不创建新的播放或分析 session。

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

## PersistedSessionV1

```ts
interface PersistedSessionV1 {
  schemaVersion: 1
  savedAt: string
  queue: TrackRecord[]
  currentTrackId: TrackId | null
  activeCards: ActiveAnalysisCard[]
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
- schema version 未识别时进入可恢复错误，不能尝试猜测字段。

## Session Repository Results

Repository 不通过异常表达预期权限状态：

```ts
type RestoreResult<T> =
  | { ok: true; value: T; source: 'blob' | 'handle' | 'cache' }
  | { ok: false; state: Exclude<RestoreState, 'available'>; recoverable: boolean; detail?: string }
```

程序错误、数据库损坏和事务失败可以抛出 typed error；`prompt`、`denied`、用户取消和缺失文件必须返回显式状态供 UI 表达。
