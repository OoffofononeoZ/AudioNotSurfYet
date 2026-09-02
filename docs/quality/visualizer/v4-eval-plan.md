---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/delivery/visualizer/execution-plan.md"
  - "docs/delivery/visualizer/acceptance-criteria.md"
  - "docs/delivery/visualizer/test-strategy.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
  - "docs/architecture/risk-register.md"
next_action: "按 DEC-041 实施 Cube Swarm、默认两项分析绑定、确定性 rise/orbit 与同 host context recovery"
---

# Visualizer V4 Eval Plan

## Boundary

本计划评价 `cube-swarm@1`、默认 Amplitude Spectrum/Energy 绑定、确定性上升/轨道运动、单 RendererHost context recovery 与资源释放。V4 不修改 Visualizer JSON V1，不实现 WebM、录制锁或第二条音频链路，不增加 Canvas、WebGLRenderer、Worker、AudioContext、视觉 RAF、依赖、纹理或远端资产。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V4-EV-DEFAULT | Cube 默认绑定与分析预算 | success + boundary | registry unit + controller integration + Chrome | `centerSpectrum=amplitudeSpectrum/default/full`、`riseSpeed=energy/scalar`；其他参数 constant；active set 恰为两项 | AC-V401；R-035/R-037 |
| V4-EV-CORE | 64 方块中心频谱环与 coreScale | success + boundary | versioned state golden + pure unit + Chrome | 任意向量稳定分为 64 段；空/坏值降级；频谱只改变核心实例；coreScale 使用批准映射 | AC-V401/V402；R-037 |
| V4-EV-RISE | seed 外围布局与 Energy 上升 | success + exception | golden + property/unit | `cubeCount` 只控制外围数量；rise 使用固定 60Hz 积分/一秒 checkpoint，同时间状态一致 | AC-V401/V403；R-037 |
| V4-EV-ORBIT | 三卫星 constant/rebound orbit | success + boundary | unit + Editor/analysis fixture + Chrome | 默认 `0.3 rad/s` 不随音频变化；显式改绑后只改变轨道积分；三半径/倾角固定 | AC-V402/V403；R-036/R-037 |
| V4-EV-ISOLATION | spectrum、drum、Energy、orbit 和 constant 参数隔离 | success + failure | state-diff unit + Chrome | 每个输入只改变声明的 state；binding-local loading/error 使用 descriptor 默认值且 inspector 保留错误 | AC-V401/V402；R-035–R-037 |
| V4-EV-DETERMINISM | 连续播放、direct seek、刷新、暂停与录制前视图 | success + exception | frame-state hash + Chrome | 相同工程/fixture/时间/binding revision 的 hash 完全一致；不读取 RAF delta | AC-V403；R-037 |
| V4-EV-RESOURCE | InstancedMesh、geometry、material、scene 与 host 生命周期 | lifecycle + performance | fake renderer counters + 20 次模板/route Chrome | 一个 Canvas/host/renderer/RAF；共享 geometry 与两个 material 各 dispose 一次；无资源单调累积 | AC-V404；R-038 |
| V4-EV-CONTEXT | WebGL context lost/restored/failure | failure + exception | host integration + `WEBGL_lose_context` Chrome | loss 暂停绘制但保留工程/transport；restore 在同 renderer 内重建 scene 并绘制当前绝对时间；失败不创建第二 host | AC-V405；R-039 |
| V4-EV-RESPONSIVE | 1024/1280/1920、DPR、resize、键盘和文字状态 | boundary + accessibility | Chrome DOMRect/backing-store/keyboard | 16:9 误差 `<=1 CSS px`、DPR `<=2`、相机 aspect 正确、恢复/错误不只靠颜色 | AC-V406；R-038/R-039 |
| V4-EV-PERFORMANCE | 逐帧实例更新与交互反馈 | performance + regression | PerformanceObserver + Chrome metrics | 设置反馈 `<=100ms`；无 Visualizer 归因 frame 工作 `>50ms`；console/pageerror 为 0 | AC-V403/V404/V406；R-037–R-039 |
| V4-EV-REGRESSION | V3 30 步基线与 V4 四专项 | regression | 34-step canonical | V4 golden、unit、integration、Chrome 及 V3 30 步全部通过；clean identity 起止一致 | AC-V401–V406；R-034–R-039 |

## Canonical Rule

- `fixtures:v4:golden` 校验版本化 WAV、Editor drum fixture 与 renderer-neutral Cube state golden；`test:v4:unit`、`test:v4:integration`、`test:e2e:v4` 分别覆盖纯状态、所有权/context 和真实 Chrome。
- `eval:v4:provisional` 允许 dirty worktree，只作为实现反馈；`eval:v4` 只在 clean implementation commit 上运行。
- V4 canonical 固定为 V3 的 30 步前向回归，加 V4 golden、unit、integration、Chrome 四步，共 34 步。
- evidence 必须登记 implementation commit、run ID、环境、默认 active set、state hash、context loss/restore、资源/反馈/长任务、日志和 summary SHA-256。
- canonical 通过后 evidence 保持 `in-review`、V4 保持 `In Progress`、R-039 保持 `Open`、V5 保持 `Planned`，直到 owner 完成人工验收并明确批准。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| 最终 Cube 构图和运动审美不能由 state hash 表示 | hash 固定语义和几何，不替代人的视觉判断 | 自动化全绿仍可能不满足视觉预期 | owner 在最新版 Chrome 检查核心环、外围上升、卫星轨道和参数隔离 | project-owner |
| context loss 自动化使用浏览器扩展 | 可重现软件注入不覆盖全部 GPU/驱动故障 | 特定驱动恢复可能不同 | Chrome 注入 + 明确错误层 + V6 Chrome/Edge 长会话复核 | project-owner |
| 当前没有正式 CI | canonical 为本地流程 | 环境漂移不会自动触发 | 记录 Chrome/Edge/Node/npm/Three.js/硬件与 artifact hash | project-owner |
