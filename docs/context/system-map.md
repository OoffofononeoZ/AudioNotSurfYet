---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-12
upstream_docs:
  - "docs/context/index.md"
next_action: "Editor四轨接入本轮功能验证已收尾，owner接受当前听感与长曲耗时；正式评审独立"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService`、`AnalysisCoordinator`、`EditorSessionController` 与 `VisualizerSessionController`；服务通过 `AudioEngine` 解码、播放本地文件，并通过三个独立 IndexedDB repository 保存 Analyzer session、Editor 单草稿与 Visualizer 单草稿。Analyzer、Editor 与 Visualizer 已通过互斥 consumer lease 复用同一 coordinator；Visualizer 只把稳定去重后的 0–4 项送入现有 Worker/cache。File、Blob、handle、PCM、Worker 与音频节点均留在 store 外。MusicBar、Editor 与 Visualizer 读取同一播放快照；有效 Editor/Visualizer track 隐藏 MusicBar，通用 tokenized route lease 分别把 ended 策略改为 repeat-one 或 pause-at-end。

DEC-072另由MainLayout提供唯一`EditorSeparationService`，使用同一AudioEngine原始PCM；Editor增加分离工作区和四轨展示/导出。模型与结果索引使用`processing-p1` IndexedDB，原PCM/planar/WAV使用OPFS；最多一个专用分离Worker，播放及analysis所有权不变。

Visualizer 已实现 `/visualizer/:trackId?`、route playback/analysis lease、strict JSON V1、独立单草稿、原生 JSON gateway 和一个 16:9 Canvas；binding 使用同歌 Editor snapshot、0–4 planner 与 60Hz 绝对时间 resolver。单一 `VisualizerRendererHost` 管理 Orthogonal Lines/Cube Swarm、确定性状态与错误恢复；录制使用唯一 pre-Gain tap、同 Canvas capture lease、MediaRecorder 和原生保存 gateway。具体职责见下表，历史审批与候选身份见对应 evidence。

## Runtime Flow

```text
showOpenFilePicker → FileSystemFileHandle → File
  ├→ SHA-256 + music-metadata → TrackRecord → audioSessionStore
  ├→ SessionRepository → IndexedDB
  │     ├→ latest session + all handles
  │     └→ current Blob + current analysis-cache binary envelope
  └→ AudioSessionService runtime registry
        → ArrayBuffer → AudioEngine
        → AudioBufferSource → Analyser → Gain → destination
              ├→ Meyda energy → audioSessionStore → MusicBar/Home
              └→ chunked average-mono PCM copy
                    → AnalysisCoordinator
                    → analysis.worker.ts → workerCore + Meyda
                    → compact binary payload / exact cursor
                    → SessionRepository + audioSessionStore
```

## Visualizer Current and Target Flow

```text
/visualizer/:trackId? → VisualizerSessionController
  ├→ RoutePlaybackLease(pause-at-end) → AudioSessionService → AudioEngine
  ├→ VisualizerProjectV1 ↔ audionotsurfyet-visualizer/draft/latest
  ├→ one 16:9 Canvas + three-column/drawer workspace [V1 current]
  ├→ AnalysisConsumerLease(visualizer, deduped 0–4) → AnalysisCoordinator/Worker/cache [V2 current]
  ├→ validated EditorProjectV1 snapshot → BindingResolver [V2 current]
  └→ BindingResolver(60Hz absolute time + checkpoint) [V2 current]
       → SceneRegistry factory(orthogonal-lines | cube-swarm) [V4 approved]
       → one VisualizerRendererHost + one Canvas/WebGLRenderer/visual RAF [V3/V4 approved]
       → Orthogonal Lines trail | Cube Swarm 60Hz rise/orbit [V4 approved]
       ├→ captureStream + AudioEngine pre-Gain tap → MediaRecorder → WebM Blob [V5 approved]
       └→ native Fullscreen API on existing workspace → same Canvas + transport [post-V6]
```

目标边界：Editor 数据只在进入/显式 reload 时快照；analysis 第五项在 Coordinator 前拒绝；页面音量不影响录制；不支持的 resolution/fps 明确失败而非静默降级。

## Subsystems

| Subsystem | Purpose | Interfaces | Owner | Notes |
| --- | --- | --- | --- | --- |
| App shell and routing | 组合 Header、路由内容、MusicBar，并拥有 session service 生命周期 | Vue Router、provide/inject | project-owner | `createWebHistory()`；MainLayout 卸载时 dispose |
| MusicBar and queue UI | 文件选择、队列命令、进度、三种样式和错误消息 | AudioSessionService commands、audioSessionStore、MusicList events | project-owner | 不持有 File、AudioContext、播放 RAF 或队列事实 |
| AudioSessionService | 元数据、runtime File/封面、竞态、ended 循环、单 RAF、工作区持久化与资源释放 | File/工作区输入；TrackRecord/PlaybackSnapshot/energy 输出 | project-owner | 工作区先更新内存，保存失败发布 not-persisted |
| AudioEngine | 单一 AudioContext、解码、播放、暂停、seek、音量和时域数据 | ArrayBuffer 输入；PlaybackSnapshot/Float32Array 输出 | project-owner | AudioContext 与节点延迟创建；AudioContext 时钟为事实来源 |
| AnalysisCoordinator | 校验 0–4 活动特征、管理 generation/job/cache identity、合并 cache hit/miss、取消/重试和精确游标请求 | AudioEngine PCM copy、module Worker、SessionRepository、Pinia snapshot | project-owner | 默认活动集为空；完整身份不匹配或旧 generation 一律丢弃 |
| Analysis Worker | 固定 frame/hop/window 下批量提取累计 21 项特征，聚合、量化、编码并响应 exact cursor | typed Worker request/response、transferable PCM/ArrayBuffer | project-owner | 每批最多 32 frame 或约 8ms yield；同帧一次 Meyda batch；Flux 复用相邻幅度频谱 |
| FeatureRegistry and codec | 21 项穷尽静态契约、六类紧凑 payload 与严格二进制 decoder | `FeatureId`、`FeatureDefinition`、`StoredAnalysisCache` | project-owner | Loudness 使用 total Float32 + 24 bands U16；Complex 使用 magnitude U16 + phase Int16；schema 保持 V1 |
| Audio session state | 保存队列、当前 track、播放快照、能量、analysis 与 workspace snapshot | Pinia `audioSessionStore` | project-owner | `$state` 可 JSON 序列化，不含浏览器资源实例或 typed-array payload |
| Session persistence | 保存/恢复 V1 最近会话、全部句柄和唯一 current Blob/cache | 原生 IndexedDB `SessionRepository` | project-owner | `replaceCurrentAnalysisCache()` 校验 track/hash 并原子替换；unknown schema 不猜测迁移 |
| Config persistence | 保存 volume 与 MusicBar style | Pinia、localStorage key `config` | project-owner | schema 保持不变；volume 为 0–100 |
| Home visualization | 全屏 Three.js 光线 shader | `rayLength` prop、IntersectionObserver、reduced-motion media query | unknown | 常规模式使用 WebGL RAF；reduced motion 只静态渲染；卸载释放 mesh、geometry、material、render list、renderer 与 WebGL context |
| Analyzer surface | 固定展示 21 张折叠卡、最多四项 FIFO 活动分析、共享 viewport/zoom/cursor/seek、DOM 精确值与分层 Canvas | store、AudioSessionService、AnalysisCoordinator、Canvas 2D | project-owner | 独立 `featureOrder` 驱动 feature-keyed DOM 与 masonry，排序不触发 Coordinator 或改变 FIFO；实际高度最短列布局，390/1024 一列、1280/1920 两列、gap 18px；展开才挂载图表资源，默认活动队列为空 |
| Editor E1–E9 surface | `/editor/:trackId?` 状态、精简 transport、JSON 工程、共享波形/tempo/point/range 时间列、21 项 overlay、`88px/72px` 波形、28px 紧凑 BPM 条、不可用恢复决策与中心对齐 marker | EditorSessionController、AudioSessionService、AnalysisCoordinator、Vue Router、shared Canvas renderer、DOM controls | project-owner | E1–E9 已关闭；E9 revised canonical 与 owner 门禁已批准 |
| Editor project and draft | strict JSON V1、歌曲 hash/时长绑定、原生 file gateway、单草稿 autosave 与恢复冲突 | `EditorFormatCodecRegistry`、`EditorDraftRepository`、`audionotsurfyet-editor` V1 | project-owner | 首版只注册 JSON；session database 不变 |
| Visualizer V1–V6 surface | `/visualizer/:trackId?` 单视口三栏/互斥抽屉、左右独立滚动、16:9 单 Canvas、底部 transport、strict project/单草稿、两个确定性 scene、recording 状态栏、WebM 保存、final hardening 与 post-V6 原生全屏 | `VisualizerSessionController`、`VisualizerRendererHost`、`SceneRegistry`、`RoutePlaybackLease`、`AnalysisConsumerLease`、BindingPlanner/Resolver、Editor snapshot、MediaRecorder、Fullscreen API | project-owner | V1–V6 canonical 保持批准；fullscreen 只为瞬时 UI，自动化跳过并待 owner 审阅 |
| Experimental charts | 试验性的 Three.js 2D 图和瀑布流 | Vue props、TestLands | unknown | 不视为稳定接口 |
| Event bus | 跨组件事件类型与发送 | mitt singleton | unknown | `settings-open` 无已发现订阅者 |

## External Dependencies

| Dependency | Why it exists | Failure impact | Replacement or fallback |
| --- | --- | --- | --- |
| Browser Web Audio API | 解码、播放和分析本地音频 | 核心播放与能量链路不可用 | 未定义 |
| WebGL / Three.js | Home 光线、Visualizer 单 RendererHost/Orthogonal Lines 和试验图表 | Visualizer 场景进入可重试错误层，其他 WebGL 表面不可用 | Visualizer 保留 transport、工程、模板和草稿操作；无 2D 视觉 fallback |
| Canvas 2D | Analyzer 静态数据层、游标层与点阵背景 | 单卡 renderer 可降级 | DOM 保留标题、参数、图例、精确值和重试语义 |
| localStorage | 恢复音量和样式 | 配置回到默认或写入失败 | 未定义 |
| IndexedDB | 最近会话、句柄、当前 Blob/cache 的本地持久化 | 刷新后无法自动恢复 | 当前页面继续使用并显示 not-persisted/restore-error |
| File System Access API | 用户选择文件与显式恢复权限 | 无法导入或恢复非当前文件 | 支持范围内不回退到隐藏 input；提示使用最新版 Chrome/Edge |
| `music-metadata` | 解析本地音频标签与封面 | 元数据和封面缺失；播放能否继续需验证 | 当前有 unknown/default cover 显示 |
| Meyda | 从实时时域数据提取 energy，并在 Worker 提取批准的离线特征 | 音频响应可视化或分析不可用 | Worker 错误可重试且不停止播放；`spectralFlux` 由 ADR-0005 项目实现，上游缺陷仍见 R-020 |

## Known Seams

- MusicBar 仍拥有 GSAP、跑马灯和拖动预览等纯 UI 状态；播放事实由 session store 提供。
- AudioSessionService 的 runtime registry 是 File、句柄引用与封面对象 URL 的运行时所有者；SessionRepository 是 IndexedDB 连接与记录的唯一所有者。
- AudioEngine 是当前解码 AudioBuffer 的唯一所有者；只通过 descriptor 和分块 copy 接口向协调器提供平均单声道 PCM。copy 期间 decoded revision 改变时立即丢弃旧结果。
- AnalysisCoordinator 拥有产品 Worker、generation、pending request、精确游标和 cache 合并；Worker 的 mono PCM 只保留到 track/revision/generation 失效或 dispose。
- 全 cache hit 仍以 0-feature job 把当前 PCM 交给 Worker，只为 exact cursor 保留，不重复执行 Meyda 特征提取；默认活动集为空时仍不创建 Worker。
- M6 DEV bridge `window.__AUDIO_NOT_SURF_YET_M6__` 只代理当前有效 Analyzer lease，并公开可序列化命令/状态和 exact cursor；在 Home 或 Editor 不取得/覆盖 consumer，也不暴露 File、PCM、AudioBuffer 或 Worker。
- 刷新时 current Blob 优先并恢复为 0 秒 paused；其他曲目只在 `queryPermission()` 为 granted 时自动取回，`requestPermission()` 只由可见用户操作触发。
- `--coinc-process` 既可能由 GSAP 写入，也可能由能量 RAF 写入，模式切换需明确所有权。
- AudioContext、source、单播放 RAF、产品 Worker、pending analysis request 和封面 URL 由 MainLayout-owned service/coordinator 生命周期统一释放；Analyzer masonry 的容器/21 item ResizeObserver 与待执行 RAF 在卸载时成对释放，展开卡的 Canvas/卡片 ResizeObserver 在收起时释放，GSAP 和 Three.js 由各组件释放。
- Header 的 settings 事件没有已发现消费者；`/comingsoon` 只保留为通用占位，不再承载 Visualizer。Editor E1–E9 已获批准并关闭；E9 不改变 runtime/data ownership，Visualizer V1 也不改变该边界。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。

## Editor 基线边界

以下为 E1–E9 的已实现基线；E10 与 FT 接入修订的当前状态及合同见 [上下文入口](index.md)。

- `/editor/:trackId?` 由 route-generation `EditorSessionController` 编排；Header 使用当前歌曲，播放列表“去编辑”先播放指定歌曲。
- tokenized playback lease 隔离 repeat-one；analysis consumer lease 只允许 Analyzer/Editor 最新 token 生效。Editor 先激活 `buffer` 完成 waveform/tempo，再激活 `buffer + selected overlay`；选择 Buffer 时去重，快速切换与旧 generation 以最后选择为准。
- `EditorProjectV1`、strict JSON codec、原生 picker gateway 和独立 `audionotsurfyet-editor` V1 单草稿已实现；内存工程优先，quota 发布 `not-persisted`。
- `EditorTimeline` 以同一 `timeToX/xToTime` 驱动 waveform、grid、cursor 与 boundary；viewport 支持 1–64 zoom、指针锚点、任意像素/25% pan、seek 和持久化。
- tempo map 支持 metered/single-beat、20–300 小数 BPM、拍号、继承式 boundary 和内部 onset/autocorrelation 估计；低置信度或 stale 结果不写入工程。
- `EditorPointWorkspace` 使用同一 viewport/time geometry 展开 point lane 与全部 inner class；Canvas 绘制背景网格，DOM 只实例化当前横向 viewport 内的稳定 ID marker。
- point 命令固定微秒唯一性、1/16–1 beat 自适应吸附、single-beat 整段一格与分类迁移/明确删除；右键 marker 删除，空白 4px 以上 pan，否则打开 quick menu。
- range 命令使用微秒规范化半开 `[start,end)`；同 lane/inner class 真重叠拒绝、相邻允许，跨分类范围和内部 point 可并存。UI 支持两阶段创建、虚线 preview、Esc/空白右键取消、端点 pointer/keyboard 调整、pointercancel 回滚、分类迁移冲突与 viewport-visible 裁剪。
- `analysisCanvasRenderer` 是 Analyzer card 与 Editor overlay 共用的纯 Canvas adapter；E4 overlay 一次选择累计 21 项中的一个，使用同一 viewport/time geometry、DPR backing store、40ms exact cursor 合并和 last-ready Buffer fallback。
- overlay 通过 Teleport 固定覆盖窗口，灰色背景、全视口 Canvas 与说明穿透到 Header/底层标记；只有左上复合入口、临时 21 项菜单、重试和 top/move/bottom 手柄接收 pointer。bounds 仍为 0.10/0.35、最小 0.12，但相对 viewport；visibility 按歌曲 hash 本地保存，关闭时 active set 只保留 Buffer。

E7 原 44/44 run 只作 `pre-revision`，修订版 46/46 与 E6/E8 的历史身份见 [Editor evidence](../quality/editor/evidence-index.md)，不因其他子系统修改而改写。

E8 当前实现把波形 stage 缩为桌面 `88px`/窄屏 `72px`，以 6px 安全区计算垂直振幅；`Editor.vue` 通过纯恢复决策在同一 URL 歌曲恢复后合并重试，另一首歌曲只提供显式 replace 入口；point marker 的菱形和引线分离并以事件 X/Y 中心定位。JSON V1、Editor IndexedDB、AudioEngine 与 AudioSessionService 严格身份规则均不变。

## 当前边界与历史证据

Analyzer 运行态由 `activeFeatureQueue` 管理最多四项 FIFO，独立 `featureOrder` 决定卡片顺序；V1 `activeCards` 仅作为兼容 carrier，排序不取得新的 analysis consumer 或改变活动队列。

批准原文与替代关系查 [decision registry](decision-registry.md)，canonical 身份、hash 和人工门禁分别查 [Analyzer evidence](../quality/evidence-index.md)、[Editor evidence](../quality/editor/evidence-index.md) 与 [Visualizer evidence](../quality/visualizer/evidence-index.md)。当前里程碑、候选与未解决缺口见 [上下文入口](index.md)；本页维护职责和数据流，历史通过不证明当前代码已获整体 readiness 或上线授权。

## Browser Processing — Editor FT Integration

`src/processing/`提供固定四FT模型/官方ORT JSEP manifest、增量hash、native PCM OPFS staging、单分离Worker/controller、64-tap resampler、滚动overlap-add、30Hz energy/waveform与Float32 WAV。独立harness继续位于`tests/processing/`；DEC-072的生产入口位于现有Editor“音轨分离”，不新增Processor路由，尚未接自动节拍/提案或Visualizer V2。

`EditorSeparationService`串行拥有任务、generation、缓存恢复和导出URL；`EditorStemRepository`校验原PCM、模型/runtime/config、compact metadata与全部artifact checksum后发布/恢复。会话revision只用于当前PCM复制防护，跨刷新使用原descriptor header重验完整hash。用户可配置10GiB上限、显式清理Editor结果/残留或四模型；无自动驱逐和CPU/本地模型备用路径。切工作区保留任务，确认离页/换歌取消，人工工程V1不由分离更新。

四原图已在Chrome/Edge独立harness跑通；Chrome主Editor反馈已完成四轨/WAV及刷新恢复，正式双浏览器接入证据待补。历史失败和P1尚缺性能/人工质量见[P1 evidence](../quality/processing/evidence-index.md)，当前入口验证见[Editor evidence](../quality/processing/editor-integration-evidence.md)；R-046–R-055仍Open。

## Editor 试听与有限自动标记（DEC-075）

`AudioEngine`仍是唯一AudioContext、主gain/analyser与时钟所有者。`ChunkedAudition`只拥有分轨gain、四秒buffer、八秒预调度和读取任务；FT/辅助文件由`stemAuditionSource`租约有界读取，暂停、换歌、离页和清理均等待读取释放。播放快照包含原曲/FT/辅助来源与buffering状态；准备期间后发的暂停和seek优先。

`MainLayout`提供共享`EditorProcessingGate`、`EditorSeparationService`和`EditorTranscriptionService`。FT切换/重跑/清理先释放自动标记消费者；一个处理槽位串行拥有FT或转录Worker。`src/transcription/`将模型manifest/许可、频谱与重采样、ADT_STR解码、Basic Pitch音符提取、六轨辅助OPFS输出、Worker/controller、候选与V1原子应用分别归属独立模块。session按阶段释放；六轨只保留guitar/piano，不转写FT other。

`TranscriptionRepository`使用独立`editor-transcriptions` IndexedDB与`transcription-UUID` OPFS目录，保存候选修正、逐乐器分界、辅助PCM/WAV、完整来源与校验清单。修正不重新推理；显式应用创建确定ID的新point/range轨，工程格式不变。候选来源继续在独立缓存中保存，V1工程不承载新模型字段。三个Editor页签复用原transport；Canvas预览与分页候选表由组件展示，`.app-scrollbar`归候选表所有。质量与实际验证范围见[当前记录](../quality/processing/editor-auto-marking-evidence.md)。
