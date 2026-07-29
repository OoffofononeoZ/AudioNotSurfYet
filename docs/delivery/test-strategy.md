---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/execution-plan.md"
next_action: "完成 M5 repository/recovery/Chrome provisional 与原生权限人工矩阵"
---

# Test Strategy

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

### Browser end-to-end

- 选择多文件、队列、上下首、播放、暂停、seek、音量。
- 最多四卡、拒绝重复、换卡、共享 zoom/cursor、图表点击 seek。
- 刷新恢复队列/当前 track/cards/config，时间 0 paused。
- current Blob 与其他 handle 的不同恢复路径。
- permission granted/prompt/denied 和恢复访问按钮。
- cache hit、cache miss、quota、文件变更、Worker error。
- 键盘、焦点、reduced motion。
- 1024、1280、1920 CSS px 的 DOMRect、Canvas CSS/backing-store、截图和 console。

### Manual

- `project-owner` 执行核心任务和 3/3 学习解释。
- 最新稳定 Edge 的格式、权限和 Canvas 路径（除非已经有真实 Edge 自动化）。
- 浏览器权限气泡、文件移动以及 OS file picker 行为。
- DevTools 中的长会话内存、Worker、Audio graph 和 Canvas 观察。

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

每一里程碑执行与其相关的最快测试；门禁关闭前再运行完整相关矩阵、build、文档检查和 `git diff --check`。

## 11. Evidence Retention

- 单元/JUnit、Playwright HTML、trace、截图、fixture manifest 和手工任务记录使用稳定目录和 run ID。
- 不把用户私有音频、路径或内容写入证据。
- 大型 trace 不永久进入 Git 时，记录生成命令、环境和受控存放位置。
- 已批准的 eval plan 从 M3 开始约束证据；首个 canonical run 已记录在 [evidence index](../quality/evidence-index.md)，release-readiness 仍等待 M11 完整证据。

## 12. Exit Criteria

M3 的公开命令、fixture、黄金比较和失败检测已有 clean-commit canonical pass，并已由 `project-owner` 批准。M4 的 AudioEngine/session/Chrome 适用测试也已在 clean commit 上 canonical pass、记录在 [evidence index](../quality/evidence-index.md) 并获 owner 批准。M5 已建立 repository、recovery integration 与 Chrome IndexedDB/OPFS 测试；在 provisional、原生权限人工检查、clean-commit canonical 和 owner 审批完成前不关闭 M5。
