---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/editor/e8-eval-plan.md"
  - "docs/quality/editor/e7-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "clean canonical 无失败步骤；owner 验收前保持相关风险 Open"
---

# Editor E8 Failure Taxonomy

E8 沿用 E1–E7 的 route identity、draft atomicity、geometry、Canvas、pointer、keyboard、resource、regression 与 evidence 分类，并增加以下修正专属失败域。

| Type ID | Failure type | Definition | Detection | Response |
| --- | --- | --- | --- | --- |
| EFT-E8-TIMELINE-SIZE | 时间轴高度失败 | 任一视口不是 72/88px，或媒体断点不在 900px | E8-EV-TIMELINE | S1；修正单一 CSS token，复跑四视口双浏览器 |
| EFT-E8-WAVEFORM-CLIP | 波形极值/Canvas 裁切 | ±1 超出 6px 安全区、backing store 错误或控件溢出 | E8-EV-TIMELINE | S1；修正纯垂直 geometry/resize，不放宽阈值 |
| EFT-E8-RETRY-LOOP | 同歌恢复重试循环 | 同一恢复 signature 多次 enter、旧 generation 覆盖新 route 或页面抖动 | E8-EV-EXACT-RECOVERY | S0/S1；修正 signature/in-flight/generation，复跑竞态矩阵 |
| EFT-E8-AUTOPLAY | 恢复后自动播放 | 自动重试触发 playing、seek 或用户未授权音频 | E8-EV-EXACT-RECOVERY | S0；立即阻断，恢复流程只能获取 paused lease |
| EFT-E8-SILENT-SWITCH | 异歌静默切换 | 当前可播放歌曲不同却自动替换 URL/工程 | E8-EV-OTHER-TRACK | S0；恢复纯决策边界，要求显式 CTA |
| EFT-E8-CTA-A11Y | 切换入口不可达 | CTA 缺歌曲名、焦点、键盘路径或使用 push 导致返回失效 route | E8-EV-OTHER-TRACK | S1；修正 accessible name/replace/focus 并复跑 |
| EFT-E8-DRAFT-CORRUPTION | 恢复失败破坏工程 | 错误 hash/permission/decode 导致新建、覆盖或清空草稿 | E8-EV-RECOVERY-FAILURE | S0；恢复严格身份和原子进入边界 |
| EFT-E8-MARKER-CENTER | marker 中心偏移 | button/diamond/candidate/event X 或 diamond Y 超过 1px | E8-EV-MARKER | S1；修正 transform/transform-origin/style，不改变 event seconds |
| EFT-E8-ADJACENT | 历史契约回归 | E1/E2/E3/E7、M5、overlay、keyboard、MusicBar 或 console 回归 | E8-EV-ADJACENT | 依原 taxonomy 阻断 E8，并复跑受影响层 |
| EFT-E8-EVIDENCE | 证据身份误报 | dirty run 被称为 canonical、改写 E7 历史或提前关闭风险/E8 | runner clean guard + docs audit | S0；撤回声明，保留 provisional artifact，只接受绑定 clean implementation commit 的 canonical |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 歌曲/工程事实、用户授权或 evidence identity 受损 | 立即停止 canonical，修复根因 |
| S1 | 核心恢复、geometry、浏览器、键盘或回归门禁失败 | 阻断 E8/Editor readiness |
| S2 | 可恢复文案或非核心视觉差异且不影响身份/任务 | 修复并复跑专项 |
| S3 | 不影响任务、事实、几何与可访问性的轻微差异 | 登记，由 owner 判断 |

失败 run 必须保留身份与日志，不能用调整截图、跳过 Edge、放宽 `<=1px` 或覆盖草稿来制造通过。已有 Visualizer V5 dirty-worktree 阶段的 E8 结果只归类为 scoped/provisional；正式 canonical 已绑定 E8 clean implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5`，且没有失败步骤。
