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
next_action: "实现 V3 Orthogonal Lines、运行 30 步 provisional/canonical，并登记 owner 评审证据"
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
- V3 evidence 在 owner 人工验收与批准前保持 `in-review`；V4 不开放。

## Evidence Gaps

| Gap | Reason | Residual risk | Compensating verification | Owner |
| --- | --- | --- | --- | --- |
| shader 最终视觉审美不能由 state hash 完整表示 | golden 固定状态与几何，不以跨平台像素截图为唯一事实 | 自动化通过不等于视觉选择被接受 | owner 在最新版 Chrome 完成 V3 人工清单并批准 | project-owner |
| 浏览器/显卡长期 WebGL 资源观察有限 | 自动化只执行受控 20 次循环 | 驱动或长会话可能暴露额外泄漏 | counters + console + owner DevTools 长会话复核；V6 双浏览器重跑 | project-owner |
| 当前没有正式 CI | canonical 为本地流程 | 环境漂移不会自动触发 | 记录 Chrome/Node/npm/Three.js/Meyda/硬件与 artifact hash | project-owner |
