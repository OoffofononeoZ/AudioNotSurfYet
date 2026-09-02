---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/visualizer/v4-eval-plan.md"
  - "docs/architecture/visualizer/binding-and-scene-contracts.md"
next_action: "V4 golden 与 34/34 clean canonical 已通过；等待 owner 人工视觉验收"
---

# Visualizer V4 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| V4-G01 | success | 首次切换到 Cube Swarm | centerSpectrum 默认 analysis/full、riseSpeed 默认 Energy scalar；其余 constant；active set 恰为两项 | 固定默认预算 |
| V4-G02 | success | 512 项频谱向量 | 等分为 64 个连续 band，每段取有限非负最大值并按 `log1p(value)/log1p(128)` 裁剪到 0–1 | 固定核心数据语义 |
| V4-G03 | boundary | 空向量、短向量、负值、非有限/未就绪 binding | 始终生成 64 个有限 amplitude；不可用项按 descriptor 默认值降级，其他参数不受污染 | 覆盖坏输入 |
| V4-G04 | success | `B=1`、amplitude 0/1 | 环半径 `0.85`；径向长度为 `0.12/0.80`；横截面 `0.08`；方块从中心向外排列 | 固定核心几何 |
| V4-G05 | success | coreScale 0/1/8 | 核心整体视觉 scale 为 `0/1/sqrt(8)`；外围和卫星不改变 | 固定 drum 所有权 |
| V4-G06 | success | cubeCount 1/48/512、固定 seed | 只改变外围实例数量；已有索引的左右区域、深度、初始高度、尺寸和朝向保持一致 | 固定 seed 和数量语义 |
| V4-G07 | determinism | Energy 序列经 `[0,25]→[0.25,3]` 映射 | 外围高度按 60Hz 速度积分并在 `[-3B,3B)` 循环；直接 seek 与连续积分相同 | 防止 RAF delta 漂移 |
| V4-G08 | success | 默认 orbitSpeed 0.3、播放不同音频 | 三卫星只按 `0.3 rad/s` 前进，不随频谱或 Energy 改变 | 固定默认 constant |
| V4-G09 | success | orbitSpeed 显式改绑 Editor/analysis | 三卫星按 60Hz checkpoint 积分改变角度；核心和外围状态不变 | 固定可改绑隔离 |
| V4-G10 | determinism | 同 seed/project/time/binding revision 的播放、seek、暂停和刷新 | 量化布局、频谱、积分相位、颜色与相机形成相同 frame-state hash | 固定录制前一致性 |
| V4-G11 | lifecycle | Orthogonal ↔ Cube 重复 20 次 | Canvas/host/renderer 身份不变；旧 scene 停止更新；共享 geometry 与两个 material 对称释放 | 固定资源所有权 |
| V4-G12 | exception | `WEBGL_lose_context` loss→restore | loss 状态显示文字并停止视觉 RAF；工程/transport 保留；同 renderer 重建 scene 并绘制当前时间 | 固定恢复路径 |
| V4-G13 | failure | scene dispose 或 restore 重建抛错 | 保持唯一 host/renderer/canvas，进入可重试错误层；工程仍可导出 | 防止失败扩散 |
| V4-G14 | boundary | 1024/1280/1920 与 DPR 1/2/3 | CSS 16:9 不变，drawing DPR 为 1/2/2，相机 aspect 与预览一致，键盘可达 | 固定响应式和无障碍 |

Golden 使用生成的 CC0 `visualizer-v4-cube-swarm-v1.wav`、虚构同歌 EditorProjectV1、固定 seed/binding revision 与版本化 renderer-neutral state。不得写入用户本地路径、私有歌曲名或设备标识。
