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
| `npm run test:e2e:m11` | 顺序运行真实 Chrome/Edge 的 M11 专项四场景 | 三格式、键盘/reduced motion、多视口、quota、WebGL/RAF |
| `npm run test:e1:unit` | 运行 Editor JSON V1、初始工程和 strict validator 测试 | E1 codec 与边界契约 |
| `npm run test:e1:integration` | 运行 Editor lease、草稿、原子导入与 quota 测试 | E1 service/repository/controller 契约 |
| `npm run test:e2e:e1` | 运行 Chrome Editor 入口、picker、冲突和恢复场景 | E1 浏览器切片；不等于原生 OS picker 或 Edge |
| `npm run test:e2:unit` | 运行 Editor viewport、tempo map、grid 与 BPM golden | E2 pure/estimator 契约 |
| `npm run test:e2:integration` | 运行 Buffer retained PCM、tempo identity/stale、用户竞态与 E1/M6 回归 | E2 controller/coordinator 契约 |
| `npm run test:e2e:e2` | 运行 Chrome 波形、seek/zoom/pan、tempo 输入、boundary、恢复与多视口 | E2 Chrome 切片；Edge 留到 E6 |
| `npm run test:e3:unit` | 运行 point lane/class、迁移冲突、唯一性、吸附与 visible filter | E3 pure domain 契约 |
| `npm run test:e3:integration` | 运行 point/range round-trip、独立草稿、tempo 秒数稳定与 viewport 模型 | E3 persistence/compatibility 契约 |
| `npm run test:e2e:e3` | 运行 Chrome point 鼠标/键盘/右键、迁移、可见 DOM、range 身份兼容与多视口 | E3 Chrome 切片；Edge 留到 E6 |
| `npm run test:e4:unit` | 运行 overlay bounds、21 项 registry、六类 shared renderer 与 exact summary | E4 pure renderer 契约 |
| `npm run test:e4:integration` | 运行 Buffer-first、快速切换、重试、草稿和 Analyzer 隔离 | E4 consumer/controller 契约 |
| `npm run test:e2e:e4` | 运行 Chrome 21 项 overlay、三手柄、pointer-through、故障隔离和多视口 | E4 Chrome 切片；Edge 留到 E6 |
| `npm run test:e5:unit` | 运行 range lane/class、半开重叠、最短网格、端点与迁移冲突 | E5 pure domain 契约 |
| `npm run test:e5:integration` | 运行 point/range JSON、草稿、无效导入隔离与秒数稳定 | E5 persistence/compatibility 契约 |
| `npm run test:e2e:e5` | 运行 Chrome range 两阶段创建、端点、回滚、重叠、右键、键盘、overlay 穿透和多视口 | E5 Chrome 切片；Edge 留到 E6 |
| `npm run test:e6:unit` | 运行 10,000 事件确定性拓扑、范围边界、唯一 ID 与 visible filter | E6 压力工程纯契约 |
| `npm run test:e6:integration` | 运行 10,000 事件 JSON/IndexedDB round-trip 与无效导入原子隔离 | E6 persistence 压力契约 |
| `npm run test:e2e:e6` | 顺序运行真实 Chrome/Edge 的三格式、压力、无障碍和 20 次资源循环 | E6 双浏览器自动化；不替代原生 picker/辅助技术人工门禁 |
| `npm run test:e2e:e7` | 顺序运行真实 Chrome/Edge 的紧凑工具栏、平面分区、固定密度与多视口回归 | E7 布局自动化；截图只作人工补充 |
| `npm run test:e2e:edge` | 使用稳定 Edge 串行运行 M3–M11 全量 E2E | Edge 缺失时以退出码 2 明确 blocked；不得用 Chromium 替代 |
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
| `npm run eval:m11:provisional` | 在 dirty worktree 运行 M3–M11 的 38 步双浏览器 suite | 只生成实现反馈 |
| `npm run eval:m11` | 只在干净 commit 上运行 M3–M11 的 38 步双浏览器 suite | 生成可登记的 M11 canonical 证据 |
| `npm run eval:e1:provisional` | 在 dirty worktree 运行 E1 与适用 Analyzer 相邻回归 | 只生成实现反馈 |
| `npm run eval:e1` | 只在干净 commit 上运行 18 步 E1 suite | 生成可登记的 E1 canonical 证据 |
| `npm run eval:e2:provisional` | 在 dirty worktree 运行 E2 与 E1/M3/M4/M6/M11 相邻回归 | 只生成实现反馈 |
| `npm run eval:e2` | 只在干净 commit 上运行 22 步 E2 suite | 生成可登记的 E2 canonical 证据 |
| `npm run eval:e3:provisional` | 在 dirty worktree 运行 E3 与 E1/E2/M3/M4/M6/M11 相邻回归 | 只生成实现反馈 |
| `npm run eval:e3` | 只在干净 commit 上运行 26 步 E3 suite | 生成可登记的 E3 canonical 证据 |
| `npm run eval:e4:provisional` | 在 dirty worktree 运行 E4 与 E1–E3/Analyzer renderer 相邻回归 | 只生成实现反馈 |
| `npm run eval:e4` | 只在干净 commit 上运行 31 步 E4 suite | 生成可登记的 E4 canonical 证据 |
| `npm run eval:e5:provisional` | 在 dirty worktree 运行 E5 与 E1–E4/Analyzer 相邻回归 | 只生成实现反馈 |
| `npm run eval:e5` | 只在干净 commit 上运行 35 步 E5 suite | 生成可登记的 E5 canonical 证据 |
| `npm run eval:e6:provisional` | 在 dirty worktree 运行 40 步 E6 双浏览器 suite | 只生成实现反馈 |
| `npm run eval:e6` | 只在干净 commit 上运行 40 步 E6 suite | 生成可登记的 E6 canonical 证据 |
| `npm run eval:e7:provisional` | 在 dirty worktree 运行 46 步 E7/E6/M12 双浏览器 suite | 只生成实现反馈 |
| `npm run eval:e7` | 只在干净 commit 上运行 46 步 E7 suite | 生成可登记的 E7 canonical 证据 |
| `npm run fixtures:v1:golden` / `test:v1:unit` / `test:v1:integration` | 运行 V1 strict project、descriptor、route lease、单草稿和 session 专项 | 已实现；用于 V1 质量回归 |
| `npm run test:e2e:v1:chrome` / `test:e2e:v1:edge` | 在真实 Chrome/Edge 运行 V1 route/layout/resource 专项 | 原生 OS picker 仍需人工补偿 |
| `npm run eval:v1:provisional` | 在 dirty worktree 运行 21 步 V1 suite | 只生成实现反馈 |
| `npm run eval:v1` | 只在干净 implementation commit 上运行 21 步 V1 suite | canonical 21/21 已获 owner 批准 |
| `npm run fixtures:v2:golden` / `test:v2:unit` / `test:v2:integration` | 运行 V2 planner、projection、Editor snapshot 与 resolver 专项 | 已实现；用于 V2 质量回归 |
| `npm run test:e2e:v2:chrome` / `test:e2e:v2:edge` | 在真实 Chrome/Edge 运行 V2 inspector、四特征与 Editor 绑定专项 | 原生 Editor JSON picker 仍需人工补偿 |
| `npm run eval:v2:provisional` / `eval:v2` | dirty feedback / clean 26 步 canonical | clean 26/26 已登记并获 owner 批准 |
| `npm run fixtures:v3:golden` / `test:v3:unit` / `test:v3:integration` | V3 scene fixture、参数/余辉与 RendererHost 所有权专项 | implementation candidate 的纯逻辑与集成门禁 |
| `npm run test:e2e:v3` | Chrome 验证反馈、hash、DPR、switch/retry 与 20 次路由资源 | V3 浏览器门禁；不替代 owner 视觉验收 |
| `npm run eval:v3:provisional` / `eval:v3` | V2 26 步基线 + V3 四专项的 dirty/clean 30 步链 | canonical 必须绑定 clean implementation commit |
| `npm run fixtures:v4:golden` / `test:v4:unit` / `test:v4:integration` | V4 Cube fixture、64-band/seed/checkpoint state、默认绑定、host resource 与 context 专项 | 已批准 V4 quality contract；实现后进入门禁 |
| `npm run test:e2e:v4` | Chrome 验证 Cube 参数隔离、seek/hash、context recovery、三视口、键盘与 20 次资源循环 | V4 浏览器门禁；不替代 owner 视觉验收 |
| `npm run eval:v4:provisional` / `eval:v4` | V3 30 步基线 + V4 四专项的 dirty/clean 34 步链 | canonical 必须绑定 clean implementation commit |

## 已知测试缺口

- 已建立 Vitest、Playwright、Worker、IndexedDB、fixture、golden、docs 和 deliberate-failure harness。
- fixture/golden 生成改用 Node 24 原生 type stripping；不依赖在受限环境会产生 IPC `EPERM` 的 `tsx` CLI。
- 当前没有正式 CI，自动化结论必须限定为本地环境。
- Visualizer V1 clean canonical `V1-2026-09-02T07-03-26-973Z-fd44c892` 已在 commit `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` 上 21/21 通过，并于 2026-09-02 获 owner 人工批准；V1 已关闭，V2 数据绑定已开放。
- Visualizer V2 clean canonical `V2-2026-09-02T08-46-21-778Z-769faafe` 已在 commit `769faafeef576bf9b98a95f6904cdb9886298530` 上 26/26 通过，summary SHA-256 为 `18b7d83d68f068ac615c56e1bb844a3c80bb1460ac884116d94cb460dd07bafb`；evidence 已获 owner 批准，V2 关闭并开放 V3。
- Visualizer V3 已建立版本化 WAV/golden、单元/集成和 Chrome 专项；clean canonical 与 owner 人工验收已于 2026-09-03 获批准，V3 为 `Complete`，V4 为 `In Progress`，V5–V6 保持 `Planned`。
- 最终 dirty candidate 的 provisional `V3-2026-09-02T13-25-25-465Z-75cbf292-provisional` 已 30/30 通过，summary SHA-256 为 `20452afedc68ab351647464c3e6c3335e1e6def0290c2ba1d35105004648a46d`；它绑定 dirty worktree，仅允许进入 implementation commit，不得登记为 canonical。
- Visualizer V3 clean canonical `V3-2026-09-02T13-32-42-513Z-89be30eb` 已在 commit `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` 上 30/30 通过，summary SHA-256 为 `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84`；evidence 与人工门禁已于 2026-09-03 获 owner 批准。
- 当前机器已安装 Edge 151；M11 clean canonical 已使用真实 `msedge` channel 全量 31/31 通过。原生权限 prompt 不能由 OPFS 自动化替代；当前候选已由 `project-owner` 于 2026-08-26 完成人工补偿签字，相关实现或浏览器变化后须重做。
- 正式 M3 canonical run 已在 clean commit `17d16f0da37289c1f67f75203502beef999572ea` 上通过并登记，且已由 `project-owner` 批准。
- 正式 M4 canonical run 已在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过并登记，evidence 与 working agreements 已由 `project-owner` 批准。
- M5 自动化 picker 使用浏览器 OPFS 返回真实 `FileSystemFileHandle`；原生 OS picker 的 granted/prompt/denied 与文件移动路径已由 `project-owner` 于 2026-07-29 人工检查通过。
- M5 clean-commit canonical 已于 2026-07-29 在 `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上通过 16/16 并登记；evidence 与 working agreements 已获 owner 批准，M5 已关闭。
- 超出约 15 分钟支持边界的长音频未开始播放只作为非门禁压力观察；它不是规定的预期失败，也不能替代范围内性能或格式验证。
- M6 当前 Meyda 的 `spectralFlux` 对有效输入抛出 `x is not defined`；已用预期失败测试和 R-020 固定，不能把 21 项 registry 误述为 21 项均可计算。
- M6 dirty-worktree provisional 与 clean-commit canonical 均已 20/20 通过；正式 evidence 已登记，并由 `project-owner` 于 2026-07-30 批准，M6 已关闭。
- M7–M11 已获批准并关闭。M11 clean canonical `M11-2026-08-25T10-05-12-783Z-99c67792` 在 commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过；Edge 原生权限、辅助技术与最终加固于 2026-08-26 获 owner 签字。Analyzer readiness 已获 `Ready with waivers` 批准。Editor E1–E6 clean canonical 与人工门禁均已获批准；E7 compact workbench 44/44 run 因全屏浮层修订成为 `pre-revision`，修订版 46/46 clean canonical 已通过并等待 owner 审批。

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
