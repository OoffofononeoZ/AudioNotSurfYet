---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/v2-eval-plan.md"
  - "docs/quality/visualizer/v2-golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "用 V2 unit/integration/browser/canonical 为每类失败建立可复现信号；owner 批准前不关闭 V2"
---

# Visualizer V2 Failure Taxonomy

失败实例同时记录稳定的行为类型与独立严重度；V1 的 route/lease/project/draft 分类继续用于相邻回归。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| V2FT-INSPECTOR | descriptor/候选绑定 | UI 暴露未允许 source、提交不完整候选或部分改写工程 | V2-EV-INSPECTOR | 阻止提交，聚焦错误字段并保留原绑定 |
| V2FT-PLANNER | 特征预算/引用 | 第五项进入 Coordinator、共享特征重复或最后引用未释放 | V2-EV-PLANNER | 阻断 V2；恢复稳定去重与原子候选检查 |
| V2FT-PROJECTION | shape/component/projection | 错误分量、维度、索引、band、peak 或 full 语义 | V2-EV-PROJECTION | 隔离绑定并修复穷尽 registry 路由 |
| V2FT-STALE | generation/revision | 旧歌曲、consumer、模板或绑定结果覆盖当前状态 | V2-EV-STALE | 阻断 V2；修复 token/hash/revision 检查 |
| V2FT-EDITOR | Editor snapshot | 错歌、损坏、悬空引用、意外自动 reload 或移除仍被引用的数据 | V2-EV-EDITOR | 原子保留工程和旧 snapshot，显示恢复操作 |
| V2FT-EVENT | point/range/lane | impulse、半开端点或 OR/max 聚合错误 | V2-EV-EVENT | 阻断受影响 Editor binding golden |
| V2FT-TRANSFORM | 数值变换 | 顺序、范围、clamp/invert、smoothing 或有限值错误 | V2-EV-TRANSFORM | binding-local error；其他参数和 transport 保持可用 |
| V2FT-DETERMINISM | 绝对时间解析 | 播放、seek、刷新或重进在同一时间产生不同状态 | V2-EV-DETERMINISM | 阻断 V2；修复 checkpoint/replay，禁止 RAF delta |
| V2FT-RESOURCE | consumer/Worker/lifecycle | exact cursor 轮询、第二 Worker/Canvas/RAF 或 route 循环累积 | V2-EV-RESOURCE | 阻断 V2；恢复单 consumer 与对称 cleanup |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 错歌数据覆盖、工程/草稿损坏或跨 route runtime 失控 | 立即停止 canonical，不得豁免 |
| S1 | 四特征边界、projection、Editor 数据或确定性核心任务不可完成 | 阻断 V2 |
| S2 | 单参数可恢复错误、检查器可访问性或状态表达缺陷 | 修复并复跑相关层，按影响决定全量重跑 |
| S3 | 不改变绑定事实的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高等级问题 |
