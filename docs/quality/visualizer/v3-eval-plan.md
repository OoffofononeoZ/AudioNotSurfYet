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
next_action: "V3 30/30 clean canonical 与人工验收已获 owner 批准；作为 V4 34 步 canonical 的回归基线"
---

# Visualizer V3 Eval Plan

## Boundary

本计划评价 V3 第一个真实场景 `orthogonal-lines@1`、唯一 `VisualizerRendererHost`、确定性余辉和 scene 错误隔离。V2 resolver 是已批准输入事实；V3 不修改 JSON V1，不实现 Cube Swarm/WebM，不增加第二个 Canvas、Renderer、Worker、AudioContext 或播放时钟。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| V3-EV-MAPPING | enabled、intensity、color、thickness、brightness、decay 到横/竖线状态 | success + boundary | versioned scene golden + pure unit | intensity 规范到 0–1；长度、alpha、CSS px thickness、halo 与参数契约完全一致 | AC-V301；R-037 |
| V3-EV-ISOLATION | horizontal/vertical 独立参数域与中心加法交点 | success + failure | pure unit + Chrome | 修改任一方向只改变该方向 state；交点不回写另一方向值 | AC-V301/V303；R-037 |
| V3-EV-SOURCES | constant、analysis、Editor whole lane/inner class、point/range 与未绑定提示 | success + boundary + failure | V3 fixture + unit + Chrome | point 先沿用 V2 120ms release；range 遵守 `[start,end)`；默认 constant 0 显示数据源提示 | AC-V302；R-036/R-037 |
| V3-EV-TRAIL | 固定 60Hz `max(I, previous * exp(-4*dt/decay))` 与一秒 checkpoint | boundary + exception | golden + property/unit | decay 0 无余辉；一个 decay 秒后约 2%；checkpoint 按 track/template/binding revision 隔离 | AC-V301/V304；R-037 |
| V3-EV-DETERMINISM | 连续播放、seek、刷新和暂停单帧 | success + exception | frame-state hash + Chrome | 同一工程/歌曲时间 hash 完全一致；不读取 RAF delta；视觉响应偏差 `<=50ms` | AC-V304；R-037 |
| V3-EV-HOST | 单 Canvas、WebGLRenderer、视觉 RAF 与共享 resolved map | lifecycle + regression | fake renderer integration + browser counters | 同帧只调用一次 `resolveParameters(time)`；scene 与 inspector 收到同一 map；暂停按需单帧 | AC-V304/V305；R-038 |
| V3-EV-SWITCH | Orthogonal Lines 与 V4 中性 Cube Swarm 预览切换 | success + boundary | integration + Chrome | 旧 scene geometry/material dispose；保留同一 host/renderer/canvas；中性状态不报 renderer error | AC-V305；R-038 |
| V3-EV-ERROR | scene render/create 异常与重试 | failure + exception | fault injection + Chrome | 错误层可重试；transport、模板、工程导入导出和草稿继续可用；重试先 dispose 旧 scene | AC-V305；R-038 |
| V3-EV-RESPONSIVE | 1024/1280/1920、DPR、resize、键盘与 reduced motion | boundary + accessibility | Chrome DOMRect/backing-store/keyboard | 16:9 误差 `<=1 CSS px`；DPR `<=2`；装饰过渡关闭但主动播放响应保留 | AC-V301–V305；R-038 |
| V3-EV-RESOURCE | 20 次模板/路由循环与主线程任务 | lifecycle + performance | Chrome counters + PerformanceObserver | 始终一个 Canvas/host/renderer/视觉 RAF；无 Visualizer 归因任务 `>50ms`；console/pageerror 为 0 | AC-V305；R-038 |
| V3-EV-REGRESSION | V2 26 步基线与 V3 四个专项 | regression | 30-step canonical | V3 golden、unit、integration、Chrome 及 V2 26 步全部通过；clean identity 起止一致 | AC-V301–V305；R-034–R-038 |

## Canonical Rule

- `fixtures:v3:golden` 校验版本化 fixture 与 renderer-neutral scene golden；`test:v3:unit`、`test:v3:integration`、`test:e2e:v3` 分别覆盖纯状态、所有权/故障和真实 Chrome。
- `eval:v3:provisional` 允许 dirty worktree，只作为实现反馈。
- `eval:v3` 只在 clean implementation commit 上运行，固定为 V2 的 26 步基线加 V3 golden、unit、integration、Chrome，共 30 步。
- evidence 登记 implementation commit、run ID、环境、视觉同步、frame-state hash、反馈/长任务、资源计数、日志和 summary SHA-256。
- V3 evidence 与人工验收已获 owner 批准；V4 已开放，V3 契约继续作为前向回归基线。

## Implementation Candidate Signal

2026-09-02 最终 dirty-worktree provisional `V3-2026-09-02T13-25-25-465Z-75cbf292-provisional` 按固定 30 步全部通过，summary SHA-256 为 `20452afedc68ab351647464c3e6c3335e1e6def0290c2ba1d35105004648a46d`。该 run 只证明当前未提交候选具备进入 implementation commit 的条件，不是 canonical evidence。

该轮 Chrome 自动观测：画面反馈 `1.10ms`、设置反馈 `2.20ms`、中心像素 `[31,215,109,255]`、最大 Visualizer frame 工作 `7.10ms`；20 次 route 循环末尾为 1 Canvas、1 active host、1 active renderer、0 pending visual RAF，scene created/disposed 为 21/20，target resolve/rendered frame 为 47/47。数值只绑定该 provisional 环境，不代替 owner 最终视觉验收。

## Canonical Candidate Signal

Implementation commit `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` 上的 clean canonical `V3-2026-09-02T13-32-42-513Z-89be30eb` 按固定 30 步全部通过，起止工作树均干净，summary SHA-256 为 `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84`。正式记录见 evidence index，并于 2026-09-03 获 owner 批准。

该轮 Chrome 自动观测：画面反馈 `1.10ms`、设置反馈 `2.30ms`、中心像素 `[31,215,109,255]`、最大 Visualizer frame 工作 `3.40ms`；20 次 route 循环末尾为 1 Canvas、1 active host、1 active renderer、0 pending visual RAF，scene created/disposed 为 21/20，target resolve/rendered frame 为 51/51。`project-owner` 于 2026-09-03 明确批准 canonical evidence、Orthogonal Lines、确定性余辉与单 RendererHost；V3 据此为 `Complete`，R-037/R-038 为 `Mitigated`，V4 开放。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| shader 最终视觉审美不能由 state hash 完整表示 | golden 固定状态与几何，不以跨平台像素截图为唯一事实 | 自动化通过不等于视觉选择被接受 | owner 在最新版 Chrome 完成 V3 人工清单并批准 | project-owner |
| 浏览器/显卡长期 WebGL 资源观察有限 | 自动化只执行受控 20 次循环 | 驱动或长会话可能暴露额外泄漏 | counters + console + owner DevTools 长会话复核；V6 双浏览器重跑 | project-owner |
| 当前没有正式 CI | canonical 为本地流程 | 环境漂移不会自动触发 | 记录 Chrome/Node/npm/Three.js/Meyda/硬件与 artifact hash | project-owner |
