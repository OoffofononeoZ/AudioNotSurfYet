---
status: approved
owner: 'project-owner'
last_reviewed: 2026-10-19
upstream_docs:
    - 'docs/context/index.md'
---

# System Map

## System Summary

Web/Electron 双端 Goal 已批准，D1 的 `electron/` 宿主、独立构建及安全应用协议已接入，渲染端复用网页产物；原生启动阻断尚未解决。平台端口、原生授权及独立存储边界见[双端合同](desktop.md)，按阶段落地，不复制以下共享业务服务。

D2 已添加主进程只读文件/目录授权、受限 IPC 和文件流端点。`src/platform/` 在应用入口选择双端音频和目录端口，由 MainLayout 与 Visualizer 注入共享服务；Web 原始句柄与桌面 grantId 的运行时引用均留在 Pinia 外。Web V1 存储保留，桌面音频恢复优先核对磁盘 hash，目录 repository 保存原生授权描述。共享资源读取/预览校验不依赖具体句柄方法，真实原生运行受 D1 异常阻断。

D3 的 `FileTransferAccess` 处理工程、媒体、歌词及文件输出，集中平台控件保留 Web 上传/下载语义；`DirectoryExportAccess` 处理预设和壁纸目录，复用共享格式与依赖校验。桌面 `NativeSaves` 分块确认、同目录临时文件发布，`NativeBundles` 约束精确清单并整体发布新目录；只读库写入另经原生确认。主进程管理路径与清理所有权，renderer 不持有任意路径或 Node 能力。

D5 关闭通过生命周期端口接入 MainLayout 的共享运行时。主进程校验阶段化请求、确认风险并等待原生 IO 排空；renderer 先保存草稿/候选修正，再按服务顺序释放并卸载应用。`SessionRepositoryTasks` 追踪会话事务，保持原 repository 契约；准备失败保留工程并恢复编辑。窗口偏好独立保存在 userData；真实退出、最小化及异常遗留处理状态以[桌面合同](desktop.md)为准。

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService`、`AnalysisCoordinator`、`EditorSessionController` 与 `VisualizerSessionController`；服务通过 `AudioEngine` 解码、播放本地文件，并通过三个独立 IndexedDB repository 保存 Analyzer session、Editor 单草稿与 Visualizer 单草稿。Analyzer、Editor 与 Visualizer 已通过互斥 consumer lease 复用同一 coordinator；原曲与已验证四轨按来源去重、每来源最多四项，复用同一分析 Worker。File、Blob、handle、PCM、Worker 与音频节点均留在 store 外。MusicBar、Editor 与 Visualizer 读取同一播放快照；Editor 与 Visualizer 普通工作区保留 MusicBar；两个工作区的 tokenized route lease 临时使用 repeat-one，导出传输租约优先停止循环。

DEC-072另由MainLayout提供唯一`EditorSeparationService`，使用同一AudioEngine原始PCM；Editor增加分离工作区和四轨展示/导出。模型与结果索引使用`processing-p1` IndexedDB，原PCM/planar/WAV使用OPFS；最多一个专用分离Worker，播放及analysis所有权不变。

Visualizer 当前实现 Project V6、可执行资源包 V2、分组预设及同歌范围转场。用户选择的只读外部 assets 文件夹提供算法/Shader/定义，工程保存完整快照；算法通过无同源权限 iframe 所属 Worker 隔离计算，宿主校验数据后统一绘制。Visualizer 页面拥有独立资源库实例、目录句柄任务和共享预览 URL；独立 IndexedDB 仅记住目录句柄。离页取消任务并释放预览，不接 ZIP、后端或外部 URL。布局及接口见[组合工作区](visualizer-composition.md)、[资源包](../architecture/visualizer/resource-packages-v2.md)与[Project V6](../architecture/visualizer/project-format-v5.md)；外部内容生成 skill 2.7.0 默认自主生成并要求实际展示图，项目不保留副本或内容审批门禁，历史 evidence/readiness 不自动继承。

应用导航占位、窄屏隐藏、歌曲详情与内容宽度分界见 [应用外壳契约](app-shell.md)（DEC-076）；旧 canonical 数值与身份继续绑定历史实现。

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

## Visualizer 当前流程

```text
/visualizer/:trackId? → VisualizerSessionController
  ├→ RoutePlaybackLease(repeat-one; export transport locks) → AudioSessionService → AudioEngine
  ├→ VisualizerProjectV6 ↔ audionotsurfyet-visualizer/draft/latest
  ├→ project-owned executable packages → ResourceLibrary → available definitions
  ├→ one 16:9 Canvas + element list/inspector + project bottom panel + MusicBar
  ├→ AnalysisConsumerLease(visualizer, deduped 0–4) → AnalysisCoordinator/Worker/cache
  ├→ NativeAudioSource → bounded decoded PCM → offline Web Audio stereo FFT/waveform chunks
  ├→ CompositionLyricHost → embedded UTF-8 LRC → bounded cue window + owned glyph atlas → ABI 5
  ├→ validated EditorProjectV2 snapshot → exact laneId/eventId range transition
  └→ CompositionResolver(60Hz absolute time + checkpoint)
       → embedded algorithm snapshots → opaque-origin Worker → validated DrawPacket
       → CompositionScene + shared program/geometry → three 2D targets + one shared-depth 3D target
       → target/composition effects
       → one VisualizerRendererHost + one Canvas/WebGLRenderer/visual RAF
       ├→ manual export lease → indexed frame times + decoded PCM → WebCodecs/Mediabunny → OPFS WebM File
       └→ native Fullscreen API on existing workspace → same Canvas + video transport
```

当前边界：Editor 数据只在进入/显式 reload 时快照；analysis 第五项在 Coordinator 前拒绝；页面音量和试听速度不影响导出音轨；不支持的编码配置明确失败。导出暂停播放并独占现有 renderer，按帧编号推进，不依赖播放时钟。直接列表换歌在改变歌曲前处理单草稿覆盖与未处理 WebM；取消保留原歌曲和工程。

场景容器、camera 求值与共享深度由 CompositionScene 管理，资源和工程保存完整配置，见[三维场景](../architecture/visualizer/scene3d.md)。

## Subsystems

| Subsystem                      | Purpose                                                                                                                                                                       | Interfaces                                                                                                                                                                                   | Owner         | Notes                                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| App shell and routing          | 组合 AppSidebar、右上角齿轮、内容容器与独立 MusicBar，并拥有 session service 生命周期                                                                                         | Vue Router、provide/inject                                                                                                                                                                   | project-owner | `createWebHistory()`；MainLayout 卸载时 dispose                                                                              |
| MusicBar and queue UI          | 文件选择、队列命令、进度、三种样式和错误消息                                                                                                                                  | AudioSessionService commands、audioSessionStore、MusicList events                                                                                                                            | project-owner | 不持有 File、AudioContext、播放 RAF 或队列事实                                                                               |
| AudioSessionService            | 元数据、runtime File/封面、竞态、ended 循环、单 RAF、工作区持久化与资源释放                                                                                                   | File/工作区输入；TrackRecord/PlaybackSnapshot/energy 输出                                                                                                                                    | project-owner | 工作区先更新内存，保存失败发布 not-persisted                                                                                 |
| AudioEngine                    | 单一 AudioContext、解码、播放、暂停、seek、变速、音量和时域数据                                                                                                               | ArrayBuffer 输入；PlaybackSnapshot/Float32Array 输出                                                                                                                                         | project-owner | AudioContext 与节点延迟创建；AudioContext 时钟为事实来源                                                                     |
| AnalysisCoordinator            | 校验 0–4 活动特征、管理 generation/job/cache identity、合并 cache hit/miss、取消/重试和精确游标请求                                                                           | AudioEngine PCM copy、module Worker、SessionRepository、Pinia snapshot                                                                                                                       | project-owner | 默认活动集为空；完整身份不匹配或旧 generation 一律丢弃                                                                       |
| Analysis Worker                | 固定 frame/hop/window 下批量提取累计 21 项特征，聚合、量化、编码并响应 exact cursor                                                                                           | typed Worker request/response、transferable PCM/ArrayBuffer                                                                                                                                  | project-owner | 每批最多 32 frame 或约 8ms yield；同帧一次 Meyda batch；Flux 复用相邻幅度频谱                                                |
| FeatureRegistry and codec      | 21 项穷尽静态契约、六类紧凑 payload 与严格二进制 decoder                                                                                                                      | `FeatureId`、`FeatureDefinition`、`StoredAnalysisCache`                                                                                                                                      | project-owner | Loudness 使用 total Float32 + 24 bands U16；Complex 使用 magnitude U16 + phase Int16；schema 保持 V1                         |
| Audio session state            | 保存队列、当前 track、播放快照、能量、analysis 与 workspace snapshot                                                                                                          | Pinia `audioSessionStore`                                                                                                                                                                    | project-owner | `$state` 可 JSON 序列化，不含浏览器资源实例或 typed-array payload                                                            |
| Session persistence            | 保存/恢复 V1 最近会话、全部句柄和唯一 current Blob/cache                                                                                                                      | 原生 IndexedDB `SessionRepository`                                                                                                                                                           | project-owner | `replaceCurrentAnalysisCache()` 校验 track/hash 并原子替换；unknown schema 不猜测迁移                                        |
| Config persistence             | 保存 volume、playbackRate、playbackMode、MusicBar style 与桌面 sidebarCollapsed                                                                                               | Pinia、localStorage key `config`                                                                                                                                                             | project-owner | sidebarCollapsed 默认 false；volume 为 0–100；playbackRate 为 0.1–2，默认 1                                                  |
| Home visualization             | 歌曲详情与共享能量 Three.js 光线背景                                                                                                                                          | store metadata、service 封面 URL、`rayLength` prop、IntersectionObserver/ResizeObserver、reduced-motion media query                                                                          | unknown       | 常规模式使用 WebGL RAF；reduced motion 只静态渲染；卸载释放 mesh、geometry、material、render list、renderer 与 WebGL context |
| Analyzer surface               | 原曲／四轨切换、单列、每来源最多四项FIFO与精确值                                                                                                                              | AudioSessionService、AnalysisCoordinator、Canvas 2D                                                                                                                                          | project-owner | 分轨仅四项，只分析当前来源，见[列表](analyzer-list.md)                                                                       |
| Editor surface                 | 标记/FT/自动标记、公共顶栏/MusicBar、独立MarkerTimeView、overlay和数字录入                                                                                                    | EditorSessionController、processing/transcription服务、共享engine/coordinator与Canvas adapter                                                                                                | project-owner | [当前接口](../architecture/editor/interface-contracts.md)，历史readiness不继承                                               |
| Editor project and draft       | strict JSON V2（显式迁移 V1）、歌曲 hash/时长绑定、原生 file gateway、单草稿 autosave 与恢复冲突                                                                              | `EditorFormatCodecRegistry`、`EditorDraftRepository`、`audionotsurfyet-editor` V1                                                                                                            | project-owner | 首版只注册 JSON；session database 不变                                                                                       |
| Visualizer composition surface | `/visualizer/:trackId?` 分组列表/共同处理参数/元素属性/工程底栏、单视口三栏或抽屉、16:9 单 Canvas、保留 MusicBar、strict Project V6 单草稿、JSON 资源库、离线 WebM 与原生全屏 | `VisualizerSessionController`、`VisualizerResourceLibrary`、`VisualizerRendererHost`、`CompositionResolver/Scene`、playback/analysis leases、Editor snapshot、WebCodecs/OPFS、Fullscreen API | project-owner | V1–V6 evidence 只绑定历史实现；当前自动化与媒体检查见组合工作区                                                              |
| Experimental charts            | 试验性的 Three.js 2D 图和瀑布流                                                                                                                                               | Vue props、TestLands                                                                                                                                                                         | unknown       | 不视为稳定接口                                                                                                               |
| Event bus                      | 跨组件事件类型与发送                                                                                                                                                          | mitt singleton                                                                                                                                                                               | unknown       | `settings-open` 无已发现订阅者                                                                                               |

## External Dependencies

| Dependency             | Why it exists                                                | Failure impact                                         | Replacement or fallback                                                                |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Browser Web Audio API  | 解码、播放和分析本地音频                                     | 核心播放与能量链路不可用                               | 未定义                                                                                 |
| WebGL / Three.js       | Home 光线、Visualizer 单 RendererHost/组合 shader 和试验图表 | Visualizer 场景进入可重试错误层，其他 WebGL 表面不可用 | Visualizer 保留 transport、工程、元素属性和草稿操作；无 2D 视觉 fallback               |
| Canvas 2D              | Analyzer 静态数据层、游标层与点阵背景                        | 单卡 renderer 可降级                                   | DOM 保留标题、参数、图例、精确值和重试语义                                             |
| localStorage           | 恢复音量和样式                                               | 配置回到默认或写入失败                                 | 未定义                                                                                 |
| IndexedDB              | 最近会话、句柄、当前 Blob/cache 的本地持久化                 | 刷新后无法自动恢复                                     | 当前页面继续使用并显示 not-persisted/restore-error                                     |
| File System Access API | 用户选择文件与显式恢复权限                                   | 无法导入或恢复非当前文件                               | 支持范围内不回退到隐藏 input；提示使用最新版 Chrome/Edge                               |
| `music-metadata`       | 解析本地音频标签与封面                                       | 元数据和封面缺失；播放能否继续需验证                   | 当前有 unknown/default cover 显示                                                      |
| Meyda                  | 从实时时域数据提取 energy，并在 Worker 提取批准的离线特征    | 音频响应可视化或分析不可用                             | Worker 错误可重试且不停止播放；`spectralFlux` 由 ADR-0005 项目实现，上游缺陷仍见 R-020 |

## Known Seams

- MusicBar 仍拥有 GSAP、跑马灯和拖动预览等纯 UI 状态；播放事实由 session store 提供。
- AudioSessionService 的 runtime registry 是 File、句柄引用与封面对象 URL 的运行时所有者；SessionRepository 是 IndexedDB 连接与记录的唯一所有者。
- AudioEngine 是当前解码 AudioBuffer 的唯一所有者；只通过 descriptor 和分块 copy 接口向协调器提供平均单声道 PCM。copy 期间 decoded revision 改变时立即丢弃旧结果。
- AnalysisCoordinator 拥有产品 Worker、generation、pending request、精确游标和 cache 合并；Worker 的 mono PCM 只保留到 track/revision/generation 失效或 dispose。
- 全 cache hit 仍以 0-feature job 把当前 PCM 交给 Worker，只为 exact cursor 保留，不重复执行 Meyda 特征提取；默认活动集为空时仍不创建 Worker。
- M6 DEV bridge `window.__AUDIO_NOT_SURF_YET_M6__` 只代理当前有效 Analyzer lease，并公开可序列化命令/状态和 exact cursor；在 Home 或 Editor 不取得/覆盖 consumer，也不暴露 File、PCM、AudioBuffer 或 Worker。
- 刷新时 current Blob 优先并恢复为 0 秒 paused；其他曲目只在 `queryPermission()` 为 granted 时自动取回，`requestPermission()` 只由可见用户操作触发。
- `--coinc-process` 既可能由 GSAP 写入，也可能由能量 RAF 写入，模式切换需明确所有权。
- AudioContext、source、单播放 RAF、产品 Worker、pending analysis request 和封面 URL 由 MainLayout-owned service/coordinator 生命周期统一释放；Analyzer 高度/说明 ResizeObserver 与待执行 RAF 在卸载时成对释放，展开卡的 Canvas/卡片 ResizeObserver 在收起时释放，GSAP 和 Three.js 由各组件释放。
- 右上角齿轮的 settings 事件没有已发现消费者；`/comingsoon` 只保留为通用占位，不再承载 Visualizer。Editor E1–E9 已获批准并关闭；E9 不改变 runtime/data ownership，Visualizer V1 也不改变该边界。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。

## Editor 基线边界

以下为 Editor 当前实现；E1–E9 历史基线及后续修订的证据身份分别保存，当前内部标记交互见[标记工作区](editor-marking.md)，E10 与 FT 接入状态见[上下文入口](index.md)。

- `/editor/:trackId?` 由 route-generation `EditorSessionController` 编排；侧边栏使用当前歌曲，播放列表“去编辑”先播放指定歌曲。
- tokenized playback lease 隔离 repeat-one；analysis consumer lease 只允许最新 token 生效。Editor 先激活原曲 `buffer` 完成 waveform/tempo，再按来源激活叠加层；同来源 Buffer 去重，分轨 Buffer 与原曲顶部波形独立，快速切换与旧 generation 以最后选择为准。
- `EditorProjectV2`、strict JSON V2 codec、V1 显式转换、原生 picker gateway 和独立 `audionotsurfyet-editor` V1 单草稿已实现；内存工程优先，quota 发布 `not-persisted`。
- `EditorTimeline` 用波形独立 `workspace.viewport` 驱动 waveform、grid、cursor 与 boundary；首次／重置为全曲，保留已有保存范围、滚轮锚点、右键 pan、seek 与快捷键，不随 BPM 自动改窗口。左侧约 280px 节拍栏与默认收起的三块 BPM 面板复用现有 tempo/Tap 算法。
- tempo map 支持 metered/single-beat、10–1200 小数 BPM、独立节拍锚点（自动识别仍为20–300）、拍号、继承式 boundary 和内部 onset/autocorrelation 估计；低置信度或 stale 结果不写入工程。
- `EditorPointWorkspace` 装配只读 `MarkerTimeView`、统一点／范围轨道和叠加层；轨道直接跟随播放快照，默认 10 秒、1–10 秒跨度，固定 15% 播放线与歌曲边界留白。动态起点不入工程，跨度按 hash 保存 preferences。行与事件只在可见范围绘制，轨道与 overlay 共享合并 RAF。
- `EditorMarkerRuler` 拥有拖动刻度带的输入与捕获生命周期，`MarkerRulerScrubber` 按即时 engine 秒数及鼠标增量合并 seek，最多一个在途请求和一个待处理位移，不创建播放时钟。原曲／分轨共用，播放状态和倍速由共享 transport 保持；外部跳转、变速、换歌、切工作区及离页清理待处理输入。
- point 命令固定微秒唯一性，使用 osu 式显式细分与居中彩色刻线、single-beat 整段一格及分类迁移／明确删除；缩放只稀疏网格，不改变吸附。轨道右键 marker 删除，空白打开 body 级 seek／播放菜单，不平移；波形继续独立 pan／菜单。
- range 命令使用微秒规范化半开 `[start,end)`；同 lane/inner class 真重叠拒绝、相邻允许，跨分类可并存。两次点击起点可跨同歌导航与播放保留，暂停后选择终点；显式取消／Esc、所属分类删除、切页签、工程身份变化与离页清理。端点 pointer／keyboard 调整及拖动回滚复用原校验。
- DEC-085 由 `KeyboardMarkerRecorder`／`useKeyboardMarkerRecording` 独立管理播放中的分类行数字键点按／按住录入；即时 engine 快照经 service 只读入口读取，跳转前取消，暂停／曲终同步收尾，最新 controller 工程合并后防抖保存。鼠标仍须暂停，暂停后可编辑整条可见轨道；左侧遮罩和15%播放线样式保留。`useMarkerEditing` 管理拖动／候选／鼠标待完成范围，`useMarkerBlocks` 管理连续时间批量，源身份变化或 seek／变速／播放取消拖动。`EditorMarkerLane` 拥有 224/160px 管理栏、36px 组标题、48px 分类行、会话折叠与确认删除，轨道列表独立滚动；波形与轨道横向滚动解耦。
- 手动定时默认收起；区间列表与 BPM 辅助栏共用现有 tempo 命令和播放快照，Tap 只在显式应用后写入；细分偏好按歌曲 hash 独立保存，JSON V2 与原 IndexedDB 结构。
- `analysisCanvasRenderer` 是 Analyzer card 与 Editor overlay 共用的纯 Canvas adapter；overlay 一次选择当前注册集合中的一项，显式接收轨道 MarkerTimeView、对齐标尺绘图区，保留 DPR backing store、40ms exact cursor 合并和原错误隔离。
- overlay 通过 Teleport 固定覆盖窗口，灰色背景、全视口 Canvas 与说明穿透到侧边栏/底层标记；只有顶栏右侧图标、临时特征菜单、重试和 top/move/bottom 手柄接收 pointer。bounds 仍为 0.10/0.35、最小 0.12，但相对 viewport；visibility 按歌曲 hash 本地保存，关闭时 active set 只保留 Buffer。

## 当前边界与历史证据

Analyzer 原曲运行态由 `activeFeatureQueue` 管理最多四项 FIFO，顶部倒序显示，原列表按 `FEATURE_IDS` 归位；四轨独立队列与所选来源由会话可选 `analysisSources` 保存，复用时间视口。V1 会话保留原曲 `activeCards`，Analyzer 工作区版本仍为 2，旧工作区及分析缓存清空规则不变。[Wallpaper Engine 风格频谱](wallpaper-spectrum.md)首位注册，立体声 DFT 与完整精度 payload 沿用唯一 Worker，Meyda 数值算法不变。

批准原文与替代关系查 [decision registry](decision-registry.md)，canonical 身份、hash 和人工门禁分别查 [Analyzer evidence](../quality/evidence-index.md)、[Editor evidence](../quality/editor/evidence-index.md) 与 [Visualizer evidence](../quality/visualizer/evidence-index.md)。当前里程碑、候选与未解决缺口见 [上下文入口](index.md)；本页维护职责和数据流，历史通过不证明当前代码已获整体 readiness 或上线授权。

## Browser Processing — Editor FT Integration

`src/processing/`提供固定四FT模型/官方ORT JSEP manifest、增量hash、native PCM OPFS staging、单分离Worker/controller、64-tap resampler、滚动overlap-add、30Hz energy/waveform与Float32 WAV。独立harness继续位于`tests/processing/`；DEC-072的生产入口位于现有Editor“音轨分离”，不新增Processor路由，尚未接P3逐拍/完整提案或处理数据工程扩展。

`EditorSeparationService`串行拥有任务、generation、缓存恢复和导出URL；`EditorStemRepository`校验原PCM、模型/runtime/config、compact metadata与全部artifact checksum后发布/恢复。会话revision只用于当前PCM复制防护，跨刷新使用原descriptor header重验完整hash。用户可配置10GiB上限、显式清理Editor结果/残留或四模型；无自动驱逐和CPU/本地模型备用路径。切工作区保留任务，确认离页/换歌取消，人工工程V1不由分离更新。

四原图已在Chrome/Edge独立harness跑通；当前Editor接入完整provisional runner 9/9，92项非浏览器与Chrome/Edge各20/20已通过，当前听感/长曲耗时按DEC-074接受。完整P1/P2 clean及原生OS等独立缺口仍保留，见[P1 evidence](../quality/processing/evidence-index.md)，当前入口验证见[Editor evidence](../quality/processing/editor-integration-evidence.md)；R-046–R-055仍Open。

## Editor 试听与有限自动标记（DEC-075）

`AudioEngine`仍是唯一AudioContext、主gain/analyser与时钟所有者。`ChunkedAudition`只拥有分轨gain、四秒buffer、八秒预调度和读取任务；FT/辅助文件由`stemAuditionSource`租约有界读取，暂停、换歌、离页和清理均等待读取释放。播放快照包含原曲/FT/辅助来源与buffering状态；准备期间后发的暂停和seek优先。

`MainLayout`提供共享`EditorProcessingGate`、`EditorSeparationService`和`EditorTranscriptionService`。FT切换/重跑/清理先释放自动标记消费者；一个处理槽位串行拥有FT或转录Worker。`src/transcription/`将模型manifest/许可、频谱与重采样、ADT_STR解码、Basic Pitch音符提取、六轨辅助OPFS输出、Worker/controller、候选与V1原子应用分别归属独立模块。session按阶段释放；六轨只保留guitar/piano，不转写FT other。

`TranscriptionRepository`使用独立`editor-transcriptions` IndexedDB与`transcription-UUID` OPFS目录，保存候选修正、逐乐器分界、辅助PCM/WAV、完整来源与校验清单。修正不重新推理；显式应用创建确定ID的新point/range轨，工程格式不变。候选来源继续在独立缓存中保存，V1工程不承载新模型字段。三个Editor页签复用原transport；Canvas预览与分页候选表由组件展示，`.app-scrollbar`归候选表所有。质量与实际验证范围见[当前记录](../quality/processing/editor-auto-marking-evidence.md)。
