# UI、路由与状态

当前路由由src/router/index.ts在MainLayout下装配；页面接口从[上下文入口](../../../docs/context/index.md)按任务进入。

| 路径 | 页面与职责 |
| --- | --- |
| `/` | Home：共享歌曲metadata/封面与能量背景，见[应用外壳](../../../docs/context/app-shell.md) |
| `/analyzer` | Analyzer：单列、最多四项FIFO置顶、可调高度，见[接口](../../../docs/architecture/analyzer/interface-contracts.md) |
| `/editor/:trackId?` | Editor：标记/FT/自动标记、草稿保护与数字录入，见[接口](../../../docs/architecture/editor/interface-contracts.md) |
| `/visualizer/:trackId?` | Visualizer：V4资源组合、分组参数和离线导出，见[接口](../../../docs/architecture/visualizer/interface-contracts.md) |
| `/comingsoon`、`/testlands` | 通用占位/试验内容，不作为生产技术契约 |

## 装配与通信

- MainLayout创建/提供共享AudioSessionService、AnalysisCoordinator、页面controller与Editor处理服务；页面负责装配和资源订阅，MusicBar读取同一播放快照。
- Editor与Visualizer普通页保留MusicBar，tokenized route lease临时覆盖为repeat-one，离页恢复用户偏好。直接选歌先处理草稿/输出保护，取消保持原状态。
- Editor框架、marker独立视图/15%播放线及数字录入以[工作区](../../../docs/context/editor-workspace.md)和[交互契约](../../../docs/architecture/editor/interaction-contracts.md)为准，不复制E1–E10旧布局或“播放完全只读”。
- 高频时钟、指针、几何和预览留在已有controller/composable/renderer中；Pinia只持可序列化离散事实，props/emits传递展示和命令，不把File、Worker或节点塞入store。
- 组件事件使用kebab-case，父子双方核对类型；provide/inject用于已存在的服务所有权，不为局部事件新建全局单例。异步结果发布须核对歌曲和generation/revision。
- 布局检查先确定MainLayout占位、容器宽度、player inset及fixed/absolute定位上下文，再测DOMRect/Canvas；不从历史截图推断当前几何。

## CSS 样式归置与渐进迁移

先判断样式是否通用或跨组件复用，再判断局部规则的长度、取值与属性是否适合 Tailwind。

| 样式类型 | 建议写法 |
| --- | --- |
| 通用或跨组件复用的样式 | 放入共享 CSS 文件，优先复用或扩展 `src/style.css` 中的既有能力，避免在多个组件重复定义；即使规则较长或属性特殊，仍按共享职责归置 |
| 较短且不通用的局部样式 | 优先使用 Tailwind CSS，不推荐单独写入组件 `<style>` |
| 较长、取值不适合用 Tailwind 表达，或涉及特殊、不常用、实验性 CSS 属性的局部样式 | 建议写入组件 `<style>`，不为强行使用 Tailwind 堆叠冗长的 arbitrary values 或 selectors |

“较短、较长”按可读性和表达复杂度判断，不设机械行数门槛。规则用于后续新增与实际修改的样式；既有写法在之后涉及样式修改时逐步迁移，仅处理本次涉及的部分，同组件中未涉及的样式也可暂时保留，不开展全组件或全仓库替换。

写法迁移不额外改变本次需求之外的视觉、交互与作用域，继续遵守下方 `.app-scrollbar` 共享契约。

## 共享滚动条

- 全局 `.app-scrollbar` 是产品自有可见滚动容器的唯一默认样式，视觉事实源来自 Analyzer `MeydaCard` 精确值表：Firefox `scrollbar-width: thin`，WebKit 宽高 10px，深色轨道、绿色 thumb/hover、圆角；`scrollbar-gutter: auto`，无溢出时不预留空轨道。
- 新增或修改可见滚动容器时必须在元素上复用 `.app-scrollbar`，不得在 scoped CSS 或 Tailwind arbitrary selector 中新增另一套 `scrollbar-color`、track 或 thumb。需要新视觉变体时先形成明确 UI 决策并更新本 reference。
- `.app-scrollbar` 只负责外观，实际滚动项使用 `overflow: auto` 或单轴 `auto`，并约束可用高度／宽度；Flex/Grid 滚动项配合 `min-height: 0`／`min-width: 0`。不要用 `overflow: scroll` 或 `scrollbar-gutter: stable` 强行占位，不要用隐藏滚动条、负 margin、补偿 padding 或 JS 测高掩盖空轨道。
- 嵌套滚动时分别确认每一层是否真实溢出，固定布局外框不额外创建滚动层。验证内容增减／折叠、页签切换、窗口缩放和短弹窗：无溢出时扣除边框后 `offsetWidth - clientWidth`／`offsetHeight - clientHeight` 应为零；有溢出时仍可滚轮、键盘或拖动滚动，并复核 Canvas、时间标尺和叠加层的 ResizeObserver 对齐。
- `scrollbar-hide` 只用于产品明确要求隐藏滚动条且内容仍可通过键盘、滚轮和触控访问的容器；原生控件、OS 对话框和第三方组件不由全局通配规则覆盖。
- 当前复用范围包含 Analyzer 精确值表/页面、Visualizer 状态/左右侧栏与应用导航；其余既有变体在后续触及时按本规则收敛。

## 变更检查

新功能优先按职责落位：路由 view 组合现有服务和展示组件；音频资源由 `src/audio/` 持有，分析调度由 `src/analysis/` 持有，Editor 时间与事件规则由 `src/editor/` 持有，元素/绑定/工程/导出由 `src/visualizer/` 持有。若一次改动让页面组件同时承担持久化、时序计算、渲染和资源释放，先沿这些边界拆分，不按固定行数机械拆文件。

手写代码文件推荐 ≤1000 行，>1300 行警告、>2000 行阻断；按正常排版计算，不压缩代码凑行数。Vue“拆分组件”指提取完整功能区域及其模板、交互逻辑和局部样式，单独搬走 CSS 或 TS/JS 不算 UI 组件拆分。纯计算/共享状态及通用 CSS 仍按前文职责提取。格式与例外细则见[模块职责 skill](../../audiosurf-file-modularization/SKILL.md)；Vue 属性换行推荐逻辑指令、数据/属性、事件的顺序，不强制逐属性换行或自动重排。

新增已获批的元素、预设参数或设置时，检查参数 descriptor、默认绑定、Inspector、严格工程 codec、草稿恢复、导入导出、时间/资源所有权和相邻测试是否一致。新 source 或 projection 类型、外部素材或新输出格式先回到架构合同，不以 UI 上能选择为完成标准。

- 新路由：检查侧边栏导航、MainLayout 占位、直接访问与刷新。
- 状态变更：检查刷新后的 localStorage 恢复、非法旧值和默认值。
- 组件事件：检查事件名大小写、类型和父子两端。
- fixed/absolute 布局：至少验证窄屏、常见桌面和宽屏，读取 `getBoundingClientRect()` 核对几何。
- 设置功能：在缺少实际订阅方时，先把它视为未完成链路。
