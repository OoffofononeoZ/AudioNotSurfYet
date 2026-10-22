# Visualizer 原子内容生成契约

2026-10-22，owner 明确取消新增元素和预设的强制内容审批：生成请求默认自主完成，开放创意由 agent 定案；明确需求只有关键条件缺失、冲突或无法实现时才进一步询问。正常生成交付必须附至少一张实际展示图。此决定替代 DEC-082 及后续沿用的具体内容合同批准门禁，历史批准事实保留。

当前运行时为 Project V5 与资源包 V2，保留 ABI 1/2 和已有标记输入边界。生成 skill 2.4.0 仅维护于外部 `WheresYourElements/skill/visualizer-content-generator/`，项目不保留副本或发现包装；工具可用 `VISUALIZER_SKILL_DIR` 覆盖位置。外部仓库允许正常 Git 工作流，不自动推送或发布。

## 当前模型与适用关系

当前资源目标为 [Project V5](project-format-v5.md) 的元素定义与持久化分组预设，包括 visual、modifier、transition，以及仅引用已有元素的预设。[资源包 V2](resource-packages-v2.md) 描述编写、算法 ABI、依赖和隔离边界。完整画面描述按该模型拆解；既有内容修正使用 audio-visualizer-dev，新增部分使用外部生成 skill。

本契约保留对旧 SceneBriefV1、SceneRegistry 和 Project V1 注册流程的替代关系。历史批准、V1–V6 canonical/evidence 和 readiness 身份继续保留。展示图片是资源交付的一部分；处理分轨、自动标记和独立视频流程规划不属于该生成能力。

## 输入与生成

- 自然语言规范化为 `VisualizerContentBriefV2`：元素或预设模式、视觉意图、复用/新增元素、所需数据响应、时间和效果目标。允许纯静态元素；只有声明动态驱动时才要求完整响应、向量映射与时间语义。
- 标记驱动元素额外声明 markerInputs 的类型、单个/集合模式、purpose 与 response；转场可声明 timingInput。Brief 不保存实际工程轨道/分类/事件 ID，具体合同固定空集合行为、分页、seek/离线确定性。
- 预设输入只允许已有元素精确引用；缺少元素先生成并验证独立元素，再创建预设，不另设内容审批。禁止预设包夹带元素或算法。
- 无依赖校验器读取临时 JSON，返回 `INPUT_INCOMPLETE`（exit 2、路径化问题）或 `READY_FOR_CONTRACT`（exit 0）。CLI 状态名和只读行为不变；结构完整可继续生成，不是审批关卡，也不等于 runtime 验证通过。
- 开放需求自行补齐设计并区分用户要求与自主选择；明确需求仅在阻塞性的必要信息不足或冲突时询问。校验缺项先补齐可自主决定的字段，不把每个缺项都转成用户问题；显式 unbound 与输入缺失分开处理。
- agent 核对能力后简要说明选定方案并继续实现，不输出等待批准状态。Content Contract 是记录 ID、拆分、参数、时序、目标、确定性、预算和验证的设计说明；请求范围内的内容调整不要求重新批准。
- 设计记录按需保存至资源的 `source/`，记录用户要求和自主设计，不伪造批准来源，不生成阶段占位或每内容 readiness 文件。
- 每个新元素或预设正常交付至少附一张可打开、表达实际效果的 PNG/JPEG/WebP 或独立 SVG，并填写 previewPath；可以是示意图，不强制截图。交付前打开核对，共享默认封面不能代替展示图。工具和宿主的缺图/坏图容错保持，不新增强制图片检查。

## 实现不变量

- 元素定义精确引用 algorithm 的 ID/version/hash，提供完整参数和默认绑定；新算法在包内提供自包含模块和 Shader，经隔离计算与受控 DrawPacket 渲染。符合现有 ABI 的新算法无需修改应用内核；扩展 ABI 仍属独立架构决定。预设创建独立组与子元素 UUID，保存归属、精确依赖、共同控件及最后批量值；内部目标映射到本次 UUID，组内顺序决定连续图层。
- 共同控件显式声明处理字段和目标，样式常量禁止提升到组级。子元素可单独修改；对应控件显示差异，重新应用覆盖对应目标。V5 内嵌定义、算法源码和 Shader 快照，恢复不依赖商城；包不能获得主页面执行权限、DOM、网络、存储或音频对象。
- 默认值只在新增时应用，遵守 editingPrecision；导入/草稿及歌曲时长不量化、不改绑。严格 codec 与候选完整校验保持，失败不能部分替换工程。
- 参数来源为 descriptor 允许的 constant/analysis/native 或明确 unbound；Editor 点/范围通过 ABI 2 独立标记输入提供，转场可桥接既有时间引用。只读取用户在工程内绑定的已应用事件，不接 BPM、识别候选或推测音色。普通元素手动时段，效果指向视觉元素或整体合成，不引用其他效果。
- 全工程最多四种不同 Analyzer 特征，严格工程校验包含禁用元素，运行时只请求启用集合；native 和标记不计额度。预设加入已有工程时检查并集，不自动改绑/禁用原元素腾额度。
- loading/error、未配置输入、未选范围/目标沿用当前提示、渲染和导出预检规则，不沿用旧场景的默认值静默 fallback。
- seed/绝对歌曲时间决定画面，带历史的状态必须定义可重建求值与缓存失效；参数单位、向量维度和声道布局由当前输入/渲染层处理。
- 复用唯一 RendererHost/Canvas/WebGLRenderer/视觉 RAF、现有 render targets、分析及原生输入服务。自有资源幂等释放，旧任务不得覆盖新身份。新元素不创建独立音频、分析或输出链路。
- 视频生成遵循 [离线导出](../../context/visualizer-offline-export.md)：同一 renderer 的手动租约、绝对帧时间、输入准备、WebCodecs/OPFS。旧实时录制不是新内容的实现或验证入口。

需要新增 source/value/component/projection、工程版本策略、拓扑、支持矩阵、阈值或不明许可资产时，停止依赖这些变更的生成并请求独立决定。不得新增 legacy fallback、主页面脚本执行或绕过包校验的 Shader 注入；资源源限定用户选择的只读 assets 文件夹，不包含 ZIP、任意 URL 或后端接口。

## 验证与交付

具体输入、格式与工具见根 [AGENTS](../../../AGENTS.md) 指向的外部 skill。Skill 自身测试在外部仓库运行，项目命令 `npm run test:skill:visualizer-content-generator` 按需转调。校验器测试证明结构与 CLI 行为，不单独证明工作流、视觉或 runtime 正确。

内容验证按实际变化选择 V5 往返、资源包校验与隔离执行、分组/引用隔离、共同参数差异、数据映射、确定性、GPU、生命周期和短离线媒体检查；不默认累计历史评审或长曲矩阵。适用阈值保持，未运行/失败如实记录。仅修改 skill 时无需应用构建或产品浏览器回归；资源加载或产品行为变化选择对应验证。完成后按项目交付规则本地提交，不推送、不发布、不产生 readiness 结论。

## 媒体内容生成

独立 skill 2.5.0 支持 ABI 3 的媒体输入和显式执行模式；宿主 codec 与外部快照通过 visualizer:skill-codec 同步并只读核对。元素先独立封装验证，再创建精确引用的预设；媒体默认为 none。具体字段见外部 skill 的 media-inputs 参考与[宿主媒体契约](../../context/visualizer-media.md)。
