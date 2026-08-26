---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
next_action: "project-owner 审阅 Editor E0 任务、正确性、响应和恢复指标"
---

# Success Metrics

Analyzer 指标已由 M3–M11 和 Analyzer-only readiness 形成历史证据。下列新增 Editor 指标保持 `in-review`，只能驱动后续 Editor 架构、验收和 eval，不得反向表述为现有代码已经达到。

## Product and Learning Outcomes

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| Owner 核心任务完成 | `project-owner` 完成加载、选卡、换卡、比较、跳转、刷新恢复的全部脚本任务 | 在批准的浏览器、fixture 和视口矩阵执行任务脚本，逐项记录通过/失败与证据 | 首个三特征切片验收及后续回归 |
| 首批特征解释正确率 | owner 对 3/3 个预设音频片段正确解释 RMS、Amplitude Spectrum、Chroma 数值与听感/音色关系 | 使用预先写定答案要点的黄金片段，先完成任务再对照评分 | 首个三特征切片验收 |
| 完整特征覆盖 | `src/data/analyzerData.ts` 的 21/21 个特征均有类型定义、renderer、黄金测试和可用卡片 | feature registry 覆盖检查、自动化测试与 owner 验收 | 最终特征里程碑 |

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
- 播放、切歌、跳转、选卡和换卡均可用键盘完成，焦点可见，图表结论不只依靠颜色，reduced motion 下无非必要动画。
- Analyzer 已在真实 Chrome/Edge 形成 M11 证据；Editor 的路由、草稿、标记和右键交互变化后必须重新执行自己的双浏览器矩阵，不得继承 Analyzer 通过状态。

## Editor E0 Product Outcomes（in review）

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

## Approval Record

Analyzer 目标和阈值由 `project-owner` 于 2026-07-24 批准，并已由 Analyzer-only readiness 收口。Editor 指标于 2026-08-26 随 E0 需求转写进入 `in-review`；owner 单独批准前不生效，也不允许创建 Editor system design。获批后，delivery 文档再定义 fixture、步骤和容差，quality 阶段只在成功、失败、边界与异常证据齐全后判断 Editor readiness。
