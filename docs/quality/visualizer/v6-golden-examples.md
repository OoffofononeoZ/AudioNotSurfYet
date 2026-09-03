---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v6-eval-plan.md"
  - "docs/quality/visualizer/v5-golden-examples.md"
next_action: "生成 visualizer-v6-hardening.v1.json 并由 V6 unit/browser/media 专项消费"
---

# Visualizer V6 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V6-G01 | success | Chrome/Edge 导入同源 WAV/MP3/FLAC | 三项均成为精确当前歌曲，可进入 Visualizer 并在刷新后回到 0 秒 paused | 固定 AC-V601 格式与恢复基线 |
| V6-G02 | success | WAV + 同歌 Editor point/range + Orthogonal | Editor snapshot 生效，默认 720p30 保存为有声 WebM | 覆盖 Editor 到视频的完整任务 |
| V6-G03 | success | MP3 + 四特征 Cube | active set 恰为 Amplitude Spectrum、Complex Spectrum、Buffer、Loudness；分析 ready 后可录制 | 固定容量上限和最重项目 |
| V6-G04 | transition | 四特征 Cube → 双特征 Orthogonal → Cube | active set 为 4→2→4；无第五项、第二 Worker 或旧结果污染 | 固定模板引用释放和恢复 |
| V6-G05 | failure | FLAC 当前歌曲导入另一歌曲的 Visualizer/Editor JSON | 原子拒绝，当前工程、草稿和播放不变 | 固定错歌隔离 |
| V6-G06 | capacity | 900 秒 OPFS WAV + 四特征 Cube | 分析进度单调；交互/时钟/长任务满足阈值；离页取消并释放 | 固定 AC-V603 |
| V6-G07 | lifecycle | 20 次 route/template/song restore/record 循环 | singleton 上限不变；Observer/listener/track/Blob URL 回基线 | 固定 AC-V604 |
| V6-G08 | exception | 每五轮触发 context loss/restore | 原 host 恢复；活动录制暂停并丢弃半文件；无第二 Canvas/renderer | 固定 R-039 前向回归 |
| V6-G09 | failure | bad JSON、quota、stale analysis、无 MIME、recorder/renderer error | typed 可恢复状态；未受影响能力保留；绝不出现 ready 半文件 | 固定 AC-V605 |
| V6-G10 | boundary | 1024/1280/1920、DPR 1/2、reduced motion | 16:9、抽屉/三栏、焦点和文字状态正确；场景主动播放不被关闭 | 固定布局和动效边界 |
| V6-G11 | media | Chrome/Edge × WAV/MP3/FLAC 默认输出 | 至少六个 1280×720、30fps、单视频+单 Opus 音频 WebM 全部通过媒体检查 | 固定三格式录制事实 |
| V6-G12 | capability | optional preset 支持或不支持 | 支持则真实输出合格；不支持则 tap/capture/recorder 前返回 `preset-unavailable` | 防止静默降级或事后改判 |

版本化 golden 只保存 fixture manifest identity、虚构 project、seed、四特征 binding、预期 active-set 转换和媒体期望；不保存用户文件、15 分钟音频、大型 WebM、trace 或设备标识。
