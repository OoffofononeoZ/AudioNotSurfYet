# 命令与领域检查

## 当前入口

命令定义以根 package.json 为准，完整 runner 与历史结果见 [tests README](../../../tests/README.md)。这里只提供任务选择，不能把可用命令表当作默认执行清单。

| 用途 | 命令 |
| --- | --- |
| 项目入口与地图 | `skills:install` / `skills:check`、`codemap` / `codemap:check` |
| 文档与工具 | `test:docs`、`repo:check`、`test:tools` |
| 修改的手写代码格式 | `format -- <file...>` / `format:check -- <file...>`，只传本次明确文件，不全仓运行；2000 行硬上限另由 `repo:check` 检查 |
| 类型与生产构建 | `typecheck`、`build`；构建 prebuild 会准备 processing assets |
| 播放与会话 | `test:m4:unit` / `test:m4:integration`、`test:e2e:m4` |
| 句柄与恢复 | `test:m5:unit` / `test:m5:integration`、`test:e2e:m5` |
| 分析平台 | `test:m6:unit` / `test:m6:worker` / `test:m6:integration` |
| Analyzer 特征与布局 | 相关 `test:m7:*` 至 `test:m14:*` 和浏览器专项 |
| Editor 工程与交互 | 相关 `test:e1:*` 至 `test:e10:*` 和浏览器专项 |
| FT 计算、任务与存储 | `test:p1:unit`、`test:p1:integration` 及 `tests/processing/` 对应切片 |
| Editor 分离接入 | Vitest 过滤 `tests/processing/editor-*.test.ts`；Playwright 的 `tests/e2e/editor-ft.spec.ts`，按 Chrome/Edge channel 选择 |
| 内容生成输入校验器 | `test:skill:visualizer-content-generator` |
| Visualizer V4 组合/输入/离线导出 | `test:visualizer` 或对应文件过滤、`test:e2e:visualizer:chrome` / `test:e2e:visualizer:edge` 中受影响专项；媒体入口见当前离线导出契约 |

执行前核实当前 package.json 中的精确命令；参数和过滤文件按实际影响选择。日常修复不运行累计 eval 链。正式 canonical/readiness 请求使用现有对应 `eval:*` 命令，继续满足各合同的干净 commit、范围、身份和人工证据要求。

## 领域检查选择

- 播放与加载：成功、decode/metadata 失败、空队列、暂停/seek、换歌/清空及节点/URL 释放。
- 离线分析：受影响的 0/1/4 活动特征、progress/cancel/error、完整 cache identity、stale generation、exact cursor 和持久化失败隔离；调度/资源/性能变化时补约 15 分钟输入与生命周期观察。
- Editor：受影响的 tempo/time、吸附、point/range、原子冲突、JSON/草稿及 overlay/geometry；数据保护与恢复修改需邻接失败路径。
- FT：真实模型身份、输出时间/声道与 WAV、取消/换歌/stale、缓存恢复/清理和 quota 错误；推断、质量或性能结论必须有实际运行与所需试听/测量。
- 布局：按支持矩阵选窄、常见和宽视口，检查 DOM/canvas 几何、滚动所有权、焦点与控制台。
- Visualizer：确定性 absolute time/seed、V4 资源/分组预设与参数/目标隔离、资源幂等释放；导出变化补输入准备、手动渲染租约、帧数/PTS、取消/恢复及实际媒体文件，遵循当前[离线导出契约](../../../docs/context/visualizer-offline-export.md)。final hardening 才使用完整测试资源探针，不扩大生产公共接口。

浏览器使用合同规定的真实 Chrome/Edge；缺少浏览器、权限或端口时注明未运行，遵守 DEC-055 等既有环境限制。OPFS 不替代原生许可提示。

## 本地事实与风险

Node.js 24.18.0 / npm 11.x；目前证据只声明本地环境，没有正式 CI。fixture/golden 使用现有 Node 原生 type stripping；build 可能更新 auto-imports.d.ts / components.d.ts，应保留用户原有差异。现有大 chunk warning 作为风险报告；不无依据分包。

调试先复现，再缩小到状态、DOM、音频节点或渲染循环，核对原始路径和相邻失败/边界。真实结果与未验证项按当前证据报告，不复制历史 run 当作本次验证。
