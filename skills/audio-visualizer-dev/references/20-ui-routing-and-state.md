# UI、路由与状态

## 路由和布局

`src/router/index.ts` 使用 `createWebHistory()`，所有当前路由都位于 `MainLayout` 下：

| 路径 | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | `Home.vue` | 使用共享音频能量驱动 `LightBg` 的 `rayLength` |
| `/comingsoon` | `ComingSoon.vue` | 通用空占位，不再作为 Visualizer 入口 |
| `/analyzer` | `Analyzer.vue` | Canvas 点阵背景和静态 Meyda 数据入口 |
| `/editor/:trackId?` | `Editor.vue` | E1–E9 canonical 已批准；E10 小节批量编辑与离页对话框修订进行中 |
| `/visualizer/:trackId?` | `Visualizer.vue` | V1–V6 canonical 与人工门禁均已批准 |
| `/testlands` | `TestLands.vue` | 试验页面，不应当作生产契约 |

Editor `/editor/:trackId?`、Header 当前歌曲入口、播放列表“去编辑”和 MusicBar 条件隐藏已由 E1 实现并获批准。E2 波形/网格/游标 Canvas、共享 viewport、seek/zoom/pan、tempo boundary、BPM/拍号/single-beat 和刷新恢复也已由 22/22 canonical 与 owner 批准。E3 point lane/class、自适应网格、鼠标/右键/键盘 marker 与 viewport-visible DOM 已由 26/26 clean canonical 和 owner 批准。E4 21 项单选 overlay、shared renderer、三手柄、pointer-through 与错误隔离已由 31/31 clean canonical 和 owner 批准。E5 range lane/class、E6 双浏览器/10,000 事件与人工补偿均已获批准；E7 窗口级 overlay 修订版 46/46 clean canonical 已获批准。E8 把 timeline stage 固定为桌面 `88px`、窄屏 `72px`，同 URL 歌曲恢复后合并 `enter(trackId)` 且保持 paused，另一首可播放歌曲只显示显式 `router.replace` 入口；25/25 canonical 与 owner 门禁已批准。

E9 已按 DEC-051/ADR-0019 建立共享 viewport、三级展示与 tempo boundary 删除。DEC-052/ADR-0020 进一步要求波形时间列由 88/72px stage 与紧贴其下的 28px BPM 标记条组成，不再创建独立 tempo row 或重复左 rail；caret 位于波形底边，1px guide 只向上伸入 12px，区间使用 11px、18px 高的无框行内控件。内部 boundary 右键/Delete/Backspace 删除时仍由前段向右延伸，0 秒和歌曲结尾不可删除，point/range 秒数不变。实现 commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 的 revised canonical 29/29 通过并获 owner 批准；首个 run 保留为 `pre-revision`，E9 evidence 为 `approved`、里程碑为 `Complete`。

E10 按 DEC-057/ADR-0022 在 PointWorkspace 统一持有瞬时“区间操作”模式与选区：开启时右键拖动按真实小节选择起始 lane/class，左键拖动已选区整批移动，Cmd/Ctrl+C 立即向选区后方原子复制；关闭后必须恢复 E9 的创建、删除、菜单、平移与 range handle 行为。模式、选择和预览不进入 JSON V1。Editor 的站内未保存离页提示改用页面自有 `<dialog>`，刷新/关闭窗口仍使用原生 `beforeunload`。

Visualizer V1 已实现 `/visualizer/:trackId?`、Header 当前歌曲入口、有效 route 的 MusicBar 隐藏、`pause-at-end`、1280+ 三栏、1024–1279 互斥抽屉、中性 16:9 单 Canvas、JSON V1 与单草稿，且 21/21 canonical 已批准。V2 已实现 constant/analysis/editor-event inspector、最多四项分析、同歌 Editor snapshot 和确定性 resolved values，26/26 canonical 已获 owner 批准；V3 Orthogonal Lines 与单 RendererHost 已获批准。V4 Cube Swarm 已实现并通过 34/34 clean canonical 与 owner 门禁。V5 已在同页面增加 recording 状态栏、双层命令锁、站内离页对话框和 ready Blob 保存/丢弃，40/40 canonical 与 owner 门禁已批准；route 和 project JSON V1 不变。V6 在 controller 当前歌曲会话内分别缓存两个模板的完整 bindings：切换模板恢复该模板最近状态，首次进入仍使用 registry 默认值；离页或歌曲身份变化清空缓存，JSON 仍只持久化当前模板，因此未升级 schema。V6 54/54 canonical 与人工门禁已获批准并关闭。

`MainLayout.vue` 固定组合 `HeaderBar`、当前 `router-view` 和 `MusicBar`，并创建/提供唯一 `AudioSessionService`、`AnalysisCoordinator`、Editor controller 与 Visualizer controller。修改页面高度、z-index、固定定位或底部空间时，要同时检查 Header、MusicBar 和两个 route lease。

## 组件通信

- `MainLayout` 创建并 provide 唯一 `AudioSessionService` 与 `AnalysisCoordinator`，在布局卸载时先 dispose coordinator 再释放 session service。
- `MusicBar` 读取 `audioSessionStore` 并调用 session commands；只拥有拖动预览、列表开合、跑马灯和 GSAP 样式时间线。
- `MusicList` 通过 `select-index`、`add-to-analysis`、`delete`、`clear`、`restore-access`、`reselect-track`、`clear-persisted` 和 `close-list` 事件回传操作；事件名已统一为 kebab-case。
- `MusicList` 的 `edit-track` 入口先显式播放目标歌曲，再导航到带 track ID 的 Editor；Header Editor 入口只使用当前歌曲且不隐式改变播放状态。
- `audioSessionStore` 是 Pinia store，保存 `TrackRecord[]`、current track ID、`PlaybackSnapshot`、persistence snapshot、analysis snapshot 和当前 energy；Home 与 MusicBar 读取同一能量。
- runtime File、封面对象 URL、AudioContext、AudioBuffer 和 AudioNode 均不得进入 store。
- `emitter.ts` 暴露 mitt 单例，事件类型位于 `src/types/events.ts`。当前已证实 Header 发出 `settings-open`；未发现订阅方，也未发现 `music-bar-settings` 的实际发送或订阅。
- 修改 mitt 事件时必须同时检查类型定义、发送方和订阅方；没有订阅方时不要假设事件已形成可用功能。

## Pinia 持久化

`configStore.ts` 使用 key `config` 写入 `localStorage`：

- `volume`: UI 百分比值，AudioSessionService 转为 0–1 Gain 值。
- `musicBarSettings.style`: 当前音乐条样式模式，代码使用 0、1、2。

播放位置和能量不持久化。原生 IndexedDB V1 保存最近队列、元数据、文件句柄、唯一 current Blob 与匹配 analysis cache；刷新固定回到 0 秒 paused。未知 schema 不猜测迁移，UI 显示可清除的错误。恢复失败状态进入 TrackRecord，File、Blob、handle、PCM 和 compact payload 仍不进入 Pinia。

## 响应式 UI 边界

- Header 和 MusicBar 都是 fixed 元素；路由内容使用 `h-dvh` 或屏幕高度相关样式。
- MusicBar 的样式 2 进度条由 CSS 固定在矩形上边；不要重新引入依赖一次性 `offsetLeft/offsetTop` 的定位。
- 样式切换由 GSAP 时间线管理，`isStyleTransitioning` 在动画期间隐藏进度条并阻止重复切换。
- 信息跑马灯依赖 `ResizeObserver`、DOM 宽度和 GSAP tween；内容或字体变化后需要重新测量并清理旧 tween。
- `AnimatedList` 使用全局键盘监听和滚动可见性动画；组件卸载时必须移除监听。
- DEC-050 固定支持的 `>=1024px` Visualizer 为单个 `100dvh` 页面：document/body 不纵向滚动，toolbar/preview/recording/transport 留在页面内，左模板和右参数侧栏分别滚动并使用 `overscroll-behavior: contain`。1024–1279 抽屉以 workspace grid 为定位边界；`<1024px` 继续只保留现有最小宽度/横向兼容，不视为移动端支持。

## 共享滚动条

- 全局 `.app-scrollbar` 是产品自有可见滚动容器的唯一默认样式，视觉事实源来自 Analyzer `MeydaCard` 精确值表：Firefox `scrollbar-width: thin`，WebKit 宽高 10px，深色轨道、绿色 thumb/hover、圆角和 stable gutter。
- 新增或修改可见滚动容器时必须在元素上复用 `.app-scrollbar`，不得在 scoped CSS 或 Tailwind arbitrary selector 中新增另一套 `scrollbar-color`、track 或 thumb。需要新视觉变体时先形成明确 UI 决策并更新本 reference。
- `scrollbar-hide` 只用于产品明确要求隐藏滚动条且内容仍可通过键盘、滚轮和触控访问的容器；原生控件、OS 对话框和第三方组件不由全局通配规则覆盖。
- 本次只迁移 Analyzer 精确值表和 Visualizer 状态/左右侧栏；Editor、歌曲列表与 Analyzer 页面既有变体不顺带改写，后续触及它们时按本规则收敛。

## 变更检查

新功能优先按职责落位：路由 view 组合现有服务和展示组件；音频资源由 `src/audio/` 持有，分析调度由 `src/analysis/` 持有，Editor 时间与事件规则由 `src/editor/` 持有，场景/绑定/工程/录制由 `src/visualizer/` 持有。若一次改动让页面组件同时承担持久化、时序计算、渲染和资源释放，先沿这些边界拆分，不按固定行数机械拆文件。

新增已获批的场景参数或设置时，检查参数 descriptor、默认绑定、Inspector、严格工程 codec、草稿恢复、导入导出、时间/资源所有权和相邻测试是否一致。新 source 或 projection 类型、外部素材或新输出格式先回到架构合同，不以 UI 上能选择为完成标准。

- 新路由：检查 Header 导航、MainLayout 占位、直接访问与刷新。
- 状态变更：检查刷新后的 localStorage 恢复、非法旧值和默认值。
- 组件事件：检查事件名大小写、类型和父子两端。
- fixed/absolute 布局：至少验证窄屏、常见桌面和宽屏，读取 `getBoundingClientRect()` 核对几何。
- 设置功能：在缺少实际订阅方时，先把它视为未完成链路。
