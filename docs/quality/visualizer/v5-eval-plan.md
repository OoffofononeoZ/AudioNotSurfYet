---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/visualizer/recording-contract.md"
  - "docs/architecture/risk-register.md"
next_action: "V5 canonical 与人工门禁已批准；保持为 V6 前向回归基线"
---

# Visualizer V5 Eval Plan

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V5-EV-TAP | pre-Gain recording tap | success + failure | AudioEngine unit/integration + decoded WebM amplitude | 单 holder；页面 0 音量仍有原始音轨；release 不改变 destination 播放 | AC-V501；R-040 |
| V5-EV-CAPABILITY | preset/MIME capability | boundary + failure | pure capability table + Chrome/Edge | 只允许 VP9+Opus→VP8+Opus；默认 720p30 双浏览器通过；其他 preset 为 pass 或录制前 typed unavailable | AC-V502/V509；R-040/R-041 |
| V5-EV-PREFLIGHT | 原子 preflight | failure + exception | coordinator integration + browser fault injection | route/decode/project/analysis/renderer/track/MIME 任一失败均不改变工程；准备失败恢复原时间与状态 | AC-V503；R-034/R-040 |
| V5-EV-SEQUENCE | 实时录制顺序和 ended | success | fake recorder event log + real browser | pause→seek0→render0→start invocation/time-zero play handshake；start event 后才发布 recording；自然 ended 后 finalize，不调用 next | AC-V504；R-034/R-040 |
| V5-EV-LOCK | 双层命令锁 | boundary | controller matrix + keyboard/DOM E2E | preparing/recording/finalizing 时所有身份变更在 UI disabled 且命令层返回 `recording-locked` | AC-V505；R-040 |
| V5-EV-ABORT | cancel/context/track/recorder cleanup | failure + exception | fault injection + diagnostics | 未完成 chunks 丢弃，ready Blob 为 0，tap/stream/track/capture lease 全部释放；活动失败停在当前时间并暂停 | AC-V506；R-039/R-040 |
| V5-EV-SAVE | ready Blob 与离页 | success + failure | gateway integration + route dialog E2E + owner native task | save 成功后 idle；picker cancel/write failure 保留 Blob；离页必须明确保存/丢弃/取消录制 | AC-V507；R-036/R-040 |
| V5-EV-MEDIA | WebM 文件事实 | success | ffprobe JSON + FFmpeg PCM/frame extraction | 一音一视频、WebM、VP9/VP8+Opus、尺寸、fps、时长和同步均满足阈值 | AC-V501/V508；R-040/R-041 |
| V5-EV-RESOURCE | 单链路生命周期 | lifecycle + performance | 20 次 fake lifecycle + Chrome/Edge diagnostics | 无 AudioContext/RAF/Canvas/renderer/tap/recorder/track/Blob 单调累积；反馈 `<=100ms`、Visualizer frame `<50ms` | AC-V501/V506/V509；R-039–R-041 |
| V5-EV-REGRESSION | V4 34 步与 V5 六专项 | regression | 40-step canonical | 六个 V5 专项及 V4 34 步全部通过；clean identity 起止一致 | AC-V501–V509；R-034–R-041 |

## Media Thresholds

- 每个成功输出必须是 WebM/Matroska，恰好一条 VP9/VP8 视频和一条 Opus 音频；宽高严格等于所选 preset。
- `avg_frame_rate` 与所选 30/60fps 偏差不超过 5%，且相邻视频 packet gap 不超过两个目标帧间隔。
- 容器、音频和视频时长与 3 秒 fixture 偏差均不超过 250ms；音视频结束时间差不超过 100ms。
- 页面音量 0 时仍能检测到 V5 burst；音频 RMS 峰与中心视频亮闪的事件时间差不超过 100ms。
- 已生成文件若不满足任何媒体阈值即为失败，不得追记为 `preset-unavailable`。optional preset 只有在 MediaRecorder 启动前返回 typed capability error 才可登记 unavailable。
- 当前 Chrome/Edge 的三个 optional preset 因重复真实样本不能稳定满足 packet-gap 门禁，在资源获取前登记 `preset-unavailable`；两者都必须验证强制默认 720p30 真实输出。该矩阵是当前实现证据，不是对未来浏览器版本的永久推断。

## Canonical Rule

- V5 六专项固定为 `fixtures:v5:golden`、`test:v5:unit`、`test:v5:integration`、`test:e2e:v5:chrome`、`test:e2e:v5:edge`、`test:v5:media`。
- `eval:v5:provisional` 允许 dirty worktree，只作为实现反馈；`eval:v5` 只在 clean implementation commit 上运行。
- V5 canonical 为 V4 固定 34 步基线加六专项，共 40 步。runner 记录 WebM SHA-256、capability matrix、ffprobe JSON、同步报告、浏览器/运行时/硬件和资源/性能指标。
- 2026-09-03 owner 已批准 canonical 与人工验收；V5 evidence 为 `approved`、V5 为 `Complete`、R-039/R-040 为 `Mitigated`。R-041 与 V6 final hardening 继续独立验证。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| 原生保存选择器不能由 OPFS 自动化替代 | 自动化 gateway 不覆盖 OS 权限/取消交互 | 文件可能无法在目标目录写入 | owner 在 Chrome/Edge 至少各执行一次真实保存、取消和重试 | project-owner |
| 短 fixture 不证明 15 分钟 1080p60 稳定性 | V5 只验证功能和能力矩阵 | 长录制可能掉帧或内存过高 | R-041 保持 Open；V6 执行 15 分钟四特征压力 | project-owner |
| synthetic context loss 不覆盖全部 GPU/驱动 | 浏览器注入只验证应用 cleanup | 特定驱动可能以不同顺序失败 | 双浏览器注入、明确 error、owner 实机观察；V6 长会话复核 | project-owner |
