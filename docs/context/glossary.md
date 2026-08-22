---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-23
upstream_docs:
  - "docs/context/index.md"
next_action: "M10 结构化术语已由 clean canonical 复核；等待 owner evidence 审批"
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

## Approval Record

`project-owner` 于 2026-08-21 批准 M7 canonical evidence 并开放 M8。本词汇表随后已按 M8 累计 16 项、项目 Flux 与四槽实现复核；owner 又批准 M8 canonical evidence 与界面稳定化结果，M8 据此为 `Complete`。2026-08-23，owner 批准 M9 canonical 与非首页导航栏模糊效果；M9 据此为 `Complete`。同日 owner 要求实施 M10 并选择 Complex Spectrum 完整 1024-bin 主图，M10 进入 `In Progress`。M10 clean canonical 已 36/36 通过并把本页 21 项、Bark bands、signed FFT bins 与 structured payload 术语锁入 `in-review` evidence；owner 审批前 M11 不开放。
