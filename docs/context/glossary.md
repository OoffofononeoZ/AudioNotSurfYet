---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/context/index.md"
next_action: "以 E3 owner task 复核 point、inner class、adaptive grid 与 viewport-visible DOM 术语"
---

# Glossary

| Term | Definition | Why it matters | Related docs |
| --- | --- | --- | --- |
| AudioNotSurfYet | 本仓库与计划使用的项目名；`package.json` 当前包名仍为 `audiosurf` | 名称尚未形成单一代码级来源 | [index](index.md) |
| `AudioEngine` | 独占实时 AudioContext、AudioBuffer、source、Analyser 和 Gain 的播放服务 | 所有页面共享同一播放时钟和资源生命周期 | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) |
| `AudioSessionService` | 在 store 外拥有 File、封面 URL、播放命令、ended 循环、generation 和单 RAF 的应用服务 | 把运行时浏览器资源与可序列化事实分开 | [system map](system-map.md) |
| `audioSessionStore` | 保存 TrackRecord 队列、当前歌曲、PlaybackSnapshot、当前能量和 AnalysisSnapshot 的 Pinia store | 持久化与 UI 只能依赖序列化状态；PCM、Worker 和 compact payload 不进入 `$state` | [interface contracts](../architecture/interface-contracts.md) |
| MusicBar | 固定在共享布局底部的播放、队列、元数据、进度和能量灯带 UI | 只读取共享状态并发送 session 命令 | [system map](system-map.md) |
| style 0 | 音频能量驱动 `--coinc-process` 的悬浮灯带样式 | 只在实际播放/分析数据存在时应有能量进度 | [working agreements](working-agreements.md) |
| style 1 | GSAP 独立循环旋转渐变的悬浮样式 | 动画值不是音频能量，切换时需显式复位 | [working agreements](working-agreements.md) |
| style 2 | 展开为视口宽矩形的 MusicBar 样式 | 进度条由 CSS 固定在矩形上边 | [working agreements](working-agreements.md) |
| audio energy | Meyda 从 Analyser 时域浮点数据中提取的 `energy` 特征 | 同时驱动 MusicBar 灯带和 Home 光线长度 | [system map](system-map.md) |
| `--coinc-process` | MusicBar CSS 圆锥渐变使用的角度变量 | GSAP 与音频循环都可能写入，所有权切换需清楚 | [decision registry](decision-registry.md) |
| playback offset | AudioEngine 保存的缓冲区秒数位置 | 暂停和 seek 以此为基点，播放时间由 AudioContext `currentTime` 计算 | [system map](system-map.md) |
| `PlaybackSnapshot` | track、状态、秒数、时长、0–1 音量和 typed error 的可序列化事实 | UI 不从 AudioNode 或 RAF delta 推断播放状态 | [interface contracts](../architecture/interface-contracts.md) |
| object URL | 浏览器为内嵌封面 Blob 创建的临时 URL | 音频解码不依赖它；封面在删除、清空和 dispose 时成对释放 | [working agreements](working-agreements.md) |
| `SessionRepository` | 使用原生 IndexedDB V1 保存最近会话、文件句柄、当前 Blob 和当前分析缓存 envelope 的仓储 | 把浏览器持久化资源与 Pinia/播放运行时隔离 | [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md) |
| `PersistedSessionV1` | 带 runtime validation 的最近会话 schema；包含队列、当前歌曲、分析 UI 快照和持久化对象身份 | 未知 schema 不猜测迁移，必须显示可清除错误 | [interface contracts](../architecture/interface-contracts.md) |
| current Blob | IndexedDB 中固定键保存的唯一当前歌曲 Blob | 保证刷新时当前歌曲无需再次授权即可回到 0 秒 paused；切歌时原子替换旧值 | [system map](system-map.md) |
| restore state | 每个 TrackRecord 的 `available`、权限、缺失、内容变化、不可持久化或解码失败状态 | 使恢复失败可见且提供恢复访问/重新选择动作 | [interface contracts](../architecture/interface-contracts.md) |
| content hash | 导入时对编码文件内容顺序计算的 SHA-256 | 恢复/重新选择时作为内容变化的最终身份判断；大小与 lastModified 只作快速信号 | [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md) |
| `FeatureRegistry` | 对 `analyzerData.ts` 21 个 FeatureId 穷尽映射的类型化静态契约，包含 shape、renderer、里程碑、维度和 Worker 支持状态 | 防止特征说明、计算、payload 与渲染器各自维护漂移列表 | [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md) |
| `AnalysisConfig` | frame size、hop size、window、MFCC 数、实际 sample rate、mono policy 与 display rate 的不可变配置 | 其规范字符串 SHA-256 是 cache identity 的一部分 | [interface contracts](../architecture/interface-contracts.md) |
| `AnalysisSeries` | 单一 feature 在完整 track/config identity 下的紧凑 display payload、frame 数和时间步长 | UI 不得把不同歌曲、配置或 feature 的结果混用 | [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md) |
| generation | AnalysisCoordinator 每次活动特征、歌曲或解码 revision 变化时推进的运行时世代号 | Worker 即使无法立即取消，旧响应也不能改变 store、cache 或后续 UI | [interface contracts](../architecture/interface-contracts.md) |
| exact cursor | 针对当前秒数所在原始 frame 由 Worker 现场提取的非量化值 | 展示精确值不得以 compact display series 的反量化结果替代 | [eval plan](../quality/eval-plan.md) |
| cache identity | `schemaVersion + trackId + contentHash + configHash + featureId` 的完整组合 | 只有全部字段匹配才允许 cache hit；partial hit 只计算 misses | [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md) |
| compact payload | M6 定义的 scalar、frequency vector、category vector、waveform envelope、loudness、complex-derived 六类二进制显示数据 | 限制 postMessage/IndexedDB 体积，并由严格 decoder 拒绝损坏或错身份数据 | [interface contracts](../architecture/interface-contracts.md) |
| analysis workspace | 四个固定 slot、0–4 张当前里程碑可用卡和一个持久化 viewport 的共享 Analyzer 状态 | 区分首次无保存状态与用户明确保存的空工作区，避免刷新后擅自补回默认卡 | [interface contracts](../architecture/interface-contracts.md) |
| `M7_FEATURE_IDS` | M7 唯一允许选择的 `rms`、`amplitudeSpectrum`、`chroma` 常量集合 | 防止提前暴露 Energy、`spectralFlux` 或其他 M8 特征 | [decision registry](decision-registry.md) |
| `M8_SCALAR_FEATURE_IDS` | M8 新增的 ZCR、Energy、9 个 spectral scalar 与 2 个 perceptual scalar | 把里程碑新增项与累计可选集合分开验证 | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) |
| `M8_AVAILABLE_FEATURE_IDS` | M7 三项加 M8 十三项的累计 16 项集合 | UI、Worker 和持久化只开放已完成里程碑的 FeatureId | [interface contracts](../architecture/interface-contracts.md) |
| `M9_FEATURE_IDS` | M9 新增的 `powerSpectrum`、`mfcc`、`buffer` 集合 | 分开验证三种 vector/waveform shape 与累计范围 | [interface contracts](../architecture/interface-contracts.md) |
| `M9_AVAILABLE_FEATURE_IDS` | M8 十六项加 M9 三项的累计 19 项集合 | 固定 M9 历史边界，不随 M10 开放而改变 | [interface contracts](../architecture/interface-contracts.md) |
| `M10_FEATURE_IDS` | M10 新增的 `loudness`、`complexSpectrum` 集合 | 分开验证两种结构输出与最终里程碑范围 | [interface contracts](../architecture/interface-contracts.md) |
| `M10_AVAILABLE_FEATURE_IDS` | M9 十九项加 M10 两项的累计 21 项集合 | UI 与 Worker 的当前完整可选集合；仍最多四张唯一卡 | [interface contracts](../architecture/interface-contracts.md) |
| signed FFT frequency | 1024-bin Complex Spectrum 中 bin 0–512 映射非负频率，513–1023 映射负频率镜像 | 防止把完整复数 FFT 的后半错误标成 0–Nyquist 第二份正频率 | [system design](../architecture/system-design.md) |
| waveform envelope | Buffer 全曲显示层按时间桶保存的正负 min/max Int16 包络 | 避免缓存全部逐帧 1024 sample，同时 exact cursor 仍返回当前原始 frame | [system design](../architecture/system-design.md) |
| Spectral Flux v1 | 相邻幅度频谱逐 bin 正向差的 L1 和；第一帧与零能量帧为 0 | 替代 Meyda 5.6.3 有缺陷的 extractor，并由项目 golden 固定语义 | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) |
| shared viewport | 所有活动卡共同读取的 start/end/zoom；cursor 由播放快照实时派生且不持久化 | zoom、pan、click seek 和键盘 seek 在所有卡保持同一时间身份 | [system design](../architecture/system-design.md) |
| TestLands | `/testlands` 下的试验页面 | 当前不属于已批准产品表面或稳定接口 | [index](index.md) |
| lifecycle document | 带标准状态 frontmatter 的产品、设计、交付、质量、发布或复盘文档 | 下游工作依赖其批准与新鲜度 | [AGENTS.md](../../AGENTS.md) |
| Analyzer candidate | 由固定实现 commit、canonical run、环境和 artifact hash 共同标识的 Analyzer-only 候选 | 后续文档或 Editor 变化不能反向扩大该候选的证据范围 | [release readiness](../quality/release-readiness.md) |
| Ready with waivers | 候选没有当前范围内的代码 blocker，但只有在 reviewer 接受列明风险后才可进入发布规划 | 不等于风险已解决，也不等于生产上线授权 | [release readiness](../quality/release-readiness.md) |
| production launch authorization | 对托管、域名、SPA fallback、回滚和监控均有决定后才形成的上线许可 | 当前 readiness 明确不提供该授权 | [open questions](../product/open-questions.md) |
| Editor E0 | Editor 的产品意图与架构设计阶段；产品范围、系统设计、接口、风险和 ADR 已于 2026-08-26 获批 | 上游阶段已关闭，当前由已批准 delivery plan 管理 E1–E6 | [scope](../product/scope.md) |
| Editor E0-D | 已完成的 Editor execution planning 门禁；四份专属 delivery 文档均为 `approved` | E1 已授权编码，但通过仍需自己的 canonical 与 owner evidence | [milestone plan](../delivery/editor/milestone-plan.md) |
| 逆向制曲 | 对已有歌曲反向记录音符、音色和效果出现时间的标注过程 | 产物是数据工程，不修改 PCM、混音或生成伴奏 | [problem brief](../product/problem-brief.md) |
| Editor playback lease | E1 已实现的 route-scoped runtime token；临时把当前 track ended 策略切为 repeat-one，只有当前 token 可恢复 queue-next | 防止旧 Editor cleanup 影响新 route，同时保持唯一 AudioEngine | [ADR-0006](../architecture/adrs/0006-editor-runtime-leases.md) |
| analysis consumer lease | E1 已实现并获批准的 Analyzer/Editor 活动意图 token；只有最新 consumer 可设置 feature、请求 tempo/cursor 或释放 | E2 已通过该 lease 请求唯一 Buffer 与 identity-bound tempo，在单 Coordinator/Worker 内丢弃 stale 结果 | [interface contracts](../architecture/interface-contracts.md) |
| `EditorProjectV1` | E1 已实现的单曲 JSON 工程 envelope，使用内容 hash、tempo map、有序 lane 和 point/range event | 工程不保存 File/PCM/cache，未知 schema 或歌曲不匹配时拒绝导入 | [project format](../architecture/editor/project-format-v1.md) |
| Editor draft | E1 已实现的独立 IndexedDB V1 唯一 `draft/latest`；内存先更新，quota/abort 不替换内存工程 | 与 Analyzer session V1 隔离，并实现同歌恢复与异歌覆盖确认 | [ADR-0007](../architecture/adrs/0007-editor-project-and-draft-boundary.md) |
| lane | Editor 中一个具名 point/range 判别轨道，承载全部展开的 inner class 及其事件 | 名称不是 JSON identity；稳定 ID 与有序数组由 `EditorProjectV1` 固定 | [project format](../architecture/editor/project-format-v1.md) |
| inner class | lane 内用户可见的细分类，例如音高或效果走向；新 lane 默认含 `default` | 点/范围唯一性与重叠规则以 lane 和 inner class 为作用域 | [scope](../product/scope.md) |
| point event | E3 已实现的音符/短音色单点标记；秒数以微秒规范化持久化，显示与新建位置按当前网格吸附 | 同 lane、inner class 和规范化时间不得重复；zoom/tempo 变化不改写既有秒数 | [E3 eval plan](../quality/editor/e3-eval-plan.md) |
| range event | 表示长音色或效果从严格较早起点持续到较晚终点的区间标记 | 同 lane、inner class 不得重叠；不同分类和内部点事件可并存 | [scope](../product/scope.md) |
| tempo map | 由有序时间边界划分的节拍/拍号区间；一个 beat 固定为 `60/BPM` 秒，numerator 决定小节拍数，denominator 表达 beat 音符单位 | 驱动 measure/beat 线、单拍模式和点/范围事件吸附 | [Editor interactions](../architecture/editor/interaction-contracts.md) |
| Editor timeline viewport | E2 已实现并保存于工程的 `startSeconds/endSeconds/zoom`；波形、网格、游标和 boundary 共用同一 CSS 时间映射 | 固定 1–64 zoom、指针锚点、pixel/25% pan 与 `<=1 CSS px` 对齐；播放 cursor 不持久化 | [system map](system-map.md) |
| tempo estimate | E2 Worker 在 retained mono PCM 上以正向频谱差 onset envelope 和归一化 autocorrelation 产生的 reliable/low-confidence 结果 | 只在单一 unset metered segment 且 identity/用户 revision 仍匹配时自动写入；不使用第三方 BPM 包 | [E2 eval plan](../quality/editor/e2-eval-plan.md) |
| adaptive grid | E3 已实现的 point 候选精度选择：按 12 CSS px 门槛在 1/16、1/8、1/4、1/2 和 1 beat 中取最细可靠单位 | 防止长歌曲缩小时产生视觉上无法精确命中的标记位置；只影响新操作，不重写既有秒数 | [E3 golden examples](../quality/editor/e3-golden-examples.md) |
| single-beat segment | `0 <= BPM < 20` 输入规范化后的 tempo segment；无内部 beat/measure 和可编辑 meter，整段是一个候选单元 | 区分“整段只有一拍”与普通小数 BPM，不把无意义 BPM 写入工程 | [project format](../architecture/editor/project-format-v1.md) |
| pointer-through overlay | 除 feature selector 与三个垂直手柄外不接收 pointer 的半透明分析层 | 让 overlay 与底层标记共享视觉坐标而不夺取 point/range 命中 | [ADR-0009](../architecture/adrs/0009-editor-overlay-renderer-boundary.md) |
| viewport-visible event DOM | 只为当前时间视口内可见 point/range 创建交互 DOM，全部空格与高密度网格由 Canvas 表达 | 允许 E6 验证 10,000 事件而不把容量门禁变成 schema 硬上限 | [Editor test strategy](../delivery/editor/test-strategy.md) |
| Editor canonical | 某个 E 里程碑在 clean HEAD 上执行的正式 eval run，绑定 commit、环境、日志和 summary hash | provisional 不能替代 canonical；owner 批准后才开放下一个 E 里程碑 | [Editor execution plan](../delivery/editor/execution-plan.md) |

## Approval Record

`project-owner` 于 2026-08-21 至 2026-08-26 依次批准 Analyzer M7–M11 与 Analyzer readiness，并批准 Editor 产品、架构、delivery 与 E1 evidence。2026-08-27，E2 实现与 22/22 clean canonical 已登记，owner 随后批准此次结果并开放 E3；E2 据此为 `Complete`。E3 point、inner class、adaptive grid 与 viewport-visible DOM 随后完成 26/26 clean canonical 并登记为 `in-review`，owner 批准前 E3 仍为 `In Progress`。
