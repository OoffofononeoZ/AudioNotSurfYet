---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "在每个 delivery 里程碑评审风险触发器、缓解证据和残余风险"
---

# Risk Register

评分：Likelihood/Impact 使用 Low、Medium、High。状态使用 Open、Mitigated、Accepted。

| ID | Risk | Likelihood | Impact | Trigger / Signal | Mitigation and required evidence | Residual / fallback | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R-001 | 抽离 AudioEngine 导致 MusicBar 播放、切歌或能量响应回归 | Medium | High | 现有任务失败、重复 AudioContext、暂停后仍有能量 | 已建立 engine/store 测试和 Chrome MusicBar 回归；M4 provisional 通过，仍待 canonical/owner review | 未自动化的音频设备差异由手工 Chrome/Edge 验证 | project-owner | Open |
| R-002 | Worker 迟到结果覆盖新歌曲或新卡片 | Medium | High | 快速换歌/换卡时图表身份不一致 | job generation + track/config/feature 身份；stale 丢弃单元/集成测试 | 即使取消不及时，身份检查仍是正确性边界 | project-owner | Open |
| R-003 | 15 分钟频谱造成内存、IPC 或 IndexedDB 膨胀 | High | High | typed array、postMessage、cache 大小持续增长；quota 失败 | 最多 30Hz 聚合、向量量化、只缓存活动特征和当前歌曲、精确值按需提取；最大输入 profile | 缓存失败时不保存，刷新后重算 | project-owner | Open |
| R-004 | 分析或 Canvas 重绘阻塞主线程 | Medium | High | 输入反馈超过 100ms或分析归因长任务超过 50ms | Meyda/聚合/量化放 Worker；静态/游标分层；PerformanceObserver 与 trace | 降低显示采样或可视层细节，不降低精确游标值 | project-owner | Open |
| R-005 | File System Access 权限跨会话丢失 | High | Medium | `queryPermission()` 返回 prompt/denied | 保存当前 Blob；启动只查询权限；用户点击后 request；覆盖三态浏览器测试 | 未授权歌曲显示恢复访问，不阻断当前 Blob | project-owner | Accepted |
| R-006 | 文件移动、替换或内容变化导致错误缓存 | Medium | High | 句柄 `getFile()` 失败或 hash 变化 | 内容 hash 作为缓存身份；变化时失效并重新分析 | track 保留在队列并显示明确恢复状态 | project-owner | Open |
| R-007 | IndexedDB quota 或事务失败破坏当前会话 | Medium | Medium | Blob/cache put 抛 quota/abort | current Blob/cache 原子替换；失败保留内存会话并显示 not-persisted；故障注入测试 | 刷新后需重新授权或重新分析 | project-owner | Open |
| R-008 | MP3/WAV/FLAC 解码或采样率在浏览器间不同 | Medium | High | golden fixture 帧数、sample rate 或结果偏差 | 同源短 fixture 记录 provenance/hash；Chrome/Edge 实测；AnalysisConfig 记录实际 PCM sample rate | 格式不支持时明确报错；不声明未验证浏览器完成 | project-owner | Open |
| R-009 | 浏览器解码把编码源重采样到输出设备采样率 | Medium | Medium | `AudioBuffer.sampleRate` 与元数据不同 | fixture 验证；必要时用指定采样率 OfflineAudioContext 生成分析 PCM；缓存身份包含实际采样率 | UI 显示传入分析的真实 PCM 采样率 | project-owner | Open |
| R-010 | 量化让显示数据误导学习者 | Medium | High | 热图与精确结果不一致或小信号消失 | 明确 scale/offset、饱和测试、视觉 golden；游标显示未量化按需结果 | 对不适合量化的 feature 使用 Float32 payload | project-owner | Open |
| R-011 | 21 项输出形态差异导致错误 renderer 或维度 | Medium | High | 新特征展示空白、数组错位或 runtime cast | 穷尽 FeatureId 注册表、shape 类型、Meyda 黄金测试和 renderer 契约测试 | 单卡错误边界，不影响其他卡和播放 | project-owner | Open |
| R-012 | 游标漂移超过 100ms | Medium | High | 长播放、暂停/seek/切歌后误差增大 | AudioContext 基准时钟；provisional 60 秒漂移约 13.3ms，三次 seek 均 <100ms；待 canonical | 暂停时使用快照 offset，页面恢复强制归零 | project-owner | Open |
| R-013 | 文件/Worker/Audio/Canvas 资源泄漏 | Medium | High | 多次换歌后内存、线程、节点或 URL 增长 | M4 已显式 dispose；单元和 Chrome 20 次切歌检查单 context/RAF/URL，provisional 通过 | canonical 后仍在 readiness 前保留人工 DevTools heap/线程检查 | project-owner | Open |
| R-014 | 图表只靠颜色或 Canvas 导致键盘/辅助技术不可用 | Medium | High | 键盘任务失败、无焦点或无数据替代 | DOM 控件/说明/精确值，焦点样式、非颜色图例、reduced motion；axe + 手工任务 | 完整屏幕阅读器矩阵若未完成需公开残余风险 | project-owner | Open |
| R-015 | 当前机器缺少 Edge，双浏览器状态被误报 | High | Medium | 只有 Chrome 自动化证据 | readiness 明确列证据浏览器；安装/提供 Edge 后执行同一 E2E | Edge 未验证时不能关闭最终兼容门禁 | project-owner | Open |
| R-016 | fixture 来源或许可不可追溯 | Medium | Medium | 二进制无来源/hash | 合成 PCM 由脚本生成；格式 fixture 记录生成命令、编码器版本、许可和 SHA-256 | 无合规 provenance 的 fixture 不入库 | project-owner | Open |
| R-017 | 现有 `test:spectrogram` 指向缺失 `test.ts` | High | Medium | 命令无法运行 | 测试基线里程碑修复或重定向脚本，并在 CI/本地运行 | 修复前不能把该命令作为质量证据 | project-owner | Open |
| R-018 | 未定义 Tab 或未来上传需求侵入当前交付 | Medium | Medium | PR 添加空白页实现、网络数据路径或服务端依赖 | scope review、Feature/ADR 门禁；未来能力另开产品决策 | 产品意图变化会使所有下游待复核 | project-owner | Open |
| R-019 | bundle 已有约 1MB 警告继续增长 | Medium | Medium | `npm run build` chunk warning 增大 | Worker/renderer 按路由或 feature family 拆分，记录构建体积；避免 Analyzer Three.js | 具体发布预算在 quality/release 前批准 | project-owner | Open |

## Review Rule

- 每个 delivery 里程碑至少检查与其相关的风险、触发器和验证证据。
- 风险只有在缓解措施有可复现证据时才能标记 Mitigated。
- `Accepted` 表示已知平台事实被接受，不表示无需实现降级路径。
- 新的高影响风险或剩余风险超过已批准范围时，停止进入下一里程碑并由 `project-owner` 决策。
