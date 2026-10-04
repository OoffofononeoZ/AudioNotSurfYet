---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"
next_action: "按owner要求暂停本轮执行；下次先告知性能未达标与质量验证缺口，再恢复P1；不提前接入P2"
---

# Browser Processing Execution Plan

## 1. Outcome and Current State

交付浏览器内“分离音轨 → 分析节拍 → 应用提案 → 人工修正 → 视觉映射 → 实时 WebM”的完整路线，先以独立 FT 可行性切片决定是否接入工作区。依据为 [System Design §21](../../architecture/system-design.md#21-automated-audio-to-video-target-architectureapproved)、ADR-0024–0027 和 DEC-063–066。

本计划、[验收标准](acceptance-criteria.md)、[测试策略](test-strategy.md)和[里程碑](milestone-plan.md)于 2026-10-04 经 owner 明确要求“实施计划”批准（DEC-068）。此前 DEC-067 固定完整路线先验证 FT、数值对照加人工复核、逐拍 70ms/F1 ≥0.95。P0-D 关闭，开放 P1 质量规划；P1 质量契约已按 DEC-070 批准，实际实现、依赖安装和模型下载已开放，P2–P6 保持 Planned。R-046–R-055 全部保持 Open。

2026-10-04 代码核对：AudioEngine 已提供 `getDecodedAudioDescriptor()` 与 `copyDecodedChannelRange()`；现有 analysis Worker 的 tempo-estimate 只输出 BPM/评分，coordinator consumer 尚不含 Processor，tempo 请求默认超时为 15 秒；路由尚无 Processor。既有 Visualizer schema 为 V1，Editor 保持 V1。这些是可复用入口，不是新链完成证据。

本计划的 P1–P6 不续用历史 Visualizer V1–V6 编号；Project V2 指 JSON schemaVersion 2。历史 canonical 和关闭记录保留，作为相邻回归，不能替代 processing 新链证据。旧计划的发现入口见 [Visualizer execution plan](../visualizer/execution-plan.md)。

## 2. Delivery Sequence

2026-10-04收尾：owner允许基本功能完成而性能未达标时暂时结束，并要求文档记录和下次提醒。独立P1内核已可运行；最后完整Chrome测量1011.9541秒，AC-P106失败，warning日志候选完整性能尚未重验。执行暂停，P1仍未关闭；试听、原生操作及当前候选完整canonical缺口见 [收尾证据](../../quality/processing/evidence-index.md#owner-requested-wrap-up--2026-10-04)。本次不降低阈值，不开放P2。

| Slice | Result | Dependency | Acceptance / tests | Owner |
| --- | --- | --- | --- | --- |
| P1 — FT feasibility | 独立浏览器 harness 验证四模型、分段/拼接、energy/WAV、质量与长曲资源 | 四份 delivery 获批；P1 eval/fixture 契约经评审 | AC-P101–P106 / TS-P1 | project-owner |
| P2 — Separation workspace | Processor 路由、下载/缓存/容量、任务控制、四轨结果和导出 | P1 全部验收证据及必需人工输入（DEC-069） | AC-P201–P205 / TS-P2 | project-owner |
| P3 — Beat candidates | 现有 analysis Worker 的 DP 跟踪、逐拍/局部 tempo/警告与只读提案 | P2 全部验收证据及必需人工输入（DEC-069） | AC-P301–P305 / TS-P3 | project-owner |
| P4 — Confirm and apply | 小节确认、逐项 diff、hash 冲突及原子应用，保留用户修改 | P3 全部验收证据及必需人工输入（DEC-069） | AC-P401–P405 / TS-P4 | project-owner |
| P5 — Visualizer Project V2 | strict codec/迁移、processing source、默认映射、tempo 显式刷新 | P4 全部验收证据及必需人工输入（DEC-069） | AC-P501–P505 / TS-P5 | project-owner |
| P6 — Complete production | 双浏览器完整制作、手动路径、新链媒体/性能与资源验证 | P5 全部验收证据及必需人工输入（DEC-069） | AC-P601–P604 / TS-P6 | project-owner |

日期使用门禁次序，不承诺未知工期。逐切片状态和复核点以 [milestone plan](milestone-plan.md) 为准。

## 3. P1 — Prove FT Before Integration

1. 建立测试专用浏览器入口和有界 PCM/OPFS harness，复用 AudioEngine 的 descriptor/range 语义；不接完整 Processor 工作区、Editor apply 或生产 fallback。
2. 固定 `onnxruntime-web@1.30.0` 作为验证版本，使用 同版官方 ORT JSEP `ort.all.min.mjs`（[kernel config](../../architecture/processing/ft-kernel-config.md)）。锁定 npm integrity、实际部署 JS/WASM assets 的 SHA-256 与许可/体积，关闭 proxy Worker；四模型沿用 [Model Artifacts](../../architecture/processing/model-artifacts.md) 的 immutable revision/SHA/size。安装及模型下载仅在 P1 开放后进行。
3. 在 Chrome/Edge 逐模型校验实际 bytes，创建 session，记录 tensor shape、实际 GPU/CPU kernel placement 和角色 row；drums → bass → other → vocals，各角色完成全曲后释放再加载下一模型。
4. 锁定 preprocessing/config identity：44.1kHz stereo、343980-frame 分段、尾段 padding、overlap/window/拼接、重采样延迟补偿和输出帧数。对齐固定来源参考脚本的处理语义，不能额外做未证明需要的 normalization。
5. 测试专用 WASM 参考与 WebGPU 使用相同四 ONNX、相同输入短段；参考运行在隔离 harness 中并顺序执行，不进入产品分离路径。检查四个对应 row 的最大绝对误差 ≤`1.5e-3`；参考不可运行时记为缺口并阻止 P1 关闭。
6. 用有确定答案的恒等/脉冲 harness 验证时间变换，再以真实 FT 验证拼接、四轨派生、30Hz energy 与浏览器 Float32 WAV。owner 复核三首有许可歌曲的 12 个 stem WAV。
7. 参考 RTX 4060 Laptop 8GB 在两浏览器各完成十五分钟分离，记录 wall-clock、内存/显存、反馈/heartbeat、取消及释放。P1 分离耗时必须 <900 秒，为节拍保留实测余量；它不代表 P3 的完整目标达标。

初始运行库 [npm 元数据](https://registry.npmjs.org/onnxruntime-web/1.30.0)的 integrity 固定为：

~~~text
sha512-q0y+JrrtukXSzsBWEMccVfqX25LRmosXHF+CaRJmg8pZClzcV7svNc4rKY3jL02Vb7QmRMDs1SigqR4CXAfKYQ==
~~~

该 pin 是待验证输入，不是模型兼容结论。JS/WASM 资源部署遵循 [ORT 部署说明](https://onnxruntime.ai/docs/tutorials/web/deploy.html)；P1 evidence 登记实际文件身份，不能混用不同版本资源。版本/图不兼容、质量不可接受、OOM 或分离已耗尽 900 秒预算时停止后续接入，复核架构/交付，不自动换模型、降版本或提供整图 CPU fallback。

## 4. P2 — Make Separation Usable

- 新增 `/processor/:trackId?` 和当前歌曲入口，复用 route playback lease、单 AudioEngine 及既有 transport；空状态、错误歌曲、换歌和离页均显式处理。
- controller 实现 source/job/generation 与 start/progress/cancel/result/error；同一时刻一个自动计算 stage，现有 analysis Worker 外最多一个分离 Worker，无第二个播放 AudioContext。
- 首次下载显示四模型 662450544 bytes 的待下载量、逐文件进度和校验；命中完整缓存后复用。下载、校验与处理分开计时，不发送用户 PCM/stem/工程。
- IndexedDB 保存校验模型与 metadata/compact series，OPFS 保存 stem/临时 PCM。10GiB 可配置限制与 origin quota 共同检查；先 artifact 校验后发布 metadata，无跨存储事务假设、自动驱逐或半成品命中。
- 四轨展示 waveform、30Hz energy、角色和 provenance；浏览器分块编码 WAV。下载/推断/导出失败提供 typed error、重试及人工路径；首版 stem 试听/mix 播放器继续延后。
- 取消、换歌、离页、Worker 崩溃撤销 generation，迟到消息不能发布结果；临时文件五秒内清理或登记，旧完整模型/结果不误删。

## 5. P3 — Extend the Existing Beat Analysis

- 扩展 `src/analysis/tempoEstimator.ts` 和现有 analysis Worker/coordinator，保留既有 Editor BPM API；增加 processing consumer 和长任务进度/取消，不能套用旧 15 秒 timeout 把合法长任务判失败。
- mix 为主，drums 在 ±70ms 内仅作辅助证据。扩展 flux/onset、自相关与可靠性判断，加入 DP beat tracking、局部 interval/tempo 聚合、评分/config 版本和复核警告。
- 可靠固定/变化区段逐段 F1 ≥0.95，固定/稳定局部 BPM 误差 ≤`max(0.5 BPM, 目标×1%)`；合成 oracle 和过渡排除区在运行前锁定，详见验收标准。
- 静音、空 drums、半速/倍速、gap 和不稳定区段不制造可靠结论；无可靠 beat 时 null BPM、空候选。不给候选伪造 meter/downbeat。
- 生成只读 ProcessingProposalV1 和完整 provenance；任何阶段成功都不自动启动下阶段或应用工程。分离失败/被跳过时仍允许用户显式运行 mix-only TS 节拍。
- 两浏览器十五分钟完整新处理任务从分离 start（包括 start 前 staging）至四轨和 beat/tempo proposal ready ≤900 秒，不含下载、原曲解码、人工确认或录制；P6 重验最终集成。

## 6. P4 — Human Confirmation and Atomic Apply

- 用户确认所选 metered segment 的小节起点、BPM、拍号后生成合法从 0 秒起的 Editor V1 tempoMap；未确认区域可为 single-beat。自动 BPM 标 estimated，用户修正标 user。
- 展示各目标 canonical hash、结构化 diff 和四项独立选择：tempoMap、processingSnapshot、默认横线、默认竖线。无对应数据时禁止选择默认绑定。
- 检查 proposal/source/job/generation 与所选目标 hash；目标新建/改变均冲突，重新审阅 diff。准备和校验全部所选更新后再原子更新内存，持久化失败保留 dirty/export。
- 保留所有人工 marker、未选字段及用户 binding；rerun 只产生新 proposal，不隐式刷新/覆盖已应用工程。

P4 可在测试领域模型中准备 V2 更新和 apply diff，不提前向生产 Visualizer 写入 schema 2。实际 Visualizer codec/repository 和可用映射在 P5 接通，P4 不以 mock 结果声称完整视频链已通过。

## 7. P5 — V2 Bindings and Explicit Tempo Refresh

- 实现 strict VisualizerProjectV2 codec、单草稿升级、无 I/O 的 V1 单向纯迁移和 V2-only 新建/持久化/导出；保留旧 binding/场景/预设/seed 值，无双写或降级导出。
- snapshot 只嵌 compact energy、detected beat、warning、source/provenance 和可选 tempo-derived map，不嵌音频、model 或 OPFS handle；沿用受控 scene registry 和四 Analyzer 特征边界。
- 按原 AudioContext 绝对秒数解析 stem-energy、beat、downbeat。downbeat 只来自用户确认 Editor tempo；缺失/身份不匹配返回 unavailable。
- 用户逐项确认的 Orthogonal 默认映射为 horizontalIntensity=other energy、verticalIntensity=beat pulse；不改变其他参数或未选 binding。
- Editor tempo 变更将相关 snapshot/map 标 stale；显式展示刷新 diff，一起替换 Editor snapshot 与派生 map，保留 binding、检测证据和 stem energy。stale source 不继续驱动画面，录制 preflight 要求刷新或移除受影响绑定。

## 8. P6 — Validate the Whole Production Task

在 Chrome/Edge 执行本地歌曲、三个显式 stage、人工 tempo 修正/刷新、默认和自定义绑定、播放/seek、工程保存/导入/恢复、实时 WebM 保存/回放。工程内 snapshot 应在 processing cache 清除、Worker 结束后仍可录制。

同时验证无 WebGPU/分离失败后的完整手动制作和显式 mix-only 路径，最终重跑十五分钟 ≤900 秒、资源生命周期及新 binding 的 A/V ≤100ms。媒体结构/时长/fps 等保持已有录制门禁；结果只形成新链 readiness 证据，不自动改变历史 readiness、豁免或 PROD-015 的上线阻塞。

## 9. Inputs and Change Triggers

| Input / unresolved measurement | Needed by | Consequence if missing | Owner / action |
| --- | --- | --- | --- |
| 四模型 bytes、ORT assets、实际 kernel placement、参考 parity | P1 close | 不能声称兼容或数值通过 | project-owner / 执行 harness 并登记证据 |
| 三首有许可本地歌曲及 12 WAV 质量记录 | P1 close | 合成/数值证据不能替代实际质量 | project-owner / 提供许可并试听；不提交歌曲/路径/hash |
| 参考机 GPU、内存、浏览器与驱动版本、供电状态及峰值采样 | P1/P3/P6 close | 无法判断参考机性能与资源 | project-owner / 每个运行记录实际环境，不推断 RAM 上限 |
| 每切片 eval/fixture/失败分类与 evidence 规范 | 各切片实现前 | 无法形成可审阅 canonical | 四份 delivery 获批后按 quality 阶段逐切片建立，不预建占位 |
| 原生保存、试听、GPU 指标和辅助技术人工检查 | 对应切片 close | 留有未验证风险，不能自动关闭 | project-owner / 按 test strategy 记录补偿 |

阈值、runtime/model/backend、preprocessing、评分、小节确认、hash/apply、schema/刷新或支持矩阵改变时，更新对应架构/delivery 并重新评审。自动音色/FX、MIDI、3D 辅助图、素材生成、离线/批量/其他输出格式保持延后；不在 P1–P6 混入实现。

## 2026-10-04 Authorization Update

DEC-069/070 接受 P1 eval/golden/失败分类并开放实现。P1–P6 按全部适用 AC、干净候选证据和必需人工输入自主关闭及推进，无需逐次申请代码提交或阶段批准；符合既定契约的后续质量文档纳入本授权。新产品/架构/兼容/阈值与发布决定仍需人工确认。历史批准范围按原日期保留；风险与缺口不因授权消失。

## P1 Implementation Checkpoint

2026-10-04，固定四模型实际 size/SHA 已校验，独立内核与 oracle/故障测试已实现。Chrome/Edge 的四图均在 `/real_istft/ConstantOfShape` provider 分配处创建 session 失败，未进入真实推断、parity、长曲或试听。P1 保持 In Progress、P2–P6 Planned；见 [P1 evidence](../../quality/processing/evidence-index.md)，不将合成/注入通过写成真实模型通过。

2026-10-04，owner 明确批准短段跨后端最大绝对误差上限 `1.5e-3`（DEC-071）。原始 ONNX、官方 ORT、独立 WASM、逐 sample 比较及其余验收门禁保持不变；历史 `1e-3` 失败证据保留，不构成 P1 关闭。
