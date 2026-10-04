---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/delivery/processing/execution-plan.md"
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/delivery/processing/test-strategy.md"
  - "docs/delivery/processing/milestone-plan.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "DEC-070 ?? P1 ????????? FT harness ????????????/????? P1"
---

# Browser FT P1 Eval Plan

## 1. Boundary and Status

DEC-068 于 2026-10-04 批准四份 processing delivery，并仅开放 P1 质量规划。本计划只评价 AC-P101–P106 / TS-P1 的独立 FT harness：模型与运行库身份、四图 WebGPU、正确取轨、参考数值、时间变换、派生数据/WAV、人工质量、十五分钟分离与取消资源。

本文与 [golden examples](golden-examples.md)、[failure taxonomy](failure-taxonomy.md)均为 in-review、暂不提交；没有 P1 实现、fixture bytes、模型下载、运行结果或人工试听通过。P1 实际实现与 P2–P6 保持 Planned，R-046–R-055 全部 Open。不评价 Processor 生产工作区、缓存管理、节拍 F1、工程 apply、V2 或 WebM；这些由后续切片独立验证。

owner 为 project-owner。全部阈值沿用已批准 [acceptance criteria](../../delivery/processing/acceptance-criteria.md)，不在 quality 层重新放宽。

## 2. Evaluation Matrix

| Eval ID | Behavior / coverage | Method | Pass threshold | AC / risk | Failure type |
| --- | --- | --- | --- | --- | --- |
| P1-EV-MODEL | 四 artifact/revision/size/SHA/许可；成功、损坏失败 | manifest/bytes 校验及 checksum 故障 | 完全匹配批准模型表；未校验/半成品不成为可用输入，身份不符明确失败 | AC-P101；R-048 | PFT-MODEL |
| P1-EV-RUNTIME | ORT/assets/WebGPU session/后端；成功、缺 capability/图不支持/device 异常 | Chrome/Edge 每模型实际 session，asset/capability 故障注入 | 固定 ORT 1.30.0 与 delivery npm integrity/部署 asset SHA；四图均可运行，实际 kernel placement 有记录，不自动整图 CPU 重跑 | AC-P101；R-046/R-048 | PFT-RUNTIME |
| P1-EV-ROLE | 专用 row、shape/finite、顺序释放；成功、错 row/shape/NaN、边界 | selector unit、标记 row oracle、真实四模型输出/session timeline | drums/bass/other/vocals 各取 row 0/1/2/3；输入 [1,2,343980]、输出 [1,4,2,343980] Float32；session 不重叠 | AC-P102；R-046/R-052 | PFT-ROLE |
| P1-EV-PARITY | 对应四轨短段数值；成功、超差/参考不可用 | 隔离顺序 WASM reference 对 WebGPU，同 ONNX/input/config | 每模型对应 row 全量 sample max absolute ≤1e-3，finite/shape 完全通过；RMS 误差另报，不能替代 max | AC-P102；R-046/R-052 | PFT-NUMERIC |
| P1-EV-TIME | 有界原 PCM、resample/overlap/tail、声道；成功、缺帧/hash/超限、边界 | 独立恒等/脉冲 oracle、真实 FT 拼接、AudioEngine 前后 hash | 原 PCM 不变；44.1/48kHz、mono/stereo、短尾/静音保持时间；oracle ≤一个输出 sample；frame=round(source duration×44100)，尾部校正≤一个 sample；>2ch 明确拒绝 | AC-P103；R-047 | PFT-TIME |
| P1-EV-DERIVED | waveform、30Hz energy、Float32 WAV；成功、零能量/末窗、导出异常 | 独立 RMS/codec oracle、waveform source 检查、独立 WAV parser | 同一 stem；energy length=ceil(30×duration)、UInt16 payload/数值一致；WAV stereo/44.1kHz/IEEE Float32，header/frame/样本与 artifact 一致 | AC-P104；R-047/R-052 | PFT-DERIVED |
| P1-EV-QUALITY | 三首许可歌曲 12 WAV；人工成功/不可用 | owner 试听与逐轨四维记录 | 每项角色可辨识、串音、断裂、伪影均记录；结论仅可用/需复核但可用/不可用；任一不可用阻止关闭 | AC-P105；R-052 | PFT-QUALITY |
| P1-EV-PERF | 参考机十五分钟分离、反馈/heartbeat/峰值；长曲/资源边界 | 两浏览器真实长曲、trace、系统/GPU 采样 | 每浏览器新结果 <900秒、无 OOM、反馈≤100ms、heartbeat≤1s；包括 staging/session/stitch/derive/persist，峰值和采样方法完整 | AC-P106；R-049 | PFT-RESOURCE |
| P1-EV-CANCEL | 下载/初始化/推断/拼接/派生/写入取消，重复生命周期；成功、竞态/Worker 异常 | controller/Worker 注入、真实取消与 20 次 lifecycle probe | 旧 generation 不发布结果；cancel 幂等、释放 session/tensor/Worker；temp 五秒内清理或登记 residual IDs，无 session 逐次累积，旧完整 artifact 不误删 | AC-P106；R-050 | PFT-RESOURCE |
| P1-EV-REGRESSION | AudioEngine descriptor/range、单播放上下文、现有分析；成功、邻接回归 | 既有专项及 harness isolation 检查 | 原 range/revision/PCM 所有权和播放可用；analysis Worker 外最多一个分离 Worker，proxy 关闭；无新未处理异常 | AC-P103/106；R-047/R-050 | PFT-RESOURCE |
| P1-EV-EVIDENCE | 候选/日志/环境/许可/缺口身份；证据审计 | 逐项 AC/eval/golden 与 artifact/summary 核对 | 必需项无缺失，无模型/用户数据/环境假结论；canonical 绑定干净实现 commit，manual 未完成不得写通过 | AC-P101–P106；R-048/R-049/R-052 | PFT-EVIDENCE |

## 3. Reference and Oracle Identity

四模型以 [Model Artifacts](../../architecture/processing/model-artifacts.md) 为唯一 revision/size/SHA/role 来源，不复制另一套可漂移模型表。ORT 1.30.0 的 npm integrity 及分段参考来源沿用 [execution plan](../../delivery/processing/execution-plan.md)和 [test strategy](../../delivery/processing/test-strategy.md)。

WASM reference 仅在测试环境顺序执行，相同输入/模型/config，对应 row 比较；与 WebGPU session 不同时驻留，不进入产品 fallback。若 reference 无法运行，保留具体失败和缺口，阻止 parity/P1 关闭；不能用待测实现或 WebGPU 自对照代替。

短段数值基准使用确定性非零 stereo 合成输入，不以纯静音作为唯一 parity。时间 oracle 使用恒等/脉冲模型，派生 oracle 独立计算 RMS/codec、解析 WAV；不能调用待测 resampler/overlap-add/energy/encoder 生成预期答案。真实 FT 接缝/导出另验，不要求模型产生理想 impulse 或四轨相加恒等 mix。

fixture/config/version/seed/数据 hash 与参考代码身份在运行前固定；分段 343980、overlap 85995、stride 257985、尾段 zero padding/过渡窗须核对实际 export 图及固定脚本，再登记 preprocessing/hash。不得盲加第二次 normalization；参数改变先复核对应契约和 golden，不事后修改 oracle 掩盖失败。

## 4. Run Order and Required Evidence

质量契约获批后按下列次序执行；以下是计划分组，不是已经存在的 npm 命令或固定 canonical pass count：

1. 身份/许可/bytes 与 JS/WASM asset 校验。
2. 四模型 Chrome/Edge session、对应 row、数值 parity；不通过则停止昂贵长曲接入。
3. 时间/声道/边界、派生/WAV、故障、取消和邻接回归。
4. 双浏览器十五分钟分离及资源指标，三首歌曲的 12 WAV 人工质量；缺歌曲时可先做其他项，但不能关闭 P1。
5. 当前候选证据审计、owner 复核；全部适用 AC 通过后才请求 P1 关闭/P2 开放。

| Evidence group | Required fields / artifacts |
| --- | --- |
| Run identity | P1 run ID、provisional/canonical、候选 commit/worktree 状态、起止时间、步骤结果/日志、summary SHA-256；失败记录独立保留 |
| Runtime/model | 四 artifact revision/bytes/SHA、ORT/npm integrity/asset hashes、preprocessing/config identity、tensor/对应 row、session 生命周期、实际 kernel placement |
| Numeric/time | 合成 fixture/hash/seed/oracle 身份、每轨 max/RMS 误差、frame/time/首尾/接缝结果、源 PCM 不变、WAV/energy 独立检查 |
| Environment/performance | 实际 Windows/Node/npm/Chrome/Edge、RTX 4060 Laptop 8GB adapter/driver、供电/RAM、分阶段及总 wall-clock、峰值与采样方法、反馈/progress 时间序列 |
| Cancel/resource | 取消阶段、job/source/generation、terminal、session/tensor/Worker/播放上下文计数、20次 baseline、五秒清理或 residual IDs |
| Manual/gaps | 匿名歌曲 case ID/许可确认、12条质量结论、原生保存/回放、未验证项/原因/残余风险/补偿及 owner review 日期 |

P1 长曲基线要求模型已校验缓存、原曲已解码、结果 cache miss、新 session；处理计时包括 start 前 PCM hash/staging。模型下载/原曲解码/人工确认另计，cached result 或热 session 重跑不能代替基线。P1 <900秒仅为必要前置，不能声称 P3/P6 完整分离加节拍目标已通过。

## 5. Evidence Gaps and Compensation

| Gap | Reason / residual risk | Owner / compensation and closure rule |
| --- | --- | --- |
| 模型实际 bytes、四图运行与 WASM reference | 当前仅有批准的 artifact 元数据，图/runtime 未实测 | project-owner；质量批准后真实下载/推断，任何关键缺项阻止 P1 关闭 |
| 三首歌曲许可/听感 | 合成/parity 不证明实际分离质量，没有真值 stem SDR | project-owner；本地提供许可并试听12 WAV，任一不可用阻止关闭 |
| native WAV save/回放 | OPFS/自动化不能证明 OS 取消/保存/播放器行为 | project-owner；Chrome/Edge 手动保存、取消及打开 WAV，记录结果 |
| kernel placement、主存/显存峰值 | 浏览器未必暴露完整内部计算/显存 | 工程 trace/probe 加 owner 系统/GPU 工具采样；记录粒度/缺项，不宣称全图 GPU |
| 真实 device lost/OOM | 注入只验证恢复，不能证明驱动压力稳定 | 双浏览器长曲及取消实跑；保存实际异常，不以注入 pass 代替 |
| 端口/浏览器环境不可执行 | 不能形成真实 session/长曲证据 | 明确 unverified 与所缺 eval/AC；不沿用 Editor DEC-055 为 processing 豁免 |

可提交 evidence 仅包含公开模型/runtime、合成 fixture 身份和匿名人工结论；不含歌曲/WAV、私有文件名/路径/hash、PCM 或歌词。所有模型/GPU/数值失败保留原结果；任何 AC 违反或关键证据缺失均阻止 P1 关闭，不自动换 runtime/model/后端或扩充 fallback。

## Approval

2026-10-04?owner ????????? FT ?????DEC-070??????????DEC-069 ?????????????????????????????????
