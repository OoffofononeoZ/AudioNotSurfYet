# AudioNotSurfYet

Vue 3 / TypeScript / Vite 浏览器音频工作台。项目状态、技术契约和当前验证缺口见 [上下文入口](docs/context/index.md)，任务规则与 7 个项目 skills 见 [AGENTS.md](AGENTS.md)。

文档按当前页面和领域维护：接口从共享运行时及 Analyzer/Editor/Visualizer 页面进入，验证要求集中在领域 validation。普通任务更新相关专题，过程反馈放在交付中；旧阶段产物已清理，历史由 Git 查回，必要证据与未解决缺口继续保留。

## 本地运行

使用 Node.js 24.18.0 / npm 11.x，按现有 lockfile 安装依赖。

```powershell
npm ci
npm run dev
```

`predev` / `prebuild` 会准备已锁定的 processing runtime assets；模型与大型本地产物遵守忽略规则。运行前核对对应 [处理契约](docs/architecture/processing/model-artifacts.md)。当前 FT 及 Editor 状态以实际 evidence 为准，不能把启动成功当作质量/性能通过。

Editor 分轨试听与有限乐器自动标记已按 [DEC-075 契约](docs/architecture/processing/editor-auto-marking.md) 接入，使用同一播放transport并显式应用V1标记；新增识别质量仍待人工复核，实测误标与边界见 [证据记录](docs/quality/processing/editor-auto-marking-evidence.md)。固定新增模型测试资产使用 `npm run transcription:models`，实际浏览器与单元验证入口见 [自动标记测试](tests/transcription/README.md)。

Visualizer 使用[离线确定性导出](docs/context/visualizer-offline-export.md)生成 WebM，支持 720p/1080p 与 30/60fps，按帧生成并显示进度；预览播放速度不决定输出视频时长。相关依赖许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

Visualizer 使用[可执行资源包 V2](docs/architecture/visualizer/resource-packages-v2.md)。作者源位于 `resources/visualizer/`，运行 `npm run visualizer:resources` 生成项目内资源；dev/build 前自动生成，`npm run visualizer:resources:check` 只读核对。JS 算法在隔离 Worker 中计算，宿主统一绘制；[Project V5](docs/architecture/visualizer/project-format-v5.md)保存算法、Shader、定义及分组快照。当前不接外部地址或后端，磁盘资源包入口暂时隐藏；生成 skill 仍是旧格式，留待独立升级。

## 项目工具

| 命令 | 用途 |
| --- | --- |
| `npm run skills:install` | 从 skills/ 同步 .agents/skills/ 入口及已有 UI 元数据 |
| `npm run skills:check` | 只读检查发现入口是否一致 |
| `npm run codemap` | 生成 [CODEMAP](docs/CODEMAP.md) 和按子系统分页的地图 |
| `npm run codemap:check` | 只读检查地图缺失、过期和废弃生成页 |
| `npm run repo:check` | 只读检查链接、Skill 元数据/入口、地图及规模；代码 >1300 行警告、未获批准 >2000 行失败；手写 Markdown >500 行提示、≥800 行失败 |
| `npm run format -- <file...>` | 用锁定的 Prettier 格式化明确文件，渐进应用，不默认全仓运行 |
| `npm run format:check -- <file...>` | 只读检查明确文件的格式 |
| `npm run test:docs` | 只读核对本地 Markdown 引用和规模，>500 行提示、≥800 行失败；不强制生命周期元数据或阶段批准 |
| `npm run test:tools` | 在一次性 fixture 仓库验证工具行为 |

维护源只在 skills/，生成入口与地图不手改；交付时随相关修改同步并一起提交。工具拒绝覆盖手写目标，显式排除 trash/、依赖和构建/测试产物。代码地图只表示有限静态引用；职责与设计原因见 [system map](docs/context/system-map.md)。

手写代码文件推荐 ≤1000 行，1301–2000 行仅警告；>2000 行须按职责拆分，极端例外须 owner 明确批准具体文件及上限，见[模块职责](skills/audiosurf-file-modularization/SKILL.md)。正常排版后再计数，禁止压缩代码规避。格式工具使用四空格等项目统一选项，保留文件换行符；Vue 属性顺序与逐属性换行不强制。只格式化本次明确修改的文件；`.prettierignore` 排除归档、第三方、生成入口/声明、golden、lockfile、地图与产物。PowerShell 等不受 Prettier 支持的代码仍需人工正常排版。

手写 Markdown（含项目指南、README 和 skills）建议 ≤500 行，>500 行提示，≥800 行禁止提交；精简冗余文字，保留关键信息及正常排版，不靠压行过门禁。若精简可能丢失关键契约、证据、批准或身份记录，汇报并停止提交。自动生成地图不计规模，仍检查引用和生成一致性。

应用专项命令见 [验证 skill](skills/audiosurf-testing-strategy/SKILL.md) 和 [tests README](tests/README.md)。按风险选择 `typecheck`、相关 Vitest/真实浏览器或媒体专项；依赖、打包、资源加载与产物交付变化再运行 `build`。正式 canonical/readiness 继续按其具体合同取证。
