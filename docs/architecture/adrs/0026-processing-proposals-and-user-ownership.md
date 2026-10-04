---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "delivery 覆盖小节确认、工程 hash conflict、逐项 apply、rerun 和用户数据保留"
---

# ADR-0026: Processing Proposals and User Ownership

## Context

产品要求尽可能自动生成，同时保留人工修改和完全手动操作。若处理完成就直接写入 Editor 或 Visualizer，rerun、并发编辑和错误模型结果都可能覆盖用户时间标记和映射；若只导出文件让用户手工复制，又无法减少跨阶段转录。

## Decision

- 自动结果保存为只读 ProcessingProposalV1，不直接修改任何工程。
- Processor 的“应用提案”显示 ONNX/runtime/backend/TypeScript 算法 provenance、warning、算法评分、目标工程 canonical hash 和结构化 diff；用户分别选择 tempo、processing snapshot 和横/竖默认绑定后显式确认。
- 自动结果只有 BPM、逐拍和局部 tempo 候选，没有自动 meter/downbeat。用户确认各段小节起点、BPM 与拍号后才构造合法 Editor V1 tempoMap；不默认每四拍分组为已识别小节。
- apply 必须比较 proposal 创建时的目标工程 hash。工程已变化时返回 project-conflict，重新计算 diff；不尝试字段级猜测合并。
- 自动 tempo 使用 Editor V1 既有 bpmSource: estimated。用户修改后的 segment 继续使用 user；自动链路不生成 point/range 音色、FX 或 MIDI 事件。
- rerun 始终创建新 proposal。它不更新已应用工程，也不覆盖 user tempo、人工 marker 或现有 binding。替换任何已应用字段都需要新的显式确认。
- WebGPU/分离失败或 proposal 被拒绝时，用户可以直接进入现有 Editor/Visualizer 完成任务，也可显式运行 mix-only TypeScript 节拍分析。
- 多目标更新先全部准备和校验，再应用所选字段；失败不留下部分内存工程，持久化失败显式保留 dirty/export 路径。

## Consequences

- Positive：自动化减少重复录入，用户仍拥有工程事实；错误结果可以检查、部分应用或丢弃。
- Negative：用户必须执行确认步骤；工程在分析期间变化会要求重新审阅 diff。
- Compatibility：EditorProjectV1 不新增自动事件 schema；tempo 复用 estimated/user 语义。现有手动流程保持有效。
- Follow-up：delivery 必须覆盖 hash conflict、部分选择、rerun、用户 tempo/marker/binding 保留、小节确认、恢复和 WebGPU/分离失败路径，详见 [Worker 与工程契约](../processing/worker-and-project-contracts.md)。

## Alternatives

- 处理完成后自动覆盖工程：拒绝；违反人工所有权和 rerun 安全。
- 按字段自动三方合并：首版拒绝；现有工程没有足够的持久化 provenance 支持可靠无提示合并。
- 只提供外部 JSON/WAV 导出：拒绝作为主流程；仍要求用户跨阶段手工转录。

## Approval

2026-10-04，owner 随浏览器处理修订计划明确批准只读提案、人工小节确认、逐项 apply 和零隐式覆盖，并授权本地文档提交。该批准开放 delivery planning，不构成验证结果。
