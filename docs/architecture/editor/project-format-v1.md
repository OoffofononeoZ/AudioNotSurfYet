---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "E9 删除内部 tempo boundary 继续使用 JSON V1 数组删除语义；验证 round-trip 与事件秒数稳定"
---

# Editor Project Format V1

## Purpose and Boundary

`EditorProjectV1` 是单首本地歌曲的逆向标注工程。它保存 tempo、point/range 事件和工作区，不保存 File/handle、绝对路径、Blob、PCM、分析 cache 或播放状态。首版文件名为 `<歌曲名>.audiosurf-editor.json`，MIME 为 `application/json`；首版 format registry 只注册 JSON。

## Schema

```ts
type EditorSeconds = number
type EditorId = string
type MeterDenominator = 1 | 2 | 4 | 8 | 16 | 32

interface EditorProjectV1 {
  format: 'audiosurf-editor'
  schemaVersion: 1
  projectId: EditorId
  createdAt: string
  updatedAt: string
  track: {
    contentHash: string
    fileName: string
    title?: string
    artist?: string
    durationSeconds: EditorSeconds
    sampleRate?: number
  }
  tempoMap: TempoSegmentV1[]
  lanes: EditorLaneV1[]
  workspace: {
    viewport: PersistedTimelineViewport
    overlay: {
      featureId: FeatureId | null
      topRatio: number
      heightRatio: number
    }
  }
}

type TempoSegmentV1 = MeteredTempoSegmentV1 | SingleBeatTempoSegmentV1

interface MeteredTempoSegmentV1 {
  id: EditorId
  startSeconds: EditorSeconds
  mode: 'metered'
  bpm: number | null
  bpmSource: 'unset' | 'estimated' | 'user'
  meter: {
    numerator: number
    denominator: MeterDenominator
  }
}

interface SingleBeatTempoSegmentV1 {
  id: EditorId
  startSeconds: EditorSeconds
  mode: 'single-beat'
}

interface InnerClassV1 {
  id: EditorId
  label: string
}

interface PointLaneV1 {
  id: EditorId
  name: string
  eventKind: 'point'
  innerClasses: InnerClassV1[]
  events: PointEventV1[]
}

interface RangeLaneV1 {
  id: EditorId
  name: string
  eventKind: 'range'
  innerClasses: InnerClassV1[]
  events: RangeEventV1[]
}

type EditorLaneV1 = PointLaneV1 | RangeLaneV1

interface PointEventV1 {
  id: EditorId
  innerClassId: EditorId
  atSeconds: EditorSeconds
}

interface RangeEventV1 {
  id: EditorId
  innerClassId: EditorId
  startSeconds: EditorSeconds
  endSeconds: EditorSeconds
}
```

## Canonical Encoding

- 所有时间经 `round(value * 1_000_000) / 1_000_000` 规范为微秒精度；比较容差固定为 `1e-6` 秒。编码器拒绝非有限数和规范化后越界/坍缩的数据。
- 顶层字段、nested 字段和数组顺序按上述 schema 输出；JSON 使用两个空格缩进并以换行结尾。ID 和用户标签不重写。
- tempo segment 按 `startSeconds`，lane 按用户顺序，inner class 按用户顺序，event 按时间再按 ID 排序。decode 不依赖源 JSON 属性顺序，encode 产生确定性顺序。
- `createdAt` 在首次工程创建时固定，`updatedAt` 只由成功的内存变更推进；测试通过注入 clock 保持确定性。
- `durationSeconds` 从当前已解码 track 建立；export 不重新探测或更改歌曲身份。

## Validation Invariants

### Envelope and track

- 只接受精确 `format`/`schemaVersion`；未知版本拒绝，不猜测迁移。
- 所有 ID 是非空字符串，并在整个 project 中唯一，避免 lane 或 event 移动后身份冲突。
- ISO timestamp 必须可解析，且 `updatedAt >= createdAt`。
- `contentHash` 是当前 session track 的 SHA-256；导入时 hash 不同立即拒绝。同内容的不同 session `trackId` 可以接受，因为 `trackId` 不进入工程文件。
- `durationSeconds > 0`；可选 sample rate 必须是有限正整数。导入工程与当前解码时长差异超过 `max(1e-6, 1 / currentDecodedSampleRate)` 时拒绝，不依赖工程中可选 sample rate 的存在。
- validator 拒绝 schema 未声明字段，避免拼写错误或未来字段被静默忽略。

### Tempo map

- 至少一个 segment；第一段规范化后从 0 开始。后续 start 严格递增且 `< track.durationSeconds`；segment 结束由下一段或歌曲时长派生。
- metered meter numerator 是 1–32 的整数，denominator 属于固定联合。初始工程为 `4/4`、`bpm: null`、`bpmSource: 'unset'`；输入中的 `100` 只是 UI placeholder，不冒充识别结果。
- metered BPM 为 `null` 或 20–300 的有限数。`null` 只允许 `bpmSource: 'unset'`；estimated/user 必须有合法 BPM。
- UI 输入 `0 <= bpm < 20` 时把 segment 整体规范为 `single-beat`，不在 schema 中保留无意义的 meter/BPM。负数、非数字、Infinity 和大于 300 拒绝。
- 新增内部 boundary 继承前一 segment 的规范值；移动 boundary 只改变 tempo 区间，不移动已有 event 秒数。E9 删除内部 boundary 时从 `tempoMap` 移除目标 segment，前一 segment 自然延伸到下一 start 或歌曲结尾；首 segment 不可删除，point/range 秒数保持不变。

### Lanes and events

- lane 名称、inner class label 去除首尾空白后必须非空。每个 lane 至少一个 inner class；新 lane 创建稳定 `default` ID 和可见 label。
- 含引用事件的 inner class 不能直接删除；调用方必须先删除事件或显式迁移到同 lane 的另一 inner class。
- point event 满足 `0 <= atSeconds <= duration`；同 lane、inner class 和规范化时间至多一个。
- range event 满足 `0 <= startSeconds < endSeconds <= duration`。duration 始终派生，不单独保存。
- range 使用半开区间 `[start, end)`；同 lane/inner class 中 `next.startSeconds >= previous.endSeconds` 合法，相交则拒绝。不同 lane/inner class 可重叠，point 可位于 range 内。
- 网格只约束交互创建/拖动。tempo 后续变化不移动事件，因此导入 validator 不以“仍落在当前网格”作为有效性条件。

### Workspace

- viewport 数值有限且满足 `0 <= start < end <= duration`、`zoom > 0`；cursor 不持久化。
- overlay feature 为 `null` 或 21 项 `FeatureId`；`0 <= topRatio < 1`、`0 < heightRatio <= 1` 且 `topRatio + heightRatio <= 1`。

## Codec Registry and Import Boundary

首版 registry 恰好包含：

```ts
{
  id: 'json-v1',
  label: 'JSON',
  extension: '.audiosurf-editor.json',
  mimeType: 'application/json'
}
```

导入顺序固定为：读取 bytes → UTF-8/JSON parse → strict schema validation → current track hash/duration validation → 生成完整候选对象 → 单次替换内存工程 → autosave。用户取消、parse/schema/hash/时间/引用/重叠失败均不改变内存工程或 durable draft。

导出只读取已验证的当前内存工程，经 canonical encoder 产生 bytes，再交给用户选择的 save handle。保存取消不清除 dirty 状态；写入失败显示错误并保留工程。

## Draft Repository

独立 IndexedDB：

- database：`audionotsurfyet-editor`
- version：`1`
- object store `draft`，固定 key `latest`
- object store `preferences`，固定 key `leave-warning`

```ts
interface EditorDraftEnvelopeV1 {
  schemaVersion: 1
  savedAt: string
  project: EditorProjectV1
}
```

- `replace()` 在单一 readwrite transaction 写入完整 envelope；abort/quota 保留旧 durable record。
- controller 内存工程先更新，并把 autosave 合并为单个 in-flight write 加最新 pending snapshot。pointerup、表单确认、导入完成和 route leave 请求立即 flush。
- 同 hash 草稿自动恢复；不同 hash 先要求“导出旧工程 / 覆盖旧草稿 / 取消”。导出成功后仍需明确继续覆盖；该确认不可关闭。
- `leave-warning` 只控制普通离开 Editor 的建议提示，不控制跨歌曲确认。`beforeunload` 只在 pending/in-flight write 存在时注册。
- draft decode 失败进入可清除错误，不覆盖当前内存工程；session database、queue、handle、current Blob/cache 均不受影响。

## Alternatives Rejected

| Alternative | Reason rejected |
| --- | --- |
| 名称作为 JSON object key | 重名、重命名和顺序会改变 identity；稳定 ID + ordered arrays 更安全 |
| range 保存 start + duration | 端点拖动和重叠校验需要反复派生；明确 start/end 更符合两端手柄语义 |
| beat/bar 作为 event identity | tempo 修改会移动原音频中的标注事实；秒数必须保持稳定 |
| 扩展现有 session IndexedDB V1 | 会使 Analyzer 已验证 schema 和 Editor 草稿故障相互影响 |
| 导入时尽量修复未知/损坏字段 | 可能无声改变用户标注；首版选择拒绝并保留当前工程 |

## Approval

本契约于 2026-08-26 随 Editor system design 创建，并由 `project-owner` 随后批准进入 E1–E6 execution planning。E1 只能在 delivery 获批后把它实现为 TypeScript 类型、validator、codec 和 repository；源码存在本身不能替代 schema round-trip、failure 和 boundary evidence。

2026-09-04 的 ADR-0019 只增加现有 `tempoMap` 数组的内部 segment 删除命令，不新增字段、迁移或 fallback；既有 V1 文件可无转换直接读取。
