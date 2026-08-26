---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/context/index.md"
next_action: "保持当前代码事实；按已批准 delivery 实施 E1 runtime 与工程基础"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService` 与 `AnalysisCoordinator`；服务通过 `AudioEngine` 解码、播放本地文件，并通过 `SessionRepository` 保存最近队列、文件句柄、当前 Blob、当前分析缓存和 Analyzer 工作区。协调器只在存在活动特征时复制当前解码 PCM、启动 module Worker，并把可序列化进度、series identity、实际 sample rate 与 cache 状态写入 `audioSessionStore`。File、Blob、handle、PCM、Worker 与音频节点均留在 store 外。MusicBar 和 Analyzer 读取同一播放快照；Analyzer 固定四槽、首次默认 M7 三卡，可从累计 21 项中选择最多四张唯一卡并复用共享 viewport/cursor。

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
| Analyzer surface | 四槽/最多四张累计 21 项可用卡、共享 viewport/zoom/cursor/seek、DOM 精确值与分层 Canvas | store、AudioSessionService、AnalysisCoordinator、Canvas 2D | project-owner | 首次仍默认 M7 三卡；已保存空工作区保持为空；Loudness 与 Complex 使用结构化双 Canvas |
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
- M6 DEV bridge `window.__AUDIO_NOT_SURF_YET_M6__` 只公开可序列化命令/状态和 exact cursor 返回值，不暴露 File、PCM、AudioBuffer 或 Worker。
- 刷新时 current Blob 优先并恢复为 0 秒 paused；其他曲目只在 `queryPermission()` 为 granted 时自动取回，`requestPermission()` 只由可见用户操作触发。
- `--coinc-process` 既可能由 GSAP 写入，也可能由能量 RAF 写入，模式切换需明确所有权。
- AudioContext、source、单播放 RAF、产品 Worker、pending analysis request 和封面 URL 由 MainLayout-owned service/coordinator 生命周期统一释放；Observer、GSAP 和 Three.js 由各组件释放，LightBg 在 reduced motion 下不保留连续 RAF。
- Header 的 settings 事件没有已发现消费者，导航中的 Visualizer/Editor 共享占位页。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。

## Editor Target Seams（not implemented）

以下内容来自已批准架构，不是当前源码事实：

- `/editor/:trackId?` 将由 route-scoped `EditorSessionController` 使用现有 AudioSessionService/AnalysisCoordinator；当前 `/comingsoon` 路由与播放列表加号尚未改变。
- tokenized playback/analysis lease 将隔离 repeat-one 与活动 feature；当前 service/coordinator 尚未提供这些接口。
- `EditorProjectV1`、`EditorFormatCodecRegistry` 和独立 `audionotsurfyet-editor` IndexedDB V1 尚未实现，不得写成当前持久化能力。
- EditorTimelineModel、point/range 状态机、tempo estimate 和 pointer-through renderer adapter 尚未实现；Analyzer 的现有 MeydaCard/viewport 只是可复用基础。

## Approval Record

`project-owner` 于 2026-08-21 确认 M7 卡片、共享视口、跳转、刷新恢复和 3/3 学习解释通过，并批准 M7 canonical、关闭 M7、开放 M8。随后 M8 运行时与 clean canonical 已完成，本图同步累计 16 项事实；owner 又批准 M8 canonical 与 Windows Chrome 界面稳定化结果并明确要求实施 M9。2026-08-23，owner 批准 M9 canonical 与非首页导航栏模糊效果，并明确要求实施 M10；本图随后同步 M10 累计 21 项代码事实及 36/36 clean canonical。2026-08-25，owner 批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；M10 改为 `Complete`。同日 owner 确认 Edge 已安装并要求开始最终加固。M11 clean Chrome/Edge canonical 随后 38/38 通过；2026-08-26，owner 又批准该 canonical、Edge 原生权限与最终加固结果，M11 据此为 `Complete`。同日 owner 批准 Editor E0 产品意图并开放 system design，随后明确批准 Editor E0 系统设计、接口契约、风险与 ADR，并开放 E1–E6 execution planning；本图仅新增明确标注的 target seams，当前运行时仍是 Analyzer 候选，Editor 尚未实现。
