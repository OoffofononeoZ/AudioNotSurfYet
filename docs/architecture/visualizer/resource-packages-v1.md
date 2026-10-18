# Visualizer JSON 资源包 V1（过渡版）

本轮完成现有元素与预设的数据外置和本地加载。这不是最终自由发布格式：JSON 可以描述已有内核的元素定义、默认绑定、时段和预设组合；新绘制算法仍需修改应用。DSL、外部 Shader、任意 JS、后端上架、账号、签名审核和远端地址输入不在本轮实现。

## 存放与入口

- 内置文件放在 `public/visualizer-resources/v1/`，分为 elements、presets；catalog.json 列出相对于此目录的 JSON 包路径，应用通过请求加载，不把内容定义编译进应用。
- catalog 路径仅允许 elements/presets 内的 JSON，不触发任意外部地址或递归网络依赖。内置包共同解析依赖，再整体注册。
- 元素库“导入资源包”使用文件选择器，可以选择项目目录外的磁盘文件；浏览器不直接读取任意文件路径。包内包含所有非内置依赖，引用内置依赖时须匹配精确版本和哈希。
- 导入包保存到独立 `audionotsurfyet-visualizer-resources` IndexedDB 的 library/packages。刷新后恢复，可从“已导入资源包”移除；其他已安装包仍依赖它时拒绝移除。工程使用内嵌快照，不受卸载影响。
- 请求、文件、持久化恢复共用 strict codec。相同包重复导入去重；同 ID/版本而内容不同拒绝，新版本可并存。失败不注册半个包，也不部分改写工程。

## 包与定义

```json
{
  "format": "audiosurf-visualizer-resource",
  "schemaVersion": 1,
  "id": "my-content",
  "version": 1,
  "elements": [],
  "presets": []
}
```

elements/presets 至少一个非空。包版本、定义版本、Project V4 和 skill BriefV1 是不同的版本概念。

| 内容 | 必需字段与规则 |
| --- | --- |
| 元素定义 | id、version、hash、kernelId、kernelVersion:1、kind、title、icon、parameters，以及内核有输入时的 inputParameter |
| 参数 | id、label、valueKind、defaultValue、allowedSourceKinds；数值范围、投影/分量、默认绑定等按内核契约提供 |
| 预设定义 | id、version、hash、title、description、preview（geometric/cinematic）、elements、controls |
| 预设子元素 | 唯一 key、element 精确资源引用、name、enabled、完整 bindings、timing；效果另外提供 targets |
| 普通子元素时间 | `{kind:'relative',start:0,end:1}`，为歌曲时长的比例；加载时转成手动歌曲秒数，不量化时长 |
| 转场时间 | `{kind:'unbound'}`，等待用户选择同歌 Editor range |
| 预设内部效果 | composition 或局部视觉元素 key；实例化时映射到本次 UUID，不允许效果引用效果 |
| 共同控件 | id、label、kind（value/binding/transform）、parameterId、targets（局部 key）、value；transform 另含 field |

参数 ID、类型、输入能力、数值与向量范围必须符合 `kernelContracts`；允许缩小范围和输入选项，不允许扩大内核能力。共享处理字段由内核边界决定，不依赖资源作者声明角色。当前保留全部 visual、modifier、transition 内核。

资源中的数值默认常量须符合对应 editingPrecision，避免新增时就出现超出控件精度的值；不对已保存工程的实例参数或歌曲时长量化。

每个定义的 hash 是去掉自身 hash 字段后的 JSON SHA-256：对象 key 递归排序、数组顺序保留、UTF-8。引用固定 `{id,version,hash}`。哈希用于内容身份和完整性，不是发布签名或作者认证。

## 编写与检查

1. 选取已有内核对应的 elements JSON 作为结构参考，设置独立资源 ID、名称和默认绑定；保持 ABI 参数完整。修改已分发内容时递增定义及包版本，不能用同 ID/版本替换不同内容。仅调整内容数据时无需扩展渲染分派。
2. 编写预设时声明局部 key、图层顺序、相对时段和内部引用；显式选择共同控件目标。共同默认值必须与对应子元素初始绑定一致，异构输入拆为不同控件。
3. 磁盘分发包内嵌非内置元素定义。仓库内置预设可引用同一索引里的元素包，避免复制定义。
4. 运行 `node scripts/visualizer-resource-package.mjs <package.json>` 更新包内元素及预设哈希和同包引用；使用 `--check <package.json>` 只读核对。跨文件引用需同步使用被引用定义的新 hash，并重新封装引用它的预设。
5. 通过元素库导入验证实际 schema、依赖和内核约束，或运行相关资源专项测试。封装工具只证明哈希一致，不证明运行时可行或内容已获批准。

新增元素和预设仍须按[内容生成契约](content-generation.md)先校验 Brief 并批准具体 Content Contract。批准本格式或实施计划不批准新的视觉内容。

现有迁移保持两个预设原有图形、响应系数 0.6、几何律动的两种输入分配和棱镜航行四段分镜；本轮不加入可选 normalize，不改写输入的固定单位换算。共同输入控件以原分配分别声明。
