---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
next_action: "在 E1/E4/E6 delivery 中验证 playback/analysis lease 与单 engine/Worker 边界"
---

# ADR-0006: Editor Route-Scoped Runtime Leases

## Context

Editor 需要隐藏 MusicBar、循环指定歌曲、请求 Buffer 与一个 overlay feature，并在离页后恢复正常队列。MainLayout 已拥有唯一 AudioEngine、播放 RAF、AnalysisCoordinator 和 Worker；复制运行时会制造时钟漂移、重复解码和资源泄漏。快速换歌/换路由还会让旧组件的迟到 cleanup 覆盖新页面。

## Decision

- MainLayout 继续创建唯一 AudioEngine、AudioSessionService、AnalysisCoordinator 和 Worker。
- AudioSessionService 提供带 token 的 Editor playback lease；当前 lease 把 ended policy 改为 repeat-one，释放只接受当前 token。
- AnalysisCoordinator 提供 route-scoped consumer lease；Analyzer 与 Editor 只有最新 lease 能设置活动特征、读取结果或释放意图。
- Editor 固定请求 Buffer 加至多一个 overlay feature，并在同一 retained PCM/Worker 上请求 tempo estimate。
- Header、播放列表和直接刷新分别遵循保留状态、显式播放和 0 秒 paused 的入口语义；无有效 track 时不获取 lease并保留 MusicBar。

## Consequences

- Positive：保持单时钟、单 AudioContext、单 Worker 和现有 cache/stale 边界；旧 cleanup 不会破坏新 route。
- Negative：Coordinator/Session API 需要引入 lease token，Analyzer 也需迁移到 consumer lease；Editor cache 可能替换 Analyzer 的当前 feature cache并导致返回后部分重算。
- Follow-up：E1 验证路由/循环/release，E2/E4 验证 retained PCM/tempo/overlay，E6 执行双浏览器与资源循环。

## Alternatives

- 独立 audio element/AudioEngine：拒绝，会产生第二时钟和资源所有权。
- 独立 Editor Worker/coordinator：拒绝，会复制 PCM 并绕过现有 identity/cancel。
- 依赖组件 mount 顺序直接 set/reset：拒绝，异步 cleanup 无 token，快速路由时存在竞态。

## Approval

`project-owner` 于 2026-08-26 批准本 ADR 并开放 E1–E6 execution planning；实现仍需等待 delivery 批准。
