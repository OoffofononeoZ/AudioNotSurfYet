---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v5-eval-plan.md"
  - "docs/quality/visualizer/v5-golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "用 V5 unit/integration/双浏览器/媒体验证记录 recording failure"
---

# Visualizer V5 Failure Taxonomy

V1–V4 的 route、project、binding、determinism、renderer、context、responsive 和 performance 分类继续前向回归；V5 新增录制资源、状态、文件和同步域。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| V5FT-TAP | audio tap/ownership | tap 不在 pre-Gain、出现第二 holder、release 影响播放或资源不归零 | V5-EV-TAP/RESOURCE | 阻断 V5；修复唯一 AudioEngine 分支 |
| V5FT-CAPABILITY | MIME/preset | fallback 顺序错误、静默改 preset/fps/音轨，或输出失败后伪记 unavailable | V5-EV-CAPABILITY/MEDIA | 阻断 V5；只允许 codec fallback |
| V5FT-PREFLIGHT | identity/readiness | 错歌、未 ready 分析、坏 binding/Editor、renderer/context 或 track 未被拒绝 | V5-EV-PREFLIGHT | 阻断 V5；恢复原工程和播放 checkpoint |
| V5FT-SEQUENCE | recorder clock/order | 未从 0 开始、time-zero audio handshake 先于 recorder start invocation、start event 前暴露 recording、使用第二 RAF/时钟或 ended 调 next | V5-EV-SEQUENCE | 阻断 V5；恢复批准顺序 |
| V5FT-LOCK | command isolation | 录制中任一身份变更可从 UI 或直接命令绕过 | V5-EV-LOCK | 阻断 V5；在 controller 边界统一拒绝 |
| V5FT-ABORT | incomplete output | cancel/context/track/route/recorder failure 留下活资源或产生 ready 半文件 | V5-EV-ABORT/RESOURCE | S0；停止 canonical，恢复幂等 cleanup |
| V5FT-SAVE | ready/save/leave | picker cancel 丢 Blob、写失败改工程、离页静默丢弃或 Blob 跨 session 泄漏 | V5-EV-SAVE | 阻断 V5；保持内存 Blob直到明确处理 |
| V5FT-CONTAINER | WebM metadata | 容器、codec、轨道、尺寸、fps 或时长不符合 preset | V5-EV-MEDIA | 阻断对应浏览器/preset，不得降级记通过 |
| V5FT-SYNC | A/V sync | burst 与 flash 事件差超过 100ms，或页面 0 音量后音轨静音 | V5-EV-MEDIA | 阻断默认 720p30；检查 tap/启动顺序/时钟 |
| V5FT-RESOURCE | recorder lifecycle | tap、MediaRecorder、MediaStreamTrack、capture lease、Blob、listener 或 timer 单调累积 | V5-EV-RESOURCE | 阻断 V5；恢复对称 cleanup |
| V5FT-UX | state/a11y | 状态只靠颜色、离页对话框不可键盘操作、错误无可重试文字 | browser E2E + owner task | 修复并重跑交互矩阵 |
| V5FT-PERFORMANCE | response/frame | 控制反馈超 100ms、Visualizer frame 工作超 50ms 或应用 console/pageerror 非零 | V5-EV-RESOURCE | 阻断对应门禁；不以降低 preset 掩盖 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 第二 AudioContext/renderer/RAF、工程损坏、跨 route 失控或半文件被标记 ready | 立即停止 canonical，不得豁免 |
| S1 | 默认 720p30 双浏览器、pre-Gain 音轨、状态机、同步、锁或 cleanup 不成立 | 阻断 V5 |
| S2 | optional preset、保存重试、状态文案、键盘或单一错误映射缺陷 | 修复并重跑相关层，按影响决定全量重跑 |
| S3 | 不改变录制事实的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高等级问题 |

受控 context loss 的平台 warning 只有在应用 cleanup、error state 和无 ready Blob 均通过时才可作为预期信号；WebM 媒体检查失败、无音轨或同步超限不能归类为 harness timing。
