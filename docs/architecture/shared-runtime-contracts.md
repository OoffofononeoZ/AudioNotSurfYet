# 共享运行时契约

核查日期：2026-10-19。公共行为按当前源码维护；具体字段以链接中的 TypeScript 定义和运行时 validator 为准。

## 所有权与数据边界

- MainLayout 提供唯一 AudioSessionService、AudioEngine、AnalysisCoordinator 和页面 controller。Home、MusicBar 与工作区读取同一播放状态，不另建播放器或播放 AudioContext。
- 应用入口创建并提供平台端口，MainLayout 注入 `AudioFileAccess`；共享 service 不探测宿主或调用具体文件 API。`LocalFileReference` 仅提供 kind/name，Web 保留原始句柄载体，Electron 用可序列化 grantId；磁盘路径只在主进程授权记录中，细则与当前验证见[双端合同](../context/desktop.md)。
- Editor/Visualizer 工程及 WebM 保存经同一 `FileTransferAccess`；平台实现保留原生选择/取消语义。桌面工程读取为一次性授权，读完即释放；原生保存按块确认背压，完整写入后才发布文件，失败/取消清理本次临时文件，目标外部修改不覆盖。窗口退出等待和异常退出遗留清理仍待 D5，不能把文件事务测试当作完整生命周期通过。
- Pinia 保存可序列化快照。File、Blob、handle、PCM、AudioBuffer、Worker、节点及对象 URL 留在所属运行时服务，并在换源、离页或 dispose 时释放。
- 音频和工程保留在各端本地；两端数据独立，模型/静态资源请求不授权上传用户音频。处理任务复用原歌曲身份和有界 PCM 读取。
- 共享 UI、Home、MusicBar、滚动与路由占位见[应用外壳](../context/app-shell.md)，服务装配见 [system map](../context/system-map.md)。

## 播放与异步身份

入口：[audioEngine.ts](../../src/audio/audioEngine.ts)、[audioSessionService.ts](../../src/audio/audioSessionService.ts)、[audio.ts](../../src/types/audio.ts)。

- 播放秒数来自 engine 音频时钟，裁剪到歌曲范围，不累计 RAF delta。刷新恢复到 0 秒 paused，不隐式播放。
- `PlaybackSnapshot` 和导出 `AudioPlaybackCheckpoint` 必含 `playbackRate`。全局速度默认 1，支持 0.1–2，原曲、FT 和辅助试听统一使用原生 AudioBufferSource playbackRate，音高随速度变化；时钟按速度换算回原曲秒数，分析、标记、BPM 和工程时间不缩放。修改速度保留当前位置；分块试听中止旧读取并按最新 generation 重排，静音与播放意图保留。
- 加载、解码、恢复和持久化检查 generation/revision；旧任务、取消或 dispose 后的完成结果不得覆盖新歌曲与新状态。
- Web 维持 V1 current Blob 恢复及句柄权限流程；Electron 对有持久化来源的歌曲优先检查磁盘内容 hash，缺失/变化/授权丢失不播放旧 Blob。没有持久化来源的内嵌 File 仍可按 Blob 身份恢复。初始化不覆盖用户较新的播放选择，换输入/清空/dispose 取消旧选择与读取结果。
- Editor/Visualizer 通过 tokenized route lease 临时使用 repeat-one；只有当前 token 的 release 生效，离页恢复用户偏好。导出 transport lease 保护歌曲音源和队列，不阻止同歌播放、seek 与单曲循环。
- `getPlaybackSnapshot()` 读取 engine 即时快照；`subscribePlaybackDiscontinuity()` 在跳转、重启、变速或试听源切换前通知，返回清理函数。数字录入按 [Editor 交互](editor/interaction-contracts.md)取消未提交范围，鼠标拖动也取消。
- 导出期间速度控件和公开变速命令可用；离线导出仍按原曲 PCM 和绝对时间推进，不继承试听速度或音高，结束后保留最新速度、位置与播放状态。
- 分轨与原曲共用 transport。buffering 冻结有效时钟；audition-read 可重试当前源或显式返回原曲，不通过重载歌曲掩盖错误。

## 分析租约与时间

入口：[analysisCoordinator.ts](../../src/analysis/analysisCoordinator.ts)、[分析类型](../../src/analysis/types.ts)、[Worker](../../src/analysis/analysis.worker.ts)。

- Analyzer、Editor、Visualizer 的 consumer lease 互斥，新 consumer 使旧 lease 失效；旧 token 不改变当前工作区。
- 保持单个分析 Worker；无活动特征不创建任务。每个来源最多四种唯一特征，native 输入不计入额度。原曲和 drums/bass/other/vocals 以来源与特征共同标识；四轨只允许 energy、amplitudeSpectrum、buffer、wallpaperEngineSpectrum。分轨通过同一 Worker 串行计算，有界读取已校验的 OPFS PCM，精确游标与窗口也按来源隔离。
- 消息、cache、series 和 exact cursor 匹配歌曲 hash、config hash、generation/request identity；取消与迟到消息不回填新工作区。
- Editor lease 提供可取消的 `requestWindowSeries`，从 Worker 保留的 PCM 返回带真实起始时间的运行时窗口序列；类型见 [windowTypes](../../src/analysis/windowTypes.ts)。它与持久化 `AnalysisSeries` 区分，不进入分析缓存编码；窗口任务分批让出执行，精确游标优先。视图拥有单窗口缓存及缩放防抖，详见 [标记工作区](../context/editor-marking.md#图表细节与时间对齐dec-094)。
- 取消用于节省资源，完整身份检查才是正确性边界；不能假定取消一定先于结果抵达。
- 原曲 PCM 的准备/确认与特征任务分离，按 track/hash、decoded revision 和 config 标识单一 Worker 来源。同歌切页及活动特征变化复用该来源，旧 lease/job 仍立即失效；换歌、解码版本变化、清空、实时模式及销毁释放。Wallpaper 缺失项按需传递临时 stereo PCM，计算后不保留额外立体声副本。
- DEC-108：来源 pcmState 与单项 readyFeatureIds 独立于整组 state。混合任务先发布 buffer，窗口/精确值可在其他特征计算中读取已就绪项；Worker 在后台优先级任务中让出，使入站消息能被处理。可见窗口优先于全曲和 BPM，切片边界处理一次更高优先任务后恢复原任务。BPM 请求按来源、请求与 Editor lease 隔离，同歌特征 generation 变化可继续，离页/换源/取消无效；排队时用有效分析进度刷新等待看门狗，实际计算沿用既有超时。
- 当前原曲缓存仍最多四项，活跃项优先，其余槽保留最近结果；空活动集不清除有效同歌缓存。命中复用解码序列与编码 payload，缺失项才提取，未变化内容不重复写入；持久化 schema 与事务保护不变。
- 精确游标选择不晚于目标时刻的最后合法 frame，duration 映射末帧；不以绘图量化值替代精确值。快速请求允许合并，过期结果丢弃。
- spectralFlux 使用项目公式和 golden，不调用有缺陷的 Meyda extractor；首帧和零能量语义见 [ADR-0005](adrs/0005-project-spectral-flux-and-silence-semantics.md)。

## 会话与持久化

入口：[session.ts](../../src/types/session.ts)、[sessionRepository.ts](../../src/persistence/sessionRepository.ts)。

- 公共会话仍为 PersistedSessionV1；未知 schema 不猜测迁移。游标、lease 和运行时对象不写入会话。
- activeCards 是 V1 carrier，slot 映射 activeFeatureQueue；实际字段与 analyzerWorkspaceVersion 以源码为准，已取消的 featureOrder 不再是现行接口。
- session、handles、current Blob、current analysis cache 保持各自身份和单个 current 记录；先建立新状态，在事务内替换，quota/abort 不先删除有效旧记录。
- 恢复优先使用匹配 Blob/cache，其余状态明确反馈 permission-required、permission-denied、file-missing、content-changed 等原因；保存失败不破坏当前播放。
- 新歌曲发布 saving 后，只有最新 command generation 的 ready/not-persisted 可确认结果；cache 发布还须核对 persisted current track/hash。

## 页面入口与验证

保留的独立设计理由：[单音频所有者](adrs/0001-single-audio-engine-and-session-state.md)、[Worker/身份隔离](adrs/0002-worker-analysis-and-stale-result-isolation.md)、[混合会话恢复](adrs/0003-hybrid-indexeddb-session-recovery.md)、[类型化registry/Canvas](adrs/0004-typed-feature-registry-and-canvas-renderers.md)。旧页面ADR的有效边界已归入下面各页，不再保留互相冲突的布局和阶段要求。

- [Analyzer](analyzer/interface-contracts.md)：队列、分析、绘图和缓存。
- [Editor](editor/interface-contracts.md)：V1 工程、标记、FT 与自动标记。
- [Visualizer](visualizer/interface-contracts.md)：V4 资源、binding 与离线导出。
- 验证按[测试 skill](../../skills/audiosurf-testing-strategy/SKILL.md)选择失败、stale/cancel 与资源检查；正式证据只证明原候选。
