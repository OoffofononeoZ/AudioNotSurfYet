---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
next_action: "完成 E3 point annotation、clean canonical 与 owner 复核；批准前 E4 保持 Planned"
---

# Editor E1–E6 Milestone Plan

## 1. Planning Convention

- Target 使用相对门禁，不表示日期承诺。
- `Complete` 只用于上游批准、clean canonical、适用人工任务和 owner evidence 批准均满足的里程碑。
- `In Review` 表示文档已形成但尚未授权实施；`Planned` 表示依赖尚未关闭。
- 每个 E 里程碑独立 provisional、clean canonical 和 owner 审批；一个未关闭时不开放下一个。
- Analyzer M1–M11 与 Analyzer-only readiness 保持历史状态，不作为 Editor 通过证据。

## 2. Milestones

| ID | Milestone | Status | Depends on | Implementation outcome | Exit evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| E0-P | Product intent | Complete | Analyzer readiness approval | 用户、逆向制曲问题、点/范围事件、指标、非目标和开放问题 | product docs approved；DEC-023/PROD-014E/PROD-020 生效 | project-owner |
| E0-A | System design | Complete | E0-P | runtime lease、JSON/draft、time/event、overlay、风险与 ADR | system design/contracts/R-022–R-027/ADR-0006–0009 approved | project-owner |
| E0-D | Execution planning | Complete | E0-A | Editor 专属 execution plan、AC、test strategy、milestone plan | 四份文档于 2026-08-26 获批；E1 明确开放 | project-owner |
| E1 | Entry, playback and project foundation | Complete | E0-D | 路由、当前/指定歌曲、repeat lease、JSON V1、单草稿、导入导出和恢复保护 | E1 18/18 clean canonical + owner approval | project-owner |
| E2 | Timeline and tempo | Complete | E1 | 波形、共享 viewport、tempo map、grid 与 BPM estimator | 22/22 clean canonical + owner approval | project-owner |
| E3 | Point annotation | In Progress | E2 | point lane、inner class、自适应网格、鼠标/右键/键盘 | point task + performance/accessibility + canonical + owner approval | project-owner |
| E4 | Analysis overlay | Planned | E3 | 21 项单选纯 renderer overlay、三手柄和 pointer-through | renderer/geometry/isolation + canonical + owner approval | project-owner |
| E5 | Range annotation | Planned | E4 | range 创建、取消、调整、重叠、删除和 round-trip | range matrix + import/draft + canonical + owner approval | project-owner |
| E6 | Final hardening | Planned | E5 | Chrome/Edge、三格式、native flows、10,000 事件、资源与无障碍 | 双浏览器 canonical + owner complete task + evidence approval | project-owner |

## 3. Exit Checklist by Milestone

### E0-D — Current Gate

- [x] 四份 Editor delivery 文档均为 `approved`。
- [x] E1–E6 的 AC、risk、test 和 evidence cadence 可追溯。
- [x] 10,000 事件、overlay 35%/12% 与每里程碑独立 canonical/owner approval 已固定。
- [x] 批准时 Editor 命令和代码尚不存在。
- [x] owner 只开放 E1，E2–E6 保持 `Planned`。

### E1

- [x] AC-E101–AC-E108 已有 unit/integration/Chrome 自动化证据候选。
- [x] 单 engine/Worker、repeat release 和 route/track 序列自动化通过。
- [x] JSON strict round-trip、atomic import、single draft、quota 与异歌三选项自动化通过；原生 picker/离页提示仍待人工复核。
- [x] E1 provisional 与 clean canonical 已完成并登记 identity/hash/environment。
- [x] owner 批准 E1 evidence；只开放 E2。

### E2

- [x] AC-E201–AC-E206 有 pure/Worker/Chrome 证据候选。
- [x] 多视口/DPR/zoom 各层 geometry 差不超过 1 CSS px；clean Chrome 实测 `0.1484 CSS px`。
- [x] 60/100/128/127.5 BPM 容差及三类 low-confidence golden 通过。
- [x] tempo 输入、single-beat、stale/cancel 与 E1 回归通过；clean canonical 22/22。
- [x] owner 批准 E2 evidence；只开放 E3。

### E3

- [ ] AC-E301–AC-E306 有 point、inner class、snapping 和 cleanup 证据。
- [ ] 鼠标/右键/键盘创建删除均可完成，焦点和非颜色状态明确。
- [ ] 只实例化 viewport 可见事件 DOM。
- [ ] owner 批准 E3 evidence；只开放 E4。

### E4

- [ ] AC-E401–AC-E405 覆盖 21 项与所有 renderer family。
- [ ] Buffer 去重、stale/cache identity、返回 Analyzer workspace 恢复通过。
- [ ] 三手柄、pointer-through、1 CSS px 和 overlay 故障隔离通过。
- [ ] owner 批准 E4 evidence；只开放 E5。

### E5

- [ ] AC-E501–AC-E505 覆盖创建、预览、取消、调整、删除和键盘。
- [ ] 半开区间、最短单位、相邻允许和重叠矩阵通过。
- [ ] pointercancel/blur/route rollback 与 JSON/draft/import 安全通过。
- [ ] owner 批准 E5 evidence；只开放 E6。

### E6

- [ ] AC-E601–AC-E606 在真实 Chrome/Edge 有完整证据。
- [ ] MP3/WAV/FLAC、native picker、离页/刷新恢复与辅助技术补偿检查完成。
- [ ] 10,000 事件下输入 `<=100ms`、无归因任务 `>50ms`、DOM 可见化策略有效。
- [ ] 20 次生命周期无 AudioContext/Worker/RAF/Canvas/listener 单调累积。
- [ ] E1–E6 全量和 M3–M11 关键回归通过。
- [ ] owner 完成完整逆向标注任务并批准 E6 canonical evidence。

## 4. Failure and Slip Rules

- canonical 失败：修复原因并重新提交后再运行新的 clean canonical；失败 run 保留身份与分类，不能覆盖。
- 人工门禁失败：里程碑保持 `In Progress`，后续保持 `Planned`；补偿自动化不能伪造 owner 结果。
- R-022–R-027 只有在对应实现和可复现证据出现后才能改为 `Mitigated`；架构批准本身不改变风险状态。
- fixture、浏览器或性能环境缺失时标记 blocked/evidence gap，不以其他浏览器、合成结果或缩小数据代替。
- 系统设计发生实质变化时回到 architecture review；delivery 阈值变化时本规划与后续 evidence 待复核。

## 5. Current Gate State

- E0-P：`Complete`。
- E0-A：`Complete`。
- E0-D：`Complete`。
- E1：`Complete`。
- E2：`Complete`。
- E3：`In Progress`。
- E4–E6：`Planned`。
- 当前唯一下一门禁：E3 专项、clean canonical、人工任务与 owner evidence 批准。

## 6. Delivery Approval

`project-owner` 于 2026-08-26 明确回复：

`我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。`

该批准使 E0-D `Complete`、E1 `In Progress`。2026-08-26，owner 又批准 E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；E1 据此改为 `Complete`，E2 改为 `In Progress`，不开放 E3。

2026-08-27，owner 批准 E2 结果并开放 E3；E2 据此改为 `Complete`，E3 改为 `In Progress`，E4–E6 保持 `Planned`。
