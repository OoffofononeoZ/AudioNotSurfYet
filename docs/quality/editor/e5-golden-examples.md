---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e5-eval-plan.md"
  - "docs/architecture/editor/project-format-v1.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "owner 使用已生成 fixture 复核重叠矩阵、端点交互和 round-trip"
---

# Editor E5 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E5-G01 | success | 新建第一个 range lane | 名称“范围标记 1”、kind `range`、唯一 `default`、无事件 | 固定首个范围轨道事实 |
| E5-G02 | success | 起点 1.2s、终点 2.4s | 完成 `[1.2,2.4)` 并立即保存；preview 清理 | 固定两阶段创建 |
| E5-G03 | failure | 终点等于或早于起点 | 不创建，pending 保留并文字提示；工程/草稿不变 | 防止零长或反向范围 |
| E5-G04 | cancel | pending 后 Esc、空白右键、blur/route leave | preview/pending/capture 全清理，无事件写入 | 固定异常取消 |
| E5-G05 | boundary | `[1.2,2.4)` 后创建 `[2.4,3.0)` | 允许并保持两个 event ID | 固定半开相邻语义 |
| E5-G06 | failure | 同 lane/class 创建 `[2.0,2.8)` 与现有范围相交 | 整体拒绝并报告重叠；不自动合并或裁剪 | 防止静默改变事实 |
| E5-G07 | success | 相同时间范围位于不同 class/lane | 均可保存；point 可同时位于范围内部 | 固定重叠作用域 |
| E5-G08 | boundary | 歌曲 0 秒到 duration | 合法编码、显示和恢复；视觉裁剪不改秒数 | 覆盖歌曲两端 |
| E5-G09 | boundary | single-beat 与跨 tempo 边界 | 终点必须是起点后的下一个有效吸附位置；无内部伪网格 | 固定最短单位 |
| E5-G10 | pointer | 拖动 start/end 到合法相邻位置 | pointerup 一次提交；ID 与另一端保持 | 固定端点调整 |
| E5-G11 | failure | 端点穿越、重叠或 pointercancel | 非法/pointercancel 恢复原区间并提示 | 防止拖动破坏数据 |
| E5-G12 | keyboard | Tab 聚焦端点，左右键调整，Delete 删除 | 与 pointer 使用相同 snap/validator；焦点回标记表面 | 固定键盘等价路径 |
| E5-G13 | migration | 含 range 分类迁移到相交目标 | 整体拒绝并报告冲突数；源/目标不变 | 防止迁移数据损坏 |
| E5-G14 | persistence | point/range 工程刷新与 JSON round-trip | IDs、秒数、tempo、viewport、overlay 语义一致 | 固定 E1–E5 组合工程 |
| E5-G15 | overlay | overlay 开启时在 range surface 创建/拖动 | 命中与关闭 overlay 相同，层间误差 `<=1 CSS px` | 固定 E4 pointer-through 回归 |

版本化 `editor-e5-ranges.v1.json` 固定 100 BPM、single-beat、point-in-range、相邻/跨分类范围、歌曲边界和 overlay 时间锚点。运行时生成 Git 忽略的 `artifacts/fixtures/editor-e5-ranges-v1.wav` 与匹配工程；不记录用户音频、路径或设备标识。
