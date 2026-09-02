---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "在 V5/V6 delivery planning 中映射录制状态机、严格预设、能力检测和 WebM 证据；规划批准前不实现"
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

## Preflight

进入 `recording` 前必须同时满足：

- 当前 route/playback lease 仍指向工程歌曲，AudioBuffer 已解码且 duration/hash 匹配。
- 当前 template、全部 binding 和 Editor snapshot 校验通过。
- 去重后的 0–4 个 analysis feature 全部 ready；没有中性占位或 binding-local error。
- renderer ready、context 未丢失、Canvas origin-clean，selected size/fps 可建立 capture stream。
- MIME 选择成功，pre-Gain audio stream 含一个 live audio track，Canvas stream 含一个 live video track。
- 当前没有另一个 recording tap、MediaRecorder、未处理 ready Blob 或 route transition。

preflight 失败保留工程、预览和播放能力；若失败发生在为录制做的 pause/seek 前，播放状态不变。

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
5. 先 `MediaRecorder.start()`，确认进入 recording，再调用现有 AudioSessionService `play()`。
6. renderer 使用同一播放时钟和单 RAF；不以 recorder callback 或 frame count 推进场景。
7. 歌曲自然 ended 进入 `finalizing`，停止 recorder；Visualizer `pause-at-end` 不调用 next。
8. 收到最终 data/stop 后验证 tracks/chunks，释放 stream/tap，生成一个内存 Blob 并进入 `ready`。

录制期间锁定 seek、play/pause、template、binding、Editor reload、resolution 和 fps。普通 inspector 浏览、焦点和取消仍可用。锁定不是只禁用按钮：命令层也必须拒绝并返回 typed `recording-locked`。

## Cancel, Leave and Save

- 用户取消或确认离页时停止 MediaRecorder/streams、释放 tap、丢弃 chunks/未完成 Blob，并恢复可编辑状态；不产生可保存的半文件。
- WebGL context loss、track ended、MediaRecorder error、route/song identity 变化或 renderer fatal error 都进入 error，丢弃未完成结果并保留工程。
- `ready` Blob 只在内存中保留。用户通过原生保存选择器写出 `.webm`；选择器取消不丢 Blob，可再次保存。
- 开始新录制或离开 Visualizer 前必须显式丢弃/保存现有 ready Blob；release 时移除任何 object URL。
- 工程 JSON 与 recording Blob 完全分离；保存视频失败不修改工程或 durable draft。

## Verification Boundary

V5/V6 必须用 ffprobe/FFmpeg 和 Chrome/Edge 回放验证容器、codec、音轨、尺寸、帧率、时长与音画同步。目标漂移不超过 100ms。设备或浏览器无法满足某预设时，evidence 必须记录该预设 unavailable；不能把另一个预设的通过外推为全部通过。

规范依据：

- [Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/)
- [Web Audio API](https://www.w3.org/TR/webaudio-1.0/)
- [MediaStream Recording](https://www.w3.org/TR/mediastream-recording/)

## Approval State

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。本录制契约据此为 `approved`，但只允许制定 V5/V6 delivery 与后续 eval；不代表当前浏览器、机器或 `/comingsoon` 已满足录制能力。
