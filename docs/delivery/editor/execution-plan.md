---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/editor/project-format-v1.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "E8 implementation commit 与 25/25 clean canonical 已完成；等待 owner 验收"
---

# Editor E1–E8 Execution Plan

## 1. Delivery Outcome

把已批准的 Editor“逆向制曲”架构按 E1–E8 纵向切片交付：E1–E6 已完成入口、运行时、工程、时间轴、点/范围标注、分析叠加及最终加固；E7 把页面收敛为紧凑工作台；E8 修正共享时间轴高度、不可用歌曲恢复状态与 point marker 中心几何。

本计划只覆盖 Editor，不重新打开已完成的 Analyzer 历史 canonical。`project-owner` 于 2026-08-26 批准 E1–E6 delivery，于 2026-08-28 开放 E7，并于 2026-09-03 以实施指令批准 E8。E1–E7 历史 evidence 保持不变，Editor readiness 等待 E8 关闭后再复核。

## 2. Delivery Principles

- 每个里程碑必须形成可独立使用的纵向结果，不能用后续切片补足当前退出门禁。
- 每个里程碑按“实现与专项测试 → dirty-worktree provisional → 实现提交 → clean-HEAD canonical → evidence 登记 → owner 审批”关闭。
- E1–E5 专项 E2E 使用真实 Chrome；E6–E8 的对应专项在真实 Chrome 和 Edge 执行，并回归相关历史播放、恢复、Worker、路由和资源契约。
- 一个里程碑未获 owner 批准时，下一个里程碑保持 `Planned`。不得并行扩大范围来绕过失败门禁。
- 代码更新内存状态优先；持久化、分析或 overlay 失败不得破坏仍可用的播放与编辑能力。
- 不新增第二 AudioEngine、AudioContext、播放时钟、播放 RAF、AnalysisCoordinator 或产品 Worker。

## 3. Fixed Delivery Parameters

| Area | Fixed value | Change rule |
| --- | --- | --- |
| Stable IDs | `crypto.randomUUID()` | 改变 ID identity 必须复核 project codec 与草稿迁移 |
| Persisted time | 秒数，编码时规范为微秒精度 | tempo/zoom 不能改写已保存事件时间 |
| Draft database | `audionotsurfyet-editor` V1 | 不修改 Analyzer session IndexedDB V1 |
| Draft keys | `draft/latest`、`preferences/leave-warning` | 首版只保存一个 Editor 草稿 |
| Autosave debounce | 250ms | pointerup、输入确认、导入成功和路由离开立即 flush |
| Metered BPM | `20–300`，允许小数 | 配置集中定义；负数、非有限数、非数字、超上限拒绝 |
| Beat semantics | 一个 beat 为 `60/BPM` 秒；numerator 决定小节拍数，denominator 只表达音符单位 | 改变语义需复核 DEC-026、grid golden 与既有工程 |
| Single-beat | `0 <= BPM < 20` 规范化为单拍区间 | 不显示或允许修改拍号，不画 beat/measure 分隔 |
| Boundary without grid | BPM 为空或 single-beat 时使用微秒规范化原始时间 | 有合法 metered BPM 时才按可见 subdivision 吸附 |
| Subdivision | `[1/16, 1/8, 1/4, 1/2, 1 beat]`；最小可靠宽度 12 CSS px | 只影响新建/拖动吸附，不改写旧秒数 |
| Context pan | 右键移动超过 4 CSS px 才形成 pan | 未形成拖动的空白右键打开快速菜单 |
| Viewport | zoom `1–64`；按钮 pan 为当前窗口 25% | seek、波形、网格、事件和 overlay 共用 geometry |
| BPM estimator | confidence `0.65`；候选优势 `0.08` | 低置信度保持空；不安装第三方包 |
| Overlay | `topRatio=0.10`、`heightRatio=0.35`、最小高度 `0.12` | 键盘普通步长 1%，Shift 步长 5% |
| Capacity gate | 约 15 分钟、20 lanes、每 lane 最多 8 inner classes、合计 10,000 point/range events | 这是 E6 性能门禁，不是 schema 硬上限 |
| Compact toolbar | 两行总高度 `<=84px`；控件高度 `30px` | 只合并展示层，不改变项目、播放或文件操作语义 |
| Compact lanes | 行高 `44px`；名称列 `152px`；分类列 `144px` | 时间列仍复用共享 geometry，窄屏使用单一横向滚动区 |
| E7 compact waveform（历史） | 桌面 `176px`；`<900px` 为 `144px` | 已由 E8/ADR-0018 覆盖，不改写 E7 evidence |
| E8 shared timeline | 桌面 `88px`；`<900px` 为 `72px`；上下安全区各 `6px` | Canvas backing store、DPR 与 `<=1 CSS px` 门禁不变 |

## 4. Milestone Slices

### E1 — Entry, Playback and Project Foundation

Implementation:

- 新增 `/editor/:trackId?`，Header Editor 使用当前歌曲；没有当前歌曲时显示空状态并保留 MusicBar。
- 播放列表加号改为语义化“去编辑”按钮并提供同名 Tooltip；点击先选择并显式播放对应歌曲，再进入该歌曲路由。
- 实现 `EditorPlaybackLease` 和 `AnalysisConsumerLease`。有效 Editor track 隐藏 MusicBar、全曲 repeat-one；释放 lease 后恢复普通 queue-next，旧 token 无权覆盖新 route。
- 建立 `src/editor/` 领域边界，实现 `EditorProjectV1`、严格 JSON codec/validator、`EditorFormatCodecRegistry`、`EditorDraftRepository` 与 Editor session controller。
- 首版只注册 JSON；未知字段、未知 schema、hash/时长不匹配、重复 ID、无效引用、越界事件或 range 重叠均在原子应用前拒绝。
- 建立独立单草稿 IndexedDB、250ms autosave、同歌恢复、异歌“导出旧工程/覆盖草稿/取消进入”、普通离页提示偏好与 `not-persisted` 状态。

Exit gate:

- route/track identity、入口语义、repeat-one/释放、单引擎/单 Worker、JSON round-trip 与严格失败路径通过。
- quota、abort、刷新、同歌恢复、异歌三选项和无效导入不覆盖当前工程通过。
- E1 provisional、clean canonical 与 owner 审批完成后才开放 E2。

### E2 — Timeline and Tempo

Implementation:

- 基于 Buffer envelope 绘制顶部波形，复用共享 viewport；支持 click seek、指针锚点滚轮 zoom、右键 pointer-capture pan、按钮 25% pan 和 reset。
- 所有时间层使用同一个 `timeToX/xToTime` 纯函数，覆盖 resize、DPR、尾部边界和换歌修正。
- 实现 tempo boundary、结尾前“+”手柄、默认 `4/4`、20–300 小数 BPM、single-beat、贯穿 lane 的 measure/beat 网格。
- 在现有 Worker 保留的 mono PCM 上使用正向频谱差 onset envelope 与归一化 autocorrelation。返回真实脉冲间隔，不任意做半拍/双拍归一化。
- 估计结果只有在唯一 segment、BPM 为空且未被用户编辑时可写入；低置信度、stale 或取消结果不能覆盖用户事实。

Exit gate:

- 1024/1280/1920、DPR、zoom/pan 下波形、网格与游标映射误差不超过 1 CSS px。
- 60、100、128、127.5 BPM 误差不超过 `max(0.5 BPM, target × 1%)`；silence、固定噪声和歧义输入返回 low-confidence。
- 输入边界、single-beat、stale/cancel、seek 同步和 E1 回归通过；owner 批准 E2 canonical 后才开放 E3。

### E3 — Point Annotation

Implementation:

- 开放 point lane 创建与重命名；inner class 新增、重命名，并在删除有事件分类时要求迁移或明确删除事件。
- inner class 全部展开；Canvas 绘制网格和高密度背景，DOM 只实例化当前 viewport 内可见事件与可访问控件。
- 按 12 CSS px 可靠宽度选择 `1/16` 到 `1 beat` 的最细吸附；hover/focus 显示候选格，点事件使用荧光绿色菱形/短针。
- 左键创建、同 lane/inner class/规范化时间重复阻止、右键已有点删除；空白右键遵守 pan/快速菜单优先级。
- 提供 Enter/Space 创建、Delete/Backspace 删除、方向键移动候选、Home/End 跳转；`Esc`、pointercancel、blur 和路由离开清理临时状态。

Exit gate:

- 五档吸附、边界、重复、可见 DOM、pointer cleanup、鼠标和完整键盘创建/删除通过。
- 在支持范围内无不可达事件、遗留 capture/menu/pressed 状态或事件随 zoom/tempo 被改写。
- owner 批准 E3 canonical 后才开放 E4。

### E4 — Analysis Overlay

Implementation:

- 从 Analyzer 卡片中抽取不依赖卡片 DOM 的纯 Canvas renderer adapter，覆盖 scalar、frequency/vector heatmap、waveform 和 structured family。
- Editor analysis lease 固定请求 `buffer + 一个可选 overlay feature`；选择 Buffer 时去重，累计 21 项一次只选一个。
- overlay 复用同一 viewport/cursor/exact request，只有 selector 和上/中/下三个垂直手柄接收 pointer；其余 Canvas、说明和空白区域 pointer-through。
- 应用固定初始 top/height、最小高度和键盘步长；Canvas 按 DPR 设置 backing store，单 overlay 失败可重试且不影响标记、波形或播放。

Exit gate:

- 21 项覆盖的所有 renderer family 可绘制，Buffer 请求去重，stale/cancel/cache identity 不污染 Analyzer workspace。
- overlay 与底层标记在多视口/DPR/zoom 下误差不超过 1 CSS px；穿透点击命中底层正确 cell。
- owner 批准 E4 canonical 后才开放 E5。

### E5 — Range Annotation

Implementation:

- 开放 range lane；第一次左键固定起点并预览，只允许选择更晚的终点，第二次有效点击完成创建。
- `Esc` 或待选状态空白右键取消；pointercancel/blur/路由离开回滚未完成创建；右键已有 range 删除。
- 起止箭头沿用当前自适应网格拖动；终点必须晚于起点，最短持续时间为一个当前网格单位，手柄不可穿越。
- range 持久化为半开区间 `[start,end)`；同 lane/inner class 真重叠拒绝，相邻端点允许，不同分类允许重叠，point 可位于 range 内。
- JSON、draft、导入和 autosave 全面覆盖 point/range 判别联合；无效 range 导入不得覆盖当前工程。

Exit gate:

- 创建、预览、取消、调整、删除、键盘路径、pointercancel 回滚和重叠矩阵通过。
- round-trip、草稿恢复、严格导入拒绝及 E1–E4 回归通过。
- owner 批准 E5 canonical 后才开放 E6。

### E6 — Final Hardening

Implementation and verification:

- 在真实 Chrome/Edge 覆盖本地 MP3/WAV/FLAC、原生工程 picker、离页/刷新恢复、键盘、reduced motion、辅助技术和 1024/1280/1920。
- 运行约 15 分钟、20 lanes、每 lane 最多 8 inner classes、合计 10,000 point/range events 的压力工程；只实例化 viewport 可见事件 DOM。
- 测量输入反馈、Editor/分析归因长任务、seek/geometry 以及 20 次 Editor/Analyzer/Home、换歌、overlay 生命周期资源。
- 执行 E1–E6 全量和 M3–M11 关键回归；原生 picker、浏览器离页提示与辅助技术不能完全自动化的部分由 owner 在 Chrome/Edge 补偿验证。

Exit gate:

- 核心输入反馈不超过 100ms；无 Editor/分析归因主线程任务超过 50ms；资源循环不单调累积 AudioContext、Worker、RAF、Canvas 或监听器。
- 三格式、双浏览器、恢复、错误隔离、可访问性和容量门禁均有成功、失败、边界、异常证据。
- clean canonical、evidence 和 owner 完整逆向标注任务获批后，才允许进入 Editor release-readiness review。

### E7 — Compact Workbench Layout

Implementation:

- 合并介绍与当前工程大卡片为两行工具栏，保留歌曲、草稿、播放、格式、导入与导出全部状态和操作。
- 主时间轴、tempo、point/range 与 overlay 改用平面背景、低对比细分隔线和轻微深浅层次；主区域不再用大圆角卡片分区。
- 应用 30px 控件、44px 标记行、152/144px 侧栏和 176/144px 波形令牌；临时菜单/对话框可保留最多 8px 圆角。
- 1024/1280/1920 保持完整工作台；390 与小于 900px 使用紧凑换行和唯一横向时间轴滚动区。
- FL Studio 只作为信息密度和分区方式参考；黑绿配色、可访问名称、焦点、状态与现有交互语义保持项目自身设计。

Exit gate:

- AC-E701–AC-E708、E7 unit/integration、Chrome/Edge 专项、M12 回归及 E6 40 步基线全部通过；修订版 clean canonical 固定 46 步。
- 1024×900 可见顶部工具栏、波形、tempo 和至少一条标记行；多视口无遮挡或不可达控件。
- 10,000 事件反馈、长任务、可见 DOM、资源和共享 geometry 不回归。
- owner 批准 E7 canonical 与紧凑布局后，才进入 Editor release-readiness review。

Revision slice:

- 把 overlay 与左上角复合入口 Teleport 到窗口顶层，使用 fixed 全视口灰色 pointer-through 背景；移除主页面常驻特征列表。
- 为 controller 增加 `overlayOpen` 与开关/选择命令；按歌曲 hash 在现有 preferences store 保存 visibility，关闭时 active set 只保留 Buffer。
- 全视口 Canvas 使用当前 marker time column 的屏幕横向 rect 进行裁剪/绘制，三个 bounds 手柄改为 viewport-relative。
- 旧 44/44 canonical 只作为 `pre-revision` 历史记录；新增 E7 unit/integration 后运行 46 步候选。

### E8 — Timeline, Recovery and Marker Usability

Implementation:

- 将共享时间轴固定为桌面 `88px`、`<900px` 为 `72px`；波形以轨道垂直中心绘制，上下各留 `6px`，Canvas 继续按 CSS 尺寸与 DPR 配置。
- 新增纯恢复决策：同一 URL 歌曲恢复为有效文件或 paused/playing/ended 后，使用 route generation 与 signature/in-flight 防护合并为一次 `controller.enter(trackId)`，且不播放。
- 当前可播放歌曲与 URL 不同时保留原不可用页面，显示可访问名称包含歌曲名的“编辑当前歌曲”；点击后 `router.replace` 到当前歌曲，由既有 route 流程进入。
- 错误 hash、权限拒绝、文件缺失或解码失败保持不可用，不切歌、不新建/覆盖草稿；AudioSessionService 严格歌曲身份规则不变。
- point marker button、菱形、候选框与事件时间共享同一 X 中心；菱形自身居中旋转，引线由按钮伪元素独立绘制。

Exit gate:

- AC-E801–AC-E805 的 unit、integration 与真实 Chrome/Edge 专项均通过；四视口高度、DPR、6px 安全区和 marker X/Y `<=1 CSS px` 有实际测量。
- 同歌恢复保持 paused 且无重试循环；异歌不静默切换，显式 replace 后进入正确工程；错误文件与草稿原子性通过。
- E1/E2/E3/E7 与 M5 恢复相关回归、typecheck、build、docs 和 diff check 通过且无 pageerror/异常 console。
- Visualizer V5 已独立提交，owner 已允许随后单独提交 E8；E8 implementation commit 与 25/25 clean canonical 已完成并登记 `in-review` evidence。只有 owner 验收后才关闭 R-022/R-024/R-025 并把 E8 标为 `Complete`。

## 5. Test and Eval Commands

E1 已实现、通过并获 owner 批准；以下为真实命令：

```text
npm run test:e1:unit
npm run test:e1:integration
npm run test:e2e:e1
npm run eval:e1:provisional
npm run eval:e1
```

E2–E6 命令已经实现并产生已批准的 clean canonical；E7 新增并同步：

```text
npm run test:eN:unit
npm run test:eN:integration
npm run test:e2e:eN
npm run eval:eN:provisional
npm run eval:eN
```

其中 `N` 为 5–8。E8 另提供 `test:e2e:e8:chrome`、`test:e2e:e8:edge` 与合并命令。canonical 必须拒绝 dirty worktree，并记录 run ID、commit、环境、步骤结果、日志和 summary SHA-256。E1–E7 clean canonical 与 owner approval 均保留为历史；E8 clean canonical 已按该契约登记为 `in-review`。

## 6. Change Control and Exclusions

- Range 自动合并、自动裁剪、自由时间拖动、JSON 之外的工程格式、新依赖、移动端、非 Chromium、云同步和音频修改继续排除。
- 10,000 事件是当前支持范围内的性能门禁，不形成 lane、inner class 或 event schema 硬上限。
- BPM 算法或置信度参数变化必须更新 golden、验收与风险 R-026；引入第三方依赖仍需 owner 单独批准。
- project schema、runtime lease、时间 identity 或 renderer 边界变化时，回到 architecture review；验收阈值或浏览器矩阵变化时，delivery 与后续 quality 待复核。
- Analyzer readiness 只保留为历史范围证据；Editor 代码落地后不能借用它声称整体产品已就绪。

## 7. Plan Approval

下列四份 Editor delivery 文档已于 2026-08-26 获 `project-owner` 批准：

- [execution plan](execution-plan.md)
- [acceptance criteria](acceptance-criteria.md)
- [test strategy](test-strategy.md)
- [milestone plan](milestone-plan.md)

`我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。`

2026-08-26，`project-owner` 进一步批准 E1 canonical evidence 与人工结果，E1 据此关闭并只开放 E2；E3–E6 保持 `Planned`。

2026-08-27，`project-owner` 批准 E2 结果并开放 E3。E2 据此为 `Complete`、E3 为 `In Progress`，E4–E6 保持 `Planned`。

同日，E3 clean canonical `E3-2026-08-27T02-53-58-176Z-c670ddf5` 在实现 commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 上 26/26 通过。该执行事实进入 owner review，不改变逐里程碑批准规则。

同日，`project-owner` 明确批准 E3 canonical evidence、point lane、inner class、自适应网格与点标记结果，同意关闭 E3 并开放 E4。E4 据此为 `In Progress`，E5–E6 保持 `Planned`。

随后 E4 实现和 31/31 clean canonical 完成；run `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 绑定 commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` 与 summary SHA-256 `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff`。该事实只进入 `in-review` evidence，不关闭 E4、不开放 E5。

同日，`project-owner` 批准 E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果。E4 据此关闭，E5 开放实施，E6 继续为 `Planned`。

随后 E5 实现 commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 与 clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 完成，35/35 通过，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`。该事实只进入 `in-review` evidence；owner 人工任务和批准前 E5 不关闭、E6 不开放。

同日，`project-owner` 明确批准 E5 canonical evidence 与人工范围任务，同意关闭 E5 并开放 E6。E6 据此进入 `In Progress`；本批准不构成 E6 或 Editor release-readiness 通过。

2026-08-28，E6 clean canonical 在 commit `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` 上 40/40 通过。自动化实现阶段已完成；E6 的剩余交付门禁是 owner 对原生 OS picker、`beforeunload`、辅助技术与长会话的补偿验证和 evidence 审批，完成前不进入 Editor readiness。

同日，owner 明确先批准 E6，再要求实施 E7 紧凑工作台。E6 据此关闭；E7 只改变布局密度和区域视觉，不改变 E1–E6 的公共契约。Editor readiness 延后到 E7 获批。

2026-09-03，owner 以 E8 完整实施指令批准本计划扩展、ADR-0018、AC-E801–AC-E805 与 E8 quality 契约并开放实施。Visualizer V5 独立提交后，owner 明确允许随后单独提交 E8。implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 与 25/25 clean canonical 已完成；owner 验收前 E8 仍为 `In Progress`。
