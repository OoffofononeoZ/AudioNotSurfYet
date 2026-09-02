---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/v2-eval-plan.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "V2 binding golden 与 26/26 canonical 已获 owner 批准；作为 V3 相邻回归保留"
---

# Visualizer V2 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V2-G01 | success | 全部参数保持 constant | active set 为空；resolved value 等于规范工程值；不创建 Visualizer Worker | 固定零分析开销 |
| V2-G02 | success | 三个参数共享 `energy` | planner 只返回一次 `energy`，所有参数独立变换同一 source | 固定去重语义 |
| V2-G03 | boundary | 四个唯一特征已激活后选择第五项 | 返回 `analysis-feature-limit`；工程、active set、draft 和 revision 均不变 | 防止绕过上限 |
| V2-G04 | boundary | 删除某特征倒数第二/最后一个引用 | 倒数第二项不释放；最后一项在同 revision 从 active set 移除 | 固定引用释放 |
| V2-G05 | success | scalar 与 Loudness `total` | `scalar` 返回有限数值并按绝对时间线性采样 | 固定标量路径 |
| V2-G06 | success | vector 的 bin/band/mean/max/peak | bin 精确索引；band 为 `[start,end)` mean；peak 为归一化索引 | 防止 peak/max 混用 |
| V2-G07 | success | Loudness `specific` 与 Complex `magnitude` | 使用 24/1024 维组件；full 仅进入 vector 参数 | 固定结构分量 |
| V2-G08 | failure | scalar 使用 bin、错误 component、越界 band、full 非零 smoothing | 候选原子拒绝，当前绑定不变 | 固定 shape 边界 |
| V2-G09 | success | 同歌 Editor 草稿含 point/range 与多个 inner class | 可建立 snapshot；whole lane 为 OR/max，指定 class 只读对应事件 | 固定 Editor 来源 |
| V2-G10 | boundary | point 在 `t`，相邻 ranges 为 `[a,b)` 与 `[b,c)` | point 只在一个 1/60s quantum 激活；`b` 只激活第二 range | 固定时间端点 |
| V2-G11 | failure | Editor 草稿/JSON 错歌、损坏、悬空 lane/class | 不替换 snapshot、工程或 durable draft，并显示可恢复错误 | 防止错歌污染 |
| V2-G12 | race | analysis completion 到达前切换模板/绑定/route | 旧 generation/revision 被丢弃，不更新 resolved state | 固定 stale 隔离 |
| V2-G13 | determinism | 连续播放与直接 seek 到同一组时间 | resolved parameter canonical hash 完全一致 | 防止 RAF 累计漂移 |
| V2-G14 | failure | NaN/Infinity、相等 input range 或非有限输出 | binding-local error；transport、工程和其他参数继续工作 | 固定错误隔离 |

Golden 使用确定性歌曲 hash、虚构元数据、版本化 Editor point/range JSON 和运行时生成音频。不得写入用户本地路径、私有歌曲名或设备标识。

## Default Mapping Examples

| Source | Default input | Default output | Smoothing |
| --- | --- | --- | --- |
| analysis with finite registry min/max | registry min/max | descriptor default → max | attack 0 / release 0 |
| analysis without complete finite range | `0..1` | descriptor default → max | attack 0 / release 0 |
| Editor point event | `0..1` | descriptor default → max | attack 0 / release 0.12s |
| Editor range event | `0..1` | descriptor default → max | attack 0 / release 0 |
| full vector | registry/fallback, component-wise | descriptor vector contract | attack 0 / release 0 only |
