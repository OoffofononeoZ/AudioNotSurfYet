# 浏览器处理链与 Editor 分离

## 范围与事实入口

浏览器 FT/WebGPU、TypeScript 节拍/局部 tempo、用户确认、只读提案和 Project V2 的设计已按 DEC-063–066 批准；当前实现与授权不等于全部链路完成。当前进度以 [上下文入口](../../../docs/context/index.md) 为准。DEC-072 允许 FT 先接入 Editor，不等待 P1 性能/人工质量收口。

| 任务 | 合同或证据 |
| --- | --- |
| runtime/provider、Worker 与数据流 | [浏览器处理架构](../../../docs/architecture/adrs/0024-browser-processing-runtime.md)、[时间基准](../../../docs/architecture/adrs/0025-audio-processing-pipeline-and-timebase.md) |
| 四 FT 模型 revision/hash 与 tensor | [模型资产](../../../docs/architecture/processing/model-artifacts.md)、[内核配置](../../../docs/architecture/processing/ft-kernel-config.md) |
| 消息、身份、取消、提案与 V2 | [Worker 与工程契约](../../../docs/architecture/processing/worker-and-project-contracts.md) |
| Editor 服务、界面、导出与清理 | [Editor 分离契约](../../../docs/architecture/processing/editor-separation.md) |
| 实际验证和剩余缺口 | [P1 evidence](../../../docs/quality/processing/evidence-index.md)、[Editor 接入 evidence](../../../docs/quality/processing/editor-integration-evidence.md) |

## 实现注意

- 复用 src/processing 现有 model manifest、controller/service、Worker、PCM、storage 和 presentation；不能默认新增 Processor 路由或第二条分离链。
- 固定模型与官方 ORT 身份校验后使用约定 role row、采样率/时间对齐、分段拼接和 WAV 派生，不靠静默模型/provider fallback 处理错误。
- 分离 Worker 与现有分析 Worker 的职责不同；各自保持已批准数量、拥有者、取消与释放边界。
- 下载、推断和缓存 UI 对应同一次 source/job identity；取消、换歌、退出后的旧结果不得覆盖新输入。缓存与 quota 故障按 typed error 显示，保持原 Editor 编辑/播放可用。
- 自动节拍、提案 apply、Visualizer V2 等后续能力只按已确认任务范围推进，不能从 FT 界面接入推断已实现或授权自动应用。

## 当前收尾与独立缺口

DEC-074 已接受当前 FT 汇总听感、复杂音乐部分串音（drums 最好）及第三首耗时，并允许长曲更长处理时间；本轮 Editor 接入在其余适用测试通过后收尾，不重复要求已接受的输入。当前完整 runner 9/9、92 项非浏览器、Chrome/Edge 各 20/20 通过，证据为 provisional。历史 Chrome 15 分钟处理 16 分 51.95 秒超原 900 秒的事实保留，不编造新门槛、第三首秒数或 12 行逐轨结论。原生 OS 保存/取消/回放、完整 P1 clean evidence 和后续完整链性能仍独立。实际结果见 [P1 evidence](../../../docs/quality/processing/evidence-index.md#owner-acceptance--2026-10-12) 和 [Editor evidence](../../../docs/quality/processing/editor-integration-evidence.md)，验证选择见 [验证策略](../../audiosurf-testing-strategy/SKILL.md)。
