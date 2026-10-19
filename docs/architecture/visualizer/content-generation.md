# Visualizer 原子内容生成契约

2026-10-18，owner 在规划中选择将旧生成 skill 改名为 `visualizer-content-generator`，并要求**所有新增原子元素和组合预设都先批准具体合同**，随后以“Implement the plan.”批准实施。本轮更新 skill、校验器、测试及入口，不批准任何具体产品内容。

同日 owner 批准 DEC-084 资源包与分组预设改造；2026-10-19 又以 DEC-087 批准可加载算法资源包。当前运行时为 Project V5 与资源包 V2，具体内容审批门禁继续有效。2026-10-20，owner 批准升级独立生成 skill 2.0.0、外部文件夹库及既有资源迁移；具体内容合同审批继续保留。

## 当前模型与适用关系

当前资源目标为 [Project V5](project-format-v5.md) 的元素定义与持久化分组预设，包括 visual、modifier、transition，以及仅引用已有元素的预设。[资源包 V2](resource-packages-v2.md) 描述编写、算法 ABI、依赖和隔离边界。完整画面描述按该模型拆解；既有内容修正使用 audio-visualizer-dev，新增部分仍先走本契约的输入与具体合同审批。

本契约及 DEC-082 替代 ADR-0021/DEC-056 中的 SceneBriefV1、SceneRegistry、Project V1 注册与旧生成测试步骤。历史批准、V1–V6 canonical/evidence 和 readiness 身份继续保留；两阶段输入/具体合同门禁延续到所有新增元素与预设。位图素材生成、处理分轨、自动标记和独立视频流程规划不属于该生成能力。

## 输入与批准

- 自然语言规范化为 `VisualizerContentBriefV2`：元素或预设模式、视觉意图、复用/新增元素、所需数据响应、时间和效果目标。允许纯静态元素；只有声明动态驱动时才要求完整响应、向量映射与时间语义。
- 预设输入只允许已有元素精确引用；缺少元素先单独批准元素合同、生成并验证，再创建预设。禁止预设包夹带元素或算法。
- 无依赖校验器读取临时 JSON，返回 `INPUT_INCOMPLETE`（exit 2、路径化问题）或 `READY_FOR_CONTRACT`（exit 0）。不写入文件，不兼容旧 brief；结构完整不等于 runtime 可行或批准。
- 必要意图不完整时询问，不补造用户选择。可选设计在合同提出明确默认值；显式 unbound 与输入缺失分开处理。
- agent 核对当前 registry/codec/resolver 后展示具体 Content Contract，固定 ID、拆分、参数/default bindings、映射、时序/目标、确定性、资源预算和验收；预设同时固定展开清单、层级、时段与内部引用。展示后标记 `AWAITING_APPROVAL`。
- 输入不足或合同未批准时，仓库零写入；完整 brief 也不能触发占位源码、合同文档或测试生成。只有展示合同后明确指向它的用户批准才允许实现；视觉、数据、时间、目标或资源要求实质变化须再次批准。
- 获批合同按需保存至资源自身的 `source/`，记录具体批准来源。没有实际内容批准时不创建合同占位、阶段目录或每内容 readiness 文件。

## 实现不变量

- 元素定义精确引用 algorithm 的 ID/version/hash，提供完整参数和默认绑定；新算法在包内提供自包含模块和 Shader，经隔离计算与受控 DrawPacket 渲染。符合现有 ABI 的新算法无需修改应用内核；扩展 ABI 仍属独立架构决定。预设创建独立组与子元素 UUID，保存归属、精确依赖、共同控件及最后批量值；内部目标映射到本次 UUID，组内顺序决定连续图层。
- 共同控件显式声明处理字段和目标，样式常量禁止提升到组级。子元素可单独修改；对应控件显示差异，重新应用覆盖对应目标。V5 内嵌定义、算法源码和 Shader 快照，恢复不依赖商城；包不能获得主页面执行权限、DOM、网络、存储或音频对象。
- 默认值只在新增时应用，遵守 editingPrecision；导入/草稿及歌曲时长不量化、不改绑。严格 codec 与候选完整校验保持，失败不能部分替换工程。
- 来源仅为当前 descriptor 允许的 constant/analysis/native 或明确 unbound；Editor range 是转场时间引用，不是参数来源。普通元素手动时段，效果指向视觉元素或整体合成，不引用其他效果。
- 全工程最多四种不同 Analyzer 特征，严格工程校验包含禁用元素，运行时只请求启用集合；native 不计额度。预设加入已有工程时检查并集，不自动改绑/禁用原元素腾额度。
- loading/error、未配置输入、未选范围/目标沿用当前提示、渲染和导出预检规则，不沿用旧场景的默认值静默 fallback。
- seed/绝对歌曲时间决定画面，带历史的状态必须定义可重建求值与缓存失效；参数单位、向量维度和声道布局由当前输入/渲染层处理。
- 复用唯一 RendererHost/Canvas/WebGLRenderer/视觉 RAF、现有 render targets、分析及原生输入服务。自有资源幂等释放，旧任务不得覆盖新身份。新元素不创建独立音频、分析或输出链路。
- 视频生成遵循 [离线导出](../../context/visualizer-offline-export.md)：同一 renderer 的手动租约、绝对帧时间、输入准备、WebCodecs/OPFS。旧实时录制不是新内容的实现或验证入口。

需要新增 source/value/component/projection、工程版本策略、拓扑、支持矩阵、阈值或不明许可资产时，停止依赖这些变更的生成并请求独立决定。不得新增 legacy fallback、主页面脚本执行或绕过包校验的 Shader 注入；资源源限定用户选择的只读 assets 文件夹，不包含 ZIP、任意 URL 或后端接口。

## 验证与交付

具体输入结构与命令见 [输入契约](../../../skills/visualizer-content-generator/references/input-contract.md)，实现规则与按影响选择的验证见 [生成 skill](../../../skills/visualizer-content-generator/SKILL.md)。校验器测试证明输入与 CLI 行为，不能单独证明 agent 的审批或 runtime 实现符合要求。

内容验证按实际变化选择 V5 往返、资源包校验与隔离执行、分组/引用隔离、共同参数差异、数据映射、确定性、GPU、生命周期和短离线媒体检查；不默认累计历史评审或长曲矩阵。适用阈值保持，未运行/失败如实记录。仅修改 skill 时无需应用构建或产品浏览器回归；资源加载或产品行为变化选择对应验证。完成后按项目交付规则本地提交，不推送、不发布、不产生 readiness 结论。
