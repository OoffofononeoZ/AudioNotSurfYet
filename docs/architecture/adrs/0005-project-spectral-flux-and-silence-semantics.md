---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-21
upstream_docs:
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/product/scope.md"
next_action: "M8 Worker/golden/renderer/clean canonical 已获批准；后续里程碑持续回归项目 Flux 并保留上游缺陷事实"
---

# ADR-0005: Project Spectral Flux and Zero-Energy Scalar Semantics

## Context

M8 要交付 13 个新增标量并达到累计 16/21。锁定的 Meyda 5.6.3 中，`spectralFlux` 引用未声明变量并使用不适合频谱通量的索引/输入，官方当前发布和主分支都不能提供可用升级路径。Meyda 对零能量帧的部分 spectral/perceptual 标量还会返回 `NaN`、`Infinity` 或没有学习意义的频率值，与仓库要求有限、可解释静音结果的验收冲突。

## Decision

- Meyda 继续锁定 5.6.3；不 fork、不 monkey-patch、不修改 `node_modules`。
- `spectralFlux` 由项目 Worker 实现 v1 公式：`sum(max(0, currentAmplitude[k] - previousAmplitude[k]))`。
- Flux 使用相邻 analysis frame 的幅度频谱；第一帧没有 previous frame，固定为 `0`。exact cursor 对非首帧同时读取当前与前一帧。
- 以同一 Hanning frame 的 energy 为零能量判据。零能量帧的全部 M8 标量统一输出 `0`，包括 Meyda 直接结果有限但无意义的情况。
- 非零能量帧若任何标量为 `NaN` 或 `Infinity`，按 `extract-failed` 显式失败；不得静默裁剪、替换或缓存。
- Flux 使用独立项目 golden；其余 12 项在非零能量输入上继续与直接 Meyda 5.6.3 比较。scalar payload 和缓存二进制 schema 保持不变。

## Consequences

- Positive：M8 不再受上游未发布修复阻断；公式、首帧和静音语义可独立审计；不会产生运行时依赖补丁。
- Negative：Flux 不是 Meyda 5.6.3 的直接输出，仓库需长期维护公式与 golden；未来改变公式必须显式版本化并使旧缓存失效。
- Follow-up：R-020 在代码、golden、cursor 和 clean canonical 通过前保持 Open；通过后只能表述为“产品侧缓解”，不能声称 Meyda 缺陷已修复。

## Alternatives

- 维护依赖补丁：拒绝；会把上游源码与打包差异变成长期维护面。
- 延期 Flux：拒绝；会让 M8 无法达到批准的 13 项和累计 16/21。
- 为静音增加 nullable/validity payload：当前不采用；它会升级缓存 schema，且与“显示安静状态而不是缺失数据”的既有目标不一致。

## Approval

`project-owner` 于 2026-08-21 在 M8 实施计划中选择项目内 Flux，并明确选择零能量标量统一为 0；随后要求执行完整计划。
