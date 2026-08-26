---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/risk-register.md"
next_action: "在已提交契约上完成 E1 provisional 与 clean canonical；登记 evidence 后请求 owner 审批"
---

# Editor E1 Eval Plan

## 1. Boundary

本计划只评价 E1 的路由入口、playback/analysis lease、JSON V1、单草稿、导入导出与恢复保护，不评价 E2 时间轴/BPM、E3 point UI、E4 overlay、E5 range UI 或 E6 双浏览器最终加固。Analyzer M3–M11 evidence 保留为相邻回归基线，不能替代 Editor 证据。

## 2. Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E1-EV-ENTRY | Header 当前歌曲、播放列表指定歌曲、空/无效路由 | success + failure | unit/integration + Chrome E2E | 目标身份精确；失败不切换其他歌曲；Tooltip/accessible name 为“去编辑” | AC-E101/102；R-022/023 |
| E1-EV-PLAY | repeat-one、旧 token、离页 queue-next 恢复 | success + race + exception | fake engine integration + Chrome lifecycle | 同一 buffer 循环；旧/重复 release 无效；始终单 engine/RAF | AC-E103；R-022 |
| E1-EV-CONSUMER | Analyzer/Editor consumer 互斥与 stale generation | race + resource | coordinator integration + route E2E | 只有最新 token 生效；Editor E1 不启动 feature job；Analyzer workspace 不改写 | AC-E108；R-027 |
| E1-EV-CODEC | JSON canonical、round-trip、strict validator | success + boundary | deterministic unit/golden | 两次编码 bytes 相同；微秒规范化；所有规定无效输入在替换前拒绝 | AC-E104/105；R-023 |
| E1-EV-DRAFT | 单草稿、同歌恢复、异歌三选项 | success + exception | fake-indexeddb + Chrome refresh/navigation | 只使用 `draft/latest`；取消优先回旧工程；旧歌不可恢复时保留草稿并返回原页面 | AC-E106；R-023 |
| E1-EV-SAVE | 250ms autosave、flush、quota/abort | failure + race | fake timers + transaction fault injection | 单写入+最新 pending；失败保留内存和旧 durable 值并发布 `not-persisted` | AC-E107；R-023 |
| E1-EV-FILE | 原生 JSON import/export、用户取消和不支持状态 | success + failure | injected picker automation + owner native check | 取消不改工程；校验通过后才原子替换；无隐藏 fallback | AC-E104–107；R-023 |
| E1-EV-REGRESSION | M3/M6/M11 相邻播放、Worker、路由、build/docs | regression | canonical runner | 全部适用步骤 pass；无新增 console/pageerror | AC-E103/108；R-022/027 |

## 3. Canonical Rule

- `eval:e1:provisional` 允许 dirty worktree，只提供实现反馈。
- `eval:e1` 必须拒绝 dirty worktree，绑定完整 commit、Chrome/Node/npm/硬件、步骤日志和 summary SHA-256。
- canonical 至少包含 E1 unit、integration、Chrome E2E、相邻 Analyzer 回归、typecheck、build、docs、deliberate failure 与 `git diff --check`。
- E1 evidence 在 owner 完成人工任务前保持 `in-review`；E2 不开放。

## 4. Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| 原生 OS 打开/保存 picker 无法完全自动化 | Playwright 不能可靠代替系统对话框 | 取消、覆盖提示或权限在真实环境不同 | owner 在最新版 Chrome 执行打开、保存、取消与覆盖检查 | project-owner |
| 浏览器原生 `beforeunload` 文案不可控制 | 文案由浏览器拥有 | 刷新/关闭提示时机错误 | 自动断言 listener 状态；owner 验证 pending write 时刷新/关闭 | project-owner |
| E1 不执行 Edge 专项 | 已批准策略将 E1–E5 专项限定为 Chrome，Edge 在 E6 全量 | Edge 早期实现差异延后暴露 | 标记为计划性缺口；E6 真实 Edge 阻断关闭 | project-owner |
