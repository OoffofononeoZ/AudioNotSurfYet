---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/visualizer/project-format-v1.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "保留历史批准；当前原子元素与预设生成改用 DEC-082 和 content-generation 契约"
---

# ADR-0021: Controlled Visualizer Scene Generation

> 2026-10-18 适用关系：下文保留 2026-09-04 的批准事实。Project V3 已移除旧模板注册；DEC-082/[当前内容生成契约](../visualizer/content-generation.md)替代本 ADR 的输入 schema、注册与测试执行步骤，将输入校验和具体合同审批延续到所有新增原子元素与组合预设。历史 evidence/readiness 不变。

## Context

Visualizer V1–V6 以 Orthogonal Lines 与 Cube Swarm 两个内置模板完成了绑定、确定性、单 RendererHost、录制和资源恢复验证。“首版两个模板”是历史交付事实，不应永久阻止产品在相同架构边界内增加内置场景；但直接按模糊视觉描述写 renderer，容易引入未声明绑定、RAF delta、资源泄漏或放宽 JSON 校验。

## Decision

- 允许 post-V6 追加编译期内置场景，但必须通过两阶段门禁：先把自然语言规范化为完整 `SceneBriefV1`，再形成确定 Scene Contract 并等待 owner 明确批准。任一门禁未通过都不修改仓库。
- 完整 brief 至少包含一个主要数据驱动效果的视觉样式、被驱动属性、绑定数据类型、低/高响应语义和时间行为；vector 和 integrated 行为还须提供各自的分配、单位与边界语义。
- 获批 Scene Contract 固定模板 ID、参数/default bindings、具体 Feature Registry 映射、seed/绝对时间模型、资源预算、golden 状态和测试方案，并保存到 `docs/architecture/visualizer/scenes/<template-id>.md`。
- 实现只扩展现有 `VisualizerTemplateId`、strict JSON V1 白名单和 `SceneRegistry`。`schemaVersion`、`templateVersion`、默认 `orthogonal-lines`、scene 接口和单 Canvas/renderer/RAF/AudioContext/Worker 拓扑不变。
- 默认分析特征通常不超过两个，三至四项须在合同中解释，四项为硬上限。新场景须满足确定性 hash、参数级 fallback、context recovery、录制尺寸切换、幂等释放和强制测试矩阵。
- 用户脚本、运行时插件和任意 Shader 注入继续禁止。若需求涉及新 binding/value/projection、JSON 版本、第二渲染链路、超过四项特征或外部资产许可，停止生成并转入独立架构评审。

## Consequences

- Positive：新增场景获得统一、可审查且可重复验证的入口，不必把每个内置 renderer 都升级成新里程碑。
- Positive：历史 V1–V6 canonical 保持不可变；每个新场景的测试证据与整体 readiness 重评明确分离。
- Negative：即使 brief 完整也必须等待一次 Scene Contract 人工批准；旧应用会继续严格拒绝它不认识的新 template ID。
- Follow-up：创建并安装项目级 `visualizer-scene-generator` Skill、无依赖输入 validator 和 Skill 测试；首个实际新场景不在本决策交付范围。

## Alternatives

- 固定永远只有两个模板：拒绝，会把历史首版范围误当成长期产品上限。
- 运行时加载用户 JavaScript、插件或 Shader：拒绝，破坏 strict project、安全、确定性与资源边界。
- 输入完整后直接生成代码：拒绝，具体 FeatureId、默认值、资源预算和 golden 状态仍需要 owner 审批。
- 为每个场景创建完整 V 里程碑与 canonical：拒绝，粒度过重；场景代码和测试完成后改为重新评审现有 Visualizer readiness。

## Approval

2026-09-04，`project-owner` 明确要求实施完整 Visualizer Scene Generator Skill 落地计划；该指令批准 DEC-056、本 ADR 与受控扩展契约，但不批准任何尚未提交的第三个场景。
