---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/context/index.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/delivery/execution-plan.md"
next_action: "实施 DEC-057 Editor E10；完整浏览器证据或 owner 补偿前保持 In Progress"
---

# Decision Registry

本表是长期决策入口；详细理由、替代方案和验证要求以链接文档为准，避免在上下文层复制完整 ADR。

| ID | Date | Decision | Owner | Status | Source | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| DEC-001 | 2026-07-24 | AudioNotSurfYet 专属 Skill 源码纳入本仓库，并通过 `~/.codex/skills/audio-visualizer-dev` 软链接安装；不修改中央 skills 仓库 | project-owner | active | [Skill](../../skills/audio-visualizer-dev/SKILL.md) | 出现第二个真实同类项目、安装位置或项目边界改变 |
| DEC-002 | 2026-07-24 | 采用 Harness Engineering 阶段文档与人工门禁；未批准上游不得创建或推进下游 | project-owner | active | [AGENTS.md](../../AGENTS.md) | 生命周期顺序、门禁或文档位置改变 |
| DEC-003 | 2026-07-24 | 项目文档与 Skill 默认使用中文，代码标识和命令保留原文 | project-owner | active | [AGENTS.md](../../AGENTS.md) | 团队确定新的文档语言政策 |
| DEC-004 | 2026-07-24 | 主要用户为音频分析学习者，核心任务是把 Meyda 数值/数组对应到具体时刻、听感和音色 | project-owner | approved | [Problem brief](../product/problem-brief.md) | 目标用户、学习任务或核心问题改变 |
| DEC-005 | 2026-07-24 | 最终覆盖 `analyzerData.ts` 全部 21 项；首批 RMS、Amplitude Spectrum、Chroma；最多四张唯一卡共享时间轴 | project-owner | approved | [Scope](../product/scope.md) | 特征覆盖、首批切片、卡片或时间轴规则改变 |
| DEC-006 | 2026-07-24 | 当前只处理本地 MP3/WAV/FLAC（约 15 分钟），支持最新 Chrome/Edge 桌面；上传、移动端、非 Chromium 和未定义 Tab 排除 | project-owner | approved | [Scope](../product/scope.md) | 数据边界、格式、时长、浏览器或页面范围改变 |
| DEC-007 | 2026-07-24 | 正确性使用直接 Meyda 黄金容差；游标 ≤100ms；输入反馈 ≤100ms 且无分析归因主线程长任务；owner 完成任务并解释 3/3 片段 | project-owner | approved | [Success metrics](../product/success-metrics.md) | 阈值、黄金样本或验证人群改变 |
| ADR-0001 | 2026-07-24 | 单一实时 AudioEngine 独占音频资源，audioSessionStore 只保存可序列化状态 | project-owner | approved | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 播放所有权、时钟或状态边界改变 |
| ADR-0002 | 2026-07-24 | Worker 只分析最多四个活动特征，聚合/量化展示数据；generation 和完整身份隔离 stale result | project-owner | approved | [ADR-0002](../architecture/adrs/0002-worker-analysis-and-stale-result-isolation.md) | 分析线程、缓存身份、取消或数据分辨率改变 |
| ADR-0003 | 2026-07-24 | IndexedDB 保存全部句柄，但只保存当前 Blob/分析缓存；权限恢复必须显式可见并由用户触发 request | project-owner | approved | [ADR-0003](../architecture/adrs/0003-hybrid-indexeddb-session-recovery.md) | 会话寿命、数据量、权限或存储边界改变 |
| ADR-0004 | 2026-07-24 | 使用 21 项穷尽 FeatureRegistry 和 Canvas 2D renderer family；DOM 承担说明、值、焦点和语义；Analyzer 不新增 Three.js | project-owner | approved | [ADR-0004](../architecture/adrs/0004-typed-feature-registry-and-canvas-renderers.md) | 特征 shape、renderer 或无障碍边界改变 |
| ADR-0005 | 2026-08-21 | `spectralFlux` 使用项目 v1 正向 L1 公式；零能量 M8 标量为 0，非零能量非有限值失败；不 patch Meyda 或改变 cache schema | project-owner | approved | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) | Flux 公式、静音语义、提取来源或缓存语义改变 |
| ADR-0006 | 2026-08-26 | Editor 通过 route-scoped playback/analysis lease 复用唯一 AudioEngine、时钟、Coordinator 和 Worker | project-owner | approved | [ADR-0006](../architecture/adrs/0006-editor-runtime-leases.md) | runtime 所有权、结束策略、consumer 并发或 Worker 数量改变 |
| ADR-0007 | 2026-08-26 | Editor 使用版本化 JSON、内容 hash 绑定和独立 `audionotsurfyet-editor` V1 单草稿 | project-owner | approved | [ADR-0007](../architecture/adrs/0007-editor-project-and-draft-boundary.md) | 工程格式、identity、草稿数量、数据库或迁移策略改变 |
| ADR-0008 | 2026-08-26 | Editor 以秒数为事件事实、tempo 只派生网格，并使用 point/range 判别模型和固定右键状态机 | project-owner | approved | [ADR-0008](../architecture/adrs/0008-editor-time-and-event-model.md) | 时间 identity、吸附、重叠、range 或 pointer 语义改变 |
| ADR-0009 | 2026-08-26 | Editor 抽取纯 Canvas renderer adapter，共享 geometry，并让 overlay 除 selector/手柄外 pointer-through | project-owner | approved | [ADR-0009](../architecture/adrs/0009-editor-overlay-renderer-boundary.md) | renderer family、geometry、overlay pointer 或 Canvas/DOM 边界改变 |
| ADR-0011 | 2026-08-29 | Editor overlay Teleport 为全视口 fixed 灰色层；复合入口和 visibility 为本地按歌状态，关闭时 analysis 收敛为 Buffer | project-owner | approved | [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md) | overlay 挂载、开关/菜单、坐标空间、本地偏好或 pointer 边界改变 |
| ADR-0012 | 2026-08-31 | Analyzer 稳定展示 21 张折叠卡，以最多四项 FIFO 队列驱动分析，并用 V1 `activeCards` 兼容承载队列 | project-owner | approved | [ADR-0012](../architecture/adrs/0012-analyzer-all-cards-fifo-active-analysis.md) | 卡片全集、FIFO、按需资源、workspace runtime 或持久化 carrier 改变 |
| ADR-0014 | 2026-09-02 | Visualizer 与 Editor 通过通用 route playback lease 使用不同 ended policy，并与 Analyzer 共享单一 analysis consumer/Worker | project-owner | approved | [ADR-0014](../architecture/adrs/0014-visualizer-runtime-leases.md) | route consumer、ended、特征上限、时钟或 Worker 所有权改变 |
| ADR-0015 | 2026-09-02 | Visualizer 使用 strict JSON V1、同歌 Editor 快照、独立单草稿和非可执行绑定联合 | project-owner | approved | [ADR-0015](../architecture/adrs/0015-visualizer-project-and-binding-boundary.md) | 工程格式、快照时机、草稿数量、绑定源或插件边界改变 |
| ADR-0016 | 2026-09-02 | 两个内置模板共享单 Canvas/WebGLRenderer/RAF，并以 seed + 绝对歌曲时间保证 seek/刷新/录制确定性 | project-owner | approved | [ADR-0016](../architecture/adrs/0016-deterministic-scene-registry.md) | 模板 registry、renderer ownership、运动时间或 context recovery 改变 |
| ADR-0017 | 2026-09-02 | WebM 使用 AudioEngine pre-Gain 原音量 tap；只允许 VP9→VP8 codec fallback，不静默降低分辨率/fps | project-owner | approved | [ADR-0017](../architecture/adrs/0017-realtime-webm-recording.md) | 音频 tap、codec、预设、状态机或保存边界改变 |
| ADR-0018 | 2026-09-03 | Editor 时间轴固定为 `88px/72px` 并保留 6px 波形安全区；同歌恢复不播放、异歌显式 replace、point 中心误差 `<=1 CSS px` | project-owner | approved | [ADR-0018](../architecture/adrs/0018-editor-timeline-recovery-and-marker-alignment.md) | 时间轴垂直几何、恢复决策、route 切换或 marker 锚点改变 |
| ADR-0019 | 2026-09-04 | Editor 将 tempo boundary 与区间编辑移入和波形共享 viewport 的专用 BPM 轨道；内部边界可删除且由前段向右延伸 | project-owner | approved | [ADR-0019](../architecture/adrs/0019-editor-tempo-lane-and-boundary-deletion.md) | tempo 轨道布局、区间展示、boundary 删除或时间映射改变 |
| ADR-0020 | 2026-09-04 | Editor 用紧贴波形的 28px BPM 标记条替代独立 66px tempo 模块；caret 与 12px 辅助线向上指向波形，区间使用 11px 无框行内编辑 | project-owner | approved | [ADR-0020](../architecture/adrs/0020-editor-compact-tempo-strip.md) | 标记条高度、合并拓扑、boundary 指向、紧凑编辑或展示阈值改变 |
| ADR-0021 | 2026-09-04 | post-V6 新内置场景使用完整 SceneBrief 与确定 Scene Contract 两阶段门禁；只扩展现有 JSON V1/SceneRegistry/单 RendererHost，不允许用户脚本、运行时插件或任意 Shader | project-owner | approved | [ADR-0021](../architecture/adrs/0021-controlled-visualizer-scene-generation.md) | binding/value/projection、JSON、renderer/Worker/AudioContext/RAF 拓扑、四特征上限或外部资产许可改变 |
| ADR-0022 | 2026-09-04 | Editor 以瞬态区间操作模式按小节选择单 lane/class 标记，立即向后复制或按当前网格原子移动；站内未导出离页改用深色原生 dialog，beforeunload 不变 | project-owner | approved | [ADR-0022](../architecture/adrs/0022-editor-marker-block-editing.md) | 批量范围、冲突策略、快捷键、pointer 优先级、JSON 或离页状态机改变 |
| DEC-008 | 2026-07-24 | 实施采用 M1–M11 相对门禁，不承诺日期；M3 从测试基础开始，M7 未通过不得扩展后续特征 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | 依赖、里程碑、验收门禁或交付优先级改变 |
| DEC-009 | 2026-07-24 | 当前只批准 execution planning；不预建 quality/release/retrospective，也不自动开始代码实现 | project-owner | superseded by DEC-010 | [Milestone plan](../delivery/milestone-plan.md) | 已由 owner 决定前置三份 quality design |
| DEC-010 | 2026-07-24 | 在 M3 前增加 Q0：前置 eval plan、golden examples、failure taxonomy；三份文档单独批准后开放 M3，release-readiness 仍等待 M11 证据 | project-owner | approved | [Eval plan](../quality/eval-plan.md) | 验收/测试纪律变化，或 owner 改变 Q0/readiness 时序 |
| DEC-011 | 2026-07-28 | M3 只建设本地门禁；使用 Vitest、fake-indexeddb 和正式 Chrome channel，Edge 缺失保持 evidence gap，不以 Chromium 代替 | project-owner | approved | [Tests README](../../tests/README.md) | CI 范围、浏览器矩阵或测试工具改变 |
| DEC-012 | 2026-07-28 | canonical 短 fixture 由确定性 PCM 经系统 FFmpeg 生成并使用 CC0-1.0；用户音频默认仅本地使用 | project-owner | approved | [Fixture manifest](../../tests/fixtures/fixture-manifest.json) | 编码器、fixture 来源、许可或入库政策改变 |
| DEC-013 | 2026-07-28 | 未提交状态只产生 provisional run；用户自行提交后对干净 commit 复跑，才创建正式 evidence index | project-owner | approved | [Working agreements](working-agreements.md) | Git 授权或 evidence identity 政策改变 |
| DEC-014 | 2026-07-28 | M4 快速切歌最后操作生效，非空追加不中断当前播放，metadata 失败继续解码，decode/unsupported 使用非阻塞消息 | project-owner | approved | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) | 队列、竞态或错误交互语义改变 |
| DEC-015 | 2026-07-29 | M5 原生文件选择不提供隐藏 input fallback；本地音频保持 Git 忽略，超出约 15 分钟的样本只作 best-effort 压力观察且不扩大范围 | project-owner | approved | [Working agreements](working-agreements.md) | 文件选择兼容策略、本地样本政策或支持时长改变 |
| DEC-016 | 2026-07-29 | M6 建立 21 项穷尽 registry、四项 Worker 支持、六类 compact codec、空默认活动集、完整 cache identity、generation 隔离和 Worker exact cursor；不实现 M7 UI，不升级 Meyda 或增加 spectralFlux fallback | project-owner | approved | [Interface contracts](../architecture/interface-contracts.md) | M6 feature 支持、frame/config、codec、缓存、精确值或 fallback 策略改变 |
| DEC-017 | 2026-07-30 | M7 固定四个 UI 槽位，但只允许 RMS、Amplitude Spectrum、Chroma 三个唯一活动特征；无保存工作区默认三卡，已保存空工作区恢复为空；第四槽与完整四特征场景顺延 M8 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | M7 活动上限、默认/恢复语义、槽位或 M8 开门规则改变 |
| DEC-018 | 2026-08-21 | M8 先修复 Analyzer shell 四项 UI 问题，再开放 13 个标量；Flux 使用项目 v1 公式，零能量 M8 标量为 0，非零能量非有限值失败；累计最多四张唯一卡 | project-owner | approved | [ADR-0005](../architecture/adrs/0005-project-spectral-flux-and-silence-semantics.md) | Flux 公式、静音语义、M8 feature set、shell layer 或按钮状态契约改变 |
| DEC-019 | 2026-08-21 | M9 Slice 0 让首页 Header 保持透明、所有非首页使用 18px backdrop blur；随后开放 Power Spectrum、MFCC、Buffer，累计最多四张、19/21 可用卡 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | Header 路由样式、M9 feature set、向量/波形 renderer 或累计覆盖改变 |
| DEC-020 | 2026-08-23 | M10 开放 Loudness 与 Complex Spectrum 达到 21/21；Complex Spectrum 主图与精确表完整保留 1024 bins，并以 signed Hz 解释后半负频率镜像 | project-owner | approved | [Execution plan](../delivery/execution-plan.md) | 结构 payload、FFT bin 范围、renderer 或最终 feature set 改变 |
| DEC-021 | 2026-08-26 | 批准 M11 canonical、Edge 原生权限与最终加固结果，关闭 M11 并创建 Analyzer release-readiness；readiness 豁免与生产上线仍需单独批准 | project-owner | approved | [Evidence index](../quality/evidence-index.md) | M11 evidence 身份、readiness 时序或上线授权改变 |
| DEC-022 | 2026-08-26 | 批准 Analyzer `Ready with waivers`，接受 W-001–W-007 并进入 Editor E0 产品意图；Analyzer 正式上线继续等待 PROD-015 | project-owner | approved | [Release readiness](../quality/release-readiness.md) | 候选身份、豁免条件、托管方案或 Editor 范围改变 |
| DEC-023 | 2026-08-26 | Editor E0 是单曲“逆向制曲”标注：首版本地 JSON、点事件和范围事件、tempo map、单特征叠加及 E1–E6；同 lane/inner class 范围不重叠 | project-owner | approved | [Scope](../product/scope.md) | 事件语义、数据边界、格式、依赖或里程碑改变 |
| DEC-024 | 2026-08-26 | Editor E6 固定验证 10,000 个事件；overlay 默认高度 35%、最小 12%；E1–E6 每个里程碑都必须独立 provisional、clean canonical 和 owner 审批 | project-owner | approved | [Editor execution plan](../delivery/editor/execution-plan.md) | 容量门禁、overlay 默认值、证据节奏或逐里程碑审批改变 |
| DEC-025 | 2026-08-26 | 批准 Editor E1–E6 delivery planning 并只开放 E1；E2–E6 继续逐里程碑等待 canonical 与 owner evidence 审批 | project-owner | approved | [Editor milestone plan](../delivery/editor/milestone-plan.md) | E1 范围、里程碑顺序或 evidence 门禁改变 |
| DEC-026 | 2026-08-26 | E1 canonical/人工结果获批准并开放 E2；一个 beat 固定为 `60/BPM` 秒，拍号分母只表达 beat 音符单位；tempo boundary 有合法 metered BPM 时按网格吸附，否则按微秒规范化原始时间 | project-owner | approved | [Editor interactions](../architecture/editor/interaction-contracts.md) | BPM/拍号含义、boundary 吸附、E2 范围或门禁改变 |
| DEC-027 | 2026-08-27 | 批准 E2 canonical 结果并开放 E3 point annotation；E4–E6 继续逐里程碑等待独立 canonical 与 owner 审批 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | E3 范围、point 交互或逐里程碑门禁改变 |
| DEC-028 | 2026-08-27 | 批准 E3 canonical、point lane、inner class、自适应网格与点标记结果，关闭 E3 并开放 E4 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | point 语义、E4 overlay 范围或门禁改变 |
| DEC-029 | 2026-08-27 | 批准 E4 canonical、21 项 overlay、三手柄、pointer-through 与错误隔离结果，关闭 E4 并开放 E5 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | overlay renderer、pointer-through、E5 范围或门禁改变 |
| DEC-030 | 2026-08-27 | 批准 E5 canonical、范围创建/调整、重叠校验、键盘与持久化结果，关闭 E5 并开放 E6 最终加固 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | range 语义、E6 阈值、双浏览器或最终加固门禁改变 |
| DEC-031 | 2026-08-28 | Analyzer 使用稳定 slot 0–3 DOM 和实际高度最短列；390/1024 一列、1280/1920 两列、gap 18px，ResizeObserver 以单 RAF 合并且卸载成对释放；不引入 pretext、不改变分析/持久化契约 | project-owner | approved | [System design](../architecture/system-design.md) | slot 顺序、列断点、动态高度、Observer/RAF 所有权或 Analyzer 契约改变 |
| DEC-032 | 2026-08-28 | 先批准并关闭 Editor E6，再以 E7 把 Editor 改为紧凑双层工具栏和平面细线分区；桌面控件 30px、point/range 行 44px、侧栏 152/144px、波形 176px，窄屏波形 144px；FL Studio 仅作为密度参考，不复制配色、品牌资产或控件 | project-owner | approved | [ADR-0010](../architecture/adrs/0010-editor-compact-workbench.md) | Editor 密度令牌、区域层次、断点或既有功能契约改变 |
| DEC-033 | 2026-08-29 | E7 增补窗口级全屏悬浮分析层、左上复合开关/21 项菜单、按歌曲 visibility；旧 44/44 run 保留为 pre-revision，新候选为 46 步 | project-owner | approved | [ADR-0011](../architecture/adrs/0011-editor-fullscreen-overlay.md) | E7 浮层范围、记忆规则、canonical 步数或 owner 门禁改变 |
| DEC-034 | 2026-08-31 | 批准 E7 修订版 46/46 clean canonical 并关闭 E7；只采用已记录 artifact/补偿事实，不补写未提供的人工测量 | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | E7 candidate identity、artifact 或批准边界改变 |
| DEC-035 | 2026-08-31 | 实施 M13：21 卡固定顺序、默认全收起、最多四项 FIFO、V1 adapter 与最新 generation/revision；M14 拖动只登记，本轮仅本地提交 | project-owner | approved | [ADR-0012](../architecture/adrs/0012-analyzer-all-cards-fifo-active-analysis.md) | M13 行为、M14 边界、canonical 或 Git 交付授权改变 |
| DEC-036 | 2026-09-01 | 实施 M14：21 卡前后插入、全局 featureOrder、pointer/touch/click/keyboard、独立 live、V1 optional field；排序与 FIFO/Worker 隔离，只本地提交 | project-owner | approved | [ADR-0013](../architecture/adrs/0013-analyzer-accessible-card-reordering.md) | 顺序范围、输入语义、schema、canonical 或 Git 授权改变 |
| DEC-037 | 2026-09-02 | 批准 Visualizer V0：当前本地歌曲、单场景、固定 16:9、最多四个唯一 Analyzer 特征、两个内置模板，先实时预览/JSON 后实时 WebM；开放 system design | project-owner | approved | [Scope](../product/scope.md) | 场景数量、特征上限、数据来源、输出格式、录制路线或产品边界改变 |
| DEC-038 | 2026-09-02 | Visualizer delivery 固定新工程默认 Orthogonal Lines/720p30；1280+ 常驻三栏，1024–1279 中央预览加互斥抽屉；V1–V6 逐里程碑 canonical 与 owner 审批 | project-owner | approved | [Visualizer execution plan](../delivery/visualizer/execution-plan.md) | 默认模板/output、断点布局、切片、证据节奏或逐里程碑门禁变化 |
| DEC-039 | 2026-09-02 | V3 Orthogonal Lines 使用中心正交结构；intensity 同时控制中心向两端的长度与透明度；decay 为不改写 V2 resolved value 的确定性时间余辉；背景固定 `#020403`，颜色由现有参数控制 | project-owner | approved | [Binding and scene contracts](../architecture/visualizer/binding-and-scene-contracts.md) | 线条构图、intensity 映射、decay 算法/单位、背景或参数所有权改变 |
| DEC-040 | 2026-09-03 | 批准 V3 30/30 canonical evidence、Orthogonal Lines、确定性余辉与单 RendererHost；V3 改为 Complete、R-037/R-038 改为 Mitigated并开放 V4 | project-owner | approved | [Visualizer evidence](../quality/visualizer/evidence-index.md) | V3 canonical identity、owner review 结论或 V4 开放门禁改变 |
| DEC-041 | 2026-09-03 | V4 Cube Swarm 使用 64 方块核心频谱环、seed 外围上升方块和三颗分层轨道卫星；rise/orbit 使用 60Hz checkpoint 积分，同一 RendererHost 处理 context recovery | project-owner | approved | [Binding and scene contracts](../architecture/visualizer/binding-and-scene-contracts.md) | Cube 构图、频谱规范、几何常量、默认绑定、积分或 context 所有权改变 |
| DEC-042 | 2026-09-03 | 批准 V4 34/34 canonical evidence 与人工门禁；保持 canonical identity 不变，V4 改为 Complete 并开放 V5；R-039 因录制中 context loss 尚未验证而保持 Open | project-owner | approved | [Visualizer evidence](../quality/visualizer/evidence-index.md) | V4 canonical identity、owner review 结论、R-039 剩余范围或 V5 开放门禁改变 |
| DEC-043 | 2026-09-03 | V5 准备失败恢复录制前时间/播放态；录制开始后的取消或错误停在当前时间并暂停；活动录制或 ready Blob 离页使用站内决策对话框 | project-owner | approved | [Recording contract](../architecture/visualizer/recording-contract.md) | 录制失败恢复、ready Blob、离页或播放 checkpoint 语义改变 |
| DEC-044 | 2026-09-03 | Editor E8 固定 `88px/72px` 共享时间轴与 6px 波形安全区；同 URL 歌曲恢复后合并自动重试且不播放，异歌只提供显式 replace 入口；point marker 中心误差 `<=1 CSS px` | project-owner | approved | [ADR-0018](../architecture/adrs/0018-editor-timeline-recovery-and-marker-alignment.md) | 时间轴高度、恢复路由、自动播放边界、marker 几何或 canonical 约束改变 |
| DEC-045 | 2026-09-03 | 批准 E8 25/25 clean canonical、时间轴密度、恢复语义与 marker 可读性门禁；保持 canonical identity 不变，E8 改为 Complete，R-022/R-024/R-025 改为 Mitigated | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | E8 canonical identity、owner review 结论或 Editor readiness 边界改变 |
| DEC-046 | 2026-09-03 | 批准 V5 40/40 clean canonical、双浏览器默认 720p30 回放、页面静音音轨、同步、命令锁、取消/context 清理与原生保存门禁；保持 canonical identity 不变，V5 改为 Complete，R-039/R-040 改为 Mitigated并开放 V6 | project-owner | approved | [Visualizer evidence](../quality/visualizer/evidence-index.md) | V5 canonical identity、owner review 结论、R-039/R-040 或 V6 开放门禁改变 |
| DEC-047 | 2026-09-03 | V6 final hardening 固定双浏览器三格式、15 分钟四特征、20 次跨 workspace 生命周期、六个默认 WebM 与 54 步 canonical；不改变生产接口、JSON V1 或 runtime topology | project-owner | approved | [V6 eval plan](../quality/visualizer/v6-eval-plan.md) | V6 fixture、浏览器矩阵、资源口径、canonical 步数或完成门禁改变 |
| DEC-048 | 2026-09-04 | V6 以功能、平均 30fps 与可播放媒体为主：默认 renderer 关闭 MSAA、video track 使用 `motion` hint，三格式媒体允许最多四个目标帧间隔的偶发 packet gap，15 分钟压力的 Visualizer 单帧峰值放宽为 `<60ms`；平均 fps、双轨、codec、尺寸、时长、音轨、A/V 结束差、分析归因 `<50ms`、反馈与时钟门禁不变，V5 canonical 阈值不改 | project-owner | approved | [V6 eval plan](../quality/visualizer/v6-eval-plan.md) | V6 packet cadence、renderer frame、antialias、平均 fps 或录制拓扑改变 |
| DEC-049 | 2026-09-04 | 批准 V6 54/54 clean canonical 及双浏览器制作、原生保存/回放、键盘/焦点、长时操作与 context 清理人工门禁；保持 canonical identity 不变且无需重跑，V6 改为 Complete、R-041 改为 Mitigated，并开放独立 Visualizer release-readiness review | project-owner | approved | [Visualizer evidence](../quality/visualizer/evidence-index.md) | V6 canonical identity、owner review 结论、R-041 或 readiness 边界改变 |
| DEC-050 | 2026-09-04 | Visualizer 在支持的 `>=1024px` 桌面视口中固定占一个 `100dvh`，document/body 不纵向滚动，左右侧栏独立滚动且阻止 scroll chaining；Analyzer 精确值表样式抽取为共享 `.app-scrollbar`，本次只迁移 Analyzer 表与 Visualizer，后续新增或修改的可见滚动容器必须复用 | project-owner | approved | [Viewport scroll eval](../quality/visualizer/viewport-scroll-eval-plan.md) | 支持断点、页面/侧栏滚动所有权、共享样式或例外范围改变 |
| DEC-051 | 2026-09-04 | 实施 Editor E9：BPM 轨道与波形共享滚动/时间几何，区间按单行可用宽度在完整编辑、摘要、隐藏间切换，内部 boundary 支持右键和键盘删除；E8 canonical 保持历史不变 | project-owner | approved | [Editor E9 eval](../quality/editor/e9-eval-plan.md) | E9 范围、展示阈值、删除继承语义、29 步 canonical 或完成门禁改变 |
| DEC-052 | 2026-09-04 | 修订 Editor E9：旧 29/29 run 保留为 `pre-revision`；删除独立 tempo row，将 28px BPM 标记条并入波形时间列，移除重复左侧标签并保留唯一滚动、三级展示和删除语义 | project-owner | approved | [ADR-0020](../architecture/adrs/0020-editor-compact-tempo-strip.md) | 紧凑条几何、输入样式、旧 evidence 状态、29 步 revised canonical 或 owner 门禁改变 |
| DEC-053 | 2026-09-04 | 批准 E9 revised 29/29 canonical 与紧凑 BPM 条、向上标记、无框输入、共享滚动、删除语义、分类按钮、候选线和单分隔线人工门禁；保持 canonical identity 不变，E9 改为 Complete、R-042 改为 Mitigated并开放 Editor release-readiness | project-owner | approved | [Editor evidence](../quality/editor/evidence-index.md) | E9 canonical identity、owner review 结论、R-042 或 readiness 开放边界改变 |
| DEC-054 | 2026-09-04 | Editor release-readiness 固定 E9 implementation 为运行时候选、禁止后续 `src/` 漂移，以 24 步双浏览器针对性审计复核 E1–E9；预期结论为 Ready with waivers，但 W-ED-001–W-ED-006 与整体结论仍需 owner 单独批准 | project-owner | approved | [Editor release readiness](../quality/editor/release-readiness.md) | 候选 identity、24 步范围、waiver、支持矩阵或批准边界改变 |
| DEC-055 | 2026-09-04 | 跳过 agent 的沙箱外本地端口与 Chrome/Edge 重跑；保留 provisional 24/24 和 clean 环境阻断 artifact，不把未执行浏览器项记为通过，Editor readiness 改由 owner 自行审阅相关 evidence gap 与 waivers | project-owner | approved | [Editor release readiness](../quality/editor/release-readiness.md) | owner review 方式、browser evidence gap、自动化环境授权或 readiness 结论改变 |
| DEC-056 | 2026-09-04 | 保留 V0 首版两个模板的历史事实，允许通过项目 Scene Generator Skill 添加受控内置场景；输入不完整零写入，完整合同须再次获批，场景完成后重评 readiness 且不改写 V1–V6 canonical | project-owner | approved | [ADR-0021](../architecture/adrs/0021-controlled-visualizer-scene-generation.md) | SceneBrief/合同门禁、生成职责、测试矩阵或 readiness 继承规则改变 |
| DEC-057 | 2026-09-04 | 打开 Editor E10：区间模式只作用于右拖起始 lane/class；Cmd/Ctrl+C 立即向后复制；移动吸附当前网格；越界/point duplicate/range overlap 整批拒绝；E9 canonical 不变且 readiness 候选转为 pre-E10 | project-owner | approved | [E10 eval](../quality/editor/e10-eval-plan.md) | E10 行为、33 步证据、owner review 或 readiness candidate 改变 |

## Approval Evidence

`project-owner` 于 2026-07-24 通过“PLEASE IMPLEMENT THIS PLAN”明确要求将随请求给出的产品、架构、里程碑和测试决定落入仓库。本注册表记录的是批准的决策；M3–M12 的实现状态仍以 [milestone plan](../delivery/milestone-plan.md) 和可复现证据为准。

2026-09-02，`project-owner` 明确回复：“我批准 Visualizer V0 产品意图、单场景模板模型、最多四项分析特征、两个内置场景与 WebM 路线；同意进入 Visualizer 架构设计。”DEC-037 与 PROD-014V 据此获批并开放 system design。随后 owner 明确批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017，并进一步批准 Visualizer V1–V6 delivery planning、同意开始 V1；DEC-038 据此生效。V1 在 clean commit `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` 上完成 21/21 canonical，并于同日获 owner 批准；V1 关闭、V2 开放，R-034 改为 `Mitigated`。该批准不构成 V2、场景、录制、readiness 或上线通过。

同日，`project-owner` 明确回复“使用项目相关技能执行此计划”。随附计划要求保持 V2 canonical identity 不变、批准 V2 quality/evidence、关闭 V2 并开放 V3；据此 V2 为 `Complete`、R-035/R-036 为 `Mitigated`、V3 为 `In Progress`。该批准不补写用户未提供的人工观察值，不构成 V3 canonical、V4–V6 或生产上线通过；继续只创建本地提交，不 fetch、不 push。

同一计划固定 DEC-039 的中心正交线条、intensity 长度/透明度双映射、确定性时间余辉与 `#020403` 背景，并授权先提交 V3 quality contract 再实施。该决定细化 ADR-0016，不改变 JSON V1、V2 resolved value、四特征上限或 V4–V6 范围。

2026-09-03，`project-owner` 明确回复：“我批准 Visualizer V3 canonical evidence、Orthogonal Lines 场景、确定性余辉与单 RendererHost 结果；同意将 V3 标记为 Complete 并开放 V4。”DEC-040 据此生效；V3 canonical identity 保持不变且无需重跑，R-037/R-038 改为 `Mitigated`，V4 改为 `In Progress`。该批准不构成 Cube Swarm、WebM、V6 readiness 或生产上线通过。

同轮 V4 计划澄清中，`project-owner` 选择“核心环群（推荐）”，并以“PLEASE IMPLEMENT THIS PLAN”批准完整 V4 实施计划。DEC-041 据此固定 64 方块频谱环、seed 外围上升方块、三颗分层轨道卫星、默认 Spectrum+Energy 两项分析、60Hz rise/orbit checkpoint 与同 RendererHost context recovery；V4 quality contract 可直接标记为 `approved` 并实施。该决定不修改 JSON V1，不构成 V4 canonical/人工门禁、V5 WebM 或生产上线批准。

同日，`project-owner` 明确回复“`我批准`关闭 V4 并开放 V5”，并在后续计划澄清中选择 R-039 保持 `Open`、分阶段播放恢复和站内离页决策对话框；随后以“PLEASE IMPLEMENT THIS PLAN”批准 V5 完整计划。DEC-042/DEC-043 据此生效：V4 canonical identity 不变且无需重跑，V4 evidence 改为 `approved`、V4 改为 `Complete`、V5 改为 `In Progress`。该批准不构成 V5 canonical、V6 readiness 或生产上线通过。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”批准 Editor E8 可用性修正及 ADR-0018、delivery 与 quality 计划。DEC-044 据此生效，E1–E7 历史 evidence 不改写，E8 改为 `In Progress`。E8 最初因工作树同时包含独立 Visualizer V5 修改而只形成 scoped/provisional 证据；V5 独立提交后，owner 又明确“e8的修改可以在v5提交后提交”，据此允许 E8 单独提交并运行 clean canonical。clean canonical 25/25 通过后，owner 于 2026-09-03 确认 E8 已完成；证据审计确认门禁满足，DEC-045 据此将 E8 改为 `Complete`，R-022/R-024/R-025 改为 `Mitigated`，不重跑或改写 canonical artifact。

同日，`project-owner` 明确“批准 V5”，并以本计划确认该批准覆盖双浏览器默认 720p30 回放、页面静音音轨、音画同步、命令锁、取消/context 清理和真实原生保存人工门禁。DEC-046 据此保持 implementation commit `9b5af09c5846415a8e5465e710e6095f1e7db310`、evidence commit `10a2bc0c7a30413d80689ed41dc98caae33ec21f`、run `V5-2026-09-03T03-49-31-211Z-9b5af09c` 与 summary SHA-256 不变且无需重跑；V5 改为 `Complete`，R-039/R-040 改为 `Mitigated`，V6 改为 `In Progress`。R-041 继续由 V6 长时加固覆盖，本批准不构成 V6 canonical、整体 readiness 或生产上线通过。

同一轮，owner 以“PLEASE IMPLEMENT THIS PLAN”批准 V6 final hardening 的质量契约与实施。DEC-047 据此固定现有三格式 fixture、900 秒 OPFS WAV、Cube 四特征与 Orthogonal 双特征转换、测试专用全资源 probe、双浏览器六个默认 WebM 和 54 步 canonical。V6 quality 文档可标记为 `approved` 并实施；V6 canonical 登记后仍需独立 owner 门禁，且不改变 JSON V1、route、scene/recording 接口或生产拓扑。

2026-09-04，V6 重复真实媒体采样证明同一 Canvas 可稳定约 60fps 绘制，但 Chrome/Edge 的 VP9 recorder 在组合负载下仍会偶发产生约 78–110ms packet gap，900 秒压力组合还出现单次 55.8ms Visualizer frame。`project-owner` 明确允许在卡顿较小时略微放宽标准并优先完成功能；DEC-048 据此把 V6 三格式门禁放宽为最多四个 30fps 帧间隔，并把 V6 Visualizer 单帧峰值调整为 `<60ms`，同时保持平均 fps `±5%`、媒体结构、时长、音轨、同步、分析归因 `<50ms`、反馈与时钟门禁。实现保留关闭 MSAA、`motion` hint 与等价 Cube 计算优化。该决定不改写 V5 canonical、JSON V1、录制拓扑或 V6 owner 最终门禁。

同日，DEC-048 修订在独立 implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` 上形成 clean canonical `V6-2026-09-03T16-33-03-497Z-ef12ce39`，54/54 通过且 summary SHA-256 为 `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014`。本记录是执行证据而非新的产品决定；V6 保持 `In Progress`、evidence 保持 `in-review`、R-041 保持 `Open`，等待 owner 完成人工制作、原生保存/回放、键盘/焦点与长时清理门禁。

同日，`project-owner` 明确要求“先完成并且批准和关闭 V6”，并随后批准按关闭与视口滚动修订计划实施。DEC-049 据此将该批准登记为双浏览器完整制作、默认 WebM 原生保存/回放、键盘/焦点、长时操作和 context 清理人工门禁通过；implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd`、evidence registration commit `636e4d2defeb90147e949bcf20b7b0690dd77424`、run、54/54 结果、summary 和媒体 hash 均保持不变且无需重跑。V6 改为 `Complete`、R-041 改为 `Mitigated`；该批准只开放独立 Visualizer release-readiness review，不构成整体 readiness 或生产上线批准。

同一实施计划批准 DEC-050：截图所示的 document 纵向滚动被登记为独立 Visualizer readiness 修订，不回开 V6、不创建 V7。支持的 `1024/1280/1920` 桌面宽度中，页面高度固定为一屏，左右工作台侧栏拥有各自滚动上下文；`<1024px` 现有最小宽度/横向兼容策略不扩展为移动端支持。共享滚动条以 Analyzer 精确值表为视觉事实源，本次只迁移该表和 Visualizer，Editor、歌曲列表和 Analyzer 页面既有滚动条不在本次范围。

DEC-050 随后在独立 clean implementation commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 上完成。Chrome `152.0.7977.66` 与 Edge `152.0.4191.53` 专项各 2/2 通过，覆盖四组视口、DPR 1/2、页面高度、双侧滚动隔离、边界 chaining、compact drawer、16:9 与单 renderer/RAF；V1 双浏览器、V6 integration、Analyzer M7 和静态门禁均通过。该执行证据不改变 DEC-049/V6 canonical，也不构成 owner 视觉、整体 readiness 或生产上线批准。

同日，owner 在 E9 首个 29/29 候选的人工复核中要求取消独立 66px tempo 模块，把 BPM 信息压缩为紧贴波形的 28px 标记条；辅助线只向上指向波形，移除重复左侧标签，并以 11px 无框行内控件继续直接编辑。随后 owner 明确要求实施完整修订计划，DEC-052/ADR-0020 据此获批。旧 run `E9-2026-09-04T02-49-18-960Z-cf0a79b1` 保留为 `pre-revision` 且 artifact 不改写；E9、R-042 和 Editor readiness 门禁均不提前关闭。

DEC-052 的 implementation commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 已形成；clean revised canonical `E9-2026-09-04T03-51-33-088Z-13614673` 29/29 通过，summary SHA-256 为 `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c`。该执行事实只把当前 evidence 推进为 `in-review`；E9 仍为 `In Progress`、R-042 仍为 `Open`，等待 owner 人工门禁。

同日，`project-owner` 明确要求“批准已有的修改”，并随后批准完整 E9 正式关闭与 Editor release-readiness 评审计划。DEC-053 据此把该批准登记为紧凑 BPM 条、箭头方向、无框输入、共享滚动、删除语义、分类按钮、候选线和单分隔线人工门禁通过；不补写未提供的主观数值。implementation `13614673bbf4d824f2ee109d36e04de6b3f8aabd`、evidence registration `299502d`、run、29/29 结果与 summary SHA-256 均保持不变且无需重跑。E9 evidence 改为 `approved`、E9 改为 `Complete`、R-042 改为 `Mitigated`；旧 E9 run 继续为 `pre-revision`。该批准只开放 Editor release-readiness 评审，不构成 readiness、整体产品或生产上线批准。

同一计划批准 DEC-054 与 Editor release-readiness 契约：运行时代码固定为 E9 implementation commit，后续只允许文档和测试 Harness 变化，`src/` 漂移必须阻断。评审限定本地 E1–E9、三格式、约 15 分钟与最新 Chrome/Edge，采用 24 步当前候选审计；预期 `Ready with waivers` 及 W-ED-001–W-ED-006 仍须 owner 单独批准。PROD-015 与独立 Visualizer readiness 状态均不因本决定改变。

readiness provisional 随后在相同 runtime source tree 上 24/24 通过；clean HEAD 尝试中 14 个非浏览器步骤通过，10 个浏览器步骤因沙箱禁止监听 `127.0.0.1:4173` 而未启动。`project-owner` 随后明确指示跳过沙箱外端口和 Chrome/Edge 重跑，把相关未验证项改为自行审阅。DEC-055 据此要求同时保留 provisional 与 clean fail artifact，不把环境阻断改写为产品失败或正式通过；readiness 继续为 `in-review`，等待 owner 审阅 evidence gap、W-ED-001–W-ED-006 和整体结论。

同日，`project-owner` 明确要求实施 Visualizer Scene Generator Skill 落地计划。DEC-056/ADR-0021 据此获批：V0 的两个模板继续作为 V1–V6 历史基线，post-V6 新场景必须先完成无写入输入校验，再由 owner 批准确定 Scene Contract；本轮只交付 Skill、规则、validator 与测试，不生成第三个场景，也不改变现有 canonical、readiness 或 PROD-015。

同日，`project-owner` 明确要求实施 Editor E10 小节批量编辑与离页弹窗修订计划。DEC-057/ADR-0022 据此获批，E10 改为 `In Progress`：模式默认关闭且不持久化，右拖只选择起始 lane/class 的真实小节，复制立即向后追加，移动吸附当前网格，所有冲突原子拒绝。该产品 `src/` 变化使 DEC-054 固定的 E9 readiness runtime candidate 只保留为 `pre-E10` 历史审计；E1–E9 canonical 和 artifact 不改写。

同日，`project-owner` 明确要求实施 Q0 质量设计计划，批准了 Q0 前置、四级严重度和 readiness 后置的阶段安排；同时要求三份质量文档先保持 `in-review`，经单独审阅后才生效。因此 DEC-010 的时序决定已批准，但 Q0 内容尚未批准。

`project-owner` 于 2026-07-28 明确批准 Q0 三份质量文档和两份 delivery 修订，DEC-010 的内容门禁随之生效并开放 M3。该批准不构成任何测试、浏览器或 readiness 通过证据。

## Execution Evidence

2026-07-28，DEC-011–DEC-013 约束下的首个 [M3 canonical run](../quality/evidence-index.md) 在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过。`project-owner` 随后明确批准该 evidence 与 working agreements，M3 据此关闭并开放 M4。该批准不是新的产品或架构决定，也不构成 Edge、M4–M11 或 readiness 通过。

同日，`project-owner` 明确要求实施 M4 计划，DEC-014 与 ADR-0001 的 M4 运行策略据此生效。M4 源码存在不等同于里程碑通过；仍需干净 commit canonical run、evidence 登记和 owner 批准。

M4 dirty-worktree provisional suite 随后通过，证明当前实现值得进入提交与 canonical 复跑步骤；由于它不绑定干净 commit，DEC-013 要求下不作为正式 evidence。

2026-07-29，`npm run eval:m4` 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上 13/13 步骤通过，正式记录已追加到 [evidence index](../quality/evidence-index.md)。`project-owner` 随后明确批准 M4 evidence 与 working agreements，M4 据此关闭，ADR-0003 对应的 M5 hybrid recovery 开始实施；M5 仍需自己的 provisional、clean-commit canonical 和 owner 审批。

同日，M5 dirty-worktree provisional suite 16/16 通过。依据 DEC-013，它只作为实现反馈；原生权限人工检查、用户提交、clean-commit canonical、正式 evidence 和 owner 审批仍是 M5 的关闭条件。

随后 `npm run eval:m5` 在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上 16/16 通过，正式记录已追加到 [evidence index](../quality/evidence-index.md)。`project-owner` 于 2026-07-29 确认 Chrome 原生权限人工检查通过，并明确批准 M5 evidence 与 working agreements；M5 据此关闭并开放 M6。

同次人工检查中，一段超出 DEC-006“约 15 分钟”支持边界的本地压力输入未开始播放。依据 DEC-015，该观察不计入 M5 pass/fail，不表示长音频必须失败，也不扩大支持范围；若支持范围内的有效格式复现，或失败破坏当前会话与其他歌曲可用性，则重新进入缺陷调查。

同日，`project-owner` 以“按计划执行”批准并要求实施 M6 详细计划，DEC-016 据此生效。实现源码和专项测试存在只表示进入 `In Progress`；依据 DEC-013，仍需 dirty-worktree provisional、用户提交、clean-commit canonical、正式 evidence index 与 owner 审批后才能关闭 M6。

2026-07-30，DEC-013 约束下的 M6 clean-commit canonical run 已 20/20 通过并登记到 [evidence](../quality/evidence-index.md)。`project-owner` 随后明确批准 M6 canonical evidence、working agreements、system map 与 glossary，并同意将 M6 标记为 `Complete`、开放 M7；M7 在明确开始实现前保持 `Planned`。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”明确要求实施 M7 三卡学习切片，并批准四槽三活动特征、首次默认三卡、已保存空工作区恢复为空及完整四特征场景顺延 M8 的决定。DEC-017 据此生效，M7 改为 `In Progress`；该授权不构成 M7 evidence 批准，也不开放 M8。

2026-08-21，`project-owner` 确认卡片选择/替换、zoom/pan、鼠标与键盘 seek、刷新恢复均通过，并提交 L1/L2/L3 三条正确解释；随后明确批准 M7 canonical evidence、关闭 M7并开放 M8。owner 又选择项目内 Flux 与零能量统一为 0，并要求执行 M8 完整计划。DEC-018 据此生效，M8 改为 `In Progress`；M8 evidence 在 clean canonical 与后续 owner 审批前不得标记 approved。

同日，DEC-018 的实现、golden 与 clean canonical 28/28 已完成，R-020 产品阻断标记为 `Mitigated`。M8 evidence 仍为 `in-review`，等待 Windows Chrome 补偿验证与 owner 批准；该执行事实不开放 M9。

随后 `project-owner` 批准 M8 canonical evidence 与界面稳定化结果，同意将 M8 标记为 `Complete` 并开放 M9。DEC-018 据此完成审批；R-021 由 Windows Chrome owner 签字关闭，M9 在明确开始实现前保持 `Planned`。

同次请求中，`project-owner` 明确要求实施 M9 计划，并把非首页导航栏背景模糊列为 M9 Slice 0。DEC-019 据此生效，M9 改为 `In Progress`；M8 canonical 身份不重新打开，M9 仍需自己的 provisional、clean canonical、in-review evidence 与 owner 审批。

2026-08-23，`project-owner` 明确批准 M9 canonical evidence 与非首页导航栏模糊效果，同意将 M9 标记为 `Complete` 并开放 M10。该批准关闭 DEC-019 的执行门禁，不重写 M9 canonical 身份，也不构成 M10 或 release readiness 通过。

同日，`project-owner` 以“PLEASE IMPLEMENT THIS PLAN”明确要求实施 M10，并确认 Complex Spectrum 完整展示 1024 bins。DEC-020 据此生效，M10 改为 `In Progress`；M10 provisional、clean canonical、`in-review` evidence 与 owner 审批仍分别必需。

随后 M10 provisional 与 clean canonical 均 36/36 通过，DEC-020 的完整 1024-bin 决策已由浏览器自动化复核，正式 evidence 为 `in-review`。owner 人工任务与审批仍未完成，因此 M10 保持 `In Progress`，M11 保持 `Planned`。

2026-08-25，`project-owner` 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”该批准关闭 DEC-020 的执行门禁，不改变 M10 canonical 身份，也不构成 Edge、M11 或 release readiness 通过；M11 在明确开始实施前保持 `Planned`。

同日，owner 确认 Edge 已安装并明确要求开始 M11 最终加固。该执行授权把 M11 改为 `In Progress`；真实 Edge 自动化、原生权限人工矩阵和 clean canonical 完成前，不形成新的 readiness 决策。

M11 clean canonical `M11-2026-08-25T10-05-12-783Z-99c67792` 随后在真实 Chrome/Edge 上 38/38 通过并登记为 `in-review`。该执行证据关闭“缺少真实 Edge 自动化”的缺口，但不构成 M11 owner 批准或 readiness 决策；原生 Edge 权限与辅助技术人工验收仍是下一门禁。

2026-08-26，`project-owner` 明确回复：“我批准 M11 canonical evidence、Edge 原生权限与最终加固结果；同意将 M11 标记为 Complete 并创建 release-readiness。”DEC-021 据此生效；M11 关闭。该决定只授权创建 readiness review，不表示其拟议豁免已经批准，也不构成生产发布决定。

同日，`project-owner` 明确回复：“我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。”DEC-022 据此生效，W-001–W-007 获接受，R-019 只针对当前 Analyzer 候选改为 `Accepted`。该决定允许开始 Editor 产品意图，不授权生产部署，也不授权 Editor 架构或代码。

随后 owner 要求按 Editor E0 范围事件修订计划更新产品意图。DEC-023 记录该草案：点事件与长音色/效果范围事件进入首期路线，范围创建使用严格向后的两次点击、`Esc`/空白右键取消、自适应网格端点和同类不重叠。

同日，`project-owner` 明确回复：“我批准 Editor E0 产品意图、点事件与范围事件规则、成功指标和开放问题；同意进入 Editor E0 架构设计。”DEC-023、PROD-014E 与 PROD-020 据此获批并开放 system design；该批准不构成架构、delivery、实现、质量或 Editor readiness 通过。

随后 ADR-0006–0009 与 Editor project/interaction 子契约按已批准产品范围进入评审：它们分别固定 runtime lease、JSON/草稿、秒数/tempo/event 和 overlay renderer 边界。`project-owner` 于 2026-08-26 明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”上述 ADR 与架构契约据此获批；R-022–R-027 继续为 `Open`，execution planning 已开放，但 E1 代码仍保持关闭。

同次 delivery planning 请求中，owner 固定 E6 10,000 事件容量门禁、overlay 默认 35%/最小 12%，并要求 E1–E6 各自运行 provisional、clean canonical 与 owner 审批；DEC-024 据此生效。四份 Editor delivery 文档仍为 `in-review`，DEC-024 不构成 E1 开工授权。

随后 `project-owner` 明确回复：“我批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 E1。”DEC-025 据此生效，四份 Editor delivery 文档改为 `approved`，E0-D 改为 `Complete`、E1 改为 `In Progress`。该决定不构成 E1 功能、canonical 或风险缓解证据，也不开放 E2。

DEC-025 约束下的 E1 实现已提交，clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过并登记到 Editor evidence index。该执行事实不是新产品/架构决策；owner 尚未批准人工门禁，因此 R-022/R-023/R-027 和 E1 状态不提前改变，E2 仍未开放。

同日，`project-owner` 明确回复：“我批准 Editor E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；同意将 E1 标记为 Complete 并开放 E2。”E1 据此关闭，R-022/R-023 改为 `Mitigated`，E2 改为 `In Progress`。owner 同时选择 DEC-026 的 BPM/拍号与无网格 boundary 语义；R-024/R-026/R-027 和 E3 门禁不因此提前关闭。

DEC-026 约束下的 E2 实现已提交，clean canonical `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 在 commit `9fc5c0a81fcf90abfbc665412277147cd958200f` 上 22/22 通过并登记到 Editor evidence index。该执行事实不是新产品或架构决策；owner 尚未批准人工门禁，因此 R-024/R-026/R-027、E2 状态和 E3 门禁不提前改变。

2026-08-27，`project-owner` 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 结果并开放 E3；DEC-027 据此生效。E2 改为 `Complete`，R-026 改为 `Mitigated`，E3 改为 `In Progress`；该决定不构成 E3 实现或 evidence，也不开放 E4。

同日，E3 implementation commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 与 clean canonical `E3-2026-08-27T02-53-58-176Z-c670ddf5` 已形成，26/26 通过，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`。该执行事实不新增决策；DEC-027 的 owner approval 门禁仍未满足，E3 不关闭、E4 不开放。

同日，`project-owner` 明确批准 E3 canonical evidence、point lane、inner class、自适应网格与点标记结果，DEC-028 据此关闭 E3 并开放 E4。随后 owner 明确批准 E4 canonical evidence、21 项 overlay、三手柄、pointer-through 与错误隔离结果，DEC-029 据此关闭 E4 并开放 E5。

E5 clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 随后在 implementation commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 上 35/35 通过。`project-owner` 明确批准 E5 canonical evidence、范围事件创建/调整、重叠校验、键盘与持久化结果；DEC-030 据此关闭 E5 并开放 E6。该决定不构成 E6 evidence 或 Editor release-readiness。

同日，owner 通过 M12 实施计划批准 DEC-031，并要求 agent 自行提交及完成后续、无需推送远程。首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 暴露 M7 短 fixture 未保证播放输入的测试前置条件；失败 artifact 保留。修复 commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 先使目标用例连续 5/5 通过，再由 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 完成 12/12，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`。DEC-031 据此完成验证，M12 关闭、R-028 缓解、Analyzer readiness 恢复；PROD-015 与 Editor E6 不被本决策覆盖。

2026-08-28，`project-owner` 明确要求“可以先批准之前的e6修改”，本次回复据此作为 E6 canonical、原生文件、辅助技术与长会话人工门禁的完整批准；E6 关闭，R-024、R-025、R-027 改为 `Mitigated`。同一轮需求要求 Editor 参考编曲工作台的密度与线性分区方式，DEC-032 据此开放 E7。该批准不改写 E6 canonical，也不授权生产上线；Editor release-readiness 延后到 E7 获批之后。

2026-08-31，owner 以完整 M13 实施指令先批准 E7 修订候选，DEC-034 据此关闭 E7；随后批准 DEC-035/ADR-0012 并授权 agent 完成实现、本地提交、clean canonical 与 evidence/readiness 复核，不推送远程。M12 evidence 保留为历史，M13 未通过前 readiness 保持 `in-review`。

2026-09-01，DEC-035 的实现 commit `63c04005670145d83ee181d474197bce921c5300` 与 clean canonical `M13-2026-08-31T17-44-39-680Z-63c04005` 已形成，17/17 通过，summary SHA-256 为 `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc`。该执行事实关闭 M13、缓解 R-028–R-030 并恢复 Analyzer `Ready with waivers`；M14 和 PROD-015 均未因此开放。

同日，owner 先确认插入排序、工作区全局保存和“动作面板 + 恢复默认”，随后明确要求完整实施 M14。DEC-036/ADR-0013、产品/架构/delivery/eval、本地提交、clean canonical 与 evidence/readiness 复核据此获批；M13 readiness 转为历史，远程不推送。

同日，DEC-036 implementation commit `0e991307d9045a1ec84ddaae0515612240894a92` 与 clean canonical `M14-2026-09-01T02-36-49-995Z-0e991307` 已形成，19/19 通过，summary SHA-256 为 `b169d6ff082746fc3cbe5ac6064151233c4f2869cba6e41f9dcdd7d052916fcc`。该执行事实关闭 M14、缓解 R-031–R-033 并恢复 Analyzer `Ready with waivers`；PROD-015 仍开放。

## Historical Evidence Gap

在本轮 ADR 之前，仓库没有可追溯记录说明当前路由、三种 MusicBar 样式、Analyzer 试验组件或 Editor/Visualizer 占位分别由谁批准。它们只能作为当前代码事实，不能被反推为已批准产品范围。若后续保留、替代或删除这些行为，应在对应实施切片中记录新决策和回归证据。
