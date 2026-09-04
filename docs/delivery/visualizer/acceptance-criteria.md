---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/visualizer/execution-plan.md"
next_action: "用 AC-VS01–AC-VS06 验证场景生成 Skill 与后续受控内置场景；V1–V6 历史 AC 保持已批准"
---

# Visualizer V1–V6 Acceptance Criteria

## 1. Evidence Rules

- `Pass` 必须附可重现命令、浏览器状态、真实计时/资源数据、artifact hash 或 owner 签字。
- 单一 happy path 不能代表歌曲身份、工程原子性、分析预算、确定性、录制或资源生命周期完成。
- clean canonical 必须绑定干净实现 commit；provisional 只作实现反馈。
- 原生 picker、codec 能力和最终文件回放不能完全自动化时，必须记录原因、残余风险、owner 与补偿检查。
- 阈值、preset、fixture 或浏览器矩阵变化必须先更新 delivery 文档并重新评审。

## 2. V1 — Workspace Foundation

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V101 | `/visualizer/:trackId?` 严格使用 URL/current track identity；无效或错歌目标不静默切歌，空状态保留 MusicBar | router/service integration + Chrome E2E；success/failure | R-034, R-036 |
| AC-V102 | Header 进入当前歌曲；有效 Visualizer 隐藏 MusicBar并 `pause-at-end`；离页恢复 queue-next；Editor repeat-one 不回归，只有当前 lease token 可释放 | fake-clock + route race + Editor regression；success/exception | R-034 |
| AC-V103 | `>=1280px` 使用 220px/中间/336px 三栏；1024–1279px 左右抽屉互斥；16:9 预览和底部 transport 可达 | DOMRect、computed style、keyboard；boundary | R-038 |
| AC-V104 | 新工程默认 `orthogonal-lines@1`、720p30、完整 constant bindings 和持久化 uint32 seed；V3 前明确显示中性预览 | factory unit + project UI E2E；success/boundary | R-036, R-037 |
| AC-V105 | JSON V1 canonical round-trip 保持歌曲、output、template/version、seed、bindings 与 Editor snapshot；未知字段/version/template/参数原子拒绝 | codec/validator golden；success/failure | R-036 |
| AC-V106 | 独立 `audionotsurfyet-visualizer` V1 只保存 `draft/latest`；同歌恢复、异歌导出/覆盖/取消均正确 | fake-indexeddb + refresh/navigation；success/boundary | R-036 |
| AC-V107 | 内存先更新；250ms autosave 与立即 flush 生效；quota/abort 显示 `not-persisted` 且不破坏内存或旧 durable draft | repository fault injection；failure/exception | R-036 |
| AC-V108 | V1 只有一个 Canvas/RendererHost 边界且不创建分析 Worker；route/resize/模板 identity 切换无 RAF/Canvas/listener 累积 | resource instrumentation + Chrome lifecycle；boundary | R-038 |

## 3. V2 — Data Binding

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V201 | inspector 只允许模板 descriptor 声明的 constant、analysis、editor-event source；无任意代码入口 | descriptor/validator unit + DOM inspection；failure | R-036 |
| AC-V202 | scalar、component、full、bin、band、mean、max、peak 与 FeatureRegistry shape/维度一致；越界或不相容 projection 原子拒绝 | exhaustive registry unit/golden；boundary | R-035 |
| AC-V203 | 0–4 个唯一 FeatureId 合法；共享特征只计算一次；第五项在 Coordinator 前拒绝且不改变当前工程/active set | planner unit + coordinator integration + Chrome；boundary/failure | R-035 |
| AC-V204 | 替换/删除最后引用立即释放特征；旧 generation/template/binding completion 不更新当前场景 | race/cache/stale integration；exception | R-035 |
| AC-V205 | 同歌 Editor 草稿/JSON 可形成 snapshot；错歌、损坏或悬空 lane/class 不覆盖工程；reload 只在显式动作发生 | Editor repository/codec integration + browser import；failure | R-036 |
| AC-V206 | whole lane 为 OR/max，inner class 只读对应分类；point 为 impulse，range 为半开 gate，相邻端点不双激活 | point/range golden；boundary | R-036, R-037 |
| AC-V207 | transform 严格按 normalize→clamp→invert→smoothing→output；full-vector 拒绝非零 smoothing，所有结果有限 | pure resolver unit；boundary/failure | R-037 |
| AC-V208 | 相同项目/source/绝对时间在连续播放、直接 seek、暂停、刷新后 resolved parameter hash 一致 | deterministic checkpoint golden + browser seek；success/exception | R-037 |

## 4. V3 — Orthogonal Lines

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V301 | 横线/竖线分别支持 enabled、intensity、color、CSS px thickness、brightness halo 和秒单位 decay；intensity 同时决定中心向两端长度与主线 alpha，参数只影响声明方向 | versioned scene-state golden + Chrome inspector/DPR；success/boundary | R-037 |
| AC-V302 | constant、analysis、用户选择的 main lane/inner class 均可驱动；point 先沿用 V2 120ms release、range 为 `[start,end)` gate；默认 constant 0 显示“请选择主要音色/鼓点数据源” | V3 WAV/Editor fixture + frame golden；success/boundary | R-036, R-037 |
| AC-V303 | horizontal/vertical resolved value、余辉 checkpoint 和视觉参数互不串扰；交点可加法混合但不回写状态，不按 lane/class 名称隐式绑定 | parameter isolation unit + Chrome；failure | R-036, R-037 |
| AC-V304 | 60Hz 余辉使用 `max(I,previous*exp(-4*dt/decay))`、一秒 checkpoint 和歌曲/template/binding revision identity；从 0 播放、seek、刷新、暂停单帧同时间 hash 一致，视觉响应 `<=50ms`、设置反馈 `<=100ms` | state hash + timing/PerformanceObserver E2E；success/exception | R-037 |
| AC-V305 | 单 `VisualizerRendererHost` 独占现有 Canvas、WebGLRenderer 和视觉 RAF；同帧一次 resolve；Cube 中性预览、scene error/retry、20 次模板/路由后仍保持单实例且无归因任务 `>50ms`、console/pageerror 0 | fake renderer integration + Chrome lifecycle/geometry/keyboard；failure/boundary | R-038 |

## 5. V4 — Cube Swarm

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V401 | 默认 Amplitude Spectrum full vector 驱动中心结构，Energy 驱动 riseSpeed，默认 active set 恰为两项 | registry/scene golden + coordinator probe；success | R-035, R-037 |
| AC-V402 | coreScale 只在用户选择 drum lane/class 后响应；orbitSpeed 默认 constant 且不随音频变化，也可显式改绑 | Editor/analysis fixture + state golden；success/boundary | R-036, R-037 |
| AC-V403 | seed 决定布局，rise/orbit/scale 只依赖绝对时间和 resolved values；seek/刷新/录制前视图一致 | deterministic hash/property tests；exception | R-037 |
| AC-V404 | Orthogonal/Cube 反复切换仍只有一个 Canvas、WebGLRenderer、RAF；scene geometry/material/texture 对称释放 | resource counters + 20 switches；boundary | R-038 |
| AC-V405 | context loss 保留工程/transport并在唯一 host 恢复当前时间；恢复失败不创建第二 host | synthetic context loss Chrome E2E；failure | R-039 |
| AC-V406 | 1024/1280/1920、DPR/resize 下 16:9 preview 正确，控制可键盘操作，状态不只靠颜色 | geometry/a11y E2E；boundary | R-038, R-039 |

## 6. V5 — Real-time WebM Export

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V501 | recording tap 位于 pre-Gain；页面 mute/0 volume 不影响文件音轨；任意时刻只允许一个 holder | AudioEngine integration + ffprobe amplitude；success/failure | R-040 |
| AC-V502 | capability 只按 VP9+Opus→VP8+Opus 选择；所选分辨率/fps 不支持时明确失败，不改变项目 preset 或移除音轨 | capability table + browser fault injection；boundary | R-040, R-041 |
| AC-V503 | preflight 要求正确歌曲、analysis ready、Editor snapshot、renderer、origin-clean、live tracks 与 MIME；失败不改变工程和原播放状态 | recorder state integration；failure | R-040 |
| AC-V504 | 开始顺序为 pause→seek0→render0→recorder start→play；自然 ended 后 finalize，当前歌曲保持 paused/ended且不调用 next | fake clock + Chrome/Edge E2E；success | R-034, R-040 |
| AC-V505 | recording 期间 seek、transport、template、binding、Editor reload、resolution/fps 在 UI 和命令层均返回 `recording-locked` | command/UI matrix；boundary | R-040 |
| AC-V506 | cancel、route leave、track error、MediaRecorder error 或 context loss 停止 tracks/tap、丢弃未完成 chunks，绝不进入 ready | failure injection + resource counters；exception | R-039, R-040 |
| AC-V507 | ready Blob 仅存内存；原生保存取消保留 Blob可重试，保存失败不修改工程，离页前必须保存或丢弃 | gateway integration + owner native task；failure | R-036, R-040 |
| AC-V508 | ffprobe 确认 WebM、音视频轨、codec、尺寸、fps、时长；impulse/flash A/V drift `<=100ms` | ffprobe JSON + sync analyzer；success | R-040 |
| AC-V509 | Chrome/Edge 至少成功完成默认 720p30；720p60/1080p30/1080p60 各自记录 pass 或 unavailable，不以其他预设替代 | dual-browser capability evidence；boundary | R-040, R-041 |

## 7. V6 — Final Hardening

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-V601 | 最新稳定 Chrome/Edge 均完成 MP3/WAV/FLAC、有效/无效 route、工程导入导出、恢复和 pause-at-end | dual-browser canonical + native task；success/failure | R-034, R-036 |
| AC-V602 | 1024/1280/1920 与代表性 DPR 下三栏/抽屉、16:9 preview、inspector、transport 无遮挡；键盘、焦点、文字标签和 reduced motion 正确 | geometry + accessibility matrix；boundary | R-038 |
| AC-V603 | 约 15 分钟、Amplitude Spectrum/Complex Spectrum/Buffer/Loudness 四项下设置反馈 `<=100ms`、视觉偏差 `<=50ms`、Visualizer frame `<60ms`、无归因任务 `>50ms` | runtime stress + PerformanceObserver/trace；DEC-048 | R-035, R-037, R-041 |
| AC-V604 | 20 次 route/template/song restore/record lifecycle 后 AudioContext、Worker、RAF、Canvas/WebGL、MediaStreamTrack、Observer、listener、Blob URL 不单调累积 | Chrome/Edge diagnostic counters | R-034, R-038, R-040, R-041 |
| AC-V605 | context loss、stale/cancel、quota、错歌 Editor、坏 JSON、无 MIME、录制失败和 renderer error 均保持可恢复且不伪造成功 | full failure taxonomy execution | R-035–R-041 |
| AC-V606 | V1–V6 与 M3/M6/M11/M14、Editor E1/E7 关键 lease/cache/route/resource 回归通过 | cumulative canonical | R-034–R-041 |
| AC-V607 | 每个里程碑具有已提交 eval 契约、provisional、clean canonical、run/commit/hash/environment 与 owner approval；V6 owner 完成完整制作和回放任务 | evidence audit + owner signature | R-034–R-041 |

## 8. Milestone Exit Rule

每个里程碑只能在全部适用 AC 拥有明确 success、failure、boundary 或 exception 证据、相关风险复核、clean canonical 和 owner 批准后关闭。`project-owner` 于 2026-09-02 批准本文及其余 Visualizer delivery planning，并只开放 V1；该批准不表示任何 AC 已通过。

## 9. Post-V6 Release-readiness Revision

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-VR01 | `>=1024px` 时 Visualizer、document 与 body 的纵向高度不超过 viewport；Header、toolbar、preview、recording bar 和 transport 同处一屏 | 1024×720、1280×720/900、1920×1080 DOMRect/scroll geometry；boundary | VFT-LAYOUT |
| AC-VR02 | 左模板与右参数侧栏各自滚动；滚动一侧不改变另一侧或 `window.scrollY`，到达边界后不发生 scroll chaining | 双侧 synthetic overflow + wheel/scrollTop E2E；success/exception | VFT-LAYOUT |
| AC-VR03 | Visualizer 侧栏与 Analyzer 精确值表复用 `.app-scrollbar`，Firefox 为 `thin`、WebKit 为 10px，并共享 track/thumb/hover/gutter | computed style + source contract；success/regression | VFT-LAYOUT |
| AC-VR04 | 1024 compact drawer 位于 workspace grid 内且不覆盖录制/transport；16:9、单 Canvas/renderer/RAF、键盘焦点、reduced motion、context recovery 和 console/pageerror 不回归 | Chrome/Edge targeted regression；boundary/exception | R-038 |

AC-VR01–AC-VR04 已在 clean implementation commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 的 Chrome/Edge 专项中通过；V1 双浏览器、V6 integration 与 Analyzer M7 相邻回归也通过。它们仍需 owner 视觉确认后才可形成 Visualizer readiness 结论。

## 10. Controlled Scene Extension

| ID | Criterion | Coverage and verification | Risk |
| --- | --- | --- | --- |
| AC-VS01 | 不完整自然语言请求稳定返回 `INPUT_INCOMPLETE` 与逐字段缺失项，且不会产生 tracked/untracked 仓库变化 | validator unit + clean status dry run；failure | R-043 |
| AC-VS02 | 完整 brief 补齐 FeatureId/component/projection/transform、参数范围/default binding、seed/time、资源预算、golden 与测试计划后进入 `AWAITING_APPROVAL`；批准前不写代码 | contract review dry run；boundary | R-043 |
| AC-VS03 | 获批场景只扩展现有 template union、strict V1 whitelist、SceneRegistry、纯状态解析器和 renderer；默认模板、JSON version 与公共 scene 接口不变 | source/codec/registry integration；success | R-036, R-043 |
| AC-VS04 | 默认分析特征最少化且不超过两个，三至四项有合同理由，四项硬上限；Editor 来源不猜测，参数错误使用 descriptor default 并保留 inspector 错误 | descriptor/planner/resolver unit；failure/boundary | R-035, R-043 |
| AC-VS05 | seed、绝对时间、固定 60Hz/checkpoint 与 `1e-6` 量化 hash 保证同时间确定性；共享资源、context、录制尺寸与幂等 dispose 不回归 | scene golden + 20-switch integration + resource/context probes；exception | R-037–R-041, R-043 |
| AC-VS06 | 每个场景同时生成 unit、integration、Chrome/Edge 与 V1/V2/V5/V6 针对性回归；无法执行的浏览器项保持 `unverified`，新场景不自动获得 canonical/readiness | test matrix audit + owner readiness review；success/exception | R-043 |
