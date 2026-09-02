---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/eval-plan.md"
  - "docs/quality/visualizer/golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "owner 按 VFT-* 与 S0–S3 复核 V1 canonical 和人工门禁；未来失败不得覆盖现有 artifact"
---

# Visualizer V1 Failure Taxonomy

失败实例同时记录稳定的行为类型与独立严重度。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| VFT-ROUTE | route/歌曲 identity | URL、当前歌曲或工程 identity 被错误回退、替换或混用 | V1-EV-ROUTE/CODEC | 阻断 V1；修复 identity/generation 边界 |
| VFT-LEASE | playback lease | ended policy、旧 token、queue-next 恢复、Editor repeat-one 或单时钟所有权错误 | V1-EV-LEASE | 阻断 V1；修复 token/policy/cleanup |
| VFT-PROJECT | project/schema | canonical 不稳定、未知字段被接受、template/parameter/binding/track 校验错误 | V1-EV-CODEC/DEFAULT | 阻断导入导出与 canonical |
| VFT-DRAFT | draft/事务 | 同歌不恢复、异歌静默覆盖、quota/abort 破坏旧草稿或 autosave 错序 | V1-EV-DRAFT/SAVE | 保留内存，修复事务与 revision |
| VFT-FILE | native file flow | picker 取消、读写失败或错歌导入改变当前工程 | V1-EV-CODEC/DRAFT + manual | 保留工程，显示可恢复错误；身份错误阻断 |
| VFT-LAYOUT | workspace/可访问性 | 三栏/抽屉/16:9/transport 遮挡、不可达或焦点丢失 | V1-EV-LAYOUT | 修复并重跑多视口/键盘矩阵 |
| VFT-RESOURCE | lifecycle/resource | 多 Canvas、Visualizer Worker/RAF、listener 或 route policy 累积 | V1-EV-RESOURCE/REGRESSION | 阻断 V1；恢复单所有者与对称 cleanup |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 数据损坏、错误歌曲覆盖或不可恢复的跨 route runtime 失控 | 立即停止 canonical；不得豁免关闭 V1 |
| S1 | 核心 route、播放、工程、导入导出或草稿恢复不可完成 | 阻断 V1 |
| S2 | 有明确恢复路径的局部布局、可访问性或状态表达缺陷 | 修复并复跑相关层；决定是否全量重跑 |
| S3 | 不影响行为的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高等级问题 |
