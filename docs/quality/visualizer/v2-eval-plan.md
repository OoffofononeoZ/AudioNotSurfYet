---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "V2 clean canonical 26/26 已登记为 in-review；owner 复核数据绑定、四特征边界、Editor snapshot 与 resolver 后决定是否开放 V3"
---

# Visualizer V2 Eval Plan

## Boundary

本计划评价 V2 数据绑定：constant、analysis、editor-event，0–4 唯一分析特征 planner，FeatureRegistry projection，同歌 Editor snapshot，固定变换顺序和绝对时间 resolver。V2 中间 Canvas 继续为中性预览；Orthogonal Lines、Cube Swarm、Three.js/WebGL 和 WebM 不在本计划内。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V2-EV-INSPECTOR | descriptor 驱动的 constant/analysis/editor-event 控件 | success + failure | registry unit + Chrome/Edge DOM inspection | 只出现 descriptor 允许的 source；无表达式、脚本或任意字段入口；非法候选不提交 | AC-V201；R-036 |
| V2-EV-PROJECTION | scalar/component/full/bin/band/mean/max/peak | success + boundary + failure | 21 项 registry golden + pure unit | shape、component、维度与 projection 穷尽匹配；越界和非有限值为 binding-local error | AC-V202；R-035 |
| V2-EV-PLANNER | 0–4、共享引用、第五项、最后引用释放 | boundary + failure | planner unit + coordinator integration + browser | 稳定 `FEATURE_IDS` 顺序；第五项在工程/Coordinator 前拒绝；共享只计算一次；最后引用同 revision 释放 | AC-V203/V204；R-035 |
| V2-EV-STALE | route、consumer、track、template、binding revision 竞态 | race + exception | fake coordinator + delayed completion | 旧结果不更新 active set、resolved value 或工程；离页只剩当前 consumer | AC-V204；R-035 |
| V2-EV-EDITOR | 同歌草稿、显式 reload、Editor JSON、移除 | success + failure | repository/codec integration + browser import | project snapshot 优先；错歌、损坏、悬空引用与取消原子保留现工程；无实时 DB 订阅 | AC-V205；R-036 |
| V2-EV-EVENT | whole lane、inner class、point、range | success + boundary | point/range golden + resolver unit | lane 为 OR/max；point 为一个 1/60s impulse；range 为 `[start,end)`；相邻端点不双激活 | AC-V206；R-036/R-037 |
| V2-EV-TRANSFORM | normalize、clamp、invert、smoothing、output | boundary + failure | pure unit + non-finite fault injection | 固定顺序；输入范围严格递增；full vector 拒绝非零 smoothing；输出有限且服从 descriptor | AC-V207；R-037 |
| V2-EV-DETERMINISM | 连续播放、seek、暂停、刷新 | success + exception | 60Hz resolver/checkpoint golden + Chrome/Edge | 相同工程、数据与时间的 resolved state canonical hash 完全一致 | AC-V208；R-037 |
| V2-EV-RESOURCE | 单 consumer/Worker/Canvas/播放时钟 | regression + lifecycle | diagnostic counters + 20 次 route/consumer 循环 | 无 exact-cursor 轮询、第二 Worker/Canvas/RAF；资源不单调累积 | AC-V203/V204/V208；R-035/R-038 |
| V2-EV-REGRESSION | V1、Analyzer/Editor consumer、docs/build | regression | 26-step canonical | V1 21 步基线与 5 个 V2 步骤全部通过；clean identity 起止一致 | AC-V201–V208；R-034–R-038 |

## Fixed Resolver Contract

- resolver quantum 为 `1/60s`，初态为歌曲 0 秒的 0。
- smoothing 使用指数响应：`alpha = tau <= 0 ? 1 : 1 - exp(-dt / tau)`；目标上升用 attack，下降用 release。
- 每 1 秒建立可重放 checkpoint；非整步目标时间从最近 checkpoint 重放并计算最后部分步长。
- point source 在一个 resolver quantum 内为 1；默认 transform 为即时 attack、120ms release。range 和 analysis 默认 attack/release 为 0，用户可修改。
- analysis 输入范围优先使用 registry 中有限且严格递增的 min/max，否则为 `0..1`；analysis/editor-event 输出默认从 descriptor 默认值到 descriptor 最大值。
- full vector 可逐分量投影/变换，但 attack/release 必须均为 0。
- Buffer 的 compact display series 只保留当前时间采样的 `[min,max]` envelope pair；V2 对该二元向量执行 full/bin/band/mean/max/peak，不轮询 Analyzer 的 1024-sample exact cursor。原始 1024-sample frame 仍只属于 Analyzer exact 数据，不在 Visualizer 工程中伪造。

## Canonical Rule

- `eval:v2:provisional` 允许 dirty worktree，只作为实现反馈。
- `eval:v2` 必须在 clean implementation commit 上运行，固定为 V1 21 步基线加 V2 golden、unit、integration、Chrome、Edge 共 26 步。
- evidence 登记实现 commit、run ID、环境、active feature/consumer、确定性 hash、反馈、资源、日志和 summary SHA-256。
- V2 evidence 在 owner 人工任务完成前保持 `in-review`；V3 不开放。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| 原生 Editor JSON picker 的取消/权限由 OS 拥有 | Playwright 只能用受控 picker/OPFS | 自动化不能证明全部原生对话框路径 | owner 在最新版 Chrome 检查选择、取消、错歌与损坏文件 | project-owner |
| V2 不绘制真实场景 | V3/V4 尚未开放 | resolved value 正确不等于最终视觉正确 | DOM resolved state + deterministic hash 固定数据语义；场景各自 canonical | project-owner |
| 当前没有正式 CI | canonical 为本地流程 | 环境漂移不会自动触发 | 记录浏览器/Node/npm/Meyda/硬件和完整 artifact hash | project-owner |
