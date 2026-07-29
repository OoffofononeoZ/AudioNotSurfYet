# 音频播放与分析

## 当前播放链路

M4 后的已证实链路：

1. MusicBar 创建 `<input type="file">`，把本地 MP3/WAV/FLAC 交给 MainLayout 提供的 `AudioSessionService`。
2. service 用 `music-metadata.parseBlob()` 生成可序列化 `TrackRecord`，在 runtime registry 保存 File 与可选封面对象 URL。
3. 空队列导入自动播放首项；非空队列导入只追加，不打断当前歌曲。
4. `playTrack()` 读取 File ArrayBuffer，使用 command generation 保证快速切歌最后操作生效，再调用唯一 `AudioEngine` 解码和播放。
5. AudioEngine 发布 `PlaybackSnapshot`；service 的单一 RAF 从 AudioContext 基准刷新时间，并从 Analyser 时域数据提取 Meyda energy。
6. `audioSessionStore` 把快照与能量提供给 MusicBar 和 Home；MusicBar 不再拥有播放事实或播放 RAF。

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
- 当前 Edge 未安装；Chrome 结果不能表述为双浏览器完成。
