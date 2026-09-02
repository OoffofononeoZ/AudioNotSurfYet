---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v4-eval-plan.md"
  - "docs/quality/visualizer/v4-golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "V4 context/renderer 故障注入与 34/34 clean canonical 已通过；等待 owner 人工验收"
---

# Visualizer V4 Failure Taxonomy

V1–V3 的 route、project、binding、resolver、host、scene、responsive 与 performance 分类继续用于前向回归；V4 新增 Cube state、积分和 context 域。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| V4FT-DEFAULT | 默认绑定/预算 | Cube 默认绑定不是 Spectrum+Energy、active set 不是恰好两项或导入绑定被覆盖 | V4-EV-DEFAULT | 阻断 V4；修复 descriptor/controller seam，不升级 JSON |
| V4FT-CORE | 核心频谱几何 | 64-band 分段、log 规范、环几何、coreScale 或 coreColor 不符合 DEC-041 | V4-EV-CORE/ISOLATION | 阻断 V4；修复纯 state 映射并重跑 golden |
| V4FT-RISE | 外围布局/上升 | cubeCount 所有权、seed 布局、速度积分、wrap 或 peripheralColor 错误 | V4-EV-RISE/ISOLATION | 阻断 V4；禁止改用 frame delta |
| V4FT-ORBIT | 卫星轨道 | 卫星数量/半径/倾角错误、默认受音频影响或改绑污染其他域 | V4-EV-ORBIT/ISOLATION | 阻断 V4；恢复三卫星独立积分 |
| V4FT-DETERMINISM | 状态确定性 | 播放、seek、刷新、暂停同时间 hash 不同 | V4-EV-DETERMINISM | 阻断 V4；修复 60Hz checkpoint 与 identity |
| V4FT-RESOURCE | Three.js 资源 | InstancedMesh、geometry、material、scene、RAF、listener 或 renderer 单调累积 | V4-EV-RESOURCE | 阻断 V4；恢复共享资源和对称 dispose |
| V4FT-CONTEXT | WebGL context | loss 未停止绘制、破坏工程/transport、restore 错时或创建第二 host/renderer | V4-EV-CONTEXT | 阻断 V4；保持唯一 host，恢复失败进入错误层 |
| V4FT-RESPONSIVE | 几何/无障碍 | 16:9、DPR、camera aspect、抽屉、键盘或文字状态错误 | V4-EV-RESPONSIVE | 修复并重跑三视口/DPR/键盘矩阵 |
| V4FT-PERFORMANCE | 响应/长任务 | 设置反馈超 100ms、frame 工作超 50ms 或 console/pageerror 非零 | V4-EV-PERFORMANCE | 阻断对应门禁；定位逐帧分配或实例更新 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 第二 AudioContext/Worker/renderer、工程损坏、context failure 后错误成功或跨 route 失控 | 立即停止 canonical，不得豁免 |
| S1 | 默认两项分析、Cube 核心视觉、确定性、单 host/context recovery 或资源释放不可成立 | 阻断 V4 |
| S2 | 可恢复参数、状态文案、布局、键盘或单项视觉反馈缺陷 | 修复并复跑相关层，按影响决定全量重跑 |
| S3 | 不改变场景事实的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高等级问题 |

## Evidence Recording

所有 pre-canonical 失败保留类型、严重度、复现、修复和重跑结果。测试编排等待不足只在证明产品状态正确后归类为 harness timing；context、hash、资源或视觉断言失败不得通过延长等待掩盖。

首次 clean run `V4-2026-09-02T17-42-53-826Z-95817304` 的唯一失败是 V2 Edge strict locator 同时命中状态文案与按钮；产品状态、V4 context/hash/resource 断言没有失败。该 artifact 保留为 harness selector failure；commit `5c2d24a3f1f413dba236563b3686237c6b8f2e21` 收窄 locator 后，V2 Edge 3/3 与 V4 clean canonical 34/34 均通过。受控 `WEBGL_lose_context` 注入产生的浏览器平台级 `CONTEXT_LOST_WEBGL` warning 是预期信号，不计为应用 console failure；其他 console/pageerror 仍必须为 0。
