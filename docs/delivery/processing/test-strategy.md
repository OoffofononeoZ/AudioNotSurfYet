---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/delivery/processing/execution-plan.md"
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"
  - "docs/context/working-agreements.md"
next_action: "四模型在双浏览器 session 创建失败；依据 P1 evidence 复核兼容方案，P1 未完成，P2 不开放"
---

# Browser Processing Test Strategy

## 1. Test Environment and Evidence Boundary

沿用仓库 Vitest、真实 Chrome/Edge Playwright、IndexedDB/Worker harness 和版本化合成 fixture；命令入口以 [tests README](../../../tests/README.md)、[working agreements](../../context/working-agreements.md)为准。新 processing harness、fixture 和 runner 尚未实现，不把计划中的 TS-P 名称当作可执行 npm 命令。仅改本文档时执行 `npm run test:docs` 和 `git diff --check`。

2026-10-04 已只读核对参考机 GPU 为 NVIDIA GeForce RTX 4060 Laptop GPU、nvidia-smi 总显存 8188MiB、驱动 591.86；这不是推断/性能证据。正式运行记录当时 Windows、Node/npm、Chrome/Edge、GPU/driver、实际 adapter/kernel placement、供电状态、RAM/显存采样方法，不能继承历史浏览器版本或假定全部算子在 GPU。

P1 固定 ORT Web 1.30.0 与 [execution plan](execution-plan.md) 的 npm integrity，再记录实际 JS/WASM asset hashes；模型 bytes/revisions/SHA 与 [Model Artifacts](../../architecture/processing/model-artifacts.md)完全一致。产品仍只有 WebGPU 分离，独立 WASM reference 仅用于测试且顺序运行，不增加产品 fallback/同时 session/第二播放 AudioContext。

2026-10-04，DEC-068 批准四份 delivery 并开放 P1 质量规划。三份 P1 质量契约已按 DEC-070 approved，独立 harness 已实现。evidence index/readiness 等待实际证据，不预建占位。provisional、clean canonical、必需人工输入及 DEC-069 自主推进按仓库约定，历史 M/E/V runner 仅作相关回归，不能把其 pass count 混作新 P 切片结果。

## 2. Fixture and Oracle Inputs

| Fixture family | Required cases | Independent expected result / purpose |
| --- | --- | --- |
| Model/tensor | 四 pinned 文件、错 row/shape、finite/NaN、损坏 checksum、asset 版本不符 | 四个 role 对应 row，独立 WASM 同 ONNX 短段数值；校验失败 oracle |
| Time/PCM | 44.1/48kHz，mono/stereo/>2 channel，短于 7.8s、恰一段、多段/非整尾、首尾静音、接缝前后脉冲、缺帧/重复/乱序分块 | 原 PCM frame/time/hash；恒等模型/脉冲 reference 用于时间变换，实际 FT 用于真实推断 |
| Derived data | silence、恒定振幅、不同 L/R 能量、末窗、0/NaN/Infinity、Float32 WAV | 独立公式产生 30Hz UInt16 oracle；独立 WAV parser 读取 header 和 samples |
| Reliable beat | 60/100/128/127.5 BPM；先慢后快、先快后慢；带首尾静音、非拍起点、不同音色 mix | 合成器事件表给出 beat/稳定 tempo，不能调用待测 tracking 生成答案 |
| Beat ambiguity | 空 drums、有 drums agreement/偏移、半速/倍速歧义、种子噪声、纯静音、长 gap、不稳定 onset | 可靠区段 F1 与 warning/null/空候选契约分别验证，不对歧义强配“正确”BPM |
| Cache/worker | quota estimate 通过后写入失败、OPFS/IDB 独立失败、metadata 缺 artifact、取消时刚写完、浏览器中断、迟到 terminal | 发布/清理状态和 job/source/generation 事件表，不靠 UI 快照判断 |
| Project/apply | 既有 marker/user tempo/binding、四项任意选择、hash/new target 冲突、V1/严格 V2/无 snapshot/错误 schema | before/after canonical diff 和独立预期字段；V1 migration 不读取 I/O |
| Long/media | 确定性十五分钟 stereo、四 stem/四 energy、impulse/flash、两种 processing/tempo-derived binding | wall-clock/资源；已知 A/V 事件绝对秒数，不以算法预测作为视频真值 |

可提交合成数据遵循现有 `tests/fixtures/fixture-manifest.json` 许可/版本/seed/hash 记录；十五分钟大型输入沿用本地生成及 OPFS staging，不把模型或大型生成媒体提交 Git。合成四轨验证工程角色/时间/导出，不把它伪装成代表性歌曲的 hard SDR benchmark。

三首 owner 歌曲仅在本地使用；许可确认、匿名 case ID 和质量结论可登记，歌曲/WAV、文件名、绝对路径和用户内容 hash 不进入版本化证据。机器运行日志需排除用户 PCM/歌词/路径；fixture/model/runtime 的公开或合成 hash 可正常记录。

每个可靠 beat fixture 的 oracle 固定 audible/稳定区段及每变化边界最多一个新 beat interval 的过渡窗，运行前锁 manifest。matcher 与算法分开实现，报告每段 TP/FP/FN/F1 和 BPM 误差；额外预测计 FP，不能聚合掩盖某段失败。

## 3. Verification Matrix

| Test ID / AC coverage | Levels | Success paths | Failure / boundary / exception paths | Evidence / owner |
| --- | --- | --- | --- | --- |
| TS-P1 / AC-P101–P106 | unit、独立浏览器 integration、人工 | 四图 session/对应 row、WASM parity、完整拼接、energy/WAV、十五分钟分离、12 WAV 试听 | checksum/asset/shape/NaN、mono/>2ch、短尾/静音/接缝、device lost/OOM、cancel | 每轨数值、tensor/backend、时间/WAV golden、wall-clock/峰值、试听；project-owner |
| TS-P2 / AC-P201–P205 | unit、Worker/IDB/OPFS integration、Chrome/Edge E2E | route/lease、stage 控制、下载/cache hit、四轨结果、显式清理 | 断网/取消、quota 写前/写时、跨存储失败、artifact corrupt、leased delete、换歌/迟到/崩溃残留 | 网络/事件轨迹、key/发布状态、原工程/资源 baseline；project-owner |
| TS-P3 / AC-P301–P305 | unit、既有 analysis Worker integration、Chrome/Edge E2E | 固定/变化 F1/BPM、mix+drums/mix-only、proposal、完整 ≤900s | 静音/噪声/半倍速/空 drums/gap、错误 identity、长任务 timeout/cancel、迟到结果 | 分段 matcher、warning/provenance golden、完整阶段耗时；project-owner |
| TS-P4 / AC-P401–P405 | unit、controller/repository integration、Chrome/Edge E2E | meter 确认、合法 map、四项逐选/diff、原子准备/应用 | 缺确认/非法 map、hash/new target/source 冲突、部分/空选、持久化失败、rerun/拒绝 | canonical before/after diff、dirty/export、用户字段保留；project-owner |
| TS-P5 / AC-P501–P505 | unit、codec/repository/resolver integration、Chrome/Edge E2E | 纯 V1 迁移、V2 round-trip、默认/旧源、absolute-time mapping、显式刷新 | strict/长度/身份失败、无 snapshot、pulse 端点、stale/hash 冲突、原子刷新、preflight 拒绝/去绑定 | migration/resolver golden、草稿写版本、renderer 时间/资源；project-owner |
| TS-P6 / AC-P601–P604 | Chrome/Edge E2E、媒体分析、性能/资源、人工 | 完整自动优先任务、手动任务、工程恢复、snapshot 离 cache 录制、最终长曲 | GPU 失败后手动/mix-only、stale/cancel/save/record faults、20 次生命周期 | 任务步骤、媒体事实/A/V、最终性能、缺口/owner 记录；project-owner |

故障注入必须验证准确的 typed error、没有成功 metadata/部分内存工程，以及仍可用的 transport/人工路径。真实 capability/session/长曲不能全由 mocks 代替；device lost/OOM 的自动化注入不证明真实驱动压力稳定，仍需长曲实跑。

P4 集成测试可用经 strict validator 校验的目标领域模型/adapter 验证跨工程原子准备；生产 Visualizer V2 写入和实际 resolver 在 P5 验证，不让 P4 mock 被计入 AC-P501/P601。

## 4. FT Reference and Temporal Checks

WASM 参考对四模型分别运行相同短段输入，先于/晚于 WebGPU session 执行并释放，排除同时驻留造成的资源竞争。逐 sample 比较对应 row，max absolute ≤`1e-3`；保存合成输入身份、配置、每轨 shape/误差、runtime/browser/backend。参考无法加载或非有限输出均不能 skip 成通过。

预处理参考来自 pinned [drums infer.py](https://huggingface.co/StemSplitio/htdemucs-ft-drums-onnx/raw/44f630d49a19053a61c12df7244fe1f01b9ccc4f/infer.py)：分段 343980 frames，overlap 为四分之一（85995 frames）、stride 257985，线性过渡权重、尾部 zero padding 与加权 overlap-add。P1 需核对实际 export graph 和其他三个模型脚本，锁定规范化/窗口/重采样 config 及 hash；不能盲加第二次 normalization，也不能仅凭脚本来源宣称兼容。

重采样/拼接正确性用独立恒等/脉冲 oracle：记录输入秒数、输出脉冲位置、帧数、接缝/首尾。真实 FT 声音不要求重构为精确 impulse 或四轨相加恒等 mix；对应声音质量由数值和人工门禁判断。

WAV parser 独立读取 format/channels/sampleRate/data/frameCount 与样本，series oracle 按平方均值 RMS→dBFS→裁剪[-80,0]→UInt16 计算。源 PCM 导出前后 hash 一致，确认 range copy 未 detach 或修改 AudioEngine。

## 5. Performance and Resource Runs

- 参考十五分钟新结果 cache miss，在 Chrome/Edge 分别执行 P1 分离、P3 完整链、P6 最终集成。每次模型已缓存/校验、PCM 已解码；新 session 初始化计入，不能把热 session 或完整结果命中当基线。
- 使用分离/节拍两个显式命令；计时覆盖 start 前 staging 至 proposal ready 的计算段，人工点击间隔独立记录。分项报告 staging、session/model load、inference/stitch/derive/persist、beat 和总量；下载/原曲解码/人工确认/录制另表。
- 模型缓存重跑、结果 cache hit 单独报告节省时间；cold download 记录字节/校验/取消，不与 ≤900 秒混算。P1 <900 秒仅必要前置，P3/P6 总量 ≤900 秒且无 OOM。
- 用 PerformanceObserver/trace 和输入计时核对反馈 ≤100ms、无处理归因 >50ms 主线程任务；捕获 progress 时间序列检查 heartbeat≤1s，不将无进度期间总时长缩短。
- 记录 JS/浏览器进程内存、GPU 专用/共享显存峰值及采样粒度，不从权重 631.8MiB 推断运行内存减半。浏览器指标不可见时由 owner 使用系统/GPU 工具补偿，缺项明确 unverified。
- 在模型下载/加载/推断/拼接/写入和 beat 各阶段取消；controller 立即撤销 generation，五秒内完成清理或输出 residual IDs。进程中断后重新初始化登记残留并验证显式删除。
- 20 次重复 route/track/retry/cancel/模板/录制生命周期，按固定稳定点对比 session/tensor、Worker、AudioContext、RAF、Canvas/WebGL、MediaStreamTrack、Observer/listener、Blob URL、临时 OPFS；归还资源后无单调累积。cache 的用户确认增长单独计量，不能误判为泄漏。

## 6. Regression and Media Checks

| Slice | Existing adjacent checks to select |
| --- | --- |
| P1/P2 | AudioEngine descriptor/range、source hash、route playback lease、队列/transport、现有 analysis Worker consumer/cancel |
| P3 | Editor E2 BPM reliable/low-confidence、20–300/小数/half-double、Analyzer Worker/progress/cache identity |
| P4 | Editor tempo/grid、user/estimated、marker/dirty/draft/JSON V1、原子导入/持久化失败 |
| P5 | 历史 Visualizer project/binding/scenes、单 RendererHost、绝对时间 seek、四特征 planner、recording preflight 与 route/viewport |
| P6 | 相关 Analyzer/Editor/Visualizer 回归、现有 WebM media 门禁、新 processing resolver/tempo-refresh、最终长曲资源 |

实际测试文件/命令在切片 eval 中核对 package.json 后选择，避免未经实现宣称可运行。实现时执行 typecheck/build、对应专项与相关回归；失败/未运行路径逐项记录，不用历史 canonical 重命名冒充 processing canonical。

新 impulse/flash 媒体验证默认 720p30，以及工程选择且实际可用的既有预设；不支持的预设在 preflight 明确 unavailable。保留 V5/V6 的音轨、尺寸、时长、平均 fps、packet gap 和回放门禁，新 processing 与 tempo-derived mapping 的 A/V 均 ≤100ms。测试端可用既有 FFmpeg/ffprobe 检查媒体，不使它成为产品 WAV 编码依赖。

## 7. Known Gaps and Compensation

| Gap | Reason / residual risk | Owner / required compensation |
| --- | --- | --- |
| 三首歌曲分离听感 | 没有真实干净 stem ground truth；parity/合成不证明真实听感 | project-owner 按 AC-P105 听 12 WAV；许可/匿名记录，任一不可用阻止 P1 |
| native picker/save 与系统回放 | Playwright/OPFS 不能证明真实 OS 选择、拒绝/取消、保存后打开 | project-owner 在 P2 WAV、P6 WebM 手动保存/取消/回放并记录 |
| 实际 GPU peak/kernel placement | 浏览器 trace 未必完整暴露全部显存或内部 kernel | 工程 probe 加 owner 系统/GPU 采样，标记测量粒度/缺项；缺少兼容/性能关键项不关闭切片 |
| 真实 device lost/OOM | fault injection 不等于驱动/资源压力 | 双浏览器长曲与取消实测补偿；实际异常保留失败 artifact |
| 键盘/辅助技术、警告是否可理解 | DOM/可访问属性不能代表读屏和人类理解 | project-owner 按完整任务检查焦点/标签/错误恢复；P6 记录介入次数/时间，无假定阈值 |
| 测试环境端口/浏览器权限阻断 | 无法形成真实浏览器证据，不能用 mocked/skip 替代 | 记录 unverified 和所缺 AC；DEC-055 的 Editor 专项例外不自动继承为 processing 豁免 |
| CI/其他 GPU 与浏览器 | 当前无正式 CI，参考机之外未验证；非 Chromium 不在首链支持范围 | 结论限定本机 Chrome/Edge；扩大支持另行评审，不套参考机性能承诺 |

## 8. Delivery Document Verification

批准登记运行 docs validator、diff check，核对四文件元数据、上游/Markdown 链接、AC→TS→risk 映射、DEC-067/068、索引状态和仅文档改动。此验证只证明计划文档一致性，不构成任何 P1–P6 测试通过、模型校验、资源缓解或 release readiness。

## 2026-10-04 Authorization Update

DEC-069/070 接受 P1 eval/golden/失败分类并开放实现。P1–P6 按全部适用 AC、干净候选证据和必需人工输入自主关闭及推进，无需逐次申请代码提交或阶段批准；符合既定契约的后续质量文档纳入本授权。新产品/架构/兼容/阈值与发布决定仍需人工确认。历史批准范围按原日期保留；风险与缺口不因授权消失。

## P1 Implementation Checkpoint

2026-10-04，固定四模型实际 size/SHA 已校验，独立内核与 oracle/故障测试已实现。Chrome/Edge 的四图均在 `/real_istft/ConstantOfShape` provider 分配处创建 session 失败，未进入真实推断、parity、长曲或试听。P1 保持 In Progress、P2–P6 Planned；见 [P1 evidence](../../quality/processing/evidence-index.md)，不将合成/注入通过写成真实模型通过。
