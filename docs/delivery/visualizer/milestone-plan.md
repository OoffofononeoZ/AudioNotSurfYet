---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
next_action: "V1–V6 保持关闭；实现 DEC-058 fullscreen 并由 owner 自行审阅，不创建 V7"
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
| V2 | Data binding | Complete | Binding gate | V1 | constant/analysis/editor-event、0–4 planner、Editor snapshot、deterministic resolver | clean canonical 26/26 + owner approval | project-owner |
| V3 | Orthogonal Lines | Complete | First scene gate | V2 | 单 RendererHost、横/竖线、point pulse、range gate、60Hz 余辉与错误隔离 | 30/30 clean canonical + owner approval | project-owner |
| V4 | Cube Swarm | Complete | Second scene gate | V3 | spectrum core、drum scale、Energy rise、constant orbit、context restore | 34/34 clean canonical + owner approval | project-owner |
| V5 | WebM export | Complete | Recording gate | V4 | pre-Gain tap、strict preset、MediaRecorder、native save | 40/40 clean canonical + owner approval | project-owner |
| V6 | Final hardening | Complete | Readiness evidence gate | V5 | 双浏览器、三格式、15 分钟四特征、资源、无障碍与全回归 | V1–V6 canonical + owner complete task/evidence approval | project-owner |

## 3. Gate State

- 当前：V0-P、V0-A、V0-D、V1–V6 均为 `Complete`。
- V1 run `V1-2026-09-02T07-03-26-973Z-fd44c892` 21/21 通过，并于 2026-09-02 获 owner 批准；canonical identity 不变且无需重跑。
- V2 run `V2-2026-09-02T08-46-21-778Z-769faafe` 26/26 通过，并于 2026-09-02 获 owner 批准；canonical identity 与 summary SHA-256 保持不变且无需重跑。
- V3 run `V3-2026-09-02T13-32-42-513Z-89be30eb` 30/30 通过，并于 2026-09-03 获 owner 批准；V3 为 `Complete`。
- V4 run `V4-2026-09-02T17-47-40-271Z-5c2d24a3` 在 commit `5c2d24a3f1f413dba236563b3686237c6b8f2e21` 上 34/34 通过，summary SHA-256 为 `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2`；2026-09-03 owner 批准 evidence 并关闭 V4，无需重跑。
- V5 run `V5-2026-09-03T03-49-31-211Z-9b5af09c` 在 implementation commit `9b5af09c5846415a8e5465e710e6095f1e7db310` 上 40/40 通过，summary SHA-256 为 `cec1fab0310852458c2aa4fbd3bebc90eee3e213a54b7695a524736e07b07b7b`；2026-09-03 owner 批准 evidence 与人工门禁，V5 已关闭且无需重跑。
- V6 golden/unit/integration、Chrome、Edge 与六文件 media 专项已完成；clean canonical `V6-2026-09-03T16-33-03-497Z-ef12ce39` 在 implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` 上 54/54 通过，summary SHA-256 为 `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014`。2026-09-04 owner 批准 evidence 与人工任务，V6 已关闭且无需重跑。
- V6 关闭后只进入包含 Visualizer 的整体 release-readiness review；PROD-015 仍阻断生产上线。

### Post-V6 readiness correction

DEC-050 的一屏工作台与侧栏滚动是 release-readiness 修订项，不是 V7，也不改变 V6 的 `Complete` 或历史 canonical。独立 clean implementation commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 已通过 Chrome/Edge targeted regression 并登记到 readiness；owner 视觉确认前 readiness 保持 `in-review`。

DEC-058 的原生全屏同样是 post-V6 readiness 修订，不创建 V7、不重开 V6。原 viewport 候选标为 `pre-fullscreen`；本轮只要求可运行，互动与视觉由 owner 自行审阅，R-045 在明确批准前保持 `Open`。

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

V2 批准与 V3 开放原文（2026-09-02）：

`使用项目相关技能执行此计划`

本原文按随附计划登记为 V2 evidence 批准和 V3 实施授权，不扩写用户未提供的逐项人工观察值。
