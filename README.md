# AudioNotSurfYet

Vue 3 / TypeScript / Vite 浏览器音频工作台。项目状态、技术契约和当前验证缺口见 [上下文入口](docs/context/index.md)，任务规则与 7 个项目 skills 见 [AGENTS.md](AGENTS.md)。

## 本地运行

使用 Node.js 24.18.0 / npm 11.x，按现有 lockfile 安装依赖。

```powershell
npm ci
npm run dev
```

`predev` / `prebuild` 会准备已锁定的 processing runtime assets；模型与大型本地产物遵守忽略规则。运行前核对对应 [处理契约](docs/architecture/processing/model-artifacts.md)。当前 FT 及 Editor 状态以实际 evidence 为准，不能把启动成功当作质量/性能通过。

Editor 分轨试听与有限乐器自动标记已按 [DEC-075 契约](docs/architecture/processing/editor-auto-marking.md) 接入，使用同一播放transport并显式应用V1标记；新增识别质量仍待人工复核，实测误标与边界见 [证据记录](docs/quality/processing/editor-auto-marking-evidence.md)。固定新增模型测试资产使用 `npm run transcription:models`，实际浏览器与单元验证入口见 [自动标记测试](tests/transcription/README.md)。

## 项目工具

| 命令 | 用途 |
| --- | --- |
| `npm run skills:install` | 从 skills/ 同步 .agents/skills/ 入口及已有 UI 元数据 |
| `npm run skills:check` | 只读检查发现入口是否一致 |
| `npm run codemap` | 生成 [CODEMAP](docs/CODEMAP.md) 和按子系统分页的地图 |
| `npm run codemap:check` | 只读检查地图缺失、过期和废弃生成页 |
| `npm run repo:check` | 只读检查链接、Skill 元数据/入口、地图及非阻断规模提示 |
| `npm run test:docs` | 只读核对本地 Markdown 引用，不强制生命周期元数据或阶段批准 |
| `npm run test:tools` | 在一次性 fixture 仓库验证工具行为 |

维护源只在 skills/，生成入口与地图不手改；交付时随相关修改同步并一起提交。工具拒绝覆盖手写目标，显式排除 trash/、依赖和构建/测试产物。代码地图只表示有限静态引用；职责与设计原因见 [system map](docs/context/system-map.md)。

应用专项命令见 [验证 skill](skills/audiosurf-testing-strategy/SKILL.md) 和 [tests README](tests/README.md)。按风险选择 `typecheck`、相关 Vitest/真实浏览器或媒体专项；依赖、打包、资源加载与产物交付变化再运行 `build`。正式 canonical/readiness 继续按其具体合同取证。
