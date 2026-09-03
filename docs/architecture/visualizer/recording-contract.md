---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "DEC-042/DEC-043 已开放 V5；实施状态机、严格预设、双浏览器与 WebM 证据"
---

# Visualizer Real-time WebM Recording Contract

## Purpose

V5 以歌曲原速从 0 秒录制 Visualizer 当前 16:9 Canvas 与原歌曲音频，生成本地 WebM。录制不是离线渲染，不支持后台标签页保证、MP4、服务端编码或静默降级分辨率/fps。

## Capture Topology

```text
AudioBufferSourceNode → AnalyserNode ─┬→ GainNode → destination
                                     └→ MediaStreamAudioDestinationNode

Visualizer Canvas → captureStream(fps) ─┐
pre-Gain audio stream ───────────────────┴→ MediaRecorder → Blob
```

- AudioEngine 是 recording tap 的唯一创建者。`acquireRecordingTap()` 使用 token 保证任意时刻只有一个 holder；第二次 acquire 返回 typed busy error。
- tap 位于 `AnalyserNode` 之后、页面 `GainNode` 之前，因此录制使用原歌曲音量。页面静音和 0–100 volume 只影响 destination，不改变导出文件。
- release 必须停止返回 stream 的 tracks、断开 destination node 并清除 token，但不能停止当前 AudioBufferSource、关闭 AudioContext 或改变页面音量。
- 视频只来自唯一 Visualizer Canvas 的 `captureStream(selectedFrameRate)`；不创建隐藏 canvas 或第二 renderer。

## Supported Presets and MIME

| Preset | Canvas size | Video bitrate |
| --- | --- | --- |
| 720p / 30fps | 1280×720 | 6 Mbps |
| 720p / 60fps | 1280×720 | 9 Mbps |
| 1080p / 30fps | 1920×1080 | 10 Mbps |
| 1080p / 60fps | 1920×1080 | 16 Mbps |

Opus audio bitrate 固定为 192 kbps。MIME capability 顺序：

1. `video/webm;codecs=vp9,opus`
2. `video/webm;codecs=vp8,opus`

只有 codec 可以按上述顺序回退。若所选分辨率/fps、Canvas capture、audio track 或 MediaRecorder 不能满足，preflight 明确失败；不得静默改为更低预设、无音频、不同 fps 或仅下载画面。

预设可用性包含“能否持续满足媒体质量门禁”，不只检查 API 是否存在。重复真实采样证明当前 Chrome/Edge 的 optional preset 会间歇超过两个目标帧间隔，因此 V5 只把强制默认 720p30 作为可靠输出，720p60/1080p30/1080p60 均在资源获取前返回 typed `preset-unavailable`。该限制不得伪装成录制后的降级，浏览器能力证据变化时才可修订。

## Preflight

进入 `recording` 前必须同时满足：

- 当前 route/playback lease 仍指向工程歌曲，AudioBuffer 已解码且 duration/hash 匹配。
- 当前 template、全部 binding 和 Editor snapshot 校验通过。
- 去重后的 0–4 个 analysis feature 全部 ready；没有中性占位或 binding-local error。
- renderer ready、context 未丢失、Canvas capture API 存在，selected size/fps 通过当前浏览器质量能力策略。
- MIME 选择成功，且 AudioEngine recording tap 当前没有 holder。
- 当前没有另一个 recording tap、MediaRecorder、未处理 ready Blob 或 route transition。

preflight 失败保留工程、预览和播放能力。进入 `preparing` 前先保存包含歌曲、秒数和 `paused/playing/ended` 的内存 playback checkpoint；live audio/video track、精确尺寸和 track frame-rate settings 在 `preparing` 获取资源后、构造 recorder 前验证。任何准备阶段失败或取消均恢复该 checkpoint。只有录制已经进入 `recording` 后的取消或错误才停在当前秒数并保持 paused。

## State Machine

```text
idle → preparing → recording → finalizing → ready
  └──────────────→ error ←───────────────┘
ready/error → idle
```

开始顺序固定：

1. 进入 `preparing` 并锁定输出身份相关编辑。
2. 记住进入前播放状态，暂停当前歌曲。
3. seek 到 0 秒，按绝对时间 0 解析 bindings 并绘制首帧。
4. 取得 audio tap、Canvas stream 和 MIME，构造 MediaRecorder。
5. 调用 `MediaRecorder.start()` 后，在 public state 仍为 `preparing` 时同时启动 time-zero audio handshake；Chrome/Edge 对 WebGL+WebAudio stream 需要首个 audio packet 才派发 recorder `start` event。只有收到该 event 后才发布 `recording`，任一握手失败仍按准备阶段 checkpoint 回滚。
6. renderer 使用同一播放时钟和单 RAF；不以 recorder callback 或 frame count 推进场景。
7. 歌曲自然 ended 进入 `finalizing`，停止 recorder；Visualizer `pause-at-end` 不调用 next。
8. 收到最终 data/stop 后验证 tracks/chunks，释放 stream/tap，生成一个内存 Blob 并进入 `ready`。

录制期间锁定 seek、play/pause、template、binding、Editor reload、resolution 和 fps。普通 inspector 浏览、焦点和取消仍可用。锁定不是只禁用按钮：命令层也必须拒绝并返回 typed `recording-locked`。

唯一 RendererHost 提供 recording capture lease：capture 期间现有 Canvas 使用 preset 原生 backing size 与 DPR 1，CSS 展示尺寸保持响应式；ResizeObserver 只记录待恢复的预览尺寸。首帧由 host 同步绘制且不新建 RAF，lease 释放后恢复最后观察到的预览尺寸。context loss 仍由同一 host 恢复预览，录制 coordinator 只负责终止并丢弃未完成结果。

## Cancel, Leave and Save

- 用户在 `preparing` 取消时停止已取得资源、丢弃 chunks 并恢复 playback checkpoint。用户在 `recording/finalizing` 取消时先暂停在当前时间，再停止 MediaRecorder/streams、释放 tap、丢弃 chunks/未完成 Blob并恢复可编辑状态；不产生可保存的半文件。
- WebGL context loss、track ended、MediaRecorder error、route/song identity 变化或 renderer fatal error 都进入 error，丢弃未完成结果并保留工程。
- `ready` Blob 只在内存中保留。用户通过原生保存选择器写出 `.webm`；选择器取消不丢 Blob，可再次保存。
- 开始新录制或离开 Visualizer 前必须显式丢弃/保存现有 ready Blob；release 时移除任何 object URL。
- 工程 JSON 与 recording Blob 完全分离；保存视频失败不修改工程或 durable draft。
- 活动录制离页使用站内“取消录制并离开/留在此页”决策；ready Blob 离页使用“保存并离开/丢弃并离开/留在此页”。保存 picker 取消或失败时继续留页并保留 Blob。浏览器 refresh/关闭使用 `beforeunload` 警告和 `pagehide` 最佳努力清理。

## Verification Boundary

V5/V6 必须用 ffprobe/FFmpeg 和 Chrome/Edge 回放验证容器、codec、音轨、尺寸、帧率、时长与音画同步。目标漂移不超过 100ms。设备或浏览器无法满足某预设时，evidence 必须记录该预设 unavailable；不能把另一个预设的通过外推为全部通过。

规范依据：

- [Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/)
- [Web Audio API](https://www.w3.org/TR/webaudio-1.0/)
- [MediaStream Recording](https://www.w3.org/TR/mediastream-recording/)

## Approval State

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。2026-09-03，owner 以 DEC-042/DEC-043 批准关闭 V4、开放 V5，并固定分阶段播放恢复与站内离页决策。本录制契约为 `approved`；只有 V5 双浏览器 canonical 和后续 owner 门禁才能证明当前实现满足能力。
