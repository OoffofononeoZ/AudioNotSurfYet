---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/execution-plan.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
next_action: "为 M6 EV-A、EV-J、EV-R 适用子集建立 Worker/registry/performance 证据"
---

# Eval Plan

## 1. Purpose and Current State

本文件定义 AudioNotSurfYet 的质量证据契约。Vitest、Playwright、Worker harness、受控 fixture 和 direct-Meyda golden 已在 M3 建立。M3 canonical evidence 已获批，M4 clean-commit [canonical run](evidence-index.md) 对 EV-S、EV-B、EV-R 的适用子集也已获批。M5 clean-commit canonical 自动化与 Chrome 原生权限人工检查已为 EV-D 的 M5 适用子集提供获批证据。完整 EV-A–EV-R、Edge 矩阵和 M6–M11 产品行为仍为 `planned`。

Q0 只批准“如何判断质量”，不批准 release readiness。`docs/quality/release-readiness.md` 只能在 M11 已产生完整成功、失败、边界和异常证据后创建。

## 2. Fixed Thresholds

以下阈值继承自已批准的产品与 delivery 文档，本阶段不重新定义：

- Meyda 标量、向量和结构值：`abs(actual - expected) <= max(1e-6, abs(expected) * 1e-5)`。
- 量化展示值：反量化误差不超过半个量化步长加上述浮点容差；精确游标值不得使用量化值代替。
- 播放、暂停、seek、换歌后的共享游标绝对偏差不超过 100ms。
- 分析期间用户输入到可见反馈不超过 100ms。
- 不得产生可归因于分析计算的主线程任务超过 50ms。
- display series 不超过 30 samples/second；每个 job 最多四个唯一活动特征。
- `src/data/analyzerData.ts` 的 21/21 项必须具备 registry、renderer、黄金测试和可用卡片。
- Chrome 与 Edge、MP3/WAV/FLAC、1024/1280/1920 CSS px 均需真实证据；缺少 Edge 时不得宣称矩阵完成。

## 3. Evaluation Groups

| Eval ID | Behavior | Required coverage | Acceptance criteria | Architecture risks | Planned methods | Pass threshold | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EV-A | 分析正确性与特征语义 | success、failure、boundary、exception | AC-A01–AC-A07、AC-A10 | R-008、R-009、R-010、R-011、R-016 | Vitest direct-Meyda golden、Worker contract、量化 round-trip、fixture manifest review | 所有适用值满足固定容差；维度、尾帧和有限值规则通过；21/21 覆盖 | project-owner |
| EV-S | 播放、seek 与时间同步 | success、failure、boundary、exception | AC-P03、AC-S01–AC-S05 | R-001、R-012 | AudioEngine/store 集成、Playwright 真实 AudioContext、长播放与重复 seek 计时 | 所有计时场景偏差 ≤100ms；单一实时 AudioContext；MusicBar 基线无回归 | project-owner |
| EV-J | Worker、活动卡、缓存身份和竞态 | success、failure、boundary、exception | AC-P02、AC-A08–AC-A10、AC-R03、AC-R04、AC-F06 | R-002、R-003 | Worker message contract、generation/cache-key 单元测试、快速换歌/换卡 E2E、故障注入 | 0–4 个唯一 feature；旧 generation 不改变 store/cache/Canvas；Worker 失败不停止播放 | project-owner |
| EV-D | IndexedDB、文件权限和会话恢复 | success、failure、boundary、exception | AC-P04、AC-F01–AC-F05、AC-F08、AC-F09、AC-R05、AC-S03 | R-003、R-005、R-006、R-007 | isolated IndexedDB、真实浏览器刷新、handle adapter、权限/事务/quota 注入 | 只保留 current Blob/cache；刷新为 0 秒 paused；失败状态可见且当前页面继续可用 | project-owner |
| EV-U | Owner 学习任务、可访问性和范围边界 | success、failure、boundary、exception | AC-P05、AC-P06、AC-U01–AC-U04 | R-014、R-018 | owner 脚本、预写答案评分、键盘/焦点检查、axe-compatible scan、网络/路由范围审计 | owner 任务全部完成且解释 3/3；核心键盘路径、焦点、非颜色表达、reduced motion 通过；无范围外网络能力 | project-owner |
| EV-B | 格式、浏览器、视口和运行时兼容 | success、failure、boundary、exception | AC-P01、AC-F07、AC-U05、AC-U06 | R-008、R-009、R-015、R-016 | 同源格式 fixture、Chrome/Edge Playwright 或真实手工执行、DOMRect/Canvas/console 检查 | 三格式和三视口通过；无 console error/warn；只有真实 Edge 证据才能关闭浏览器矩阵 | project-owner |
| EV-R | 主线程响应、容量和资源生命周期 | success、failure、boundary、exception | AC-R01、AC-R02、AC-R06 | R-003、R-004、R-013、R-017、R-019 | 15 分钟 trace、PerformanceObserver、20 次生命周期循环、Worker/Audio/Object URL/Canvas 计数、build output | 输入 ≤100ms；无分析归因 >50ms 主线程任务；资源不单调累积；公开测试命令可信 | project-owner |

缩写 `AC-X01–AC-XNN` 表示该连续编号范围内的全部验收项。完整逐项映射见下一节。

## 4. Coverage Design

### EV-A — Analysis correctness

- Success：mono/stereo 平均、固定 frame/hop/window/MFCC、RMS/Amplitude Spectrum/Chroma 以及后续 21 项结果与同版本直接 Meyda 一致。
- Failure：空或声道长度不一致、NaN/Infinity、错误 payload 维度、量化饱和、缺少 provenance 的 fixture 必须显式失败。
- Boundary：silence、单 impulse、frame/hop 边界、尾帧零填充、负值/无上界标量、24-band Loudness、Complex real/imag。
- Exception：浏览器重采样时记录实际分析 PCM sample rate；不能通过改容差掩盖 sample-rate/config 身份错误。

### EV-S — Playback synchronization

- Success：load、play、pause、seek、ended、换歌和 MusicBar 共享同一 engine 快照。
- Failure：decode rejection、AudioContext suspended/closed、source error 后 UI 不停留在虚假 playing/loading。
- Boundary：0 秒、duration、播放 60 秒、连续三次 seek、播放中换歌和刷新归零 paused。
- Exception：首次用户手势恢复 AudioContext；不存在第二个长期实时 AudioContext fallback。

### EV-J — Worker and identity

- Success：0–4 张唯一卡只计算活动特征，完整身份匹配后写入 series/cache。
- Failure：Worker constructor/message/extract error 和 cancelled job 显示可重试错误，不停止播放或覆盖其他卡。
- Boundary：0、1、4、重复和超过 4 个 feature；快速换歌、换卡、销毁和游标快速移动。
- Exception：即使 cooperative cancel 不能立即停止，旧 generation/result/request ID 仍必须被丢弃。

### EV-D — Recovery and persistence

- Success：当前 Blob、当前分析缓存、队列句柄和 UI snapshot 完整恢复，时间为 0 且 paused。
- Failure：permission denied、quota/transaction abort、文件缺失/变化、cache 损坏均进入明确状态。
- Boundary：只保存一个 current Blob/cache；下一、上一、下二、上二权限查询顺序；current track 原子替换与清除会话。
- Exception：未知 schema 不猜测迁移；`requestPermission()` 只由“恢复访问”用户操作触发。自动化 OPFS handle 证据与原生 OS picker 权限证据分开记录，前者不得代替后者。

### EV-U — Learning, accessibility, and scope

- Success：owner 完成加载、选卡、换卡、比较、跳转和刷新恢复，并正确解释三个学习样例。
- Failure：不可见焦点、无可访问名称、纯颜色表达或 Canvas 无 DOM 值均失败。
- Boundary：0–4 张卡、键盘 seek 到两端、reduced motion、卡片错误后的可预测焦点。
- Exception：不得新增麦克风、上传、远端 URL、账户或未定义 Tab 的实现；owner-only 结果不得表述为广泛用户研究。

### EV-B — Compatibility

- Success：同源短 fixture 的 MP3/WAV/FLAC 在最新 Chrome/Edge 完成加载、播放和适用分析。
- Failure：损坏/不支持文件显示可理解错误，队列和 store 不锁死。
- Boundary：1024、1280、1920 CSS px 的几何、Canvas backing store 和控制台。
- Exception：MP3 有损结果与各自解码后的直接 Meyda golden 比较，不要求三格式逐值相同；缺少真实 Edge 时保持 `planned/blocked`。

### EV-R — Performance and resources

- Success：正常和最大输入下交互、进度、取消和 Canvas 分层重绘满足阈值。
- Failure：分析计算落到主线程、payload 超过 30Hz、公开测试脚本无效或资源未释放均失败。
- Boundary：15 分钟、四个代表性最重 feature、20 次换歌/换卡/route dispose、cache/quota 压力。
- Exception：不设置 wall-clock 完成 SLA；约 1MB chunk 警告作为风险信号记录，不伪装为构建失败或通过。

## 5. Acceptance-Criteria Traceability

| Acceptance group | Eval coverage |
| --- | --- |
| AC-P01 | EV-B |
| AC-P02 | EV-J |
| AC-P03 | EV-S |
| AC-P04 | EV-D |
| AC-P05、AC-P06 | EV-U |
| AC-A01、AC-A02、AC-A03、AC-A04、AC-A05、AC-A06、AC-A07 | EV-A |
| AC-A08、AC-A09、AC-A10 | EV-J；AC-A10 同时由 EV-A 核对 21 项语义 |
| AC-S01、AC-S02、AC-S04、AC-S05 | EV-S |
| AC-S03 | EV-S、EV-D |
| AC-R01、AC-R02、AC-R06 | EV-R |
| AC-R03、AC-R04 | EV-J |
| AC-R05 | EV-D |
| AC-F01、AC-F02、AC-F03、AC-F04、AC-F05、AC-F08、AC-F09 | EV-D |
| AC-F06 | EV-J |
| AC-F07 | EV-B、EV-S |
| AC-U01、AC-U02、AC-U03、AC-U04 | EV-U |
| AC-U05、AC-U06 | EV-B |

## 6. Evidence Record Contract

未来每次 eval run 至少记录：

| Field | Requirement |
| --- | --- |
| `eval_id` | 上述稳定 EV ID |
| `state` | planned、pass、fail、blocked 或 waived；已执行子集以 evidence index 为准 |
| `run_id` | 可追溯且不含用户私有文件信息 |
| `commit` | 被验证源码状态 |
| `environment` | OS、浏览器/版本、Node、Meyda、硬件说明 |
| `fixture` | fixture ID、生成器版本、provenance/license/hash |
| `method` | 命令、自动化项目或手工步骤 |
| `result` | 实际值、阈值、通过/失败原因 |
| `artifacts` | 测试报告、trace、截图或签字记录的位置 |
| `artifact_hash` | 本地产物存在时记录其 SHA-256；删除后仍保留原 hash |
| `retention_state` | local-present、local-deleted 或 not-produced |
| `failure` | 失败时引用 failure type + severity |

文档中的 `planned` 不是测试结果。只有实际 run record 可以把某一行为标为 pass、fail 或 blocked。

### Evidence index and local artifacts

- 首个真实 eval run 已产生并记录在 [evidence index](evidence-index.md)；后续不得添加占位 run。
- evidence index 是受版本控制的长期摘要，至少保存上表字段、关键测量值、复现命令和 reviewer；eval plan 继续只维护评估设计。
- Playwright report、trace、截图和性能 dump 使用 `test-results/`、`playwright-report/`、`artifacts/evals/<run-id>/`，只在本地保留；M3 建立这些路径时再同步加入 `.gitignore`。
- 本地产物至少保留到对应里程碑批准；与 S0/S1 有关的产物保留到缺陷关闭及回归获批。删除后把 evidence index 的 `retention_state` 改为 `local-deleted`，不得删除摘要、hash 或复现命令。
- `local-deleted` 摘要不能单独支持未来 release readiness。若 readiness 需要检查原始报告、trace 或截图，必须重新运行相应 eval 并产生新的 run record。
- M3/M4/M5 已批准 canonical artifact 均在 Git 忽略目录保留；M5 Chrome 原生权限人工记录以 owner 明确签字补偿且未生成私有 artifact。dirty-worktree provisional artifact 只保留为实现反馈。

## 7. Evidence Gaps

| Gap ID | Missing evidence | Reason | Residual risk / affected gate | Owner | Compensating or next verification |
| --- | --- | --- | --- | --- | --- |
| EG-003 | 真实 Edge 运行 | 当前机器未发现 Edge | 不能关闭 EV-B、M11 或未来 readiness | project-owner | 安装/提供最新稳定 Edge 后执行同一浏览器矩阵 |
| EG-004 | 广泛用户学习结果 | 当前范围只批准 owner 自测 | 只能证明 owner 对 3/3 样例达标，不能泛化学习效果 | project-owner | 保留 owner-only 表述；扩大声明前另开产品研究决策 |
| EG-005 | 目标基线硬件 | 产品未指定设备型号 | 性能结论跨设备可比性有限 | project-owner | 每次记录实际硬件，阈值不变；若结果不稳定，在 quality/readiness 前批准目标设备 |
| EG-006 | 文件权限真实提示的全自动化 | OS picker 和权限气泡受浏览器/系统控制 | M5 Chrome 已由 owner 手工补偿；Edge 与未来完整矩阵仍不能只靠 adapter 证明 | project-owner | M5 Chrome 记录见 evidence index；Edge/M11 继续执行真实 granted/prompt/denied |

### Resolved evidence gaps

| Gap ID | Resolution evidence | Resolved on |
| --- | --- | --- |
| EG-001 | `npm run eval:m3` 在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过；run、环境和本地产物 hash 见 [evidence index](evidence-index.md) | 2026-07-28 |
| EG-002 | 同一 canonical run 的 fixture、manifest、golden 与 hash checks 通过，并绑定上述 commit | 2026-07-28 |

## 8. Q0 Approval Gate

Q0 只有在以下条件满足后才能改为 `approved`：

- `project-owner` 审阅本文、[golden examples](golden-examples.md) 和 [failure taxonomy](failure-taxonomy.md)；
- 七组评估均包含成功、失败、边界和异常路径；
- 42 个 AC 均有映射，19 个风险均映射到 eval 或显式 gap；
- 没有把 planned 写成 pass，也没有伪造 Edge、fixture 或自动化证据；
- evidence index 与本地产物政策已由 owner 接受，并且没有预建空索引；
- execution/milestone 文档已把 Q0 设为 M3 的前置门禁。

批准 Q0 只允许开始 M3，不表示 M3 或任何产品行为已经通过。

## 9. Approval Record

`project-owner` 于 2026-07-28 明确批准本文、[golden examples](golden-examples.md)、[failure taxonomy](failure-taxonomy.md) 及对应 delivery 修订。同日，owner 又批准 M3 [evidence index](evidence-index.md) 与 working agreements；M3 已关闭并开放 M4。

2026-07-29，M4 clean-commit canonical run 已追加到 [evidence index](evidence-index.md)，并由 `project-owner` 明确批准；EV-S、EV-B、EV-R 的 M4 适用子集据此生效，M4 关闭并开放 M5。该批准不覆盖 M5 EV-D 或 EG-006。

同日，M5 clean-commit canonical run 与 Chrome 原生权限人工检查均通过，`project-owner` 明确批准 M5 evidence 与 working agreements；EV-D 的 M5 适用子集据此生效，M5 关闭并开放 M6。EG-006 的全自动化缺口和 Edge 真实矩阵仍保留。
