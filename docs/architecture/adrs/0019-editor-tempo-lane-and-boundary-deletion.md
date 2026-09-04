---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "决策已由 E9 revised canonical 与 owner 门禁验证；后续在 Editor readiness 中回归"
---

# ADR-0019: Editor Tempo Lane and Boundary Deletion

## Context

E8 把波形 stage 收敛到 88/72px，但 tempo boundary 仍覆盖在波形中央，BPM 表单位于独立横向滚动行。两行不能稳定对应同一时间位置，内部 boundary 也只有新增和移动、没有删除。窄 segment 若强行显示完整控件会换行和挤压。

## Decision

- 把真实 tempo boundary、时间标签和区间表单移入波形下方专用 BPM 轨道；波形与轨道共享唯一 viewport、`timeToX/xToTime` 和窄屏水平滚动容器。
- boundary 用向上 caret、下方 `m:ss.sss` 与 1px 竖线表达。相邻 boundary 之间按自然单行宽度显示完整控件、摘要或不显示内容；boundary 自身始终按 viewport 可见性绘制。
- 允许右键或 Delete/Backspace 删除内部 boundary。删除目标 segment 后，前一 segment 设置延伸到下一 boundary 或歌曲结尾；0 秒首 boundary 与歌曲结束边界不可删除，未知 ID 幂等无操作。
- tempo 编辑或删除只改变网格和后续吸附，不移动 point/range 秒数。JSON V1 继续以已有 `tempoMap` 数组表达结果，无 schema 迁移。

## Consequences

- Positive：BPM 与波形共享视觉时间轴；用户可撤销错误分段；窄区间不再通过换行破坏密度。
- Negative：旧 E2/E8 浏览器断言必须适配新 DOM；自然宽度和 resize 需要可释放的测量更新。
- Follow-up：E9 在 Chrome/Edge、390/1024/1280/1920、DPR 1/2、zoom/pan、右键/键盘、刷新和资源生命周期中验证。

## Alternatives

- 保留独立 BPM 横向滚动条并同步 `scrollLeft`：拒绝，会形成双状态和 scroll feedback 风险。
- 删除 boundary 时让后一段向左延伸：拒绝，owner 已选择删除“从该 boundary 开始的段”，由前段向右延伸。
- 以固定像素断点决定表单模式：拒绝，字段、字体和拍号宽度变化时仍会换行；必须按实际单行内容宽度判断。

## Approval

2026-09-04，`project-owner` 明确要求实施完整 E9 计划；该指令批准 DEC-051、本 ADR 与 E9 quality contract。批准不等于实现、canonical 或人工视觉门禁通过。

同日 DEC-052/ADR-0020 取代本 ADR 的独立 66px BPM 轨道布局，但保留共享 viewport、唯一滚动、三级展示、内部 boundary 删除、前段延伸和秒数事实。

E9 revised clean canonical 29/29 通过后，`project-owner` 于 2026-09-04 批准紧凑 BPM 条及删除语义人工门禁；本 ADR 的 E9 验证已关闭，后续产品实现变化需重新评审。
