---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/visualizer/recording-contract.md"
next_action: "在 V5/V6 delivery planning 中固定 pre-Gain、codec-only fallback、严格预设与 WebM 证据；规划批准前不实现"
---

# ADR-0017: Real-time WebM Recording

## Context

Visualizer V5 需要录制同一 Canvas 和歌曲音轨。页面音量是本地监听偏好，不应改变导出；浏览器对 codec、分辨率/fps 和 MediaRecorder 能力存在差异，静默降级会让工程预设与文件不一致。

## Decision

- AudioEngine 只允许一个 pre-Gain recording tap：从 AnalyserNode 分支到 MediaStreamAudioDestinationNode。录制保持原歌曲音量，页面 mute/volume 不影响文件。
- 使用唯一 Canvas `captureStream(fps)` 与 audio tap 合并 MediaStream；MIME 只按 VP9+Opus 到 VP8+Opus 回退。
- 720p/1080p、30/60fps 是严格用户选择。所选组合不可用时明确失败，不静默降低分辨率、fps 或移除音轨。
- 录制先 preflight，再 pause/seek 0/render 0/start recorder/play；自然 ended 自动 finalize。录制期间锁定影响输出 identity 的命令。
- 完成 Blob 只在内存保存并通过原生 picker 写出；取消、离页、context loss 或 track/recorder error 丢弃未完成结果。

## Consequences

- Positive：页面监听音量与导出解耦，输出身份明确，支持情况可测。
- Negative：1080p60 可能在部分设备明确不可用；首版不能通过自动降级提高表面成功率。
- Failure boundary：没有完整 audio/video tracks、MIME、analysis ready 或 origin-clean canvas 时不得开始；未完成文件永不进入 ready。

## Alternatives Rejected

- 从 Gain 后录音：用户页面静音会生成静音视频，不符合原歌曲导出语义。
- 无法录制时自动改 720p30：工程预设与结果不一致，掩盖设备能力。
- 离线/倍速渲染或服务端编码：需要不同音频/场景时钟和产品范围。

## Approval

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。本 ADR 据此为 `approved`；详细比特率、状态机和保存边界继续以 [Recording Contract](../visualizer/recording-contract.md) 为准，V5 规划获批前不实现。
