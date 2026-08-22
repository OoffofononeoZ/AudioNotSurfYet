---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-23
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "M10 provisional 36/36 已通过；提交实现并运行 clean canonical"
---

# Execution Plan

## 1. Delivery Outcome

按纵向切片把已批准的本地音频学习体验从当前播放器基础推进到 21 项 Meyda 特征全覆盖。本计划以门禁证据而不是日历日期排序；任一里程碑未通过时，不进入下一批特征。

本文件定义实施顺序和验收方式，不代表未关闭里程碑已通过。当前已完成 M1、M2、Q0、M3–M9 门禁；`project-owner` 已于 2026-08-23 批准 M9 canonical 与非首页导航栏模糊效果，并明确要求实施 M10。M9 为 `Complete`，M10 为 `In Progress`。

## 2. Stage Gates

```mermaid
flowchart LR
    M1["M1 Product intent"] --> M2["M2 System design"]
    M2 --> Q0["Q0 Quality design"]
    Q0 --> M3["M3 Test foundation"]
    M3 --> M4["M4 AudioEngine"]
    M4 --> M5["M5 Session recovery"]
    M5 --> M6["M6 Analysis platform"]
    M6 --> M7["M7 First 3 features"]
    M7 --> M8["M8 Remaining scalars"]
    M8 --> M9["M9 Vectors / waveform"]
    M9 --> M10["M10 Structured features"]
    M10 --> M11["M11 Hardening"]
```

每个门禁都要求：

- 对应代码、文档和测试 diff 可审阅；
- [acceptance criteria](acceptance-criteria.md) 中适用项有证据；
- [test strategy](test-strategy.md) 指定的自动化和手工路径已执行；
- [eval plan](../quality/eval-plan.md) 指定的评估与 [failure taxonomy](../quality/failure-taxonomy.md) 分类已用于记录证据；
- [risk register](../architecture/risk-register.md) 相关风险已复核；
- `npm run build`、相关测试、Markdown frontmatter/链接检查和 `git diff --check` 通过；
- 已知缺口、残余风险和未验证浏览器明确记录。

## 3. Work Slices

### M1 — Product intent approved

Status：Complete.

Deliverables:

- `docs/product/problem-brief.md`
- `docs/product/scope.md`
- `docs/product/success-metrics.md`
- `docs/product/open-questions.md`

Gate:

- problem brief 和 scope 为 `approved`；
- owner 为 `project-owner`；
- 没有阻断 system design 的开放问题。

### M2 — System design approved

Status：Complete.

Deliverables:

- `docs/architecture/system-design.md`
- `docs/architecture/interface-contracts.md`
- `docs/architecture/risk-register.md`
- ADR-0001 至 ADR-0004

Gate:

- `system-design.md` 为 `approved`；
- 单一 AudioEngine、Worker 隔离、混合恢复和 renderer family 已有明确 ADR；
- 失败边界、缓存身份、权限语义和资源所有权可测试。

### Q0 — Quality evaluation design

Status：Complete.

Goal：在建立测试工具前锁定评估分组、黄金样例、失败分类和证据缺口，避免 M3–M11 生成不可追溯或只覆盖成功路径的证据。

Deliverables:

- `docs/quality/eval-plan.md`
- `docs/quality/golden-examples.md`
- `docs/quality/failure-taxonomy.md`

Gate:

- 三份文档 owner 均为 `project-owner`，并由其明确批准；
- 七组 eval 覆盖 success、failure、boundary 和 exception；
- 42 个 acceptance criteria 均映射到 eval；
- 19 个 architecture risk 均映射到 eval 或显式 evidence gap；
- 所有尚未执行的项目保持 `planned`，不伪造 fixture、浏览器或测试结果；
- `release-readiness.md` 不在 Q0 创建，必须等待 M11 执行证据。

Q0 已由 `project-owner` 于 2026-07-28 批准。该批准只表示证据设计可用于实施，不表示任何产品行为已经通过。

### M3 — Test foundation and fixtures

Status：Complete.

Goal：在重构播放和分析前建立可重复的质量基线。

Implementation:

- 引入 Vitest，并分别建立纯函数、store、Worker 和浏览器 API adapter 测试环境。
- 引入 Playwright，以本机稳定 Chrome channel 为必需自动化浏览器；检测本机 Edge channel，有安装时运行 Edge 项目，缺失时明确 blocked。
- 为 IndexedDB 测试使用隔离数据库与可控 adapter；单元层可使用 `fake-indexeddb`，浏览器层使用真实 IndexedDB。
- 生成 silence、正弦、双音、impulse PCM fixture；所有生成参数由脚本固定。
- 由同一源 PCM 生成短 MP3/WAV/FLAC，并记录来源、生成命令、编码器版本、许可和 SHA-256。
- 建立直接 Meyda 黄金提取器和浮点比较 helper。
- 删除当前指向缺失 `test.ts` 的 `npm run test:spectrogram`，不保留兼容别名，并使所有公开测试脚本可执行。
- 增加 Markdown frontmatter、内部链接和 feature count 检查。

Verification:

- 新 clone/干净安装可执行测试命令；
- fixture 可确定性重建，manifest hash 一致；
- deliberate failure 能让测试退出非零；
- 现有播放 smoke test 被记录为后续 M4 回归基线。

Rollback:

- 测试工具若与 Vite/Vue 版本不兼容，先回退工具配置，不修改产品代码规避测试。

Evidence state:

- 2026-07-28 provisional run 已通过 fixture、unit、Worker、analysis、docs、deliberate failure、typecheck、Chrome E2E、build 和 diff check；
- `npm run eval:m3` 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过，正式摘要见 [evidence index](../quality/evidence-index.md)；
- `project-owner` 已于 2026-07-28 批准 evidence index 和 working agreements；M3 已关闭。

### M4 — AudioEngine and audioSessionStore

Status：Complete。

Goal：建立单一播放引擎，同时保持现有 MusicBar 行为。

Implementation:

- 已删除 `audioLoader.ts` 旧路径，将播放资源收敛到 `AudioEngine`。
- 已建立 `PlaybackSnapshot`、`audioSessionStore` 与 MainLayout-owned `AudioSessionService`；store 不持有 File/Blob/ArrayBuffer/AudioBuffer/AudioNode。
- 已实现 load/play/pause/seek/volume/ended/unload/dispose、typed error 和 generation 隔离。
- MusicBar 已迁移到共享快照和服务命令；单一 service RAF 同时更新时间与 Meyda energy。
- 已实现快速换歌最后操作生效、非空追加不中断、metadata fallback、非阻塞错误和对象 URL 释放。

Verification:

- 引擎/store 单元与集成测试；
- 现有队列、播放、暂停、上下首、seek、音量和 MusicBar 能量回归；
- 一次会话仅一个实时 AudioContext；
- 资源生命周期测试无遗留 source、RAF 或对象 URL。

Evidence state:

- 2026-07-28 `eval:m4:provisional` 通过 13 个步骤；M3 回归、M4 engine/session、Chrome 播放回归、typecheck、build、docs 和 diff check 均为 pass；
- 60 秒 AudioContext 时钟漂移约 13.3ms；三次 seek 误差约 66.8ms、1.1ms、66.8ms；
- 该 run 的 dirty-at-start 为 true，只是 provisional，不登记到正式 evidence index；
- 2026-07-29 `npm run eval:m4` 在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过 13/13 步骤，60 秒时钟漂移 2.233ms，三次 seek 最大误差 66.827ms；
- 正式 run 已登记到 [evidence index](../quality/evidence-index.md)，并由 `project-owner` 于 2026-07-29 批准；M4 已关闭。

Rollback:

- M4 必须作为可独立审阅切片；失败时回退引擎接线，不保留新旧两套长期运行路径。

### M5 — IndexedDB session recovery

Status：Complete。

Goal：实现最近一次会话和权限可见的混合恢复。

Implementation:

- 已建立原生 IndexedDB V1 `SessionRepository`、四个 object store 和 `PersistedSessionV1` runtime validation。
- 已接入 `showOpenFilePicker()`，保存队列全部 handle；取消静默结束，API 缺失不回退隐藏 input。
- 只保存当前 Blob 和当前分析 cache envelope；分析 payload 接入留到 M6/M7。
- 已实现 current Blob/cache 同事务原子替换、清除会话和 quota/abort failure。
- 已恢复队列和当前歌曲；current Blob 优先，时间归零 paused。
- 已按相邻距离查询其他歌曲权限，只有用户操作触发 `requestPermission()`。
- 已为 granted/prompt/denied/missing/changed/not-persisted/decode-error 建立 UI 状态与恢复操作。

Verification:

- 完整恢复、只保存当前数据、切歌替换、schema version、quota 和事务失败测试；
- 当前 Blob 可在句柄无权限时恢复；
- 其他 track 不自动触发权限提示；
- 权限/文件错误不破坏当前页面播放。

Evidence state:

- 2026-07-29 `eval:m5:provisional` 在 dirty worktree 通过 16/16 步骤；M3/M4 回归、M5 repository/recovery、Chrome IndexedDB/OPFS、typecheck、build、docs 和 diff check 均为 pass；
- M4 60 秒时钟回归在本次运行中漂移 5ms，三次 seek 最大误差 66.827ms；
- run ID 为 `M5-2026-07-29T07-03-16-207Z-2eb98381-provisional`，summary SHA-256 为 `7b0acaf128ac4a7ceffce1449d2421127d20c8b25dcdc1ebd07b889072228530`；
- 该 run 的 dirty-at-start 为 true，只作实现反馈，不追加正式 evidence index；
- `eval:m5` 已在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上通过 16/16；run ID 为 `M5-2026-07-29T07-08-25-199Z-c90a3c57`，summary SHA-256 为 `6257426baa601289d89c10e97d76d866a637227fd042080deb947af17c982d2a`；
- canonical 的 M4 回归记录 60 秒时钟漂移 4ms，三次 seek 最大误差 66.827ms；
- 正式记录已追加到 [evidence index](../quality/evidence-index.md)；
- `project-owner` 已完成 Chrome 原生 OS picker 的 granted/prompt/denied、恢复访问和文件移动人工检查并确认通过；
- `project-owner` 于 2026-07-29 批准 M5 evidence 与 working agreements，M5 已关闭并开放 M6；
- 超出约 15 分钟支持边界的长音频未开始播放只作为非门禁压力观察，不表示产品规定该输入必须失败，也不扩大支持范围。

Rollback:

- 数据库失败时回到内存会话并显示不能跨刷新保存；不得增加未批准的 localStorage/全部 Blob fallback。

### M6 — Worker analysis platform and feature registry

Status：Complete。

Goal：完成可扩展且不阻塞主线程的分析基础设施。

Implementation:

- 已建立 21 项穷尽 `FeatureRegistry`、六类 output shape/payload、renderer、实际维度、delivery milestone 和 Worker support 类型。
- 已实现 AudioEngine revision descriptor、16,384-sample 分块平均 mono、frame/尾帧、固定 `AnalysisConfig` 和 SHA-256 canonical hash。
- 已实现 AnalysisCoordinator、Vite module Worker、progress、32-frame/8ms yield、cooperative cancel、generation/身份隔离和 latest cursor request。
- 已实现 ≤30Hz 聚合、六类 compact codec、U16 实际范围量化、未量化精确游标和损坏 payload 拒绝。
- 已实现 `trackHash + configHash + featureId` 部分 cache hit、原子 `replaceCurrentAnalysisCache()`、quota/abort/stale 语义。
- MainLayout 显式创建同一个 engine/repository/session/coordinator，默认 `setActiveFeatures([])`；仅 DEV 暴露无 UI 测试 bridge，生产构建无该 bridge。
- Meyda 5.6.3 `spectralFlux` 的 `ReferenceError` 已登记为 R-020；M6 不 patch 或启用。

Verification:

- mono、frame、registry、hash、聚合、量化、取消和 stale-result 测试；
- 21/21 key coverage；
- 四个不重复 feature 限制；
- 最大支持输入期间输入反馈和长任务 guardrail；
- Worker 失败不停止播放。
- 独立命令为 `test:m6:unit`、`test:m6:worker`、`test:m6:integration`、`test:e2e:m6`、`eval:m6:provisional` 和 clean-HEAD `eval:m6`。
- Chrome E2E 使用短 fixture 验证真实 Worker/cursor/cache/刷新命中、20 次资源循环，并在 OPFS 分块生成 48kHz 单声道 15 分钟 WAV；最大样本在加载完成后开始 Long Tasks 观察，完成交互/进度测量后主动取消。

Evidence state:

- M6 unit/Worker/golden/coordinator/cache、M3–M5 回归、typecheck、build 和 Chrome E2E 已由 dirty-worktree `eval:m6:provisional` 在 2026-07-29 完整运行。
- 最终 provisional run `M6-2026-07-29T10-59-23-767Z-b7fa91ed-provisional` 20/20 通过，summary SHA-256 为 `6fd67f9a8b0184a2861a7182a1276572375e947880cf3688afe7511ca97ed3fa`；15 分钟输入最大反馈 16.7ms、分析归因 >50ms 长任务 0 个，20 次资源循环保持单 Worker/AudioContext，刷新 cache hit 后 exact cursor 仍可用。
- 该 provisional run 起止均为 dirty worktree，只作实现反馈。
- clean-commit canonical run `M6-2026-07-30T02-19-07-149Z-a39256ff` 已在 commit `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` 上 20/20 通过，起止身份一致且工作树干净；summary SHA-256 为 `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae`。
- canonical 记录包括 M6 unit 18/18、Worker/golden 13/13、coordinator 6/6、Chrome 3/3；四项 cache payload 为 100,941 bytes，刷新 hit 后 exact cursor 一致，20 次循环保持单 Worker/AudioContext，15 分钟输入最大反馈 17ms、分析归因 >50ms 长任务 0 个。
- 正式记录已追加到 [evidence index](../quality/evidence-index.md)；Edge 矩阵缺失、约 1.08MB chunk warning 和 R-020 `spectralFlux` 缺陷仍保留。
- `project-owner` 于 2026-07-30 批准 M6 canonical evidence、working agreements、system map 与 glossary；M6 据此改为 `Complete`，M7 门禁开放但仍保持 `Planned`。

Rollback:

- 某种紧凑编码不满足精度时只回退该 shape 为 Float32，不把计算搬回主线程。

### M7 — RMS, Amplitude Spectrum, Chroma vertical slice

Status：Complete。

Goal：交付第一条完整学习体验。

Implementation:

- 固定四个 UI 槽位；M7 只允许 `rms`、`amplitudeSpectrum`、`chroma`，最多三张唯一活动卡，第四空槽说明 M8 后续范围。
- 无保存工作区时默认三卡；已保存空工作区恢复为空，不再次自动填充。
- 建立共享 `TimelineViewport`、缩放、AudioContext 游标和图表点击 seek。
- RMS：时间序列折线和精确标量。
- Amplitude Spectrum：时频热图和游标频谱。
- Chroma：12 类热图和游标柱图。
- DOM 显示解释、固定参数、精确值、图例、状态和键盘控件。
- 保存/恢复卡片、viewport、当前三项 cache。

Verification:

- 首批三项黄金结果；
- 0–3 张唯一活动卡、四槽基础设施、选择/替换、共享 zoom/cursor 和 click-to-seek E2E；四个唯一活动特征的完整场景从 M8 首个新增特征开始执行；
- 游标偏差不超过 100ms；
- owner 完成全部任务脚本并正确解释 3/3 黄金片段；
- 1024/1280/1920 几何、Canvas 和控制台检查。

Evidence state:

- 2026-07-30 dirty-worktree provisional run `M7-2026-07-30T03-13-53-844Z-5b33575f-provisional` 24/24 通过，summary SHA-256 为 `5f49ad1d18c1c5f8096beef53a6122f242bae361b76dcbe2f9d718698e663504`；它只作实现反馈，不登记正式 evidence index。
- M7 Chrome 为 4/4：默认三卡/四槽、已保存空/单卡恢复、共享 zoom/cursor/点击与键盘 seek、DPR/reduced-motion/三视口、30Hz exact cursor 合并和单卡 renderer 隔离均通过；seek 可见反馈为 2.7ms。
- 确定性 15 分钟 M7 场景反馈为 10ms、16.7ms、16.7ms，20 个进度样本单调，分析归因超过 50ms 的主线程长任务为 0；同一 run 中 M6 Chrome 回归 3/3。
- production build 通过但约 1.10MB chunk warning 继续保留；Edge 未安装和 R-020 `spectralFlux` 缺陷均未解决。
- 首次 clean run `M7-2026-07-30T03-21-14-150Z-28fc4699` 因固定 550ms 跨进程计时误判 exact-cursor 上限而失败；失败 artifact 保留，不作为通过证据。
- 修复后的 canonical `M7-2026-07-30T03-30-43-095Z-f022b86e` 在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过，summary SHA-256 为 `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32`，正式 evidence 为 `in-review`。
- canonical M7 Chrome 4/4；页面内 624.4ms 窗口三项 exact-cursor 各 16 次、上限 20，seek 反馈 1.7ms。15 分钟最大反馈 16.8ms，20 个进度样本单调，分析归因 >50ms 长任务 0 个；M3–M6 回归均通过。
- owner 于 2026-08-21 完成操作与 3/3 学习解释并批准 canonical evidence；M7 据此关闭并开放 M8。

Rollback:

- 单卡 renderer 出错时隔离该卡；播放和其他卡继续。M7 未通过不得进入 M8。

### M8 — Remaining scalar features

Status：In Progress。

Features:

- ZCR、Energy；
- Spectral Centroid、Flatness、Flux、Slope、Rolloff、Spread、Skewness、Kurtosis、Crest；
- Perceptual Spread、Perceptual Sharpness。

Implementation:

- Slice 0 统一 Header/sticky/MusicBar 层级、瞬时 pressed/focus 状态和精确值表格滚动条；Windows Chrome pressed 恢复保留人工复核。
- 复用 scalar series/renderer，补充每项范围、单位、依赖和解释。
- `spectralFlux` 按 ADR-0005 使用相邻幅度频谱的正向 L1 差；第一帧和零能量帧为 0，不 patch Meyda。
- 所有 M8 标量在零能量帧为 0；非零能量帧的 NaN/Infinity 显式失败。
- 对无固定上界、可负值或依赖前一帧的特征建立专门边界处理；四槽允许从累计 16 项中选择最多四项。

Verification:

- 12 项直接 Meyda 黄金、项目 Flux golden、registry/renderer 契约和解释性 `m8-scalars-v1` fixture；
- 第一个 frame、silence、负值、NaN/Infinity 防护；
- 390/1024/1280/1920 的 sticky/层级/按钮/滚动条与四卡交互；
- 完成后累计覆盖 16/21。

Execution evidence：Slice 0、13 个新增标量、`m8-scalars-v1`、通用 scalar renderer、四卡选择与累计 16/21 已实现；dirty-worktree provisional 与 clean-HEAD canonical 均 28/28 通过。canonical run `M8-2026-08-21T03-23-18-552Z-d6dcf715` 绑定 commit `d6dcf715be2e6675224f079b954e2b1b544bbebd`，summary SHA-256 为 `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef`。Windows Chrome 补偿复核与 evidence 已由 owner 批准，M8 为 `Complete`。

Rollback:

- 单项失败保持 feature flag/registry 不可选，不阻塞已批准功能；未通过项不能计入覆盖。

### M9 — Power Spectrum, MFCC, Buffer

Implementation:

- Slice 0 保持首页 Header 透明，所有非首页路由使用 18px backdrop blur 与半透明深色背景；保留现有 Header/MusicBar 层级。
- Power Spectrum 复用 frequency heatmap 并验证与 amplitude² 的关系。
- MFCC 使用 13 系数热图/游标向量，参数保持可见。
- Buffer 使用波形 envelope 和游标 frame，不保存逐帧原始 buffer 集合。

Verification:

- 维度、频率/系数轴、量化和 cursor exact-value 测试；
- 波形正负峰、尾帧和多视口 Canvas 测试；
- 完成后累计覆盖 19/21。

Execution evidence：Header route style、累计 19 项 feature set、Power Spectrum/MFCC/Buffer Worker 与双 Canvas renderer、DOM 精确值、`m9-vectors.v1.json`、专项 Vitest/Chrome 和 32 步 eval runner 已实现。dirty-worktree provisional 与 clean-HEAD canonical 均 32/32 通过；canonical run `M9-2026-08-21T09-14-14-110Z-f88ca331` 绑定 commit `f88ca33149619b1a71eb30d74a1b8e266fb41a65`，summary SHA-256 为 `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e`。owner 于 2026-08-23 批准 evidence 与非首页导航栏模糊效果，M9 已关闭。

Rollback:

- 某 vector shape 超出量化误差时使用 Float32 或 shape 专属编码，不扩大缓存到所有原始 frame。

### M10 — Loudness and Complex Spectrum

Implementation:

- Loudness 展示 total 时间线、24 Bark band 热图和游标结构。
- Complex Spectrum 用两个堆叠视图完整展示 1024 bins 的 magnitude/phase，并提供 signed Hz 与游标 real/imag 值。
- 完成结构化 payload、同 frame 单次 Meyda batch 依赖复用；不改变缓存 schema、AnalysisConfig 或 IndexedDB V1。

Verification:

- 对象字段、24 band、real/imag 维度、相位范围和黄金结果；
- renderer 错误隔离和无障碍替代；
- feature registry、UI 和测试达到 21/21。
- 15 分钟 Loudness/Complex/Power/Buffer 四重卡继续满足输入 ≤100ms、分析归因长任务为 0，并回归 20 次资源循环。

Execution state：`M10_FEATURE_IDS`、累计 21 项 Worker/UI、两类 structured payload/renderer、`m10-structures.v1.json`、专项 Vitest/Chrome 和 36 步 eval runner 已进入工作树。dirty-worktree provisional `M10-2026-08-22T18-17-36-129Z-2df604b9-provisional` 已 36/36 通过；正式结论仍等待实现提交、clean-HEAD canonical 与 owner 审批。

Rollback:

- 结构化 renderer 未通过时不把对象压扁成误导性单值；维持不可选并记录缺口。

### M11 — Format, recovery, performance and accessibility hardening

Implementation and verification:

- MP3/WAV/FLAC 同源 fixture 全矩阵。
- 15 分钟上限、快速换歌/换卡、取消、反复恢复和 quota 压力。
- granted/prompt/denied、文件移动/修改、cache 损坏和 schema version。
- 主线程输入、long task、内存、Worker、AudioNode、对象 URL 和 Canvas 重绘。
- 键盘、焦点、非颜色表达、reduced motion 与必要的辅助技术手工检查。
- 1024/1280/1920 CSS px 的真实几何与 Canvas backing store。
- 最新 Chrome 自动化；最新 Edge 真实执行。没有 Edge 证据时里程碑保持未完成。

Gate:

- [acceptance criteria](acceptance-criteria.md) 适用项全部有证据；
- M11 证据完成后才创建 `docs/quality/release-readiness.md`，并据实际覆盖判断 ready/not ready；
- 未通过的格式、浏览器或关键路径不得以“已知问题”形式绕过批准范围。

## 4. Cross-Cutting Ownership

当前 `project-owner` 同时承担产品批准、技术决策、里程碑验收和学习任务验证。若后续分配工程/QA/release owner，更新各文档 frontmatter 和 milestone owner，但不改变已有门禁。

## 5. Change Control

- 产品意图变化：architecture、delivery 及更下游文档全部待复核。
- 系统设计或 ADR 变化：delivery 及更下游文档待复核。
- 验收阈值、fixture 或浏览器矩阵变化：相关 test/eval/readiness 待复核。
- 不为赶过门禁添加未经批准的 legacy fallback、远端路径或范围外页面。

## 6. Plan Approval

`project-owner` 于 2026-07-24 批准了原 M1–M11 实施顺序。其后又明确要求在 M3 前增加 Q0 质量设计，并将 readiness 延后到 M11 证据完成后。

`project-owner` 于 2026-07-28 明确批准 Q0 三份质量设计及本次 delivery 修订。本文恢复为 `approved` 并开放 M3；全部尚未执行的 eval 仍保持 `planned`，该批准不构成测试或 readiness 证据。

`project-owner` 于 2026-07-28 明确批准 M3 evidence 与 working agreements。M3 改为 `Complete`，M4 开放；该批准不构成 M4–M11 产品行为或 release readiness 证据。
