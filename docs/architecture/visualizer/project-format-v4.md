# Visualizer Project V4 与分组预设

2026-10-18，owner 批准资源包与分组预设计划并要求实施。本页替代 V3 的现行工程、预设身份与旧草稿规则；历史证据不随格式升级获得新结论。

## 工程数据

- `format` 为 `audiosurf-visualizer`，`schemaVersion` 为 `4`。保留工程 UUID、时间戳、同歌 track、16:9 output、seed 和可选同歌 Editor 快照。
- `elements` 保存完整元素记录，每个记录包含 UUID、`resource:{id,version,hash}`、绘制内核 `type/version`、名称、启用状态、派生 layer、时段、bindings 和适用的效果 targets。
- `items` 是由低到高的顶层顺序：`{kind:'element',id}` 引用一个独立元素；`{kind:'preset',id,resource,name,enabled,children,controls}` 保存一个预设实例，children 为由低到高的元素 UUID 数组。元素记录只保存一次，每个元素恰好归属一个顶层项。禁止预设嵌套、重复归属、悬空引用和空组。
- `items`/children 决定连续图层；元素 layer 必须等于展开后的索引，不是独立可编辑状态。列表显示相反顺序，顶层移动整组，子元素只能在本组排序。
- `resources:{elements,presets}` 内嵌使用的定义快照，绑定精确 ID、版本和内容 SHA-256。恢复与渲染只读取工程快照，不请求商城，也不向全局资源库注册工程内容；仍要求应用支持所引用的绘制内核。
- 多次添加同一预设产生新组 UUID、新子元素 UUID及本次实例的效果引用。资源定义可复用，实例参数不共享。默认绑定和时长适配只在新增时执行。

## 分组与共同处理参数

预设资源显式声明共同控件，实例的 controls 保存声明、子元素 UUID 目标及最后批量应用的 `value`。这不是参数继承：实际渲染仍读取子元素 bindings。

- `value` 控件只共享内核允许的处理常量，当前为 sensitivity、decay；`binding` 控件共享内核声明的输入绑定；`transform` 控件共享输入绑定的指定映射或平滑字段。颜色、位置、尺寸、线宽、透明度等样式常量不能声明为共同值。资源文件不能自行扩大内核权限。
- 控件包含 id、label、kind、parameterId、targets、value；transform 另有 field。binding 的 value 是不含 parameterId 的完整 source/可选 transform。preset 定义 targets 使用局部 key，实例使用 UUID。
- 调整控件先构造完整工程候选，全部通过校验后原子替换。失败不产生部分写入。子元素可以继续独立编辑。
- 每次比较控件负责的字段与最后共同值，显示“已有 N 个元素修改此值”和涉及名称；无关字段不触发提示。手动恢复相同值自动清除提示，“重新应用”按共同值覆盖当前目标。
- 隐藏预设通过运行时门控关闭整组，不改写子元素各自 enabled；分析请求、输入准备、效果、配置预检和导出均使用相同门控。完整工程四特征校验仍包含被禁用的内容。
- 删除子元素清理全工程效果引用和共同控件目标，没有目标的控件移除；最后一个子元素删除后移除组。删除组清理全部子元素及相关引用。

## 校验、草稿与输出

strict codec 校验字段、定义哈希、内核 ABI、完整参数、同歌 Editor 引用、唯一身份、元素归属和四种 Analyzer 特征上限。所有导入、批量编辑和资源导入都先验证候选，再提交；不自动改绑、降档或禁用其他元素。

只接收 V4 文件，不迁移 V1–V3。旧版草稿视为没有可恢复草稿，不显示旧版导出/覆盖提示，新 V4 草稿可正常写入原 draft/latest。无效 V4 草稿保留原文及显式处理入口；异歌 V4 草稿、写入失败、取消换歌和离页保护继续有效。

分组不增加新的合成器、离屏组目标、Canvas、renderer 或 RAF。预览、seek、循环和离线导出使用相同的确定性内核、绝对歌曲时间与 seed；弦线历史及原生输入准备按内核 type 分派，不按资源名称分派。输出继续遵循[离线导出契约](../../context/visualizer-offline-export.md)。

资源文件结构、存放与编写步骤见[资源包过渡版](resource-packages-v1.md)。
