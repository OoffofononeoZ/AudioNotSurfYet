---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
next_action: "V1 已批准并关闭；V2 为 In Progress，先提交 quality contract 再实现数据绑定"
---

# Visualizer V0-D and V1–V6 Milestone Plan

## 1. Planning Convention

- Target 使用相对门禁，不表示日历承诺。
- `Complete` 只用于上游批准、clean canonical、适用人工任务和 owner evidence 批准均满足的里程碑。
- `In Review` 表示文档已形成但尚未授权实施；`Planned` 表示依赖尚未关闭。
- 每个 V1–V6 独立 provisional、实现提交、clean canonical 和 owner 审批；一个未关闭时不开放下一个。
- Analyzer/Editor canonical 和 readiness 只作相邻回归与历史证据，不能被 Visualizer 继承为通过。

## 2. Milestones

| ID | Milestone | Status | Relative target | Depends on | Implementation outcome | Exit evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V0-P | Product intent | Complete | Product gate | Analyzer/Editor historical baseline | 当前歌曲、单场景、两个模板、0–4 特征和 WebM 路线 | product docs、DEC-037、PROD-014V approved | project-owner |
| V0-A | System design | Complete | Architecture gate | V0-P | route/analysis lease、project/binding、scene/renderer、recording、R-034–R-041 | system/contracts/subcontracts、ADR-0014–0017 approved | project-owner |
| V0-D | Execution planning | Complete | Delivery gate | V0-A | Visualizer 专属 execution、AC、test strategy、milestone plan | 四份文档 owner approved | project-owner |
| V1 | Workspace foundation | Complete | First implementation gate | V0-D | route、pause-at-end、三栏/抽屉、单 Canvas、JSON V1、单草稿、导入导出 | V1 eval contract + provisional + clean canonical + owner approval | project-owner |
| V2 | Data binding | In Progress | Binding gate | V1 | constant/analysis/editor-event、0–4 planner、Editor snapshot、deterministic resolver | planner/projection/golden + Chrome canonical + owner approval | project-owner |
| V3 | Orthogonal Lines | Planned | First scene gate | V2 | 横/竖线、point pulse、range gate、参数 inspector | scene state golden + Chrome canonical + owner approval | project-owner |
| V4 | Cube Swarm | Planned | Second scene gate | V3 | spectrum core、drum scale、Energy rise、constant orbit、context restore | deterministic/resource/context canonical + owner approval | project-owner |
| V5 | WebM export | Planned | Recording gate | V4 | pre-Gain tap、strict preset、MediaRecorder、native save | Chrome/Edge 720p30 + ffprobe/A-V sync + owner approval | project-owner |
| V6 | Final hardening | Planned | Readiness evidence gate | V5 | 双浏览器、三格式、15 分钟四特征、资源、无障碍与全回归 | V1–V6 canonical + owner complete task/evidence approval | project-owner |

## 3. Gate State

- 当前：V0-P、V0-A、V0-D、V1 均为 `Complete`，V2 为 `In Progress`，V3–V6 保持 `Planned`。
- V1 run `V1-2026-09-02T07-03-26-973Z-fd44c892` 21/21 通过，并于 2026-09-02 获 owner 批准；canonical identity 不变且无需重跑。
- V6 获批后只进入包含 Visualizer 的整体 release-readiness review；PROD-015 仍阻断生产上线。

## 4. Failure and Slip Rules

- quality/eval 契约缺失：不得开始对应实现或产生 canonical 声明。
- provisional/canonical 失败：保留失败 artifact，修复后创建新实现 commit 和新 run，不覆盖旧身份。
- 人工门禁失败：当前里程碑保持 `In Progress`，下一里程碑保持 `Planned`。
- Chrome/Edge、FFmpeg/ffprobe、三格式或 15 分钟数据缺失：标记 blocked/evidence gap，不用其他浏览器、轻量输入或截图代替。
- 1080p60 等非默认 preset 可以按架构记录 unavailable；默认 720p30 在任一目标浏览器无有声音视频输出时，V5 不关闭。
- system design 发生实质变化时回到 architecture review；阈值或测试矩阵变化时 delivery 与下游 quality 待复核。

## 5. Approval Gate

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017；随后批准四份 delivery planning 并开放 V1。R-034–R-041 仍为 `Open`，V2–V6 未开放。

批准语句（2026-09-02）：

`我批准 Visualizer V1–V6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 V1。`
