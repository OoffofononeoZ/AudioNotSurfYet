---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "按 ADR-0011 在修订版 E7 验证全屏 fixed overlay、复合入口、开关记忆与 pointer-through"
---

# Editor Interaction Contracts

## Page and Layer Topology

- 页面保留共享 Header；有效 Editor track 时隐藏 MusicBar，并在 Editor 顶部提供精简播放/暂停、当前时间和 repeat-one 状态。空状态或无效 route target 保留 MusicBar。
- Editor 内容分为基底编辑层和窗口级半透明 overlay 层。基底层从上到下是歌曲信息/波形/导入导出、tempo boundary 与输入、lane 列表；overlay root 固定覆盖整个 viewport，图形仅在 lane 可标记时间列对应的屏幕横向范围内绘制。
- 每个 lane 使用对齐的三段结构：名称/事件类型、全部展开的 inner class、与波形和 tempo 网格共享横向几何的标记区。左侧宽度是布局变量，所有横向时间层使用扣除该宽度后的同一 CSS rect。
- 波形与 lane 不各自滚动横向时间；共享 viewport 是唯一横向状态。inner class 不设内层滚动条，长页使用页面级纵向滚动。

## Geometry and Grid

- 波形、tempo、point/range 和 overlay 从同一个 `EditorTimelineGeometry` 读取 viewport、CSS rect 和 `timeToX/xToTime`；任何层不得保存私有横向 zoom/cursor。
- Canvas backing store 为 CSS 尺寸乘 DPR，绘制前将 context 变换回 CSS pixel 坐标。多层同一时间的目标偏差不超过 1 CSS px。
- metered segment 根据 BPM/meter 生成 measure/beat；与 measure 重合的 beat 不重复。single-beat segment 不画内部线，并把整个 segment 作为一个候选单元。
- 自适应 subdivision 按 `[16, 8, 4, 2, 1]` 从细到粗选择预计宽度至少 12 CSS px 的单元；全部不足时使用 1 beat。hover、pointer 和键盘使用同一 snap 纯函数。
- snap 只发生在创建或拖动确认时。viewport、zoom 或 tempo 修改不会自动重写已有事件秒数。

## Shared Pointer Precedence

Editor 只在 waveform/tempo/event timeline 区域阻止 `contextmenu`、文本选择和原生拖拽；Header、表单、链接、页面滚动和辅助技术默认行为保持不变。

右键优先级不可交换：

1. 目标为已有 point/range/handle：删除对应事件；不开始 pan，不打开菜单。
2. range 处于 `awaiting-end`：空白右键取消 pending range；不开始 pan，不打开菜单。
3. idle 空白右键 pointerdown 后使用 pointer capture；水平移动达到 4 CSS px 进入 pan。
4. pointerup 前未达到 4 CSS px 时打开快速菜单，提供“跳到此处”“从此处播放”“将此处居中”。

`pointerup`、`pointercancel`、`lostpointercapture`、blur、Esc 和 route leave 都必须清理 capture、pressed、hover candidate、pending drag 和 menu 状态；不能留下半成品事件或持续按压样式。

## Point State Machine

```text
idle
  ├─ hover/focus cell → candidate
  ├─ left click candidate → create-if-unique → idle
  ├─ Enter/Space candidate → create-if-unique → candidate
  └─ focus existing marker + Delete/Backspace → delete → nearest candidate
```

- point 创建使用当前 lane、inner class 和 snapped seconds；重复 key 不创建第二项，并提供非破坏性反馈。
- 可见 point 是可聚焦 DOM button；背景空 cell 不生成 DOM。方向键移动候选一个当前 subdivision，Home/End 跳到歌曲边界。
- 右键 point 删除遵循 shared precedence；键盘 Delete/Backspace 是等价路径。

## Range State Machine

```text
idle
  └─ left click valid start → awaiting-end(start)

awaiting-end(start)
  ├─ hover/focus later cell → preview [start, candidate)
  ├─ left click valid later cell → validate overlap → create → idle
  ├─ left click same/earlier cell → stay awaiting-end + explain invalid
  ├─ Esc / empty right click / blur / route leave → cancel → idle
  └─ pointercancel → cancel → idle

idle + drag start/end handle
  → pointer capture
  → snapped candidate constrained by sibling endpoint and neighbors
  → pointerup validates and commits once
  → pointercancel restores pre-drag event
```

- preview 是半透明且 pointer-through；未完成 range 不进入 project/draft。
- range 最短长度为创建/拖动当时一个当前 subdivision；end 必须严格晚于 start，两个 handle 不能穿越。
- 同 lane/inner class 使用半开区间冲突检查；相邻允许、真实相交拒绝。拖动失败恢复原 event，不产生部分写入。
- start/end 下方各有可聚焦水平手柄。方向键移动一个当前 subdivision，Shift+方向键移动一个 beat；Home/End 只移动当前端点到合法边界，不能穿越或制造重叠。
- 右键已有 range 删除整项；首版不裁剪、拆分、自动合并或自由时间拖动。

## Tempo Interaction

- 初始 project 有歌曲开始/结束固定边界；结束前显示 add handle。单击 add handle 时优先使用播放 cursor，否则使用 viewport 中点；拖动后在 snapped 时间插入内部 boundary。
- `BPM` 表示当前拍号单位的一拍每分钟次数：相邻 beat 固定为 `60 / BPM` 秒；numerator 决定每小节的 beat 数，denominator 只表达该 beat 的音符单位，不再按四分音符二次缩放。
- 前一 segment 有合法 metered BPM 时，新增或移动 boundary 按当前可见 subdivision 吸附；BPM 为空或 segment 为 single-beat 时，没有 beat 网格，使用 `xToTime()` 后的微秒规范化原始时间。
- 新 segment 继承前一 segment 的 metered/single-beat 值。首版内部 boundary 可水平拖动但不可跨越相邻 boundary，且不提供删除。
- 初始 metered segment 为 4/4、`bpm: null`、source unset；输入框显示 `bpm: 100` placeholder。只有一个 segment、仍为空且未被用户编辑时，才允许可靠 tempo estimate 填值。
- 输入 20–300 进入/保持 metered；输入 `0 <= value < 20` 规范为 single-beat并隐藏 meter；无效输入不提交。切回 metered 需要显式选择 metered 并输入合法 BPM，不从旧 single-beat 数值猜测。
- 修改 tempo 只重绘网格与改变后续 snap；现有 point/range 秒数不移动。

## Waveform and Seek

- 左键 waveform 映射到秒并调用唯一 `AudioSessionService.seek()`；播放 cursor 仍来自 `PlaybackSnapshot`。
- wheel 在 pointer 对应时间锚定 zoom，并阻止该 timeline 区域的页面滚动；普通页面区域继续滚动。
- idle 空白右键 drag 执行 pan。键盘提供 zoom in/out/reset、pan 25%、方向键 seek 和 Home/End。
- 所有命令复用共享 service，不创建媒体元素、播放 RAF 或第二个时钟。

## Overlay Interaction and Rendering

- Vue `Teleport` 把 overlay root 挂到 `body`，root 使用 `position: fixed; inset: 0` 并以 `rgba(132, 136, 135, 0.28)` 覆盖整个视口。纵向页面滚动不得移动 root、Canvas、图形、入口或手柄。
- 左上角 fixed 复合入口是唯一常驻 overlay 控制：主按钮用 `aria-pressed` 直接开关；箭头以 `aria-haspopup/aria-expanded` 临时展开 21 项单选菜单。首次没有 `featureId` 时主按钮打开菜单并聚焦第一项；选择后立即开启/切换并收起。
- `Esc`、外部点击和 route leave 只关闭菜单。关闭 overlay 不清空工程的 `featureId`，但 exact cursor、renderer 和 feature analysis 停止，active set 只保留 `buffer`。
- visibility 按歌曲 hash 保存在本地 preferences，JSON V1 不携带它；旧草稿有 feature 且无偏好时默认打开，新工程无 feature 时默认关闭，hash 不匹配记录忽略。
- overlay `topRatio`/`heightRatio` 限制在 `[0,1]`，且 `top + height <= 1`，现在相对浏览器视口解释。top handle 调整上边界，middle handle 移动整体，bottom handle 调整下边界；最小高度由 delivery 的可用性测试固定。
- 三个手柄支持 pointer capture 和键盘细调/粗调；focus visible。reduced motion 下关闭位置过渡，但不改变结果。
- 复合入口、菜单、错误重试和三个手柄使用 `pointer-events: auto`；全屏背景、Canvas、标题/说明、图例和空白使用 `pointer-events: none`，所以 Header 与底层 point/range 命中保持原坐标。
- renderer adapter 只接收 FeatureDefinition、AnalysisSeries、viewport、CSS size、DPR 和 exact cursor；不能读取 DOM/store/route，也不能注册 pointer listener。
- renderer/Canvas/feature 分析错误只隐藏或重试 overlay；waveform、标记、播放、草稿和导出保持可用。

## DOM and Capacity Boundary

- tempo/beat/measure、波形、empty cells 和 overlay data 使用 Canvas；DOM 只创建当前 viewport 可见的 point/range、端点、表单和语义控件。
- inner class 全部纵向展开，不使用 lane 内滚动条；页面级纵向滚动保留。
- viewport 外 event 留在 project model，不进入 DOM；进入 viewport 时用稳定 event ID 恢复焦点语义。若当前焦点事件离开 viewport，焦点回到对应 lane 的候选控制，而不是落到 document body。
- 所有可见状态都提供文字/形状或 ARIA 语义，不只依赖颜色。hover 放大和 preview 动画尊重 reduced motion。

## Failure and Boundary Signals

| Scenario | Required result |
| --- | --- |
| DPR/resize/zoom/pan | 所有层重用同一 CSS geometry，误差不超过 1 px |
| 快速右键 drag 后 release | 只 pan；无菜单、无事件、无遗留 pressed |
| pending range + Esc/blank right/route leave | pending 完全取消，draft 不增加 event |
| range handle pointercancel | 恢复原 start/end |
| tempo change after markers | grid 变化，event seconds 不变 |
| overlay pointer click | 事件命中底层 lane；selector/handle 除外 |
| overlay closed | Canvas/说明/错误/手柄卸载，featureId 保留，active features 只剩 Buffer |
| document vertical scroll | overlay root、图形、入口和手柄 viewport 坐标不变 |
| Canvas/Worker failure | overlay error 隔离，标记/播放/导出继续 |
| keyboard-only | 可完成播放、seek、zoom/pan、tempo、point/range、菜单替代和 overlay 调整 |

## Approval

本交互契约于 2026-08-26 随 Editor system design 创建，并由 `project-owner` 随后批准进入 E1–E6 execution planning。Delivery 必须把上述成功、失败、边界和异常路径映射到可执行验收；delivery 获批前不得实现。

同日，owner 在开放 E2 时进一步确认：一个 beat 固定为 `60/BPM` 秒，拍号分母只表达音符单位；无合法 metered BPM 时 tempo boundary 按微秒规范化原始时间定位。该澄清登记为 DEC-026，不改变 JSON V1 或 ADR-0008 的秒数事实。
