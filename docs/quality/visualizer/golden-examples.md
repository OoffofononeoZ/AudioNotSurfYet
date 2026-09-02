---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/eval-plan.md"
  - "docs/architecture/visualizer/project-format-v1.md"
next_action: "owner 复核 V1 canonical、descriptor 边界与原生文件人工门禁；批准前保持 in-review"
---

# Visualizer V1 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V1-G01 | success | 当前歌曲首次进入 | 创建 `orthogonal-lines@1`、720p30、16:9、uint32 seed 和完整 constant bindings 的规范工程 | 固定新工程身份 |
| V1-G02 | success | 含合法 analysis/editor-event binding 与同歌 Editor snapshot 的完整 V1 | canonical encode → decode → encode bytes 完全一致；V1 不启动分析 | 提前保证 schema 可承载 V2而不升级 |
| V1-G03 | boundary | seed 为 0/`2^32-1`，output 四种组合，参数位于范围端点 | 接受并保持精确值；V1 中性预览不伪装场景效果 | 固定数值与 preset 边界 |
| V1-G04 | failure | 顶层/嵌套未知字段、format/schemaVersion 错误 | strict validator 拒绝，当前工程和 durable draft 不变 | 防止猜测迁移或静默丢字段 |
| V1-G05 | failure | 未知 template/version、缺失/重复/额外 parameter | 完整校验失败且不部分应用 | registry 是工程兼容身份 |
| V1-G06 | failure | 错误 FeatureId、projection/component 不兼容或五个唯一分析特征 | 在 Coordinator 前拒绝，当前工程不变，V1 不创建 Worker | 固定四特征边界 |
| V1-G07 | failure | Editor snapshot 错歌、未知字段、悬空 lane/class | 拒绝导入并保留当前工程/草稿 | 防止错误标注污染工程 |
| V1-G08 | failure | 当前歌曲 hash、duration 或 sample rate identity 不匹配 | 拒绝且不静默选择队列中其他歌曲 | 保证单曲工程身份 |
| V1-G09 | exception | IndexedDB quota 或 transaction abort | 内存工程继续可用，旧 durable draft 保留，状态为 `not-persisted` | 保存失败不能毁掉工作 |
| V1-G10 | race | Editor lease 活跃后 Visualizer 获取 lease，随后旧 Editor release | Visualizer `pause-at-end` 保持；旧 release 无效；再进入 Editor 后恢复 `repeat-one` | 防止 route cleanup 泄漏 |
| V1-G11 | exception | 异歌冲突选择取消 | 可恢复时回旧工程歌曲；不可恢复时保留草稿并回进入前页面 | 固定单草稿取消语义 |
| V1-G12 | boundary | 1279→1280 resize、1024 抽屉切换、1920 DPR resize | 抽屉/三栏按边界切换；只有一个 16:9 Canvas且焦点可恢复 | 固定易回归布局边界 |

Golden 只使用确定性 UUID/hash 与虚构歌曲元数据；不得包含用户本地路径、私有音频名称或设备标识。

## V1 Descriptor Boundary

以下范围是 V1 strict project golden 的一部分；它们约束可导入工程，但 V1 中性预览不会执行动态 binding：

| Template / parameter | Accepted source and value boundary |
| --- | --- |
| Orthogonal Lines `horizontalIntensity` / `verticalIntensity` | `0..1`；允许 constant、analysis、editor-event；analysis 数值 projection 可用 scalar/mean/max/peak/bin/band |
| `horizontalThickness` / `verticalThickness` | `0.5..64`；仅 constant |
| `horizontalBrightness` / `verticalBrightness` | `0..4`；仅 constant |
| `horizontalDecaySeconds` / `verticalDecaySeconds` | `0..10`；仅 constant |
| `horizontalEnabled` / `verticalEnabled` / colors | 仅 constant；类型必须分别为 boolean/color |
| Cube Swarm `centerSpectrum` | 允许 constant/analysis；仅 full vector；component 为 default/specific/magnitude；空 vector 可作为中性值，constant 元素必须非负 |
| `coreScale` | `0..8`；允许 constant、analysis、editor-event |
| `riseSpeed` | `0..20`；允许 constant、analysis、editor-event |
| `orbitSpeed` | `-12..12`；允许 constant、analysis、editor-event |
| `cubeCount` | `1..512` 整数；仅 constant |
| `baseSize` | `0.01..10`；仅 constant |
| `cameraDistance` | `1..100`；仅 constant |
| Cube Swarm colors | 仅 constant color |

第五个唯一分析 FeatureId 必须在工程替换和 Coordinator/Worker 之前拒绝；多个参数共享相同 FeatureId 只计一个名额。
