# 音频播放与分析

## 当前播放与离线分析链路

M5 实现后的已证实链路：

1. MusicBar 调用 `selectAndImportFiles()`；service 使用 `showOpenFilePicker()` 获取本地 MP3/WAV/FLAC 句柄，不使用隐藏 input fallback。
2. service 顺序计算 SHA-256，并用 `music-metadata.parseBlob()` 生成可序列化 `TrackRecord`；runtime registry 保存 File、handle 与可选封面对象 URL。
3. 空队列导入自动播放首项；非空队列导入只追加，不打断当前歌曲。
4. `SessionRepository` 把最近队列、全部句柄和唯一 current Blob 写入原生 IndexedDB；切歌在同一事务替换 current Blob/cache。
5. `playTrack()` 先把 current track 与 persistence 状态发布为 `saving`，再读取 File ArrayBuffer；command generation 保证快速切歌最后操作生效，只有当前 generation 的持久化完成/失败可以更新 store。
6. AudioEngine 发布 `PlaybackSnapshot`；service 的单一 RAF 从 AudioContext 基准刷新时间，并从 Analyser 时域数据提取 Meyda energy。
7. `audioSessionStore` 把播放、恢复快照与能量提供给 MusicBar 和 Home；MusicBar 不拥有播放事实、浏览器资源或播放 RAF。

## AudioEngine 状态模型

`src/audio/audioEngine.ts` 的节点链路为：

```text
AudioBufferSourceNode → AnalyserNode → GainNode → audioContext.destination
```

- AudioContext、Gain、Analyser 和 AudioBuffer 延迟创建；一次 app session 只有一个实时 AudioContext。
- AudioBufferSourceNode 是一次性的；每次恢复或播放中 seek 都创建新 source。
- `playbackOffsetSeconds` 保存暂停/跳转位置，`playbackStartContextTime` 配合 AudioContext `currentTime` 计算进度。
- 主动停止先清空 source 的 `onended`，不会触发自动下一首；自然 ended 只发布一次。
- `load()` 与 session command 都使用 generation；旧读取或旧解码不得覆盖最新歌曲。
- decode/context/source/unsupported 失败写入 typed snapshot error；状态不得卡在 loading。
- `dispose()` 停止 source、断开节点并关闭上下文，不立即创建替代上下文。

## AudioSessionService 与队列

- service 是 runtime File、封面对象 URL、AudioEngine 订阅、单播放 RAF 和 ended 循环的唯一所有者。
- store 只保存 TrackRecord、current ID、PlaybackSnapshot 和 energy；`$state` 必须可 JSON 序列化。
- next/previous 使用循环索引；自然 ended 自动播放下一项。
- 删除非当前项不影响播放。删除当前项后播放同位置的下一项；没有下一项则使用上一项。
- 清空进入 `empty`，停止播放、取消 RAF、归零能量并释放全部封面 URL。
- metadata 失败使用文件名与默认封面继续解码。
- decode/unsupported 由 MusicBar 监听 snapshot error 并显示 Element Plus 非阻塞消息；队列、下一首和重试仍可用。
- 音频解码不创建对象 URL；对象 URL 只用于内嵌封面。

Editor E1 已通过 tokenized playback/analysis lease 临时使用 repeat-one并复用现有 service/coordinator；18/18 canonical 与 owner 签字已批准。E2 已通过 Editor consumer 请求唯一 Buffer 与 retained-PCM tempo estimate，并以 generation/hash/config 和用户 revision 丢弃 stale 结果；22/22 clean canonical 为 `in-review`。单 engine、单播放 RAF、离页恢复 queue-next 与单 Worker 事实保持不变。

## 最近会话恢复

- `initialize()` 先恢复序列化队列；current Blob 优先解码并固定为 0 秒 paused，不自动播放。
- 其他曲目按下一、上一、下二、上二的扩展顺序调用 `queryPermission()`；初始化绝不调用 `requestPermission()`。
- prompt/denied 由列表显示“恢复访问”，missing/changed 显示“重新选择”；重新选择只接受与原记录 SHA-256 相同的内容。
- IndexedDB quota/事务失败不停止当前内存播放，并发布 `not-persisted`；未知 schema 发布 `unsupported-schema`，只在用户点击后清除旧会话。
- M6 已接入真实 current analysis payload：初始化恢复完整身份匹配的 cache，partial hit 只把缺失 feature 送入 Worker；持久化失败显示 `not-persisted` 但不停止播放或丢弃内存结果。

## M6 全曲分析

- `FeatureRegistry` 穷尽映射 21 项；M6 Worker 仅声明 RMS、Energy、Amplitude Spectrum、Chroma 支持，默认活动集为空且每个 job 最多四个唯一特征。
- AudioEngine 通过 descriptor 与 16,384 sample 分块 copy 输出 average-mono PCM；copy 期间 decoded revision 改变时立即视为 stale。
- module Worker 使用 frame 1024、hop 512、Hanning 和实际 sample rate；同一 frame 的活动项一次 Meyda batch，最多每 32 frame 或约 8ms 发布进度并 yield/cancel。
- display series 限制为 ≤30 samples/s，通过六类 binary compact payload 存储；decoder 校验 schema、完整身份、维度、量化范围、对齐和尾随字节。
- AnalysisCoordinator 以 generation + track/content/config/feature 完整身份隔离 stale 结果，拥有取消、重试、partial cache 合并与 exact cursor。exact cursor 由 Worker 对原始 frame 现场提取，不能使用反量化 display 值。
- 全 cache hit 使用 0-feature job 只把当前 mono PCM 保留到 Worker，不重复 Meyda 提取；因此刷新命中后 exact cursor 仍可用。默认活动集为空时不复制 PCM、不创建 Worker。
- 当前 Meyda `spectralFlux` 仍会抛出 `x is not defined`；M6 以 R-020/预期失败测试记录。M8 已按 ADR-0005 使用项目内相邻幅度频谱正向 L1 差，不 patch Meyda；clean canonical 28/28 已缓解产品阻断，但上游缺陷不得表述为已修复。

## MusicBar 交互边界

- `canSeek` 要求队列非空、状态为 paused/playing/ended 且 duration 大于 0。
- 拖动开始时若正在播放则暂停；拖动结束后按秒 seek，并仅在拖动前播放时恢复。
- UI 进度来自共享 snapshot；不得创建第二个进度 RAF 或累计 RAF delta。
- `configStore.volume` 仍保存 0–100；service 转成 0–1 Gain 并在 snapshot 中发布实际值。
- 三种视觉样式、CSS 几何、GSAP 跑马灯和列表开合仍由 MusicBar 拥有。

## 能量处理

- Meyda 输入来自唯一 AudioEngine 的 `AnalyserNode.getFloatTimeDomainData()`。
- service RAF 发布原始 energy；MusicBar watch 使用上升 0.5、下降 0.05 的系数平滑灯带。
- `mapEnergyToDeg()` 将能量非线性映射到矩形半周对应的 180–360 度。
- 暂停、错误、清空和 dispose 时 service 停止 RAF 并把共享能量归零。
- style 1 的循环渐变由 GSAP 时间线独立驱动，不是音频能量。

## 测试数据与失败路径

- 优先使用仓库 CC0 短 fixture；损坏音频和 65 秒计时 WAV 在忽略目录运行时生成。
- 单元测试使用可注入 AudioContext factory 与 fake clock，覆盖 load/play/pause/seek/ended/stale/error/unload/dispose。
- service 测试覆盖追加、最后操作、ended、删除、清空、metadata fallback、序列化和 URL/RAF 生命周期。
- Chrome E2E 覆盖三格式、错误恢复、队列操作、20 次切歌、route 变化、能量和 60 秒时钟。
- M5 Vitest 覆盖 validator、hash、事务替换/abort、权限状态和恢复顺序；Chrome E2E 用 OPFS 真句柄覆盖 IndexedDB 刷新与 current Blob。原生 OS picker 的权限、恢复访问和文件移动已由 `project-owner` 于 2026-07-29 人工检查通过；Edge 权限矩阵仍未完成。
- 2026-08-25 已检测到 Microsoft Edge 151.0.4129.107；只有真实 `msedge` channel 自动化和 Edge 原生权限人工签字完成后，才能表述为双浏览器完成，安装检测本身不构成证据。
- M6 专项测试覆盖 registry/config/PCM/frame/codec、Worker 0/1/4 和异常、coordinator/cache/stale/quota、真实 Chrome Worker/刷新/exact cursor、20 次资源循环与 15 分钟 OPFS 性能/取消。
