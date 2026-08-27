---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/editor/project-format-v1.md"
  - "docs/architecture/editor/interaction-contracts.md"
next_action: "复核 E2 canonical 与人工任务；批准前 E3 保持 Planned"
---

# Editor E1–E6 Execution Plan

## 1. Delivery Outcome

把已批准的 Editor“逆向制曲”架构按 E1–E6 纵向切片交付：先建立正确歌曲入口、单引擎循环和安全工程基础，再增加时间轴、点标注、分析叠加、范围标注，最后完成双浏览器与大规模事件加固。

本计划只覆盖 Editor，不重新打开已完成的 Analyzer M1–M11、canonical evidence 或 Analyzer-only readiness。`project-owner` 于 2026-08-26 明确批准本计划、acceptance criteria、test strategy 与 milestone plan，并同意开始 E1；该批准只开放 E1，E2–E6 仍须逐里程碑门禁。

## 2. Delivery Principles

- 每个里程碑必须形成可独立使用的纵向结果，不能用后续切片补足当前退出门禁。
- 每个里程碑按“实现与专项测试 → dirty-worktree provisional → 实现提交 → clean-HEAD canonical → evidence 登记 → owner 审批”关闭。
- E1–E5 专项 E2E 使用真实 Chrome；E6 在真实 Chrome 和 Edge 上执行 E1–E6 全量，并回归 M3–M11 关键播放、恢复、Worker、路由和资源契约。
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

## 5. Test and Eval Commands

E1 已实现、通过并获 owner 批准；以下为真实命令：

```text
npm run test:e1:unit
npm run test:e1:integration
npm run test:e2e:e1
npm run eval:e1:provisional
npm run eval:e1
```

E2 命令已经实现并产生 clean canonical；E3–E6 在各自里程碑实现时新增并同步：

```text
npm run test:eN:unit
npm run test:eN:integration
npm run test:e2e:eN
npm run eval:eN:provisional
npm run eval:eN
```

其中 `N` 为 3–6；E3–E6 仍为计划命令。canonical 必须拒绝 dirty worktree，并记录 run ID、commit、环境、步骤结果、日志和 summary SHA-256。E1 clean canonical 已在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过并获批准；E2 clean canonical 已在 commit `9fc5c0a81fcf90abfbc665412277147cd958200f` 上 22/22 通过并等待 owner 批准。

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
