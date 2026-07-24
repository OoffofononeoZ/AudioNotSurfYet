---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/product/problem-brief.md"
next_action: "以批准范围为边界创建并评审 system design、接口契约、风险和 ADR"
---

# Scope

## In Scope

### Product capability

- 以纵向切片最终覆盖 `src/data/analyzerData.ts` 中定义的全部 21 个 Meyda 特征。
- 首个可交付切片包含 RMS、Amplitude Spectrum、Chroma。
- Analyzer 同时显示 0–4 张卡片；卡片可替换，活动特征不得重复。
- 所有卡片共享时间视窗、缩放状态和播放游标；点击图表可跳转到对应播放时间。
- Canvas 负责数据图表，DOM 负责说明、固定参数、精确值、焦点与无障碍语义。
- RMS 采用时间序列折线；Amplitude Spectrum 采用时频热图和游标频谱；Chroma 采用 12 类热图和游标柱图。
- 播放、队列、当前歌曲、跳转和刷新恢复作为分析工作区的基础能力。

### Audio and analysis

- 支持用户本地选择 MP3、WAV、FLAC；单首目标时长不超过约 15 分钟。
- 立体声或多声道输入按声道平均混合为 mono PCM 后进入离线分析。
- 全曲预计算在 Worker 中执行；仅计算当前最多四个活动特征。
- 播放时共享游标由 AudioContext 时钟驱动，不依赖动画帧累计时间。
- 首版分析参数固定但对用户可见：frame/buffer 1024、hop 512、Hanning window、MFCC 13、源文件采样率。
- 高频帧在 Worker 内聚合为最多 30Hz 的显示数据；向量数据可紧凑量化，游标处精确值按需提取。

### Session recovery

- 通过 `showOpenFilePicker()` 选择文件并把队列中的文件句柄保存在 IndexedDB。
- 只持久化最近一次会话，并且只保存当前歌曲 Blob 与当前歌曲分析缓存；切歌时替换旧 Blob/缓存。
- 刷新后恢复队列、当前歌曲、卡片和分析配置；播放时间归零并保持暂停。
- 其他歌曲按“下一首、上一首、下二首、上二首……”顺序查询权限；已授权文件自动恢复，未授权文件显示恢复状态并等待用户触发。
- 权限拒绝、文件移动、容量不足或缓存保存失败不得破坏当前页面内的播放；界面必须说明不能跨刷新恢复或需要重新计算。

### Support and accessibility

- 首发支持最新稳定版 Chrome 和 Edge 桌面端。
- 验证视口为 1024、1280、1920 CSS px。
- 播放、切歌、跳转、选卡和换卡可用键盘完成；焦点可见，数据不只依靠颜色表达，并尊重 reduced motion。
- 静态 SPA 运行于 HTTPS 或 localhost。

## Delivery Slices

1. 产品意图和系统设计获批。
2. 建立测试与合成音频 fixture。
3. 抽离共享音频引擎与会话状态并保持现有 MusicBar 行为。
4. 建立持久化、Worker、特征注册表和共享时间轴。
5. 交付 RMS、Amplitude Spectrum、Chroma。
6. 扩展剩余标量、向量/波形和结构化特征，直至 21 项覆盖。
7. 完成格式、恢复、权限、性能、无障碍和多视口硬化。

每一切片必须通过其验收门禁后才能进入下一批特征；不使用未经估算的日历日期代替证据。

## Out of Scope

- 麦克风或实时输入。
- 远端 URL、云端音频、账户、上传、同步或服务端分析。
- 长期本地曲库、多会话历史或跨设备恢复。
- 可编辑的分析参数；首版只展示固定参数。
- 音频编辑、导出、分享、协作或插件系统。
- Editor、Visualizer 及其他尚未定义的空白 Tab。
- 移动端、非 Chromium 浏览器和非 Chromium 兼容层。
- Analyzer 中新增 Three.js 依赖。
- 在 release 阶段前决定正式托管商、生产 URL、发布监控或回滚方案。

## Assumptions and Dependencies

- `project-owner` 是产品、技术和阶段批准人。
- 当前本地处理边界只约束已批准范围；未来上传能力必须另开产品决策。
- 浏览器可以在安全上下文中使用 File System Access API；文件句柄可序列化到 IndexedDB，但授权是否跨会话持续不能假定。
- 需要保留 `queryPermission()` 和由用户手势触发的 `requestPermission()` 恢复路径。
- 当前歌曲分析缓存若因大小或 quota 无法保存，刷新后允许重新计算，不要求降级成长期数据库。
- 21 项特征的具体分组由交付计划管理，但不能改变“最终全部覆盖”和“首批三项”的批准范围。

## Approval Notes

- Decision-maker：`project-owner`
- Approved on：2026-07-24
- Approval evidence：用户明确要求实现随请求给出的完整计划。
- Change rule：目标用户、21 项覆盖、首批特征、浏览器/格式矩阵、本地数据边界或四卡共享时间轴发生实质变化时，本文件必须重新评审，并将 architecture、delivery、quality、release 标记为待复核。

File System Access 行为依据：[Chrome File System Access 文档](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access) 与 [持久权限说明](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)。
