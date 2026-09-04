---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/architecture/adrs/0019-editor-tempo-lane-and-boundary-deletion.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e8-eval-plan.md"
next_action: "完成 E9 专项与 dirty provisional，提交 implementation 后运行 29 步 clean canonical"
---

# Editor E9 Eval Plan

## Boundary

E9 只评价专用 BPM 轨道、内部 tempo boundary 删除、三级单行区间展示，以及分类按钮、point candidate、单 divider 和共享 scrollbar 修订。歌曲 identity、JSON V1、AudioEngine/Worker、tempo estimator 算法、point/range 秒数、overlay 与 E1–E8 历史 canonical 不变。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E9-EV-LANE | 波形与 BPM 轨道共享时间 rect | 四视口、DPR 1/2、zoom/pan/scroll | pure geometry + Chrome/Edge probe | caret、grid、waveform anchor 差 `<=1 CSS px`；无第二 BPM scroller | AC-E901/902；R-024/042 |
| E9-EV-PRESENTATION | 区间完整/摘要/隐藏 | exact boundary、resize、长内容 | versioned golden + DOM E2E | full 与 summary 单行；不足时 hidden；boundary 始终保留 | AC-E902；R-025/042 |
| E9-EV-DELETE | 内部 boundary 删除 | first/internal/unknown/repeated、mouse/keyboard | unit + integration + dual-browser | 只移除目标 segment；前段延伸；first/end 拒绝；events 秒数不变 | AC-E903；R-023/024/042 |
| E9-EV-LIFECYCLE | draft/error/stale/autosave | success + failure + race | controller/repository integration + refresh | 删除后无目标草稿/错误；旧 estimate 不写回；V1 round-trip 精确 | AC-E904；R-023/026/042 |
| E9-EV-POLISH | category/candidate/divider/scrollbar | computed style + pointer/focus | Chrome/Edge DOM/style probe | 分类按钮中心误差 `<=1px`；candidate 宽 3px；单 divider；共享 `.app-scrollbar` | AC-E905；R-025/042 |
| E9-EV-REGRESSION | E8 25 步基线 | success/failure/boundary/resource | 29 步 runner | 所有步骤通过；console/pageerror 为 0；docs/harness/typecheck/build/diff 通过 | AC-E905；R-023–027/042 |

## Canonical Rule

- `eval:e9:provisional` 允许 dirty worktree，只生成本地 artifact。
- `eval:e9` 必须在起止同一 clean implementation commit 上运行，固定为 E8 25 步基线加 E9 unit、integration、Chrome、Edge，共 29 步。
- 记录 commit、run ID、Node/npm、真实 Chrome/Edge 版本、四视口/DPR 几何、交互结果、步骤日志和 summary SHA-256。
- canonical 登记后 E9 仍为 `In Progress`、evidence `in-review`、R-042 `Open`，直到 owner 完成视觉和交互任务。

## Manual Gate

Owner 在 Chrome/Edge 确认“+分类”居中、candidate 绿色竖线、BPM 与波形对齐、缩放时完整/摘要/隐藏合理、右键删除为前段延伸、板块间只有一条横线。自动化不能替代该视觉判断。
