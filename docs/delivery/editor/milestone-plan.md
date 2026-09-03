---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
next_action: "E8 scoped/provisional 25/25 已通过；等待 clean canonical 与 owner 验收"
---

# Editor E1–E8 Milestone Plan

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
| E3 | Point annotation | Complete | E2 | point lane、inner class、自适应网格、鼠标/右键/键盘 | 26/26 clean canonical + owner approval | project-owner |
| E4 | Analysis overlay | Complete | E3 | 21 项单选纯 renderer overlay、三手柄和 pointer-through | 31/31 clean canonical + owner approval | project-owner |
| E5 | Range annotation | Complete | E4 | range 创建、取消、调整、重叠、删除和 round-trip | range matrix + import/draft + canonical + owner approval | project-owner |
| E6 | Final hardening | Complete | E5 | Chrome/Edge、三格式、native flows、10,000 事件、资源与无障碍 | 双浏览器 canonical + owner complete task + evidence approval | project-owner |
| E7 | Compact workbench + fullscreen overlay | Complete | E6 | 紧凑工作台、窗口级灰色浮层、复合入口、按歌曲 visibility 与双浏览器响应式 | 46 步 canonical + owner approval | project-owner |
| E8 | Timeline, recovery and marker usability | In Progress | E7 | `88px/72px` 时间轴、同歌自动恢复、异歌显式 replace 与 marker 中心对齐 | scoped/provisional + clean canonical + owner approval | project-owner |

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

- [x] AC-E301–AC-E306 已有 point、inner class、snapping 和 cleanup 自动化证据。
- [x] 鼠标/右键/键盘创建删除均可完成，焦点和非颜色状态明确。
- [x] 只实例化 viewport 可见事件 DOM；clean canonical 26/26 通过。
- [x] owner 批准 E3 evidence；只开放 E4。

### E4

- [x] AC-E401–AC-E405 覆盖 21 项与所有 renderer family；clean canonical 31/31 通过。
- [x] Buffer 去重、stale/cache identity、快速换特征与 Analyzer workspace 隔离通过。
- [x] 三手柄、pointer-through、`1 CSS px` 和 overlay 故障隔离通过。
- [x] owner 批准 E4 evidence；只开放 E5。

### E5

- [x] AC-E501–AC-E505 自动化覆盖创建、预览、取消、调整、删除和键盘；clean canonical 35/35 通过。
- [x] 半开区间、最短单位、相邻允许和重叠矩阵通过。
- [x] pointercancel/blur/route rollback 与 JSON/draft/import 安全通过。
- [x] owner 批准 E5 evidence；只开放 E6。

### E6

- [x] AC-E601–AC-E606 的可自动化部分在真实 Chrome/Edge canonical 有完整证据。
- [x] MP3/WAV/FLAC、native picker、离页/刷新恢复与辅助技术补偿检查完成。
- [x] 10,000 事件下输入 `<=100ms`、无归因任务 `>50ms`、DOM 可见化策略有效。
- [x] 20 次生命周期无 AudioContext/Worker/RAF/Canvas/listener 单调累积。
- [x] E1–E6 全量和 M3–M11 关键回归通过。
- [x] owner 完成完整逆向标注任务并批准 E6 canonical evidence。

### E7

- [x] AC-E701–AC-E704 的布局密度、分区、响应式和功能回归已由修订前候选通过。
- [x] AC-E705–AC-E708 的 fixed overlay、菜单/开关、visibility、analysis 收敛与滚动 geometry 通过。
- [x] 390/1024/1280/1920 与 Chrome/Edge 无关键遮挡，geometry 继续 `<=1 CSS px`。
- [x] 10,000 事件反馈、长任务、可见 DOM 与资源门禁不回退。
- [x] owner 批准紧凑工作台候选与 E7 canonical evidence；不补写未提供的人工测量值。

### E8

- [x] ADR-0018、AC-E801–AC-E805、测试策略与 quality 契约获实施批准。
- [x] scoped/provisional 中 `88px/72px`、6px 安全区、Canvas DPR 与控件无裁切在 390/1024/1280/1920 通过。
- [x] scoped/provisional 中同一 route 歌曲恢复自动进入且保持 paused；连续状态变化无重试循环。
- [x] scoped/provisional 中另一首有效歌曲只显示显式入口，点击 replace 正确 route；错误文件与草稿不变。
- [x] scoped/provisional 中 marker button、diamond、candidate 与事件 X/Y 误差均满足 `<=1 CSS px`，覆盖 zoom/pan/DPR。
- [x] scoped/provisional 中 E1/E2/E3/E7、M5 恢复、键盘、overlay 与 MusicBar 互斥回归通过。
- [ ] E8 implementation commit、clean canonical、evidence index 与 owner 验收完成；V5 已独立提交。

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
- E3：`Complete`。
- E4：`Complete`。
- E5：`Complete`。
- E6：`Complete`。
- E7：`Complete`。
- E8：`In Progress`。
- 当前下一门禁：提交 E8 implementation commit 并运行独立 clean canonical；owner 验收前不关闭风险、不进入 Editor readiness。

## 6. Delivery Approval

`project-owner` 于 2026-08-26 明确回复：

`我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。`

该批准使 E0-D `Complete`、E1 `In Progress`。2026-08-26，owner 又批准 E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；E1 据此改为 `Complete`，E2 改为 `In Progress`，不开放 E3。

2026-08-27，owner 批准 E2 结果并开放 E3；E2 据此改为 `Complete`，E3 改为 `In Progress`，E4–E6 保持 `Planned`。

同日，E3 clean canonical 26/26 通过并登记为 `in-review`。自动化退出清单前三项已满足；owner evidence 批准仍未完成，因此 E3 保持 `In Progress`，E4 保持 `Planned`。

同日，owner 明确批准 E3 canonical evidence 与 point task。E3 据此改为 `Complete`，E4 改为 `In Progress`，E5–E6 保持 `Planned`。

随后 E4 clean canonical `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 在实现 commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` 上 31/31 通过；overlay 几何误差 `1 CSS px`、穿透点击反馈 `5.1ms`。自动化退出清单前三项已满足；owner evidence 批准仍未完成，因此 E4 保持 `In Progress`、E5 保持 `Planned`。

同日，owner 明确批准 E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果。E4 据此改为 `Complete`，E5 改为 `In Progress`，E6 保持 `Planned`。

随后 E5 实现 commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 交付 range lane/class、两阶段创建、preview/取消、端点调整与回滚、半开重叠、键盘和持久化。clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 35/35 通过，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`。自动化退出项已满足；owner evidence 批准仍未完成，因此 E5 保持 `In Progress`、E6 保持 `Planned`。

同日，`project-owner` 明确批准 E5 canonical evidence、范围事件创建/调整、重叠校验、键盘与持久化结果，并同意关闭 E5、开放 E6。E5 据此改为 `Complete`，E6 改为 `In Progress`；本批准不构成 E6 evidence 或 Editor release-readiness。

2026-08-28，E6 clean canonical `E6-2026-08-27T15-52-33-466Z-17d7fe10` 在 commit `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` 上 40/40 通过。owner 随后批准 canonical 与原生文件、`beforeunload`、辅助技术及长会话补偿，E6 据此关闭；紧凑工作台作为 E7 独立开放，Editor readiness 延后。

同日，E7 紧凑工作台实现 commit `78bc7f06311a09948e5efae941a14599305b81a5` 完成双层工具栏、平面分区、44px 标记行和响应式工作区。clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 44/44 通过，summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`；自动化退出项已满足，但 owner 视觉任务与 evidence 批准前 E7 继续为 `In Progress`。

2026-08-29，owner 在审批前把 E7 overlay 修订为窗口级全屏 fixed 灰色层、复合开关/菜单与按歌曲本地 visibility。上述 44/44 run 因而只保留为 `pre-revision` 历史证据；E7 不关闭，正式候选改为 46 步。

随后修订版实现 commit `080f577fe20fcb22a20184dce0b15892c5299464` 交付 Teleport 全屏层、复合入口、21 项临时菜单、按歌曲 visibility 与 Buffer-only 关闭状态。clean canonical `E7-2026-08-29T05-23-03-986Z-080f577f` 46/46 通过，summary SHA-256 为 `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5`；自动化退出项已满足，owner 人工门禁仍未完成。

2026-08-31，owner 在明确要求“先完成当前 Editor E7 的 owner 审批；E7 关闭前不实施 M13”的计划上回复“PLEASE IMPLEMENT THIS PLAN”。该指令批准上述修订版候选并关闭 E7；记录只采用已有 46/46、artifact 与人工补偿事实，不虚构额外测量。

2026-09-03，owner 以“PLEASE IMPLEMENT THIS PLAN”批准 E8 时间轴、不可用恢复与 marker 修正计划，并开放 E8。E8 当前为 `In Progress`；该批准不代替 clean canonical 或 owner 验收，E1–E7 历史状态不变。
