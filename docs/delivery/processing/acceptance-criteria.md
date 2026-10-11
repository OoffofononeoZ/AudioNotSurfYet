---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-12
upstream_docs:
  - "docs/delivery/processing/execution-plan.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/risk-register.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"
next_action: "当前FT功能按DEC-074汇总听感及长曲耗时例外收尾；完整P1/P2与后续链路另按证据判断"
---

# Browser Processing Acceptance Criteria

## 1. Scope and Measurement

本表把 [scope](../../product/scope.md)、[success metrics](../../product/success-metrics.md)与获批 [System Design §21](../../architecture/system-design.md#21-automated-audio-to-video-target-architectureapproved)映射到 P1–P6。每项 owner 为 project-owner；验证矩阵和证据方法见 [test strategy](test-strategy.md)。覆盖列中“成功/失败/边界/异常”指必须验证的行为，不表示已执行。

DEC-072限定开放当前[Editor分离接入](../../architecture/processing/editor-separation.md)：P2入口使用现有Editor“标记编辑/音轨分离”，本切片不等待P1性能/全部人工质量收口。既有原PCM、单AudioContext/分离Worker、缓存校验、显式清理、取消/迟到保护和真实WAV要求保持；完整P1、P2人工门禁及P3–P6仍按各自证据判断。

2026-10-12 当前功能交付例外（DEC-074）：owner 接受汇总试听结论及复杂音乐部分串音，前提是本地链路无问题；第三首处理时间视作通过，长曲可容忍较长耗时。其余适用测试通过即可收尾本轮，不以原 12 行试听表或 P1 <900 秒作为本轮交付阻断。下列定义仍保留用于历史测量与独立正式评审，不将此接受写成旧门槛实测通过，不新增数值上限，不自动改动 P3/P6 完整链性能承诺。原生 OS 检查、正式候选及支持范围不由本例外补齐，详见 [owner 验收](../../quality/processing/evidence-index.md#owner-acceptance--2026-10-12)。

### Numerical and Quality Gates

- FT parity：每个模型只比较对应 role/row 的短段 Float32 输出；相同模型、输入 PCM、padding/config，独立 WASM 参考对照 WebGPU，每轨全量 sample 的最大绝对误差 ≤`1.5e-3`。shape、frame count、role 和 finite 检查必须完全通过。记录每轨最大误差和 RMS 误差；不以平均值掩盖峰值。此门禁验证 ONNX 后端差异，不声称等同原始 PyTorch 模型或源分离 SDR。
- 时间变换：确定性恒等/脉冲 harness 验证事件时间误差 ≤一个 44.1kHz 输出 sample；真实 FT 不把模型本身的泄漏/扩散误判为时间变换错误。实际四轨 frame count=`round(source.durationSeconds×44100)`，首尾静音不裁剪，尾部长度只允许 ≤一个输出 sample 的校正，超限失败。
- 人工质量：owner 用三首有许可的本地歌曲检查 12 个 WAV，逐轨记录“角色可辨识、串音、断裂、伪影”和结论（可用 / 需复核但可用 / 不可用）。角色不可辨识，或断裂/伪影使正常视觉映射无法使用，判不可用；任一不可用阻止 P1 关闭。提交匿名 case ID、许可确认与结论，不提交歌曲/WAV/用户路径/hash。尚无三首实际歌曲通过记录。
- 逐拍：对每个可靠合成区段，将预测与真值在绝对差 ≤70ms 时作最大一对一匹配；并列匹配选择总误差较小者，禁止同一预测/真值重复计数。precision=`TP/(TP+FP)`，recall=`TP/(TP+FN)`，F1=`2TP/(2TP+FP+FN)`，每段 F1 ≥0.95，报告 TP/FP/FN 和时间误差。
- 变化边界：fixture manifest 在运行前固定从真值变化点起、长度为一个新 tempo beat interval 的可排除过渡区，预测/真值均按该窗口排除；每个边界最多一个 interval，不能事后扩窗或跳过低分区段。两侧稳定区段分别验收，候选不能把整曲强制拉平。
- 固定及稳定局部 BPM 误差 ≤`max(0.5 BPM, 目标×1%)`；静音/歧义/无可靠结果不用 F1 假通过，执行空结果和警告契约。

### Performance Boundary

参考机为 RTX 4060 Laptop GPU 8GB。两浏览器各运行十五分钟新任务：模型 bytes 已下载/校验且原曲已解码，结果 cache miss，首次 session 初始化计入。计时从用户分离 start 的 staging 起至四轨及 beat/tempo proposal ready，包含 PCM hash/staging、session、推断、拼接、waveform/energy、节拍和结果写入。stage 间等待用户点击单独报告并从计算总时长扣除；测试 harness 按显式命令依次启动，产品不自动跳 stage。

P3/P6 计算总 wall-clock ≤900 秒且无 OOM；P1 只有分离，必须 <900 秒并报告剩余预算，不代替完整指标。下载、原曲解码、人工确认和实时录制另计。cached-result hit 不能作为性能通过证据；模型缓存复用和结果缓存复用另行测量。记录实际 browser/driver/GPU、供电状态、主存/显存峰值和采样方法。

## 2. P1 — FT Feasibility

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P101 | 四 pinned bytes 的 size/SHA 全匹配；ORT 1.30.0、npm integrity、JS/WASM identity/许可锁定；Chrome/Edge 每个模型能创建 WebGPU session，记录实际 kernel placement | 成功、损坏/版本不符失败、异常 | TS-P1 模型/asset 校验和真实 session；R-046/R-048 |
| AC-P102 | 四 session 顺序不重叠，每个专用模型只取正确 row；四轨 tensor/finite 与上述每轨 parity 门禁通过；单模型取四轨或角色错位的故障必须被拒绝 | 成功、错误 row/shape/NaN、边界 | TS-P1 独立 WASM 对照及错误注入；R-046/R-052 |
| AC-P103 | mono 模型边界复制 stereo，>2 channel 明确失败；44.1/48kHz、短于分段、完整分段、非整段尾部、静音和接缝保持时间/frame 规则；原 AudioEngine PCM 不 detach/更改 | 成功、PCM 缺帧/hash/时长失败、边界 | TS-P1 时间 oracle、真实拼接和原 PCM hash；R-047 |
| AC-P104 | waveform/energy/WAV 来自同一 stem；energy 长度 ceil(30×duration)，RMS/dBFS/UInt16 与 oracle 精确一致；WAV 为 stereo IEEE Float32/44.1kHz，header/frame/样本和 artifact 一致 | 成功、零能量/末窗、导出失败 | TS-P1 独立 WAV 解码、series golden；R-047/R-052 |
| AC-P105 | 三首歌曲 12 个 WAV 均有 owner 复核记录且无不可用项；other 正确命名，不称 lead；警告/串音不隐瞒 | 成功、质量不足、人工复核 | TS-P1 试听记录；R-052 |
| AC-P106 | 双浏览器十五分钟分离 <900 秒、无 OOM；输入反馈 ≤100ms、running heartbeat 间隔 ≤1s；取消有效且五秒内 temp 清理或登记，无 session 逐次累积 | 成功、device lost/OOM、取消/边界 | TS-P1 长曲、资源 probe 和真实指标；R-049/R-050 |

## 3. P2 — Separation Workspace

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P201 | 正确歌曲进入 Processor，未知/空目标显式空态；三个 stage 显式启动，成功不自动下一步/播放/录制；复用 playback lease，单播放 AudioContext、现有 analysis Worker 外最多一个分离 Worker | 成功、错歌/离页、边界 | TS-P2 route/controller/资源；R-046/R-050 |
| AC-P202 | 首次显示缺失模型总 bytes、逐文件下载/校验进度，cache hit 不重复下载；断网/取消/checksum/asset mismatch 明确失败，不发布半成品，不上传 PCM/stem/工程 | 成功、失败、取消/离线边界 | TS-P2 网络记录/故障；R-048 |
| AC-P203 | 10GiB 可配置和 origin quota 同时约束模型/结果/temp；写前和写时失败明确反馈；OPFS artifact 完整后才发布 IDB metadata；清理须显式，leased/running 拒绝删除，无自动驱逐 | 成功、quota/事务故障、崩溃残留/边界 | TS-P2 存储事务/初始化清理；R-051 |
| AC-P204 | cache identity 完整涵盖 source/PCM、四模型、runtime/assets/backend、算法/config，artifact 缺失/损坏拒绝命中；取消不删旧完整结果 | 成功、每一身份变化、损坏/边界 | TS-P2 key 矩阵、checksum；R-048/R-050/R-051 |
| AC-P205 | 每 start 恰有一个有效 terminal；cancel 幂等，换歌/离页/重试撤销 generation；迟到消息不改 UI/缓存/工程；temp 五秒内清理或登记，错误保留可用播放/手动路径 | 成功、竞态、崩溃/异常 | TS-P2 worker race 和 20 次 lifecycle；R-050 |

## 4. P3 — Beat Candidates

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P301 | 每个可靠固定/变化合成区段按锁定窗口 F1 ≥0.95；固定/稳定局部 BPM 容差通过；变化曲输出两侧有效候选，beats 升序、界内且 1ms 内去重 | 成功、首尾/变化边界 | TS-P3 oracle matcher/局部候选；R-047/R-053 |
| AC-P302 | mix 主输入、drums ±70ms 辅助；空 drums 不删 mix beat；无 drums provenance 正确，用户显式 mix-only 不触发模型下载/分离 fallback | 成功、空 drums/错位/分离失败 | TS-P3 双输入对照、网络/controller；R-046/R-053 |
| AC-P303 | 首尾静音不外推；纯静音/无可靠 beat 为 null BPM、空 beat/candidate；audible、gap、歧义/不稳定等按批准配置警告；score 为有限 [0,1] 算法评分；无自动 meter/downbeat | 成功、静音/噪声/半速倍速、gap | TS-P3 warning/评分 golden；R-053 |
| AC-P304 | 扩展同一 analysis Worker，保留既有 Editor BPM 回归；新长任务可进度/取消，不被旧 15 秒 timeout 误杀；只读 proposal provenance/config 完整，迟到结果隔离 | 成功、长任务/取消/异常 | TS-P3 coordinator integration；R-050/R-053/R-054 |
| AC-P305 | 双浏览器十五分钟完整分离加节拍 proposal ready ≤900 秒且无 OOM；反馈 ≤100ms，无处理归因 >50ms 主线程任务，running progress 至少每秒一次 | 成功、长曲/资源边界 | TS-P3 完整 wall-clock/trace；R-049 |

## 5. P4 — Confirm and Apply

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P401 | 候选不伪造 tempoMap；用户确认选中 metered segment 的起点/BPM/meter 后才生成合法 Editor V1 map，未确认区可 single-beat；estimated/user 来源正确 | 成功、未确认/非法 BPM/meter、边界 | TS-P4 confirmation/tempo validator；R-053/R-054 |
| AC-P402 | 展示 canonical target hash/diff，四项独立选择；source/job/generation 或任一所选目标 hash 冲突拒绝并要求重审；null 目标已被创建也冲突 | 成功、并发冲突/换歌/边界 | TS-P4 controller/hash matrix；R-054 |
| AC-P403 | 所选字段全准备/校验后原子更新内存；准备失败零部分应用；保存失败保留 dirty 和可导出新工程，durable 状态如实反馈 | 成功、校验/写入失败、异常 | TS-P4 atomic apply/repository；R-051/R-054 |
| AC-P404 | 任意部分选择保留所有未选字段、人工 marker 和未选 binding；rerun/拒绝/丢弃 proposal 不更新已应用工程或 snapshot；恢复原工程可用 | 成功、部分/空选择、rerun | TS-P4 before/after canonical diff；R-054 |
| AC-P405 | 无对应 energy/beat 时默认绑定选择不可用，其他可用选择保留；默认横/竖独立确认，颜色/粗细/亮度/decay 不变 | 成功、缺数据/边界 | TS-P4 selection/UI；R-054/R-055 |

## 6. P5 — Visualizer V2

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P501 | V1→V2 迁移纯函数、无 I/O、canonical 确定、原字段/binding 语义不变；只写 V2/单草稿；无 processing snapshot 仍可用原源；未知 schema/字段、歌曲不符原子拒绝 | 成功、legacy/未知/损坏、边界 | TS-P5 codec/migration/repository；R-055 |
| AC-P502 | snapshot 仅 compact 数据与完整 identity/provenance；UInt16 payload 长度/finite/范围严格；不含音频/model/handle；十五分钟导出再导入 semantic round-trip | 成功、长度/身份损坏、长曲 | TS-P5 strict snapshot codec；R-051/R-055 |
| AC-P503 | resolver 按绝对秒数，30Hz energy/pulse 边界符合契约；detected beat 与 tempo-derived/downbeat 来源区分；缺失/失配 unavailable；默认横 other/竖 beat 仅替换所选 binding | 成功、seek/事件末端、缺失/失配 | TS-P5 source golden、renderer state；R-047/R-054/R-055 |
| AC-P504 | tempo 改后相关 snapshot/map stale，受影响 source unavailable；显式 diff 后一起刷新 Editor snapshot/map，binding/原检测证据不变；hash 冲突/刷新失败零部分替换，不回退旧 beat | 成功、stale/冲突/异常 | TS-P5 refresh integration/browser；R-054 |
| AC-P505 | 仍绑定 stale beat/downbeat 时 recording preflight 拒绝；刷新或显式移除后可继续；stem/constant/analysis/未受影响源不受阻，无额外播放上下文/Worker/RAF | 成功、stale/去绑定/边界 | TS-P5 recording/resource 回归；R-050/R-054 |

## 7. P6 — Complete Production

| ID | Pass condition | Coverage | Verification / risk |
| --- | --- | --- | --- |
| AC-P601 | Chrome/Edge 完成本地歌曲→显式三阶段→人工修正/刷新→映射→保存/恢复工程→WebM 保存/回放，全部脚本步骤通过；缓存清除/Worker 结束后工程 snapshot 仍可录制 | 成功、cache miss/恢复/边界 | TS-P6 完整任务及 owner 复核；R-051/R-054/R-055 |
| AC-P602 | GPU 不可用/分离失败可完成纯手动标记→映射→WebM，并可显式 mix-only；无 CPU/小模型自动 fallback，无音频上传 | 失败后恢复、手动成功/边界 | TS-P6 故障完整任务、网络记录；R-046/R-053 |
| AC-P603 | 新 processing/刷新 tempo binding 的双浏览器 WebM 有音视频、正确 preset/duration、可回放，A/V ≤100ms；沿用当前录制 fps/packet gap 等门禁，不静默降级 | 成功、录制取消/错误/边界 | TS-P6 impulse/flash 媒体分析和原生保存；R-047/R-049 |
| AC-P604 | 最终集成重验 AC-P305；20 次 route/track/cancel/retry/模板/录制 lifecycle 无资源单调累积，temp 五秒内清理或登记；未自动化项有 owner 结论/补偿，readiness 只覆盖新候选 | 成功、长曲/资源/异常 | TS-P6 性能、资源及缺口审计；R-049/R-050 |

## 8. Review Status

2026-10-04，owner 要求“实施计划”，按随附批准与 P1 质量规划计划明确批准本文及其余三份 delivery 文档（DEC-068）；全部现有阈值保持。尚无 AC-P 项通过、许可歌曲质量结论或模型 bytes/兼容/性能实测；R-046–R-055 不因文档批准改状态。人工介入次数/时间记录实际值，首轮不新增未经选择的硬阈值，也不以这些记录声称普遍歌曲质量。

## 2026-10-04 Authorization Update

DEC-069/070 接受 P1 eval/golden/失败分类并开放实现。P1–P6 按全部适用 AC、干净候选证据和必需人工输入自主关闭及推进，无需逐次申请代码提交或阶段批准；符合既定契约的后续质量文档纳入本授权。新产品/架构/兼容/阈值与发布决定仍需人工确认。历史批准范围按原日期保留；风险与缺口不因授权消失。

## P1 Implementation Checkpoint

2026-10-04，固定四模型实际 size/SHA 已校验，独立内核与 oracle/故障测试已实现。Chrome/Edge 的四图均在 `/real_istft/ConstantOfShape` provider 分配处创建 session 失败，未进入真实推断、parity、长曲或试听。P1 保持 In Progress、P2–P6 Planned；见 [P1 evidence](../../quality/processing/evidence-index.md)，不将合成/注入通过写成真实模型通过。

2026-10-04，owner 明确批准短段跨后端最大绝对误差上限 `1.5e-3`（DEC-071）。原始 ONNX、官方 ORT、独立 WASM、逐 sample 比较及其余验收门禁保持不变；历史 `1e-3` 失败证据保留，不构成 P1 关闭。
