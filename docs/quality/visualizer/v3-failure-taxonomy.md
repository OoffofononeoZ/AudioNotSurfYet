---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v3-eval-plan.md"
  - "docs/quality/visualizer/v3-golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "V3 canonical 与 owner 人工门禁已批准；分类继续用于 V4 相邻回归"
---

# Visualizer V3 Failure Taxonomy

失败实例同时记录稳定的行为类型与独立严重度；V1/V2 的 route、lease、project、binding、projection、snapshot 和 resolver 分类继续用于相邻回归。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| V3FT-MAPPING | 视觉参数映射 | enabled、长度、alpha、CSS thickness、halo、颜色或中心交点不符合契约 | V3-EV-MAPPING/ISOLATION | 阻断 V3；修复纯 scene-state 映射并重跑 golden |
| V3FT-SOURCE | 数据源表现 | constant/analysis/point/range/lane/class 或未绑定提示错误 | V3-EV-SOURCES | 隔离绑定；保留工程/transport，修复 V2→V3 seam |
| V3FT-TRAIL | 余辉算法 | decay 单位、60Hz 公式、checkpoint 或隔离 identity 错误 | V3-EV-TRAIL | 阻断 V3；禁止以帧率近似或 RAF delta 替代 |
| V3FT-DETERMINISM | 场景确定性 | 播放、seek、刷新、暂停同时间的 frame-state hash 不同或偏差超 50ms | V3-EV-DETERMINISM | 阻断 V3；修复绝对时间重放 |
| V3FT-HOST | renderer 所有权 | 重复 Canvas/host/renderer/RAF、同帧重复 resolver 或暂停持续绘制 | V3-EV-HOST/RESOURCE | 阻断 V3；恢复唯一 host 与按需单帧 |
| V3FT-SWITCH | 模板切换 | 旧 scene 未 dispose、Cube 占位被当错误或 renderer/canvas 被重建 | V3-EV-SWITCH | 清理旧 scene；保留 host 并显示中性预览 |
| V3FT-SCENE | scene 异常/重试 | create/render/resize 失败破坏 transport、工程、草稿或重试创建第二 host | V3-EV-ERROR | 进入可重试错误层，先 dispose 旧 scene，再在原 host 重建 |
| V3FT-RESPONSIVE | 几何/无障碍 | 16:9、DPR、CSS thickness、抽屉、键盘或 reduced motion 错误 | V3-EV-RESPONSIVE | 修复并重跑 1024/1280/1920、DPR 与键盘矩阵 |
| V3FT-PERFORMANCE | 响应/长任务 | 视觉偏差超 50ms、设置反馈超 100ms 或 Visualizer 归因任务超 50ms | V3-EV-DETERMINISM/RESOURCE | 阻断相关门禁；记录 trace 并定位主线程工作 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 第二 AudioContext/Worker/renderer、跨 route 失控或工程损坏 | 立即停止 canonical，不得豁免 |
| S1 | Orthogonal Lines 核心映射、确定性、单 host 或资源释放不可成立 | 阻断 V3 |
| S2 | 可恢复 scene error、单项参数反馈、布局或键盘缺陷 | 修复并复跑相关层，按影响决定全量重跑 |
| S3 | 不改变场景事实的低等级文案或诊断差异 | 记录并按 AC 判断，不掩盖更高等级问题 |

## Observed Implementation Signals

- pre-canonical 真实 Chrome 检查发现全屏 quad 被 camera frustum culling，中心像素保持透明，属于 `V3FT-MAPPING / S1`。实现将 quad 固定为不参与 frustum culling，并增加渲染帧内中心像素断言；最终 provisional 与 clean canonical 均得到 `[31,215,109,255]` 并通过。
- seek hash、ResizeObserver backing-store、E1 播放就绪和 V1 最终 RAF 采样在早期编排中出现等待边界不足；这些是 harness timing，不登记为产品 canonical failure。测试改为等待可观察产品状态后，目标专项重复通过且最终 30/30 clean canonical 无失败步骤。
