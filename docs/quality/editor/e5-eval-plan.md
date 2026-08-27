---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/editor/project-format-v1.md"
  - "docs/architecture/editor/interaction-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "实现 E5 专项、dirty provisional 与 clean 35 步 canonical；owner 批准前 E6 保持 Planned"
---

# Editor E5 Eval Plan

## Boundary

本计划只评价 E5 range lane、inner class、两阶段创建、预览/取消、端点调整、半开重叠、删除、键盘路径和 point/range 持久化。E1–E4 是已批准回归基线；E6 的真实 Edge、三格式、原生 picker、10,000 事件、资源与辅助技术长会话不在本轮完成范围。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E5-EV-LANE | range lane 与 inner class 管理 | success + empty + migration conflict | pure unit + Chrome DOM | 新 lane 为“范围标记 N”与 `default`；最后分类不可删；迁移重叠整体拒绝并报告数量 | AC-E503/E505；R-023/025 |
| E5-EV-CREATE | 两次点击/键盘创建和 pending preview | success + backward/overlap failure + cancel | state-machine unit + Chrome E2E | 只有更晚且合法的吸附终点完成；preview 不持久化；Esc/空白右键取消 | AC-E501/E503；R-025 |
| E5-EV-INTERVAL | 半开区间与最短单位 | boundary + tempo transition + track edge | property/unit + golden | `[start,end)`；相邻允许、真实相交拒绝；0/duration 合法；最短为下一个有效吸附位置 | AC-E502/E503；R-023/024 |
| E5-EV-HANDLE | 两端 pointer/keyboard 调整 | success + crossing/overlap + cancel | pure command + drag/keyboard E2E | pointerup 一次提交；非法不改工程；pointercancel/lost capture/blur 恢复原值；端点不可穿越 | AC-E502/E504；R-024/025 |
| E5-EV-RIGHT | range 删除、pending 取消、4px pan 与 quick menu | pointer precedence + exception | state unit + Chrome E2E | 优先级与批准契约一致；无浏览器菜单、误删、误 pan 或遗留 capture | AC-E501/E504；R-025 |
| E5-EV-KEYBOARD | 创建、取消、端点选择/调整和删除 | keyboard + focus + non-color | keyboard E2E + DOM inspection | Enter/Space、Esc、Tab、方向键、Delete/Backspace 可完成任务；焦点可见且不落到 body | AC-E501/E504；R-025 |
| E5-EV-DRAFT | range autosave、round-trip 与严格导入 | persistence + failure + reload | codec/repository integration + Chrome refresh | 完成操作立即 flush；quota 保留内存；invalid/overlap/out-of-range 导入不替换工程或 durable draft | AC-E505；R-023 |
| E5-EV-GEOMETRY | grid、range、端点与 overlay pointer-through | viewport + DPR + overlay | geometry probe + layered E2E | 同一时间各层 x 差 `<=1 CSS px`；overlay 显示时命中与隐藏时一致 | AC-E502/E504；R-024/025 |
| E5-EV-REGRESSION | E1–E4 与相邻 Analyzer | regression | 35 步 canonical | route/playback、tempo、point、overlay、renderer、Worker 和 build/docs 无回归 | R-022–R-027 |

## Evidence Contract

- `eval:e5:provisional` 允许 dirty worktree，只提供实现反馈；正式 evidence 只接受 clean implementation commit 上的 `eval:e5`。
- canonical 固定为 E4 31 步基线加 E5 golden/unit/integration/Chrome，共 35 步；记录 run ID、commit、环境、geometry、feedback、DOM、日志与 summary SHA-256。
- E5 专项使用真实 Chrome，覆盖 1024/1280/1920、代表性 DPR、reduced motion、pointer、keyboard、console/pageerror。
- owner 需人工完成长音色/效果创建、取消、调整、重叠矩阵、overlay 穿透、刷新和 JSON round-trip；批准前 E5 保持 `In Progress`、E6 保持 `Planned`。
