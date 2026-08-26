---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/editor/project-format-v1.md"
next_action: "在 E1/E5/E6 delivery 中验证 JSON V1、hash 绑定和独立单草稿 IndexedDB"
---

# ADR-0007: Versioned Editor Project and Independent Draft Boundary

## Context

Editor 需要导入导出单曲标注并在刷新后恢复，但现有 `audionotsurfyet-session` V1 已由 Analyzer canonical 固定。把 Editor 工程塞入 session schema 会扩大事务与迁移爆炸半径；以名称作为 JSON key 或在导入时猜测损坏字段又会让重命名、重名和错误输入不可审计。

## Decision

- 首版使用 `format: 'audiosurf-editor'`、`schemaVersion: 1` 的 JSON，稳定 ID + ordered arrays，不以名称作为 identity。
- 工程以音频内容 SHA-256 和时长绑定歌曲；session track ID 不进入文件。同 hash 的重新导入可匹配，不同 hash 拒绝。
- JSON decode 执行严格 schema、引用、tempo、时间、唯一性和重叠校验；全部通过前不替换当前内存工程。
- Range 保存明确 `startSeconds`/`endSeconds`；时间规范为微秒精度。
- 草稿使用独立 `audionotsurfyet-editor` IndexedDB V1，只保存 `draft/latest` 与离页提示偏好；不升级 session DB。
- 内存先更新，repository 原子 replace；quota/abort 保留旧 durable draft并发布 `not-persisted`。

## Consequences

- Positive：工程可读、可版本化、导入原子且与 Analyzer schema 隔离；同曲恢复和异曲覆盖边界明确。
- Negative：未知 schema 不迁移；首版只有 JSON；同一时刻只保留一个 durable draft，跨歌曲编辑前必须人工处理旧草稿。
- Follow-up：E1 实现 codec/validator/repository，E5 完成 range round-trip，E6 验证 native picker、quota 和跨歌曲确认。

## Alternatives

- 写入 session IndexedDB V1：拒绝，会使 Analyzer 已验证事务与 Editor 草稿故障耦合。
- 名称作为 JSON key：拒绝，重名/重命名会破坏 identity 和顺序。
- 自动修复未知/损坏输入：拒绝，可能静默篡改用户数据。
- start + duration：拒绝，两端手柄和重叠校验以 start/end 更直接。

## Approval

`project-owner` 于 2026-08-26 批准本 ADR 并开放 E1–E6 execution planning；详细 schema 以 [Editor Project Format V1](../editor/project-format-v1.md) 为准。
