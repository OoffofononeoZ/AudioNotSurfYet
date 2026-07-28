# 构建、测试与调试

## 当前命令

| 命令 | 当前含义 | 门禁解释 |
| --- | --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 | 用于浏览器交互，不代表构建通过 |
| `npm run build` | 先运行 `vue-tsc -b`，再运行 `vite build` | 当前最基本静态与生产构建门禁 |
| `npm run preview` | 预览构建产物 | 适合核对生产资源路径 |
| `npm run typecheck` | 运行 `vue-tsc -b` | 测试配置、测试 TypeScript 与产品源码的静态门禁 |
| `npm test` | 执行全部非 E2E Vitest 测试 | 不代表真实浏览器或 Edge 通过 |
| `npm run test:e2e` | 使用本机稳定 Chrome 运行 Playwright | 当前 Chrome 浏览器门禁 |
| `npm run test:e2e:edge` | 检测并运行稳定 Edge | Edge 缺失时以退出码 2 明确 blocked |
| `npm run test:docs` | 检查生命周期 frontmatter、链接和 21 项特征 | 文档门禁 |
| `npm run eval:m3:provisional` | 未提交工作树的本地 M3 run | 不创建正式 evidence index |
| `npm run eval:m3` | 只在干净 commit 上运行 M3 canonical suite | 生成可登记到 evidence index 的正式本地证据 |

## 已知测试缺口

- 已建立 Vitest、Playwright、Worker、IndexedDB、fixture、golden、docs 和 deliberate-failure harness。
- fixture/golden 生成改用 Node 24 原生 type stripping；不依赖在受限环境会产生 IPC `EPERM` 的 `tsx` CLI。
- 当前没有正式 CI，自动化结论必须限定为本地环境。
- 当前机器没有 Edge。Chrome 通过不能表述为双浏览器矩阵完成。
- 正式 M3 canonical run 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过并登记，且已由 `project-owner` 批准；M4 已开放。

## 构建风险

- Vite 当前会报告约 1 MB 级别的大 chunk 警告。它是已知风险提示，不是构建错误。
- `components.d.ts` 与 `auto-imports.d.ts` 由 Vite 插件维护；运行构建可能更新生成声明。构建前后要比较 Git 差异，保留用户原有修改。
- `dist/` 被 `.gitignore` 排除；不要把生成产物当作源码变更。

## 浏览器验证

涉及交互、布局、AudioContext 或 WebGL 时：

1. 启动本地 Vite。
2. 打开目标路由并等待 DOM 就绪。
3. 执行任务对应的成功、失败和边界场景。
4. 读取 DOM 状态与真实几何；必要时截图作为补充，不以截图替代状态检查。
5. 检查 console error/warn。
6. 结束浏览器会话并关闭开发服务器。

音频场景应使用允许的本地 fixture，检查队列、进度、能量、暂停、清空和错误恢复。没有 fixture 时，明确记录未验证项。

## 调试顺序

- 先复现，再缩小到状态、DOM、音频节点或渲染循环。
- 优先读取现有响应式值、CSS 变量、RAF 句柄和对象所有权，不先加兼容分支。
- 对定位问题读取 `getBoundingClientRect()`；对播放问题读取 AudioLoader 的 loaded/playing/time/duration；对渲染问题检查 canvas 数量、尺寸和控制台。
- 修复后复跑原始场景，并增加至少一个相邻失败或边界场景。

## 交付前检查

- `npm run build`
- 相关浏览器场景及控制台
- Markdown/配置改动的语法和链接检查
- `git diff --check`
- `git status --short` 与改动范围审计
- 明确列出未运行或不能通过的测试及原因
