---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "在 E2/E3/E5/E6 delivery 中验证秒数事实、tempo 网格和 point/range 状态机"
---

# ADR-0008: Seconds-Based Editor Time and Event Model

## Context

Editor 的标注对象是原歌曲中的真实位置，但 UI 需要 BPM、拍号和自适应网格帮助输入。若把 beat/bar 作为持久化 identity，后续修正 tempo 会移动已有标注；若为每个空格创建 DOM，15 分钟、多 lane 和 1/16 beat 会导致不可控节点量。Range 还需要明确取消、最短长度、端点和同类不重叠语义。

## Decision

- point/range 以规范化 seconds 持久化；tempo map 只派生网格和交互 snap，tempo/zoom 变化不移动已有事件。
- lane 是 point/range 判别联合；每个 lane 至少一个 inner class。Point 同 lane/class/time 唯一；Range 使用半开 `[start,end)`，同 lane/class 不重叠，相邻允许。
- 自适应 subdivision 在 1/16 到 1 beat 中选取至少 12 CSS px 的最细单元；创建/拖动按当时单元吸附。
- Range 使用 `idle → awaiting-end → committed` 与端点 drag 状态机；Esc、空白右键、pointercancel、blur、route leave 清除未完成状态。
- Canvas 绘制网格/空 cell；DOM 只渲染 viewport-visible event、handle、表单和焦点语义。
- 右键按事件删除、pending 取消、4px drag pan、空白菜单的固定优先级处理；禁用默认行为只限 Editor timeline。

## Consequences

- Positive：标注不会因 tempo 修正漂移；重叠和取消规则可纯函数验证；大范围网格不膨胀 DOM。
- Negative：tempo 改变后旧事件可能视觉上不再落在新网格；首版不自动重拍、合并、裁剪、自由时间或删除 tempo boundary。
- Follow-up：E2 实现 geometry/tempo/grid，E3 实现 point，E5 实现 range，E6 验证 DPR、键盘、pointercancel 和容量。

## Alternatives

- beat/bar identity：拒绝，会让 tempo 变化移动音频事实。
- tempo 修改时自动重吸附：拒绝，会无提示篡改已有标注。
- 每个 cell DOM：拒绝，容量和焦点管理成本过高。
- 自由像素拖动：拒绝，不符合首版自适应节拍精度。

## Approval

`project-owner` 于 2026-08-26 批准本 ADR 的秒数 identity、半开区间、12px 选择和 DOM/Canvas 边界，并开放 E1–E6 execution planning。
