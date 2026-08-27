---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e3-eval-plan.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "用版本化 point golden、Vitest 与 Chrome 场景实现 E3-G01–G14"
---

# Editor E3 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E3-G01 | success | 新建第一个 point lane | 名称“点标记 1”、kind `point`、唯一 `default` inner class、无事件 | 固定首个可编辑事实 |
| E3-G02 | boundary | 删除唯一 inner class | 控件禁用或操作拒绝，project/draft 不变 | 保证 schema 最少一个分类 |
| E3-G03 | success | 删除无事件的非唯一 inner class | 立即删除并 flush，其他顺序与事件不变 | 固定安全简单路径 |
| E3-G04 | success | 含事件分类迁移到无冲突目标 | 事件只改 `innerClassId`，event ID/秒数保持 | 防止迁移改变音频事实 |
| E3-G05 | failure | 迁移目标在同一微秒已有 point | 阻止迁移并报告冲突数，不删除或去重 | 防止静默数据丢失 |
| E3-G06 | boundary | 12 CSS px 临界宽度前后 | 低于阈值使用更粗单位，达到阈值使用对应最细 subdivision | 固定自适应精度切换 |
| E3-G07 | boundary | single-beat segment | 整段只有一个候选格，不制造内部 point 网格 | 保持 E2 特殊 tempo 语义 |
| E3-G08 | success | 左键与 Enter/Space 在相同候选时间创建 | 首次创建，后续聚焦同一 marker并提示重复；事件总数仍为 1 | 固定唯一性与等价输入 |
| E3-G09 | boundary | 歌曲 0 秒与 duration | 两端均可创建、编码和恢复；marker 保持在可见边界内 | 覆盖 validator 允许的端点 |
| E3-G10 | pointer | 空白右键移动 3.9px / 4px | 前者打开快速菜单，后者只 pan；无 point 被创建或删除 | 固定 shared precedence |
| E3-G11 | keyboard | 候选 Left/Right、Up/Down、Home/End | 时间按当前 subdivision 移动，分类切换，首尾跳转后保持可见 | 固定纯键盘任务 |
| E3-G12 | viewport | 事件在 viewport 外/内切换 | 外部不创建 marker DOM；进入后用相同 event ID 出现；焦点离开时回候选 | 固定可见化边界 |
| E3-G13 | regression | 创建 point 后修改 BPM、zoom、pan | 保存秒数不变，只改变网格与屏幕位置 | 保证秒数是持久化事实 |
| E3-G14 | compatibility | 工程含 range lane | range 数据原样 round-trip，UI 只读标明 E5，E3 操作不改 range | 防止提前能力造成数据损失 |

Golden 使用确定性合成 WAV 和虚构工程数据，不记录用户音频、路径或设备标识。运行时 WAV 写入 Git 忽略的 `artifacts/fixtures/editor-e3-points-v1.wav`；版本化 JSON 固定 track hash、tempo、point 时间、viewport 与预期吸附结果。
