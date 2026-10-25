# 仓库上下文入口

核查日期：2026-10-19。AudioNotSurfYet是Vue/TypeScript/Vite本地音频工作台，目标为自动优先、可人工修正及完整手动完成视频制作。

读取本入口、关联文档和 skill 时必须显式指定 UTF-8 编码参数，例如 `Get-Content -Encoding UTF8`、`rg --encoding utf-8`；完整规则见[AGENTS](../../AGENTS.md#文档与-skill-读取编码)。

## 从任务进入

| 任务 | 当前入口 |
| --- | --- |
| 工作规则、skill选择、运行命令 | [AGENTS](../../AGENTS.md)、[README](../../README.md)、[工作约定](working-agreements.md) |
| 定位代码、共享服务与设计原因 | [CODEMAP](../CODEMAP.md)、[system map](system-map.md)、[共享运行时契约](../architecture/shared-runtime-contracts.md)、[术语](glossary.md) |
| Home、MusicBar、侧栏与响应式布局 | [应用外壳](app-shell.md) |
| Analyzer接口/列表/特征 | [页面接口](../architecture/analyzer/interface-contracts.md)、[当前列表](analyzer-list.md)、[Wallpaper频谱](wallpaper-spectrum.md) |
| Editor工程/交互/页面框架 | [页面接口](../architecture/editor/interface-contracts.md)、[Project V2](../architecture/editor/project-format-v2.md)、[osu 导入](../architecture/editor/osu-import.md)、[交互](../architecture/editor/interaction-contracts.md)、[工作区](editor-workspace.md)、[标记页](editor-marking.md) |
| Visualizer工程/资源/组合/视频 | [页面接口](../architecture/visualizer/interface-contracts.md)、[Project V5](../architecture/visualizer/project-format-v5.md)、[资源包](../architecture/visualizer/resource-packages-v2.md)、[组合](visualizer-composition.md)、[预设](visualizer-presets.md)、[原生输入](visualizer-native-input.md)、[离线导出](visualizer-offline-export.md)、[实时样式](visualizer-realtime.md)、[媒体输入](visualizer-media.md) |
| 新增原子元素/预设 | [内容生成](../architecture/visualizer/content-generation.md)及根AGENTS指向的外部skill；默认自主生成并附实际展示图 |
| FT、试听、自动标记 | [FT接入](../architecture/processing/editor-separation.md)、[自动标记](../architecture/processing/editor-auto-marking.md)、[模型身份](../architecture/processing/model-artifacts.md)、[FT配置](../architecture/processing/ft-kernel-config.md) |
| 后续处理路线/提案 | [路线](../delivery/processing/roadmap.md)、[运行时与未来目标](../architecture/processing/worker-and-project-contracts.md) |
| 产品范围、风险与授权 | [范围/成功标准](../product/scope.md)、[开放问题](../product/open-questions.md)、[风险](../architecture/risk-register.md)、[决策](decision-registry.md) |
| 按改动选择测试 | [验证skill](../../skills/audiosurf-testing-strategy/SKILL.md)、[tests README](../../tests/README.md)、[Analyzer](../quality/validation.md)、[Editor](../quality/editor/validation.md)、[Visualizer](../quality/visualizer/validation.md)、[processing](../quality/processing/validation.md) |

## 当前状态与独立缺口

- 当前Analyzer为单列/FIFO及Wallpaper频谱；Editor使用独立marker视图、数字实时录入、FT和有限自动标记；Visualizer使用V5工程、V2可执行算法资源包与离线WebM。源码与当前页面契约解释实际行为；外部 assets 文件夹提供资源，内容生成 skill 2.4.0 仅在外部维护，使用 BriefV2 和独立封装工具，默认自主生成并要求实际展示图。
- DEC-074接受当前FT听感/部分串音和长曲耗时，本轮功能已收尾；Chrome历史1011.9541秒超过900秒仍保留。完整P1/P2 clean evidence、Edge普通profile长曲与原生OS操作不由此补齐。
- 新增识别质量待owner复核。P3逐拍/局部tempo、完整提案/应用和处理数据工程扩展未完成；最新V4-only已替代旧V2迁移计划，自动标记不等于P3。
- Editor整体readiness保持pre-E10/DEC-055 owner-review；DEC-075另行授权新增能力和回归使用本地端口/Chrome/Edge，不重开旧readiness自动化。
- Visualizer历史候选保留viewport/fullscreen视觉缺口；当前功能验证不证明新整体readiness。PROD-015继续阻断生产上线。

## 必要历史证据

历史pass仅适用于原候选、环境与范围。普通修改不生成canonical/readiness或阶段文档三件套，需要正式评审时再按对应合同执行。

| 领域 | 证据与边界 |
| --- | --- |
| Analyzer | [M3–M14身份](../quality/evidence-index.md)、[历史readiness与W-001–007](../quality/release-readiness.md) |
| Editor | [E1–E9及两次readiness尝试](../quality/editor/evidence-index.md)、[readiness与W-ED-001–006](../quality/editor/release-readiness.md) |
| Visualizer | [V1–V6身份/媒体hash](../quality/visualizer/evidence-index.md)、[readiness](../quality/visualizer/release-readiness.md)、[历史输出测量](visualizer-output.md) |
| Processing | [P1/owner验收](../quality/processing/evidence-index.md)、[数值复核](../quality/processing/numeric-review.md)、[Editor接入](../quality/processing/editor-integration-evidence.md)、[自动标记](../quality/processing/editor-auto-marking-evidence.md) |

已结束阶段的重复过程文档已清理，完整原文由Git查回；新任务优先更新当前主题，不恢复旧文档流水线。
