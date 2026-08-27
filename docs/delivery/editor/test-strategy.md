---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/editor/execution-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "创建 E3 quality、fixture、unit/integration/Chrome 与 eval runner"
---

# Editor E1–E6 Test Strategy

## 1. Objectives

Editor 测试体系必须回答：

1. route、播放 lease 和 analysis lease 是否始终绑定同一歌曲与唯一运行时资源？
2. JSON、草稿和导入失败是否保持工程原子性与歌曲身份？
3. 波形、tempo、事件和 overlay 是否在 zoom、DPR 与 resize 下共享精确时间映射？
4. point/range 的 pointer、右键、键盘和 cleanup 状态机是否覆盖成功、失败、边界与异常路径？
5. 10,000 事件、双浏览器和长会话下是否满足性能、资源、恢复与无障碍门禁？

## 2. Tooling Boundary

沿用现有 TypeScript/Vue/Vitest/fake-indexeddb/Playwright/真实 Chrome/真实 Edge/PerformanceObserver 和文档脚本。当前规划不安装新包；如果实现发现 BPM、文件格式或辅助技术工具缺口，必须先提供用途、体积、许可、替代方案和准确性证据并获得 owner 单独批准。

测试不得通过增加第二 engine/Worker、放宽 validator、禁用真实浏览器行为或修改产品语义来制造通过。

## 3. Test Layers

### Unit

- JSON V1 canonical encoding、微秒规范化、严格未知字段、ID/reference、歌曲 identity、重复 point 和 range overlap。
- tempo segment 插入/继承/排序、20/300 边界、小数 BPM、single-beat、拍号和 measure/beat grid。
- viewport clip、zoom anchor、25% pan、time↔x、resize/DPR 和换歌修正。
- adaptive subdivision、point uniqueness、range state machine、半开重叠、端点拖动和 cleanup。
- overlay bounds、1%/5% keyboard step、renderer adapter transforms、DPR backing store 和 structured shapes。
- BPM onset envelope/autocorrelation、confidence/margin、真实脉冲间隔和 low-confidence 分类。

### Integration

- Header/current track 与 playlist/specified track 路由、invalid target、refresh/direct-open。
- playback lease token、repeat-one、queue-next restore、analysis consumer generation、stale/cancel/cache partial hit。
- EditorSessionController、codec registry、single-draft repository、250ms debounce、immediate flush、quota/abort 与异歌三选项。
- Buffer/overlay feature 去重、Analyzer workspace 不被改写、返回 Analyzer 后重新激活原卡片。
- point/range round-trip、导入原子性、pointercancel/blur/route cleanup 和 overlay 错误隔离。

### Browser E2E

- E1–E5 使用本机稳定 Chrome channel 执行对应专项和适用 Analyzer 回归。
- E6 使用同一用例分别运行真实 Chrome 与 `msedge` channel；不得以 Chromium 代替 Edge。
- 读取 DOM 状态、可访问名称、真实 geometry、Canvas CSS/backing store、console/pageerror 和资源计数；截图只作补充。
- 覆盖 1024/1280/1920、代表性 DPR、reduced motion、键盘与 pointer；E6 执行本地 MP3/WAV/FLAC。

### Manual Compensation

- 原生 OS 工程 picker 的文件选择、取消、权限和保存覆盖提示。
- 浏览器原生 `beforeunload`/刷新/关闭提示。
- Chrome/Edge 辅助技术朗读、焦点顺序和长会话体感。

不能自动化的项目必须记录浏览器版本、步骤、结果和残余风险；自动化 OPFS 或模拟 dialog 不能替代原生签字。

## 4. Milestone Test Matrix

| Milestone | Unit focus | Integration focus | Chrome E2E | Edge |
| --- | --- | --- | --- | --- |
| E1 | codec/validator/identity | lease/draft/import/autosave | route、Tooltip、循环、恢复、失败 | E6 全量 |
| E2 | geometry/tempo/BPM | Worker stale、viewport persistence | waveform、zoom/pan/seek、grid | E6 全量 |
| E3 | snapping/point/cleanup | lane/class/visible DOM | mouse、right-click、keyboard point | E6 全量 |
| E4 | adapter/overlay bounds | consumer/cache/dedupe/error | 21 项、手柄、pointer-through | E6 全量 |
| E5 | range/overlap/handles | JSON/draft/rollback | create/cancel/drag/delete/keyboard | E6 全量 |
| E6 | full regression | stress/resource/recovery | full + native manual | full + native manual |

每个里程碑同时回归与其变更相邻的 Analyzer 播放、session、Worker、route、Canvas 和资源契约。E6 运行 E1–E6 全量及 M3–M11 关键回归，不必篡改历史 canonical 身份。

## 5. Fixture and Golden Plan

### Tempo PCM

- silence：必须 low-confidence。
- 固定种子噪声：必须 low-confidence。
- 歧义节奏：两个候选优势小于 0.08，必须 low-confidence。
- 60、100、128、127.5 BPM：估计误差不超过 `max(0.5 BPM, target × 1%)`。
- 算法返回实际脉冲间隔，不把结果任意折半或加倍到偏好区间。

### Annotation PCM

版本化 golden 配合运行时 WAV，包含稳定节拍、短音、长音色、效果区间、瞬态、静音和非整 frame 尾部。golden 固定歌曲 hash、tempo、预期 point/range 时间窗、overlay 对齐锚点与 round-trip 结果；不使用用户私有音频。

### Stress Data

E6 运行时生成约 15 分钟工程：20 lanes、每 lane 最多 8 inner classes、合计 10,000 point/range events，包含 viewport 内外、相邻 range、不同分类重叠和尾部边界。不提交大型 WAV、工程 artifact 或 trace，只登记生成参数、seed、命令和 artifact hash。

## 6. BPM Golden Method

- 使用固定 hop/frame 参数生成正向频谱差 onset envelope，再做归一化 autocorrelation。
- 候选限制 20–300 BPM；`confidence >= 0.65` 且第一/第二候选优势 `>= 0.08` 才返回 reliable。
- stale、cancel、用户已编辑或不再是唯一空 segment 时，即使算法 reliable 也不得写入。
- 参数若因 golden 校准改变，必须先更新 execution plan、AC-E205/E206 与 R-026，再由 owner 复核。

## 7. Performance and Resource Method

- 输入反馈：在分析、绘制、autosave 与 10,000 事件同时存在时，对 zoom、pan、seek、创建、拖动、换分类和 overlay 操作测量输入到可见反馈，门禁为 `<=100ms`。
- 长任务：使用 PerformanceObserver/trace 归因 Editor 与分析工作；单个主线程任务不得 `>50ms`。
- Geometry：对固定时间读取波形、grid、point/range、overlay 的实际 x，任意两层差不得 `>1 CSS px`。
- DOM：统计 viewport 可见事件节点，滚动/zoom 后不可按全工程 10,000 项一次性实例化。
- Resource：Chrome/Edge 各执行 20 次 Editor/Analyzer/Home、换歌与 overlay 生命周期；AudioContext、Worker、RAF、Canvas、Object URL、Observer 和 listener 不得单调累积。

## 8. Planned Commands and Evidence Cadence

E1–E6 每个里程碑计划新增：

```text
npm run test:eN:unit
npm run test:eN:integration
npm run test:e2e:eN
npm run eval:eN:provisional
npm run eval:eN
```

E1/E2 命令已经存在、通过 clean canonical 并获批准。E3 当前开放，E4–E6 仍不存在。新增脚本必须让 package、测试 README、本项目 Skill 与实际 runner 一致，不保留指向不存在文件的兼容别名。

固定流程：

1. 实现并运行最快 unit/integration/E2E。
2. dirty worktree 运行 `eval:eN:provisional`；它只提供反馈。
3. 提交实现，确认 HEAD clean。
4. 运行 `eval:eN`；runner 必须在 dirty worktree 拒绝启动。
5. 登记 run ID、commit、浏览器/Node/硬件、步骤、性能、日志与 summary SHA-256。
6. owner 完成人工任务并批准 evidence 后，才开放下一里程碑。

每个 canonical 至少包含适用 unit/integration/browser、文档检查、deliberate failure、typecheck、build 和 `git diff --check`。大型 artifact 本地保留到审批完成，Git 只登记身份与 hash。

## 9. Current Planning Gate

`project-owner` 于 2026-08-26 批准本文并开放 E1，随后批准 E1 canonical/人工结果并开放 E2；2026-08-27 又批准 E2 结果并开放 E3。现在只创建 E3 测试源码、fixture、npm 命令和 quality evidence；不得提前创建 E4–E6 实现或把 E1/E2/Analyzer 历史通过泛化成 E3 通过。
