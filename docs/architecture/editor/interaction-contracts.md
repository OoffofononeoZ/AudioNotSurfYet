---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "维护当前标记工作区交互；正式 readiness 独立评审"
---

# Editor Interaction Contracts

## Page and Layer Topology

- 页面保留共享 Header 和常驻 MusicBar；固定 Editor 顶栏提供工程操作、三工作区页签及叠加层图标。播放与歌曲信息由 MusicBar 提供，Editor 播放租约维持 repeat-one；公共框架见[工作区契约](../../context/editor-workspace.md)。
- Editor 内容分为基底编辑层和窗口级半透明 overlay 层。标记工作区从上到下为节拍工具栏、由波形与紧贴其下的 28px BPM 标记条组成的共享时间轴、默认收起的手动定时区、状态行和 lane 列表；overlay root 固定覆盖整个 viewport，图形仅在 lane 可标记时间列对应的屏幕横向范围内绘制。
- 每个 lane 使用对齐的三段结构：名称/事件类型、全部展开的 inner class、与波形和 tempo 网格共享横向几何的标记区。左侧宽度是布局变量，所有横向时间层使用扣除该宽度后的同一 CSS rect。
- 共享 viewport 是唯一音乐时间窗口。窄屏波形与 lane 的物理横向滚动同步，工具栏和手动定时区固定在容器左缘；inner class 不设内层滚动条，纵向滚动归标记工作区，页面不穿过常驻 MusicBar。
- 不可用 route 在同一歌曲恢复可用后自动重试进入，但不得播放；若当前可播放歌曲与 route 不同，只显示包含歌曲名的“编辑当前歌曲”入口，用户点击后才替换 route。

## Geometry and Grid

- 波形、tempo、point/range 和 overlay 从同一个 `EditorTimelineGeometry` 读取 viewport、CSS rect 和 `timeToX/xToTime`；任何层不得保存私有横向 zoom/cursor。
- Canvas backing store 为 CSS 尺寸乘 DPR，绘制前将 context 变换回 CSS pixel 坐标。多层同一时间的目标偏差不超过 1 CSS px。
- metered segment 根据 BPM/meter 生成 measure/beat；与 measure 重合的 beat 不重复。single-beat segment 不画内部线，并把整个 segment 作为一个候选单元。
- 2026-10-17 标记改版采用显式 subdivision：常规 `[1,2,4,8,16]`、三连音 `[1,3,6,12]`、自定义 1–64 的因数预设。默认每拍四等分；hover、pointer、端点与键盘共享同一设置。缩放不改变吸附粒度，只减少过密次级线绘制，分隔颜色和层级沿用 osu。
- snap 只发生在创建或拖动确认时。viewport、zoom 或 tempo 修改不会自动重写已有事件秒数。
- point marker 为居中实心短键，range 主体为同高长条；按钮、短键图形和候选框以事件时间 X 为中心，任意视口、zoom、pan 与 DPR 下误差不超过 `1 CSS px`，图形 Y 也以按钮中心为准。

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
- 右键已有 range 删除整项；主体可按当前细分吸附整体移动并保持长度。不裁剪、拆分、自动合并或自由时间拖动。

## Tempo Interaction

2026-10-17 新增默认收起的手动定时区：展开后使用区间列表与右侧 BPM 辅助栏；选择与时间条边界联动，不随播放自动切换编辑对象。辅助栏输入复用公共控件；Tap 仅预览，显式应用后才修改当前区间。完整现行行为见[标记工作区](../../context/editor-marking.md)。

- 初始 project 有歌曲开始/结束固定边界；结束前显示 add handle。单击 add handle 时优先使用播放 cursor，否则使用 viewport 中点；拖动后在 snapped 时间插入内部 boundary。
- `BPM` 表示当前拍号单位的一拍每分钟次数：相邻 beat 固定为 `60 / BPM` 秒；numerator 决定每小节的 beat 数，denominator 只表达该 beat 的音符单位，不再按四分音符二次缩放。
- 前一 segment 有合法 metered BPM 时，新增或移动 boundary 按当前选定 subdivision 吸附；BPM 为空或 segment 为 single-beat 时，没有 beat 网格，使用 `xToTime()` 后的微秒规范化原始时间。
- 新 segment 继承前一 segment 的 metered/single-beat 值。内部 boundary 可水平拖动但不可跨越相邻 boundary；右键或焦点状态 Delete/Backspace 删除目标 segment，前一 segment 向右延伸。0 秒首 boundary 与歌曲结束边界固定且不可删除。
- 初始 metered segment 为 4/4、`bpm: null`、source unset；输入框显示 `bpm: 100` placeholder。只有一个 segment、仍为空且未被用户编辑时，才允许可靠 tempo estimate 填值。
- 输入 20–300 进入/保持 metered；输入 `0 <= value < 20` 规范为 single-beat并隐藏 meter；无效输入不提交。切回 metered 需要显式选择 metered 并输入合法 BPM，不从旧 single-beat 数值猜测。
- 修改 tempo 只重绘网格与改变后续 snap；现有 point/range 秒数不移动。
- 2026-10-17：标记窗口默认四小节，允许 1/2/4/8 小节和全曲；缩放最小一小节，Editor 不再受固定 64× 限制。点和范围主体支持同分类内单项拖动及 Alt+左右微移，范围整体保持长度；预览不入草稿，确认时再做边界与冲突校验，取消保持原值。完整约定见[标记工作区](../../context/editor-marking.md)。
- tempo boundary 不再覆盖波形 stage；紧凑 BPM 标记条是波形时间列的一部分，使用同一 viewport 和唯一水平滚动容器，不带独立左 rail、标签或模块边框。标记条固定 28px 并与波形零间隙相接。
- 真实 boundary 的向上 caret 位于波形底边，1px 辅助线只向上伸入波形 12px，时间紧贴在 caret 下。相邻 boundary 之间以 11px 同基线显示无框 BPM/拍号控件；输入高 18px，焦点或错误时才显示绿色边线，来源移入 accessible name/title。
- 区间可容纳完整控件时直接编辑；只能容纳单行摘要时显示摘要；摘要也放不下时不显示区间内容。判断使用同页自然宽度测量、两侧各 26px 安全区并禁止换行，zoom/resize 后重新计算；隐藏区间不能隐藏真实 boundary。
- 删除后清理目标 segment 的输入草稿和错误，flush 现有 autosave 并使 tempo estimate 结果失效；公共 `aria-live` 状态区播报删除或拒绝原因。

## Waveform and Seek

- 左键 waveform 映射到秒并调用唯一 `AudioSessionService.seek()`；播放 cursor 仍来自 `PlaybackSnapshot`。
- wheel 在 pointer 对应时间锚定 zoom，并阻止该 timeline 区域的页面滚动；普通页面区域继续滚动。
- idle 空白右键 drag 执行 pan。键盘提供 zoom in/out/reset、pan 25%、方向键 seek 和 Home/End。
- 所有命令复用共享 service，不创建媒体元素、播放 RAF 或第二个时钟。

## Overlay Interaction and Rendering

- Vue `Teleport` 把 overlay root 挂到 `body`，root 使用 `position: fixed; inset: 0` 并以 `rgba(132, 136, 135, 0.28)` 覆盖整个视口。纵向页面滚动不得移动 root、Canvas、图形、入口或手柄。
- 顶栏右侧叠加图标用 `aria-pressed` 直接开关；相邻特征图标以 `aria-haspopup/aria-expanded` 临时展开当前注册集合的单选菜单。首次没有 `featureId` 时开关打开菜单并聚焦第一项；选择后立即开启/切换并收起。
- `Esc`、外部点击和 route leave 只关闭菜单。关闭 overlay 不清空工程的 `featureId`，但 exact cursor、renderer 和 feature analysis 停止，active set 只保留 `buffer`。
- visibility 按歌曲 hash 保存在本地 preferences，JSON V1 不携带它；旧草稿有 feature 且无偏好时默认打开，新工程无 feature 时默认关闭，hash 不匹配记录忽略。
- overlay `topRatio`/`heightRatio` 限制在 `[0,1]`，且 `top + height <= 1`，现在相对浏览器视口解释。top handle 调整上边界，middle handle 移动整体，bottom handle 调整下边界；最小高度由 delivery 的可用性测试固定。
- 三个手柄支持 pointer capture 和键盘细调/粗调；focus visible。reduced motion 下关闭位置过渡，但不改变结果。
- 复合入口、菜单、错误重试和三个手柄使用 `pointer-events: auto`；全屏背景、Canvas、标题/说明、图例和空白使用 `pointer-events: none`，所以 Header 与底层 point/range 命中保持原坐标。
- renderer adapter 只接收 FeatureDefinition、AnalysisSeries、viewport、CSS size、DPR 和 exact cursor；不能读取 DOM/store/route，也不能注册 pointer listener。
- renderer/Canvas/feature 分析错误只隐藏或重试 overlay；waveform、标记、播放、草稿和导出保持可用。

## DOM and Capacity Boundary

- tempo/beat/measure、波形、empty cells 和 overlay data 使用 Canvas；DOM 只创建当前 viewport 可见的 point/range、端点、表单和语义控件。
- inner class 全部纵向展开，不使用 lane 内滚动条；标记工作区负责纵向滚动。
- viewport 外 event 留在 project model，不进入 DOM；进入 viewport 时用稳定 event ID 恢复焦点语义。若当前焦点事件离开 viewport，焦点回到对应 lane 的候选控制，而不是落到 document body。
- 所有可见状态都提供文字/形状或 ARIA 语义，不只依赖颜色。hover 放大和 preview 动画尊重 reduced motion。

## Failure and Boundary Signals

| Scenario | Required result |
| --- | --- |
| DPR/resize/zoom/pan | 所有层重用同一 CSS geometry，误差不超过 1 px |
| 同一 route 歌曲重新获得有效文件 | 合并为一次 route 重试并恢复可编辑，保持 paused，不自动播放 |
| 当前存在另一首可播放歌曲 | 原 route 继续显示不可用；显示带歌曲名的“编辑当前歌曲”，点击后才 replace route |
| 重选错误 hash、权限拒绝或解码失败 | 保持不可用，不切歌、不新建或覆盖草稿 |
| point marker geometry | event X、button、短键图形、candidate 中心误差 `<=1px`；图形 Y 误差 `<=1px` |
| tempo/point/range quick menu | 菜单完整位于视口内；键盘可操作、关闭后返回焦点，滚动和离页清理 |
| 删除非空／最后一条 lane | 明确确认或取消；确认后移除该轨及事件并持久化，取消不改工程 |
| 单项主体拖动／Alt+左右 | 同 lane/class 吸附，range 长度不变；冲突和取消不写工程 |
| 快速右键 drag 后 release | 只 pan；无菜单、无事件、无遗留 pressed |
| pending range + Esc/blank right/route leave | pending 完全取消，draft 不增加 event |
| range handle pointercancel | 恢复原 start/end |
| tempo change after markers | grid 变化，event seconds 不变 |
| overlay pointer click | 事件命中底层 lane；selector/handle 除外 |
| overlay closed | Canvas/说明/错误/手柄卸载，featureId 保留，active features 只剩 Buffer |
| document vertical scroll | overlay root、图形、入口和手柄 viewport 坐标不变 |
| Canvas/Worker failure | overlay error 隔离，标记/播放/导出继续 |
| keyboard-only | 可完成播放、seek、zoom/pan、tempo、point/range、菜单替代和 overlay 调整 |
| E10 mode off | E3/E5/E9 的创建、删除、quick menu、右键 pan、range handle 全部保持 |
| E10 right drag | 只选择起始 lane/inner class 的真实小节；无 BPM metered 区间不产生选择 |
| E10 copy/move conflict | 越界、重复 point 或 range overlap 时 project 字节等价不变并播报原因 |
| E10 pointer cancel | preview 与 capture 清空，不调用 project update |
| route leave dialog | 取消路径不离页、不写抑制偏好；确认路径先处理偏好再执行既有 leave |

## Approval

本交互契约于 2026-08-26 随 Editor system design 创建，并由 `project-owner` 随后批准进入 E1–E6 execution planning。Delivery 必须把上述成功、失败、边界和异常路径映射到可执行验收；delivery 获批前不得实现。

同日，owner 在开放 E2 时进一步确认：一个 beat 固定为 `60/BPM` 秒，拍号分母只表达音符单位；无合法 metered BPM 时 tempo boundary 按微秒规范化原始时间定位。该澄清登记为 DEC-026，不改变 JSON V1 或 ADR-0008 的秒数事实。

2026-09-04，owner 以 E9 完整实施指令批准 ADR-0019：tempo boundary 与区间编辑移入专用 BPM 轨道；删除内部 boundary 时前段向右延伸；区间展示按单行可用宽度在完整、摘要、隐藏间切换。该修订不改变秒数事实或 JSON V1。

同日，owner 在首个 E9 候选复核后批准 ADR-0020：删除独立 66px tempo row，把 28px BPM 标记条并入波形时间列；caret/辅助线只向上指向波形，重复左侧标签移除，直接编辑改为 11px 无框紧凑控件。ADR-0019 的删除、继承、共享滚动和秒数事实继续有效。

DEC-052 实现 commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 的 Chrome/Edge revised canonical 已验证零间隙、12px 向上 guide、单滚动、三级展示、删除与刷新恢复；`project-owner` 于 2026-09-04 批准适用人工门禁，evidence 为 `approved`。

2026-09-04，owner 进一步批准 DEC-057/ADR-0022：区间模式默认关闭；右拖只选择起始 lane/class；Cmd/Ctrl+C 立即向后复制；左拖吸附当前网格；所有冲突整批拒绝。键盘路径使用 Enter/Space 选择当前小节、Shift+左右扩展、Alt/Option+左右移动、Escape 清理；editable control 不拦截快捷键。站内未导出离页改用深色原生 dialog，浏览器原生 `beforeunload` 保持。

2026-09-03，owner 以 E8 实施指令批准同歌曲自动重试、异歌显式切换、`88px/72px` 时间轴与 point 中心对齐契约。implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 的 25/25 clean canonical 通过，owner 随后批准 evidence 与人工门禁，E8 关闭。
