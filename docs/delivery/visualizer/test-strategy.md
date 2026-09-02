---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
next_action: "V3 30 步 canonical 已获批准；建立 V4 四专项与 34 步 canonical"
---

# Visualizer V1–V6 Test Strategy

## 1. Objectives

测试体系必须回答：

1. Visualizer 是否始终使用正确歌曲、唯一播放时钟和正确 ended policy？
2. strict project、single draft、Editor snapshot 和 binding 是否在失败时保持原子？
3. 0–4 特征、projection、stale/cancel 和确定性 resolver 是否不扩大 Worker/cache？
4. 两个场景是否在相同绝对时间得到相同状态并正确释放 WebGL 资源？
5. WebM 是否包含正确画面、原歌曲音轨、严格 preset 和可验证同步？
6. 双浏览器、15 分钟四特征和 20 次生命周期是否满足性能、资源与无障碍门禁？

## 2. Coverage by Milestone

| Milestone | Success | Failure | Boundary / exception | Primary environments |
| --- | --- | --- | --- | --- |
| V1 | 有效 route、pause-at-end、JSON/draft round-trip、三栏/抽屉 | 错歌、unknown schema、quota/abort、导入失败 | 旧 lease、刷新 paused、1024/1280 breakpoint、异歌取消 | Vitest + real Chrome；Edge route regression |
| V2 | constant/analysis/editor-event、cache hit、共享 feature | 第五项、错歌 Editor、无效 projection、binding error | 0/1/4、最后引用释放、stale/cancel、point/range 端点 | Vitest + Worker/coordinator + real Chrome |
| V3 | 横/竖线映射、constant/analysis、point pulse、range gate | 未绑定、坏参数、scene create/render/resize error | 60Hz decay、seek/刷新/暂停、DPR/resize、Cube 中性切换、20 次 lifecycle | Versioned state golden + Vitest + real Chrome |
| V4 | 频谱核心、drum scale、Energy rise、constant orbit | context loss、restore/renderer fail | seed、DPR/resize、20 次模板切换 | Three.js unit adapter + real Chrome |
| V5 | 720p30 有声 WebM、save/retry | no MIME、busy、track/recorder/context error | 四 preset、页面 0 音量、save cancel、A/V sync | real Chrome/Edge + ffprobe/FFmpeg |
| V6 | 三格式完整制作与回放 | 全部风险故障矩阵 | 15 分钟四特征、1024/1280/1920、20 次生命周期 | real Chrome/Edge + owner manual |

V1 的 golden/unit/integration/Chrome/Edge 命令与 21 步 canonical runner 已实现；clean run `V1-2026-09-02T07-03-26-973Z-fd44c892` 21/21 通过，并于 2026-09-02 获 owner 人工批准。后续实现仍不得把 OPFS 自动化泛化为原生 OS picker 证据。

## 3. Test Layers

### Unit

- `VisualizerProjectV1` factory、canonical encode/decode、strict unknown field、template/version 和 complete binding validator。
- route lease token、pause-at-end、Editor repeat-one migration和旧 release。
- draft reducer/repository queue、250ms debounce、latest pending snapshot 和 conflict state machine。
- template registry 穷尽、parameter descriptor、0–4 planner、projection/component/index/band 校验。
- point/range source、OR/max 聚合、transform 顺序、deterministic smoothing/checkpoint 和 scene state hash。
- recorder capability、preset/bitrate、state transition、command lock 和 cleanup reducer。

### Integration

- AudioSessionService route lease、AudioEngine ended、Editor/Visualizer/Analyzer 快速切换。
- Visualizer draft/codec/native gateway 的原子导入、quota、abort、同歌和异歌恢复。
- AnalysisCoordinator consumer、cache hit/miss、feature dedupe/release、stale/cancel 和 track/config identity。
- Editor draft/JSON snapshot、错歌和引用失效隔离。
- single RendererHost、template dispose、WebGL context restore 与 recording tap holder。
- MediaRecorder tracks/chunks/finalize/cancel/save failure，不用 mock 成功替代真实浏览器输出。

### Browser end-to-end

- Header/current track、空状态、MusicBar 显隐、pause-at-end、seek 和 route leave。
- 1280/1920 三栏，1024 互斥抽屉，16:9 Canvas backing store、DPR、键盘和焦点。
- JSON 原生导入导出、刷新、错歌、异歌冲突和 not-persisted。
- 0/1/4/fifth feature、Editor lane/class、template/parameter 快速切换和 stale isolation。
- Orthogonal Lines、Cube Swarm、seek/refresh/determinism、context loss 和 scene error。
- Chrome/Edge MediaRecorder capability、默认 720p30、其余 preset、页面静音、取消/保存/回放。
- console/pageerror、reduced motion、非纯颜色状态与资源 counters。

## 4. Fixtures and Golden Data

- `visualizer-v3-lines-v1.wav`：V3 运行时确定性音频，配套同歌 EditorProjectV1 包含 main-tone range、drum point、相邻 range、多个 inner class、歌曲首尾、point/range 同时激活和无效引用变体。
- `visualizer-analysis-v1`：静音、鼓点、能量变化、稳定频谱、丰富谐波和确定性音色段；固定 Analyzer payload/hash。
- `visualizer-scenes-v1`：对批准时间点保存 resolved parameter 和 renderer-neutral scene state，不以跨平台像素截图作为唯一 golden。
- `visualizer-avsync-v1`：在同一已知时间产生音频 impulse 与高对比视觉 flash，用于 ffprobe/FFmpeg 音画偏差测量。
- MP3/WAV/FLAC 从同一确定性 PCM master 生成，manifest 记录生成器、许可和 SHA-256。
- 约 15 分钟压力音频和大型 WebM/trace 在运行时生成，保存在 Git 忽略的 artifact；证据登记 seed、命令和 SHA-256。

## 5. Browser and Recording Matrix

- V1–V4：真实 Chrome 为专项 canonical 浏览器；Edge 运行对应 route/lease/WebGL 相邻回归，不能用 Chromium 替代真实 Edge。
- V5：真实 Chrome 与 Edge 均必须成功输出默认 720p30；720p60、1080p30、1080p60 分浏览器记录 pass 或 typed unavailable。
- V6：两浏览器执行 V1–V6 全量、三格式、15 分钟四特征、context loss、录制和关键 Analyzer/Editor 回归。
- `ffprobe` 验证 format、codec、stream、width/height、frame rate、duration；FFmpeg 提取音频 impulse 和视频 flash 时间。若命令缺失则 V5/V6 blocked，不以浏览器“能播放”替代。
- 浏览器不支持选定 preset 时，验证 UI/command 明确失败并保留工程；不能自动降低到 720p30、30fps、无音频或不同 codec 组合。

## 6. Performance and Resource Method

- 使用 PerformanceObserver 与交互时间戳测量模板、binding、seek、transport 和 recorder control 的可见反馈，阈值 `<=100ms`。
- 在 fixture 的 point/range/analysis 峰记录 AudioContext 时间与 renderer state 变化，偏差 `<=50ms`。
- 对 `visualizer-avsync-v1` 的输出文件比较 impulse/flash，漂移 `<=100ms`。
- 约 15 分钟场景固定绑定 Amplitude Spectrum、Complex Spectrum、Buffer、Loudness；不得以更轻特征替代。
- 记录 Visualizer/analysis 归因 LongTask；单个任务不得超过 50ms。
- 20 次 route/template/song restore/record loop 前后比较 AudioContext、Worker、RAF、Canvas/WebGL、MediaStreamTrack、Observer、listener、Blob URL。最终 live 数必须回到稳定基线，不允许单调累积。

## 7. Accessibility and Manual Gaps

- 自动化覆盖键盘、焦点顺序、可见焦点、名称、`aria` 状态、抽屉/inspector、transport、recording lock、reduced motion 和非纯颜色错误。
- reduced motion 只关闭工作台装饰过渡；用户主动播放或录制的场景继续按工程参数运行。
- 原生 OS picker、保存覆盖提示、浏览器 codec/硬件能力、输出文件最终视觉和长会话体感不能完全自动化。
- 上述缺口由 `project-owner` 在 Chrome/Edge 完成补偿任务；记录浏览器版本、步骤、结果和残余风险，不补写未提供的数值。
- 1080p60 unavailable 可以作为设备能力事实，但默认 720p30 任一目标浏览器无法输出有声音视频时，V5/V6 保持 blocked。

## 8. Commands and Canonical Rules

每个 V 里程碑创建：

```text
npm run test:vN:unit
npm run test:vN:integration
npm run test:e2e:vN
npm run eval:vN:provisional
npm run eval:vN
```

V5/V6 另拆 `:chrome`、`:edge` 与聚合命令。每个 clean canonical 必须拒绝 dirty worktree，执行适用专项、历史回归、docs、harness、typecheck、build 和 diff check，并记录环境、步骤、日志、artifact 与 summary SHA-256。

V3 实际命令固定为 `fixtures:v3:golden`、`test:v3:unit`、`test:v3:integration`、`test:e2e:v3`、`eval:v3:provisional` 与 clean `eval:v3`。V3 canonical 恰为 V2 26 步基线加四个 V3 专项，共 30 步。

V4 实际命令固定为 `fixtures:v4:golden`、`test:v4:unit`、`test:v4:integration`、`test:e2e:v4`、`eval:v4:provisional` 与 clean `eval:v4`。V4 canonical 恰为 V3 30 步前向回归加四个 V4 专项，共 34 步；V4 Chrome 专项包含 `WEBGL_lose_context` 注入，真实 Edge 继续由既有相邻回归覆盖并在 V6 执行完整场景矩阵。

## 9. Current Gate State

- V1–V3 canonical 与 owner evidence 均已批准并关闭；V4 为 `In Progress`，V5–V6 保持 `Planned`。
- V3 quality/eval、golden、failure taxonomy、30 步 canonical 与人工门禁均已获批准；V4 quality/eval、golden 与 failure taxonomy 已按 DEC-041 获批准，实施继续把 V3 30 步作为回归基线。
- 当前没有正式 CI，所有结果限定为本地登记环境。
- `/comingsoon`、`threeDTable`、TestLands 或 V4 Cube 中性预览不是 V3 implementation evidence。
