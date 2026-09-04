---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/editor/e9-eval-plan.md"
  - "docs/quality/editor/e8-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "E9 29/29 canonical 无未解决失败；保留 taxonomy 供 owner 复核和后续回归"
---

# Editor E9 Failure Taxonomy

E9 沿用 E1–E8 的 identity、draft、geometry、pointer、keyboard、resource、regression 与 evidence 分类，并新增以下类型。

| Type ID | Failure type | Definition | Detection | Response |
| --- | --- | --- | --- | --- |
| EFT-E9-LANE-X | BPM/波形错位 | 任一真实 boundary 与共享波形时间 x 差 `>1px` | E9-EV-LANE | S1；修正唯一 geometry/rect，不复制 viewport |
| EFT-E9-DOUBLE-SCROLL | 双水平滚动 | BPM 行存在独立 scrollLeft/scrollbar 或反馈循环 | E9-EV-LANE | S1；收敛到 EditorTimeline outer scroller并复用 `.app-scrollbar` |
| EFT-E9-WRAP | 区间内容挤压 | full/summary 换行、覆盖 marker 或 mode 阈值不随 resize 更新 | E9-EV-PRESENTATION | S1；修正自然宽度测量和 full→summary→hidden 选择 |
| EFT-E9-BOUNDARY-HIDDEN | marker 丢失 | 区间 hidden 时真实 caret/time 同时消失 | E9-EV-PRESENTATION | S1；分离 boundary 与 segment content 渲染 |
| EFT-E9-WRONG-DELETE | 删除事实错误 | 删除首边界、错误 ID、后一段向左延伸或其余设置变化 | E9-EV-DELETE | S0；停止 canonical，修正纯 domain command |
| EFT-E9-EVENT-MOVE | 标注时间变化 | tempo 删除导致 point/range 秒数变化 | E9-EV-DELETE | S0；恢复秒数 identity 并审计持久化 diff |
| EFT-E9-STALE-DRAFT | 临时状态残留 | 已删除 ID 的输入/error/estimate 回填或 autosave 未 flush | E9-EV-LIFECYCLE | S1；清理 keyed state、generation 与 flush 顺序 |
| EFT-E9-A11Y | 删除不可达 | 无键盘等价、焦点丢失或状态无文字播报 | E9-EV-DELETE/LIFECYCLE | S1；补齐 Delete/Backspace、focus target 与 `aria-live` |
| EFT-E9-POLISH | 视觉修订回归 | category 偏心、candidate 仍是 box/pin 或双 divider | E9-EV-POLISH | S2；修正局部 CSS 并复跑双浏览器 style probe |
| EFT-E9-EVIDENCE | 证据身份误报 | dirty run 记 canonical、改写 E8 artifact 或提前关闭 E9/R-042 | runner/docs audit | S0；撤回声明并保留历史证据 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | tempo/event/工程事实或 evidence identity 受损 | 立即停止 canonical并修复根因 |
| S1 | 核心 geometry、删除、滚动、键盘或生命周期失败 | 阻断 E9 关闭 |
| S2 | 不改变事实的视觉/文字问题 | 修复并复跑专项 |
| S3 | 不影响任务、几何或可访问性的轻微差异 | 登记并由 owner 判断 |
