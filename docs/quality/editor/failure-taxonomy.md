---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/quality/editor/golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "E1 failure taxonomy 已批准并冻结；E2 使用独立扩展分类"
---

# Editor E1 Failure Taxonomy

`project-owner` 于 2026-08-26 随 E1 canonical evidence 批准本文及已登记的 provisional 失败实例。

失败实例同时记录 `failure_type` 与 `severity`；类型描述行为域，严重度描述当前影响。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-ENTRY | 路由/歌曲身份 | URL、当前歌曲或工程 hash 被错误替换、回退或混用 | E1-EV-ENTRY/CODEC | 阻断 E1，修复 identity 边界 |
| EFT-PLAY | 播放 lease | repeat-one、queue-next 恢复、旧 token 或单引擎所有权错误 | E1-EV-PLAY | 阻断 E1；检查 token/generation 与 ended policy |
| EFT-CONSUMER | 分析 consumer | Analyzer/Editor 争用、旧 token 生效、workspace 被改写或第二 Worker | E1-EV-CONSUMER | 阻断 E1；恢复单 consumer 所有权 |
| EFT-SCHEMA | 工程 schema/校验 | canonical 不确定、未知字段被接受、引用/时间/重叠校验错误 | E1-EV-CODEC | 阻断导入导出与 E1 canonical |
| EFT-DRAFT | 草稿原子性/恢复 | 同歌不恢复、异歌静默覆盖、quota/abort 损坏旧草稿 | E1-EV-DRAFT/SAVE | 阻断 E1；保留内存并修复事务 |
| EFT-FILE | 文件交互 | picker 取消、读写失败或歌曲不匹配改变当前工程 | E1-EV-FILE | 保留工程，显示可恢复错误；身份错误阻断 |
| EFT-LIFECYCLE | 清理/竞态 | 迟到 route/import/save、listener 或 beforeunload 状态泄漏 | integration/E2E | 阻断相应路径；补 generation/成对清理 |
| EFT-REGRESSION | Analyzer 回归 | E1 破坏既有播放、队列、Analyzer、build 或 docs | E1-EV-REGRESSION | 阻断 E1，不改写历史 canonical |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 数据损坏、错误歌曲覆盖或不可恢复的跨页面 runtime 失控 | 立即停止 canonical；不得豁免关闭 E1 |
| S1 | 核心入口、循环、导入导出或草稿恢复不可完成 | 阻断 E1 |
| S2 | 有明确恢复路径的局部错误、可访问性或状态表达缺陷 | 修复并复跑相关层；owner 决定是否需要全量重跑 |
| S3 | 不影响行为的低等级文案/诊断差异 | 记录并按 AC 判断，不得掩盖更高等级问题 |
