# 模型工作指南

本文件提供 skill、文档入口和通用工程规则。按任务读取相关内容，不默认加载全部资料。

## 项目 Skills

| Skill | 何时读取 | 入口 |
| --- | --- | --- |
| `audiosurf-codebase-navigation` | 定位入口、职责、引用与调用方 | [SKILL.md](skills/audiosurf-codebase-navigation/SKILL.md) |
| `audiosurf-file-modularization` | 新增、重构或评审模块职责 | [SKILL.md](skills/audiosurf-file-modularization/SKILL.md) |
| `audio-visualizer-dev` | 界面、播放、分析、Editor、FT、Visualizer 与导出的开发和诊断 | [SKILL.md](skills/audio-visualizer-dev/SKILL.md) |
| `visualizer-content-generator` | 新增原子元素和组合预设 | [SKILL.md](skills/visualizer-content-generator/SKILL.md) |
| `audiosurf-testing-strategy` | 选择验证、判断证据与验证缺口 | [SKILL.md](skills/audiosurf-testing-strategy/SKILL.md) |
| `audiosurf-git-task-delivery` | 修改任务开始及验证后的本地交付 | [SKILL.md](skills/audiosurf-git-task-delivery/SKILL.md) |
| `audiosurf-docs-maintenance` | 更新、清理、压缩或拆分相关文档 | [SKILL.md](skills/audiosurf-docs-maintenance/SKILL.md) |

## 文档入口

| 文档 | 用途 |
| --- | --- |
| [README](README.md) | 运行环境、启动方式与工具命令 |
| [代码地图](docs/CODEMAP.md) | 生成的文件索引与有限静态引用 |
| [上下文入口](docs/context/index.md) | 按任务查找领域契约、产品范围、当前状态及证据 |
| [system map](docs/context/system-map.md) | 模块职责、依赖与设计原因 |
| [决策登记](docs/context/decision-registry.md) | 已有决定、授权来源及适用边界 |
| [tests README](tests/README.md) | 测试命令、runner 与测试资料 |

## 通用规则

- 使用中文维护项目指南与 skills，代码标识和命令保留原文。
- 不使用 Harness Engineering 文档 Skill 系列，不恢复通用阶段文档和逐阶段审批流水线。
- 修改前检查工作树、分支和暂存区，保留用户已有修改。核对相关源码、调用方与契约，优先复用现有能力。
- `trash/` 仅为本地旧资料留存区；不得读取、搜索、索引或引用内容。只有用户明确要求恢复或查看指定内容时才可访问；普通删除不默认移入该目录。
- 搜索优先 `rg` / `rg --files`，显式排除 `trash/`、依赖和构建/测试产物。
- 运行环境和命令以 `package.json`、项目配置及 README 为准，使用现有 lockfile。
- 项目 skill 的维护源为 `skills/`，`.agents/skills/` 是生成的发现入口；入口和代码地图由工具同步，不直接编辑生成文件。
- 规模、职责拆分和格式按模块职责 skill 执行；按明确文件渐进格式化，不修改无关内容，不压缩排版规避检查。文档整理与信息保留按文档维护 skill 执行。
- 默认不增加兼容或 legacy fallback；确需改变兼容策略时说明用途、代价及后果，并由用户确认。
- 异步任务取消、输入变化或模块销毁后，旧结果不得覆盖新状态；运行时资源按所属模块创建和释放。
- 范围、隐私、支持矩阵、性能预算、验收阈值、工程格式、重要架构取舍及发布决定变更仍需用户确认。缺少必要环境、许可、输入或合同只阻断依赖它的工作，继续可独立完成的部分。
- 涉及既有批准或正式评审时，读取决策登记及对应专题，按最新明确决定核对替代关系。本指南省略具体记录不代表撤销或扩大授权。
- 按验证策略 skill 选择必要检查，如实区分事实、推断、通过、失败、未运行及缺少人工输入；日常验证不自动生成正式评审记录。
- 只读任务不生成或提交文件。修改任务按 Git 交付 skill 完成验证、同步生成物并按小目标本地提交；不自动推送、发布、切换分支或重写历史。
