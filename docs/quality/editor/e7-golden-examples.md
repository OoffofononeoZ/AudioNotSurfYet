---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/quality/editor/e7-eval-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "用 E7 Chrome/Edge artifact 核对紧凑布局 golden"
---

# Editor E7 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E7-G01 | toolbar | ready 工程与普通歌曲元数据 | 工程/歌曲/状态与操作分为两行，总高 `<=84px` | 固定首屏密度 |
| E7-G02 | boundary | 超长歌名、作者和 not-persisted/error | 文本截断或换到允许区域；操作和状态不被遮挡 | 防止紧凑导致信息丢失 |
| E7-G03 | surface | timeline、tempo、point/range、overlay | 主区域以细线和背景分区，不出现连续大圆角卡片 | 固定工作台视觉结构 |
| E7-G04 | density | 多 point/range class | 每行 `44px`，名称/分类/时间列仍对齐 | 固定轨道密度 |
| E7-G05 | waveform | 1024/1280/1920 | 波形为 `176px`，boundary、Canvas 和游标完整 | 固定时间轴密度 |
| E7-G06 | narrow | 390px viewport | 工具栏紧凑换行；时间工作区受控横向滚动，无不可达操作 | 固定窄屏边界 |
| E7-G07 | interaction | pointer、keyboard、context menu、overlay | 所有 E1–E6 操作与焦点状态保持 | 防止 CSS 重排改变命中 |
| E7-G08 | capacity | 10,000 events | 可见 DOM、反馈、长任务与资源保持 E6 门禁 | 防止密度优化牺牲性能 |
| E7-G09 | adjacent | Analyzer M12 动态 masonry | M12 unit/Chrome/Edge 保持通过 | 保护当前未推送候选 |

FL Studio 参考图不复制进仓库、不参与像素 diff；E7 的可复现事实来自 computed style、DOM/Canvas geometry、浏览器状态和本地 artifact 截图。
