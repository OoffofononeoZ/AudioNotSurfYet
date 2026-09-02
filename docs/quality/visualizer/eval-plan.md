---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/risk-register.md"
next_action: "实现并运行 V1 provisional/canonical；owner 批准 evidence 前 V2 保持 Planned"
---

# Visualizer V1 Eval Plan

## Boundary

本计划只评价 V1 workspace foundation：route identity、通用 playback lease、三栏/抽屉工作台、中性单 Canvas、strict JSON V1、独立单草稿、原生导入导出与恢复保护。不评价 V2 数据绑定、V3/V4 场景效果、V5 WebM 或 V6 最终加固。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V1-EV-ROUTE | Header 当前歌曲、直接 route、空/无效目标 | success + failure | router/controller integration + Chrome/Edge E2E | URL 与歌曲 identity 精确；失败不静默切歌；空状态保留 MusicBar | AC-V101；R-034/R-036 |
| V1-EV-LEASE | `repeat-one`/`pause-at-end`、旧 token、离页恢复 | success + race + exception | fake engine/session integration + browser lifecycle | Visualizer ended 不 next/loop；Editor 仍循环；旧 release 无效；始终单 engine/clock | AC-V102；R-034 |
| V1-EV-LAYOUT | 三栏、互斥抽屉、16:9 Canvas、transport | success + boundary | DOMRect/computed style + keyboard E2E | 1280/1920 常驻三栏；1024 抽屉互斥；预览比误差 <=1 CSS px；控件可达 | AC-V103；R-038 |
| V1-EV-DEFAULT | 默认模板/output/seed/complete constants 与中性预览 | success + boundary | factory/registry unit + browser UI | `orthogonal-lines@1`、720p30、uint32 seed；两个模板只显示明确中性状态 | AC-V104；R-036/R-037 |
| V1-EV-CODEC | canonical JSON、strict validator、原子导入 | success + failure + boundary | versioned golden + unit/integration | encode/decode/encode bytes 一致；未知字段/schema/template、错歌、缺失/重复参数、非法 binding、>4 feature 在替换前拒绝 | AC-V105；R-036 |
| V1-EV-DRAFT | 独立 single draft、同歌恢复、异歌三选项 | success + exception | fake-indexeddb + refresh/navigation E2E | 只写 `draft/latest`；取消优先回旧工程；导出后仍确认覆盖 | AC-V106；R-036 |
| V1-EV-SAVE | 250ms autosave、flush、quota/abort、beforeunload | failure + race | fake timers + transaction fault injection | 单写入合并最新 snapshot；失败保留内存和旧 durable draft并发布 `not-persisted` | AC-V107；R-036 |
| V1-EV-RESOURCE | 单 Canvas、无分析 Worker、route/resize/template cleanup | boundary + regression | diagnostic counters + Chrome/Edge lifecycle | V1 页面最多一个 preview Canvas；无 Visualizer Worker/RAF；20 次进入退出无 listener/Canvas 单调累积 | AC-V108；R-038 |
| V1-EV-REGRESSION | M3/M4/M5/M11、Editor E1/E7、docs/build | regression | 21-step canonical runner | 全部步骤通过；无新增 console/pageerror；canonical 起止 commit/worktree identity 不变 | AC-V101–108；R-034/R-036/R-038 |

## Canonical Rule

- `eval:v1:provisional` 允许 dirty worktree，只作为实现反馈。
- `eval:v1` 必须拒绝 dirty worktree，固定 21 个步骤并登记 run ID、实现 commit、Chrome/Edge、Node/npm/Meyda、脱敏硬件、逐步日志和 summary SHA-256。
- canonical 使用受控 CC0 音频与浏览器 OPFS，不登记用户私有路径、文件名或设备标识。
- V1 evidence 在 owner 完成人工任务前保持 `in-review`；V2 不开放。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| 原生 OS 打开/保存 picker 和覆盖提示不能被 Playwright完整控制 | 系统对话框由浏览器/OS 拥有 | 自动化 OPFS 与真实权限/取消行为不同 | owner 在最新版 Chrome、Edge执行打开、保存、取消、覆盖与错歌检查 | project-owner |
| 原生 `beforeunload` 文案不可控制 | 文案由浏览器拥有 | 注册时机正确但用户体验可能不同 | 自动断言 pending/in-flight listener；owner 在两浏览器刷新/关闭检查 | project-owner |
| V1 没有真实场景和分析 | V2–V4 尚未开放 | 中性预览不能证明最终视觉/Worker 生命周期 | 明确标记中性状态；后续里程碑独立 canonical | project-owner |
