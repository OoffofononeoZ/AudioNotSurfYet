---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e3-eval-plan.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "E4/E6 回归 point、pointer、focus 与 visible-DOM 失败分类"
---

# Editor E3 Failure Taxonomy

E3 继续沿用 E1/E2 的 `EFT-DRAFT`、`EFT-GEOMETRY`、`EFT-VIEWPORT`、`EFT-TEMPO` 与 `EFT-REGRESSION`；新行为域增加以下稳定分类。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-LANE | lane/inner class 不变量 | 空名称、最后分类被删、ID/顺序或 range 数据被 E3 意外改写 | E3-EV-LANE/MIGRATE | 阻断 E3；回到纯 project command 修复 |
| EFT-MIGRATION | 分类迁移或删除损坏 | 引用悬空、冲突被静默合并、取消仍修改工程 | E3-EV-MIGRATE/DRAFT | 阻断 E3；保留原 project/draft并复跑 codec |
| EFT-SNAP | point 吸附错误 | subdivision 阈值、single-beat、segment 边界或微秒规范化错误 | E3-EV-SNAP/POINT | 阻断 point 创建；收敛到共享 snap 纯函数 |
| EFT-POINT | point 唯一性或命令错误 | 重复 point、误删、错误分类/时间、键盘与鼠标语义不一致 | E3-EV-POINT/KEYBOARD | 阻断 E3；恢复命令原子性并复跑 round-trip |
| EFT-POINTER | 右键/capture/cleanup 泄漏 | marker 右键打开菜单、pan 创建事件、取消后残留 pressed/capture/menu | E3-EV-POINTER | 阻断受影响交互；统一状态清理入口 |
| EFT-FOCUS | 焦点或非颜色语义错误 | marker 离开 viewport 后焦点落 body、键盘无法继续、状态只靠颜色 | E3-EV-KEYBOARD/DOM | 阻断键盘门禁；恢复候选控制与 ARIA 状态 |
| EFT-VISIBLE-DOM | 可见化边界失效 | viewport 外事件仍创建 DOM、稳定 ID 丢失或空 cell 节点爆炸 | E3-EV-DOM | 阻断 E3；只保留当前横向 viewport marker |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 工程、range 数据或 durable draft 被破坏 | 立即停止 canonical，不得豁免关闭 E3 |
| S1 | point 创建/删除、吸附、键盘或 geometry 核心任务不可完成 | 阻断 E3 |
| S2 | 可恢复的局部焦点、动画、提示或菜单表达错误 | 修复并复跑相关 unit/E2E；按影响决定全量重跑 |
| S3 | 不影响事实与任务的文案或视觉轻微偏差 | 记录并由 owner 决定是否阻断人工批准 |

canonical 失败保留 run identity、日志和分类；修复必须形成新实现 commit 和新 clean canonical，不能覆盖失败证据。E3 不把未执行的 Edge、10,000 事件或 E4/E5 功能归为通过。
