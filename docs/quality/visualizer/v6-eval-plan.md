---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/risk-register.md"
  - "docs/quality/visualizer/v5-eval-plan.md"
next_action: "54 步 clean canonical 与 owner 人工门禁已批准；保持为 readiness 基线"
---

# Visualizer V6 Eval Plan

## Boundary

V6 只评价已批准 Visualizer 的最终加固：双浏览器三格式制作、两个既有模板、15 分钟四特征压力、故障隔离、无障碍、资源生命周期和累计回归。不新增模板、schema、route、录制拓扑、Worker、AudioContext 或产品 RAF，也不构成生产上线或整体 release-readiness 批准。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V6-EV-FORMAT | MP3/WAV/FLAC 完整制作 | success + failure | Chrome/Edge E2E + native task | 每种格式身份精确；有效 route、导入导出、刷新 paused、pause-at-end 与错歌拒绝成立 | AC-V601；R-034/R-036 |
| V6-EV-LAYOUT | 三视口与可访问性 | boundary | DOMRect/DPR + keyboard/focus/reduced-motion | 1024/1280/1920、DPR 1/2 无遮挡；状态不只靠颜色；核心任务可键盘完成 | AC-V602；R-038 |
| V6-EV-STRESS | 15 分钟四特征与时钟 | capacity + performance | OPFS runtime WAV + PerformanceObserver + renderer diagnostics | feedback `<=100ms`；播放/scene 偏差 `<=50ms`；Visualizer frame `<60ms`；分析归因任务 `<50ms` | AC-V603；R-035/R-037/R-041；DEC-048 |
| V6-EV-RESOURCE | 跨 workspace 生命周期 | lifecycle + exception | 20 次双浏览器循环 + test resource probe | live 资源回到 route 基线；单 AudioContext/Worker/Canvas/renderer/visual RAF；录制资源在非活动态归零 | AC-V604；R-034/R-038/R-040/R-041 |
| V6-EV-FAILURE | 完整故障矩阵 | failure + race + exception | fault injection + typed state assertions | context、stale/cancel、quota、错歌 Editor、坏 JSON、无 MIME、preset、recorder、renderer 均可恢复且不伪造成功 | AC-V605；R-035–R-041 |
| V6-EV-MEDIA | 六个默认 WebM 文件事实 | success + boundary | MediaRecorder + ffprobe/FFmpeg | Chrome/Edge × MP3/WAV/FLAC 至少六个 720p30 有声文件；平均 fps `±5%`，相邻 packet gap 最多四个目标帧间隔，其余结构/时长/音轨/A-V 门禁沿用 V5 | AC-V601/V606；R-040/R-041；DEC-048 |
| V6-EV-REGRESSION | V1–V6 与相邻系统 | regression | 54-step canonical | V5 40 步、V6 六专项、M6 四步和 M14 四步全部通过；无异常 console/pageerror | AC-V606；R-034–R-041 |
| V6-EV-EVIDENCE | 可审计候选与人工任务 | evidence + manual | clean identity audit + owner signature | run/commit/hash/environment/log/media 完整；owner 完成双浏览器制作、保存和回放 | AC-V607；R-034–R-041 |

## Fixed Stress Project

- 15 分钟输入是 48kHz、mono、PCM16 的确定性零值 WAV，在浏览器 OPFS 中以 5 秒 chunk 生成；大型音频、WebM 和 trace 不进入 Git。
- Cube 的四个唯一 FeatureId 固定为：`centerSpectrum ← complexSpectrum/magnitude/full`、`coreScale ← buffer/default/max`、`riseSpeed ← loudness/total/scalar`、`orbitSpeed ← amplitudeSpectrum/default/peak`。全部数值 transform 使用 finite、clamped、零 attack/release。
- Orthogonal 只有两个动态 descriptor，因此固定使用 Loudness total 与 Complex Spectrum magnitude mean；V6 验证 Cube 四项释放为 Orthogonal 两项、切回 Cube 后恢复精确四项，不把 descriptor 上限伪装为缺失覆盖。
- 分析压力在进度可见且单调后执行交互、时钟和取消测量；录制 preflight 在 analysis 未 ready 时必须 typed 拒绝并保持资源为零。

## Canonical Rule

- 新增 `fixtures:v6:golden`、`test:v6:unit`、`test:v6:integration`、`test:e2e:v6:chrome`、`test:e2e:v6:edge`、`test:e2e:v6`、`test:v6:media`、`eval:v6:provisional` 与 `eval:v6`。
- V6 canonical 恰为 54 步：V5 40 步基线、六个 V6 专项、M6 unit/worker/integration/Chrome 四步及 M14 unit/integration/Chrome/Edge 四步。
- provisional 允许 dirty worktree且只作实现反馈；canonical 必须在 clean implementation commit 上起止保持相同 HEAD 和空工作树。
- runner 记录环境、浏览器能力、三格式输出 SHA-256、ffprobe、性能/时钟、资源 probe、逐步日志和 summary SHA-256；任一步失败均不得登记通过。
- DEC-048 只允许 V6 三格式 recorder 的相邻视频 packet gap 最多四个目标帧间隔；平均帧率仍须在 30fps `±5%` 内。V5 canonical 与 `test:v5:media` 的两帧阈值保持不变。
- DEC-048 只把 V6 压力场景的 Visualizer 单帧峰值调整为 `<60ms`；分析归因任务仍须 `<50ms`，反馈 `<=100ms`、时钟偏差 `<=50ms` 与资源门禁均不变。
- canonical 后 V6 曾保持 `In Progress`、evidence 保持 `in-review`、R-041 保持 `Open`；2026-09-04 owner 明确批准人工门禁后，V6 已关闭且 R-041 已缓解。

## Canonical Result

Clean canonical `V6-2026-09-03T16-33-03-497Z-ef12ce39` 在 implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` 上 54/54 通过，起止工作树干净，summary SHA-256 为 `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014`。六个默认媒体、双浏览器三格式、900 秒四特征、20 次生命周期及 M6/M14 显式回归均通过；正式指标与逐步 hash 见 [evidence index](evidence-index.md)。2026-09-04 owner 已批准人工制作、原生保存/回放、键盘/焦点和长时清理门禁。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| OS picker、覆盖提示与原生权限不能由 Playwright 完整控制 | 系统对话框由浏览器/OS 持有 | 自动化 stub 与真实保存体验不同 | owner 在 Chrome/Edge 各执行三格式打开、一次保存、取消和重试 | project-owner |
| 长会话体感与辅助技术朗读不能由计数器替代 | 自动化只能测时序、DOM 与资源 | 真实操作疲劳或播报顺序可能不理想 | owner 完成键盘/焦点/reduced-motion/长时制作任务 | project-owner |
| optional preset 是当前机器能力证据 | 浏览器/硬件 cadence 会变化 | 未来环境可能支持或退化 | 支持则验证真实文件；不支持只接受资源获取前 typed unavailable | project-owner |
| VP9 recorder 在组合负载下存在小幅可变 packet cadence | 同一 Canvas 约 60fps 绘制时仍观察到 78–110ms 偶发间隙 | 短时画面可能轻微停顿 | 关闭 MSAA、使用 `motion` hint；V6 允许最多四帧间隔但继续约束平均 fps、时长、音轨和 A/V 结束差 | project-owner |
| 没有正式 CI 或跨硬件基线 | canonical 是本机 clean run | 结论不可泛化到持续集成或所有设备 | 登记硬件/浏览器并在 readiness 中保留 waiver | project-owner |
