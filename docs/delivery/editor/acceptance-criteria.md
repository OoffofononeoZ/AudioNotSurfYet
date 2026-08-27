---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/editor/project-format-v1.md"
  - "docs/architecture/editor/interaction-contracts.md"
  - "docs/delivery/editor/execution-plan.md"
next_action: "owner 复核 AC-E501–AC-E505 canonical 与人工范围任务；批准前不开放 E6"
---

# Editor E1–E6 Acceptance Criteria

## 1. Evidence Rules

- `Pass` 必须附可重现的命令、测试报告、浏览器状态、真实几何/计时、artifact hash 或 owner 签字。
- 单一 happy path 不能代表歌曲身份、导入、持久化、右键状态、恢复或资源生命周期完成。
- clean canonical 必须绑定干净 commit；provisional 只用于实现反馈，不能登记为正式通过。
- 原生 picker、离页提示和辅助技术无法完全自动化时，必须记录原因、手工步骤、浏览器、结果和残余风险。
- 任一阈值、fixture、browser matrix 或 schema 变化必须先更新 delivery/architecture 文档，不能在失败测试中临时放宽。

## 2. E1 — Entry, Playback and Project Foundation

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E101 | `/editor/:trackId?` 严格使用 URL/current track identity；无效、不可恢复或 hash 不匹配的歌曲不得静默改用其他歌曲 | router/service integration + Chrome E2E | R-022, R-023 |
| AC-E102 | Header Editor 进入当前歌曲；无歌曲显示空状态并保留 MusicBar；播放列表每首歌曲有可访问“去编辑”按钮和 Tooltip，并显式播放指定歌曲 | DOM/route E2E + keyboard | R-022 |
| AC-E103 | 有效 Editor track 隐藏 MusicBar并 repeat-one；离页恢复 queue-next；只有当前 playback lease token 可释放，始终只有一个 AudioEngine/AudioContext/播放时钟 | fake-clock integration + 20 次快速 route/track 序列 | R-022 |
| AC-E104 | JSON V1 导出再导入后，歌曲 identity、tempo、lane、inner class、point/range 和 workspace 语义一致；稳定 ID 由 `crypto.randomUUID()` 生成 | deterministic codec round-trip + browser download/upload | R-023 |
| AC-E105 | 未知字段/schema、歌曲 hash/时长不匹配、重复 ID、悬空引用、越界、重复 point 或重叠 range 在完整校验前拒绝；当前工程与旧 durable draft 不变 | validator table + atomic import fault injection | R-023 |
| AC-E106 | 独立 `audionotsurfyet-editor` V1 只保存 `draft/latest`；同歌刷新/重进恢复，异歌必须在导出旧工程、覆盖草稿、取消进入中选择 | fake-indexeddb + Chrome refresh/navigation E2E | R-023 |
| AC-E107 | 内存先更新；250ms debounce 后保存，pointerup/输入确认/导入成功/路由离开立即 flush；quota/abort 显示 `not-persisted` 且保留内存与旧 durable draft | repository integration + browser fault injection | R-023 |
| AC-E108 | Editor analysis consumer acquire/release、快速路由和 stale generation 不改写 Analyzer 已保存的 card workspace，也不创建第二 Worker | coordinator integration + Editor/Analyzer route E2E | R-027 |

## 3. E2 — Timeline and Tempo

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E201 | 波形、游标、tempo boundary、measure/beat grid 在 1024/1280/1920、DPR、zoom/pan/resize 下对同一时间的 x 差不超过 1 CSS px | pure geometry unit + `getBoundingClientRect()`/Canvas probe | R-024 |
| AC-E202 | 波形 click seek、指针锚点滚轮 zoom、右键超过 4px pan、按钮 25% pan、reset 和 1–64 zoom 使用同一 viewport；可见反馈不超过 100ms | pointer/keyboard E2E + interaction timing | R-024, R-025 |
| AC-E203 | 第一 tempo segment 从 0 开始；新边界有序且继承前段；20–300 接受整数/小数，负数、非数字、非有限数、超 300 拒绝；`0 <= BPM < 20` 规范化 single-beat | tempo unit/property table + form E2E | R-026 |
| AC-E204 | metered 默认 4/4；measure 线贯穿所有 lane，beat 线半透明且不重复 measure 位置；single-beat 隐藏/禁用拍号且区间内无 beat/measure 线 | grid golden + browser geometry | R-024, R-026 |
| AC-E205 | 60/100/128/127.5 BPM 估计误差不超过 `max(0.5 BPM, target × 1%)`；silence、固定噪声和歧义输入为 low-confidence | versioned PCM/golden + Worker unit | R-026 |
| AC-E206 | BPM estimator 使用真实脉冲间隔，不任意半拍/双拍归一化；只在唯一空且未编辑 segment 写入，stale/cancel/低置信度不得覆盖用户值 | Worker/integration race matrix | R-026, R-027 |

## 4. E3 — Point Annotation

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E301 | point lane 与 inner class 可新增/重命名；每 lane 至少一个 inner class；删除含事件分类前必须迁移事件或明确删除 | domain unit + dialog E2E | R-023, R-025 |
| AC-E302 | 根据 12 CSS px 可靠宽度在 `1/16, 1/8, 1/4, 1/2, 1 beat` 选择最细吸附；zoom/tempo 后续变化不改写已有规范化秒数 | snapping unit + zoom regression | R-024 |
| AC-E303 | 左键或 Enter/Space 创建；同 lane/inner class/规范化时间不重复；右键已有 point 或 Delete/Backspace 删除 | mouse/keyboard E2E + uniqueness validator | R-023, R-025 |
| AC-E304 | 方向键、Home/End 可移动候选/跳转；焦点可见；hover/focus 候选与选中标记不只依靠颜色 | accessibility inspection + keyboard script | R-025 |
| AC-E305 | Canvas 绘制网格/背景，DOM 只实例化当前 viewport 可见事件；inner class 全展开但空 cell 不生成节点 | DOM-count integration + viewport E2E | R-025 |
| AC-E306 | `Esc`、pointercancel、blur、route leave 清理候选、pressed、pointer capture 和菜单；空白右键区分 4px pan 与快速菜单 | pointer-state unit + Chrome E2E | R-025 |

## 5. E4 — Analysis Overlay

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E401 | 累计 21 项一次只选一个 overlay，scalar/vector/frequency/waveform/structured renderer family 均可绘制；选择 Buffer 时 analysis request 不重复 | registry exhaustiveness + renderer golden + coordinator integration | R-027 |
| AC-E402 | overlay 默认 `topRatio=0.10`、`heightRatio=0.35`、最小 `0.12`；三手柄支持 pointer、1% 键盘步长和 Shift 5% 步长，并限制在标记区域 | pure bounds unit + pointer/keyboard E2E | R-024, R-025 |
| AC-E403 | selector/手柄之外全部 pointer-through；穿透位置命中与无 overlay 时相同的底层候选 cell，几何差不超过 1 CSS px | layered hit-test E2E | R-024, R-025 |
| AC-E404 | exact cursor 继续合并/丢弃 stale，Editor consumer 不污染 Analyzer workspace/cache identity；返回 Analyzer 后卡片恢复 | coordinator race + route E2E | R-027 |
| AC-E405 | 单 overlay renderer/context/shape 错误只显示可重试错误；播放、波形、点标记、草稿和导出继续可用 | fault injection + browser E2E | R-024, R-027 |

## 6. E5 — Range Annotation

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E501 | 第一次左键固定起点并预览，只允许更晚 cell；第二次有效点击完成；`Esc` 或待选状态空白右键取消 | range state-machine unit + mouse/keyboard E2E | R-025 |
| AC-E502 | range 为半开 `[start,end)`；`end > start`，最短一个当前网格单位，端点手柄吸附且不能穿越 | boundary/property tests + drag E2E | R-023, R-024 |
| AC-E503 | 同 lane/inner class 真重叠拒绝、相邻端点允许；不同 lane/inner class 可重叠，point 可位于 range 内，不自动合并或裁剪 | overlap matrix unit + browser tasks | R-023 |
| AC-E504 | pointercancel/blur/route leave 回滚未完成创建/拖动；右键已有 range 删除；键盘可创建、取消、选择端点、调整和删除 | pointer rollback + keyboard E2E | R-025 |
| AC-E505 | point/range JSON 与 draft round-trip 保持语义；无效、重叠或越界 range 导入拒绝且不覆盖当前工程 | codec/validator/repository integration | R-023 |

## 7. E6 — Final Hardening

| ID | Criterion | Verification | Risk |
| --- | --- | --- | --- |
| AC-E601 | 最新稳定 Chrome/Edge 均完成本地 MP3/WAV/FLAC 加载、指定/当前歌曲进入、循环、工程导入导出和恢复核心流程 | 双浏览器 canonical + native manual matrix | R-022, R-023, R-027 |
| AC-E602 | 约 15 分钟、20 lanes、每 lane 最多 8 inner classes、合计 10,000 point/range events 下核心输入反馈不超过 100ms，Editor/分析归因主线程任务无单个超过 50ms | deterministic runtime stress + PerformanceObserver/trace | R-025 |
| AC-E603 | 压力工程只实例化 viewport 可见事件 DOM；zoom/pan、编辑、overlay、autosave 和导出保持正确，不以降低时间事实或删除事件过门禁 | DOM/resource counters + task script | R-024, R-025 |
| AC-E604 | 20 次 Editor/Analyzer/Home、换歌和 overlay 生命周期不单调累积 AudioContext、Worker、RAF、Canvas、Object URL、Observer 或监听器 | instrumented Chrome/Edge E2E + DevTools sample | R-022, R-027 |
| AC-E605 | 1024/1280/1920、DPR、reduced motion 下无关键遮挡；核心任务可用键盘完成、焦点可见、状态非纯颜色、辅助技术名称清晰 | Playwright accessibility + owner manual | R-024, R-025 |
| AC-E606 | E1–E6 每个里程碑均有 provisional、clean canonical、run identity/hash/environment 和 owner approval；E6 owner 能完成包含 point/range/tempo/overlay/round-trip 的完整逆向标注任务 | evidence audit + signed owner task | R-022–R-027 |

## 8. Milestone Exit Rule

每个里程碑只能在其全部适用 AC、有明确成功/失败/边界/异常证据、相关风险复核、clean canonical 和 owner 批准后关闭。本 AC 于 2026-08-26 获 `project-owner` 批准；E1 开放实施不构成 AC-E101–AC-E108 已通过。
