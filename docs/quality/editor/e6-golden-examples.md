---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e6-eval-plan.md"
  - "docs/quality/editor/e5-golden-examples.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "建立版本化 E6 stress manifest，并由 unit/integration/Chrome/Edge 核对全部 golden"
---

# Editor E6 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E6-G01 | format | 同源 WAV/MP3/FLAC 依次进入 Editor | 三格式均显示正确 track、repeat-one、Buffer/overlay，并可返回 queue-next | 固定真实解码与 route lease |
| E6-G02 | failure | 损坏或不支持的音频 | 明确错误；队列、当前工程和 durable draft 不被错误身份替换 | 固定格式失败隔离 |
| E6-G03 | native | 原生打开/保存 JSON 后取消 | 内存工程、草稿和页面状态不变 | 防止取消产生副作用 |
| E6-G04 | failure | 原生导入未知 schema、错误 hash 或重叠 range | 原子拒绝并保留当前工程与旧草稿 | 固定 E1/E5 数据边界 |
| E6-G05 | boundary | pending IndexedDB 写入时刷新/关闭 | 出现浏览器原生提示；完成或无 pending 时不注册提示 | 固定离页保护边界 |
| E6-G06 | capacity | 固定 seed 生成 20 lanes、160 classes、10,000 events | 5,000 point + 5,000 range，ID/时间/引用/重叠校验全部通过 | 固定支持规模 |
| E6-G07 | DOM | 全曲视图与 64x zoom 后统计 event DOM | 节点数跟随相交事件；不等于工程 10,000 总数 | 固定 viewport virtualization |
| E6-G08 | performance | 压力工程下连续 zoom/pan/seek | 每项反馈 `<=100ms`，无归因任务 `>50ms` | 固定导航性能 |
| E6-G09 | performance | 创建 point/range、拖端点、换 class、overlay、autosave | 每项反馈 `<=100ms`，事实与草稿一致 | 固定编辑性能 |
| E6-G10 | resource | 20 次 Editor/Analyzer/Home + 换歌 + overlay | 单 engine/Worker；资源回到稳定基线且不单调增长 | 防止最终候选泄漏 |
| E6-G11 | geometry | 1024/1280/1920 与代表性 DPR | waveform/grid/point/range/overlay 误差 `<=1 CSS px`，Canvas backing store 正确 | 固定跨层映射 |
| E6-G12 | accessibility | 全键盘完成 tempo、point、range、overlay 与 round-trip | 焦点可见且可预测，状态不只靠颜色，名称可朗读 | 固定核心无障碍任务 |
| E6-G13 | reduced motion | 两浏览器启用 reduced motion | 非必要 transition 关闭，功能与反馈不受影响 | 固定系统偏好 |
| E6-G14 | stale | 快速 Editor/Analyzer 切换并换歌/overlay | 旧 lease/job 不覆盖新 route，Analyzer workspace 保留 | 固定 consumer ownership |
| E6-G15 | evidence | dirty 与 clean 两种 eval 启动 | provisional 可运行；canonical 对 dirty worktree 以退出码 2 拒绝 | 固定证据身份 |

版本化 stress manifest 只保存 seed、duration、lane/class/event 计数、预期可见摘要和生成 artifact hash；不提交 15 分钟音频、大型工程、trace、设备标识或用户文件事实。
