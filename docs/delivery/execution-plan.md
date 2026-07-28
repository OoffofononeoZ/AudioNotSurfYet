---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-28
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "由用户提交 M3 状态；随后对干净 commit 运行 canonical eval 并创建 in-review evidence index"
---

# Execution Plan

## 1. Delivery Outcome

按纵向切片把已批准的本地音频学习体验从当前播放器基础推进到 21 项 Meyda 特征全覆盖。本计划以门禁证据而不是日历日期排序；任一里程碑未通过时，不进入下一批特征。

本文件定义实施顺序和验收方式，不代表 M3–M11 已实现。当前已完成 M1、M2 和 Q0 门禁；M3 测试基础正在实施。

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

Status：In Review.

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
- provisional run 基于 dirty worktree，只证明当前本地实现可执行，不是 canonical milestone evidence；
- M3 保持 `In Review`，等待用户提交后对干净 commit 复跑。

### M4 — AudioEngine and audioSessionStore

Goal：建立单一播放引擎，同时保持现有 MusicBar 行为。

Implementation:

- 把 `audioLoader.ts` 和 MusicBar 中的播放/能量职责收敛到 `AudioEngine`。
- 建立 `PlaybackSnapshot` 和 `audioSessionStore`，store 不持有 AudioBuffer/AudioNode。
- 实现 load/play/pause/seek/volume/ended/dispose。
- 迁移 MusicBar 到 engine 快照和 Analyser 数据源。
- 处理快速换歌、重复 play、AudioContext suspended、decode error 和销毁。

Verification:

- 引擎/store 单元与集成测试；
- 现有队列、播放、暂停、上下首、seek、音量和 MusicBar 能量回归；
- 一次会话仅一个实时 AudioContext；
- 资源生命周期测试无遗留 source、RAF 或对象 URL。

Rollback:

- M4 必须作为可独立审阅切片；失败时回退引擎接线，不保留新旧两套长期运行路径。

### M5 — IndexedDB session recovery

Goal：实现最近一次会话和权限可见的混合恢复。

Implementation:

- 建立版本化 `SessionRepository` 和 runtime validation。
- 接入 `showOpenFilePicker()`，保存队列全部 handle。
- 只保存当前 Blob 和当前分析 cache manifest/payload。
- 实现 current Blob/cache 原子替换、清除会话和 quota failure。
- 恢复队列、当前歌曲、卡片和固定配置；时间归零 paused。
- 按相邻距离查询其他歌曲权限，用户触发 `requestPermission()`。
- 为 granted/prompt/denied/missing/changed/not-persisted 建立 UI 状态。

Verification:

- 完整恢复、只保存当前数据、切歌替换、schema version、quota 和事务失败测试；
- 当前 Blob 可在句柄无权限时恢复；
- 其他 track 不自动触发权限提示；
- 权限/文件错误不破坏当前页面播放。

Rollback:

- 数据库失败时回到内存会话并显示不能跨刷新保存；不得增加未批准的 localStorage/全部 Blob fallback。

### M6 — Worker analysis platform and feature registry

Goal：完成可扩展且不阻塞主线程的分析基础设施。

Implementation:

- 建立 21 项穷尽 `FeatureRegistry` 和 output-shape/renderer 类型。
- 实现平均 mono 混合、frame 生成、固定 `AnalysisConfig` 和 canonical config hash。
- 实现 AnalysisCoordinator/Worker 消息、progress、cooperative cancel 和 generation 隔离。
- 实现依赖复用、最多 30Hz 聚合、紧凑 payload、精确游标请求。
- 建立 `trackHash + configHash + featureId` 内存/IndexedDB cache identity。

Verification:

- mono、frame、registry、hash、聚合、量化、取消和 stale-result 测试；
- 21/21 key coverage；
- 四个不重复 feature 限制；
- 最大支持输入期间输入反馈和长任务 guardrail；
- Worker 失败不停止播放。

Rollback:

- 某种紧凑编码不满足精度时只回退该 shape 为 Float32，不把计算搬回主线程。

### M7 — RMS, Amplitude Spectrum, Chroma vertical slice

Goal：交付第一条完整学习体验。

Implementation:

- 建立最多四张卡的选择、换卡和唯一 feature 约束。
- 建立共享 `TimelineViewport`、缩放、AudioContext 游标和图表点击 seek。
- RMS：时间序列折线和精确标量。
- Amplitude Spectrum：时频热图和游标频谱。
- Chroma：12 类热图和游标柱图。
- DOM 显示解释、固定参数、精确值、图例、状态和键盘控件。
- 保存/恢复卡片、viewport、当前三项 cache。

Verification:

- 首批三项黄金结果；
- 四卡选择/替换、共享 zoom/cursor 和 click-to-seek E2E；
- 游标偏差不超过 100ms；
- owner 完成全部任务脚本并正确解释 3/3 黄金片段；
- 1024/1280/1920 几何、Canvas 和控制台检查。

Rollback:

- 单卡 renderer 出错时隔离该卡；播放和其他卡继续。M7 未通过不得进入 M8。

### M8 — Remaining scalar features

Features:

- ZCR、Energy；
- Spectral Centroid、Flatness、Flux、Slope、Rolloff、Spread、Skewness、Kurtosis、Crest；
- Perceptual Spread、Perceptual Sharpness。

Implementation:

- 复用 scalar series/renderer，补充每项范围、单位、依赖和解释。
- 对无固定上界、可负值或依赖前一帧的特征建立专门边界处理。

Verification:

- 每项直接 Meyda 黄金测试、registry/renderer 契约和至少一个解释性 fixture；
- 第一个 frame、silence、负值、NaN/Infinity 防护；
- 完成后累计覆盖 16/21。

Rollback:

- 单项失败保持 feature flag/registry 不可选，不阻塞已批准功能；未通过项不能计入覆盖。

### M9 — Power Spectrum, MFCC, Buffer

Implementation:

- Power Spectrum 复用 frequency heatmap 并验证与 amplitude² 的关系。
- MFCC 使用 13 系数热图/游标向量，参数保持可见。
- Buffer 使用波形 envelope 和游标 frame，不保存逐帧原始 buffer 集合。

Verification:

- 维度、频率/系数轴、量化和 cursor exact-value 测试；
- 波形正负峰、尾帧和多视口 Canvas 测试；
- 完成后累计覆盖 19/21。

Rollback:

- 某 vector shape 超出量化误差时使用 Float32 或 shape 专属编码，不扩大缓存到所有原始 frame。

### M10 — Loudness and Complex Spectrum

Implementation:

- Loudness 展示 total 时间线、24 Bark band 热图和游标结构。
- Complex Spectrum 展示派生 magnitude/phase，并提供游标实部/虚部值。
- 完成结构化 payload、依赖复用和缓存 schema。

Verification:

- 对象字段、24 band、real/imag 维度、相位范围和黄金结果；
- renderer 错误隔离和无障碍替代；
- feature registry、UI 和测试达到 21/21。

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
