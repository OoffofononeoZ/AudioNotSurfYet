---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/quality/release-readiness.md"
next_action: "审批 Visualizer V0 范围与非目标；批准前不得开始 Visualizer system design"
---

# Scope

## Scope Boundary

下列 Analyzer 范围已于 2026-07-24 获批，并由后续里程碑与 Analyzer-only readiness 收口。Editor E0 是 2026-08-26 独立批准并已交付的产品范围。Visualizer V0 是 2026-09-02 新增的 `in-review` 产品草案；它不能反向扩大 Analyzer 或 Editor 候选证据，也不会在批准前开放 system design 或代码实现。

## Analyzer Scope（approved）

### Product capability

- 以纵向切片最终覆盖 `src/data/analyzerData.ts` 中定义的全部 21 个 Meyda 特征。
- 首个可交付切片包含 RMS、Amplitude Spectrum、Chroma。
- Analyzer 始终按 `FEATURE_IDS` 顺序显示全部 21 张卡片；新工作区全部收起，最多展开四张且活动特征不得重复。
- 展开第五张时原子收起当前 FIFO 中最早展开的卡并展开目标；点击已展开卡会收起，只有重新展开才进入队尾。
- 收起态只显示输出类型、标题、简介和展开按钮；不显示图表、参数、精确值、明细、特征选择列表或移除按钮。
- 所有卡片共享时间视窗、缩放状态和播放游标；点击图表可跳转到对应播放时间。
- Canvas 负责数据图表，DOM 负责说明、固定参数、精确值、焦点与无障碍语义。
- RMS 采用时间序列折线；Amplitude Spectrum 采用时频热图和游标频谱；Chroma 采用 12 类热图和游标柱图。
- 播放、队列、当前歌曲、跳转和刷新恢复作为分析工作区的基础能力。
- 21 张卡均可通过右上三横句柄按前/后插入排序；自定义逻辑顺序同时作为 DOM、键盘、读屏和瀑布流输入顺序。
- 点击/触控句柄提供上移、下移、置顶、置底替代，键盘提供等价操作；工具栏可恢复 `FEATURE_IDS` 默认顺序。

### Audio and analysis

- 支持用户本地选择 MP3、WAV、FLAC；单首目标时长不超过约 15 分钟。
- 立体声或多声道输入按声道平均混合为 mono PCM 后进入离线分析。
- 全曲预计算在 Worker 中执行；仅计算 FIFO 队列中当前最多四个活动特征，零活动项不创建 Worker。
- 播放时共享游标由 AudioContext 时钟驱动，不依赖动画帧累计时间。
- 首版分析参数固定但对用户可见：frame/buffer 1024、hop 512、Hanning window、MFCC 13、源文件采样率。
- 高频帧在 Worker 内聚合为最多 30Hz 的显示数据；向量数据可紧凑量化，游标处精确值按需提取。

### Session recovery

- 通过 `showOpenFilePicker()` 选择文件并把队列中的文件句柄保存在 IndexedDB。
- 只持久化最近一次会话，并且只保存当前歌曲 Blob 与当前歌曲分析缓存；切歌时替换旧 Blob/缓存。
- 刷新后恢复队列、当前歌曲、活动特征 FIFO 和分析配置；播放时间归零并保持暂停。旧 V1 `activeCards` 按 slot 顺序恢复为活动队列。
- 其他歌曲按“下一首、上一首、下二首、上二首……”顺序查询权限；已授权文件自动恢复，未授权文件显示恢复状态并等待用户触发。
- 权限拒绝、文件移动、容量不足或缓存保存失败不得破坏当前页面内的播放；界面必须说明不能跨刷新恢复或需要重新计算。

### Support and accessibility

- 首发支持最新稳定版 Chrome 和 Edge 桌面端。
- 验证视口为 1024、1280、1920 CSS px。
- 播放、切歌、跳转、选卡和换卡可用键盘完成；焦点可见，数据不只依靠颜色表达，并尊重 reduced motion。
- 静态 SPA 运行于 HTTPS 或 localhost。

## Analyzer Delivery Slices（complete）

1. 产品意图和系统设计获批。
2. 建立测试与合成音频 fixture。
3. 抽离共享音频引擎与会话状态并保持现有 MusicBar 行为。
4. 建立持久化、Worker、特征注册表和共享时间轴。
5. 交付 RMS、Amplitude Spectrum、Chroma。
6. 扩展剩余标量、向量/波形和结构化特征，直至 21 项覆盖。
7. 完成格式、恢复、权限、性能、无障碍和多视口硬化。

M13 是上述完成切片后的候选变更：以 21 张稳定折叠卡替代四个可替换 slot，但不扩大最多四项 Worker、缓存、音频或浏览器边界。

每一切片必须通过其验收门禁后才能进入下一批特征；不使用未经估算的日历日期代替证据。

## Analyzer Out of Scope（historical boundary）

- 麦克风或实时输入。
- 远端 URL、云端音频、账户、上传、同步或服务端分析。
- 长期本地曲库、多会话历史或跨设备恢复。
- 可编辑的分析参数；首版只展示固定参数。
- 音频编辑、音频导出、分享、协作或插件系统。
- 该 Analyzer 历史候选不包含 Editor、Visualizer 或其他 Tab；后续产品线必须以自己的范围和证据推进，不能反向扩大 Analyzer readiness。
- 移动端、非 Chromium 浏览器和非 Chromium 兼容层。
- Analyzer 中新增 Three.js 依赖。
- 不实现两卡交换、实时重排动画、多卡选择、按歌曲独立顺序、第三方拖动依赖或移动端产品支持；桌面 Chrome/Edge 的 touch Pointer Events 仍需验证。
- 在 release 阶段前决定正式托管商、生产 URL、发布监控或回滚方案。

## Editor E0 Scope（approved）

### Product capability

- Editor 是对已有歌曲进行音符、音色和效果时间标注的“逆向制曲”工具；产物是单首歌曲的数据工程，不修改原始音频。
- Header 的 Editor 入口打开当前歌曲；播放列表中每首可用歌曲提供语义化“去编辑”按钮和同名 Tooltip，并打开该指定歌曲。没有当前歌曲时进入可选择歌曲的空状态并保留 MusicBar，用于继续导入或选择歌曲。
- 有有效歌曲时隐藏 MusicBar，Editor 顶部提供精简播放/暂停、时间和单曲循环；仍复用唯一 AudioEngine、播放时钟和当前歌曲资源。刷新恢复受自动播放限制时保持暂停但准备好循环；离开 Editor 后取消循环策略并恢复普通队列结束行为。
- 页面底层承载歌曲信息、波形、tempo map、lane、inner class、点事件和范围事件；叠加层一次只显示一个现有 Meyda 特征，并与底层标记区域共享时间坐标。

### Project file and draft

- 首版使用带格式标识和 schema version 的本地 JSON 工程；导入、导出选择器展示全部已注册格式，因此首版只显示 JSON。
- 工程绑定歌曲身份，并保存歌曲元数据、tempo map、lane、inner class、点/范围事件及必要工作区状态。文件名、字段和严格校验由后续接口契约确定，不沿用需求示例中的拼写错误。
- 首版只保存一份 Editor 草稿。同一歌曲重新进入或刷新时恢复本地草稿；进入不同歌曲时必须先明确选择导出旧工程、覆盖旧草稿或取消，不能静默覆盖。
- 普通页内离开提示允许“之后不再显示”，但不同歌曲的覆盖确认不可永久关闭。保存失败保留当前内存编辑并明确显示未持久化。
- 无效 schema、歌曲不匹配、越界事件或导入失败不得覆盖当前草稿。

### Timeline and tempo map

- 顶部波形支持左键 seek、以指针为锚点的滚轮缩放和右键按住水平拖动；未形成拖动的空白右键打开自定义快速跳转菜单。
- 只在 Editor 时间轴交互区域禁用原生 context menu、文本选择和原生拖拽，不全局破坏链接、表单、滚轮、键盘或辅助技术默认行为。
- tempo map 初始包含歌曲开始和结束边界，并提供插入内部边界的加号手柄；每两个边界之间显示拍号与 BPM，默认提示为 `4/4 bpm: 100`。
- 正常 BPM 支持 20–300 的整数和小数；最大值集中配置为 300。负数、非数字、非有限数和大于 300 均为输入错误。
- `0 <= BPM < 20` 表示单拍区间：隐藏并禁用拍号，区间内不画 beat/measure 分隔线，并把整个区间作为一个可标记单元。
- 正常区间以贯穿全部 lane 的细白线表示小节，以半透明细线表示 beat；与小节线重合的 beat 线不重复绘制。
- 只有一个 tempo segment、BPM 仍为空且未被用户编辑时，允许内部 BPM 估计填入可靠结果；低置信度保持为空。首版不安装 BPM 包，未来引入依赖前必须单独获得 owner 批准。

### Lanes and point events

- 每个 lane 具有名称、点或范围行为类别和全部展开的 inner class；新 lane 默认只有一个 `default` inner class，inner class 区域不使用内部滚动条。
- 点事件用于音符或短音色。基础精度为相邻 beat 的 1/16，并根据当前像素密度在 `1/16`、`1/8`、`1/4`、`1/2` 和 `1 beat` 中选择仍可可靠点击的最细网格。
- 左键在候选格创建点事件，已有同 lane、同 inner class、同一吸附时间的点事件不重复创建；右键已有点事件删除。
- 空格平时不创建大量 DOM；当前候选格在 hover/focus 时显示符合黑绿界面的边框和轻微放大反馈。标记本身必须可聚焦，并提供键盘创建、删除和移动候选位置。

### Range events

- 长音色和效果使用具有起点、终点的范围事件。第一次左键选择起点并进入待选中模式，只能向时间更晚的格子延伸；起点至鼠标位置显示待选中样式，第二次点击有效终点完成创建。
- `Esc` 或待选模式下空白位置右键取消创建；非待选状态的空白右键打开快速跳转菜单；右键已有范围事件直接删除。
- 起点和终点下方分别显示可水平拖动的箭头。创建和调整都沿用点事件的自适应网格；终点必须晚于起点，最短持续时间为一个当前网格单位，两个手柄不能互相穿越。
- 同一 lane、同一 inner class 的范围事件不得重叠；不同 lane 或 inner class 可以重叠，点事件也可以位于范围事件内部。首版不自动合并、裁剪或自由时间拖动。

### Analysis overlay

- 左侧选择器一次只能选择累计 21 项中的一个特征；选择后收起，再次点击可更换。
- 叠加图按相同 viewport 映射到标记区域，并以半透明方式显示。Canvas、说明和空白部分不接收指针，底层标记交互可穿透。
- 仅特征选择器和调整上边界、整体垂直位置、下边界的三个手柄接收指针与键盘操作；工作区保存特征选择、位置和高度。

### Support and accessibility

- 输入继续限制为用户本地选择的 MP3、WAV、FLAC，目标单首时长约 15 分钟；不新增网络数据路径。
- 首发验证最新稳定版 Chrome、Edge 桌面端及 1024、1280、1920 CSS px；Editor 不继承 Analyzer 的浏览器通过结论，必须形成自己的证据。
- 播放、seek、zoom/pan、tempo 边界、点/范围事件、inner class、导入导出、右键菜单替代动作和叠加层调整必须具备键盘路径、可见焦点和 reduced-motion 语义。

## Editor Delivery Slices（approved product sequence）

1. **E0 — Product intent**：批准 Editor 用户、问题、范围、指标、非目标和开放问题；本阶段不编码。
2. **E1 — Entry, playback and project foundation**：路由、指定/当前歌曲、单曲循环、草稿，以及同时容纳点/范围事件的版本化 JSON 基础。
3. **E2 — Timeline and tempo**：波形、共享视口、tempo map、网格与内部 BPM 估计。
4. **E3 — Point annotation**：note 点事件、inner class、自适应精度、右键与键盘操作。
5. **E4 — Analysis overlay**：单 Meyda 特征半透明叠加、垂直调整与时间坐标对齐。
6. **E5 — Range annotation**：长音色/效果的创建、取消、端点调整、不重叠校验、删除和导入导出。
7. **E6 — Final hardening**：Chrome/Edge、性能、资源、无障碍、错误恢复、多视口与 canonical evidence。

E5 于 2026-08-27 在 E4 获批后改为 `In Progress`。若未来要求新的事件类别语义、自动合并、裁剪、同类重叠或自由时间精度，必须先重新评审产品与接口契约。

## Editor Non-goals

- 修改 PCM、剪切或拼接音频、混音、母带、生成伴奏、实时录音或导出重新编码的歌曲。
- 多轨编曲、乐器演奏、插件宿主、自动生成完整标注或替代专业 DAW。
- 远端上传、账户、云同步、协作、分享链接或跨设备工程库。
- 首版 JSON 之外的工程格式；后续格式通过注册机制增量评审。
- 移动端、非 Chromium 浏览器、生产托管和 Visualizer。

## Visualizer V0 Scope（in-review）

### Product capability

- Visualizer 是当前本地歌曲的音频可视化制作台，不是自由代码画布。工作台采用左侧场景列表、中间固定 16:9 实时预览、右侧参数与绑定检查器、底部播放进度的三栏布局。
- 一次只启用一个完整场景模板。切换模板会切换整套视觉结构和参数面板，不支持把多个模板作为图层叠加。
- 有有效歌曲时工作台锁定当前歌曲并隐藏 MusicBar，页面内提供播放、暂停、时间与 seek；不允许切换到其他歌曲，不循环播放，自然结束后暂停。
- 无歌曲或歌曲不可恢复时显示明确空状态并保留 MusicBar，使用户能够导入或恢复歌曲；不得静默改用队列中的其他歌曲。
- 首版内置“正交线条”和“立方体群”两个模板。模板是项目内受控 renderer，不是可执行 Vue/JavaScript/shader 插件。

### Data binding

- 参数数据源包括固定值、Analyzer 特征、同歌 Editor 草稿和导入后通过歌曲身份校验的 Editor JSON。
- 每个场景最多激活四个不同的 Analyzer `FeatureId`。第五个唯一特征必须在分析请求前被拒绝并解释原因；固定值和 Editor lane/inner class 不计入该上限。
- 多个参数引用相同 FeatureId 时只占一个名额并共享结果；删除或替换最后一个引用后，不再使用的特征应从活动集合释放。
- 标量可以直接映射；向量可选择完整向量、单个 bin、频带、mean、max 或 peak。具体投影、范围映射、clamp、invert 与 attack/release smoothing 等接口语义须在 system design 中固定。
- Editor main lane 表示该 lane 的事件集合，inner class 表示单一分类；point 产生短促 pulse，range 在半开区间 `[start,end)` 内产生 gate。导入失败、歌曲不匹配或无效引用不得污染当前工程。
- Visualizer 工程不嵌入 Analyzer 数组；重新打开时针对当前歌曲复用现有 cache 或重新分析。经过校验的 Editor 数据可作为工程快照保存。

### Built-in scenes

- **Orthogonal Lines**：横线与竖线分别提供来源、颜色、粗细、亮度和衰减；推荐把横线绑定主要音色 lane，把竖线绑定 drum lane 或 inner class。range 持续显示，point 产生短促脉冲；未绑定时可使用固定值或关闭。
- **Cube Swarm**：中心立方体簇默认由 Amplitude Spectrum 驱动，`coreScale` 推荐绑定 Editor drum main lane，周边立方体 `riseSpeed` 默认绑定 Energy，三个卫星立方体的 `orbitSpeed` 默认使用固定值但允许改绑。数量、颜色、基础尺寸、相机距离和背景是普通参数。
- Cube Swarm 的默认设置只使用 Amplitude Spectrum 和 Energy 两个 Analyzer 特征；其他默认绑定优先使用 Editor 事件或固定值，为用户保留两个分析特征名额。
- 两个模板必须在同一播放时间上实时响应；模板之间的 renderer、Canvas、RAF 与资源所有权由后续架构统一，产品范围不批准第二套播放时钟或音频引擎。

### Project and recording

- 首版提供本地版本化 Visualizer JSON 工程，建议文件名为 `<歌曲名>.audiosurf-visualizer.json`；保存歌曲身份、输出预设、模板 ID/version、参数、绑定和可选 Editor 快照。
- 未知模板、未知字段、歌曲不匹配、无效 FeatureId/lane/class 或超过四个唯一分析特征的工程必须原子拒绝，不能部分套用。
- V1–V4 先形成可实时预览和恢复的工程；V5 再从歌曲 0 秒开始按歌曲原速录制同一视觉画布与音频。
- WebM 预设为 1280×720 或 1920×1080，30 或 60fps；优先 VP9 + Opus，不支持时允许 VP8 + Opus。录制前必须做能力检测，失败时保留工程与实时预览。
- 实时录制期间不支持 seek、切歌、切模板或修改会改变输出身份的设置；后台标签页、离线倍速和 MP4 不在首版范围。

### Support and accessibility

- 首版输入继续限制为用户本地 MP3、WAV、FLAC，目标单首时长约 15 分钟；不新增远端或麦克风输入。
- 首发支持最新稳定版 Chrome 与 Edge 桌面端，工作台验证 1024、1280、1920 CSS px 及代表性 DPR；输出画面固定 16:9。
- 模板、参数、绑定、播放、seek、工程导入导出和录制必须有键盘路径、可见焦点与非纯颜色状态。
- reduced motion 只关闭工作台装饰动画，不关闭用户主动播放、预览或录制的场景运动。

## Visualizer Proposed Delivery Slices

1. **V0-P — Product intent**：批准用户、问题、范围、成功指标、非目标和开放问题；当前只执行此阶段。
2. **V0-A — Architecture**：定义工程、绑定、场景注册表、播放/分析所有权和录制边界。
3. **V0-D — Delivery/quality planning**：定义 execution、acceptance、test、eval、golden 与 failure 文档。
4. **V1 — Workspace foundation**：路由、三栏布局、transport、16:9 画布、工程 JSON、草稿和模板注册表。
5. **V2 — Data binding**：Analyzer 0–4 特征、Editor 直连/导入、绑定检查、去重与第五项阻止。
6. **V3 — Orthogonal Lines**：完成线条场景及 Editor point/range 事件绑定。
7. **V4 — Cube Swarm**：完成频谱中心结构、鼓点缩放、Energy 速度和卫星旋转。
8. **V5 — WebM export**：完成带音频的实时 WebM 录制、预设、能力检测和文件验证。
9. **V6 — Final hardening**：完成 Chrome/Edge、性能、资源、WebGL 恢复、无障碍与完整 canonical；获批后才复核整体 readiness。

V1–V6 每个里程碑均须独立完成 provisional、实现提交、clean canonical、evidence 登记和 owner 审批；产品意图批准不等于任何实现或质量门禁通过。

## Visualizer Non-goals

- 麦克风、直播流、远端音频、账户、上传、云同步或分享链接。
- 多模板叠加、自由图层合成、任意节点图或完整视频剪辑时间线。
- 导入外部 Vue、JavaScript、shader、Three.js 代码或其他可执行插件。
- MP4、离线快速渲染、后台标签页导出或服务端渲染。
- 独立 Analyzer 数据包；首版通过当前歌曲 cache/Worker 直接取得分析结果。
- 一个场景使用超过四个唯一 Analyzer 特征；若出现明确场景需求，必须重新评审 Worker、缓存和性能边界。
- 移动端、非 Chromium 浏览器、正式托管、发布监控和生产上线。

## Assumptions and Dependencies

- `project-owner` 是产品、技术和阶段批准人。
- 当前本地处理边界只约束已批准范围；未来上传能力必须另开产品决策。
- 浏览器可以在安全上下文中使用 File System Access API；文件句柄可序列化到 IndexedDB，但授权是否跨会话持续不能假定。
- 需要保留 `queryPermission()` 和由用户手势触发的 `requestPermission()` 恢复路径。
- 当前歌曲分析缓存若因大小或 quota 无法保存，刷新后允许重新计算，不要求降级成长期数据库。
- 21 项特征的具体分组由交付计划管理，但不能改变“最终全部覆盖”和“首批三项”的批准范围。
- Analyzer readiness 继续只覆盖现有 Analyzer 候选，不能证明 Editor 已设计、实现或可发布。
- Editor E0 使用 owner 给出的聊天需求和 Git 忽略的 `docs/require/editor.txt` 作为输入；只有版本化产品文档是后续规范来源。
- 点/范围事件的 JSON 字段、歌曲 identity、草稿数据库、右键状态机、BPM 算法和 renderer 数据流已由获批 Editor 架构固定；delivery planning 负责把它们映射到切片、验收和测试。
- 任何新增依赖必须先说明用途、体积、许可与替代方案并获得 owner 明确批准。
- Analyzer 顺序属于最近工作区而非歌曲；旧 V1 缺少顺序字段时使用 `FEATURE_IDS`，存在但非法的顺序不静默修复。
- Visualizer 工程、Editor 工程与 Analyzer session 是不同持久化边界；是否复用数据库、草稿数量和文件 schema 由批准后的架构决定，不能从产品文档推断实现。
- Visualizer 只复用当前歌曲的 Analyzer/Editor 数据语义，不改变现有 Analyzer 四项上限、Editor JSON V1 或二者 readiness 身份。
- WebM 路线依赖浏览器 Canvas capture、Web Audio stream destination 与 MediaRecorder 能力；正式接口与失败策略在架构阶段确认，不新增运行时依赖。

## Approval Notes

- Decision-maker：`project-owner`
- Analyzer approved on：2026-07-24；M3–M11 与 Analyzer-only readiness 已完成。
- Editor E0 status：`approved`；`project-owner` 于 2026-08-26 明确回复：“我批准 Editor E0 产品意图、点事件与范围事件规则、成功指标和开放问题；同意进入 Editor E0 架构设计。”
- Architecture approval：`project-owner` 于 2026-08-26 明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”
- Change rule：现有 Analyzer delivery、quality 与 readiness 仍只对 Analyzer 历史范围有效；Editor 必须建立并审批自己的 delivery 覆盖，E1–E6 不能因产品或架构批准而直接开始实现。
- M13 approval：`project-owner` 于 2026-08-31 以完整实施指令批准 M13 范围及 M14 非目标；M13 保持 IndexedDB V1、本地音频和最多四项分析边界，本轮不推送远程仓库。
- M14 approval：`project-owner` 于 2026-09-01 明确批准并要求实施插入排序、工作区全局持久化、点击动作面板、恢复默认、键盘/读屏和本地 canonical；M14 不推送远程仓库。
- M14 closure：implementation commit `0e991307d9045a1ec84ddaae0515612240894a92` 与 19/19 clean canonical 完成，范围内能力和非目标均保持；PROD-015 仍阻断上线。
- Visualizer V0 status：`in-review`；2026-09-02 owner 要求形成单场景、最多四项 Analyzer 特征、两个内置模板和 WebM 路线的产品意图，但须在明确批准语句后才开放 system design。

File System Access 行为依据：[Chrome File System Access 文档](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) 与 [持久权限说明](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)。
