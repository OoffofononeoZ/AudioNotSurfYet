---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/context/index.md"
next_action: "按 ADR-0011 修订 E7 全屏 fixed overlay，并产生新的 46 步 canonical"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService`、`AnalysisCoordinator` 与 `EditorSessionController`；服务通过 `AudioEngine` 解码、播放本地文件，并通过两个独立 IndexedDB repository 保存 Analyzer session 与 Editor 单草稿。Analyzer 和 Editor 通过互斥 consumer lease 复用同一 coordinator；Editor consumer 先激活 Buffer，再按 E4 选择激活最多一个 overlay feature，仍不创建第二个 Worker 或 PCM 副本。File、Blob、handle、PCM、Worker 与音频节点均留在 store 外。MusicBar 和 Editor 读取同一播放快照；有效 Editor track 隐藏 MusicBar，并由 tokenized playback lease 把 ended 策略改为 repeat-one。

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
| Analyzer surface | 四槽/最多四张累计 21 项可用卡、共享 viewport/zoom/cursor/seek、DOM 精确值与分层 Canvas | store、AudioSessionService、AnalysisCoordinator、Canvas 2D | project-owner | 稳定 slot 0–3 DOM；实际高度最短列布局，390/1024 一列、1280/1920 两列、gap 18px；ResizeObserver 以单 RAF 合并重排；首次仍默认 M7 三卡 |
| Editor E1–E7 surface | `/editor/:trackId?` 状态、精简 transport、JSON 工程、共享波形/tempo/point/range 时间列、21 项单选半透明 overlay、viewport-visible marker 与紧凑工作台布局 | EditorSessionController、AudioSessionService、AnalysisCoordinator、Vue Router、shared Canvas renderer、DOM controls | project-owner | E1–E6 已实现并获批准；E7 已实现且 canonical in-review |
| Editor project and draft | strict JSON V1、歌曲 hash/时长绑定、原生 file gateway、单草稿 autosave 与恢复冲突 | `EditorFormatCodecRegistry`、`EditorDraftRepository`、`audionotsurfyet-editor` V1 | project-owner | 首版只注册 JSON；session database 不变 |
| Experimental charts | 试验性的 Three.js 2D 图和瀑布流 | Vue props、TestLands | unknown | 不视为稳定接口 |
| Event bus | 跨组件事件类型与发送 | mitt singleton | unknown | `settings-open` 无已发现订阅者 |

## External Dependencies

| Dependency | Why it exists | Failure impact | Replacement or fallback |
| --- | --- | --- | --- |
| Browser Web Audio API | 解码、播放和分析本地音频 | 核心播放与能量链路不可用 | 未定义 |
| WebGL / Three.js | Home 光线和试验图表 | 部分可视化不可用 | 未定义 |
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
- AudioContext、source、单播放 RAF、产品 Worker、pending analysis request 和封面 URL 由 MainLayout-owned service/coordinator 生命周期统一释放；Analyzer masonry 的容器/四 item ResizeObserver 与待执行 RAF 在卸载时成对释放，GSAP 和 Three.js 由各组件释放，LightBg 在 reduced motion 下不保留连续 RAF。
- Header 的 settings 事件没有已发现消费者；Visualizer 仍为占位页。Editor E1–E6 已获批准；E7 已把工作台密度与分区实现为当前代码事实，但不改变 runtime/data ownership，owner 批准仍待完成。
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

尚未完成：E7 全屏浮层修订、46 步双浏览器 canonical，以及 owner 对紧凑工作台、窗口级浮层、长会话可读性和辅助技术体感的人工复核。原 44/44 run 只作 pre-revision；E6 历史身份保持不变。

## Approval Record

`project-owner` 于 2026-08-21 确认 M7 卡片、共享视口、跳转、刷新恢复和 3/3 学习解释通过，并批准 M7 canonical、关闭 M7、开放 M8。随后 M8–M11 与 Analyzer readiness 依次完成并获批。2026-08-26，owner 又依次批准 Editor 产品、架构、delivery 与 E1 canonical/人工结果。2026-08-27，E2–E5 clean canonical 与人工门禁依次获 owner 批准；2026-08-28，E6 clean canonical 40/40 与人工补偿获批准，随后开放 E7 紧凑工作台。

同日，owner 要求自行提交并完成 M12 后续。M12 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 在 clean commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上 12/12 通过，稳定 DOM、实际高度最短列与 Observer/RAF 生命周期成为当前系统事实；M12 已关闭且 Analyzer readiness 恢复，PROD-015 与 Editor E6 不受该批准覆盖。

随后 Editor E7 紧凑工作台实现已提交，并由 clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 在 commit `78bc7f06311a09948e5efae941a14599305b81a5` 上 44/44 验证。双层工具栏、平面 section、44px 标记行、176/144px 波形及 390–1920 响应式现为当前系统事实；evidence 与里程碑仍等待 owner 批准。
