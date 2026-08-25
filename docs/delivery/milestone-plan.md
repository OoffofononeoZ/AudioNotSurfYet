---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-25
upstream_docs:
  - "docs/delivery/execution-plan.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
next_action: "M11 clean canonical 已通过；完成 owner Edge 原生权限与辅助技术签字"
---

# Milestone Plan

## Planning Convention

- Target 使用相对门禁，不表示日历承诺。
- `Complete` 只用于文档门禁、真实证据和所需人工批准均已满足的里程碑。
- Q0、M3、M4、M5、M6、M7、M8、M9 和 M10 为 `Complete`；owner 已明确要求开始最终加固，M11 当前为 `In Progress`。
- 一个里程碑未通过时，后续里程碑保持 Planned/Blocked，不并行扩大特征范围。

## Milestones

| ID | Milestone | Status | Relative target | Depends on | Exit evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Product intent approved | Complete | Gate P | Repository context | problem/scope approved；metrics 固定；无阻断产品问题 | project-owner |
| M2 | System design and ADRs approved | Complete | Gate A | M1 | system design、contracts、risk、ADR-0001–0005 approved | project-owner |
| Q0 | Quality evaluation design | Complete | Pre-implementation quality gate | M2 | eval plan、golden examples、failure taxonomy approved；42 AC 和 19 risk 可追溯 | project-owner |
| M3 | Test foundation and fixtures | Complete | First implementation gate | Q0 | Vitest/Playwright/Worker harness、fixture manifest、golden helper、有效 npm scripts | project-owner |
| M4 | Single AudioEngine and shared store | Complete | After M3 | M3 | 播放/MusicBar 回归、单一上下文、生命周期证据 | project-owner |
| M5 | IndexedDB hybrid recovery | Complete | After M4 | M4 | current Blob/cache、handle permission、refresh/quota/schema 证据 | project-owner |
| M6 | Worker platform and feature registry | Complete | After M5 | M4, M5 | mono/frame/cancel/stale/cache/21-key registry、性能基线、canonical evidence 与 owner approval | project-owner |
| M7 | RMS + Amplitude Spectrum + Chroma | Complete | First feature gate | M6 | 三项黄金、四槽/最多三张活动卡共享时间轴、100ms、owner 任务与 3/3 学习解释 | project-owner |
| M8 | Remaining scalar features | Complete | After M7 | M7 | UI hardening、13 项新增 scalar 全部 golden/renderer/edge，累计 16/21 | project-owner |
| M9 | Power Spectrum + MFCC + Buffer | Complete | After M8 | M8 | Header blur、vector/waveform 维度、精确值、累计 19/21 | project-owner |
| M10 | Loudness + Complex Spectrum | Complete | Full feature gate | M9 | 结构 payload/renderer、21/21 coverage | project-owner |
| M11 | Cross-cutting hardening | In Progress | Delivery exit gate | M10 | 格式、恢复、权限、性能、无障碍、视口和 Chrome/Edge 全证据 | project-owner |

## Gate Checklist by Milestone

### Q0

- [ ] 七组 eval 均覆盖 success、failure、boundary、exception。
- [ ] 42 个 AC 映射到 eval，19 个 risk 映射到 eval 或 evidence gap。
- [ ] 黄金样例包含三项学习样例、成功、失败、边界和异常场景。
- [ ] failure type 与 S0–S3 severity 分离，硬性 AC 失败不允许被低严重度绕过。
- [ ] 三份质量文档和本 delivery 修订由 `project-owner` 明确批准。
- [ ] 没有创建 `release-readiness.md` 或伪造执行证据。

### M3

- [x] 公开测试命令均存在且退出码经 deliberate failure 验证。
- [x] `test:spectrogram` 已删除且不保留兼容别名。
- [x] 合成 PCM 可确定性生成，连续重建 hash 一致。
- [x] MP3/WAV/FLAC manifest 包含 provenance/license/hash。
- [x] 直接 Meyda golden 和容差 helper 有自测。
- [x] 用户提交后完成 clean-commit canonical run，并创建 `in-review` evidence index。
- [x] `project-owner` 审阅并批准 evidence index 与 working agreements。

### M4

- [x] AudioEngine/store 契约已实现，旧 AudioLoader 路径已删除。
- [x] MusicBar 已接入共享状态，视觉结构、队列和能量行为保留。
- [x] play/pause/seek/ended/switch/dispose 的自动化已建立。
- [x] 单一实时 AudioContext、单 service RAF 和 URL 释放已有可执行检查。
- [x] 用户提交干净 commit 后完成 `npm run eval:m4`。
- [x] M4 canonical run 已追加到 evidence index。
- [x] M4 evidence index 与 working agreements 由 `project-owner` 批准。

### M5

- [x] V1 schema 与 runtime validation。
- [x] 当前 Blob/cache 原子替换且只保留当前项。
- [x] 刷新后 0 秒 paused。
- [x] granted/prompt/denied/missing/changed/quota 都有 UI 和自动化测试。
- [x] 权限请求只在用户手势后。
- [x] dirty-worktree `npm run eval:m5:provisional` 16/16 通过。
- [x] 使用本地样本完成原生 picker/权限/文件移动人工检查。
- [x] 用户提交后运行 clean-commit `npm run eval:m5` 并登记 evidence。
- [x] `project-owner` 审批 M5 evidence 与 working agreements。

### M6

- [x] 21/21 registry coverage；每项含 milestone、shape、renderer、维度与 M6 support 状态。
- [x] mono、revision-stale PCM copy、frame、config/hash 和 cache key。
- [x] Worker progress/cancel/error/stale 与 latest exact cursor。
- [x] 最多四项且不重复；later-milestone feature 返回 typed unsupported error。
- [x] ≤30Hz display payload、六类 codec、量化和 exact cursor。
- [x] 确定性 15 分钟 OPFS 样本单项 Chrome 场景满足输入/long-task/progress/cancel guardrail。
- [x] dirty-worktree `eval:m6:provisional` 20/20 通过，只作实现反馈。
- [x] 用户提交后 clean-HEAD `eval:m6` 通过并追加 `in-review` evidence index。
- [x] `project-owner` 批准 M6 evidence、working agreements、system map 与 glossary。

### M7

- [x] RMS line、Amplitude heatmap/spectrum、Chroma heatmap/bars。
- [x] 固定四槽、0–3 张唯一 M7 活动卡共享 viewport/zoom/cursor/click seek；四张唯一活动特征顺延 M8。
- [x] 自动化结果黄金容差和游标 ≤100ms。
- [x] session/cards/cache 恢复。
- [x] owner 脚本任务全部完成，学习解释 3/3，并于 2026-08-21 批准 canonical evidence。
- [x] Chrome 自动化覆盖三视口、键盘、reduced motion、console。
- [x] dirty-worktree provisional 24/24 通过，只作实现反馈。
- [x] clean-HEAD canonical 24/24 通过并登记 `in-review` evidence。

### M8

- [x] Slice 0 修复 sticky 间距、MusicBar 层级、pressed 状态与精确值表滚动条；Windows Chrome 已由 owner 补偿复核并批准。
- [x] ZCR/Energy 和 9 个 spectral scalar。
- [x] Perceptual Spread/Sharpness。
- [x] ADR-0005 项目 Flux previous-frame、首帧 0、零能量 0、signed/unbounded 和非有限值失败边界。
- [x] 累计 16/21 可选择且有版本化 golden、provisional 与 clean canonical 证据。

### M9

- [x] 首页 Header 保持透明，非首页使用 18px backdrop blur；四视口与路由切换专项 Chrome 已通过。
- [x] Power Spectrum、MFCC 13、Buffer waveform 已实现。
- [x] 维度/轴/量化/exact cursor 专项 unit/integration 已通过。
- [x] 累计 19/21 的 dirty-worktree provisional 32/32 通过。
- [x] clean canonical 32/32 通过并登记正式 `in-review` evidence。
- [x] owner Windows Chrome 视觉/学习任务与 evidence 审批。

### M10

- [x] Loudness total + 24 bands Worker、payload、双 Canvas 与 DOM 精确值。
- [x] Complex Spectrum real/imag 各 1024 与完整 magnitude/phase 主图。
- [x] 沿用单卡错误隔离、双 Canvas、主题滚动条和 DOM 替代信息。
- [x] 21/21 registry、UI、golden、renderer 代码与专项测试覆盖。
- [x] dirty-worktree 36 步 provisional 通过。
- [x] clean-HEAD 36 步 canonical 通过并登记 `in-review` evidence。
- [x] owner 批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖，M11 门禁开放。

### M11

- [x] canonical：三格式 × Chrome/Edge 自动化。
- [x] canonical：15 分钟和 20 次反复生命周期压力。
- [ ] 权限/恢复/quota/schema 完整矩阵（自动化 canonical 已过；Edge 原生 picker 人工检查待签字）。
- [x] canonical：输入 ≤100ms、无分析归因 >50ms 主线程任务。
- [ ] 键盘/焦点/非颜色/reduced motion（自动化 canonical 已过；辅助技术人工检查待签字）。
- [x] canonical：390/1024/1280/1920 实际几何与 Canvas。
- [ ] 所有适用 AC 有证据，相关风险已关闭、缓解或明确接受。

## Current Gate State

- Current stage：M10 为 `Complete`；M11 clean Chrome/Edge canonical 已 38/38 通过并登记 `in-review`，M11 仍为 `In Progress`。
- Previous gate：M3 已由 `project-owner` 于 2026-07-28 批准并标记 `Complete`。
- Canonical run：`npm run eval:m3` 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过；摘要见 [evidence index](../quality/evidence-index.md)。
- Next gate：owner 完成 Edge 原生权限、辅助技术与人工长会话复核并批准 M11 evidence 后，才可把 M11 改为 `Complete`。
- M3 state：Complete；M3 evidence 只证明测试基础，不代表 M4 产品行为通过。
- M4 canonical：`npm run eval:m4` 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上 13/13 步骤通过；60 秒漂移 2.233ms，三次 seek 最大误差 66.827ms。`project-owner` 已于 2026-07-29 批准该证据。
- M5 provisional：`M5-2026-07-29T07-03-16-207Z-2eb98381-provisional` 在 dirty worktree 16/16 步骤通过；summary SHA-256 为 `7b0acaf128ac4a7ceffce1449d2421127d20c8b25dcdc1ebd07b889072228530`。它只作实现反馈，不是正式 evidence。
- M5 canonical：`M5-2026-07-29T07-08-25-199Z-c90a3c57` 在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上 16/16 通过；summary SHA-256 为 `6257426baa601289d89c10e97d76d866a637227fd042080deb947af17c982d2a`。Chrome 原生权限人工检查随后通过，`project-owner` 已批准 M5 evidence 与 working agreements。
- M6 provisional：`M6-2026-07-29T10-59-23-767Z-b7fa91ed-provisional` 在 dirty worktree 20/20 通过；summary SHA-256 为 `6fd67f9a8b0184a2861a7182a1276572375e947880cf3688afe7511ca97ed3fa`。刷新 cache hit 后 exact cursor 可用；15 分钟最大反馈 16.7ms、分析归因 >50ms 长任务 0 个。它不构成正式 evidence。
- M6 canonical：`M6-2026-07-30T02-19-07-149Z-a39256ff` 在 clean commit `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` 上 20/20 通过；summary SHA-256 为 `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae`。四项 cache payload 为 100,941 bytes，刷新 hit 后 exact cursor 一致，20 次资源循环保持单 Worker/AudioContext，15 分钟最大反馈 17ms、分析归因 >50ms 长任务 0 个；`project-owner` 已于 2026-07-30 批准该记录。
- M7 provisional：`M7-2026-07-30T03-13-53-844Z-5b33575f-provisional` 在 dirty worktree 24/24 通过，summary SHA-256 为 `5f49ad1d18c1c5f8096beef53a6122f242bae361b76dcbe2f9d718698e663504`。M7 Chrome 4/4、M6 Chrome 回归 3/3；三卡/四槽、共享交互、恢复与隔离场景通过，15 分钟反馈最大 16.7ms、分析归因 >50ms 长任务 0 个。它不构成正式 evidence。
- M7 canonical：首次 clean run 因固定 550ms 跨进程计时误判 exact-cursor 上限而失败；修复后 `M7-2026-07-30T03-30-43-095Z-f022b86e` 在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过，summary SHA-256 为 `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32`。M7 Chrome 4/4，seek 反馈 1.7ms，15 分钟最大反馈 16.8ms、分析归因 >50ms 长任务 0 个；owner 于 2026-08-21 完成人工任务和 3/3 学习解释并批准该 evidence。
- M8 canonical：`M8-2026-08-21T03-23-18-552Z-d6dcf715` 在 clean commit `d6dcf715be2e6675224f079b954e2b1b544bbebd` 上 28/28 通过，summary SHA-256 为 `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef`。M8 unit 7/7、integration 6/6、Chrome 2/2；15 分钟最大反馈 17.8ms、分析归因长任务 0。canonical 与 Windows Chrome 补偿结果已由 owner 批准。
- M9 canonical：`M9-2026-08-21T09-14-14-110Z-f88ca331` 在 clean commit `f88ca33149619b1a71eb30d74a1b8e266fb41a65` 上 32/32 通过，summary SHA-256 为 `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e`。M9 unit 5/5、integration 7/7、Chrome 2/2；15 分钟最大反馈 17.3ms、分析归因长任务 0。owner 于 2026-08-23 批准正式 evidence。
- M10 provisional：`M10-2026-08-22T18-17-36-129Z-2df604b9-provisional` 在 dirty worktree 36/36 通过，summary SHA-256 为 `e9696c843256bff07cfa77b29ee9a529e9d80c6fc842c6f7437fab39a5c77166`。M10 unit 7/7、integration 13/13、Chrome 3/3；四重卡 15 分钟反馈最大 16.2ms、分析归因长任务 0。它不是正式 evidence。
- M10 canonical：`M10-2026-08-22T18-25-01-873Z-8830e2a2` 在 clean commit `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` 上 36/36 通过，summary SHA-256 为 `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1`。M10 unit 7/7、integration 13/13、Chrome 3/3；四重卡 15 分钟最大反馈 17ms、分析归因长任务 0；正式 evidence 于 2026-08-25 获 owner 批准。
- M11 provisional：`M11-2026-08-25T09-47-44-125Z-1b3691f9-provisional` 在 dirty worktree 38/38 通过，summary SHA-256 为 `e84e695f8cb328390e1843b03d7af5c6f619bd2d96442fd7d97799bef5287ad5`。Edge 全量 31/31；Chrome/Edge 四重卡最大反馈 17.6ms/16.7ms、分析归因长任务均为 0；两端 20 次路由循环均为 21 created/20 lost WebGL context 和 2 live RAF。它不是正式 evidence。
- M11 canonical：`M11-2026-08-25T10-05-12-783Z-99c67792` 在 clean commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过，summary SHA-256 为 `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5`。Chrome 专项 4/4、Edge 全量 31/31；Chrome/Edge 四重卡最大反馈 17.9ms/17.2ms、分析归因长任务均为 0；正式 evidence 为 `in-review`。
- Known future blockers：Edge 151 clean 自动化已通过，但原生权限与辅助技术人工证据尚未完成，因此仍不能完成 M11 或未来 readiness；托管平台未定会阻断 release，但不阻断 M11 验收。

## Approval Record

`project-owner` 于 2026-07-28 明确批准 Q0 三份质量设计和两份 delivery 修订。该批准开放 M3，但不代表任何测试、产品行为或 release readiness 已通过。

`project-owner` 于 2026-07-28 明确批准 M3 evidence index 与 working agreements。M3 据此改为 `Complete` 并开放 M4；Edge 和 M4–M11 未执行范围保持不变。

`project-owner` 于 2026-07-29 明确批准 M4 evidence index 与 working agreements。M4 据此改为 `Complete` 并开放 M5；该批准不预先批准 M5 evidence。

`project-owner` 于 2026-07-29 确认 M5 Chrome 原生权限人工检查通过，并明确批准 M5 evidence index 与 working agreements。M5 据此改为 `Complete` 并开放 M6；超范围压力输入未开始播放不计入门禁，也不扩展约 15 分钟支持承诺。

2026-07-30，M6 canonical 已在 clean commit 上 20/20 通过。`project-owner` 随后明确回复：“我批准 M6 canonical evidence、working agreements、system map 与 glossary；同意将 M6 标记为 Complete 并开放 M7。”M6 据此改为 `Complete`；M7 门禁开放但仍为 `Planned`，直到明确开始实现。

同日，`project-owner` 明确要求实施 M7 三卡学习切片。M7 据此改为 `In Progress`；M7 只允许三个获准特征和最多三张活动卡，固定第四槽作为后续提示，M8 继续为 `Planned`。
