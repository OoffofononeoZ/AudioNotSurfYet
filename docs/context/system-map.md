---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/context/index.md"
next_action: "Editor E8 已关闭；Visualizer V5 recorder 继续等待独立 owner 门禁"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService`、`AnalysisCoordinator`、`EditorSessionController` 与 `VisualizerSessionController`；服务通过 `AudioEngine` 解码、播放本地文件，并通过三个独立 IndexedDB repository 保存 Analyzer session、Editor 单草稿与 Visualizer 单草稿。Analyzer、Editor 与 Visualizer 已通过互斥 consumer lease 复用同一 coordinator；Visualizer 只把稳定去重后的 0–4 项送入现有 Worker/cache。File、Blob、handle、PCM、Worker 与音频节点均留在 store 外。MusicBar、Editor 与 Visualizer 读取同一播放快照；有效 Editor/Visualizer track 隐藏 MusicBar，通用 tokenized route lease 分别把 ended 策略改为 repeat-one 或 pause-at-end。

Visualizer V1 已实现 `/visualizer/:trackId?`、通用 route playback lease、三栏/抽屉工作台、strict JSON V1、独立 single-draft repository、原生 JSON gateway 和一个 16:9 Canvas。V2 已实现并获批唯一 analysis consumer、constant/analysis/editor-event inspector、FeatureRegistry projection、同歌 Editor snapshot、0–4 planner 与 60Hz 绝对时间 resolver。V3 已由单一 `VisualizerRendererHost` 接管现有 Canvas，并实现 Orthogonal Lines shader、确定性 scene-local decay、共享 resolved map 与可重试错误层；30 步 clean canonical 与人工验收已获 owner 批准。V4 已用真实 Cube Swarm 替换中性场景，增加默认 Spectrum/Energy、确定性 rise/orbit、context recovery 与通用诊断别名；34 步 clean canonical 与 owner 门禁已通过。V5 已实现唯一 pre-Gain recording tap、同 Canvas capture lease、MediaRecorder 状态机和原生保存 gateway，40 步 clean canonical 为 `in-review`。Editor E8 的不可用恢复、`88px/72px` 时间轴与 point marker 中心修正已通过 25 步 clean canonical 和 owner 门禁。

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
       └→ captureStream + AudioEngine pre-Gain tap → MediaRecorder → WebM Blob [V5 in-review]
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
| Analyzer surface | 固定展示 21 张折叠卡、最多四项 FIFO 活动分析、共享 viewport/zoom/cursor/seek、DOM 精确值与分层 Canvas | store、AudioSessionService、AnalysisCoordinator、Canvas 2D | project-owner | `FEATURE_IDS` 稳定 DOM 顺序；实际高度最短列布局，390/1024 一列、1280/1920 两列、gap 18px；展开才挂载图表资源，默认活动队列为空 |
| Editor E1–E8 surface | `/editor/:trackId?` 状态、精简 transport、JSON 工程、共享波形/tempo/point/range 时间列、21 项 overlay、`88px/72px` 波形、不可用恢复决策与中心对齐 marker | EditorSessionController、AudioSessionService、AnalysisCoordinator、Vue Router、shared Canvas renderer、DOM controls | project-owner | E1–E8 已关闭；E8 canonical 与 owner 门禁已批准 |
| Editor project and draft | strict JSON V1、歌曲 hash/时长绑定、原生 file gateway、单草稿 autosave 与恢复冲突 | `EditorFormatCodecRegistry`、`EditorDraftRepository`、`audionotsurfyet-editor` V1 | project-owner | 首版只注册 JSON；session database 不变 |
| Visualizer V1–V5 surface | `/visualizer/:trackId?` 三栏/互斥抽屉、16:9 单 Canvas、底部 transport、strict project/单草稿、两个确定性 scene、recording 状态栏与 WebM 保存 | `VisualizerSessionController`、`VisualizerRendererHost`、`SceneRegistry`、`RoutePlaybackLease`、`AnalysisConsumerLease`、BindingPlanner/Resolver、Editor snapshot、MediaRecorder | project-owner | V1–V4 已批准；V5 40/40 canonical 为 `in-review` |
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
- Header 的 settings 事件没有已发现消费者；`/comingsoon` 只保留为通用占位，不再承载 Visualizer。Editor E1–E8 已获批准并关闭；E8 不改变 runtime/data ownership，Visualizer V1 也不改变该边界。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。

## Editor Boundary After E5

已实现事实：

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

E7 修订版 46/46 canonical 已由 owner 于 2026-08-31 批准并关闭；原 44/44 run 只作 pre-revision，E6 历史身份保持不变。M13 不重开 Editor 里程碑。

E8 当前实现把波形 stage 缩为桌面 `88px`/窄屏 `72px`，以 6px 安全区计算垂直振幅；`Editor.vue` 通过纯恢复决策在同一 URL 歌曲恢复后合并重试，另一首歌曲只提供显式 replace 入口；point marker 的菱形和引线分离并以事件 X/Y 中心定位。JSON V1、Editor IndexedDB、AudioEngine 与 AudioSessionService 严格身份规则均不变。clean canonical 25/25 与 owner 门禁已批准。

## Approval Record

`project-owner` 于 2026-08-21 确认 M7 卡片、共享视口、跳转、刷新恢复和 3/3 学习解释通过，并批准 M7 canonical、关闭 M7、开放 M8。随后 M8–M11 与 Analyzer readiness 依次完成并获批。2026-08-26，owner 又依次批准 Editor 产品、架构、delivery 与 E1 canonical/人工结果。2026-08-27，E2–E5 clean canonical 与人工门禁依次获 owner 批准；2026-08-28，E6 clean canonical 40/40 与人工补偿获批准，随后开放 E7 紧凑工作台。

2026-09-03，owner 以 E8 完整实施指令批准 ADR-0018、E8 delivery/quality 计划并开放实现。E8 在 Visualizer V5 尚未提交时先形成 scoped/provisional 结果；V5 独立提交后，owner 明确允许单独提交 E8 并运行 clean canonical。implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 与 25/25 canonical 通过，owner 随后批准 evidence 与人工门禁；E8 为 `Complete`，相关风险为 `Mitigated`。

同日，owner 要求自行提交并完成 M12 后续。M12 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 在 clean commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上 12/12 通过，稳定 DOM、实际高度最短列与 Observer/RAF 生命周期成为当前系统事实；M12 已关闭且 Analyzer readiness 恢复，PROD-015 与 Editor E6 不受该批准覆盖。

随后 Editor E7 紧凑工作台实现已提交，并由 clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 在 commit `78bc7f06311a09948e5efae941a14599305b81a5` 上 44/44 验证；ADR-0011 修订后该 run 保留为 `pre-revision`，不再代表正式候选。

2026-08-29，全屏 fixed overlay、窗口级复合入口、21 项临时菜单、按歌曲 visibility 与关闭后的 Buffer-only active set 在 commit `080f577fe20fcb22a20184dce0b15892c5299464` 上完成。修订版 clean canonical `E7-2026-08-29T05-23-03-986Z-080f577f` 46/46 通过，summary SHA-256 为 `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5`；owner 于 2026-08-31 批准并关闭 E7，不补写未提供的人工测量。

2026-08-31，owner 批准 M13 产品、ADR-0012、delivery 与 quality 计划并要求完整实施。Analyzer runtime 已改为 `activeFeatureQueue`，按 `FEATURE_IDS` 固定渲染 21 张卡，展开时才挂载图表资源；V1 `activeCards` 仅作为兼容 carrier。clean canonical `M13-2026-08-31T17-44-39-680Z-63c04005` 17/17 通过，当前实现身份为 commit `63c04005670145d83ee181d474197bce921c5300`。

2026-09-01，owner 批准并完成 M14：runtime 增加独立 `featureOrder`，Analyzer 以 pointer/click/keyboard 改变 feature-keyed DOM 与 masonry 输入，V1 增加可选顺序字段；排序不触发 Coordinator 或改变 FIFO。clean canonical `M14-2026-09-01T02-36-49-995Z-0e991307` 19/19 通过，以上为当前代码与证据事实。
