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
| `npm run test:m4:unit` | 运行 AudioEngine fake-clock 单元测试 | M4 engine 契约验证 |
| `npm run test:m4:integration` | 运行 session/store/controller 集成测试 | M4 队列、竞态和资源验证 |
| `npm run test:e2e:m4` | 运行 M4 Chrome 播放回归和 60 秒计时 | M4 浏览器切片 |
| `npm run test:m5:unit` | 运行 V1 SessionRepository、validator 与事务故障测试 | M5 持久化单元切片 |
| `npm run test:m5:integration` | 运行 Blob/handle/权限/恢复 service 测试 | M5 恢复集成切片 |
| `npm run test:e2e:m5` | 运行真实 Chrome IndexedDB/OPFS 刷新恢复 | M5 浏览器切片；不等于原生权限 prompt |
| `npm run test:m6:unit` | 运行 registry/config/PCM/frame/codec 单元测试 | M6 分析平台纯逻辑 |
| `npm run test:m6:worker` | 运行产品 Worker 合约与 direct golden | M6 提取、进度、取消与精确值 |
| `npm run test:m6:integration` | 运行 coordinator/cache/persistence 集成测试 | M6 identity、stale、partial hit 与 quota |
| `npm run test:e2e:m6` | 运行 Chrome module Worker、刷新、资源和 15 分钟性能场景 | M6 浏览器切片 |
| `npm run test:m7:unit` | 运行 viewport、renderer 数据变换、workspace 与学习 golden | M7 纯逻辑和规范输入 |
| `npm run test:m7:integration` | 运行 workspace 状态、恢复和 quota 集成测试 | M7 cards/viewport 持久化 |
| `npm run test:e2e:m7` | 运行 Chrome 四槽三卡、共享 seek/zoom、DPR/视口和错误隔离 | M7 浏览器学习切片 |
| `npm run test:m10:unit` | 运行 Loudness/Complex direct Meyda、维度、结构 codec 与 golden | M10 结构单元切片 |
| `npm run test:m10:integration` | 运行两类结构 Worker、exact cursor、stale/cancel/quota 与四卡恢复 | M10 集成切片 |
| `npm run test:e2e:m10` | 运行 Chrome 21 项、两类结构卡和 15 分钟四重卡性能 | M10 浏览器切片 |
| `npm run test:e2e:edge` | 检测并运行稳定 Edge | Edge 缺失时以退出码 2 明确 blocked |
| `npm run test:docs` | 检查生命周期 frontmatter、链接和 21 项特征 | 文档门禁 |
| `npm run eval:m3:provisional` | 未提交工作树的本地 M3 run | 不创建正式 evidence index |
| `npm run eval:m3` | 只在干净 commit 上运行 M3 canonical suite | 生成可登记到 evidence index 的正式本地证据 |
| `npm run eval:m4:provisional` | 未提交工作树的本地 M4 run | 不追加正式 evidence |
| `npm run eval:m4` | 只在干净 commit 上运行 M3 回归与 M4 suite | 生成可登记的 M4 正式证据 |
| `npm run eval:m5:provisional` | 未提交工作树运行 M3–M5 suite | 不追加正式 evidence |
| `npm run eval:m5` | 只在干净 commit 上运行 M3–M5 suite | 生成可登记的 M5 正式证据 |
| `npm run eval:m6:provisional` | 未提交工作树运行 M3–M6 suite | 只生成实现反馈，不追加正式 evidence |
| `npm run eval:m6` | 只在干净 commit 上运行 M3–M6 suite | 生成可登记的 M6 canonical 证据 |
| `npm run eval:m7:provisional` | 未提交工作树运行 M3–M7 suite | 只生成实现反馈，不追加正式 evidence |
| `npm run eval:m7` | 只在干净 commit 上运行 M3–M7 suite | 生成可登记的 M7 canonical 证据 |
| `npm run eval:m10:provisional` | 在 dirty worktree 运行 M3–M10 的 36 步 suite | 只生成实现反馈 |
| `npm run eval:m10` | 只在干净 commit 上运行 M3–M10 的 36 步 suite | 生成可登记的 M10 canonical 证据 |

## 已知测试缺口

- 已建立 Vitest、Playwright、Worker、IndexedDB、fixture、golden、docs 和 deliberate-failure harness。
- fixture/golden 生成改用 Node 24 原生 type stripping；不依赖在受限环境会产生 IPC `EPERM` 的 `tsx` CLI。
- 当前没有正式 CI，自动化结论必须限定为本地环境。
- 当前机器没有 Edge。Chrome 通过不能表述为双浏览器矩阵完成。
- 正式 M3 canonical run 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过并登记，且已由 `project-owner` 批准。
- 正式 M4 canonical run 已在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过并登记，evidence 与 working agreements 已由 `project-owner` 批准。
- M5 自动化 picker 使用浏览器 OPFS 返回真实 `FileSystemFileHandle`；原生 OS picker 的 granted/prompt/denied 与文件移动路径已由 `project-owner` 于 2026-07-29 人工检查通过。
- M5 clean-commit canonical 已于 2026-07-29 在 `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上通过 16/16 并登记；evidence 与 working agreements 已获 owner 批准，M5 已关闭。
- 超出约 15 分钟支持边界的长音频未开始播放只作为非门禁压力观察；它不是规定的预期失败，也不能替代范围内性能或格式验证。
- M6 当前 Meyda 的 `spectralFlux` 对有效输入抛出 `x is not defined`；已用预期失败测试和 R-020 固定，不能把 21 项 registry 误述为 21 项均可计算。
- M6 dirty-worktree provisional 与 clean-commit canonical 均已 20/20 通过；正式 evidence 已登记，并由 `project-owner` 于 2026-07-30 批准，M6 已关闭。
- M7、M8、M9 已获批准并关闭。M10 Loudness/Complex Spectrum 与累计 21/21 的 provisional、clean canonical 均 36/36 通过；正式 evidence 为 `in-review`，owner 审批前 M10 保持 `In Progress`、M11 保持 `Planned`。

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

音频场景应使用允许的本地 fixture，检查队列、进度、能量、暂停、清空和错误恢复。M5 原生权限人工场景可使用 Git 忽略的本地音频，但不得把文件名、路径或 hash 写进版本化证据。没有 fixture 时，明确记录未验证项。

## 调试顺序

- 先复现，再缩小到状态、DOM、音频节点或渲染循环。
- 优先读取现有响应式值、CSS 变量、RAF 句柄和对象所有权，不先加兼容分支。
- 对定位问题读取 `getBoundingClientRect()`；对播放问题读取 `audioSessionStore.playback`、AudioEngine source/offset 和 service generation；对渲染问题检查 canvas 数量、尺寸和控制台。
- 修复后复跑原始场景，并增加至少一个相邻失败或边界场景。

## 交付前检查

- `npm run build`
- 相关浏览器场景及控制台
- Markdown/配置改动的语法和链接检查
- `git diff --check`
- `git status --short` 与改动范围审计
- 明确列出未运行或不能通过的测试及原因
