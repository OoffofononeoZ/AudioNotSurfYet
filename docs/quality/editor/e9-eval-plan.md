---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/architecture/adrs/0019-editor-tempo-lane-and-boundary-deletion.md"
  - "docs/architecture/adrs/0020-editor-compact-tempo-strip.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e8-eval-plan.md"
next_action: "运行修订后的 dirty provisional 与 clean 29 步 canonical"
---

# Editor E9 Eval Plan

## Boundary

E9 只评价波形时间列内的紧凑 BPM 标记条、内部 tempo boundary 删除、三级单行区间展示，以及分类按钮、point candidate、单 divider 和共享 scrollbar 修订。歌曲 identity、JSON V1、AudioEngine/Worker、tempo estimator 算法、point/range 秒数、overlay 与 E1–E8 历史 canonical 不变。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E9-EV-LANE | 波形与 BPM 标记条共享时间 rect | 四视口、DPR 1/2、zoom/pan/scroll | pure geometry + Chrome/Edge probe | 条高 28px、波形零间隙、caret X `<=1 CSS px`、1px 辅助线只向上 12px；无第二 BPM scroller/rail | AC-E901/902；R-024/042 |
| E9-EV-PRESENTATION | 紧凑完整/摘要/隐藏 | exact boundary、resize、长内容 | versioned golden + DOM E2E | full 控件 11px/18px、透明无框、同基线；summary 单行；不足时 hidden；boundary 始终保留 | AC-E902；R-025/042 |
| E9-EV-DELETE | 内部 boundary 删除 | first/internal/unknown/repeated、mouse/keyboard | unit + integration + dual-browser | 只移除目标 segment；前段延伸；first/end 拒绝；events 秒数不变 | AC-E903；R-023/024/042 |
| E9-EV-LIFECYCLE | draft/error/stale/autosave | success + failure + race | controller/repository integration + refresh | 删除后无目标草稿/错误；旧 estimate 不写回；V1 round-trip 精确 | AC-E904；R-023/026/042 |
| E9-EV-POLISH | compact strip/category/candidate/divider/scrollbar | computed style + pointer/focus | Chrome/Edge DOM/style probe | 重复 rail 文本不存在；来源只在 accessible name/title；分类按钮中心误差 `<=1px`；candidate 宽 3px；单 divider；共享 `.app-scrollbar` | AC-E905；R-025/042 |
| E9-EV-REGRESSION | E8 25 步基线 | success/failure/boundary/resource | 29 步 runner | 所有步骤通过；console/pageerror 为 0；docs/harness/typecheck/build/diff 通过 | AC-E905；R-023–027/042 |

## Canonical Rule

- `eval:e9:provisional` 允许 dirty worktree，只生成本地 artifact。
- `eval:e9` 必须在起止同一 clean implementation commit 上运行，固定为 E8 25 步基线加 E9 unit、integration、Chrome、Edge，共 29 步。
- 记录 commit、run ID、Node/npm、真实 Chrome/Edge 版本、四视口/DPR 几何、交互结果、步骤日志和 summary SHA-256。
- canonical 登记后 E9 仍为 `In Progress`、evidence `in-review`、R-042 `Open`，直到 owner 完成视觉和交互任务。

## Pre-revision Evidence

- Run：`E9-2026-09-04T02-49-18-960Z-cf0a79b1`。
- Implementation：`cf0a79b176d99eb183368818ce90ac5731d1cfa8`；起止 clean identity 一致。
- Result：29/29 pass；summary SHA-256 `d4c15f6801e6df4289dad97b816036a095a21e5781a314f1f3166ab663f3ca4a`。
- Browser：Chrome `152.0.7977.76`、Edge `152.0.4191.62`；四视口、DPR 1/2 最大 shared geometry 误差 `0.009375 CSS px`。
- Resource：两浏览器各 10 次 Editor/Analyzer 往返，live ResizeObserver `3–3`、Canvas `4–4`。
- Review state：`pre-revision`；DEC-052 改变合并拓扑和视觉几何，该 run 不再是 owner 审批候选，R-042 保持 `Open`。

## Manual Gate

Owner 在 Chrome/Edge 确认“+分类”居中、candidate 绿色竖线、28px BPM 条融入波形且 caret/辅助线向上指向、11px 无框输入可用、重复左 rail 消失、共享滚动对齐、缩放时完整/摘要/隐藏合理、右键删除为前段延伸、板块间只有一条横线。自动化不能替代该视觉判断。
