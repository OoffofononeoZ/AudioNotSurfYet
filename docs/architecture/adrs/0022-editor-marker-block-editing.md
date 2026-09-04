---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/adrs/0008-editor-time-and-event-model.md"
next_action: "实施 E10 纯批量命令、统一 pointer 状态与站内离页对话框，并形成可复核证据"
---

# ADR-0022: Editor Marker Block Editing

## Context

E9 已固定 point/range 事件的秒数事实、共享 tempo 网格和单项创建/删除，但没有按小节选择并批量复制或移动标记的受控路径。现有右键拖动负责平移 viewport，站内未导出离页提示则使用与深色工作台不一致的 Element Plus 白色 MessageBox。

## Decision

- 新增默认关闭、仅存在于当前页面会话的“区间操作”模式；不写入 JSON V1。关闭时保持全部 E1–E9 pointer/keyboard 行为。
- 模式开启后，右键拖动只选择起始 lane/inner class 中一个或多个真实小节；point 按 `[start,end)` 收集，range 只在首尾均落入区间时收集。普通单击、单项右键删除和快速菜单暂停。
- Cmd/Ctrl+C 立即把选择按等长秒数偏移复制到其后；左键从选区内拖动时，目标起点吸附当前可见网格。复制使用新 ID，移动保留 ID，二者都在越界、重复 point 或 range overlap 时整批拒绝。
- 选择、拖动 preview、typed error 和快捷键状态由一个 workspace owner 管理；point/range 组件只上报手势，不各自保存一份选择。
- 站内 route leave 使用原生 `<dialog>` 和项目深色绿色样式；刷新/关闭窗口仍由浏览器原生 `beforeunload` 负责。是否警告、确认、取消和“不再提示”的持久化语义不变。

## Consequences

- Positive：节拍模式下可以重复铺设或整体平移一个 pattern，且所有失败保持工程字节不变。
- Negative：批量模式接管既有 pointer 优先级，必须回归右键 pan、range handles、焦点和 cleanup；E9 固定的 readiness runtime candidate 不再代表当前 `src/`。
- Compatibility：JSON V1、IndexedDB、事件秒数、AudioEngine、Worker、Overlay 和路由接口不变；E1–E9 canonical 不改写。

## Alternatives

- 使用系统剪贴板和 Cmd/Ctrl+V：拒绝；会引入权限、格式和跨工程身份问题。
- 自动跳过或覆盖冲突事件：拒绝；会使一次命令产生部分且难以解释的结果。
- 让每个 lane 保存自己的模式和选择：拒绝；point/range 会产生分叉状态和重复 listener。

## Approval

2026-09-04，`project-owner` 明确要求实施完整 E10 计划，并在计划阶段选择“单个起始轨道与分类”“Cmd/Ctrl+C 立即向后复制”“冲突整批拒绝”“移动吸附当前网格”和“批量模式禁用普通编辑单击”。该指令批准 DEC-057、本 ADR、AC-E1001–AC-E1007 与 E10 quality contract；不等于实现、canonical 或人工门禁已通过。
