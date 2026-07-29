---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "docs/delivery/execution-plan.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
next_action: "用户提交 M5 改动；完成原生权限人工检查后运行 clean-commit canonical suite"
---

# Milestone Plan

## Planning Convention

- Target 使用相对门禁，不表示日历承诺。
- `Complete` 只用于文档门禁、真实证据和所需人工批准均已满足的里程碑。
- Q0、M3 和 M4 为 `Complete`；M5 为 `In Progress`，M6–M11 为 `Planned`。
- 一个里程碑未通过时，后续里程碑保持 Planned/Blocked，不并行扩大特征范围。

## Milestones

| ID | Milestone | Status | Relative target | Depends on | Exit evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| M1 | Product intent approved | Complete | Gate P | Repository context | problem/scope approved；metrics 固定；无阻断产品问题 | project-owner |
| M2 | System design and ADRs approved | Complete | Gate A | M1 | system design、contracts、risk、4 ADR approved | project-owner |
| Q0 | Quality evaluation design | Complete | Pre-implementation quality gate | M2 | eval plan、golden examples、failure taxonomy approved；42 AC 和 19 risk 可追溯 | project-owner |
| M3 | Test foundation and fixtures | Complete | First implementation gate | Q0 | Vitest/Playwright/Worker harness、fixture manifest、golden helper、有效 npm scripts | project-owner |
| M4 | Single AudioEngine and shared store | Complete | After M3 | M3 | 播放/MusicBar 回归、单一上下文、生命周期证据 | project-owner |
| M5 | IndexedDB hybrid recovery | In Progress | After M4 | M4 | current Blob/cache、handle permission、refresh/quota/schema 证据 | project-owner |
| M6 | Worker platform and feature registry | Planned | After M5 | M4, M5 | mono/frame/cancel/stale/cache/21-key registry、性能基线 | project-owner |
| M7 | RMS + Amplitude Spectrum + Chroma | Planned | First feature gate | M6 | 三项黄金、四卡共享时间轴、100ms、owner 任务与 3/3 学习解释 | project-owner |
| M8 | Remaining scalar features | Planned | After M7 | M7 | 13 项新增 scalar 全部 golden/renderer/edge，累计 16/21 | project-owner |
| M9 | Power Spectrum + MFCC + Buffer | Planned | After M8 | M8 | vector/waveform 维度、精确值、累计 19/21 | project-owner |
| M10 | Loudness + Complex Spectrum | Planned | Full feature gate | M9 | 结构 payload/renderer、21/21 coverage | project-owner |
| M11 | Cross-cutting hardening | Planned | Delivery exit gate | M10 | 格式、恢复、权限、性能、无障碍、视口和 Chrome/Edge 全证据 | project-owner |

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
- [ ] 使用本地样本完成原生 picker/权限/文件移动人工检查。
- [ ] 用户提交后运行 clean-commit `npm run eval:m5` 并登记 evidence。
- [ ] `project-owner` 审批 M5 evidence 与 working agreements。

### M6

- [ ] 21/21 registry coverage。
- [ ] mono、frame、config/hash 和 cache key。
- [ ] Worker progress/cancel/error/stale。
- [ ] 最多四项且不重复。
- [ ] ≤30Hz display payload、量化和 exact cursor。
- [ ] 最大输入性能基线满足当前 guardrail。

### M7

- [ ] RMS line、Amplitude heatmap/spectrum、Chroma heatmap/bars。
- [ ] 四卡共享 viewport/zoom/cursor/click seek。
- [ ] 结果黄金容差和游标 ≤100ms。
- [ ] session/cards/cache 恢复。
- [ ] owner 脚本任务全部完成，学习解释 3/3。
- [ ] 三视口、键盘、reduced motion、console。

### M8

- [ ] ZCR/Energy 和 9 个 spectral scalar。
- [ ] Perceptual Spread/Sharpness。
- [ ] flux previous-frame、signed/unbounded、silence 等边界。
- [ ] 累计 16/21 可选择且有黄金证据。

### M9

- [ ] Power Spectrum、MFCC 13、Buffer waveform。
- [ ] 维度/轴/量化/exact cursor。
- [ ] 累计 19/21 可选择且有黄金证据。

### M10

- [ ] Loudness total + 24 bands。
- [ ] Complex Spectrum real/imag 和 magnitude/phase。
- [ ] 错误隔离和 DOM 替代信息。
- [ ] 21/21 registry、UI、golden、renderer coverage。

### M11

- [ ] 三格式 × Chrome/Edge。
- [ ] 15 分钟和反复生命周期压力。
- [ ] 权限/恢复/quota/schema 完整矩阵。
- [ ] 输入 ≤100ms、无分析归因 >50ms 主线程任务。
- [ ] 键盘/焦点/非颜色/reduced motion。
- [ ] 1024/1280/1920 实际几何与 Canvas。
- [ ] 所有适用 AC 有证据，相关风险已关闭、缓解或明确接受。

## Current Gate State

- Current stage：M5 IndexedDB hybrid recovery，implementation/provisional complete，等待人工权限检查与 clean-commit evidence。
- Previous gate：M3 已由 `project-owner` 于 2026-07-28 批准并标记 `Complete`。
- Canonical run：`npm run eval:m3` 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过；摘要见 [evidence index](../quality/evidence-index.md)。
- Next gate：使用本地样本完成人工权限检查；用户提交后在 clean commit 运行 canonical suite 并审批 M5 evidence。
- M3 state：Complete；M3 evidence 只证明测试基础，不代表 M4 产品行为通过。
- M4 canonical：`npm run eval:m4` 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上 13/13 步骤通过；60 秒漂移 2.233ms，三次 seek 最大误差 66.827ms。`project-owner` 已于 2026-07-29 批准该证据。
- M5 provisional：`M5-2026-07-29T07-03-16-207Z-2eb98381-provisional` 在 dirty worktree 16/16 步骤通过；summary SHA-256 为 `7b0acaf128ac4a7ceffce1449d2421127d20c8b25dcdc1ebd07b889072228530`。它只作实现反馈，不是正式 evidence。
- Known future blockers：没有真实 Edge 证据时不能完成 M11 或未来 readiness；托管平台未定会阻断 release，但不阻断 Q0/M3。

## Approval Record

`project-owner` 于 2026-07-28 明确批准 Q0 三份质量设计和两份 delivery 修订。该批准开放 M3，但不代表任何测试、产品行为或 release readiness 已通过。

`project-owner` 于 2026-07-28 明确批准 M3 evidence index 与 working agreements。M3 据此改为 `Complete` 并开放 M4；Edge 和 M4–M11 未执行范围保持不变。

`project-owner` 于 2026-07-29 明确批准 M4 evidence index 与 working agreements。M4 据此改为 `Complete` 并开放 M5；该批准不预先批准 M5 evidence。
