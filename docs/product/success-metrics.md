---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-01
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
next_action: "在系统设计和交付计划中确定自动处理准确度、人工介入量、输出格式及质量阈值"
---

# Success Metrics

## 视频产出主目标的成功信号（2026-10-01 获批方向）

| 结果 | 目标 | 观察方法 | 待决定项 |
| --- | --- | --- | --- |
| 自动生成 | owner 能从一首有明确使用许可的歌曲出发，优先使用获批的自动处理和映射能力生成可回放的视频，完成任务所需的人工步骤尽量少 | 固定歌曲与预写任务脚本记录自动完成环节、必要人工介入次数、完成时间和最终文件 | 代表性歌曲、可接受的人工介入量和时间；各项自动能力的交付切片 |
| 自动结果可修正 | 自动处理能力获批后，其结果能被检查、手动修正或覆盖并进入同一视频制作任务，失败时有明确反馈 | 用固定歌曲对比自动结果、人工修正和最终视频；分别记录成功、空结果与错误路径 | 音轨/BPM/音色标记的准确率、置信度和失败阈值 |
| 手动制作可完成 | 自动处理不适用、失败或用户选择手动操作时，owner 能完成节拍/事件标记、视觉绑定并保存可回放的视频 | 预写任务脚本从手动输入走到最终文件，记录步骤、失败反馈和回放结果 | 手动路径的最小必要操作与可接受完成时间 |
| 产物可用 | 输出文件包含预期音频与视觉，节拍或标记对应的画面变化可在回放中定位 | 对固定事件记录输入时间和视频中的音画时间；核对文件可打开、时长与事件位置 | 新目标是否沿用现有实时 WebM、音画容差及其他格式 |

这些是已批准产品方向的可观察信号，不是已完成测试或新能力的量化验收标准。阈值、fixture 和技术方案在后续阶段确定。下文的 Analyzer、Editor 和 Visualizer V0 指标继续解释各自已批准的历史范围。

Analyzer 指标已由 M3–M14 和 Analyzer-only readiness 形成历史证据，Editor 指标也已由 E1–E7 收口。下列 Visualizer V0 指标已获产品批准，但仍只是未来交付目标；它们不得反向表述为当前 `/comingsoon`、试验组件或既有 readiness 已经达到。

## Product and Learning Outcomes

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| Owner 核心任务完成 | `project-owner` 完成加载、选卡、换卡、比较、跳转、刷新恢复的全部脚本任务 | 在批准的浏览器、fixture 和视口矩阵执行任务脚本，逐项记录通过/失败与证据 | 首个三特征切片验收及后续回归 |
| 首批特征解释正确率 | owner 对 3/3 个预设音频片段正确解释 RMS、Amplitude Spectrum、Chroma 数值与听感/音色关系 | 使用预先写定答案要点的黄金片段，先完成任务再对照评分 | 首个三特征切片验收 |
| 完整特征覆盖 | `src/data/analyzerData.ts` 的 21/21 个特征均有类型定义、renderer、黄金测试和可用卡片 | feature registry 覆盖检查、自动化测试与 owner 验收 | 最终特征里程碑 |
| 全卡片可发现性 | 页面始终存在 21 张唯一卡，DOM/键盘/读屏顺序等于 `FEATURE_IDS`；收起态不挂载图表资源 | Chrome/Edge DOM、可访问性与 Canvas 计数 | M13 |
| 活动分析上限 | 任意快速序列中活动 FIFO 始终唯一且最多四项；第五项淘汰最早项 | reducer、coordinator 集成和双浏览器交互 | M13 |
| 自定义顺序正确性 | 鼠标、touch、点击动作和键盘得到相同的 21 项完整插入顺序；DOM/键盘/读屏与该顺序一致 | pure reducer + Chrome/Edge DOM/focus/live-region | M14 |
| 顺序恢复与隔离 | 自定义顺序跨刷新/切歌恢复；排序不改变 FIFO 年龄、Worker generation、cache、exact value 或 Canvas 身份 | repository/service integration + 双浏览器刷新/FIFO 回归 | M14 |
| 排序生命周期 | pointer cancel/blur/route leave 不提交旧顺序；反复排序无 RAF/Observer/Canvas/Worker 增长，反馈保持 100ms 内 | Chrome/Edge cancellation、resource loop 和 PerformanceObserver | M14 |

owner-only 学习验证是当前批准方式，不推断为广泛用户研究结果。若未来需要对外声称普遍学习效果，必须补充新的样本和研究设计。

## Correctness and Synchronization

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| Meyda 结果一致性 | 与同版本、同参数、同 PCM 输入的直接 Meyda 提取黄金结果在约定浮点容差内一致 | 对 silence、正弦、双音、impulse 和同源格式 fixture 逐帧/逐元素比较 | 每个特征切片 |
| 播放游标同步 | 播放、暂停、跳转和恢复后的分析游标相对 AudioContext 基准偏差不超过 100ms | 记录引擎时间、期望跳转时间和显示游标时间；覆盖正常与边界路径 | 首个切片及回归 |
| 缓存身份隔离 | track、config 或 feature 任一变化都不复用不匹配结果；取消 job 的迟到消息不进入 UI | cache-key 单元测试、Worker 集成测试和快速换歌/换卡场景 | Worker 里程碑 |

浮点容差由交付验收标准固定；如果某一特征需要不同容差，必须给出可复现原因，不能临时放宽。

## Responsiveness and Reliability Guardrails

| Metric | Threshold | Observation method |
| --- | --- | --- |
| 主线程输入反馈 | 分析期间用户输入的可见反馈保持在 100ms 内 | 浏览器性能 trace 与 Playwright 交互计时 |
| 分析归因长任务 | 不产生可归因于分析计算的主线程长任务（单任务超过 50ms） | 对最大支持时长运行 PerformanceObserver/DevTools trace |
| 分析完成时长 | 不设 wall-clock SLA；必须有进度、取消和过期结果隔离 | Worker 消息与取消场景测试 |
| 恢复韧性 | 权限 prompt/denied、文件移动、quota 失败或缓存缺失不会破坏当前页面内可用会话 | IndexedDB 与浏览器恢复矩阵 |
| 运行时信号 | 批准场景中无未处理异常、控制台 error/warn 或泄漏的 Worker/Audio/Object URL | 自动化监听、资源生命周期测试和手工控制台检查 |

## Compatibility and Accessibility Guardrails

- MP3、WAV、FLAC 的同源 fixture 在最新稳定版 Chrome 和 Edge 桌面端完成加载、播放和首批分析。
- 在 1024、1280、1920 CSS px 验证真实几何、Canvas 像素尺寸与核心控件可用性。
- 播放、切歌、跳转和展开/收起卡片均可用键盘完成，焦点可见，图表结论不只依靠颜色，reduced motion 下无非必要动画。
- Analyzer 已在真实 Chrome/Edge 形成 M11 证据；Editor 的路由、草稿、标记和右键交互变化后必须重新执行自己的双浏览器矩阵，不得继承 Analyzer 通过状态。

## Editor E0 Product Outcomes（approved）

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| 正确歌曲进入 | Header 进入当前歌曲；播放列表“去编辑”进入指定歌曲；无歌曲显示明确空状态 | Chrome/Edge 路由任务记录目标 track identity、页面状态和是否误切歌曲 | E1 |
| 点标记任务 | owner 能建立 lane/inner class，并完成点事件创建、重复阻止、删除和自适应网格定位 | 使用固定 tempo fixture，在多种 zoom 下逐项执行鼠标与键盘脚本 | E3、E6 |
| 范围标记任务 | owner 能完成创建、取消、调整、删除；同 lane/inner class 重叠被阻止，其他分类允许并存 | 使用包含相邻、重叠、最短单位和边界区间的任务脚本 | E5、E6 |
| 工程 round-trip | JSON 导出再导入后，歌曲身份、tempo、分类、点/范围事件和工作区语义一致 | codec golden、严格 validator 与浏览器导入导出任务 | E1、E5、E6 |
| 草稿保护 | 同歌刷新/重进恢复；异歌进入不会静默覆盖；保存失败不丢当前内存编辑 | IndexedDB 集成测试、quota/transaction 故障和浏览器离开/覆盖任务 | E1、E6 |
| 分析辅助可用 | owner 能选择一个特征，并用对齐图表辅助定位至少一个点事件和一个范围事件 | 预写音频片段、标记答案窗口和 owner 任务记录 | E4、E6 |

首版只验证 owner 能否完成逆向标注任务，不声称 Editor 能自动识别全部音符、效果或替代专业制曲流程。

## Editor Correctness and Interaction Guardrails

| Metric | Target | Observation method |
| --- | --- | --- |
| 时间几何对齐 | 波形、tempo 网格、点/范围事件与 Meyda 叠加层使用同一时间映射，目标误差不超过 1 CSS px | 对固定时间点读取各层真实 DOM/Canvas 几何，覆盖 zoom、pan、DPR 和多视口 |
| 播放与 seek 同步 | 页内播放、循环、波形/标记跳转后的可见游标相对 AudioContext 基准不超过 100ms | 真实 Chrome/Edge 计时，覆盖暂停、区间尾、刷新和离页恢复 |
| 点事件唯一性 | 同 lane、inner class 和吸附时间只存在一个点事件 | 纯函数、导入校验和交互重复创建测试 |
| 范围有效性 | `end > start`，最短一个当前网格单位；同 lane/inner class 范围不重叠，手柄不穿越 | 创建、拖动、导入及 viewport 精度变化的边界测试 |
| 导入安全 | 未知 schema、歌曲不匹配、重复 ID、越界/重叠事件或无效 tempo 不覆盖当前工程 | validator、repository 事务故障和浏览器错误提示测试 |
| BPM 输入边界 | `20–300` 支持整数/小数；`0 <= BPM < 20` 进入单拍模式；负数、非数字、非有限数和大于 300 被拒绝 | tempo 纯函数与表单边界测试；自动估计覆盖可靠和低置信度输入 |

## Editor Responsiveness, Reliability and Accessibility

- 分析或大规模标记期间，核心输入的可见反馈保持在 100ms 内；不产生可归因于 Editor/分析计算、单任务超过 50ms 的主线程长任务。
- 同时保持一个实时 AudioContext、一个播放时钟和按需的单个产品分析 Worker；20 次进入/离开、换歌和 overlay 切换不出现资源单调累积。
- 在 1024、1280、1920 CSS px、DPR 和 reduced motion 下验证波形、tempo、全部 inner class、点/范围事件与叠加手柄的可用性。
- 播放、seek、zoom/pan、tempo、点/范围事件、导入导出、自定义右键菜单替代动作和 overlay 调整均提供键盘路径、可见焦点与非纯颜色状态。
- Chrome/Edge 均覆盖成功、失败、边界和异常路径；原生文件选择或浏览器离页提示不能完全自动化时，必须登记残余风险与 owner 补偿检查。

## Visualizer V0 Product Outcomes（approved）

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| 工作台核心任务 | owner 能为当前歌曲选择模板、配置绑定、播放/seek、实时预览、保存并恢复工程 | 使用固定歌曲、Analyzer cache 和同歌 Editor 工程，在 Chrome/Edge 逐项执行脚本 | V1–V4、V6 |
| 单场景边界 | 任一时刻只存在一个活动模板和一个输出画布；切换模板后旧场景不再更新或占用资源 | registry/controller 集成测试、Canvas/RAF/WebGL 资源计数 | V1、V3、V4、V6 |
| 分析特征上限 | 0–4 个唯一 FeatureId 合法；第五项在进入 Worker 前被拒绝并说明原因；同一 FeatureId 的多个绑定只占一项 | binding planner 单元测试、Coordinator 集成与双浏览器参数操作 | V2、V6 |
| 绑定释放与隔离 | 替换或删除最后一个引用后释放不用的特征；迟到分析结果不覆盖新模板、歌曲或绑定 | active-set、generation、cache hit/miss、stale/cancel 集成测试 | V2、V6 |
| Editor 数据一致性 | 同歌 draft 或导入 JSON 的 lane/inner class 可绑定；歌曲不匹配、无效引用或导入失败不改变当前工程 | point/range golden、严格校验和浏览器原子导入任务 | V2、V3、V4、V6 |
| 工程 round-trip | 导出再导入后，歌曲身份、16:9 预设、模板版本、参数、绑定和 Editor 快照语义一致 | canonical codec、严格 validator 与 Chrome/Edge 原生文件任务 | V1、V2、V6 |
| 正交线条表达 | 主要音色事件只驱动横线的批准参数，鼓点事件只驱动竖线的批准参数；point 为 pulse，range 为 gate | 版本化 Editor event fixture 与逐帧场景状态 golden | V3、V6 |
| 立方体群表达 | 默认 Amplitude Spectrum 驱动中心结构、drum 驱动 `coreScale`、Energy 驱动 `riseSpeed`，固定 `orbitSpeed` 不随音频变化 | 版本化分析/Editor fixture、renderer state golden 与浏览器观察 | V4、V6 |
| 实时 WebM 输出 | 720p/1080p、30/60fps 预设在支持的浏览器产生可回放的 WebM 音视频文件 | FFmpeg/ffprobe 检查容器、音轨、尺寸、fps、时长，并在 Chrome/Edge 回放 | V5、V6 |

## Visualizer Correctness and Synchronization Guardrails

| Metric | Target | Observation method |
| --- | --- | --- |
| 播放与视觉同步 | 当前播放时间到场景可见反应的偏差不超过 50ms | 对固定 point、range 和分析峰记录 AudioContext 基准与 renderer frame 时间 |
| 交互反馈 | 模板、参数、绑定、播放、seek 和录制控制的可见反馈不超过 100ms | Playwright 交互计时与浏览器性能 trace |
| 录制音画同步 | 完成文件的音画漂移不超过 100ms | 在确定性 impulse/flash fixture 上比较音轨与视频帧时间 |
| 工程原子性 | 未知模板/字段、歌曲不匹配、无效引用或超过四项分析特征时，当前内存工程和 durable draft 都不被部分替换 | validator、repository 故障注入和浏览器导入失败任务 |
| 播放结束策略 | Visualizer 中自然结束后保持当前歌曲并暂停，不循环、不调用下一首；离页恢复普通队列策略 | fake clock/service 集成与 Chrome/Edge ended/route 测试 |

## Visualizer Responsiveness, Reliability and Accessibility

- 约 15 分钟输入和最重四特征场景下，不产生可归因于 Visualizer/分析、单任务超过 50ms 的主线程长任务。
- 20 次路由、模板、歌曲恢复和录制生命周期后，AudioContext、Worker、RAF、Canvas/WebGL、MediaStreamTrack、Observer、listener 和 Blob URL 不单调累积。
- 1024、1280、1920 CSS px 与代表性 DPR 下保持三栏工具、固定 16:9 预览、底部 transport 和可达控件；具体断点在 delivery 阶段固定。
- 模板、参数、绑定、播放、seek、工程导入导出和录制均提供键盘路径、可见焦点、文字标签与非纯颜色状态。
- reduced motion 只关闭工作台非必要过渡；用户主动播放或录制的场景仍按工程参数运行。
- WebM MIME 或编码资源不满足时，必须在录制开始前或失败点明确说明并保留工程/预览；不能生成看似成功但无音轨、尺寸错误或无法回放的文件。

## Approval Record

Analyzer 目标和阈值由 `project-owner` 于 2026-07-24 批准，并已由 Analyzer-only readiness 收口。`project-owner` 于 2026-08-26 先批准 Editor E0 产品意图，随后明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”Editor 指标与架构据此生效；delivery 文档仍须另行定义 fixture、步骤和容差，quality 阶段只在成功、失败、边界与异常证据齐全后判断 Editor readiness。

2026-08-31，owner 批准 M13 的 21 卡可发现性、最多四项 FIFO、按需挂载和资源门禁；历史 M7–M12 指标保留，但涉及四 slot/默认活动卡的断言不再代表 M13 候选。

2026-09-01，owner 批准 M14 的完整顺序、输入等价、全局恢复、FIFO 隔离和资源指标。M14 clean canonical 19/19 通过，unit 24/24、integration 19/19、Chrome/Edge 各 3/3 且排序 Worker analyze request 保持 `1 → 1`；指标据 owner 完成后续授权复核为达到，M13 canonical 保留为历史。

2026-09-02，owner 要求把 Visualizer 的实时预览、两个内置场景、0–4 分析特征绑定、Editor 事件绑定、工程 round-trip 和实时 WebM 路线写入产品指标，并明确回复：“我批准 Visualizer V0 产品意图、单场景模板模型、最多四项分析特征、两个内置场景与 WebM 路线；同意进入 Visualizer 架构设计。”上述指标据此获批并开放 system design；这里列出的观测方法仍不是已执行证据，也不开放 delivery、实现或 readiness。
