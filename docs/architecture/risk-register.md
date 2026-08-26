---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "以 Analyzer-only 豁免边界进入 Editor E0 产品意图评审"
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
| R-018 | 未定义 Tab 或未来上传需求侵入当前交付 | Medium | Medium | PR 添加空白页实现、网络数据路径或服务端依赖 | scope review、Feature/ADR 门禁；Editor E0 产品草案保持 `in-review` 且禁止越级实现，Visualizer/上传继续为开放问题 | Editor 产品意图获批后必须建立独立 system design 并复核其下游；其余未定义能力仍不得进入 | project-owner | Open |
| R-019 | bundle 已有约 1MB 警告继续增长 | Medium | Medium | `npm run build` chunk warning 增大 | Worker/renderer 按路由或 feature family 拆分，记录构建体积；M11 canonical 最大 JS chunk 为 1,117.94 kB；避免 Analyzer Three.js；owner 于 2026-08-26 以 W-001 接受当前候选 warning | 仅当前 Analyzer 候选为 Accepted；托管方案或正式包体预算确定、chunk 增长或首屏问题复现时重新评审 | project-owner | Accepted |
| R-020 | Meyda 5.6.3 `spectralFlux` 提取器引用未声明变量 `x` | High | High | 固定 previous/current frame 调用抛 `ReferenceError: x is not defined` | ADR-0005 项目 Flux 已实现；公式/首帧/静音/exact cursor golden 与 M8 clean canonical 28/28 通过，保留上游异常事实 | 产品阻断已缓解；Meyda 缺陷未修复，依赖升级时必须重新对照 | project-owner | Mitigated |
| R-021 | Analyzer sticky、播放器层级、pressed 状态或内层滚动条破坏可用性与视觉一致性 | Medium | Medium | sticky 与 Header 间距过大；歌曲列表被遮挡；Windows Chrome 按钮保持按压外观；表格显示系统默认滚动条 | M8 Slice 0、macOS Chrome 多视口 canonical 与 owner Windows Chrome 人工签字均通过 | 相关交互或样式变化后重新执行多视口自动化与 Windows Chrome 补偿复核 | project-owner | Closed |

## Review Rule

- 每个 delivery 里程碑至少检查与其相关的风险、触发器和验证证据。
- 风险只有在缓解措施有可复现证据时才能标记 Mitigated。
- `Accepted` 表示已知平台事实被接受，不表示无需实现降级路径。
- 新的高影响风险或剩余风险超过已批准范围时，停止进入下一里程碑并由 `project-owner` 决策。
