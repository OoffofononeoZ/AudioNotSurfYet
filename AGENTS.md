# AudioNotSurfYet Repository Guide

## Purpose

本仓库使用文档优先的 Harness Engineering 工作方式。本文是工程师与 agent 在 AudioNotSurfYet 中工作的常驻入口：先确认当前阶段与上游批准状态，再读取相应项目文档和 Skill，最后用仓库证据完成实现与验证。

## Working Model

- 可长期影响行为的产品意图、技术决策、验收规则、发布约束和复盘结论必须进入仓库内的规范文档，不能只留在聊天或代码推断中。
- AudioNotSurfYet 的开发、诊断、评审和本地验证使用 `$audio-visualizer-dev`；源码位于 `skills/audio-visualizer-dev/`。新增 Visualizer 内置场景改用 `$visualizer-scene-generator`；其源码位于 `skills/visualizer-scene-generator/`，修改或诊断已注册场景仍使用项目开发 Skill。
- 生命周期文档请求先使用 `$harness-doc-orchestrator` 判定阶段，再交给对应阶段 Skill。
- 项目文档只记录仓库事实、本地决策、阶段产物和事件证据；通用工作流以 Harness Skills 和本文件为准。
- 事实、推断、建议和待人工确认项必须明确区分。当前代码、配置和可复现行为优先于历史任务记录。

## Lifecycle Stages

1. Repository context：维护系统地图、词汇、决策和工作约定。
2. Product intent：定义问题、范围、指标和开放问题。
3. System design：把已批准的产品意图转成架构、接口、风险和 ADR。
4. Execution planning：定义里程碑、验收标准、任务切分和测试策略。
5. Quality and evals：定义黄金样例、失败分类、评估与发布就绪证据。
6. Release and feedback：准备发布、回滚、监控、发布说明与反馈。
7. Retrospectives and improvements：基于发布、事故或重复摩擦沉淀改进，并回写规范文档。

## Required Documents

- Repository context：`docs/context/`
- Product intent：`docs/product/`
- Architecture：`docs/architecture/`
- Delivery planning：`docs/delivery/`
- Quality and evals：`docs/quality/`
- Release：`docs/release/`
- Retrospectives：`docs/retrospectives/`

不要预建未到阶段的空文件或目录。当前阶段与已存在文档从 `docs/context/index.md` 开始发现。

## Gate Rules

- 下游实现、集成或发布准备必须等待要求的上游文档存在，并由人类明确 review、approve 或以本仓库约定的其他方式接受。
- System design 要求 `docs/product/problem-brief.md` 和 `docs/product/scope.md` 均为 `status: approved`。
- Execution planning 要求 `docs/architecture/system-design.md` 为 `status: approved`。
- Quality and evals 要求 delivery 的 execution plan、acceptance criteria 和 test strategy 已存在并经过评审。
- Release and feedback 要求 `docs/quality/release-readiness.md` 提供就绪证据。
- Retrospective 要求发布证据、事故证据或重复摩擦证据，并至少回写一个长期有效的仓库文档。
- 产品意图实质变化会使 architecture、delivery、quality、release 文档待复核；系统设计变化会使 delivery、quality、release 待复核；验收或测试覆盖规则变化会使相应 eval、readiness 和 release 文档待复核。
- 工作流顺序、门禁、文档位置或跨阶段测试纪律变化会使本 `AGENTS.md` 待复核。
- 所有生命周期文档维护 `status`、`owner`、`last_reviewed`、`upstream_docs` 和 `next_action`。

## How to Work in This Repo

- 先读本文件、`docs/context/index.md`、任务对应的生命周期文档和 `$audio-visualizer-dev` reference；若任务是新增 Visualizer 场景，再按 `$visualizer-scene-generator` 执行无写入输入门禁和 Scene Contract 审批。
- 修改前检查 `git status --short`，保留用户已有修改；未经要求不提交、不推送、不重写历史。
- 高影响实现前或同时更新相应规范文档。行为塑造型设计规则写入 architecture 或 ADR，不留在聊天、代码推断或一次性实现说明中。
- 文档树使用渐进披露：父级索引暴露子文档，阶段摘要保持紧凑，过大的细节契约拆入受管理的子目录。
- 长期用户约束、例外规则和复盘结论必须回写本文件或对应规范文档。新信息与现有文档冲突时，先确认冲突，不擅自判定规则已改变。
- 不默认增加额外兼容逻辑或 legacy fallback。确有需要时，先说明解决的问题、不增加的后果，并获得明确人工确认。
- 实现发现前置条件不足时，说明缺少的输入、契约、数据、环境或决策，以及在缺口下继续的残余风险。
- 验证尽可能覆盖成功、失败、边界或异常路径；不能自动化的路径记录原因、残余风险和补偿性的手工、监控或后续验证。
- “已实现”或“已验证”必须有 diff、命令输出、浏览器状态、测试或其他具体证据。不能用单一成功路径代表完整验证。
- 项目本地验证能力和已知缺口见 `docs/context/working-agreements.md` 与 Skill 的构建测试 reference。
- 凡技能文档中已经定义的通用流程规范、阶段路由、交付约束或方法论说明，项目侧文档均不应重复描述。项目文档应聚焦仓库本地事实、业务与技术决策、阶段产物及事件证据；可复用的通用流程要求统一以对应技能文档与 AGENTS.md 为准。

## When to Escalate to Humans

- 目标用户、产品问题、范围、优先级、owner 或成功阈值尚未确认。
- 浏览器支持、隐私、性能预算或音频 fixture/许可会改变实现或验证策略。
- 架构方案仍有实质取舍，或兼容性路径需要长期维护。
- 发布风险、回滚能力或监控缺口超过已接受范围。
- 所需上游文档缺失、未批准或因变化而待复核。

## Reference Map

- 仓库上下文：`docs/context/index.md`
- 产品意图：`docs/product/`
- 架构：`docs/architecture/`
- 交付：`docs/delivery/`
- 质量：`docs/quality/`
- 发布：`docs/release/`
- 复盘：`docs/retrospectives/`
- 项目 Skill：`skills/audio-visualizer-dev/SKILL.md`
- Visualizer 场景生成 Skill：`skills/visualizer-scene-generator/SKILL.md`
