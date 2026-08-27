---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e2-eval-plan.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "复核 E2 canonical failure coverage；批准前保持 in-review"
---

# Editor E2 Failure Taxonomy

E2 继续沿用 E1 的 `EFT-LIFECYCLE`、`EFT-CONSUMER`、`EFT-DRAFT` 和 `EFT-REGRESSION`；只有新行为域增加以下分类。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-GEOMETRY | 时间几何漂移 | 波形、游标、boundary 或 grid 对同一时间偏差超过 1 CSS px | E2-EV-GEOMETRY | 阻断 E2；收敛到单一 CSS geometry/DPR 变换 |
| EFT-VIEWPORT | viewport/输入状态 | zoom/pan/seek 越界、锚点漂移、右键阈值或 cleanup 错误 | E2-EV-VIEWPORT | 阻断对应交互；复跑 pointer/keyboard/resize |
| EFT-TEMPO | tempo map/网格 | boundary 顺序、继承、BPM/拍号/single-beat 或 measure/beat 语义错误 | E2-EV-TEMPO | 阻断 E2；不修改事件秒数或 JSON schema |
| EFT-ESTIMATE | BPM 估计 | 超容差、虚假 reliable、半拍/双拍偏置或低置信度写入 | E2-EV-BPM/RACE | 阻断自动填充；手动 tempo 保持可用 |
| EFT-WAVEFORM | Buffer/Canvas | Buffer series、cache、Canvas 或绘制失败导致波形错误 | E2-EV-FAILURE | 隔离为可重试波形错误；播放/tempo/工程继续 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 错歌、工程损坏或迟到结果覆盖用户 tempo | 立即停止 canonical，不得豁免关闭 E2 |
| S1 | 时间轴、seek、tempo 或可靠 BPM 核心任务不可完成 | 阻断 E2 |
| S2 | 有明确恢复路径的局部 Canvas、焦点、菜单或状态表达错误 | 修复并复跑相关层；按影响决定是否全量重跑 |
| S3 | 不影响结果的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高严重度 |

E2 provisional 前发现并修复 reactive proxy `structuredClone` 与 E1 fake coordinator 接口漂移；最终 provisional/canonical 均无失败步骤。两项均作为 `EFT-REGRESSION / S2` 的预门禁修复记录，不伪造为 canonical failure，也不覆盖原始本地开发日志。
