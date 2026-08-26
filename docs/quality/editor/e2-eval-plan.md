---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/editor/interaction-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "实现 E2 专项、provisional 与 clean canonical；证据批准前 E3 保持 Planned"
---

# Editor E2 Eval Plan

## Boundary

本计划只评价 E2 Buffer 波形、共享 viewport、seek/zoom/pan、tempo map、网格和内部 BPM 估计。E1 作为已批准回归基线；E3 point、E4 overlay、E5 range 和 E6 双浏览器/容量不在本轮完成范围。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E2-EV-GEOMETRY | 波形、游标、tempo boundary、beat/measure 使用同一时间映射 | success + resize + boundary | pure unit + Chrome Canvas/DOM probe | 1024/1280/1920、DPR、zoom/pan 下同一时间任意层 x 差 `<=1 CSS px` | AC-E201；R-024 |
| E2-EV-VIEWPORT | click seek、指针锚点 wheel zoom、4px 右键 pan、25% 按钮与 reset | success + pointer + keyboard | unit + Chrome E2E/timing | zoom 1–64；反馈 `<=100ms`；取消/blur 后无 capture/menu/pressed 泄漏 | AC-E202；R-024/025 |
| E2-EV-TEMPO | boundary 插入/继承/移动、BPM/拍号、single-beat 与 grid | success + invalid + boundary | property table + Canvas golden + E2E | 首段 0；边界严格有序；20–300、小数和 1–32/固定 denominator 合法；非法值不提交 | AC-E203/204；R-024/026 |
| E2-EV-BPM | onset/autocorrelation 与 reliable/low-confidence | success + failure + ambiguity | Worker unit + versioned PCM/golden | 60/100/128/127.5 在容差内；silence/noise/歧义均 low-confidence | AC-E205；R-026 |
| E2-EV-RACE | estimator generation、用户编辑、新 boundary、取消与换歌 | race + stale + exception | coordinator/controller integration | 只有当前 consumer/identity 可返回；任何用户事实均不被迟到结果覆盖 | AC-E206；R-026/027 |
| E2-EV-FAILURE | Buffer/cache/Canvas/Worker/草稿失败 | failure + recovery | fault injection + Chrome E2E | 保留播放、手动 tempo、内存工程和 E1 导入导出；显示可恢复状态 | AC-E201–206；R-023/024/026/027 |
| E2-EV-REGRESSION | E1 与相邻 Analyzer 播放/Worker/资源 | regression | canonical runner | E1、M3/M4/M6/M11 适用步骤全部 pass；无新增 console/pageerror | R-022/023/027 |

## Canonical Contract

- `eval:e2:provisional` 允许 dirty worktree，只提供实现反馈。
- `eval:e2` 必须拒绝 dirty worktree，并绑定实现 commit、run ID、环境、浏览器、步骤、BPM/geometry/反馈测量、日志和 summary SHA-256。
- canonical 至少运行 E2 unit/integration/Chrome、E1 回归、M3/M4/M6/M11 相邻回归、docs、deliberate failure、typecheck、build 和 `git diff --check`。
- 本地 artifact 保留到 owner 审批；E2 record 在审批前为 `in-review`，不能开放 E3。

## Manual Review

Owner 在最新版 Chrome 检查波形、seek、wheel/right-drag、快速菜单、键盘、tempo boundary、拍号/BPM/single-beat、自动估计与刷新恢复。E2 不要求 Edge；真实 Edge 全量留到 E6，并作为明确覆盖边界保留。
