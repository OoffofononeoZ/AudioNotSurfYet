---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "由 project-owner 审批通用 route playback lease 与 Visualizer analysis consumer"
---

# ADR-0014: Visualizer Runtime Leases

## Context

Editor 已通过 tokenized lease 临时把唯一 AudioSessionService 的 ended 行为改为 repeat-one，并与 Analyzer 互斥使用唯一 AnalysisCoordinator。Visualizer 需要同一歌曲、同一时钟与同一 Worker，但播放结束应暂停，场景绑定需要最多四项去重特征。

## Decision

- 把 Editor 专用 playback lease 泛化为 `RoutePlaybackLease`，consumer 为 editor/visualizer，ended policy 为 repeat-one/pause-at-end。只有当前 token 可释放；离开有效 route 恢复普通 queue-next。
- V1 原子迁移 Editor 到通用接口，不保留长期 Editor compatibility adapter。
- `AnalysisConsumer` 增加 visualizer。Visualizer binding planner 在 Coordinator 前把 FeatureId 去重并限制为 0–4；第五项拒绝，不能创建第二 consumer/Worker 绕过。
- Visualizer 从 compact AnalysisSeries 按 AudioContext 绝对时间取值，不建立 exact cursor 轮询。所有旧 route/generation/template/binding response 丢弃。

## Consequences

- Positive：Editor、Visualizer、Analyzer 共享一个 AudioEngine、播放时钟、Coordinator、Worker 和 cache identity。
- Negative：迁移会触及已批准 Editor runtime；V1 必须回归 repeat-one、refresh paused、MusicBar 显隐与离页 queue-next。
- Failure boundary：旧 token 不能改变新 route；Visualizer ended 不能调用 next；第五项不能进入 Coordinator。

## Alternatives Rejected

- Visualizer 创建独立 audio element/AudioEngine：会产生第二时钟和音量所有权。
- Visualizer 创建独立 Worker/coordinator：会复制 PCM/cache 并破坏资源门禁。
- 永久保留 Editor adapter：会形成两套结束策略接口并扩大长期维护面。

## Approval

本 ADR 为 `in-review`。产品批准只开放架构设计；`project-owner` 批准完整 Visualizer system design 前不实现该迁移。
