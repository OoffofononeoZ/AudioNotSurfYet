---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/v3-eval-plan.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "实现 visualizer-v3-lines-v1 fixture 与版本化 scene golden，并用 V3 canonical 固定结果"
---

# Visualizer V3 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V3-G01 | boundary | 新工程两个 intensity 均为 constant 0 | 两个方向隐藏；显示“请选择主要音色/鼓点数据源”；不按 lane 名猜测绑定 | 固定未绑定体验与零默认 |
| V3-G02 | success | horizontal intensity 0.5、brightness 0.8 | 横线由中心向两侧覆盖画布宽度 50%，主线 alpha 0.4 | 固定长度与透明度双映射 |
| V3-G03 | boundary | intensity 小于 0 或大于 1 | display intensity 分别裁剪为 0/1；其余参数不被改写 | 固定 renderer 防御边界 |
| V3-G04 | success | vertical brightness 3、intensity 1 | 主线 alpha 饱和为 1，外围 halo 强于 brightness 1 | 防止高亮度在 alpha 饱和后失效 |
| V3-G05 | boundary | enabled false、任意非零 intensity/decay | 对应方向完全隐藏且不影响另一方向 | 固定 enabled 优先级 |
| V3-G06 | success | 横线绑定 main-tone range，竖线绑定 drum point | range 在区间内持续；point 先按 V2 120ms release，再进入各自视觉余辉 | 固定 V2/V3 两层时间语义 |
| V3-G07 | boundary | 相邻 ranges `[a,b)`、`[b,c)` 与多个 inner class | `b` 只激活第二 range；inner class 只读本类，whole lane 取 OR/max | 防止端点双激活和分类串扰 |
| V3-G08 | boundary | decay 0 | `E_n = I_n`，无历史余辉 | 固定关闭余辉语义 |
| V3-G09 | determinism | decay 0.25 秒、输入从 1 降为 0 | 固定 60Hz 衰减；0.25 秒后约为 `exp(-4)`，允许浮点容差 | 固定 decay 单位和速率 |
| V3-G10 | determinism | 连续播放、seek、刷新、暂停到同一时间 | track/template/binding revision 相同则 frame-state canonical hash 完全一致 | 防止 RAF delta 漂移 |
| V3-G11 | lifecycle | Orthogonal → Cube Swarm → Orthogonal | 旧 geometry/material 各 dispose 一次；Canvas/host/renderer 身份不变；Cube 显示 V4 中性预览 | 固定模板切换所有权 |
| V3-G12 | failure | scene render 抛错后点击重试 | 错误层可见；transport/工程/模板仍可用；旧 scene 先 dispose，未创建第二 host | 固定故障隔离 |
| V3-G13 | boundary | 1024/1280/1920 与 DPR 1/2/3 | CSS 16:9 不变；drawing DPR 分别为 1/2/2；thickness CSS px 视觉值不变 | 固定 resize/DPR 几何 |
| V3-G14 | boundary | 歌曲 0 秒、末尾、point/range 同时激活与无效引用变体 | 有效值有限且确定；无效引用为可恢复 binding/scene error，不污染其他参数 | 覆盖易遗漏边界 |

Golden 使用 `visualizer-v3-lines-v1.wav`、虚构同歌 EditorProjectV1、固定 binding revision 和版本化 renderer-neutral scene state。不得写入用户本地路径、私有歌曲名或设备标识。
