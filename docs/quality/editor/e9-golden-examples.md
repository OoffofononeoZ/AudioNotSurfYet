---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/editor/e9-eval-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "以修订后的 unit 与双浏览器 E2E 消费 E9-G01–G11"
---

# Editor E9 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E9-G01 | shared strip | viewport 0–80s，boundary 0/40/57/146.866 | 28px BPM 条紧贴波形；波形和 caret 使用同一 x；0/40/57 可见，结尾只在 viewport 覆盖时可见 | 禁止独立模块和伪造 viewport 边界 |
| E9-G02 | full segment | 可见宽度等于或大于 full required width | 11px BPM/拍号无框控件在同一基线直接编辑，高 18px，`scrollHeight <= clientHeight`；来源只在 accessible name/title | 固定紧凑宽区间行为 |
| E9-G03 | summary segment | 宽度小于 full、等于或大于 summary required width | 显示 `128 BPM · 4/4` 或 `单拍`，无输入控件且不换行 | 固定中等宽度行为 |
| E9-G04 | hidden segment | 宽度小于 summary required width | 区间内容为空；真实 boundary caret/时间仍存在 | 极窄区间不挤压 |
| E9-G05 | delete internal | 删除 start=40s 的 segment | 该 ID 消失；0s segment 设置延伸到 57s；其余 ID/设置不变 | 固定 owner 选择的前段延伸 |
| E9-G06 | protected boundary | 删除 0s、歌曲结束或未知 ID | tempo map bytes 等价不变，状态说明不可删除或无变化 | 保护边界与幂等性 |
| E9-G07 | event stability | 删除/移动 tempo boundary 前后 point/range | 每个 event 的 start/end seconds 完全相同 | tempo 不得改写标注事实 |
| E9-G08 | point candidate | pointer hover 空 cell | snapped x 上只有 3px 绿色竖线，无 box、fill、radius、shadow 或 white pin | 固定视觉修订 |
| E9-G09 | category/divider | point lane 标题与上下 panel | “+分类”双轴居中；Timeline/PointWorkspace 交界只有一条 1px divider | 修复截图中的密度问题 |
| E9-G10 | narrow shared scroll | 390px Editor 横向滚动 | 波形/BPM 同一 outer scrollLeft；不存在 tempo 独立 scrollbar；使用 `.app-scrollbar` | 防止视觉错位与双滚动 |
| E9-G11 | upward boundary guide | 任一真实 boundary | caret 与波形底边无可见间隙；1px guide 从接缝向上伸入波形 12px且不向下贯穿；时间紧贴 caret 下方 | 固定 owner 指定的指向与密度 |

golden 只保存确定性 tempo/viewport/required-width 数值，不保存用户截图、私有音频或依赖平台字体的绝对测量。运行时用同一页面的自然宽度作为 full/summary 阈值。
