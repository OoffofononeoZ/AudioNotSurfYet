---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/architecture/processing/model-artifacts.md"
  - "docs/delivery/processing/execution-plan.md"
  - "docs/quality/processing/eval-plan.md"
next_action: "DEC-071 已批准短段 max absolute 1.5e-3；继续原图双浏览器、真实拼接/WAV、取消、试听和十五分钟验证；P1 未完成"
---

# FT P1 Kernel Configuration

本文件落盘 owner 已批准实施计划的具体内核配置；批准不代表真实 FT 可用。P1 独立入口为 `tests/processing/index.html`，未注册生产 Processor 路由。`src/processing/` 是待验证的复用内核，P1 的简化消息类型是 harness 适配器，生产接口仍以 [Worker 契约](worker-and-project-contracts.md) 为准。

## Fixed Runtime and PCM

- `onnxruntime-web@1.30.0`，npm integrity 与六个实际部署文件的 bytes/SHA 固定在 `src/processing/runtime-manifest.json`；`processing:assets` 拒绝安装文件与该 manifest 不符。P1 v2 选择同包 `ort.all.min.mjs` 的 JSEP WebGPU 构建及 JSEP JS/WASM（约29.18 MB），WASM reference 使用标准 WASM（约14.31 MB），不把整个 npm 包体积当成浏览器下载量。原 Asyncify 构建的失败保留在历史 evidence。
- `graphOptimizationLevel=disabled` 对 GPU 与 WASM reference 一致；默认 all 优化在两构建的原图 session 创建中出现 `std::bad_alloc`。JSEP 能执行内部 DOUBLE 路径，原始四个 ONNX bytes 未改。非默认优化及派生图/运行库只用于隔离诊断，不能作为默认 P1 pass。
- 显式 WebGPU EP、高性能硬件 adapter，proxy=false、numThreads=1；不启用 graph capture、不增加 CPU 重跑。模型顺序和角色来自原固定模型表，保存原始错误日志以核对 kernel placement。
- native PCM 以 16384-frame 分块、保持原 channel 数写入 OPFS，增量 SHA-256 身份为版本化 descriptor JSON 后按块逐 channel 的 Float32 bytes；当前支持目标 Chrome/Edge Windows 的 little-endian Float32。Worker 重验完整长度/hash，mono 仅在模型边界复制，不创建播放上下文。
- 输出 44.1kHz；64-tap Blackman windowed-sinc、1024 相位、cutoff=min(1,44100/sourceRate)、归一化系数、Float64 累加后 Float32；零相位补偿、边界 zero padding，44.1kHz 直接复制。所有分段按原始绝对 frame 索引取样。

## Segment and Artifact

- 343980-frame segment，overlap=85995、stride=257985，尾部补零。核对 pinned drums `infer.py` 后不增加外部 normalization，其他专用图实际兼容仍须逐个证明。
- 线性过渡与归一化 overlap-add，仅保留当前窗口及 overlap。参考脚本首采样权重为零；本实现把未覆盖端点权重下限设为 1e-8，防止静默丢失第一采样，不改变时间/frame count。独立恒等与脉冲 oracle 已覆盖 1、完整段、跨段和短尾。
- 同一拼接数据流写出每轨 planar Float32 和 stereo IEEE Float32 WAV，并生成 30Hz 双声道均方 RMS 的 [-80,0]dBFS UInt16 energy 与 waveform min/max；无增益、裁静音或额外编码程序。
- P1 预检以 origin usage/quota 保守计算 native PCM、四轨 planar/WAV 和全部模型，默认上限10GiB；不自动驱逐。精确 cache accounting、租约和清理 UI 留在 P2。任务失败只清理其 UUID 目录；五秒不能清理则记录 residual ID。
- 四轨完整后由当前 controller 检查 job/generation/source/role，再向独立 IDB results 发布 metadata；取消和迟到消息不能替换当前结果。测试专用入口不修改 Editor/Visualizer 工程。
- controller 在 start 同步报告暂存开始；Worker 无新消息时主线程提供带 `heartbeatSource=controller` 的 elapsed 反馈，保持 phase/completedUnits 不变，不把它当作 Worker 仍在推进的证明。Worker 的实际消息标记为 `worker`。取消后停止反馈；4.5秒仍无终态则终止 Worker，登记 residual ID 并发出唯一 cancel，给五秒门禁保留调度余量；异步清理不能再次发送终态。
- quota预检依赖estimate，不能保证每次真实写入。写入中QuotaExceededError按quota-exceeded明确报告，abort当前writer、释放session并清理本任务；不驱逐其他缓存或转成CPU重跑。大型验证使用独立普通磁盘profile，原始PCM完整持有且处理后重验hash，隔离profile的临时容量失败独立保留为证据。

## Validation Boundary

单元/注入成功不证明四个真实模型可运行。2026-10-04 原 Asyncify 构建的双浏览器 session 均报告 `/real_istft/ConstantOfShape` provider 未分配。随后同版本 JSEP + disabled 优化在双浏览器四图实际推断成功，GPU profile 记录 Conv/ConvTranspose；bass/other/vocals parity 通过，drums 最大误差约0.00130，超过0.001门禁，尚不能关闭 P1。长曲与试听仍未通过。R-046–R-055 保持 Open，P2 不开放；后续任何精度修正保留独立失败证据，不降低阈值或增加整图 CPU 重跑。

2026-10-04，owner 明确回复“批准 0.0015，继续完整验证（推荐）”。DEC-071 据此批准四专用模型对应 row 短段跨后端 max absolute ≤`1.5e-3`，保留原始模型和官方运行库，继续全部适用验证。上文按原 `1e-3` 的失败属于历史记录；P1 仍 In Progress、P2 Planned、R-046–R-055 Open。详见 [numeric review](../../quality/processing/numeric-review.md)。
