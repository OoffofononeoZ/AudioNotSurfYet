# AudioNotSurfYet Repository Guide

## Purpose

AudioNotSurfYet 是 Vue / TypeScript / Vite 浏览器音频工作台，包含播放、Analyzer、Editor、Visualizer 和浏览器 FT 分离。当前目标是自动优先、可人工修正且可完整手动完成的视频制作。使用中文维护项目指南与 skills，代码标识和命令保留原文。

## Project Skills

项目 skills 只在本仓库按任务选择，不默认加载全部。维护源为 `skills/`，`.agents/skills/` 是生成的发现入口；修改名称、描述或已有 UI 元数据后运行 `npm run skills:install`，不直接编辑生成入口。

| Skill | 何时读取 | 入口 |
| --- | --- | --- |
| `audiosurf-codebase-navigation` | 定位入口、职责、引用与调用方 | [SKILL.md](skills/audiosurf-codebase-navigation/SKILL.md) |
| `audiosurf-file-modularization` | 新增、重构或评审模块职责 | [SKILL.md](skills/audiosurf-file-modularization/SKILL.md) |
| `audio-visualizer-dev` | UI、播放、分析、Editor、FT、Visualizer 与录制 | [SKILL.md](skills/audio-visualizer-dev/SKILL.md) |
| `visualizer-content-generator` | 新增原子元素和组合预设，先校验输入并批准具体合同 | [SKILL.md](skills/visualizer-content-generator/SKILL.md) |
| `audiosurf-testing-strategy` | 选择验证、判断证据与验证缺口 | [SKILL.md](skills/audiosurf-testing-strategy/SKILL.md) |
| `audiosurf-git-task-delivery` | 修改任务开始及验证后的本地交付 | [SKILL.md](skills/audiosurf-git-task-delivery/SKILL.md) |
| `audiosurf-docs-maintenance` | 更新、清理、压缩或拆分相关文档 | [SKILL.md](skills/audiosurf-docs-maintenance/SKILL.md) |

不使用 Harness Engineering 文档 Skill 系列，不再按通用阶段文件和逐阶段审批阻断任务。已授权、范围与完成标准明确的常规修改可直接推进；重大产品或技术取舍仍需用户决定。

## Documentation

- [README](README.md) 提供运行和工具命令；[代码地图](docs/CODEMAP.md) 提供生成的文件及有限静态引用。
- [上下文入口](docs/context/index.md) 保存当前状态、契约、决策和未解决问题；人工 [system map](docs/context/system-map.md) 解释职责与设计原因。
- 按任务更新实际受影响的文档，长期用户约束写回本指南或对应规范。既有 product、architecture、delivery、quality 等目录和历史证据继续保存；不要求新任务铺开阶段文件、空目录或统一元数据。
- 高影响行为变化前或同时记录相关设计与接口决定。文档与代码或用户当前指令冲突时先核实，区分事实、推断、建议和待确认事项。
- AGENTS.md、根 README、SKILL.md 约 150 行，普通说明约 300 行时审阅职责；只是整理提示，不自动截断或删除。

## Working Rules

- 修改前检查工作树、分支和暂存区，保留用户已有修改。读取任务对应 skill、局部源码与相关契约，优先复用现有能力。
- `trash/` 仅为本地旧资料留存区；不得读取、搜索、索引或引用内容。只有用户明确要求恢复或查看指定内容时才可访问；普通删除不默认移入该目录。
- Node.js 基线为 24.18.0，使用 npm 11.x 和现有 lockfile；搜索优先 `rg` / `rg --files`，显式排除归档和生成产物。
- 手写代码文件推荐不超过 1000 行，超过 1300 行警告，超过 2000 行由 `repo:check` 阻断；第三方、生成文件、锁文件和产物除外。极端特殊情况须记录具体文件、获准最大行数、原因及 owner 批准来源，默认无例外。
- 正常排版后再判断行数，不通过压缩语句、函数或 CSS 规避；按显式文件渐进使用 `format` / `format:check`，不格式化无关修改。Vue 组件按完整功能区域连同模板、相关逻辑和局部样式提取，单独迁出 CSS 或 TS/JS 不算组件拆分；细则见[模块职责 skill](skills/audiosurf-file-modularization/SKILL.md)。
- 新增或修改产品可见滚动容器复用 `.app-scrollbar`。视觉修改依据当前源码、有效布局/交互契约和本次需求。
- 默认不增加兼容或 legacy fallback；确需改变兼容策略时说明用途、代价及后果，并由用户确认。
- 耗时处理、取消、换歌和离页不得让旧结果覆盖新状态；AudioContext、Worker、RAF、Observer、节点、监听和对象 URL 按所属模块释放。
- 范围、隐私、支持矩阵、性能预算、验收阈值、工程格式、重要架构取舍及发布决定变更仍需用户确认。缺少必要环境、许可、输入或合同只阻断依赖它的工作，继续可独立完成的部分。
- 所有新增 Visualizer 原子元素和组合预设（包括仅复用已有元素）都先校验 VisualizerContentBriefV1 并批准具体 Content Contract；批准 skill 或工作流不代表具体内容获批。当前替代关系见[内容生成契约](docs/architecture/visualizer/content-generation.md)。
- Visualizer 当前为 Project V4 与 JSON 资源包 V1 过渡版；内置内容位于 `public/visualizer-resources/v1/`，编写规则见[资源包契约](docs/architecture/visualizer/resource-packages-v1.md)。预设持久化分组，共同参数只含处理字段，批量写入并提示子元素差异；新绘制算法仍需应用内核。旧版工程不迁移，旧版草稿不提供覆盖/原文导出提示。

## Validation and Delivery

按影响范围与风险选择必要验证；小改动不默认全量测试或应用构建，不为低影响文案和样式变化编写形式化测试。类型与领域逻辑选相关静态/单元/集成检查；交互、媒体、资源与性能选对应真实浏览器或测量。依赖、打包、资源加载和产物交付变化再运行适用构建。

- 修改交付前同步 `npm run skills:install`、`npm run codemap`，运行 `npm run repo:check` 和 `git diff --check`；仅生成物改变时与任务一起提交。工具代码变更补 `npm run test:tools`。
- 只读任务不生成文件、不提交。`skills:check`、`codemap:check`、`repo:check` 和 `test:docs` 是只读检查。
- 日常验证不自动创建 canonical 或 readiness。正式评审按对应合同记录干净实现 commit、环境和真实 evidence；未运行、失败、人工输入缺失分别如实记录。
- owner 已授权修改任务完成适用验证后直接本地提交；一次任务或计划含多个小目标时，各小目标验证完成后及时分别提交，不能最终一次性全部提交；单一目标可一次提交。只包含对应小目标的改动，不自动推送、发布、切换分支或重写历史。Git 细节见交付 skill。

## Persistent Authorization and Gaps

- DEC-075：本轮分轨试听和有限乐器自动标记已授权；owner 明确允许新增能力及其回归使用本地端口、Chrome/Edge 和必要的沙箱外执行。DEC-055 的旧 Editor readiness 限制与历史证据缺口保留；本轮不包含 P3、工程格式变化、正式 readiness 或发布，新增识别质量仍须 owner 复核。
- DEC-069/070：已批准 processing P1–P6 可按全部适用验收证据和必需人工输入自主关闭与推进；符合既定契约的后续质量文档由授权接受。新范围、架构、兼容、阈值和发布仍另行确认；缺少试听、许可或测量不视为通过。
- DEC-072：允许当前 FT 先接入 Editor，布局、设计与动效由 agent 决定，并先于 P1 性能和人工质量收口；不扩展为性能豁免、自动应用或发布授权。
- DEC-074：owner 已验证当前 FT 听感，接受复杂音乐的部分串音（drums 最好），前提是本地链路检查无问题；第三首处理时间视作通过，长曲允许更长处理时间。本轮可在其余适用测试通过后收尾，不反复要求已接受的试听/耗时；不编造逐轨记录或新数值上限，不扩展支持范围或后续完整链性能承诺。
- P1 历史 Chrome 15 分钟处理为 16 分 51.95 秒，原 900 秒门禁失败事实保留；DEC-074 接受当前 FT 长曲耗时，不改写旧测量。原生 OS 保存/取消/回放及完整 P1 clean canonical 仍属独立证据缺口，本轮功能收尾不等同正式 readiness。
- 现有正式证据仍绑定其历史候选；Editor/Visualizer 整体 readiness 与生产上线独立处理，PROD-015 继续阻断上线。
