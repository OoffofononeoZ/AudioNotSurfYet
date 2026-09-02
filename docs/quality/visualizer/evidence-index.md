---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/eval-plan.md"
  - "docs/quality/visualizer/golden-examples.md"
  - "docs/quality/visualizer/failure-taxonomy.md"
  - "docs/delivery/visualizer/milestone-plan.md"
next_action: "在 clean V1 implementation commit 上运行 eval:v1，并登记 canonical 身份与人工缺口"
---

# Visualizer Evidence Index

## Current Gate

- V0-P、V0-A、V0-D：`Complete`。
- V1：`In Progress`，尚无 canonical record。
- V2–V6：`Planned`。
- R-034、R-036、R-038 继续为 `Open`；V1 自动化和 owner 审批后只增加部分缓解证据。
- Analyzer/Editor canonical 是相邻回归，不能替代 Visualizer evidence。

## Record Contract

每个 V 里程碑记录 run ID、实现 commit、证据 commit、clean identity、浏览器/Node/npm/Meyda、脱敏硬件、步骤结果、布局/资源指标、日志与 summary SHA-256、失败分类、未自动化项目及 reviewer 状态。原始 artifact 保存在 Git 忽略目录直到审批完成。

## V1 Pending Record

| Field | Value |
| --- | --- |
| Milestone | V1 — Workspace foundation |
| State | `not-run` |
| Expected method | `npm run eval:v1` on clean implementation commit |
| Canonical steps | 21 |
| Reviewer | `project-owner` — pending |
| Artifact root | `artifacts/evals/V1-<timestamp>-<commit>/` |

原生 OS picker、覆盖提示和 `beforeunload` 由 owner 在 Chrome/Edge 补偿检查；未提供的观察值不得补写。
