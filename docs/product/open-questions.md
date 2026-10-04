---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
next_action: "PROD-024–029 已决定或明确延后；按 DEC-063–066 进入 execution planning，质量/性能阈值与证据尚待交付"
---

# Open Questions

## 视频目标架构决定（2026-10-04 approved）

| ID | 状态 / 决定 | 对后续工作的影响 | Owner | 下一步 / 重访条件 |
| --- | --- | --- | --- | --- |
| PROD-024 | Decided：浏览器 ONNX Runtime Web/WebGPU + htdemucs_ft 四个专用 fp16weights 模型；音频不上传，模型/metadata 用 IDB、stem 用 OPFS | 本地边界、模型来源/校验、单专用分离 Worker、10GB/quota 与资源风险 | project-owner | 按 DEC-063/064 先验证兼容性/质量/性能，模型/runtime/许可变化时复核 |
| PROD-025 | Decided：扩展现有 TS flux/onset/自相关 + DP 逐拍与局部 tempo，mix 主输入、drums 辅助；小节起点、BPM/拍号由用户确认 | 固定/变化 BPM、静音、空鼓轨、歧义和评分 golden；不承诺自动 downbeat/meter | project-owner | delivery 定义算法评分/阈值与人工复核验收；自动 meter 能力另行批准 |
| PROD-026 | Deferred：自动长音色/FX 和 stem→MIDI 不进入首条交付链；现有人工 point/range 保留 | 不扩展 Editor V1 自动事件 schema；只读 proposal 与 hash 冲突检查 | project-owner | 有专项分类、质量、许可和输入输出契约后重新评审，不阻断本次 planning |
| PROD-027 | Decided：只读提案、逐项确认、Visualizer Project V2、V1 单向迁移、compact energy/beat 与默认 other/beat 绑定 | 保留用户数据；Editor 改 tempo 后显式刷新 Editor 快照与节拍映射 | project-owner | 按 DEC-065/066 验证 apply/hash、迁移、source/stale、默认映射与导出 |
| PROD-028 | Decided：首链继续实时 WebM，沿用 ≤100ms A/V 目标；离线、批量及其他格式延后 | 不改变现有单 RendererHost/pre-Gain 录制边界；模型下载与处理独立计时 | project-owner | 新 delivery 做双浏览器媒体回归；新增格式/离线任务需另行评审 |
| PROD-029 | Deferred：3D 分析辅助图与原子视觉素材生成；第一条链只用已批准场景与输入 | 不扩展资产、许可或场景绑定边界 | project-owner | 具体视觉任务、数据映射和素材许可明确后独立设计，不阻断本次 planning |

本轮授权已关闭架构取舍并明确延后范围；模型兼容、分离质量、节拍准确度和性能仍待 delivery 验证，不以 Decided 表示风险缓解。技术契约见 [system design 第 21 节](../architecture/system-design.md#21-automated-audio-to-video-target-architectureapproved)。
下列旧问题和批准记录保留其历史语境；新目标不能把已关闭的 PROD-014V 解释为对上述能力的批准。

## Closed in Video Goal Review

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-023 | 面向音频可视化视频创作者，优先尽可能自动生成，同时保留人工修正和完整手动操作 | 2026-10-01 由 `project-owner` 明确批准产品意图并补充此原则；细分用户画像与具体自动能力仍按后续阶段评审 |

## Open, Non-Blocking

| ID | Question | Why it remains open | Impact | Blocks current next stage? | Owner | Revisit trigger |
| --- | --- | --- | --- | --- | --- | --- |
| PROD-013 | 未来是否提供上传、云端处理、账户或跨设备同步？ | 当前只批准浏览器本地处理；未来能力尚无目标用户、隐私或服务设计 | 若进入范围，将改变产品数据边界、架构、合规和发布要求 | 否 | project-owner | 提议任何远端音频或账户能力时 |
| PROD-014 | 除 Analyzer、Editor 和已定义的 Visualizer 外，其他未定义空白 Tab 分别解决什么用户问题？ | Visualizer 已由 PROD-014V 关闭；其他空白入口仍没有已批准用例 | 未来产品范围、导航和架构 | 否 | project-owner | 其他未定义 Tab 被提议进入交付时 |
| PROD-015 | 正式发布使用哪个静态托管平台、域名和 SPA fallback 配置？ | Analyzer readiness 已获有条件批准，但当前只要求 HTTPS 或 localhost，尚无生产托管决策 | 部署、监控、回滚和运行配置 | 不阻断 Editor E0；继续阻断 Analyzer 正式上线 | project-owner | owner 决定开始 release and feedback 时 |
| PROD-016 | 是否需要在 owner-only 验证之外证明普遍学习效果？ | 当前成功标准只由 owner 对 3/3 黄金片段验证 | 用户研究样本、测量设计和对外表述 | 否 | project-owner | 需要对外声称学习效果或扩大目标人群时 |
| PROD-017 | Editor 何时需要 JSON 之外的工程格式？ | 首版选择器只展示已注册的 JSON；当前没有第二种格式的用户任务或交换对象 | codec 注册、导入导出 UI、兼容与测试矩阵 | 否 | project-owner | 出现明确的外部工具交换格式或用户任务时 |
| PROD-018 | 内部 BPM 估计不足时是否引入第三方依赖？ | owner 要求安装前先审批；目前尚无内部算法及准确性证据 | 包体、许可、精度、Worker 和 fixture | 否；E2 先实现并评估内部估计 | project-owner | E2 golden 证明内部估计达不到批准阈值时 |
| PROD-019 | 是否增加同类范围重叠、自动合并、裁剪或自由时间精度？ | 首版已选择同类不重叠、自适应网格和无自动合并；更复杂语义尚无任务证据 | RangeEvent 数据语义、编辑状态机和兼容性 | 否 | project-owner | 用户提出具体复合效果或非节拍事件任务时 |
| PROD-022 | Visualizer 后续是否取消每个场景最多四个唯一 Analyzer 特征的上限？ | 首版继承现有四项 Worker/cache 边界；目前两个内置场景不需要第五项 | Worker/cache 调度、内存、渲染帧预算、工程兼容和质量矩阵 | 否；首版明确保持四项 | project-owner | 出现必须同时使用第五个唯一特征的批准场景时 |

## Closed in Visualizer V0 Review

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-014V | Visualizer 是本地歌曲音频可视化制作台；单场景、固定 16:9、两个内置模板、固定值/最多四项 Analyzer/Editor 事件绑定，先实时预览与工程 JSON，后实时 WebM | 2026-09-02 由 `project-owner` 明确批准并开放 system design；delivery、实现、quality 和上线仍需各自门禁 |

## Closed in Prior Reviews

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-001 | 目标用户与核心问题 | 音频分析学习者；把 Meyda 输出对应到具体时刻、听感和音色变化 |
| PROD-002 | 首批范围 | Analyzer 为主，播放器、队列和共享时间轴为基础；Editor/Visualizer 等未定义页面排除 |
| PROD-003 | 成功标准 | 黄金一致性、100ms 游标、主线程响应、owner 脚本任务和 3/3 学习解释 |
| PROD-004 | 支持矩阵 | 本地 MP3/WAV/FLAC、约 15 分钟、最新 Chrome/Edge 桌面、1024/1280/1920 CSS px |
| PROD-005 | 数据边界 | 当前批准范围内音频、元数据和分析结果只在浏览器本地处理 |
| PROD-006 | 持久化 | 最近一次会话；全部句柄，当前 Blob 与当前分析缓存；刷新归零暂停 |
| PROD-007 | 可访问性 | 核心任务键盘可用、焦点可见、非纯颜色表达、支持 reduced motion |
| PROD-008 | 批准人 | `project-owner` 负责产品、技术和阶段批准 |
| PROD-009 | 性能目标 | 输入反馈 100ms 内、无分析归因主线程长任务；不设置分析完成 wall-clock SLA |
| PROD-010 | 测试音频 | 合成 PCM 加有 provenance/hash 的同源 MP3/WAV/FLAC 短 fixture |
| PROD-011 | 当前运行环境 | 静态 SPA 运行在 HTTPS 或 localhost；正式托管延后到 release 阶段 |
| PROD-012 | Analyzer 核心任务 | 学习和比较；最终覆盖 21 项，首批 RMS、Amplitude Spectrum、Chroma |
| PROD-012M13 | Analyzer 卡片与活动模型 | 21 张固定顺序折叠卡；最多四项 FIFO 活动分析；新工作区默认空队列；V1 carrier 兼容 |
| PROD-021 | M14 卡片排序 | 2026-09-01 批准前后插入、工作区全局顺序、鼠标/touch/点击动作/键盘、独立读屏播报、恢复默认和 V1 可选字段；不改变 FIFO |

## Closed in Editor E0 Review

| ID | Decision | Resolution |
| --- | --- | --- |
| PROD-014E | Editor 定义为对已有歌曲进行点/范围时间标注的“逆向制曲”工具，不修改音频 | 2026-08-26 由 `project-owner` 批准；system design 随后获批并开放 execution planning，不开放实现 |
| PROD-020 | 范围事件以两次左键选择严格向后的起止位置；`Esc`/空白右键取消；端点沿自适应网格；同 lane/inner class 不重叠，不自动合并 | 2026-08-26 由 `project-owner` 批准；更复杂范围语义继续由 PROD-019 跟踪 |

## Gate State

2026-10-04，浏览器自动处理架构和 PROD-024–029 对应结论已获批准，下一阶段为 execution planning；新计划、实现、quality/readiness 尚未批准。既有 Analyzer/Editor/Visualizer canonical 身份保持历史有效；PROD-022 仍为未来复核项，PROD-015 继续阻断正式上线。

## Browser Architecture Approval Record

2026-10-04，project-owner 明确要求实施随附浏览器修订计划并授权登记决定/延后项、批准架构及本地文档提交。上表据此生效，未增加测试结果或未来能力批准。
