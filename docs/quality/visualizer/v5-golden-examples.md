---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v5-eval-plan.md"
  - "docs/architecture/visualizer/recording-contract.md"
next_action: "V5 fixture、golden、canonical WebM 与 owner 门禁已批准；作为 V6 基线保留"
---

# Visualizer V5 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V5-G01 | success | 页面音量 0、720p30、Cube 默认两项分析 ready | Chrome/Edge 均输出有声 WebM；页面监听静音不改变 pre-Gain 音轨 | 固定 AC-V501 默认路径 |
| V5-G02 | success | VP9/Opus 与 VP8/Opus 均支持 | 只选择 VP9/Opus | 固定 codec 优先级 |
| V5-G03 | boundary | 只有 VP8/Opus 支持 | 保持用户 preset，仅回退 codec；不移除音轨 | 固定唯一允许的 fallback |
| V5-G04 | failure | 两种 MIME 均不支持或 captureStream 缺失 | 在 pause/seek 前进入 typed error；工程和播放状态不变 | 防止伪成功与无声降级 |
| V5-G05 | failure | preparing 中 video/audio track、尺寸或帧率不满足 | 释放已取得资源，恢复录制前时间及 paused/playing/ended 状态 | 固定准备回滚 |
| V5-G06 | success | paused 2.1s 开始录制 | pause→seek0→render0→recorder start→play；歌曲自然结束后 ready | 固定唯一时钟和首帧 |
| V5-G07 | boundary | recording 时调用 seek/template/binding/output/import | UI disabled；命令层抛 `recording-locked`；工程不变 | 防止只做表面锁定 |
| V5-G08 | exception | recording 1.4s 时主动取消 | 停在约 1.4s paused；tap/stream/tracks/capture 归零；无 ready Blob | 固定活动取消语义 |
| V5-G09 | exception | context loss、renderer fatal、track ended、identity change 或 recorder error | 当前时间 paused，未完成 chunks 丢弃，进入可恢复 error | 防止半文件 |
| V5-G10 | success | ready Blob 保存成功 | 原生 gateway 写入 `.webm`；Blob 释放并回到 idle | 固定保存所有权 |
| V5-G11 | failure | picker cancel 或 writable failure | 保持 ready Blob；工程/draft 不变；允许再次保存 | 固定保存重试 |
| V5-G12 | boundary | 活动录制或 ready Blob 时离页 | 站内对话框要求取消录制、保存、丢弃或留页；无静默丢失 | 固定离页决策 |
| V5-G13 | media | 3 秒 fixture、1.5 秒 Hann burst 与同时间 Orthogonal flash | ffprobe 轨道/codec/尺寸/fps/时长通过；A/V 事件差 `<=100ms` | 固定可测同步 |
| V5-G14 | lifecycle | 20 次 prepare/cancel/error/ready/discard | AudioContext、RAF、Canvas、renderer 恒定；tap/recorder/track/Blob 回到 0 | 固定资源对称性 |

Golden fixture 固定为 48kHz、mono、3 秒 CC0 WAV：0.1–2.9 秒低电平 220Hz tone bed，1.5 秒开始叠加 50ms Hann-windowed 1kHz burst；同歌 Editor point 在 1.5 秒驱动 Orthogonal 横纵亮度。Cube 默认 Spectrum+Energy 工程用于动态录制和 preflight，不改变 sync fixture 的事件定义。
