---
name: audiosurf-file-modularization
description: "新增、重构或评审 AudioNotSurfYet 代码职责时使用；按 Vue、领域计算、状态和浏览器资源生命周期拆分，审阅约 500 行的自有代码文件。"
---

# 模块职责

500 行是审阅提示，不是目标或硬门禁；第三方、生成文件和锁文件除外。不因现有超长文件批量重构，不为压行数制造没有职责的转发层。

- Vue 页面负责装配；功能区域和交互组件承担各自 UI。可复用状态、事件与生命周期放 composables/controller，领域模型不与模板耦合。
- audio service/engine 分开命令编排与播放节点；analysis Coordinator/Worker 分开主线程调度、数值计算、cache 与 stale identity。
- Editor 区分时间/tempo、标记操作、工程 codec、持久化和 Canvas geometry；复用已有时间及吸附逻辑。
- FT 区分模型/运行库身份、PCM 处理、Worker 推断、任务控制、存储和 UI presentation；不把张量运算混入组件。
- Visualizer 区分 binding、确定性场景状态、renderer host、录制状态与文件 IO，保留单资源所有者。
- 工具和测试也按职责拆分；高频数值和渲染更新不要深度写入整个 Vue 响应式树。

文件同时承担 UI、请求、计算、存储或多种资源所有权，或本次新增使其接近/超过 500 行时，提取可独立解释和验证的职责。必要例外在相关设计或交付说明中注明原因；核对调用方与资源创建/释放，再选择相关验证并同步地图。
