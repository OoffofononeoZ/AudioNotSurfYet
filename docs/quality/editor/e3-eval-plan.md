---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/editor/interaction-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "owner 按 E3 fixture 完成人工任务并批准 canonical evidence"
---

# Editor E3 Eval Plan

## Boundary

本计划只评价 E3 point lane、inner class、自适应吸附、point 创建/删除、共享右键状态与 viewport-visible DOM。E1/E2 是已批准回归基线；E4 overlay、E5 range 编辑与 E6 双浏览器/10,000 事件不在本轮完成范围。导入的 range lane 必须保留并只读展示，不能因 E3 尚未提供 range 交互而丢失数据。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E3-EV-LANE | point lane 与 inner class 新增、重命名、最少一个分类 | success + boundary | pure unit + Chrome DOM | 新 lane 有稳定 ID、顺序名称和 `default`；空名称拒绝；最后一个分类不可删除 | AC-E301；R-023/025 |
| E3-EV-MIGRATE | 含事件分类迁移或明确删除 | success + conflict + cancel | domain unit + dialog E2E | 无隐式删除；迁移冲突阻断并报告；取消不改 project/draft | AC-E301；R-023/025 |
| E3-EV-SNAP | 共享 tempo geometry 与 adaptive subdivision | success + zoom + boundary | pure unit + browser geometry probe | 按 12 CSS px 在 1/16–1 beat 选最细可靠单位；single-beat 整段一格；层间误差 `<=1 CSS px` | AC-E302；R-024 |
| E3-EV-POINT | 鼠标/键盘创建、唯一性和删除 | success + duplicate + track edge | unit + Chrome E2E | 微秒规范化 key 唯一；重复只聚焦/提示；0 与 duration 合法；右键和 Delete 等价 | AC-E303/304；R-023/025 |
| E3-EV-KEYBOARD | 候选移动、焦点回退与非颜色语义 | keyboard + accessibility | keyboard E2E + DOM inspection | Enter/Space、方向键、Home/End、Delete、Esc 完成核心任务；焦点可见且不落到 body | AC-E304；R-025 |
| E3-EV-DOM | Canvas grid 与 viewport-visible event DOM | capacity + viewport | component integration + browser count | 空 cell 无节点；viewport 外 point 无 marker DOM；进入 viewport 后按稳定 event ID 恢复 | AC-E305；R-025 |
| E3-EV-POINTER | point 删除、4px pan、quick menu 与 cleanup 优先级 | pointer + cancel + exception | state unit + Chrome E2E | marker 右键只删除；3.9px 打开菜单、4px 只 pan；取消/blur/离页无 capture/menu/pressed | AC-E306；R-025 |
| E3-EV-DRAFT | point 变更、迁移与 quota | persistence + failure | controller/repository integration | 内存先更新；完成交互立即 flush；失败保留内存与旧 durable draft并发布 `not-persisted` | AC-E301/303；R-023 |
| E3-EV-REGRESSION | E1/E2 与相邻 Analyzer 播放/Worker/资源 | regression | canonical runner | E1/E2、M3/M4/M6/M11 适用步骤通过；tempo 修改不改已有 point 秒数；无新增 console/pageerror | R-022–R-027 |

## Evidence Method

- `test:e3:unit` 固定 domain、snapping、唯一性、visible filter 与 cleanup。
- `test:e3:integration` 固定 controller/draft、JSON round-trip、迁移/删除、tempo 不改 point 秒数和可见 DOM 模型。
- `test:e2e:e3` 在稳定 Chrome 验证 1024/1280/1920、代表性 DPR、reduced motion、pointer、keyboard、焦点、geometry、DOM count 与 console。
- `eval:e3:provisional` 允许 dirty worktree，仅作为实现反馈；`eval:e3` 必须在 clean HEAD 运行并记录 run ID、commit、环境、步骤结果、日志和 summary SHA-256。
- canonical 包含 E3 专项、E1/E2、M3/M4/M6/M11 相邻回归、docs、deliberate failure、typecheck、build 与 `git diff --check`。

## Approval Boundary

E3 只在 clean canonical、owner point task 与 evidence 批准均完成后关闭。真实 Edge、原生 picker、辅助技术长会话和 10,000 事件留到 E6；本轮 Chrome 自动化不能替代这些门禁。E3 evidence 获批前 E4 保持 `Planned`。
