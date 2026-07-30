---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-30
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "由 owner 结合 M6 canonical 复核 PCM copy/revision 与唯一 AudioEngine 时钟边界"
---

# ADR-0001: Single AudioEngine and Shared Session State

## Context

当前音频加载与播放集中在 `src/audio/audioLoader.ts`，MusicBar 同时直接提取能量。Analyzer 需要共享播放、跳转和游标；如果每个页面创建自己的 AudioContext 或持有 AudioBuffer，会产生不同步时钟、重复解码和不明确的资源清理责任。

## Decision

- 应用只有一个实时 `AudioEngine`，独占 AudioContext、当前 AudioBuffer、BufferSource、AnalyserNode 和 GainNode。
- `audioSessionStore` 保存队列、当前歌曲、序列化的 `PlaybackSnapshot`、分析卡和 UI 快照，不持有 AudioBuffer、AudioNode、File、Blob 或 Worker。
- UI 通过命令调用 engine；engine 发布事实快照。播放时间始终从 AudioContext 基准计算。
- AnalysisCoordinator 从 engine 获取 PCM 副本，不共享或修改播放中的 AudioBuffer。
- 换歌、清空和销毁具有显式 dispose，旧 source、node、RAF 和对象 URL 必须释放。
- M4 的 runtime File 与封面对象 URL 由 MainLayout-owned `AudioSessionService` 在 store 外管理；音频解码直接读取 ArrayBuffer，不创建音频对象 URL。
- 快速切歌使用 generation 使最后命令生效；非空队列追加文件不得中断当前播放。
- metadata 失败使用文件名和默认封面继续解码；decode/unsupported 失败写入 typed snapshot error，由 UI 显示非阻塞消息。

## Consequences

### Positive

- MusicBar 与 Analyzer 使用相同歌曲、时钟和 seek 结果。
- 播放资源所有权与测试边界清晰。
- store 可安全持久化和调试。

### Negative

- 需要迁移当前 MusicBar/audioLoader 的职责，并建立回归测试。
- engine 命令与快照必须处理 AudioContext suspended、source 单次使用和竞态。

## Alternatives

- 各页面独立 engine：拒绝，因为无法可靠共享游标和资源生命周期。
- 把 AudioContext/AudioBuffer 放进 Pinia：拒绝，因为非序列化资源会污染状态、持久化和热更新。
- 保持 MusicBar 拥有播放并由 Analyzer 订阅 DOM 事件：拒绝，因为 UI 组件不应成为基础设施边界。

## Validation

- 引擎/store 单元与集成测试覆盖 load、play、pause、seek、ended、换歌、错误和 dispose。
- 浏览器测试证明 MusicBar 现有播放、队列和能量响应不回归。
- 播放、暂停和 seek 后共享游标偏差不超过 100ms。

## Approval

由 `project-owner` 于 2026-07-24 随系统计划批准。

`project-owner` 于 2026-07-28 通过批准 M4 实施计划，明确批准最后操作生效、非空追加不中断、metadata fallback 和非阻塞解码错误等运行策略。
