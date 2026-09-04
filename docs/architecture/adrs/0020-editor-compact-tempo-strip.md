---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/adrs/0019-editor-tempo-lane-and-boundary-deletion.md"
next_action: "E9 已关闭；在 Editor release-readiness 当前候选审计中回归本决策"
---

# ADR-0020: Editor Compact Tempo Strip

## Context

ADR-0019 已证明 tempo boundary 删除、共享时间映射和三级展示可行，但首个 E9 候选把 BPM 视图实现成独立的 66px 三列模块。该模块重复“节拍地图 / BPM / 拍号”标签，辅助线从 caret 向下贯穿，且与波形之间夹有状态行，未形成直观的同一时间轴。

## Decision

- 用波形时间列内的 28px 紧凑 BPM 标记条替代独立 tempo row。标记条无独立左侧 rail、边框、间距或滚动状态，紧贴在 88/72px 波形 stage 下方；状态行移动到标记条之后。
- boundary caret 位于波形底边，1px 辅助线只向上伸入波形 12px；时间显示在 caret 下。区间内容与时间使用紧凑单行基线。
- 完整模式使用 11px、18px 高的透明无框行内 BPM/拍号控件；焦点或无效状态才显示绿色边线。摘要与隐藏模式继续由自然宽度决定，视觉来源文本移入 accessible name/title。
- ADR-0019 的共享 viewport、唯一外层滚动、内部 boundary 删除、前段延伸、首尾保护、JSON V1 和事件秒数规则全部保持不变。

## Consequences

- Positive：波形和 tempo 信息成为同一视觉时间轴，减少垂直密度和重复标签，boundary 指向关系更明确。
- Negative：紧凑输入需覆盖全局 30px 控件令牌，并需要双浏览器实际几何验证；旧 E9 29/29 run 只能作为 `pre-revision` 历史证据。
- Follow-up：修订 E9 E2E 断言，验证 28px 等高、零间隙、12px 向上辅助线、11px 同基线输入、唯一滚动和既有删除/恢复行为。

## Alternatives

- 保留独立 66px BPM 模块：拒绝，仍会产生重复标签和视觉割裂。
- 点击摘要后打开编辑浮层：拒绝，会新增 overlay、焦点和关闭状态，不符合本轮简洁与无新弹层边界。
- 把编辑入口移到其他面板：拒绝，会降低 BPM 与时间位置的直接对应关系。

## Approval

2026-09-04，`project-owner` 明确要求实施完整紧凑 BPM 标记条修订计划；该指令批准 DEC-052、本 ADR 与修订后的 E9 quality contract。批准不等于 revised canonical 或人工视觉门禁通过。

同日 implementation commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 与 clean run `E9-2026-09-04T03-51-33-088Z-13614673` 已完成 29/29 自动化。`project-owner` 随后批准紧凑 BPM 条、箭头方向、无框输入、共享滚动、删除语义和配套视觉门禁；本 ADR 的 E9 验证已关闭。
