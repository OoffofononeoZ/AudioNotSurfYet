---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/execution-plan.md"
next_action: "M13 clean canonical 已通过；候选、浏览器或 M14 行为变化时重跑"
---

# Test Strategy

## Scope Routing

本文保留 Analyzer M1–M11 的已批准测试与证据历史，并增加 M12 瀑布流测试切片。Editor 继续使用独立 [E1–E6 test strategy](editor/test-strategy.md)；M12 runner 不登记或修改 Editor evidence。

## 1. Objectives

测试体系要回答五个问题：

1. Worker 结果是否与同输入、同参数的直接 Meyda 提取一致？
2. AudioEngine、store、Worker 和共享时间轴在竞态下是否仍使用同一 track/time 身份？
3. IndexedDB 与文件权限失败时，当前会话是否仍可用且状态诚实？
4. 15 分钟输入分析时，主线程交互、Canvas 和资源生命周期是否满足 guardrail？
5. owner 能否完成学习任务并解释首批三个特征？

## 2. Tooling Target

| Layer | Target tool | Purpose |
| --- | --- | --- |
| Type/static | TypeScript / `vue-tsc` | FeatureId 穷尽、payload/renderer 契约、Vue 类型 |
| Unit/integration | Vitest | 纯函数、store、coordinator、Worker core、adapter |
| IndexedDB unit | Vitest + `fake-indexeddb` or equivalent isolated adapter | schema、事务、quota、恢复优先级 |
| Browser | Playwright | UI、真实 IndexedDB、Canvas、权限 adapter、视口、console |
| Performance | Chromium PerformanceObserver + trace | input latency、long task、memory/resource signals |
| Accessibility | Playwright keyboard + axe-compatible checks + manual | 核心任务、名称、焦点、非颜色表达、reduced motion |
| Docs | repository script | frontmatter、internal links、required docs、feature count |

具体依赖版本在 M3 按当前 Vue/Vite/Node 兼容性选择并锁定。工具不能通过修改产品行为来“适配测试”。

## 3. Test Pyramid

### Unit

- `averageToMono`：mono/stereo/多声道、负值、空输入、长度错误。
- frame planner：frame count、start time、hop、尾帧零填充、不同采样率。
- canonical config/hash、track hash、cache key。
- FeatureRegistry：21 项穷尽、唯一、shape/renderer/dependency/维度。
- float tolerance、NaN/Infinity、量化/反量化、饱和、紧凑 payload 长度。
- timeline clamp、zoom anchor、Canvas x ↔ time mapping。
- M7 工作区：四槽、0–3 张活动卡、slot/feature 唯一、首次默认三卡与已保存空工作区恢复为空。
- M12 纯布局：1/2 列、平局左列、不同高度、动态高度重算、容器高度和 pairwise 无重叠。
- M13 FIFO reducer：空、1–4 项、第五项淘汰、手动收起、重新展开、重复/快速序列和唯一性；V1 adapter 覆盖 cards/queue 双向顺序与无效输入。
- restore priority、permission state mapping、current Blob/cache invariant。
- generation/request ID 和 stale job 丢弃。

### Worker contract

- request/progress/result/error/cancel 的 runtime validation。
- 0、1、4、重复和超过 4 个 feature。
- 批次 yield 与 cooperative cancellation。
- transferable PCM 所有权。
- 同 frame 依赖复用不改变结果。
- 精确 cursor request 合并和迟到结果隔离。
- Worker 抛错/终止后的 recoverable UI 状态。

### Integration

- AudioEngine → PlaybackSnapshot → store → timeline cursor。
- engine PCM copy → coordinator → Worker → series/cache → renderer。
- play/pause/seek/ended/换歌/取消分析的交错顺序。
- current track 持久化事务和刷新 bootstrap。
- FileSystemFileHandle adapter 的 query/request/getFile 三态。
- 单卡 renderer error boundary。
- M13 零活动项无 Worker、1–4 项 cache hit/miss、第五项 cancel generation、迟到结果隔离，以及 workspace 串行 save/revision/quota/not-persisted。

### Browser end-to-end

- 选择多文件、队列、上下首、播放、暂停、seek、音量。
- M7 固定四槽、0–3 张获准活动卡、拒绝重复、换卡、共享 zoom/cursor、图表点击 seek；四个唯一活动特征场景顺延 M8。
- 刷新恢复队列/当前 track/cards/config，时间 0 paused。
- current Blob 与其他 handle 的不同恢复路径。
- permission granted/prompt/denied 和恢复访问按钮。
- cache hit、cache miss、quota、文件变更、Worker error。
- 键盘、焦点、reduced motion。
- 390、1024、1280、1920 CSS px 的真实 item DOMRect、最短列不变量、Canvas CSS/backing-store、截图和 console；不再从 `grid-template-columns` 推断布局。
- M12 在四卡/空槽、换卡、renderer error 和结构明细展开后重算；验证 slot DOM 顺序、`details open`、焦点、Canvas 数量和容器包围关系。
- M13 始终断言 21 卡与 `FEATURE_IDS` DOM 顺序；初始无 Canvas/select/remove；展开 1–4、第五项 FIFO、快速切换、刷新恢复、错误/重试、seek/zoom/exact 与 20 次资源循环在真实 Chrome/Edge 运行。

### Manual

- `project-owner` 执行核心任务和 3/3 学习解释；M7 已签字完成。
- 最新稳定 Edge 的格式、权限和 Canvas 路径；M11 真实 Edge 自动化与 2026-08-26 原生权限补偿签字均已完成。
- 浏览器权限气泡、文件移动以及 OS file picker 行为；这类路径保持人工覆盖，不冒充自动化。
- DevTools 中的长会话内存、Worker、Audio graph 和 Canvas 观察；M11 owner 最终加固签字已完成，相关实现变化后须重做。

## 4. Audio Fixtures

### Generated PCM

所有 PCM 通过仓库脚本按明确 sample rate、duration、amplitude、phase 和 seed 生成：

- silence；
- 440Hz sine；
- C4+E4 与 G4+B4 dual tone；
- impulse（含 frame 边界附近位置）；
- equal-RMS sine 与 harmonic-rich signal；
- stereo left/right 不同波形，用于 mono 平均；
- 长度小于、等于和非整倍数 frame/hop 的序列。

随机/噪声 fixture 必须使用固定 seed。

### Encoded formats

- 从同一短 PCM master 生成 MP3、WAV、FLAC。
- `fixture-manifest.json` 记录 master hash、输出 hash、sample rate、channels、duration、编码命令、编码器/版本、生成日期和许可。
- fixture 保持短小，用于格式一致性，不作为 15 分钟容量样本。
- 15 分钟容量输入在测试运行时生成或由确定性缓存生成，避免提交大型二进制。

### Golden results

- 使用锁定版本 Meyda 对原始 frame 直接提取。
- Worker pipeline 结果逐帧/逐元素与直接结果比较。
- golden 包含 config、Meyda version、fixture hash 和生成器 version。
- 更新 golden 必须显示数值 diff 和原因；不能因测试失败自动覆盖。

## 5. Feature Coverage Matrix

| Slice | Features | Required shapes/tests |
| --- | --- | --- |
| M6 platform | RMS、Energy、Amplitude Spectrum、Chroma | Worker core、直接 Meyda 5.6.3 platform golden、scalar/frequency/category payload、exact cursor；Energy 只证明平台通路，不计作 M8 产品完成 |
| M7 | RMS | scalar, silence/amplitude, exact cursor |
| M7 | Amplitude Spectrum | frequency vector, sine peaks, heatmap, quantization |
| M7 | Chroma | 12 category vector, pitch classes, heatmap/bars |
| M8 | ZCR, Energy, 9 spectral scalars, Perceptual Spread/Sharpness | scalar range, previous-frame flux, signed/unbounded handling |
| M9 | Power Spectrum | amplitude² relation, frequency axis |
| M9 | MFCC | 13 dimensions, heatmap, config visibility |
| M9 | Buffer | waveform envelope, signed extrema, tail frame |
| M10 | Loudness | total + 24 specific bands |
| M10 | Complex Spectrum | real/imag dimensions, magnitude/phase derivation |

每项至少需要 registry coverage、直接 Meyda golden、renderer contract、cursor exact value 和一个失败/边界场景。

M6 的 21/21 只验证 registry 双向穷尽、milestone/shape/renderer/维度和当时的 Worker support 集合；M8 已以独立 golden/renderer/card/canonical 证明累计 16 项，M9 的累计 19 项已通过 clean canonical 与 owner 门禁。M10 两类结构输出与累计 21/21 已通过 clean canonical，并于 2026-08-25 获 owner 批准。Meyda 5.6.3 `spectralFlux` 的固定异常继续证明上游缺陷；M8 另以 ADR-0005 项目公式、首帧/静音和 exact cursor golden 证明产品支持，不能删除上游异常测试或伪称 Meyda 已修复。

M8 新增 `test:m8:unit`、`test:m8:integration`、`test:e2e:m8`、`eval:m8:provisional` 和 clean-HEAD `eval:m8`。Chrome 自动化覆盖 390/1024/1280/1920、sticky 几何、MusicBar/歌曲列表层级、pointerup/pointercancel/focus、主题滚动条、0/1/3/4 卡和 16 项选择；Windows Chrome 偶发 pressed 状态无法由 macOS 自动化替代，由 `project-owner` 按同一脚本人工复核。

2026-08-21，M8 provisional 与 clean-HEAD canonical 均 28/28 通过；canonical run `M8-2026-08-21T03-23-18-552Z-d6dcf715` 的 M8 unit 为 7/7、integration 为 6/6、Chrome 为 2/2。owner 随后完成 Windows Chrome 补偿签字并批准 M8 evidence；相关 UI 改动后仍需重新验证。

M9 新增 `test:m9:unit`、`test:m9:integration`、`test:e2e:m9`、`fixtures:m9:golden`、`eval:m9:provisional` 与 clean-HEAD `eval:m9`。专项层覆盖 Power=Amplitude²、MFCC signed 13 维、Buffer envelope/exact/tail、四卡恢复、M10 拒绝、Header 路由样式和 390/1024/1280/1920。

2026-08-21，M9 provisional 与 clean-HEAD canonical 均 32/32 通过；canonical run `M9-2026-08-21T09-14-14-110Z-f88ca331` 的 M9 unit 为 5/5、integration 为 7/7、Chrome 为 2/2。`project-owner` 于 2026-08-23 批准 canonical evidence 与非首页导航栏模糊效果，前述 Windows Chrome 视觉/学习清单据此完成签字；未提供的逐项数值或解释不作补写。

M10 新增 `test:m10:unit`、`test:m10:integration`、`test:e2e:m10`、`fixtures:m10:golden`、`eval:m10:provisional` 与 clean-HEAD `eval:m10`。专项层覆盖 21 项集合、Loudness total/24 bands、Complex real/imag 各 1024、magnitude/phase 与相位环绕、静音/非有限值、两类 codec、exact cursor、stale/cancel/quota、四卡恢复、完整精确表、多视口和 15 分钟四重卡输入/long-task 门禁。36 步 suite 继续回归 M3–M9；M6 Chrome 回归承担 20 次 Worker/AudioContext/RAF 资源循环。

2026-08-25，`project-owner` 批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖。该批准关闭 M10 产品门禁，但不替代 M11 的真实 Edge、三格式、权限恢复、资源、无障碍和最重性能矩阵。

## 6. IndexedDB and Permission Matrix

| Scenario | Unit adapter | Real Chrome | Real Edge |
| --- | --- | --- | --- |
| V1 full restore | Required | Required | Required |
| current Blob replacement | Required | Required | Smoke |
| only current cache retained | Required | Required | Smoke |
| quota/transaction abort | Required | Browser injection where possible | Manual if injection unavailable |
| handle granted | Required | Required | Required |
| handle prompt | Required | Required/manual prompt | Required/manual prompt |
| handle denied | Required | Required/manual | Required/manual |
| moved/missing/changed file | Required | Manual + controlled fixture | Manual |
| unknown schema | Required | Required | Smoke |

权限 adapter 只用于可重复自动化；最终权限声明必须至少有真实浏览器证据。

## 7. Performance Method

### Scenario

- 目标机器与浏览器版本写入报告。
- 加载确定性 15 分钟 PCM/格式样本。
- 启动四项代表性分析：scalar、frequency vector、category/structured 或当前已实现最重 shape。
- 分析期间反复执行播放/暂停、换卡、zoom 和 seek。

### Measurements

- 每次输入事件到可见反馈的 duration，p50/p95/max；每个样本均必须 ≤100ms 才满足当前硬阈值。
- Long Tasks API 和 trace 中主线程 >50ms task；关联分析 start/end 和 stack/source。
- Worker CPU、postMessage payload bytes、display samples/second。
- JS heap、ArrayBuffer、Worker 数量、AudioNode、RAF 和 object URL 的前后变化。
- Canvas 静态层和 cursor 层重绘频率。

基线设备尚未在产品意图中固定型号，因此报告必须写出实际硬件；阈值仍作为通过条件。若设备差异使结论不稳定，由 owner 在 quality 阶段前增加明确目标设备，不在测试中隐式放宽。

## 8. Accessibility and Visual QA

- 只使用键盘执行 AC-U01，记录焦点顺序和换卡后的焦点。
- 使用可访问性检查发现名称、role、对比度和结构问题；Canvas 必须有 DOM 说明和当前值。
- forced/reduced-motion 场景验证游标正确而非依赖动画。
- 颜色视觉缺陷模拟只作为辅助；最终图例必须从 DOM/设计规则证明非纯颜色。
- 三视口记录 DOMRect、scrollWidth/clientWidth、Canvas CSS/backing-store 和截图。
- M12 在 Chrome/Edge 记录四视口唯一 x 坐标、item 相交矩阵、按 slot 推演的最短列位置和容器 bottom；Home/Analyzer 循环检查 Observer/RAF/Canvas 清理。
- 自动监听 `console.error`、`console.warn`、`pageerror`、`unhandledrejection`。

## 9. Failure Injection

- decode rejection、AudioContext suspended/closed。
- Worker constructor/message/extract error、迟到 result、取消未及时停止。
- IndexedDB open/upgrade/put/transaction abort/quota。
- handle query prompt/denied、request denied、getFile missing。
- track hash/config mismatch、cache payload corrupt。
- renderer invalid dimension、Canvas context unavailable。

每个故障都验证“受影响边界”和“未受影响能力”，例如 Worker 失败不能停止播放。

## 10. Commands and CI Shape

M3 应提供语义清晰的脚本，建议至少：

```text
npm run typecheck
npm run test:unit
npm run test:worker
npm run test:e2e
npm run test:analysis
npm run test:docs
npm run build
```

M3 已选择删除指向不存在 `test.ts` 的 `test:spectrogram`，不保留兼容别名。README/working agreements 只列真实执行成功的命令。

M6 新增并已单项执行：

```text
npm run test:m6:unit
npm run test:m6:worker
npm run test:m6:integration
npm run test:e2e:m6
npm run eval:m6:provisional
npm run eval:m6
```

M12 新增：

```text
npm run test:m12:unit
npm run test:e2e:m12:chrome
npm run test:e2e:m12:edge
npm run eval:m12:provisional
npm run eval:m12
```

M13 新增：

```text
npm run test:m13:unit
npm run test:m13:integration
npm run test:e2e:m13:chrome
npm run test:e2e:m13:edge
npm run eval:m13:provisional
npm run eval:m13
```

`eval:m13:provisional` 允许 dirty worktree；`eval:m13` 要求起止 clean，并回归 Analyzer M7–M12、Coordinator/cache、Editor E7 lease/renderer 隔离、M13 unit/integration/双浏览器、docs、typecheck、build 和 diff check。

M13 最终 provisional `M13-2026-08-31T17-40-46-300Z-e62140ee-provisional` 与 clean canonical `M13-2026-08-31T17-44-39-680Z-63c04005` 均 17/17 通过；canonical 绑定实现 commit `63c04005670145d83ee181d474197bce921c5300`，summary SHA-256 为 `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc`。

`eval:m12:provisional` 在 dirty worktree 执行 M7–M11 Analyzer 相邻回归、M12 unit/Chrome/Edge、docs、typecheck、build 和 diff check，只生成实现反馈。`eval:m12` 要求 clean committed worktree，生成可登记的 canonical artifact。

2026-08-28 的 provisional run `M12-2026-08-28T07-12-30-657Z-45f51908-provisional` 已 12/12 通过，summary SHA-256 为 `055951e16e9749bf89f189516f3975bb340721fe05e47922f5e34148ed47d9fd`。M12 unit 4/4、Chrome/Edge 各 3/3，M7–M11 Chrome 相邻回归全部通过；15 分钟回归最大反馈 16.7ms、分析归因长任务 0，资源回归保持 2 live RAF。该结果绑定 dirty worktree，只作实现反馈，不追加 evidence index。

首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 因 M7 短 fixture 未保证观察窗口内仍有播放输入而失败；修复测试前置条件后，目标用例连续 5/5 通过。canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 在 clean commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上 12/12 通过，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`；失败与成功 artifact 均保留。

`eval:m6` 要求 clean HEAD，顺序执行 fixture、M3–M5 回归、M6 三层 Vitest、Chrome E2E、docs、deliberate failure、typecheck、build 和 diff check；provisional 允许 dirty worktree，但不得追加正式 evidence。

每一里程碑执行与其相关的最快测试；门禁关闭前再运行完整相关矩阵、build、文档检查和 `git diff --check`。

## 11. Evidence Retention

- 单元/JUnit、Playwright HTML、trace、截图、fixture manifest 和手工任务记录使用稳定目录和 run ID。
- 不把用户私有音频、路径或内容写入证据。
- 大型 trace 不永久进入 Git 时，记录生成命令、环境和受控存放位置。
- 已批准的历史 eval plan 从 M3 开始约束证据；M3–M13 canonical 与人工补偿记录均已进入 [evidence index](../quality/evidence-index.md)。M13 runner 路径失败目录、最终 provisional、clean canonical 与 owner 授权一并保留，Analyzer readiness 已恢复为 `Ready with waivers`。

## 12. Exit Criteria

M3 的公开命令、fixture、黄金比较和失败检测已有 clean-commit canonical pass，并已由 `project-owner` 批准。M4 的 AudioEngine/session/Chrome 适用测试也已在 clean commit 上 canonical pass、记录在 [evidence index](../quality/evidence-index.md) 并获 owner 批准。M5 repository、recovery integration 与 Chrome IndexedDB/OPFS 已在 clean commit canonical 通过；Chrome 原生权限人工检查也已由 `project-owner` 确认通过，M5 evidence 与 working agreements 已获批准。M6 Worker/registry/cache/15 分钟 Chrome 场景已在 clean commit canonical 20/20 通过并获 owner 批准，M6 已关闭。M7 unit/integration/golden/Chrome 与 M3–M6 回归已在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过；owner 于 2026-08-21 完成人工操作与 3/3 学习解释并批准 evidence，M7 已关闭。

M8–M10 的 UI、scalar、vector/waveform 和 structured 特征证据均已获批准；M10 达到 21/21。M11/M12 历史 canonical 保留；M13 在 clean commit 上完成 unit/integration、Chrome/Edge、M7–M12 与 Editor E7 相邻回归、build 和文档 17/17，R-028–R-030 已缓解，Analyzer-only readiness 已恢复为 `Ready with waivers`。
