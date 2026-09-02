---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "V4 34/34 clean canonical 已验证 Cube 确定性、同 host context recovery 与资源对称性；等待 owner 人工验收"
---

# ADR-0016: Deterministic Scene Registry

## Context

实时预览、seek、刷新和从 0 秒录制必须在同一时间得到同一视觉结果。常见 Three.js 动画依赖 RAF delta 和可变随机数，直接使用会让 seek 后状态与连续播放不同，也难以验证录制。

## Decision

- `SceneRegistry` 首版只注册 `orthogonal-lines@1` 和 `cube-swarm@1`，穷尽声明参数、类型、范围、可绑定来源和 renderer factory。
- 一个 `VisualizerRendererHost` 独占一个 Canvas、一个 Three.js WebGLRenderer 和一个可取消 RAF；scene 只拥有并 dispose 自己的 scene/camera/geometry/material。
- binding smoothing、粒子布局、rise 与 orbit 只由 project seed、绝对歌曲时间和版本化算法决定。可重放 checkpoint 允许直接 seek 得到与从 0 连续播放相同状态；禁止依赖前一 RAF delta。
- WebGL context restore 重建同一模板并从当前绝对时间恢复；录制期间 context loss 终止并丢弃未完成文件。
- V3 Orthogonal Lines 的 scene-local 余辉固定为 60Hz、一秒 checkpoint 和 `max(I,current*exp(-4*dt/decaySeconds))`；identity 包含歌曲、template 和 binding revision。该状态不改写 V2 resolver，也不依赖 RAF delta。

## Consequences

- Positive：预览、seek、刷新和 recording 可以通过同一逐帧状态 golden 比较。
- Negative：场景作者不能随意使用 frame-local mutation；某些粒子效果需要闭式公式或确定性 checkpoint。
- Failure boundary：scene dispose 或 context restore 失败时保留工程与 transport，但不得创建第二 host；确定性失败阻断对应模板交付。

## Alternatives Rejected

- 用 RAF delta 累计所有运动：seek/后台节流后不可复现。
- 每个模板创建 renderer/RAF：切换时易泄漏，无法维持单画布录制。
- 外部可执行模板：扩大安全、兼容和资源边界，超出 V0。

## Approval

`project-owner` 于 2026-09-02 批准 Visualizer V0 system design、接口契约、R-034–R-041 与 ADR-0014–0017。本 ADR 据此为 `approved`。V3 已通过实现、canonical 与 owner 审批；V4 clean canonical 34/34 已通过并登记为 `in-review`，仍待 owner 人工审批。
