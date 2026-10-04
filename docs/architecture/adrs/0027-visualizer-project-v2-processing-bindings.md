---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/adrs/0015-visualizer-project-and-binding-boundary.md"
next_action: "delivery 验证 V2 codec、V1 单向迁移、默认映射和 Editor tempo 修改后的显式快照/节拍刷新"
---

# ADR-0027: Visualizer Project V2 Processing Bindings

## Context

Visualizer Project V1 的 binding 只支持 constant、analysis 和 editor-event，也明确不嵌入 Analyzer 数组/cache。新流程需要在分离 Worker 释放、OPFS cache 清除后仍用四 stem energy 和 beat 驱动画面；用户改 tempo 后也不能继续默用旧节拍。嵌 stem audio 会放大工程体积，在 V1 宽松加入字段会破坏 strict codec。

## Decision

- 引入 VisualizerProjectV2，增加可选 processingSnapshot/source。snapshot 嵌四轨 30Hz UInt16 energy、检测 beat、warning、source identity、ONNX/ORT/WebGPU/TypeScript provenance 和 proposal id；小节首拍仅在用户确认 tempo 后派生，来源标为 editor-tempo-derived。
- V2 不嵌 stem audio、模型权重、绝对文件路径或 OPFS handle。
- processing source 支持 stem-energy(vocals/drums/bass/other)、beat 和用户确认 map 的 downbeat；resolver 复用绝对 AudioContext 秒数和现有单 RendererHost/RAF，不创建 polling、AudioContext 或 Worker。
- V1 通过确定性纯函数单向迁移到 V2：旧字段与 binding 语义保持，processingSnapshot 省略。import 接受 V1/V2；新建、草稿和导出只写 V2，不双写、不降级导出。
- 用户明确应用默认映射时，Orthogonal Lines horizontalIntensity 使用 other energy，verticalIntensity 使用 beat pulse；其余参数沿用模板默认。已有 binding 只有在 diff 中选中才替换。
- snapshot 与当前歌曲 identity 不一致时 processing source 为 typed unavailable；constant/analysis/editor-event 和 WebM 录制继续工作。
- Editor tempo 修改后相关快照/派生 beat map 标 stale；用户显式刷新 Editor 快照与节拍映射，审阅 diff 后一起更新。beat 使用刷新后的 tempo-derived map，检测 beat 保留为只读证据；缺确认 map 的 downbeat 不可用。绑定 stale source 时录制 preflight 要求刷新或显式移除绑定，不默用旧结果。

## Consequences

- Positive：compact 处理数据随工程携带，录制不依赖分离 Worker/cache；旧 V1 工程可确定迁移并继续使用。
- Negative：Project schema 升级、snapshot size 和迁移测试成为新的维护成本；V2 不能导回 V1。
- Compatibility：旧 scene registry、Editor snapshot、recording preset、单草稿和 strict validation 保留；V1 历史 evidence 不被改写，新 V2 需要独立 delivery/eval。
- Follow-up：按 [Worker 与工程契约](../processing/worker-and-project-contracts.md)定义 V2 codec/golden、size boundary、迁移、identity、resolver、默认映射、tempo 刷新与 WebM regression。

## Alternatives

- 扩展 V1 且保持 schemaVersion 1：拒绝；违反 strict codec 和未知字段失败语义。
- 长期 V1/V2 双写：拒绝；会形成两套编辑与恢复事实。
- Visualizer 运行时按需读取 OPFS stem cache：拒绝；工程可移植性与录制会被缓存生命周期影响。
- 工程嵌入 stem audio：拒绝；体积、序列化和许可成本不符合第一版目标。

## Approval

2026-10-04，owner 随本轮计划明确批准 V2、processing source、V1 单向迁移、默认映射和显式 tempo 刷新，并授权本地文档提交。既有 V1 evidence 身份保持；V2 尚需 delivery/独立验证，R-055 保持 Open。
