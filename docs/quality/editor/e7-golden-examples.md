---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/quality/editor/e7-eval-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "请 owner 用修订版 E7 artifact 复核全屏浮层视觉、穿透与特征记忆"
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
| E7-G10 | fullscreen | overlay 开启并纵向滚动 | fixed root、灰色全屏背景、Canvas/图形/入口/三手柄 viewport 坐标不变 | 固定窗口级语义 |
| E7-G11 | control | 未选/已选/打开/关闭与键盘 | 只有复合入口常驻；主按钮开关；箭头临时显示 21 项；Escape/外部点击收起 | 固定选择与焦点语义 |
| E7-G12 | persistence | 旧草稿、新工程、同歌刷新、JSON 导入、hash 变化和写失败 | visibility 与 featureId 按契约分离，关闭时 active set 只有 Buffer | 固定本地状态边界 |
| E7-G13 | alignment | zoom/pan/resize/窄屏横向滚动 | 全屏 Canvas 只在时间列绘制，时间锚点误差 `<=1 CSS px`，底层可点击 | 固定 geometry/pointer-through |

FL Studio 参考图不复制进仓库、不参与像素 diff；E7 的可复现事实来自 computed style、DOM/Canvas geometry、浏览器状态和本地 artifact 截图。

## Canonical Observation

`E7-2026-08-28T15-02-48-298Z-78bc7f06` 在真实 Chrome/Edge 上对 E7-G01、G03–G09 形成自动化历史证据；它不覆盖 G10–G13，现为 `pre-revision`。修订版 clean canonical `E7-2026-08-29T05-23-03-986Z-080f577f` 46/46 通过，补齐 E7-G10–G13 的双浏览器 computed style、fixed scroll geometry、21 项复合菜单、visibility/Buffer-only 和 `0 CSS px` 时间列对齐证据。artifact 截图供 owner 人工比较；自动化不代替视觉与辅助技术签字。
