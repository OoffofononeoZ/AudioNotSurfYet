---
name: visualizer-scene-generator
description: 为 AudioNotSurfYet 新建受控内置 Visualizer 场景，执行 SceneBriefV1 输入与 Scene Contract 两阶段审批，并在获批后生成确定性场景代码和测试。只用于新增内置场景；音轨分离、自动标记、视频流程规划、原子视觉素材生成及已有场景修改改用项目开发与文档路由。
---

# Visualizer Scene Generator

## Scope

只在 AudioNotSurfYet 仓库中创建新的编译期内置场景。不要用本 Skill 修改或诊断已有场景，也不要生成用户脚本、运行时插件、任意 Shader、第二渲染链路或每场景 canonical/readiness 文档。

音频制作流程图可作为产品意图证据，但它本身不是单个场景的 `SceneBriefV1` 或 Scene Contract。原子视觉素材生成属于另一类未来任务；本 Skill 不生成素材。流程图提出的分离音轨、自动标记或新绑定来源只有在对应产品和架构合同获批后才能进入场景输入。

## Workflow

1. 验证仓库包含 `AGENTS.md`、`src/visualizer/sceneRegistry.ts`、`src/visualizer/projectCodec.ts` 和 `src/analysis/featureRegistry.ts`。读取根指南、`docs/context/index.md`、ADR-0021、Visualizer project/binding contracts，并执行 `git status --short`。
2. 读取 [输入契约](references/input-contract.md)，把用户自然语言整理成临时 `SceneBriefV1`。临时文件只能放在系统临时目录，不得在仓库中创建 brief、占位源码或文档。
3. 使用 `node skills/visualizer-scene-generator/scripts/validate-scene-brief.mjs <brief.json>` 校验：
   - 失败时原样返回 `INPUT_INCOMPLETE` 和缺失/非法字段；说明每项为何阻止确定映射，然后停止，保证仓库无变化。
   - 通过时继续下一步；`READY_FOR_CONTRACT` 只代表输入完整，不代表允许写代码。
4. 读取 [场景规则](references/scene-rules.md)，并检查当前 Feature Registry、Scene Registry、参数 descriptor、project codec 和相邻场景实现。把抽象绑定类型落实为现有 `FeatureId/component/projection/transform` 或需要用户选择的 Editor 来源。
5. 输出一份确定的 Scene Contract，至少包含 template ID/title、画面与数据映射、参数表/default bindings、低/高与静音状态、时间/seed/hash 模型、资源预算、golden 状态、测试与回归范围、停止条件。末尾输出 `AWAITING_APPROVAL`，等待用户明确批准这份合同；此时仍不得修改仓库。
6. 只有用户批准刚刚展示的确定合同后才开始实现：
   - 在 `docs/architecture/visualizer/scenes/<template-id>.md` 保存轻量合同，保留 template ID、当前合同内容与用户批准来源；元数据按本文件用途维护。
   - 新增独立纯状态解析器和 renderer，扩展 `VisualizerTemplateId`、strict Project V1 whitelist 与 `SceneRegistry`。
   - 不改变默认 `orthogonal-lines`，不覆盖导入/恢复的持久化 binding，不扩大公共 scene/route/recording 接口。
7. 读取 [测试矩阵](references/test-matrix.md)，按具体场景合同生成 unit、integration 和 Chrome/Edge E2E，并选择受影响的 V1/V2/V5/V6 针对性回归；不默认运行累计 eval 链。浏览器或环境无法执行的项目明确记为 `unverified`，不得改记为通过。
8. 按项目验证与交付 skills 同步发现入口和地图；报告合同文件、实现位置、测试结果、未验证项与 readiness 影响。场景实现完成后只请求 Visualizer readiness 重评；不要创建新 V 里程碑、eval plan、canonical evidence 或发布声明。

## Approval Gate

- 当前计划、DEC-056 或本 Skill 的批准不等于任何具体场景获批。
- 只有发生在确定 Scene Contract 展示之后、清楚指向该合同的用户批准，才授权写入场景合同、产品源码与测试。
- 若批准后用户修改视觉、绑定、时间或资源要求，回到合同阶段并再次等待批准。

## Repository Safety

- `trash/` 是本地归档区。不得读取、搜索、索引或引用其中任何内容；只有用户明确要求恢复或查看指定内容时才可访问。普通删除不默认移入 `trash/`。
- 保留任务开始前的用户改动，不覆盖、不清理、不改写历史 evidence。
- 默认不增加依赖、纹理、模型、远端资源、大型音频、WebM 或 trace。
- 新场景必须复用唯一 Canvas、WebGLRenderer、视觉 RAF、AudioContext 和 Worker；只由持久化 seed 与绝对歌曲时间决定画面。
- 按根 `AGENTS.md` 执行 owner 明确批准后的本地提交；不自行 fetch、push、部署或声称 release-ready。

## Stop Conditions

遇到以下任一情况，停止生成并说明需要哪项架构评审：

- 需要新 binding source、value shape、component 或 projection 类型。
- 需要升级 JSON/schema/templateVersion，或不能通过追加严格 template ID 保持现有工程兼容。
- 需要第二 Canvas/renderer/RAF、AudioContext、Worker 或不同录制拓扑。
- 单场景需要超过四个唯一 Analyzer 特征。
- 需要任意 Shader 注入、用户脚本、运行时插件，或未经许可的外部纹理、模型与远端资产。
- 现有 fixture 无法表达效果且新的音频/图片资产来源或许可不明确。
