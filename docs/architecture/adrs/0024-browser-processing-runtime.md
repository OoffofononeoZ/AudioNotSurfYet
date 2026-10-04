---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "进入 execution planning；首个切片验证四个 FT 模型的 WebGPU 兼容性、质量、资源与性能"
---

# ADR-0024: Browser Processing Runtime

## Context

浏览器 SPA 已拥有播放、编辑、可视化和 WebM 录制。owner 选择把自动处理保留在浏览器，避免额外运行时安装、服务启动和配对。已转换的 FT ONNX 权重提供浏览器分离的输入，但本仓库尚无这些模型在 WebGPU 上的兼容性、质量或性能证据。

## Decision

- 使用 ONNX Runtime Web 的 WebGPU 后端运行 `htdemucs_ft`。保留现有 analysis Worker，最多增加一个专用 separation Worker；模型任务不创建播放 AudioContext、RendererHost 或视觉 RAF。
- 四个专用模型依次加载、处理全曲分段、保存对应 stem 并释放 session/tensor，之后才加载下一个模型。模型来源、revision、SHA-256 和输出选择见 [模型契约](../processing/model-artifacts.md)。
- 首次使用展示模型总大小、逐文件下载与校验进度；校验后缓存复用。下载与音频处理分开计时；歌曲、PCM、stem、工程与结果均不上传。
- TypeScript 节拍分析复用现有 analysis Worker。分离与节拍任务由 Processor controller 管理 start、progress、cancel、result、error，以及 source/job/generation 身份。
- 模型与结果 metadata 使用 IndexedDB，大型 stem 使用 OPFS；10GB 可配置上限还须受实际 quota 限制，提供显式清理且无自动驱逐。
- WebGPU 不可用、模型不兼容或分离失败时明确报错。人工标记、视觉映射和实时 WebM 继续可用；不自动切换模型或 CPU 分离。

## Consequences

- Positive：用户在同一浏览器内完成处理与确认，沿用本地音频边界。
- Negative：约 662MB 模型下载、WebGPU 算子支持、浏览器内存和 origin quota 成为交付风险；fp16weights 仍以 fp32 运算，不能据文件体积推断显存减半。
- Compatibility：现有人工流程独立可用；新增分离 Worker 是对旧单 analysis Worker 边界的明确扩展，播放与渲染单例约束不变。
- Follow-up：锁定实际运行库版本及 assets，先验证模型输出、WebGPU 图、15 分钟目标与取消清理，再接入完整工作区。风险保持 Open。

## Alternatives

- 独立本机处理服务：拒绝；安装、启动、配对与进程管理不符合 owner 本轮选择。
- 云服务：拒绝；会改变本地音频与隐私边界。
- 手工外部工具导入：拒绝作为主流程；仍需跨阶段转录。
- CPU/小模型自动降级：拒绝；隐式改变质量、耗时与 provenance。

## Approval

2026-10-04，`project-owner` 明确要求实施随附浏览器架构修订计划，并授权将修订文档与 ADR 标记 approved、登记决定及创建本地文档提交。该批准开放 execution planning；它不证明模型兼容、分离质量、性能或 readiness 已通过。
