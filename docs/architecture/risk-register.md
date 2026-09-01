---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "以 M14 unit/integration、双浏览器与 canonical 验证 R-031–R-033"
---

# Risk Register

评分：Likelihood/Impact 使用 Low、Medium、High。状态使用 Open、Mitigated、Accepted。

| ID | Risk | Likelihood | Impact | Trigger / Signal | Mitigation and required evidence | Residual / fallback | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | 抽离 AudioEngine 导致 MusicBar 播放、切歌或能量响应回归 | Medium | High | 现有任务失败、重复 AudioContext、暂停后仍有能量 | engine/store 与 Chrome MusicBar 回归已在 M4 clean commit canonical pass，并由 owner 批准 | 未自动化的音频设备差异继续由手工 Chrome/Edge 验证 | project-owner | Mitigated |
| R-002 | Worker 迟到结果覆盖新歌曲或新卡片 | Medium | High | 快速换歌/换卡时图表身份不一致 | job generation + track/config/feature 身份；stale/cancel 单元、集成与 M11 双浏览器 canonical 通过 | 即使取消不及时，身份检查仍是正确性边界；身份契约变化时复跑 | project-owner | Mitigated |
| R-003 | 15 分钟频谱造成内存、IPC 或 IndexedDB 膨胀 | High | High | typed array、postMessage、cache 大小持续增长；quota 失败 | 最多 30Hz 聚合、向量量化、只缓存活动特征和当前歌曲、精确值按需提取；M11 canonical 在 Chrome/Edge 重跑 15 分钟四重卡、quota 与 20 次资源循环，M6 cache 仍为 100,941 bytes；2026-08-26 owner 为人工长会话补偿门禁签字 | 缓存失败时不保存，刷新后重算；目标设备外推仍受 EG-005 限制 | project-owner | Mitigated |
| R-004 | 分析或 Canvas 重绘阻塞主线程 | Medium | High | 输入反馈超过 100ms或分析归因长任务超过 50ms | Meyda/聚合/量化放 Worker；静态/游标分层；M11 canonical 的 Chrome/Edge 15 分钟四重卡反馈最大分别为 17.9ms/17.2ms，分析归因长任务均为 0 | 目标设备范围仍受 EG-005 限制；必要时降低显示采样或可视层细节，不降低精确游标值 | project-owner | Mitigated |
| R-005 | File System Access 权限跨会话丢失 | High | Medium | `queryPermission()` 返回 prompt/denied | M5 clean-commit canonical 已验证保存当前 Blob、启动只查询、用户点击后 request 和可见三态；Chrome 原生权限人工检查通过；M11 canonical 的 Edge OPFS/IndexedDB 恢复回归与 2026-08-26 owner 原生权限签字均完成 | 未授权歌曲显示恢复访问，不阻断当前 Blob；权限是否持久仍由浏览器决定，因此风险保持 Accepted | project-owner | Accepted |
| R-006 | 文件移动、替换或内容变化导致错误缓存 | Medium | High | 句柄 `getFile()` 失败或 hash 变化 | M5 canonical 已验证 SHA-256 最终身份、tampered current Blob、missing/changed 和重选 adapter；M6–M11 已验证 cache identity 与刷新恢复；2026-08-26 owner 为 Edge 原生文件移动/重选签字 | track 保留在队列并显示明确恢复状态；浏览器或 identity 契约变化时复跑 | project-owner | Mitigated |
| R-007 | IndexedDB quota 或事务失败破坏当前会话 | Medium | Medium | Blob/cache put 抛 quota/abort | M5/M6 canonical 已验证原子替换、abort、payload/cache quota；M11 修复切歌持久化竞态，并在 Chrome/Edge 验证 quota 后当前播放与 `not-persisted` | 刷新后需重新授权或重新分析；repository/schema 变化时复跑 | project-owner | Mitigated |
| R-008 | MP3/WAV/FLAC 解码或采样率在浏览器间不同 | Medium | High | golden fixture 帧数、sample rate 或结果偏差 | 同源短 fixture 记录 provenance/hash；M11 canonical 已在真实 Chrome/Edge 加载三格式、切换、分析并刷新恢复；AnalysisConfig 记录实际 PCM sample rate | 平台新增或浏览器解码器变化时复跑；格式不支持时明确报错 | project-owner | Mitigated |
| R-009 | 浏览器解码把编码源重采样到输出设备采样率 | Medium | Medium | `AudioBuffer.sampleRate` 与元数据不同 | fixture 验证、缓存身份包含实际 PCM sample rate；M11 Chrome/Edge 三格式分析与恢复通过 | UI 显示传入分析的真实 PCM 采样率；新增平台/格式时复跑 | project-owner | Mitigated |
| R-010 | 量化让显示数据误导学习者 | Medium | High | 热图与精确结果不一致或小信号消失 | 明确 scale/offset、饱和测试、Worker golden；M6 exact cursor、M7–M10 golden/codec 与 M11 双浏览器 canonical 均通过 | 不适合量化的 total 使用 Float32 payload；codec 变化时复跑 golden | project-owner | Mitigated |
| R-011 | 21 项输出形态差异导致错误 renderer 或维度 | Medium | High | 新特征展示空白、数组错位或 runtime cast | 穷尽 FeatureId 注册表、shape 类型、golden 与单卡错误隔离；M10 owner 批准 21/21，M11 Chrome/Edge 全矩阵无回归 | 单卡错误边界不影响其他卡和播放；registry/renderer 变化时复跑 | project-owner | Mitigated |
| R-012 | 游标漂移超过 100ms | Medium | High | 长播放、暂停/seek/切歌后误差增大 | AudioContext 基准时钟；M11 canonical 的 Chrome/Edge 60 秒漂移分别为 3.5ms/4.133ms，seek 最大误差分别为 66.827ms/61.494ms | 暂停时使用快照 offset，页面恢复强制归零；浏览器时钟行为变化时复跑 | project-owner | Mitigated |
| R-013 | 文件/Worker/Audio/Canvas 资源泄漏 | Medium | High | 多次换歌后内存、线程、节点或 URL 增长 | 显式 dispose；LightBg 释放 mesh/geometry/material/renderer/context；M11 canonical 在 Chrome/Edge 各 20 次 Home/Analyzer 循环均为 WebGL 21 created/20 lost、2 live RAF，M6 回归保持单 Worker/AudioContext；2026-08-26 owner 为人工长会话门禁签字 | 浏览器或资源所有权变化时复跑自动化并重复人工长会话观察 | project-owner | Mitigated |
| R-014 | 图表只靠颜色或 Canvas 导致键盘/辅助技术不可用 | Medium | High | 键盘任务失败、无焦点或无数据替代 | DOM 控件/说明/精确值、可见焦点、非颜色图例；M11 canonical 在 Chrome/Edge 验证键盘进度/音量/Analyzer seek、核心控制、reduced motion 和四视口；2026-08-26 owner 为辅助技术补偿门禁签字 | 未执行 axe 扫描的事实继续保留；相关 DOM、Canvas 或焦点契约变化时重新人工复核 | project-owner | Mitigated |
| R-015 | 双浏览器状态被误报 | High | Medium | 只执行 Chromium 或安装检测，没有真实 Edge channel 证据 | M11 runner 固定使用真实 `chrome`/`msedge` channel；clean canonical 的 Edge 全量 M3–M11 为 31/31，并记录产品版本 | 原生权限体验仍由 R-005/EG-006 跟踪；浏览器升级时复跑 | project-owner | Mitigated |
| R-016 | fixture 来源或许可不可追溯 | Medium | Medium | 二进制无来源/hash | 合成 PCM 由脚本生成；格式 fixture 记录生成命令、编码器版本、许可和 SHA-256；M11 canonical fixture hash 5/5 通过 | 无合规 provenance 的 fixture 不入库 | project-owner | Mitigated |
| R-017 | 现有 `test:spectrogram` 指向缺失 `test.ts` | High | Medium | 命令无法运行 | M3 已删除失效命令并建立正式 test/eval scripts；M3–M11 canonical 持续执行公开命令 | package scripts 变化时由 docs/harness 回归检测 | project-owner | Mitigated |
| R-018 | 未定义 Tab 或未来上传需求侵入当前交付 | Medium | Medium | PR 添加未批准 Visualizer/空白页实现、网络数据路径或服务端依赖 | Editor E0 产品意图与 system design 已批准；Visualizer/上传继续由 PROD-013/014 门禁 | Editor 仍不得越过 delivery；其余未定义能力不得进入 | project-owner | Open |
| R-019 | bundle 已有约 1MB 警告继续增长 | Medium | Medium | `npm run build` chunk warning 增大 | Worker/renderer 按路由或 feature family 拆分，记录构建体积；M12 canonical 最大 JS chunk 为 1,284.55 kB；避免 Analyzer Three.js；owner 于 2026-08-28 重新审阅并以 W-001 接受当前候选 warning | 仅当前 Analyzer 候选为 Accepted；托管方案或正式包体预算确定、chunk 再增长或首屏问题复现时重新评审 | project-owner | Accepted |
| R-020 | Meyda 5.6.3 `spectralFlux` 提取器引用未声明变量 `x` | High | High | 固定 previous/current frame 调用抛 `ReferenceError: x is not defined` | ADR-0005 项目 Flux 已实现；公式/首帧/静音/exact cursor golden 与 M8 clean canonical 28/28 通过，保留上游异常事实 | 产品阻断已缓解；Meyda 缺陷未修复，依赖升级时必须重新对照 | project-owner | Mitigated |
| R-021 | Analyzer sticky、播放器层级、pressed 状态或内层滚动条破坏可用性与视觉一致性 | Medium | Medium | sticky 与 Header 间距过大；歌曲列表被遮挡；Windows Chrome 按钮保持按压外观；表格显示系统默认滚动条 | M8 Slice 0、macOS Chrome 多视口 canonical 与 owner Windows Chrome 人工签字均通过 | 相关交互或样式变化后重新执行多视口自动化与 Windows Chrome 补偿复核 | project-owner | Closed |
| R-022 | Editor 循环策略或旧 route cleanup 泄漏到其他页面/歌曲 | Medium | High | 离开后仍 repeat-one、快速换歌被旧 release 改写、出现第二 AudioContext/时钟 | ADR-0006 tokenized playback lease；E1 18/18 canonical 覆盖 acquire/release/ended/invalid target 并获 2026-08-26 owner 签字；E6 仍在 Chrome/Edge 做 20 次资源循环 | lease 失效时强制回到 queue-next；任何双 engine/clock 为阻断，资源实现变化时重开 | project-owner | Mitigated |
| R-023 | 草稿覆盖、损坏导入或错误歌曲身份破坏当前工程 | Medium | High | 异歌静默覆盖、未知 schema 被接受、hash/时长不匹配仍应用、quota 后旧草稿丢失 | ADR-0007 strict codec + content hash + 独立原子 draft；E1 18/18 canonical 与 owner 签字覆盖 round-trip、unknown/invalid/hash/quota/abort/跨歌三选项；E5 35/35 canonical 回归 point/range JSON、draft 和 invalid overlap 原子拒绝 | 失败始终保留内存工程与旧 durable draft；schema/import/draft 变化时重开 | project-owner | Mitigated |
| R-024 | 波形、tempo、事件与 overlay 在 zoom/DPR/resize 下错位 | Medium | High | 同一时间各层 x 差超过 1 CSS px、seek/marker 命中偏移 | ADR-0008/0009/0011 共享 geometry；E3–E5 Chrome 误差 `<=1px`；E6 clean canonical 在 Chrome/Edge 1024/1280/1920 均为 `1px`，并于 2026-08-28 获 owner 签字 | 单层不得私有化 viewport；E7 全屏 Canvas、纵/横滚动后重新执行双浏览器 geometry，不改写 E6 历史状态 | project-owner | Mitigated |
| R-025 | 大量事件 DOM、右键状态或键盘路径造成性能/可访问性回归 | Medium | High | 输入反馈 >100ms、Editor 归因长任务 >50ms、遗留 pressed/capture/menu、键盘无法完成核心任务 | Canvas 背景 + 横向/纵向可见事件 DOM；E6 clean canonical 10,000 事件下 Chrome/Edge 最大反馈 `4.5/4.2ms`、长任务 0、20 次资源循环稳定；辅助技术与长会话于 2026-08-28 获 owner 签字 | E7 紧凑控件仍须维持可见焦点和至少 24px 命中尺寸；回归时重新打开 | project-owner | Mitigated |
| R-026 | BPM 误识别或低置信度被写成用户事实 | Medium | Medium | silence/歧义输入自动填入错误 BPM、用户编辑值被异步结果覆盖 | 同 Worker retained PCM、typed reliable/low-confidence、仅唯一空且未编辑 segment 可写；E2 golden 覆盖 silence、歧义、60/100/128/小数与 stale，22/22 canonical 与 2026-08-27 owner 批准通过 | 低置信度保持空并提示手动输入；算法、阈值或第三方依赖变化时重开 | project-owner | Mitigated |
| R-027 | Analyzer/Editor 争用 active features、Worker retained PCM 或 current cache | Medium | High | Editor 结果显示到 Analyzer、旧 generation 覆盖、返回 Analyzer 卡片丢失、出现第二 Worker | ADR-0006 consumer lease + existing generation/identity；E4 consumer/renderer 回归；E6 clean canonical 双浏览器各 20 次 Editor/Analyzer/Home 循环保持单 Worker/AudioContext并回归 M6–M11；2026-08-28 owner 批准 | 允许返回 Analyzer 后部分重算，不允许错误 identity 或 workspace 改写；runtime ownership 改变时重开 | project-owner | Mitigated |
| R-028 | Analyzer 动态瀑布流产生重叠、视觉/DOM 顺序偏离或 Observer/RAF 泄漏 | Medium | High | 21 卡相交、容器高度不足、展开/收起后焦点或 DOM 顺序偏离、路由循环资源单调增长、`ResizeObserver loop` 警告 | M12 的纯最短列、实测高度、container/item Observer 与单 RAF 继续使用；M13 以 21 feature wrapper、按需 body、四视口和反复生命周期重新验证 | M13 canonical 17/17；Chrome/Edge M12 各 3/3，21 wrapper 四视口无重叠，masonry/card Observer 与 RAF 路由后归零 | project-owner | Mitigated |
| R-029 | 快速展开/收起导致 FIFO、Worker generation、exact request 或持久化状态错序 | Medium | High | 短暂出现第五张展开卡、旧结果回填已收起卡、刷新恢复旧队列、旧 save 把新状态标为 ready | 纯原子 reducer；Coordinator cancel/generation/identity；exact 清理；不可变 snapshot、串行 save 与 revision guard；unit/integration/双浏览器快速序列 | M13 unit 16/16、integration 12/12；双浏览器快速十连切换、刷新前后单 Worker/精确值和 FIFO 年龄恢复通过 | project-owner | Mitigated |
| R-030 | 21 张稳定卡增加 DOM、布局、Canvas 与 Observer 资源压力 | Medium | High | 首屏过慢、收起卡仍有 Canvas/Observer、Canvas 超过活动 renderer 上限、反复展开或路由后计数增长 | 折叠态只保留语义 DOM；展开才挂载 body/Canvas/内部 Observer；最多四项；资源计数、输入反馈、长任务和 20 次生命周期回归 | M13 双浏览器默认 0 Canvas、活动上限 4/八 Canvas；15 分钟最大反馈 17.5ms、归因长任务 0，资源回归无单调增长 | project-owner | Mitigated |
| R-031 | 自定义顺序与 DOM/masonry/focus/Canvas 身份错位 | Medium | High | order index、DOM 和视觉输入不同；排序关闭 details、丢焦点或重建 Canvas | 完整 permutation、feature keyed wrapper、drop 时一次提交、无位移动画；检查 DOMRect/焦点/details/Canvas identity | M14 unit + Chrome/Edge 四视口、展开卡排序与刷新恢复 | project-owner | Open |
| R-032 | Pointer capture、auto-scroll、popup 或 drag RAF 未清理 | Medium | High | 取消后仍滚动、遗留 capture/ghost/marker、路由循环 RAF 增长、touch 无法恢复滚动 | 单 pointer state、单 drag RAF；pointercancel/lostcapture/Escape/blur/unmount 对称 cleanup；touch-action 只作用句柄 | M14 cancel matrix、20 次排序/resize/route lifecycle 与 console probe | project-owner | Open |
| R-033 | featureOrder 损坏或与 queue/viewport 保存交错覆盖最新状态 | Medium | High | 非完整/重复 order 被恢复；旧 save 覆盖新顺序或 FIFO；刷新顺序倒退 | V1 可选字段严格 permutation；缺失只映射默认；全 workspace immutable snapshot、串行写入和 revision guard | validator/repository/service integration、quota/abort 与双浏览器 reload | project-owner | Open |

## Review Rule

- 每个 delivery 里程碑至少检查与其相关的风险、触发器和验证证据。
- 风险只有在缓解措施有可复现证据时才能标记 Mitigated。
- `Accepted` 表示已知平台事实被接受，不表示无需实现降级路径。
- 新的高影响风险或剩余风险超过已批准范围时，停止进入下一里程碑并由 `project-owner` 决策。
- Analyzer R-001–R-021 的历史状态继续由 M3–M11 evidence 支持；R-028–R-030 已由 M13 clean canonical 缓解。M14 重开 R-028 的顺序子集并新增 R-031–R-033；Editor R-022–R-027 与 E7 不被 M14 重开。
