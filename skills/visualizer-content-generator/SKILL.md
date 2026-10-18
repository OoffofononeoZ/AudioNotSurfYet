---
name: visualizer-content-generator
description: 为 AudioNotSurfYet 新增 Visualizer 原子元素和组合预设，先校验 VisualizerContentBriefV1，再展示具体 Content Contract 并等待批准，获批后生成 Project V3 内容及测试。已有内容的修正、诊断使用 audio-visualizer-dev；不用于图片素材、音轨分离或自动标记。
---

# Visualizer 内容生成

## 职责与路由

用于新增编译期原子元素、仅复用已有元素的预设、包含新增元素的预设。用户描述完整“场景”时，先拆成可独立编辑的元素和组合预设，不恢复旧 SceneRegistry 或单模板工程。

元素包括 `visual`、`modifier`、`transition`。已有元素/预设的修正、诊断交给 [audio-visualizer-dev](../audio-visualizer-dev/SKILL.md)；修正中若需要新增类型或预设，新增部分仍走本 skill 的合同门禁。图片、纹理等位图素材生成不属于这里的“原子元素”。

当前生成契约见 [内容生成](../../docs/architecture/visualizer/content-generation.md)。本 skill 替代旧 visualizer-scene-generator 的执行流程；ADR-0021/DEC-056 保留历史批准语境，不是当前注册指令。

## 工作流

1. 检查工作树、分支和暂存区，保留用户修改。核对仓库的 `compositionTypes.ts`、`elementRegistry.ts`、`compositionPresets.ts`、`compositionCodec.ts` 与 FeatureRegistry；读取根 AGENTS 和当前生成契约。不要检查已移除的旧场景文件是否存在。
2. 读取 [输入契约](references/input-contract.md)，将用户已说明的意图规范化为 `VisualizerContentBriefV1`。临时 JSON 只放系统临时目录，不创建仓库 brief、占位源码或合同。缺少必要事实时询问；可选设计留给合同提出默认值，不冒充用户选择。
3. 运行 `node skills/visualizer-content-generator/scripts/validate-content-brief.mjs <brief.json>`。`INPUT_INCOMPLETE` 时返回路径化问题及其影响，停止生成并保持仓库不变。`READY_FOR_CONTRACT` 只说明输入完整，不能据此写代码。
4. 读取 [生成规则](references/content-rules.md)，只按实际来源和内容读取相关契约、当前 registry 与相邻实现。优先复用元素；核对参数来源、单位/维度、全工程特征预算、时序和效果引用。校验器不证明这些运行时条件可行。
5. 展示确定的 **Content Contract**：内容 ID/名称、元素拆分、参数/default bindings、视觉及数据映射、静态或低/高/静音状态、时间与目标、seed/确定性、资源预算和验证范围。预设还列出展开清单、层级、时段、内部引用和需要新增的类型。所有可选默认方案在此明示。
6. 输出 `AWAITING_APPROVAL`，等待用户明确批准刚刚展示的具体合同；此时不得修改仓库。所有新增元素和预设，包括仅复用已有元素的预设，都必须经过此门禁。
7. 批准后在 `docs/architecture/visualizer/content/<element-or-preset>-<id>.md` 保存轻量合同及批准来源，再实现获批内容。新元素接入现有 ElementType/ElementRegistry 与组合渲染器；预设接入现有预设工厂，展开为普通 V3 元素。不要给工程新增 preset 字段。
8. 按 [测试矩阵](references/test-matrix.md) 和项目验证 skill 选择检查，完成后同步发现入口、地图并按交付 skill 本地提交。报告已实现、已验证、未运行和限制；不自动建立里程碑、canonical 或 readiness 评审。

## 审批与停止条件

- 批准本 skill、工作流或实施计划，不代表任何具体元素或预设获批。只有在具体合同展示后、清楚指向该合同的批准才允许写入合同、源码与测试。
- 合同获批后，视觉、数据来源、时间、效果目标或资源要求发生实质变化，回到合同阶段；不要用一般实现授权覆盖变化。
- 明确的 `unbound` 是待用户配置状态，不等于输入缺失。合同必须说明提示、可保存草稿与启用时阻止导出的行为。
- 需要新的 source/value/component/projection、工程 schema/元素版本策略、处理分轨输入或渲染/音频拓扑时，停止依赖这些改变的生成并提出独立架构决定；已有 `native` 来源不是新架构需求。
- 超过全工程四种不同 Analyzer 特征、改变支持矩阵/性能预算/验收阈值、引入依赖或资产许可不明时，先由用户决定，不新增 fallback。
- 禁止用户脚本、运行时插件和任意 Shader 注入；编译期受控 shader 按现有组合器扩展。不得让元素自行创建 Canvas、WebGLRenderer、RAF、AudioContext、Worker 或独立导出链路；原生输入复用既有服务。

遵守根 AGENTS 的 `trash/` 禁令、资源所有权和本地交付边界。不改写历史 evidence，不自动推送或发布。
