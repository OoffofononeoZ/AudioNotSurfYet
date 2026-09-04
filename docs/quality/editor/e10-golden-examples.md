---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/editor/e10-eval-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "由 E10 unit 与双浏览器专项消费 G01–G10"
---

# Editor E10 Golden Examples

| ID | Scenario | Expected result |
| --- | --- | --- |
| E10-G01 | 4/4、120 BPM 中右拖一个小节 | 选择真实小节 `[start,end)`，只收集起始 lane/class 的 point |
| E10-G02 | 右拖跨多个小节和 tempo boundary | 使用真实边界组成连续秒数区间；相对事件秒数不变 |
| E10-G03 | range 与选区相交但未完整包含 | range 不进入选择；首尾都在区间内时才进入 |
| E10-G04 | single-beat segment | 整个 segment 是一个可选单元；空 BPM metered segment 返回 typed unavailable |
| E10-G05 | Cmd/Ctrl+C | 副本从选择终点开始、新 ID、相对偏移不变，选择跟随副本 |
| E10-G06 | 连续复制 | 每次把当前选择继续向后追加；任何一步越界时该步整批不变 |
| E10-G07 | 左拖至当前细分网格 | preview 不改工程；pointerup 后原 ID 按统一 offset 移动，冲突整批拒绝 |
| E10-G08 | 模式关闭 | 左键创建、右键 pan/menu/delete、range 创建与 handles 与 E9 一致 |
| E10-G09 | denominator 1/2/4/8/16/32 | 数字和自定义箭头各占区域，在目标视口/DPR 下无遮挡 |
| E10-G10 | 未导出修改 route leave | 深色 dialog；留在此页/Escape/关闭/背景均取消，确认才离开并可持久化抑制偏好 |
