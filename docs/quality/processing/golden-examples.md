---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/quality/processing/eval-plan.md"
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"
next_action: "DEC-071 已批准短段 max absolute 1.5e-3；继续原图双浏览器、真实拼接/WAV、取消、试听和十五分钟验证；P1 未完成"
---

# Browser FT P1 Golden Examples

## 1. Example Identity

本集合只覆盖 P1 AC-P101–P106，依据 [eval plan](eval-plan.md) 和批准模型/Worker 契约；所有条目均为预期，不是通过记录。本文 approved，fixture/harness 已实现、实际模型已校验；逐条结果见 evidence index。

合成 input/oracle 在正式运行前锁定版本、seed、sample rate/channel/frame count、config 和 hash，遵循仓库 fixture manifest 许可记录。model/runtime 身份引用批准表，时间/派生/WAV 的预期来自独立 oracle。每条 golden 的实际执行环境、结果、证据及失败类型单独记录；人工样例不伪造自动化数值。

## 2. Golden Matrix

| ID | Category / input | Expected outcome | Eval / AC / risk / failure type |
| --- | --- | --- | --- |
| P1-G01 | success：四个 pinned FT artifact | revision/file/size/SHA/许可来源完全匹配；drums/bass/other/vocals 专用身份可追溯 | P1-EV-MODEL；AC-P101；R-048；PFT-MODEL |
| P1-G02 | failure：模型改一 byte、截断或 revision/size 不符 | 校验拒绝，不建可用输入/session，不把半成品记成功；准确记录 checksum/identity 错误 | P1-EV-MODEL；AC-P101；R-048；PFT-MODEL |
| P1-G03 | success/failure：ORT 1.30.0 同版 JS/WASM 与错版/损坏 asset | 同版已锁资源可初始化；错版明确失败，不静默换版本，实际资产 identity 有记录 | P1-EV-RUNTIME；AC-P101；R-046/R-048；PFT-RUNTIME |
| P1-G04 | success：Chrome/Edge 实际四图 session/推断 | 每图 WebGPU 运行、shape/finite 正确；实际 kernel placement 记录，非全 GPU 不能称全 GPU | P1-EV-RUNTIME/ROLE；AC-P101/102；R-046/R-052；PFT-RUNTIME/PFT-ROLE |
| P1-G05 | failure：缺 navigator.gpu/adapter、图 unsupported、device lost/OOM | 对应 typed error、释放资源，不自动整图 WASM/CPU 或小模型重跑 | P1-EV-RUNTIME/CANCEL；AC-P101/106；R-046/R-049/R-050；PFT-RUNTIME/PFT-RESOURCE |
| P1-G06 | success/boundary：stub 输出四 row 有互异标记，四专用模型顺序处理 | 模型各取 row 0/1/2/3，仅产对应轨；drums→bass→other→vocals，前 session 释放后才建后者 | P1-EV-ROLE；AC-P102；R-052；PFT-ROLE |
| P1-G07 | failure：单专用模型冒充四轨、错 row/shape/type 或 NaN/Infinity | role/tensor/finite 校验拒绝，不发布四轨成功；other 不改称 lead | P1-EV-ROLE；AC-P102；R-046/R-052；PFT-ROLE |
| P1-G08 | success：确定性非零 stereo 短段 mix，同 ONNX/config 的 WASM 对 WebGPU | 四模型分别比较对应 row 全 sample；每轨 max absolute≤1.5e-3，报告 RMS/shape/finite | P1-EV-PARITY；AC-P102；R-046/R-052；PFT-NUMERIC |
| P1-G09 | failure：parity 超差、参考不可运行或非有限 | 独立失败/缺口，不能改成 skip/pass、自对照或只报平均值，P1 不关闭 | P1-EV-PARITY/EVIDENCE；AC-P102；R-046/R-052；PFT-NUMERIC/PFT-EVIDENCE |
| P1-G10 | boundary：44.1/48kHz 恒等/脉冲 oracle，首尾带静音 | 补偿重采样延迟，事件绝对时间≤一个输出 sample，保留静音时长与整曲基准 | P1-EV-TIME；AC-P103；R-047；PFT-TIME |
| P1-G11 | boundary/failure：mono、stereo、3 channel input | mono 仅在模型边界复制 stereo，原 descriptor/hash 不变；stereo 正常；>2channel 明确不兼容，不默 downmix | P1-EV-TIME；AC-P103；R-047；PFT-TIME |
| P1-G12 | boundary：44.1kHz 输入 1、343980、343981、2×257985+17 frames | 输入都按 343980-frame 模型边界 padding/分段；输出保留对应实际帧数，不导出 padding 或丢尾段 | P1-EV-TIME；AC-P103；R-047；PFT-TIME |
| P1-G13 | boundary：脉冲位于 stride=257985 前/后一个 frame，真实 FT 多段与非整尾 | oracle 无重复/缺帧/平移；真实 FT 全轨长度正确并记录接缝质量，不要求真实模型产生理想 impulse | P1-EV-TIME/QUALITY；AC-P103/105；R-047/R-052；PFT-TIME/PFT-QUALITY |
| P1-G14 | failure：PCM 缺帧/重复/乱序、hash 不符，输出长度需 >一个 sample 校正 | start/拼接校验拒绝，原 PCM 不变，不发布看似完整结果；合法≤一个 sample 尾修正记录 | P1-EV-TIME；AC-P103；R-047；PFT-TIME |
| P1-G15 | success/boundary：零能量、恒定振幅、L/R 不同能量、非整30Hz末窗 | 独立平方均值 RMS→dBFS→clip[-80,0]→UInt16 oracle；零为0，length=ceil(30×duration)，payload恰为length×2 LE bytes | P1-EV-DERIVED；AC-P104；R-047/R-052；PFT-DERIVED |
| P1-G16 | success/failure：四轨 waveform/Float32 WAV 与损坏 header/样本、导出写失败 | 同一 stem 派生；独立 parser 证实 stereo/44.1kHz/IEEE Float32/frame count/samples；不改增益/裁静音；失败如实反馈 | P1-EV-DERIVED；AC-P104；R-047/R-052；PFT-DERIVED |
| P1-G17 | success/boundary：处理前后原 AudioEngine PCM hash、range/revision、播放 | 不 detach/修改 Engine buffer，有界复制仍 obey revision；保持唯一播放 AudioContext和原播放功能 | P1-EV-TIME/REGRESSION；AC-P103/106；R-047/R-050；PFT-TIME/PFT-RESOURCE |
| P1-G18 | manual：三首许可歌曲，每首四轨 WAV | 12条角色/串音/断裂/伪影记录及三档结论；任何不可用阻止关闭，不以数值 pass 替代听感 | P1-EV-QUALITY；AC-P105；R-052；PFT-QUALITY |
| P1-G19 | performance：两浏览器各十五分钟新结果、RTX4060 Laptop 8GB | 每浏览器分离<900秒且无OOM，含staging/session/stitch/derive/persist；反馈≤100ms、heartbeat≤1s，环境/峰值采样完整 | P1-EV-PERF；AC-P106；R-049；PFT-RESOURCE |
| P1-G20 | race/exception：下载/加载/推断/拼接/派生/写入中取消、Worker 崩溃及迟到消息 | cancel幂等、旧generation不发布；session/tensor/Worker释放，五秒内temp清理或登记residual IDs，旧完整数据不误删 | P1-EV-CANCEL；AC-P106；R-050；PFT-RESOURCE |
| P1-G21 | boundary：20次 harness 进入/退出、换source、retry/cancel | 稳定点session/tensor/Worker/播放上下文/临时artifact不单调累积；最多一个专用分离Worker，proxy关闭 | P1-EV-CANCEL/REGRESSION；AC-P106；R-050；PFT-RESOURCE |
| P1-G22 | manual/exception：Chrome/Edge 原生 WAV 保存、取消、系统回放 | 真实保存可打开，取消不误报成功、不改原PCM；记录人工检查和日期，OPFS pass不能替代 | P1-EV-DERIVED/EVIDENCE；AC-P104/106；R-047/R-050；PFT-DERIVED/PFT-EVIDENCE |
| P1-G23 | failure：缺真实浏览器/端口受限、只mock session、无峰值/许可/人工结论、dirty 被称 canonical | 缺失项明确unverified/failure，记录原因/残余风险/补偿；P1不提前关闭，不继承历史豁免 | P1-EV-EVIDENCE；AC-P101–P106；R-046/R-048/R-049/R-052；PFT-EVIDENCE |
| P1-G24 | boundary：模型cache重跑、热session、结果cachehit或下载计时 | 优化/下载另报，不作为十五分钟新结果基线；P1测速不冒充完整分离加节拍目标 | P1-EV-PERF/EVIDENCE；AC-P106；R-049；PFT-RESOURCE/PFT-EVIDENCE |

## 3. Oracle and Manual Records

P1-G06 使用不同 row 标记验证 selector，P1-G08 使用真实四 ONNX 验证模型对应输出；前者不能替代后者。P1-G10/G12/G13 的恒等/脉冲验证时间变换，真实 FT 另检 frame/finite/WAV/接缝，不能混用模型扩散与重采样误差。

P1-G15 的 codec/version/config 和精确预期 payload 在 fixture manifest 固定，独立生成；不得调用待测 energy 实现创建答案。P1-G16 以 artifact Float32 samples 为源，独立读取 WAV format/data/frame，不依赖额外产品编码程序。

人工记录使用歌曲匿名 ID `P1-Q01`、`P1-Q02`、`P1-Q03`，每首 drums/bass/other/vocals 共12行。每行包含角色可辨识、串音、断裂、伪影、结论及 owner 日期；许可确认按匿名 ID 登记。当前尚无歌曲/许可/试听结果；不提交音频/WAV、私有名称/路径/内容 hash。

case 只有在所有子条件和指定浏览器/人工检查均完成时才可写通过。参数/模型/runtime/来源改变先复核规范，不改 golden 来消除失败。

## Approval

2026-10-04，owner 要求实施本轮计划（DEC-070），本质量契约获批。DEC-069 允许证据满足后自主推进；本批准不补写模型运行、人工试听或性能结论。

## Implementation Evidence

实际运行及缺口见 [P1 evidence index](evidence-index.md)。合成/注入通过与真实四图不兼容分别记录，预期样例不是通过声明；本轮没有 P1 关闭或风险缓解结论。

2026-10-04，owner 明确批准短段跨后端最大绝对误差上限 `1.5e-3`（DEC-071）。原始 ONNX、官方 ORT、独立 WASM、逐 sample 比较及其余验收门禁保持不变；历史 `1e-3` 失败证据保留，不构成 P1 关闭。
