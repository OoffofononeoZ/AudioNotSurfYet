# Visualizer Project V5 与算法快照

2026-10-19，owner 明确选择工程同时携带算法、浏览器原生隔离、新格式替换旧格式，并以“Implement the plan.”批准实施。此决定替代 DEC-084 的 V4/V1 和仅应用内核限制；不升级历史 evidence/readiness。

## 工程数据

- `format:'audiosurf-visualizer'`、`schemaVersion:5`。保留工程 UUID、时间戳、同歌 track、16:9 output 和可选同歌 Editor 快照；不再保存工程级 seed。
- DEC-097 替代 DEC-092 的全局 Seed：仅资源声明 `usesSeed:true` 的元素实例保存 `seed`，值为 0–4294967295 的整数或 null，其他实例省略。右侧元素属性可编辑或清空，新添加元素及预设子元素默认 null，表示每次打开独立随机。只覆盖既有 Seed 能改变实际画面的效果，不为其他 Shader 噪声新增控制。
- `elements` 保存 UUID、精确资源引用、名称、启用状态、派生 layer、时段、bindings、按声明提供的可选 markerBindings／mediaBindings 和适用的效果 targets。实例不再重复保存固定 type/version，算法由元素定义的 algorithm 引用解析。
- `items` 由低到高排列独立元素或预设实例。组包含 UUID、资源引用、名称、显隐、children 和 controls；每个叶元素恰好归属一次。禁止预设嵌套、重复归属、悬空引用和空组。
- items/children 决定连续 layer；列表反向显示，顶层移动整组，子元素只在组内排序。
- `resources:{algorithms,elements,presets}` 内嵌完整定义和算法源码、Shader、契约，均以 `{id,version,hash}` 绑定。恢复及渲染不请求商城、不向全局库注册内容；要求宿主支持包声明的 ABI 1/2/3 与绘图能力。
- 相同算法去重保存，实例按 UUID 独立创建。重复添加预设产生新组/子 UUID 和本次效果引用。默认绑定与时长适配只在新增时应用。

## 分组及共同处理参数

共同控件保存声明、UUID 目标和最后批量值；实际渲染仍读取子元素 bindings，不使用继承。

- 算法契约限定共同处理字段及输入，元素定义不能扩大权限。当前迁移保留 sensitivity、decay 及原有输入/映射控件，不将颜色、位置、尺寸等样式常量变为共同参数。
- value 控件批量写常量；binding 写完整 source/transform；transform 只写指定映射或平滑字段。完整候选通过校验后原子替换，子元素仍可独立编辑。
- 根据负责字段与最后共同值比较，显示差异数量和名称；恢复相同值自动消除差异，再次应用覆盖目标字段。
- 隐藏组不修改子元素 enabled；分析、历史输入、效果、预检和导出使用同一有效集合。每来源四种 Analyzer 特征的校验仍包含被禁用内容。
- 删除子元素清理全工程效果引用及共同控件目标；无目标控件和空组移除。删除组清理其全部叶元素。

## 校验、恢复和输出

DEC-089 在 V5 中增加按输入 ID 保存的 markerBindings：unbound、单个 laneId/eventId 或单轨道及可选 innerClassIds 集合。只允许声明内的类型/模式，绑定指向内嵌同歌 Editor 快照；库中默认不携带真实引用。转场 timingInput 从既有 editor-range timing 读取，不重复保存。没有新字段的历史 ABI 1 快照继续按原接口渲染，不自动升级资源。

启用但未配置的输入阻止导出；存在的空集合合法，缺失轨道/分类/事件则拒绝候选。重新载入或导入 Editor 快照先验证全部引用再原子替换，不按同名重绑；快照仍被任意元素引用时禁止移除，包含禁用元素。

DEC-090 的可选 categorySelection:'single' 将 collection 绑定收窄为恰好一个 innerClassId；V5 绑定结构不变，既有资源省略此字段时保持多分类能力。点集合可显式 includeEnd 读取右端点，默认半开语义及范围查询保持；完整查询类型见[标记类型](../../../src/visualizer/editorMarkerTypes.ts)，实现见[标记读取](../../../src/visualizer/editorMarkerReader.ts)。

strict codec 检查字段、身份/hash、算法 ABI、参数能力、同歌引用、唯一归属和每来源四特征上限；纯解析不执行代码。analysis source 的可选 stemRole 保存四轨角色，省略表示原曲；仅允许分轨特征集合与向量频谱参数合同的交集，见[输入来源](../../context/visualizer-native-input.md)。工程导入和恢复先在隔离运行时初始化候选，成功后激活；失败保留原工程，取消和身份变化阻止迟到提交。

只接收 V5 文件；V1–V4 不迁移。旧草稿视为没有可恢复草稿，不显示旧版导出/覆盖提示。V5 草稿仍写 draft/latest；无效 V5 原文及显式处理、异歌冲突、保存失败与离页保护继续有效，不清空原数据库。

旧 V5 的顶层 Seed 在输入边界一次性迁移：只复制给支持 Seed 的元素，然后删除顶层字段。未声明能力的内嵌资源按已审阅算法的精确身份补标记，并更新必要版本、引用及 hash，不替换算法源码或其他参数；无法确认的旧自定义资源和混合结构明确拒绝。文件原件不改写；草稿成功激活后走正常保存链，失败保留原文。V1–V4 的原有不迁移边界不变。

预览与离线输出使用相同算法快照、绝对歌曲时间和逐元素数字 seed。会话按 UUID 管理空值的运行时种子；修改或清空一个元素不使其他元素重新随机，排序、隐藏、普通参数修改、seek/循环、尺寸变化、场景/context 恢复及导出均保留当次值。成功重新打开/导入重建会话，失败、取消或过期请求不改变当前值。渲染帧传递只读种子快照用于缓存与失效判定；未声明的元素不生成种子，ABI 数字字段仅传 0 占位。见[资源包](resource-packages-v2.md)与[离线导出](../../context/visualizer-offline-export.md)。

## ABI 3 媒体扩展

2026-10-22 的 Circular Visualizer 计划增加受控媒体输入和显式执行模式，保留现有格式版本与旧资源身份；新增媒体链路及 ABI 3 的实时因果分支见[媒体输入](../../context/visualizer-media.md)。原有仅 ABI 1/2 或无媒体内容的约束继续适用其原范围。
