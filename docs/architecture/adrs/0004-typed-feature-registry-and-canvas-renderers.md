---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-21
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "M7 renderer 已批准；M8 泛化 scalar-line 并验证累计 16 项"
---

# ADR-0004: Typed Feature Registry and Canvas 2D Renderer Families

## Context

`src/data/analyzerData.ts` 列出 21 个 Meyda 特征，但输出包含标量、频率向量、类别向量、波形、Loudness 对象和 Complex Spectrum。逐项手写页面会重复选择、范围、维度、缓存和无障碍逻辑；一个通用 renderer 又无法正确表达所有 shape。

## Decision

- 建立穷尽的类型化 `FeatureRegistry`，每项定义 Meyda key、输出 shape、renderer、范围、标签、依赖和维度。
- 活动卡用 0–3 slot 和唯一 `FeatureId` 表示；最多四张。
- 使用六个 renderer 家族：scalar、frequency vector、category vector、waveform、loudness structure、complex spectrum。
- Canvas 2D 绘制高频数据、热图、波形、游标和网格；DOM 提供标题、说明、固定参数、精确值、按钮、焦点和替代信息。
- 所有 renderer 接收相同 `TimelineViewport`，不得维护私有时间轴或 AudioContext。
- Analyzer 不新增 Three.js。
- 每项同时登记 `deliveryMilestone` 与 Worker 支持状态；M6 只支持 RMS、Energy、Amplitude Spectrum、Chroma，21/21 registry coverage 不等同于 21 项产品完成。
- Meyda 5.6.3 的 Complex Spectrum real/imag 各为 1024，不沿用 amplitude/power spectrum 的 512 维；其余固定维度由 registry contract 统一提供。

## Consequences

### Positive

- 新特征按 registry + renderer + tests 接入，21 项覆盖可以自动检查。
- 卡片选择、换卡、共享缩放和缓存身份不依赖具体图表。
- Canvas 满足热图/多卡性能，DOM 保留语义和键盘交互。

### Negative

- renderer family 仍需分别处理范围、维度、量化和精确值。
- Canvas 图表必须额外提供非颜色编码和 DOM 数据摘要。
- Complex Spectrum 和 Loudness 需要专门的结构契约，不能强行转成标量。

## Alternatives

- 21 个独立组件：拒绝，重复基础交互并容易产生行为漂移。
- 一个万能 renderer：拒绝，无法同时正确表达时间序列、频谱、类别和结构对象。
- 全部使用 SVG/DOM：拒绝，多卡时频热图的节点和重绘成本过高。
- 使用 Three.js：拒绝，对批准的 2D 分析图没有必要，并增加 bundle 和资源风险。

## Validation

- TypeScript exhaustiveness 和 registry coverage 测试保证 21/21 key。
- 每个 family 有 payload/renderer 契约测试与视觉基线。
- 首批 RMS、Amplitude Spectrum、Chroma 证明 scalar、frequency-vector、category-vector 三条纵向路径。
- 键盘、焦点、DOM 精确值、非颜色图例和 reduced motion 场景通过。

## Approval

由 `project-owner` 于 2026-07-24 随系统计划批准。
