---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e2-eval-plan.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "复核 E2-G01–G12 的 canonical 实例；批准前保持 in-review"
---

# Editor E2 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E2-G01 | success | 100 BPM、4/4、全曲 viewport | beat 间隔 0.6s，每 4 拍一条 measure；重合 beat 不重复 | 固定 DEC-026 基础语义 |
| E2-G02 | boundary | 127.5 BPM、7/8 | beat 间隔仍为 `60/127.5` 秒，每 7 拍一小节；8 只表达 beat 单位 | 防止按四分音符重复缩放 |
| E2-G03 | success | pointer anchor 处从 1x 放大到 4x | anchor 对应时间的 CSS x 保持不变，viewport 仍在歌曲范围 | 固定共享 zoom identity |
| E2-G04 | boundary | viewport 首尾、resize、DPR 1/2 | time↔x round-trip 与多层位置差 `<=1 CSS px` | 防止 Canvas backing store 引入漂移 |
| E2-G05 | pointer | 右键移动 3.9px / 4px | 前者打开快速菜单，后者只 pan；释放后无 capture/pressed | 固定临界手势 |
| E2-G06 | success | 有合法 metered BPM 时插入 boundary | 使用当前 subdivision 吸附并继承前段 tempo | 保证后续标注共享网格 |
| E2-G07 | boundary | BPM 为空或 single-beat 时插入 boundary | 使用 x→time 后微秒规范化原始时间，不制造虚假网格 | 固定无网格语义 |
| E2-G08 | failure | 负数、NaN/Infinity、非数字、>300、无效拍号 | 不提交工程，显示行内错误，durable draft 保持原值 | 防止无效 tempo 污染 JSON |
| E2-G09 | boundary | 输入 0、12.5、19.999 | 均规范为 single-beat，隐藏拍号且区间内无 beat/measure | 固定特殊区间规则 |
| E2-G10 | success | 60/100/128/127.5 BPM 合成脉冲 | 误差 `<=max(0.5 BPM, target×1%)`，不半拍/双拍归一化 | 固定 estimator 正确性 |
| E2-G11 | failure | silence、固定种子噪声、双候选优势 <0.08 | 返回 low-confidence，不填写 BPM | 防止猜测成为用户事实 |
| E2-G12 | race | reliable 结果返回前用户输入 BPM、插入 boundary 或换歌 | 结果被丢弃，用户值/新工程不变 | 固定 stale 与用户优先级 |

Golden 只使用确定性合成 PCM 与虚构工程数据，不记录用户音频、路径或设备标识。运行时 WAV 写入 Git 忽略的 `artifacts/fixtures/`。

E2-G01–G12 已由版本化 `editor-e2-tempo.v1.json`、Vitest 与 Chrome 场景实现，并在 2026-08-27 clean canonical 22/22 中通过；该事实仍等待 owner 审批。
