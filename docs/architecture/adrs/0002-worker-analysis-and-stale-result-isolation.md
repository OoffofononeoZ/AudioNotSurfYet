---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "建立 Worker 契约测试、合成 PCM 黄金测试和 job generation 隔离"
---

# ADR-0002: Worker Full-Track Analysis and Stale Result Isolation

## Context

最长约 15 分钟的全曲 Meyda 提取会处理大量 frame。若在主线程执行，无法满足输入反馈和长任务要求；若把逐 hop 的所有频谱返回并缓存，会产生过大的 IPC、内存和 IndexedDB 数据。Worker 取消也可能晚于换歌或换卡，不能单独保证正确性。

## Decision

- `AnalysisCoordinator` 把平均混合的 mono PCM 副本作为 transferable 发送给专用 Worker。
- Worker 只计算当前最多四个不重复的活动特征，并复用同一 frame 的依赖中间值。
- Worker 按批次处理 frame、报告进度、让出事件循环并检查取消。
- 显示数据在 Worker 内聚合为最多 30Hz；向量/类别数据使用带 scale/offset 的紧凑 typed array。
- 精确游标值针对原始 frame 按需重新提取，不依赖量化展示值。
- 结果身份为 `trackHash + configHash + featureId`。
- coordinator 用递增 generation 和完整身份匹配隔离迟到 progress/result/error。取消是资源优化，身份检查才是正确性边界。

## Consequences

### Positive

- 主线程保留交互和 Canvas 调度能力。
- 缓存规模与四卡使用量相关，而不是与 21 项总数相关。
- 快速换歌、换卡或参数变化不会污染当前 UI。

### Negative

- Worker 消息、typed array 传输、进度和错误路径增加实现复杂度。
- 精确游标请求需要保留或重建可分析 PCM，并处理快速移动时的请求合并。
- 聚合和量化必须有独立黄金测试，避免视觉结果失真。

## Alternatives

- 主线程分析：拒绝，不能满足响应 guardrail。
- Worker 一次计算全部 21 项：拒绝，计算和缓存与当前需求不成比例。
- 只发送 cancel、不检查身份：拒绝，Worker 消息与计算不能保证即时停止。
- 保存逐 hop 原始频谱：拒绝，15 分钟输入会造成不必要的数据膨胀。

## Validation

- silence、正弦、双音、impulse 黄金结果与直接 Meyda 提取在批准容差内一致。
- 快速换歌、换卡、销毁测试证明 stale 消息不进入 store。
- 最大支持时长 trace 证明输入反馈在 100ms 内，且无分析归因主线程任务超过 50ms。
- 聚合/量化 round-trip、饱和和精确游标测试通过。

## Approval

由 `project-owner` 于 2026-07-24 随系统计划批准。
