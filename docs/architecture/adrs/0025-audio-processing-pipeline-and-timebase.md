---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "在 delivery 定义 FT 四模型、PCM 拼接、TypeScript 逐拍/局部 tempo、quota 与十五分钟性能验证"
---

# ADR-0025: Audio Processing Pipeline and Timebase

## Context

目标流程需要四轨分离、逐拍位置、变化 BPM 候选和连续 energy。首尾静音、鼓轨空白、模型重采样与分段会造成时间漂移；逐拍跟踪不能据此识别小节起点或拍号。owner 选择复用现有 TypeScript 分析并由用户确认小节信息。

## Decision

- Processor 采用“分离音轨 → 分析节拍 → 应用提案”的显式阶段，不自动串行提交工程。
- browser-decoded PCM 是唯一绝对时间基准。Worker 使用有界本地 PCM 分块，canonical descriptor/channel Float32 LE hash 不受块大小影响；44.1kHz 重采样、overlap-add 和首尾处理必须保留原绝对秒数。
- separation 固定 `htdemucs_ft` 的四个 ONNX 专用模型，依次推断且只取对应 drums/bass/other/vocals row；采用 [模型契约](../processing/model-artifacts.md)锁定的 fp16weights、来源 revision 与 checksum。不把 other 命名为 lead，不提供首版模型选择。
- 每个 stem 生成 30Hz、-80dBFS 至 0dBFS、UInt16 compact energy；首版提供 waveform 与 WAV 导出，不建立应用内多轨试听。
- 复用频谱通量、onset envelope、自相关 BPM 和现有置信度判断，增加动态规划逐拍跟踪，以局部 interval 生成 tempo 候选。原 mix 为主，drums 仅作 ±70ms 辅助交叉证据；算法评分不表示神经网络概率。
- 不自动识别 downbeat/拍号，不把每四拍分组称为识别。Editor 用户确认小节起点、BPM 与拍号后，才生成合法 tempo map 并派生小节首拍；无可靠 beat 时 BPM 为 null、tempo candidates 为空。
- cache key 包含 source/PCM、四模型 revision/hash、ORT Web/assets/backend、算法版本和 canonical config hash。IndexedDB 保存模型与结果 metadata，OPFS 保存大型 Float32 stem；浏览器编码 WAV。10GB 可配置且受实际 quota 限制，无自动驱逐。
- 参考机 NVIDIA RTX 4060 Laptop 8GB 的十五分钟歌曲，从模型已下载/校验且原 PCM 已解码开始，到四轨与 beat/tempo proposal ready，处理目标为 ≤15 分钟且无 OOM；本地 staging、session 初始化、拼接和结果写入都计时。下载另计，目标尚未实测。

## Consequences

- Positive：处理结果与现有秒数时间轴一致，cache 可验证，四 stem energy 和节拍能直接用于视觉映射。
- Negative：四模型分段顺序执行与浏览器 quota 增加耗时/存储风险；局部 tempo、小节起点与拍号仍需人工复核。
- Failure behavior：duration/hash/model/cache 不一致必须失败；WebGPU 不可用或 OOM 不自动降级；无可靠 beat 不伪造 tempo 或 meter。
- Follow-up：fixture 覆盖四模型输出选择、拼接/WAV、固定/变化 BPM、首尾静音、鼓轨空白、半速/倍速、低置信度、取消、quota 和十五分钟资源/性能。

## Alternatives

- 增加神经网络节拍/downbeat 依赖：拒绝首版；owner 选择扩展内部 TypeScript 算法，并保留小节信息人工确认。
- 替换分离模型：延后；来源、许可、四轨质量、浏览器算子与资源需独立批准。
- drums-only BPM：拒绝；鼓轨空白会丢失歌曲结构，drums 只作为辅助证据。
- 自动 CPU/轻量模型 fallback：拒绝；会隐式改变质量、耗时和 provenance。

## Approval

2026-10-04，owner 随本轮实施计划明确批准上述模型、时间、节拍、cache 与性能目标决定，并授权本地文档提交。批准开放 delivery planning，风险与实测缺口继续保持 Open。
