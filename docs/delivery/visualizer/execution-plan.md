---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/visualizer/project-format-v1.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
  - "docs/architecture/visualizer/recording-contract.md"
next_action: "V1–V6 已全部关闭；进入独立 Visualizer release-readiness review"
---

# Visualizer V1–V6 Execution Plan

## 1. Delivery Outcome

把已批准的 Visualizer V0 架构按六个可独立验证的纵向里程碑交付：先建立当前歌曲工作台和本地工程，再接入 Analyzer/Editor 绑定，随后分别交付两个内置场景、实时 WebM 录制和双浏览器最终加固。

Visualizer V1–V4 的工作台、数据绑定与两个场景均已通过各自 clean canonical 和 owner 门禁。V5 realtime WebM 的 40/40 clean canonical 与人工门禁于 2026-09-03 获 owner 批准并关闭；V6 final hardening 也已在 2026-09-04 获批准并关闭。

V6 已实现版本化 hardening golden、当前歌曲会话内的双模板 binding 精确恢复、renderer 歌曲/帧时间诊断、测试专用资源探针，以及共享 Chrome/Edge 三格式、900 秒压力、六文件媒体和 20 次生命周期专项。按 DEC-048 修订后的 clean canonical `V6-2026-09-03T16-33-03-497Z-ef12ce39` 在 implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` 上 54/54 通过，summary SHA-256 为 `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014`；owner 已批准人工门禁与 evidence，V6 无需重跑。

## 2. Delivery Principles

- 每个 V1–V6 里程碑都按“先提交 quality/eval 契约 → 实现与专项测试 → dirty provisional → 实现提交 → clean canonical → evidence 登记 → owner 审批”关闭。
- 前一里程碑未获 owner 批准时，下一里程碑保持 `Planned`；不得并行实现后续场景或录制来绕过门禁。
- 一个页面始终只有一个 AudioEngine、AudioContext、播放时钟、AnalysisCoordinator、产品 Worker、Canvas、WebGLRenderer 和场景 RAF。
- 内存状态先更新；分析、草稿、renderer 或录制失败必须保留仍可用的工程、transport 与导出能力。
- `/comingsoon` 不增加兼容重定向。V1 直接把 Header Visualizer 入口迁移到 `/visualizer/:trackId?`，当前占位路由可继续服务其他未定义入口，但不代表 Visualizer fallback。
- V1–V4 使用真实 Chrome 专项并保留 Edge 相邻回归；V5 使用真实 Chrome/Edge 验证录制；V6 在两浏览器执行 V1–V6 全量和 Analyzer/Editor 关键回归。

## 3. Fixed Delivery Parameters

| Area | Fixed value | Change rule |
| --- | --- | --- |
| Default template | `orthogonal-lines@1` | V3 前只显示明确的中性预览，不伪装场景效果已完成 |
| Default output | `720p`, `30fps`, `16:9` | 用户可改为四个批准预设；不支持时明确失败，不静默降级 |
| Project seed | 新工程生成 `uint32` 并持久化 | 刷新、seek、播放与录制不得重新随机 |
| Draft database | `audionotsurfyet-visualizer` V1，`draft/latest` | 与 Analyzer session、Editor draft 隔离，只保存一个最新工程 |
| Autosave | `250ms` debounce | 模板/绑定/输出确认、导入成功和 route leave 立即 flush |
| Desktop layout | `>=1280px` 为 `220px / minmax(0,1fr) / 336px` | 左模板、中预览、右 inspector，transport 位于底部 |
| Compact desktop | `1024–1279px` 中央预览常驻，左右抽屉互斥 | 抽屉必须可键盘打开/关闭，不改变 16:9 输出身份 |
| Analysis budget | 0–4 个唯一 `FeatureId` | constant/Editor 不计数；第五项在 Coordinator 前拒绝 |
| Recording presets | 720p/1080p × 30/60fps | VP9+Opus → VP8+Opus 只回退 codec，不改变预设 |
| Performance | feedback `<=100ms`、visual offset `<=50ms`、A/V drift `<=100ms` | 不得以减少数据事实、跳过音轨或降低预设通过 |
| Capacity | 约 15 分钟、四个高维分析特征 | V6 固定 Amplitude Spectrum、Complex Spectrum、Buffer、Loudness |

## 4. Milestone Slices

### V1 — Workspace Foundation

Implementation:

- 新增 `/visualizer/:trackId?`。Header 使用当前歌曲进入；未知、不可恢复或错歌目标显示空状态并保留 MusicBar，不静默选择其他歌曲。
- 把 Editor 专用 playback lease 原子迁移为通用 `RoutePlaybackLease`：Editor 保持 `repeat-one`，Visualizer 使用 `pause-at-end`；旧 token 不能释放新 route。
- 有效 Visualizer track 隐藏 MusicBar；页面内提供播放/暂停、时间和 seek。自然结束停在当前歌曲，不循环、不调用 `next()`。
- 建立 Webflow 式工作台：左模板列表、中间固定 16:9 预览、右参数入口、底部 transport；1024 宽度使用互斥抽屉，1280/1920 常驻三栏。
- 建立 `src/visualizer/` 领域、模板 descriptor、单 Canvas/RendererHost 边界和中性预览。V1 可选择两个模板身份，但不提前实现 V3/V4 的视觉效果或动态绑定。
- 实现 `VisualizerProjectV1` factory/strict codec、唯一 JSON format registry、原生导入导出、独立单草稿 IndexedDB、250ms autosave、同歌恢复和异歌“导出/覆盖/取消”。
- 新工程固定 `orthogonal-lines@1`、720p30、随机持久化 seed、完整 constant bindings；未知字段、错歌、未知模板/version 或不完整参数原子拒绝。

Exit gate:

- 路由 identity、pause-at-end、Editor repeat-one 回归、旧 token、MusicBar 显隐和单 engine/clock 通过。
- JSON canonical round-trip、strict failure、quota/abort、刷新、同歌恢复、异歌三选项和导入失败隔离通过。
- 1024/1280/1920、DPR、抽屉、16:9 Canvas、transport 键盘和中性预览通过。

### V2 — Data Binding

Implementation:

- 实现 constant、analysis、editor-event 绑定和模板参数 inspector；不允许任意表达式、Vue、JavaScript 或 shader。
- 实现 scalar/full/bin/band/mean/max/peak projection、component 校验和固定 transform 顺序；full-vector 禁止非零 smoothing。
- `VisualizerBindingPlanner` 按稳定 `FEATURE_IDS` 去重 0–4 项；第五项不修改工程或 active set，也不调用 Coordinator。
- Visualizer analysis consumer 复用 compact series/cache，按绝对歌曲时间采样；替换最后一个引用立即释放特征，旧 generation/template/binding revision 丢弃。
- 读取同歌 Editor 草稿或导入同歌 Editor JSON，形成工程 snapshot；不实时监听 Editor DB，也不猜测“主要音色”或“drum”名称。
- point 输出 impulse、range 按 `[start,end)` 输出 gate；whole lane 按 OR/max 聚合。attack/release 使用可重放 checkpoint，直接 seek 与从 0 连续播放一致。

Exit gate:

- 0–4、重复共享、第五项拒绝和最后引用释放均在 Worker 前可证实。
- 所有 FeatureRegistry shape/projection、Editor point/range、错歌/坏引用、stale/cancel/cache hit/miss 与 quota 路径通过。
- 相同工程、source 和绝对时间在播放、seek、刷新后得到相同 resolved parameter hash。

### V3 — Orthogonal Lines

Implementation:

- 在现有 16:9 Canvas 上建立唯一 `VisualizerRendererHost`，独占一个 Three.js `WebGLRenderer` 和一个可取消视觉 RAF；DPR 上限为 2，播放连续绘制，暂停/seek/参数/resize 只请求单帧。
- `SceneRegistry` descriptor 增加 scene factory；scene 接口固定 `render({ timeSeconds, values, bindingRevision })`、`resize(width,height,dpr)`、`dispose()`。父级同帧只调用一次 resolver，并把同一 resolved map 提供给 scene 和 inspector。
- Orthogonal Lines 使用单全屏 quad/shader，在 `#020403` 背景中心绘制正交横线/竖线；scene 只消费解析值，不读取 store、Worker、Editor DB 或音频节点。
- intensity 规范到 0–1，并同时控制中心向两侧的长度和主线 alpha；thickness 为 CSS px，brightness >1 增强 halo，enabled=false 完全隐藏，横竖状态互不串扰。
- `horizontalDecay`/`verticalDecay` 保持 JSON V1 现有字段并以秒为单位；V2 point 默认 120ms release 后进入 60Hz 确定性余辉，range 先按 `[start,end)` gate，再按 decay 衰减。
- scene 余辉使用一秒 checkpoint，按歌曲/template/binding revision 隔离；seek、刷新和暂停单帧从 checkpoint 重放，禁止 RAF delta。
- 新工程 intensity 继续 constant 0，并显示“请选择主要音色/鼓点数据源”；不按 lane/class 名称隐式绑定。
- V3 canonical 阶段切换到 Cube Swarm 时以中性预览验证 Orthogonal Lines disposal 和单 host/renderer/Canvas；V4 实现后，前向回归改为切换真实 Cube scene。scene 异常仍进入可重试错误层，transport、模板、工程和草稿保持可用。

Exit gate:

- 横线/竖线绑定互不串扰；main/inner class、point/range/constant 和未绑定状态均有 golden。
- 从 0 播放、直接 seek、刷新和暂停单帧在同一时间的 frame-state hash 一致，播放到可见线条响应 `<=50ms`，设置反馈 `<=100ms`。
- 20 次 template/route 循环保持单 Canvas、RendererHost、WebGLRenderer 和视觉 RAF；无 Visualizer 归因主线程任务 `>50ms`，console/pageerror 为 0。
- template switch、dispose、错误隔离/重试、1024/1280/1920、DPR/resize、键盘 inspector 与 reduced motion 通过。

Closed candidate（2026-09-03）：上述实现位于 commit `89be30eb23d4e53d2c38f24e111cd1af7ec0840d`；dirty provisional 与 clean canonical 均为 30/30，clean run 为 `V3-2026-09-02T13-32-42-513Z-89be30eb`。`project-owner` 已批准 canonical evidence、Orthogonal Lines、确定性余辉与单 RendererHost，V3 据此为 `Complete` 并开放 V4。

### V4 — Cube Swarm

Implementation:

- 中心频谱结构默认绑定 Amplitude Spectrum full vector；`riseSpeed` 默认绑定 Energy。
- `coreScale` 推荐由用户选择 drum main lane；三个卫星 `orbitSpeed` 默认 constant，也可改绑。
- 数量、颜色、基础尺寸、相机距离和背景保持 constant；默认分析集合只有 Amplitude Spectrum 与 Energy。
- 粒子布局、rise 和 orbit 使用 seed + 绝对时间或确定性 checkpoint，不累计 RAF delta。
- 模板切换对称 dispose scene/camera/geometry/material；WebGL context restore 在唯一 host 中重建并按当前绝对时间绘制。

Exit gate:

- 频谱、drum、Energy 和 constant orbit 分别只影响批准参数；默认分析预算为 2。
- seek/刷新/连续播放状态一致，模板反复切换无第二 Canvas/renderer/RAF 或 geometry/material 累积。
- Chrome context loss/recovery、renderer fatal error、DPR/resize 和 1024/1280/1920 通过。

Canonical（2026-09-03）：核心实现位于 commit `9581730498a470e3fbd81c97414cb26087714009`；用于 canonical 的实现/测试 commit 为 `5c2d24a3f1f413dba236563b3686237c6b8f2e21`。clean run `V4-2026-09-02T17-47-40-271Z-5c2d24a3` 为 34/34，summary SHA-256 为 `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2`。owner 已批准该 evidence 并关闭 V4；R-039 保持 `Open`，由 V5 录制 context 路径继续验证。

### V5 — Real-time WebM Export

Implementation:

- AudioEngine 增加唯一 pre-Gain recording tap；页面 mute/volume 不改变录制音轨，第二 holder 返回 typed busy error。
- 录制合并唯一 Canvas `captureStream(fps)` 和 live audio track，MIME 只按 VP9+Opus → VP8+Opus 选择。
- 实现 `idle → preparing → recording → finalizing → ready/error`；preflight 要求歌曲、全部 analysis、Editor snapshot、renderer、origin-clean、tracks、MIME 和 preset 就绪。
- 开始顺序固定为 pause、seek 0、render 0、start recorder、play；自然 ended finalize，Visualizer 不调用 next。
- 录制期间命令层锁定 seek、play/pause、template、binding、Editor reload、resolution 和 fps。
- 完成 Blob 仅在内存保留并通过原生 picker 保存；保存取消可重试，录制取消/离页/context loss/track error 丢弃未完成结果。

Exit gate:

- Chrome/Edge 至少都能生成默认 720p30 有声 WebM；其余预设分别记录成功或明确 unavailable，不外推。
- ffprobe 验证 WebM、音轨、视频轨、codec、尺寸、fps、时长；impulse/flash 音画漂移不超过 100ms。
- 页面 0 音量仍有正常录制音轨；取消、busy、无 MIME、track ended、context loss、保存取消与失败重试通过。

### V6 — Final Hardening

Implementation and verification:

- 真实 Chrome/Edge 覆盖本地 MP3/WAV/FLAC、当前歌曲、空状态、工程原生导入导出、同歌恢复、错歌拒绝和返回普通队列。
- 使用约 15 分钟输入和 Amplitude Spectrum、Complex Spectrum、Buffer、Loudness 四项高维绑定，覆盖两个模板和录制预检。
- 覆盖 1024/1280/1920、代表性 DPR、键盘、焦点、非纯颜色状态、reduced motion、context loss 和原生录制回放。
- 20 次 Visualizer/Analyzer/Editor/Home、模板、恢复和录制 lifecycle 后检查 AudioContext、Worker、RAF、Canvas/WebGL、MediaStreamTrack、Observer、listener、Blob URL。
- 执行 V1–V6 全量及 M3/M6/M11/M14、Editor E1/E7 关键 runtime/lease/cache/route 回归。

Exit gate:

- 设置/控制反馈不超过 100ms；播放到视觉响应偏差不超过 50ms；A/V 漂移不超过 100ms；无 Visualizer/分析归因任务超过 50ms。
- 三格式、双浏览器、四特征、两个场景、WebM、恢复、故障隔离、无障碍与资源均有 success/failure/boundary/exception 证据。
- owner 完成从当前歌曲、Editor 数据、四特征绑定到 WebM 保存/回放的完整制作任务并批准 canonical 后，才进入整体 release-readiness。

## 5. Commands and Evidence Cadence

每个里程碑计划提供：

```text
npm run test:vN:unit
npm run test:vN:integration
npm run test:e2e:vN
npm run eval:vN:provisional
npm run eval:vN
```

其中 `N` 为 1–6。V5 另提供 Chrome/Edge 分命令，V6 固定双浏览器全量命令。quality/eval 契约必须在实现前提交；canonical 拒绝 dirty worktree，并记录 run ID、实现 commit、Chrome/Edge/Node/npm/Meyda/FFmpeg 环境、步骤、日志和 summary SHA-256。

## 6. Change Control and Exclusions

- 麦克风、远端音频、多模板叠加、自由图层、外部代码/插件、独立 Analyzer 数据包、MP4、离线倍速渲染、后台录制保证、云同步和超过四个唯一分析特征继续排除。
- 取消四特征上限、增加模板/工程格式、改变 JSON schema、引入第二 renderer/Worker/AudioContext 或改变 recording topology 必须回到 product/system design review。
- 验收阈值、浏览器矩阵、preset 或 fixture identity 变化时，本 delivery planning 与下游 quality/evidence 待复核。
- 当前没有正式 CI；所有 canonical 声明限定为已登记本地环境。

## 7. Approval Gate

本计划与同目录 acceptance criteria、test strategy、milestone plan 已由 owner 批准。V0-D、V1–V6 均为 `Complete`。

批准记录（2026-09-02）：

`我批准 Visualizer V1–V6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 V1。`

V2 evidence 批准与 V3 开放原文（2026-09-02）：`使用项目相关技能执行此计划`。本原文按随附计划执行，不补写用户未提供的逐项人工观察值。
