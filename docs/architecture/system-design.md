---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/product/open-questions.md"
next_action: "浏览器自动处理架构已批准；制定 execution plan、acceptance criteria、test strategy 与 milestone plan，先验证 FT 分离兼容性/质量/性能"
---

2026-10-05 DEC-072更新：P2当前接入目标为现有Editor的四轨分离工作区，暂不新增独立Processor页面。owner明确授权布局/设计/动效，接入可先于P1性能/人工质量收口；全链性能目标及未验证事实保持。当前接入边界和资源/缓存行为见[Editor分离契约](processing/editor-separation.md)。原文关于独立Processor入口对本次接入已由该决定替代，后续节拍/提案/V2仍为后续切片。

# System Design

2026-10-17 DEC-081 更新：当前 Project V3 的视频生成已替换为[离线确定性导出](../context/visualizer-offline-export.md)，按显式帧时间与解码 PCM 编码 WebM，复用单 renderer，暂停预览 RAF。下方 V0/V5、P2 录制与 pre-Gain/tap 描述保留历史架构语境，当前行为以该新契约及 [system map](../context/system-map.md) 为准。

> 2026-10-04 范围登记：第 1–20 节保留既有 Analyzer、Editor、Visualizer 技术基线；第 21 节的浏览器 FT 分离、TypeScript 节拍、只读提案与 Project V2 已获架构批准。新目标进入 execution planning，既有 canonical/readiness 不覆盖这些尚未实现、尚未验证的能力。

## 1. Decision Summary

AudioNotSurfYet 采用一个实时 `AudioEngine`、一个 MainLayout-owned `AudioSessionService`、一个可序列化 `audioSessionStore`、一个 `AnalysisCoordinator` 和一个全曲分析 Worker。Analyzer 通过类型化特征注册表稳定展示 21 张折叠卡，并用最多四项 FIFO 活动队列驱动共享时间视窗中的 Canvas 2D renderer；DOM 承担文本、交互和无障碍语义。M7–M12 的四 slot 模型保留为历史基线，M13 由 ADR-0012 固定全卡/FIFO，M14 由 ADR-0013 增加独立的全局 feature 顺序。

已批准的 Editor 扩展把 E0 产品意图接入同一运行时：Editor 使用 route-scoped playback/analysis lease、版本化本地 JSON、独立单草稿 IndexedDB、tempo 派生网格、点/范围事件和单特征半透明叠加层。它不创建第二个 AudioContext、播放时钟、Worker 或网络数据路径。

已批准的 Visualizer V0 架构在该历史基线上增加第三个 route consumer：使用 `pause-at-end` 播放 lease、0–4 项去重分析 lease、版本化单草稿工程、首版两个确定性场景和单一 WebGL renderer，并从既有 AudioEngine 的 pre-Gain 音频分支实时录制 WebM。V1–V6 已关闭；ADR-0021 允许 post-V6 在不改变这些公共接口和资源拓扑的前提下增加经过合同审批的内置场景。

## 2. Goals and Non-Goals

### Goals

- 保持一个实时 AudioContext 和一致的播放时钟。
- 让全曲 Meyda 计算、聚合和紧凑编码离开主线程。
- 让全部 21 张稳定卡可浏览，并让当前最多四张展开卡共享视窗、缩放、游标和点击跳转。
- 用稳定的类型契约支持 `src/data/analyzerData.ts` 全部 21 个特征。
- 在刷新后恢复最近一次队列、当前歌曲、FIFO 活动特征和可用缓存，同时正确处理文件权限。
- 让黄金正确性、100ms 游标偏差、主线程响应和资源清理可以自动验证。
- 让 Editor 在同一播放和分析事实源上完成单曲循环、tempo、点/范围标注、工程 round-trip 与草稿保护。
- 让波形、tempo 网格、事件和分析叠加层共享一个时间几何，目标误差不超过 1 CSS px。
- 让 Visualizer 以同一 AudioContext 时钟把最多四项分析特征和同歌 Editor 快照解析成可重复 seek 的单场景画面，并保存严格本地工程。
- 让支持能力满足预设时，以同一画布和原歌曲音量实时录制 720p/1080p、30/60fps WebM，而不复制播放引擎。
- 新增原子元素与组合预设先校验输入并批准具体 Content Contract，再在当前 Project V3、输入、组合 renderer 与测试边界内扩展，见[内容生成契约](visualizer/content-generation.md)。

### Non-Goals

- 不提供麦克风、远端音频、PCM 编辑、音频导出、账户或长期曲库；Editor 只导入导出数据工程。
- 不并行建设多个播放引擎，也不为旧状态模型增加长期兼容层。
- 不一次性计算或持久化全部 21 项特征。
- 不在 Analyzer 中新增 Three.js。
- 不实现按歌曲顺序、多选、两卡交换、实时位移动画、第三方拖动依赖或移动端产品支持。
- 不在本阶段决定发布平台、监控和回滚。
- 不在 E0 架构阶段实现 Editor、安装 BPM/文件格式依赖或创建 delivery/quality 证据。
- 不允许 Visualizer 导入可执行模板、用户脚本、运行时插件或任意 Shader，叠加多个场景、使用第五个唯一分析特征、创建第二个 AudioEngine/Worker，或静默降低录制分辨率与帧率。

## 3. Constraints and Inputs

- 音频：本地 MP3/WAV/FLAC，目标最长约 15 分钟。
- 浏览器：最新稳定版 Chrome/Edge 桌面端，HTTPS 或 localhost。
- 分析：frame 1024、hop 512、Hanning、MFCC 13、分析 PCM 的源采样率；首版只展示参数，不允许修改。
- 活动特征：0–4 个，feature ID 唯一。
- 展示帧率：Worker 输出最多 30Hz 的显示序列；精确游标值按需提取。
- 持久化：只保留最近一次会话、全部队列句柄、当前 Blob 和当前分析缓存。
- Visualizer：当前本地歌曲、单场景、固定 16:9、一个最新草稿；分析绑定去重后 0–4 项，Editor 直连数据在进入或显式重新载入时形成快照。

## 4. Target Components

| Component | Responsibility | Owns | Must not own |
| --- | --- | --- | --- |
| `AudioEngine` | 加载/解码当前音频，播放、暂停、seek、音量、快照和 generation 保护的 PCM 分块复制 | 唯一实时 AudioContext、当前 AudioBuffer、BufferSource、AnalyserNode、GainNode | File/Blob、对象 URL、UI 卡片、队列持久化、分析缓存 |
| `AudioSessionService` | 把 UI 命令编排为文件读取、engine 命令、队列变化、ended 循环和能量快照 | runtime File、封面对象 URL、command generation、单播放 RAF | 可持久化事实、第二个 AudioContext、分析 Worker |
| `audioSessionStore` | 队列、当前 track ID、播放快照、活动特征 FIFO、视窗和恢复状态 | 可序列化 UI/session 状态 | AudioBuffer、AudioNode、Worker、File/Blob 实例 |
| `SessionRepository` | IndexedDB schema、事务、句柄、当前 Blob/缓存的保存与恢复 | `PersistedSessionV1`、FileSystemFileHandle、当前 Blob、当前缓存 | 播放和 UI 决策 |
| `AnalysisCoordinator` | 构造 mono PCM、启动/取消 job、隔离迟到结果、缓存匹配、精确值请求 | 活动 job generation、Worker 生命周期、内存结果索引 | 实时播放时钟、DOM |
| `analysis.worker` | Meyda frame 提取、聚合、量化、进度和协作式取消 | 当前 Worker job 的 PCM 和临时帧 | IndexedDB、AudioContext、UI |
| `FeatureRegistry` | 21 个特征的 key、形状、renderer、范围、标签和依赖 | 编译期穷尽映射 | 运行时图表实例 |
| Analyzer UI | 21 卡展开/收起、共享时间轴、说明、精确值和可访问交互 | `activeFeatureQueue`、`TimelineViewport` 的用户意图 | 音频计算、数据库访问 |
| Canvas renderer family | 把已归一化/解码的 series 绘到给定 viewport | Canvas 2D 绘制状态 | 焦点、按钮、说明文本 |
| `EditorSessionController` | 解析 Editor 路由目标、获取/释放播放与分析 lease、管理内存工程、autosave 和离页/异歌保护 | 当前 Editor route generation、内存 `EditorProjectV1`、pending interaction/save 状态 | AudioContext、Worker、IndexedDB 连接、Analyzer workspace |
| `EditorFormatCodecRegistry` | 注册工程格式、执行 encode/decode 和严格 validator | 首版 JSON codec 与 schema version 路由 | 文件选择 UI、草稿、音频内容 |
| `EditorDraftRepository` | 保存唯一 Editor 草稿与普通离页提示偏好 | 独立 `audionotsurfyet-editor` IndexedDB V1 | session 队列、当前 Blob/cache、运行时工程决策 |
| `EditorTimelineModel` | 维护 viewport、tempo segment、网格生成、秒数吸附、点/范围不变量和交互状态机 | 纯数据变换与规范化时间 | DOM、Canvas context、播放时钟 |
| Editor renderer adapter | 复用 FeatureRegistry/renderer family 的纯绘制能力，并与标记区共享几何 | Editor Canvas 图层、viewport-local 绘制状态 | 分析 Worker、焦点、底层 pointer 事件 |

`AudioEngine` 独占唯一实时 `AudioContext` 与 `AudioBuffer`。M6 不创建 OfflineAudioContext；coordinator 只通过 descriptor + revision 接口按 16,384 samples 分块复制各声道并平均，每块后让出主线程。若未来格式 fixture 证明必须使用指定源采样率的离线解码，需先复核本设计与缓存身份，不能把它当作隐式 fallback。

## 5. Runtime Topology

```mermaid
flowchart LR
    UI["Analyzer / MusicBar UI"] --> Store["audioSessionStore"]
    UI --> Session["AudioSessionService"]
    Editor["EditorSessionController"] -->|"playback lease"| Session
    Editor -->|"analysis consumer lease"| Coordinator
    Editor --> Geometry["EditorTimelineModel / shared geometry"]
    Editor --> Codec["EditorFormatCodecRegistry / JSON V1"]
    Editor <--> Draft["EditorDraftRepository / separate IndexedDB"]
    Session --> Engine["AudioEngine"]
    Session --> Store
    Store <--> Repo["SessionRepository / IndexedDB"]
    Engine -->|"PlaybackSnapshot + clock"| Store
    Engine -->|"PCM copy + sample rate"| Coordinator["AnalysisCoordinator"]
    Coordinator <--> Worker["analysis.worker"]
    Registry["FeatureRegistry"] --> UI
    Registry --> Coordinator
    Worker -->|"compact AnalysisSeries"| Coordinator
    Coordinator --> Store
    Store --> UI
    UI -->|"seek(time)"| Session
```

状态流是单向的：AudioEngine 发布事实快照，AudioSessionService 编排 runtime 资源并更新 store，store 保存序列化状态，UI 只发出命令。store 不包装或代理 AudioNode。

Editor 不改变该拓扑。`EditorSessionController` 通过 tokenized lease 使用 Session/Coordinator，通过独立 repository 保存工程草稿；Analyzer 与 Editor 不能同时成为当前 analysis consumer。详细决定见 [ADR-0006](adrs/0006-editor-runtime-leases.md)。

## 6. Playback and Timeline

### Engine lifecycle

1. 选择或恢复当前 track 后，`AudioEngine.load()` 解码并保存当前 AudioBuffer。
2. `play()` 每次创建新的 BufferSource，并记录 `startedAtContextTime` 与 `startedAtOffset`.
3. 播放位置为 `startedAtOffset + (audioContext.currentTime - startedAtContextTime)`；暂停时保存 offset。
4. `seek(seconds)` 截断到 `[0, duration]`；播放中安全停止旧 source 并从新 offset 重建。
5. 换歌、清空或销毁时停止 source、断开节点并使旧订阅失效；封面对象 URL 由 AudioSessionService 在删除、清空和 dispose 时释放。

### Shared timeline

- `TimelineViewport` 是四张卡的唯一时间视窗来源。
- 动画循环只读取 AudioEngine 的基准时间并更新共享游标，不自行累计 delta。
- 播放、暂停、跳转和 track 切换都通过 `PlaybackSnapshot` 收敛。
- 图表点击先把 Canvas x 坐标映射到 viewport 时间，再调用 `AudioEngine.seek(time)`。
- 缩放以指针/键盘锚点为中心，并裁剪到 `[0, duration]`；所有 renderer 接收同一 viewport。

### Editor playback lease

- `/editor/:trackId?` 是目标路由。侧边栏使用当前 track；没有当前 track 时进入 `/editor` 空状态并保留 MusicBar。播放列表“去编辑”先显式播放所选 track，再进入带 ID 路由。
- 路由中的 track ID 只用于定位当前 session 记录；工程身份始终使用内容 SHA-256。未知、不可恢复或无内容 hash 的路由目标进入明确不可用状态，不静默切到其他歌曲。
- `AudioSessionService.acquireEditorPlayback(trackId)` 返回带唯一 token 的 lease。lease 激活时，当前 track 自然 ended 由 service 对同一已解码 buffer 调用 `play()`，不执行 `next()` 或重新解码。
- 只有当前 token 的 `release()` 可以恢复普通 queue-next 策略。旧组件、旧路由或迟到清理不得覆盖新 lease。
- 侧边栏进入当前歌曲时保留当时播放/暂停状态；播放列表入口由用户手势显式播放目标；刷新或直接打开依照现有 session 恢复规则保持 0 秒 paused，但 repeat-one 策略已准备好。
- Editor 所有状态均保留 MusicBar，由共享 service 提供歌曲信息和播放控制。有效 track 的 lease 仍强制 repeat-one；框架与换歌保护以[当前 Editor 契约](../context/editor-workspace.md)为准。

## 7. Analysis Pipeline

### Job construction

1. 当前音频解码完成后，读取 `DecodedAudioDescriptor`，并以 descriptor revision 分块复制各声道。
2. 多声道按每个 sample 的算术平均值混合为 mono；每块后让出主线程，任一 revision 变化立即返回 stale，结果不修改或暴露 AudioEngine 的 AudioBuffer。
3. 计算内容 `trackHash`，并以固定参数生成 `configHash`。
4. `AnalysisCoordinator` 创建递增 generation 的 job，把 mono `ArrayBuffer` 转移给 Worker。
5. Worker 只提取当前活动且不重复的 feature ID。

### Frame extraction and compact output

- frame count 固定为 `max(1, 1 + ceil((length - 1024) / 512))`；frame 起点为 `index * 512 / sampleRate`，末尾不足 1024 时零填充。
- Worker 每处理最多 32 frames 或连续运行 8ms 后报告进度、让出事件循环并检查 cancel 标记。
- 标量特征聚合为最多 30Hz 的时间序列。
- 频率/类别向量先按显示时间桶聚合，再使用带 scale/offset 的紧凑 typed array；不得把 15 分钟的逐 hop 原始频谱保存在 UI 或 IndexedDB。
- 游标精确值由 Worker 针对游标所在原始 frame 按需重新提取，并返回未量化结果。
- 每个 `AnalysisSeries` 都带 `trackHash`、`configHash` 和 `featureId`；缺一不得写入缓存或展示。

### Cancellation and stale-result isolation

- 换歌、活动特征变化、分析参数变化或 coordinator 销毁时，发送 cancel 并递增 generation。
- Worker 取消是资源优化，不作为正确性边界；主线程只接受与当前 `jobId + generation + trackHash + configHash` 全部匹配的消息。
- 迟到的 progress/result/error 被静默丢弃并记录可诊断计数，不能覆盖新 track 的 UI。

### Editor analysis lease and tempo estimation

- `AnalysisCoordinator.acquireConsumer('analyzer' | 'editor')` 返回 generation-bound consumer lease。只有当前 lease 可以设置 active features、请求精确值/tempo 和释放当前意图；路由切换使旧 lease 全部 stale。
- Editor 固定请求 `buffer`，并添加至多一个 overlay feature；选择 Buffer 时去重，因此活动集合始终为 1–2 个唯一 `FeatureId`。Analyzer 的持久化卡片不被改写。
- Editor 分析可能原子替换当前 0–2 项 cache；返回 Analyzer 后以其 workspace 卡片重新激活并按 partial hit/miss 恢复。该取舍只影响重算成本，不允许混用错误身份。
- Buffer 分析即使全 cache hit 也沿用现有 0-feature retained-PCM job。tempo 请求在同一 Worker、同一 retained mono PCM 上运行 onset envelope + autocorrelation，不复制第二份全曲 PCM，也不创建第二个 Worker。
- tempo response 是 `reliable` 或 `low-confidence` 判别联合，包含 track/config/generation/request 身份。只有 reliable 且落在 20–300 BPM 的结果可写入未被用户编辑的唯一 metered segment；低置信度保持 `bpm: null`。
- 数值置信度阈值是 E2 golden 校准的集中配置，不进入 JSON schema；算法/阈值变化使 E2 golden 与架构风险待复核。协议见 [interface contracts](interface-contracts.md)。

## 8. Feature Registry and Renderers

注册表把 21 项 Meyda key 绑定到输出形状和 renderer：

| Family | Features | Renderer |
| --- | --- | --- |
| Scalar time series | RMS、ZCR、Energy、Spectral Centroid/Flatness/Flux/Slope/Rolloff/Spread/Skewness/Kurtosis/Crest、Perceptual Spread、Perceptual Sharpness | 折线/面积时间序列与游标值 |
| Frequency vector | Amplitude Spectrum、Power Spectrum | 时频热图、0–Nyquist 轴与游标频谱 |
| Category vector | Chroma、MFCC | 类别/系数热图与游标柱图；MFCC 使用 C0–C12 signed 系数轴 |
| Waveform | Buffer | 波形包络与游标 frame |
| Loudness structure | Loudness | total 时间线、24 Bark band 热图与游标结构 |
| Complex spectrum | Complex Spectrum | 幅度/相位派生视图与游标实部/虚部详情 |

Meyda 5.6.3 的固定维度是：Amplitude/Power Spectrum 512、Chroma 12、MFCC 13、Buffer 1024、Loudness 24 specific bands + total、Complex Spectrum 的 real/imag 各 1024。注册表另记录 `deliveryMilestone` 与 `workerSupported`；M6 只支持 RMS、Energy、Amplitude Spectrum、Chroma，21/21 登记不表示 21 项产品能力完成。

M9 不改变 AnalysisConfig、IndexedDB V1 或缓存二进制 schema。Power Spectrum 与 Amplitude Spectrum 在同一 Meyda batch 中提取并由 golden 固定平方关系；MFCC 以 `category-u16` 保留 signed scale/offset；Buffer 全曲显示只保存 `waveform-envelope`，exact cursor 返回当前 1024-sample Meyda buffer 并显示尾帧补 0 数量。

M10 同样不改变 AnalysisConfig、IndexedDB V1 或缓存二进制 schema。Loudness 的全曲 payload 以 Float32 保存 total、以 U16 保存 24 个 specific Bark bands；exact cursor 返回未量化 `{ total, specific }`。Complex Spectrum 的全曲 payload 保存平均 magnitude 与圆周平均 phase，exact cursor 返回未量化 real/imag 各 1024；主图和精确值表按 DEC-020 完整展示 1024 bins，bin 0–512 为非负频率、513–1023 为负频率镜像。零能量帧的两类结构统一返回零；非静音非有限值显式 `extract-failed`。

`spectralFlux` 在锁定版本上已复现依赖内部未声明变量 `x` 的 `ReferenceError`。M6 不 fork、monkey-patch 或启用该特征；M8 按 [ADR-0005](adrs/0005-project-spectral-flux-and-silence-semantics.md) 使用项目内相邻幅度频谱正向 L1 差。M8 golden/cursor/canonical 已通过并缓解产品阻断；Meyda 缺陷仍作为依赖事实保留，不得声称上游已修复。

M8 标量以同一 Hanning frame 的 energy 判断零能量：零能量时全部 M8 标量为 0；非零能量时任何非有限值均显式失败。该规则不改变 scalar payload 或缓存 schema。

特征依赖（如 amplitude/power spectrum、loudness）在 Worker 内复用同一 frame 的中间值。注册表必须使用 feature ID 的穷尽联合类型；`analyzerData.ts` 新增或移除 key 时，类型检查或覆盖测试必须失败。

首个切片：

- RMS：时间序列折线和精确标量。
- Amplitude Spectrum：时频热图和游标频谱。
- Chroma：12 类热图和游标柱图。

Canvas 只画数据、网格、游标和选择态；标题、解释、参数、数值、按钮、状态与可访问替代信息由 DOM 提供。App shell 使用统一 layer contract：Analyzer 顶部常驻区位于页面安全留白之后，MusicBar 与直属弹层高于导航/Analyzer；共享侧边栏占位和窄屏留位见 [应用外壳契约](../context/app-shell.md)；pressed 只表示瞬时按压，精确值表格使用可见的主题滚动条。

### Analyzer 当前单列与置顶模型

DEC-077 替代 M12 masonry 和 M14 手动排序交互，完整行为见 [Analyzer 列表契约](../context/analyzer-list.md)。旧 ADR 与 canonical 保留历史语境。

- 原列表固定默认顺序，FIFO倒序显示于顶部常驻区；第五项淘汰最早项并归位，描述独立折叠且原文不改写。
- 两区独立滚动；高度下限40%、自然内容/工作区满高封顶，短内容优先；初始60%，当前页面记住用户比例，支持指针/触控/键盘手柄。
- 页面持有队列、阅读锚点、说明状态与区间；行负责装配，说明测量、Canvas生命周期和精确值DOM分开。未转移的活动行/表格不重建。
- 图表内滚轮按鼠标时间锚点同步所有start/end/zoom，保存按RAF合并；Coordinator、lease、cache、generation与串行持久化revision guard保持所有权。
- 展开才挂载Canvas，收起或离页清理资源；V1 activeCards carrier和featureOrder字段保留，Analyzer初始化将旧顺序规范为FEATURE_IDS。

## 9. Persistence and Recovery

### Storage model

IndexedDB 使用版本化 schema，分别保存：

- 单个 `PersistedSessionV1`：队列顺序、当前 track、卡片、参数和 UI 快照。
- 队列中每个 track 的 `FileSystemFileHandle`（可用时）。
- 仅当前 track 的 Blob。
- 仅当前 track、当前配置和活动特征的分析缓存。

每项 cache payload 使用 4-byte little-endian header length、UTF-8 JSON header 和连续 typed-array bytes。decoder 必须核对 schema、track/config/feature 身份、payload kind、dimensions、scale/offset 与 byte ranges；错位、缺失、尾随或损坏项只作为 miss 重算。

M14 不升级数据库 version：`PersistedSessionV1.featureOrder?` 缺失时映射为默认 `FEATURE_IDS`，存在时必须恰好是完整 permutation；新保存始终写入。无效顺序使 session validator 明确失败，不对损坏字段做猜测修复。

切换当前歌曲时，UI current ID 与 persistence `saving` 必须同步发布，避免用户在新 Blob 尚未 durable 时刷新；持久化操作在同一逻辑事务中删除旧 current Blob/cache 并写入新记录，只有当前 command generation 可以把状态推进为 `ready`/`not-persisted`。失败时保留内存会话并暴露 `not-persisted` 状态。

分析结果使用独立 `replaceCurrentAnalysisCache()` 事务：写入前核对 persisted current track/hash，在同一事务更新 session manifest 与固定 current cache，保持 current Blob 不变。身份变化返回 `stale`；quota/abort 保留旧记录，内存 series 继续可用。

### Editor project and draft storage

- `EditorProjectV1` 使用 `format: 'audiosurf-editor'` 与 `schemaVersion: 1`，保存内容 hash、tempo map、point/range lane 和工作区；编码文件建议为 `<歌曲名>.audiosurf-editor.json`。
- `EditorFormatCodecRegistry` 首版只注册 JSON。decode 必须完成 schema、歌曲 identity 与所有跨引用/时间不变量验证后，才能以一次内存替换应用；失败时保留原工程和草稿。
- Editor 使用独立 `audionotsurfyet-editor` IndexedDB V1：`draft/latest` 保存唯一草稿，`preferences/leave-warning` 保存普通离页提示偏好。不升级或写入 `audionotsurfyet-session` V1。
- 内存工程先于存储更新。autosave 使用单写入队列与短 debounce；pointerup、表单确认、导入成功和 route leave 触发立即 flush。`beforeunload` 只在仍有未完成写入时启用，不依赖其中的异步 IndexedDB。
- 同内容 hash 自动恢复；不同歌曲必须先选择导出旧工程、确认覆盖或取消。普通离页提示可永久关闭，跨歌曲覆盖确认不可关闭。
- 完整 schema、canonical seconds、codec 与事务语义见 [Editor Project Format V1](editor/project-format-v1.md) 和 [ADR-0007](adrs/0007-editor-project-and-draft-boundary.md)。

### File selection

- 在支持的安全上下文用 `showOpenFilePicker({ multiple: true, types })` 获取文件和句柄。
- 用户取消不作为错误；不默默回退到无法得到句柄的隐藏兼容路径。
- format/decode 不支持时保留可解释错误，不把无效 track 作为可播放项。

### Refresh recovery

1. 读取 session、当前 Blob、当前缓存和句柄。
2. 恢复队列、当前歌曲、活动卡和 viewport 配置。
3. 当前歌曲优先从已保存 Blob 加载；播放位置强制为 0 且 paused。
4. 缓存身份完全匹配时使用；缺失、损坏或不匹配时重新分析。
5. 对其他 track 按“下一首、上一首、下二首、上二首……”顺序执行 `queryPermission({mode: "read"})`。
6. `granted` 自动调用 `getFile()`；`prompt`/`denied` 标记为 `permission-required`，只有用户点击“恢复访问”时调用 `requestPermission()`。
7. 文件不存在、移动或内容 hash 改变时标记对应恢复状态；不得错误复用旧缓存。

权限不保证跨会话持续。实现必须遵循 [Chrome File System Access 文档](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) 和 [持久权限说明](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api) 所描述的用户手势约束。

## 10. Failure Boundaries

| Failure | Boundary and behavior | Verification |
| --- | --- | --- |
| 音频 decode 失败 | 当前 track 标记错误；队列和其他 track 仍可用 | 格式 fixture 与损坏文件 |
| Worker error/crash | 当前 analysis 标记失败，可重试；播放不停止 | Worker error 注入 |
| stale result | coordinator 丢弃，不改变当前 series | 快速换歌/换卡 |
| quota/cache 保存失败 | 当前页面继续；显示无法跨刷新保留，刷新后重算 | IndexedDB quota 注入 |
| permission prompt/denied | 不自动弹出权限；标记并等待用户手势 | 浏览器权限矩阵 |
| 句柄失效/文件移动 | 对应 track 不可恢复，当前 Blob track 仍可用 | mock handle 与手工验证 |
| hash/config 不匹配 | 缓存失效并重算 | cache identity 单元测试 |
| AudioContext suspended | 首次用户手势恢复；UI 反映 paused/suspended | 引擎集成测试 |
| renderer 异常 | 单卡错误边界；其他卡和播放继续 | renderer failure 注入 |
| Editor route target 无效或稍后恢复 | 无效时保留 MusicBar 且不创建工程；同一 target 恢复后合并重试并保持 paused；另一首当前歌曲只提供显式 `router.replace` 入口 | 直接路由、恢复/重选、错误 hash、快速 route 场景 |
| 旧 playback/analysis lease 迟到释放 | token/generation 丢弃；当前 route 策略与结果不变 | 快速 Editor/Analyzer/Home 与换歌循环 |
| JSON/schema/hash/事件不合法 | decode 拒绝且当前内存工程/草稿不变 | codec/validator success、failure、boundary golden |
| Editor draft quota/abort | 当前内存编辑继续，显示 `not-persisted`；旧 durable 草稿保持 | 独立 IndexedDB fault injection |
| BPM 低置信度或失败 | BPM 保持空，允许手动输入；波形、播放和标注继续 | silence、歧义节奏、Worker error |
| overlay renderer/analysis 失败 | 仅 overlay 可重试/隐藏；标记、播放、工程和导出继续 | feature/Canvas failure injection |
| timeline pointercancel/blur/离页 | 清除 pending range、drag、capture 和 menu，不创建半成品事件 | Chrome/Edge pointer/keyboard 路由矩阵 |

## 11. Security and Privacy

- 不把 File、Blob、PCM、元数据或分析结果发送到网络。
- 文件路径不进入 UI、日志或 telemetry；只显示用户可见文件名和解析元数据。
- IndexedDB 数据只服务最近一次本地会话，并提供清除会话入口。
- FileSystemFileHandle 的保存不代表永久授权；任何权限请求必须由明确用户操作触发。
- 内容 hash 用于本地身份与缓存，不作为用户身份，也不上传。
- Editor JSON、草稿、事件和 tempo 同样只在本地处理；工程文件由用户显式选择导入或导出。
- 工程只保存可见歌曲元数据和内容 hash，不保存绝对本地路径、FileSystemFileHandle、Blob、PCM 或分析 cache。

## 12. Performance and Capacity

- Worker 承担 Meyda、聚合、量化和 hash 的重计算路径。
- 主线程只接收紧凑 series、进度和精确游标值。
- 同一 frame 的频谱依赖在 Worker 内共享，避免对四个特征重复 FFT。
- Canvas 按 device pixel ratio 设置 backing store，重绘只发生在 viewport、数据、尺寸或游标变化时。
- 游标层可与静态数据层分离，避免每帧重画整张热图。
- 大输入期间用户反馈必须在 100ms 内，且无分析归因的主线程任务超过 50ms。
- 不设置全曲分析完成时间 SLA；UI 必须提供进度、取消和明确的 pending/ready/error 状态。
- Editor 只为当前 viewport 实例化可聚焦事件/端点 DOM；空网格、beat/measure 线、波形和 overlay 使用 Canvas，全部 inner class 展开不等于全部时间 cell 进入 DOM。
- point/range 创建、拖动和右键状态必须在 100ms 内产生可见反馈；Editor/分析归因的单个主线程任务不得超过 50ms。

## 13. Observability

开发和测试环境记录结构化但不含文件内容的事件：

- engine load/play/pause/seek/dispose 与快照；
- analysis job start/progress/cancel/complete/error、generation 和耗时；
- stale message 丢弃计数；
- cache hit/miss/identity mismatch；
- restore granted/prompt/denied/missing/quota；
- Canvas 尺寸、活动 renderer 和长任务观测。

M6 只在 `import.meta.env.DEV` 安装无 UI bridge，提供活动特征、cancel、retry、可序列化状态和精确游标读取；它不暴露 File、PCM 或 AudioBuffer，生产构建中不存在。

生产日志策略属于 release 阶段；当前不得为可观测性引入上传。

## 14. Rollout and Compatibility

- 按 delivery 纵向切片接入，先保持 MusicBar 播放行为，再启用持久化/Worker，最后交付分析卡。
- Editor 按 E1–E6 接入：先路由/lease/JSON/草稿，再时间轴/tempo、point、overlay、range，最后双浏览器与资源加固。system design 已获批并开放 Editor delivery planning；delivery 获批前不得编码。
- 新状态模型直接替代当前分散职责；不保留两套长期 AudioEngine 或隐藏 legacy fallback。
- 数据库使用 schema version；开发期间允许显式迁移或清除，但 release 前必须固定升级/失败行为。
- 自动化以本机 Chrome 为主；真实 Edge 验证缺失时保留为阻断最终双浏览器声明的证据缺口。

## 15. Alternatives Considered

| Alternative | Decision | Reason |
| --- | --- | --- |
| 保留 MusicBar 内部播放/分析并让 Analyzer 另建上下文 | Reject | 两套时钟和资源所有权会造成漂移、重复解码和难以清理 |
| 在主线程逐帧计算全部特征 | Reject | 不能满足响应与长任务 guardrail |
| 一次预计算全部 21 项 | Reject | 内存、耗时和缓存体积与当前四卡需求不成比例 |
| 只保存文件句柄 | Reject | 权限跨会话不可靠，当前歌曲无法保证无提示恢复 |
| 保存队列全部 Blob 和缓存 | Reject | 15 分钟多文件会放大 quota 与清理风险 |
| 所有图表使用 DOM/SVG | Reject | 高频热图和多卡重绘成本高 |
| Analyzer 使用 Three.js | Reject | 对 2D 数据图没有必要，会增加 bundle、无障碍和资源生命周期负担 |
| 用 `@chenglou/pretext` 估算 Analyzer 卡片高度 | Reject | 它只测文本，无法覆盖 Canvas、错误态和展开精确值表；错误估算会产生重叠或错误列高 |
| 保留 CSS Grid 行布局 | Reject | 同一行会被最高卡片撑高，无法实现已批准的实时最短列效果 |
| Editor 创建独立 AudioEngine 或隐藏 audio element | Reject | 会产生第二套时钟、解码、音量和资源生命周期 |
| Editor 创建独立 analysis Worker/coordinator | Reject | 会复制 PCM、争用 cache 并破坏单 Worker 门禁；route-scoped consumer lease 足以隔离意图 |
| 把 Editor 草稿加入 session IndexedDB V1 | Reject | 会扩大已验证 Analyzer schema 和事务爆炸半径；独立 V1 可独立清除和演进 |
| 以 beat/bar 作为事件持久化事实 | Reject | tempo 修改会移动音频中的真实标注位置；秒数必须保持事实，节拍只用于派生网格和交互吸附 |
| 复用整张 `MeydaCard` DOM 作为 overlay | Reject | 卡片布局、焦点与 pointer 事件不能满足半透明穿透；只复用纯 renderer/data contracts |
| 为每个空网格 cell 创建 DOM | Reject | 15 分钟、多 lane 和 1/16 beat 会造成不可控节点量；Canvas 背景加 viewport-visible DOM 事件更符合容量边界 |

## 16. Approval Record

`project-owner` 于 2026-07-24 明确要求实现 Analyzer 架构，因此原有单引擎、Worker、持久化和 renderer 基线已经批准，并由 M3–M11 与 Analyzer-only readiness 收口。

2026-08-26，`project-owner` 批准 Editor E0 产品意图并同意进入架构设计。随后明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”Editor runtime、project、timeline、range、overlay、R-022–R-027 与 ADR-0006–0009 据此获批并开放 delivery planning。该批准不撤销 Analyzer 历史证据，也不构成 E1–E6 实现、质量证据或 Editor readiness 通过。

2026-08-28，`project-owner` 接受 Analyzer M12 瀑布流与顶部精简方案并明确要求实施。该批准只改变 Analyzer DOM 布局和响应式几何，不改变产品范围、音频/分析接口、持久化 schema 或 Editor E6 门禁；M12 新候选仍需双浏览器证据后才能恢复 Analyzer readiness。

同日，M12 clean canonical 12/12 通过后，owner 的“自行提交并完成后续”授权用于批准设计实现证据、缓解 R-028 并恢复 Analyzer readiness。该批准不覆盖 PROD-015 或 Editor E6 人工补偿。

2026-08-28，owner 先批准 E6 canonical 与人工补偿结果，再批准以 E7 修改 Editor 页面密度。E6 历史证据保持不变；ADR-0010 与第 18 节只开放紧凑工作台实现，不提前形成 Editor readiness 或生产上线授权。

2026-08-31，owner 先批准并关闭 E7 修订候选，随后以“PLEASE IMPLEMENT THIS PLAN”批准 ADR-0012、M13 系统设计及 delivery/eval 门禁。本设计据此保持 `approved`；M13 源码和 readiness 仍须由专项与 clean canonical 证据验证。

2026-09-01，owner 以完整 M14 实施指令批准 ADR-0013、自定义 DOM 顺序、全局 V1 可选字段、pointer/点击/键盘/读屏契约和不改变 FIFO/Worker 的隔离边界；系统设计继续为 `approved`，M14 readiness 在 canonical 前保持 `in-review`。

同日，M14 implementation commit `0e991307d9045a1ec84ddaae0515612240894a92` 与 clean canonical 19/19 验证上述设计；R-031–R-033 已缓解，Analyzer readiness 恢复为 `Ready with waivers`。

2026-09-03，owner 以 E8 完整实施指令批准 ADR-0018 及本设计中的时间轴、不可用恢复与 point marker 修正，并开放 E8。implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 的 25/25 clean canonical 通过；JSON/IndexedDB/runtime ownership 未改变。owner 随后批准 evidence 与人工门禁，E8 改为 `Complete`，R-022/R-024/R-025 改为 `Mitigated`。

## 17. Editor Timeline and Interaction Architecture

- `EditorTimelineModel` 以规范化秒数为持久化事实；tempo 只派生 measure/beat/grid。tempo、zoom 或 viewport 变化不得自动移动已保存事件。
- `timeToX()`/`xToTime()` 是波形、tempo、point/range 和 overlay 的唯一横向映射；所有 Canvas 使用同一 CSS rect 与 DPR backing-store 规则，目标误差不超过 1 CSS px。
- tempo segment 从 0 秒开始且按 start 排序；metered 支持空 BPM 或 20–300，single-beat 把整个 segment 视为一个单元。新边界继承前段设置；ADR-0019 允许删除内部边界，删除后前一 segment 向右延伸，首边界固定且不可删除。
- 自适应网格从 `1/16`、`1/8`、`1/4`、`1/2`、`1 beat` 中选择当前至少 12 CSS px 的最细单元；没有候选时使用 1 beat。该网格只约束创建/拖动时的吸附和最短 range，不进入 schema identity。
- Canvas 绘制波形、tempo 网格和高密度背景；DOM 只渲染当前 viewport 可见事件、端点、表单与焦点语义。交互状态、右键优先级和键盘替代见 [Editor Interaction Contracts](editor/interaction-contracts.md) 与 [ADR-0008](adrs/0008-editor-time-and-event-model.md)。
- overlay 由纯 renderer adapter 绘制；Canvas/说明/空白 `pointer-events: none`，只有 feature selector 与 top/move/bottom 三个手柄接收输入。三个手柄都有键盘等价操作，位置以 `topRatio + heightRatio <= 1` 持久化。详见 [ADR-0009](adrs/0009-editor-overlay-renderer-boundary.md)。

### Editor E9 tempo lane revision

- 波形 stage 不再承载 tempo boundary DOM；波形时间列由 88/72px stage 与紧贴其下的 28px BPM 标记条组成，共享同一 `EditorTimelineGeometry`、viewport 与窄屏外层水平滚动容器，禁止私有 scroll/zoom。
- 标记条不创建第二组三列 rail 或独立模块。真实 boundary 的 caret 位于波形底边，1px 辅助线只向上伸入波形 12px，时间紧贴显示在 caret 下；相邻 boundary 之间承载 11px、18px 高的无框 BPM/拍号控件。
- 区间按当前可用 CSS 宽度和同页自然宽度测量选择完整编辑、单行摘要或隐藏，不允许换行挤压。完整、摘要与 boundary 时间使用同一紧凑基线；来源只保留在 accessible name/title。
- 右键内部 boundary 或在其获得焦点时按 Delete/Backspace，调用纯 `removeTempoBoundary()`。首 boundary 和歌曲结束边界不可删除；未知 ID 幂等无操作。删除只移除目标 segment，前一 segment 设置自然延伸，不改写 point/range 秒数。
- 本修订不增加持久化字段、运行时资源或公共 transport/analysis 接口。现有 JSON V1 项目直接使用新视图，导入导出 bytes 语义保持不变。
- 失败边界为：标记条与波形有间隙、辅助线向下贯穿或向上长度不是 12px、标记条不等于 28px、波形与 BPM X 误差超过 1 CSS px、区间控件换行、删除错误 segment、删除首 boundary、删除导致事件秒数变化、窄屏出现双水平滚动或临时交互状态未清理。
- DEC-052 实现 commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 与 29/29 clean revised canonical 已验证上述边界；`project-owner` 于 2026-09-04 批准适用视觉与交互门禁，E9 已关闭并开放独立 Editor readiness 评审。

### Editor E10 marker block editing

- `EditorPointWorkspace` 是批量模式、选择、drag preview、快捷键和 live status 的唯一 owner；嵌套 range workspace 只接收受控状态并回传标准化 pointer intent。模式与选择不持久化，歌曲、route、tempo map、lane/class identity 变化或模式关闭时清理。
- 纯 `markerBlockOperations` 以 `{ laneId, innerClassId, startSeconds, endSeconds }` 选择为输入。point 使用半开包含，range 要求完全包含；复制新 ID，移动保留 ID和相对秒数。所有候选先完整校验，成功后一次性返回新 project，失败抛 typed error且不产生局部 project。
- 小节选择由 tempo map 派生；single-beat segment 是一个单元，空 BPM metered segment 不可选。移动目标通过既有自适应 subdivision 吸附，drag 期间不调用 controller update。
- 站内 route guard 以原生 modal dialog 等待单一 Promise；Stay/Escape/close/backdrop 都解析为 false，确认后才可写入 leave-warning preference 并调用既有 `leave()`。`beforeunload` 不经过该 dialog。
- 本设计不改变 JSON V1、IndexedDB、AudioEngine、Worker、Overlay 或 router public contract。DEC-054 的 E9 runtime candidate 因 `src/` 漂移只保留为 `pre-E10`，历史 audit artifact 不改写。

## 18. Editor Compact Workbench

- [ADR-0010](adrs/0010-editor-compact-workbench.md) 将 Editor 大区域统一为平面背景与 1px 低对比分隔线；圆角只保留给控件、事件标记、菜单和对话框。FL Studio 图片只用于说明密度与分区方向，不构成品牌、配色或具体控件复制要求。
- ready 状态顶部由两行工具栏承载工程/歌曲/草稿及播放/格式/导入导出，两行总高度不超过 84px，桌面控件高度 30px；页面采用应用外壳顶部留位并移除 Editor 1440px 最大宽度。
- Editor 令牌固定为 point/range 行高 44px、lane 名称列 152px、inner class 列 144px、主区域圆角 0、控件圆角 4px、临时菜单/对话框圆角最多 8px。
- E7 原始波形高度 176/144px 由 [ADR-0018](adrs/0018-editor-timeline-recovery-and-marker-alignment.md) 局部替代：桌面固定 88px，小于 900px 固定 72px；波形以轨道中心绘制，上下各保留 6px。窄屏仍只允许一个显式横向时间轴滚动区，不能通过压缩时间列破坏点击精度。
- 本变化只改变 DOM 布局与视觉令牌。歌曲、工程、viewport、tempo、point/range、overlay、JSON V1、IndexedDB、playback/analysis lease 与共享 `timeToX/xToTime` 均沿用现有契约。
- 失败边界为：任何密度优化不得遮挡输入/事件、扩大时间映射误差、破坏 pointer-through、减少键盘语义或改变 10,000 事件的可见 DOM/资源门禁。

### E8 recovery and marker correction

- `EditorUnavailableRecoveryDecision` 只读取 route、队列、current track、playback 和 persistence 快照。`retry-route` 只针对同一 URL track；`offer-current` 不改变状态，直到用户点击“编辑当前歌曲”。
- 自动重试使用 route generation、恢复 signature 与单一 in-flight 队列；重复状态不循环，迟到结果不能覆盖新 route。恢复成功保持 paused，失败继续 unavailable 且不得创建/覆盖草稿。
- point button、diamond、事件时间和候选 pin 的横向中心误差不得超过 1 CSS px；diamond 与 marker surface 的垂直中心误差同样不得超过 1 CSS px。引线独立于菱形 transform。
- 该修正不修改 AudioSessionService 严格身份规则、JSON V1、IndexedDB 或 E7 历史 artifact。

## 19. Editor Fullscreen Analysis Overlay

- [ADR-0011](adrs/0011-editor-fullscreen-overlay.md) 把分析叠加层通过 Vue `Teleport` 提升到窗口顶层，root 固定覆盖 viewport。背景为无模糊的灰色半透明层；背景、Canvas、说明和空白区域不接收 pointer，侧边栏、时间轴和事件仍由浏览器直接命中。
- 左上角只保留固定复合入口：主按钮开关叠加层，箭头临时展开 21 项单选菜单。关闭保留工程中的 `featureId`，但 consumer active set 收敛为 `buffer`，exact cursor 与 overlay renderer 停止。
- `EditorSessionSnapshot.overlayOpen` 是当前内存事实；现有 Editor `preferences` store 按歌曲 content hash 保存 visibility。该偏好不进入 JSON V1，导入工程不覆盖它，数据库版本不变。
- 全视口 Canvas 只在底层标记时间列的屏幕横向范围内绘制。纵向文档滚动不改变图形窗口坐标；窄屏时间列横向滚动只更新裁剪和横向几何，任意共享时间锚点误差仍不得超过 1 CSS px。
- `topRatio`/`heightRatio` 改为 viewport-relative，三个手柄仍按 1%/Shift 5% 调整。visibility 持久化失败只发布 `not-persisted`，不得损坏工程、草稿、播放或标记。

## 20. Visualizer V0 Target Architecture（approved）

> 下方 V0 单模板与实时录制设计保留历史语境；当前生产模型见 [Project V3](visualizer/project-format-v3.md)、[离线导出](../context/visualizer-offline-export.md)，生成流程见本节“当前原子内容生成”和[内容生成契约](visualizer/content-generation.md)。

### Route and runtime ownership

- 目标路由为 `/visualizer/:trackId?`。侧边栏使用当前歌曲进入；未知、不可恢复或内容身份不匹配的目标进入明确空状态，不静默选择队列中的其他歌曲。
- `AudioSessionService` 把 Editor 专用 lease 泛化为 `RoutePlaybackLease`；只有当前 token 能释放 ended policy。当前 Editor/Visualizer 普通工作区保留 MusicBar 并临时使用 repeat-one，Visualizer 录制传输租约另行锁定 ended 行为；历史 pause-at-end 和隐藏策略不再描述当前普通工作区。
- `AnalysisCoordinator` 的 consumer 联合扩展为 `analyzer | editor | visualizer`。Visualizer 先对所有绑定 FeatureId 去重，只有 0–4 项合法；第五项在调用 Coordinator 前拒绝。分析值从 compact `AnalysisSeries` 按 AudioContext 绝对时间采样，不增加 exact-cursor 轮询或第二个 Worker。
- V1 实现必须原子迁移 Editor 到通用 lease，不保留长期 `acquireEditorPlayback()` 兼容 adapter。迁移不得改变 Editor repeat-one、刷新暂停或离页恢复 queue-next 的已批准行为。

### Project, draft and Editor snapshot

- `VisualizerProjectV1` 使用独立 strict JSON envelope，绑定歌曲 SHA-256、16:9 输出预设、单一模板 ID/version、确定性 seed、完整参数绑定和可选同歌 `EditorProjectV1` 快照。工程不保存 File、PCM、Analyzer 数组、cache、renderer 或录制 Blob。
- 独立 `audionotsurfyet-visualizer` IndexedDB V1 只保存 `draft/latest`。同歌恢复；异歌进入必须导出旧工程、覆盖或取消。内存先更新，quota/abort 只发布 `not-persisted`。
- 直接 Editor 数据只在进入 Visualizer 或用户显式“重新载入 Editor 数据”时复制并校验，不监听 Editor 数据库。导入的 Editor JSON 也必须与当前歌曲 hash/时长一致。工程导出保存已验证快照，因此后续 Editor 编辑不会静默改变 Visualizer 结果。
- strict validator 在原子替换前拒绝未知字段/模板/参数、重复参数、歌曲不匹配、无效 FeatureId/lane/class 和超过四个唯一分析特征。详见 [Visualizer Project Format V1](visualizer/project-format-v1.md)。

### Binding and deterministic scenes

- 数据源固定为 constant、analysis 和 editor-event。Analysis 向量投影只允许 schema 声明的 full/bin/band/mean/max/peak；Editor whole-lane 采用布尔 OR/max 聚合，point 形成脉冲，range 在半开 `[start,end)` 内形成 gate。
- 数值变换顺序固定为输入规范化、clamp、invert、确定性 attack/release、输出映射。平滑不能依赖上一 RAF；resolver 以歌曲 0 秒为起点建立可重放状态，使同一工程在 seek、刷新、从头播放和录制时对同一绝对时间输出一致。full-vector V1 不允许非零平滑。
- V1–V6 历史 `SceneRegistry` 注册 `orthogonal-lines@1` 与 `cube-swarm@1`。post-V6 只允许追加由 owner 批准 Scene Contract 的内置场景；每个 descriptor 仍须穷尽声明参数类型、默认值、范围、可绑定来源和 renderer factory。Editor lane 绑定保持未绑定并提示用户选择，不按名称或顺序猜测来源。
- `VisualizerRendererHost` 独占一个 16:9 Canvas、一个 Three.js `WebGLRenderer` 和一个可取消 RAF；DPR 上限为 2，暂停、seek、参数变化和 resize 按需单帧，播放/录制时只启用同一个 RAF。父级同帧只解析一次参数并把同一 resolved map 交给 scene 与 inspector；scene 只拥有 scene/camera/geometry/material 并必须对称 dispose。
- V3 Orthogonal Lines 使用单全屏 quad/shader、固定 `#020403` 背景和中心正交线。intensity 同时控制中心向两端的长度与主线 alpha，brightness >1 继续增强 halo；decay 以秒为单位，使用固定 60Hz、一秒 checkpoint 和 `exp(-4*dt/decay)` 的确定性余辉，且不改写 V2 resolved value。详细视觉与错误边界见 DEC-039 和子契约。
- 工程 seed 与绝对时间共同决定粒子初始位置、上升和轨道相位；不得累计 RAF delta。WebGL context lost 时保留工程/播放并重建 renderer；若发生在录制中则终止并丢弃未完成文件。详见 [Binding and Scene Contracts](visualizer/binding-and-scene-contracts.md)。

### Real-time WebM recording

- AudioEngine 提供单一 recording tap：从 `AnalyserNode` 到页面 `GainNode` 之前分支到 `MediaStreamAudioDestinationNode`。因此导出使用原歌曲音量，页面 mute/volume 不改变文件；任意时刻最多一个 tap holder。
- recorder 合并 `canvas.captureStream(selectedFps)` 和 audio tap，MIME 只按 VP9+Opus → VP8+Opus 回退。选定的 720p/1080p 与 30/60fps 不支持时明确失败，不静默降低预设。
- 录制状态为 `idle → preparing → recording → finalizing → ready/error`。preflight 要求所有活动分析、Editor 快照和 renderer 已就绪；随后暂停、seek 0、绘制 0 秒、启动 MediaRecorder 再播放，歌曲自然结束自动停止。
- 录制期间锁定 seek、模板、绑定、Editor reload 与输出预设。完成 Blob 只保存在内存并通过原生保存选择器写出；取消/离页丢弃未完成录制，保存取消可重试。详见 [Recording Contract](visualizer/recording-contract.md)。

### Failure boundaries and rejected alternatives

- 单个 analysis binding 未就绪时以中性 0 显示进度，失败只隔离到该绑定并可重试；录制 preflight 不允许以中性值伪装完整结果。
- 旧 generation、旧 route token、旧 template 或旧 binding result 一律不得更新当前项目或场景。任何工程/草稿/Editor 快照导入失败都保留原内存和 durable draft。
- 拒绝第二 AudioEngine/Worker、实时监听 Editor draft、可执行模板、多草稿工程库、依赖 RAF delta 的运动、静默录制预设降级。主要权衡见 [ADR-0014](adrs/0014-visualizer-runtime-leases.md) 至 [ADR-0017](adrs/0017-realtime-webm-recording.md)，受控扩展见 [ADR-0021](adrs/0021-controlled-visualizer-scene-generation.md)。

### 当前原子内容生成（DEC-082）

- 使用 visualizer-content-generator 将自然语言规范化为 `VisualizerContentBriefV1`，支持静态/动态新元素和组合预设。输入不完整或具体合同未获批时仓库零写入；所有新增内容，包括仅复用已有元素的预设，均须展示合同并等待批准。
- 合同核对当前 registry、参数/默认绑定、数据单位与映射、时序/目标、seed/绝对时间、资源预算和测试范围。批准后扩展 ElementRegistry/组合器或预设工厂，工程沿用 strict V3；不恢复 SceneRegistry、不添加 preset 工程字段。
- 全工程最多四种不同 Analyzer 特征，native 不计额度；未就绪/未配置行为使用当前 resolver、合成器和离线导出预检，不沿用旧场景静默 fallback。
- 完整接口、停止条件与 ADR-0021/DEC-056 的替代关系见[内容生成契约](visualizer/content-generation.md)。历史场景及实时录制段落保留历史语境，当前输出按离线导出契约，不自动创建 canonical/readiness。

### Workspace viewport and scrolling

- DEC-050 将支持的 `>=1024px` 桌面 Visualizer 外壳固定为一个 `100dvh`：DEC-076 改用共享侧边栏占位与 12px 桌面顶部留白，页面占据剩余内容宽度，document/body 不拥有纵向滚动。
- workspace 的 toolbar、可选 alert、中央 grid、recording bar 与 transport 使用有界 grid height；中央行必须 `minmax(0, 1fr)` 且所有中间容器允许 `min-height: 0`，不能由 inspector 的 min-content 高度撑开页面。
- 左模板和右参数侧栏分别拥有 `overflow-y: auto`、隐藏横向溢出和 `overscroll-behavior: contain`。可用内容宽度 `<1280px` 的抽屉以中央 workspace grid 为定位/裁切边界，不能覆盖 recording bar 或 transport；`<1024px` 保留现有最小宽度与横向兼容，不形成移动端支持承诺。
- 产品自有的可见滚动容器使用共享 `.app-scrollbar`，其视觉来源是 Analyzer 精确值表。本次只迁移 Analyzer 表与 Visualizer；不使用全局通配选择器覆盖原生控件或第三方组件。

### Post-V6 fullscreen playback

- `.visualizer-workspace` 是唯一 fullscreen owner。组件只在用户手势中调用 `requestFullscreen()`/`document.exitFullscreen()`，并只以 `fullscreenchange` 读取真实状态；Fullscreen API 状态不进入 controller、Pinia、Project JSON 或草稿。
- fullscreen CSS 隐藏 toolbar、alert、drawer、左右 panel 与 recording bar，把同一 preview 居中为 16:9 letterbox，并把现有 transport 绝对覆盖在底部。ResizeObserver 继续驱动同一个 RendererHost 的 `resize()`，不得创建第二 Canvas/renderer/RAF。
- 组件持有唯一 2000ms timer。只有 `fullscreen && playing && !keyboardFocusHold` 时可隐藏；底部 96px pointer 热区、transport hover、键盘操作和键盘焦点显示，paused/ended 取消 timer 并保持显示。
- recording lock 从 false 变 true 时退出本页面拥有的全屏，但不取消 recording；route guard 在既有录制离页决策前先退出全屏。请求/退出失败只更新可访问错误，卸载清除 document listener 与 timer。

`project-owner` 于 2026-09-02 明确回复：“我批准 Visualizer V0 系统设计、接口契约、R-034–R-041 与 ADR-0014–0017；同意进入 Visualizer V1–V6 execution planning。”本设计据此获批并只开放 V0-D delivery planning；当前 `/comingsoon`、V1 实现、quality evidence 与 release-readiness 均不因本批准自动完成。

## 21. Automated Audio-to-Video Target Architecture（approved）

### 21.1 Readers, constraints and decision scope

本节面向实现工程师和架构评审者。2026-10-04，owner 批准浏览器本地自动处理架构：Processor 使用 ONNX Runtime Web/WebGPU 运行 `htdemucs_ft`，扩展项目 TypeScript 节拍算法，结果以只读提案经用户确认后进入 Editor/Visualizer，最后沿用实时 WebM。

产品约束继续是自动优先、人工可修正和可完整手动制作；音频及工程不上传。自动音色/FX、MIDI、3D 辅助图、素材生成、离线/批量及其他视频格式明确延后。审批记录见 DEC-063–066 与 ADR-0024–0027；批准只开放 execution planning，当前代码与既有 canonical 不据此获得自动处理能力。

### 21.2 System boundary and topology

~~~mermaid
flowchart LR
  File[本地歌曲] --> Engine[单 AudioEngine 解码 / 原始 PCM]
  Engine --> Processor[Processor controller]
  Models[四个 FT ONNX 模型下载 / 校验] --> IDB[IndexedDB 模型与 metadata]
  Processor --> Separation[最多一个专用分离 Worker / ORT WebGPU]
  IDB --> Separation
  Separation --> OPFS[OPFS 四轨 / 临时 PCM]
  Engine --> Analysis[现有 analysis Worker / TS 逐拍跟踪]
  OPFS -->|drums 辅助证据| Analysis
  Separation --> Proposal[只读处理提案 / provenance]
  Analysis --> Proposal
  Proposal -->|用户确认小节信息与逐项应用| Editor[Editor V1 tempo / 人工修正]
  Proposal -->|用户确认| Visualizer[Visualizer Project V2]
  Editor -->|显式刷新快照与节拍映射| Visualizer
  Visualizer --> Recorder[现有实时 WebM]
~~~

- SPA 拥有歌曲、解码、播放时钟、任务 controller、工程、预览与录制；Worker 只拥有离线计算与临时处理资源。
- 保留当前 analysis Worker，最多增加一个专用 separation Worker；同一时刻仅一个自动计算 stage 运行。四模型顺序执行，不创建 ORT proxy Worker 或第二个播放 AudioContext。
- 单 AudioEngine/AudioContext、RendererHost、视觉 RAF 与最多四个活动 Analyzer 特征的边界不变；processing series 不计作 Analyzer FeatureId。
- 输入文件、PCM、stem 与工程在浏览器本地处理；网络仅用于应用/runtime assets 和明确显示的模型下载，不发送音频或结果。

### 21.3 Processor workspace and staged control

新增 `/processor/:trackId?`，复用歌曲身份与 route playback lease。三个阶段均需显式操作：

1. **分离音轨**：检查 WebGPU、模型与空间；必要时展示下载大小/进度并校验缓存。以原始 PCM 运行四个专用模型，生成 drums、bass、other、vocals 的 waveform、30Hz energy 和 WAV 导出。
2. **分析节拍**：原 mix 为主，已有 drums 为辅助；输出 BPM、逐拍位置、局部 tempo 候选和复核警告。分离被跳过或失败时仍可显式运行 mix-only TypeScript 分析，provenance 标明未用 drums。
3. **应用提案**：显示来源、cache、算法评分、警告、目标工程 hash 和逐项 diff。用户确认小节起点、BPM 与拍号后，可选择将 tempo、处理快照与默认绑定应用到工程。

阶段成功不自动启动下一步、播放或录制。用户可重试、取消、跳过或拒绝结果。首版不建立 stem 试听/mix 播放器；other 始终显示其规范角色，不改称 lead。

### 21.4 Browser runtime, models and failure boundary

- 分离使用 `onnxruntime-web/webgpu` 和 WebGPU EP；WebGPU/adapter 不可用、device lost、图不支持、模型损坏或推断失败均明确报 typed error，不自动改用 CPU 或小模型。现有人工标记、视觉映射、WebM 以及显式 mix-only 节拍分析仍可用。
- 四个 FT 专用 ONNX 模型的 immutable revisions、文件 SHA-256、大小、tensor/row 与许可证来源见 [Model Artifacts](processing/model-artifacts.md)。每次仅加载一个模型，完成该角色全曲分段推断并保存后，释放 session/tensor/GPU buffers 再加载下一模型；禁止从单个专用模型取全部四轨。
- 使用已转换的 fp16weights，仍为 fp32 推断。首次下载总量 662450544 bytes，显示逐文件下载、校验和 cache hit；取消下载不发布半成品。下载与音频处理分别计时，离线 cache hit 可复用完整模型。
- ORT Web 版本、JS/WASM asset identity、实际后端与 preprocessing config 需在首个兼容性切片锁定。依赖文档支持 WebGPU 用法不等于本仓库模型已兼容；风险保持 Open。

### 21.5 PCM time identity and browser cache

- browser-decoded PCM 是唯一时间基准。source descriptor 固定原采样率、channel/frame count、duration 和 canonical pcmHash；Worker 通过有界分块/临时 OPFS 读取，禁止 detach AudioEngine 的 buffer 或全曲多次复制。
- 模型边界重采样为 44.1kHz stereo；分段 normalization、overlap-add、滤波延迟补偿、末段 padding 与还原写入版本化 config/hash，输出保持 `[0, originalDuration)` 和首尾静音。仅允许不超过一个输出 sample 的尾部长度修正，超过则失败。
- cache identity 包含 source/PCM、四模型 revision/hash、ORT Web/assets/backend、beat algorithm/version 及 canonical config hash；结果复用还需 artifact checksum，缺失/损坏必须 miss 或 typed error，不复用近似 identity。
- IndexedDB 保存模型文件、结果 metadata 与 compact series；OPFS 保存大型 Float32 stem 和任务临时 PCM。工程不嵌音频/model/cache handle。写入先创建临时 artifact，完整校验后才发布 metadata；取消/失败不得发布部分四轨结果。
- cache 默认 10GB，可配置；模型、结果、临时数据总量同时受 origin 实际可用 quota 限制。写前估算及写时失败均返回明确错误；清理入口列出歌曲/模型/大小/日期，由用户明确删除，无自动驱逐。浏览器自行清除 origin 数据后的 cache miss 可重算，但不宣称持久化必然成功。
- cancel/route/track 变化撤销 generation、终止下载/推断并释放 Worker session/tensor，临时 artifact 在 5 秒内清理或登记为可清理残留。进程中断后的残留在下次初始化列出，不把残留误当作成功 cache。

### 21.6 Separation, waveform, energy and WAV

- 四轨输出选择、44.1kHz 拼接、Float32 artifact 与浏览器 WAV 编码遵守 [Model Artifacts](processing/model-artifacts.md)。waveform、energy 与导出必须来自同一拼接结果，不截去首尾静音或改变增益。
- 30Hz 第 i 窗口为 `[floor(i × sampleRate/30), min(frameCount, floor((i+1) × sampleRate/30)))`；多声道按平方均值合并后开方为 RMS，转 dBFS、裁剪到 [-80,0] 并线性量化 UInt16。length 为 `ceil(30 × duration)`，零能量映射 0。
- compact codec 固定版本、采样密度、长度、scale/offset 与 provenance；相同 stem bytes/config 生成逐字节相同 series。WebGPU 模型浮点结果按固定环境 reference/golden 容差验证，不承诺跨 GPU 逐字节相同。

### 21.7 TypeScript beat and local tempo candidates

- 复用当前 `src/analysis/tempoEstimator.ts` 的频谱通量、onset envelope、自相关 BPM 和置信度判断，在现有 analysis Worker 增加动态规划逐拍跟踪。原 mix 是主输入，drums 只提供 ±70ms 内 onset/beat agreement；鼓轨空白不能直接删除 mix beat。
- 逐拍绝对位置保留算法评分与证据，confidence 明确为归一化算法评分，不标作神经网络概率或正确率。阈值、tracking penalty、局部窗口和聚合参数都进入算法/config identity；不使用固定假分数。
- 局部可靠 beat interval 的中位数用于 BPM/变化候选；连续稳定窗口的 BPM 差不超过 2% 时可合并，否则形成待确认 boundary。静音、鼓轨空白、半速/倍速、beat gap、低置信度及不稳定区段均展示警告，不强制拉平为固定 BPM。
- audible region 基线为 mix RMS 连续至少 500ms 高于 -60dBFS；相邻可靠 beat gap 超过 `max(4 × 局部中位 interval, 4s)` 时警告。保留静音秒数，不向首尾静音外推假节拍；无可靠 beat 时 BPM 为 null、候选为空。
- 不承诺自动 downbeat 或拍号识别；检测结果只有 beat。用户在 Editor 确认小节起点、BPM 和 meter 后，按既有 tempo/grid 语义派生 beat 与小节首拍，并显式记录为 `editor-tempo-derived`。每四拍分组不是模型识别。
- 原始候选不直接包含伪造 meter 的 Editor tempoMap。确认步骤才构造从 0 秒起的合法 Editor V1 map，首尾未确认区间可用 single-beat；不自动把无 meter 候选应用为 4/4。

### 21.8 Proposal ownership and Editor application

- ProcessingProposalV1 只读、可丢弃，保存 source/runtime/model/algorithm provenance、warnings、BPM/局部 tempo 候选及 Visualizer snapshot。它不直接修改工程。
- 应用前显示每个目标的 canonical project hash 与结构化 diff，逐项选择 tempo、snapshot、默认 horizontal/vertical bindings；所选 tempo 需明确确认小节起点与拍号。
- Editor 保持 EditorProjectV1；自动 BPM 使用 `bpmSource: estimated`，用户改后的 segment 遵守既有 `user` 语义。不伪造 point/range、音色、FX 或 MIDI 事件。
- apply 同时检查 proposal source、job/generation 与目标工程 hash。任何目标冲突都返回 project-conflict 并要求重新审阅 diff；所选更新全部准备并校验后应用，失败不留下部分内存工程。持久化失败按既有 dirty/export 语义显式反馈。
- rerun 生成新 proposal，不更新已应用工程。user tempo、marker、binding 或 snapshot 只能由新的逐项确认替换；恢复使用保存的原工程/普通撤销能力。

### 21.9 Visualizer Project V2 and tempo refresh

- V2 保留现有 strict schema、track identity、Editor snapshot、scene registry、recording preset、单草稿及四分析特征边界，增加 processingSnapshot/source。V1 用无 I/O 纯函数单向迁移，原字段/binding 值保留；仅写 V2，无双写/降级导出。
- snapshot 嵌入四轨 UInt16 energy、检测 beat、warnings、source 与 provenance，不嵌 stem/model/OPFS handle。processing source 支持 stem-energy、beat，以及用户确认 tempo 后派生的 downbeat；小节首拍来源必须标明，不作为自动检测事件。
- 用户应用默认映射时，Orthogonal Lines horizontalIntensity = other energy，verticalIntensity = beat pulse；颜色、粗细、亮度和 decay 沿模板默认。已有 binding 仅在 diff 中逐项选择后替换。
- resolver 使用现有 AudioContext 绝对秒数，不创建新 polling/AudioContext/Worker/RAF。source identity 不符或需要数据缺失返回 typed unavailable，不把 0 当作有效结果。
- Editor tempo 后续修改后，Visualizer 标记 Editor snapshot/tempo-derived beat map stale。用户显式“刷新 Editor 快照与节拍映射”，预览更新 diff 后一起更新 Editor 快照及派生 beat/downbeat（绑定值保留）；检测 beat 仍作为只读原始证据。stale 时受影响 source 显示 unavailable，录制 preflight 要求先刷新或显式移除该绑定，不默用旧节拍。
- 没有 processing snapshot 的 V2 与迁移 V1 可继续使用 constant/analysis/editor-event；非 tempo 源不受 stale beat map 影响。

### 21.10 Video output and end-to-end behavior

沿用现有 pre-Gain、单 RendererHost capture lease、MediaRecorder 和 WebM 保存/丢弃状态机。处理成功不自动播放/录制；录制读取工程内 snapshot，无需分离 Worker 或 OPFS cache 存活。音画同步目标仍为 ≤100ms；30Hz series 与 pulse/tempo-derived resolver 独立用 golden 验证。

### 21.11 Failure boundaries and delivery verification

任务状态为 idle/ready/running/succeeded/failed/cancelled，消息契约见 [Worker and Project Contracts](processing/worker-and-project-contracts.md)。旧 source/job/generation 的迟到消息无条件丢弃。

| Boundary | Required behavior | Verification signal |
| --- | --- | --- |
| WebGPU/adapter 不可用、图不支持、device lost/OOM | typed error，无模型/CPU 自动降级，人工流程可用 | Chrome/Edge capability + fault injection |
| 模型损坏、下载失败/取消 | 字节进度与校验错误，半成品不可命中 cache | pinned artifact/checksum/download tests |
| PCM 分块、重采样、四模型输出、拼接或 WAV 不符 | 原子拒绝不发布完整结果，不改变原时间基准 | 静音/脉冲/四轨/reference/WAV golden |
| quota 不足、OPFS/IDB 写失败、cache corrupt | 明确失败、显式清理，无自动驱逐或近似命中 | storage boundary/transaction tests |
| 取消、换歌、离页、迟到消息 | generation 隔离，释放 session/tensor/Worker，临时 artifact 清理或登记 | resource probes + race tests |
| 固定/变化 BPM、鼓轨空白、半速/倍速、低置信度 | 保留候选与警告，不伪造 meter/downbeat | synthetic beat/tempo golden + owner 复核 |
| 用户修改、proposal/hash 冲突、rerun | 零隐式覆盖；重新确认 diff | project/concurrency/partial-selection tests |
| V1→V2、default mapping、tempo 刷新 | 纯确定迁移，旧 binding 保留，拒绝旧节拍映射 | codec/resolver/stale-snapshot tests |
| WebM 音画同步 | 现有录制回归与 ≤100ms 目标 | 双浏览器媒体检查 |

参考机为 NVIDIA RTX 4060 Laptop GPU 8GB。十五分钟歌曲在模型已下载并校验、原 PCM 已解码后，从分离任务 start 到四轨及 beat/tempo proposal ready 的总处理目标 ≤15 分钟且无 OOM；包括 PCM staging、session 初始化、拼接、waveform/energy 和结果写入，不包括首次模型下载、人工确认和实时录制。分别报告下载时间、各阶段 wall-clock、内存/显存、取消释放；UI 输入目标 ≤100ms，running progress 至少每秒一次（可报告当前 segment，不伪造进度）。目标尚无实测证据。

可提交 fixture 覆盖合成四 stem、44.1/48kHz、首尾静音、固定/变化 BPM、鼓轨空白、歧义和冲突工程。owner 歌曲仅作未跟踪人工复核，不作为唯一正确性证据。delivery 首个切片先验证 FT 分离兼容性、质量和性能，再接入完整工作区。

### 21.12 Alternatives and deferred options

| Option | Decision | Reason |
| --- | --- | --- |
| 独立本机处理服务 | Reject | 额外安装、启动、配对与进程维护不符合本轮浏览器选择 |
| 云端处理 | Reject | 改变本地音频与隐私边界 |
| 单个 FT 专用模型取四轨 | Reject | 非对应 row 不是完整 FT 四轨质量结果 |
| 自动 CPU/轻量模型 fallback | Reject | 隐式改变质量、耗时和 provenance |
| 神经网络 beat/downbeat 依赖 | Reject for first slice | 选择内部 TypeScript 跟踪，小节起点/拍号由用户确认 |
| cache 自动 LRU、stem 应用内 mix、V1/V2 双写 | Defer / Reject dual-write | 第一版显式清理与单播放引擎，迁移只有一个写入事实 |
| 自动音色/FX、MIDI、3D 图、素材生成、离线/批量/其他格式 | Defer | 缺少专项分类、质量、许可或输入输出契约 |

### 21.13 Approval and review triggers

2026-10-04，`project-owner` 明确要求实施随附计划，授权将修订的系统设计、接口、风险与 ADR-0024–0027 标记 approved，登记产品决定并创建本地文档提交。批准范围是浏览器处理架构及进入 execution planning；R-046–R-055 全部保持 Open，不代表模型兼容、质量、性能、delivery、readiness 或生产上线已通过。

更换模型/runtime/backend/节拍算法、改变联网/音频边界、PCM/缓存/Worker 拓扑、评分/聚合、小节确认、覆盖/刷新规则、V2 source/迁移或性能目标时复核相应契约与 ADR。新 execution plan、acceptance criteria、test strategy 和 milestone plan 仍须单独评审；本轮不创建实现代码或安装产品依赖。
