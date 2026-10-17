# AudioNotSurfYet 测试说明

2026-10-15：当前 Visualizer 为 Project V3 原子组合模型，使用 `npm run test:visualizer` 与 `npm run test:e2e:visualizer`。V1–V6 的结果、fixture、golden 和候选身份保持历史语境；旧模板专用测试及 npm 别名已退役，重放旧 canonical 需使用其原提交。

2026-10-17：视频生成已替换为[离线确定性导出](../docs/context/visualizer-offline-export.md)。`visualizer-output.spec.ts` 默认验证四档选择和能力拒绝；显式设置 `VISUALIZER_OUTPUT_MATRIX=1` 执行每档首次/重复同步片与音乐，共两浏览器 24 份文件。`VISUALIZER_OUTPUT_RUN` 隔离输出；`VISUALIZER_MUSIC_FILE` 可指定本地短音乐片，不记录源文件元数据。旧 `test:v5:unit` 命令现运行播放检查点和离线导出单元，不能用于声称历史 V5 候选通过。

媒体校验使用 `node tests/scripts/verify-visualizer-output.mjs <run-id> --all`；当前 `offline-frames-v3` 按真实音频 PTS 检查同步，并对离线视频检查精确帧数和每帧时间戳，离线文件不接受 `--allow-frame-drops`。`visualizer-offline-core.spec.ts` 验证 44.1/48kHz 分块编码、取消和存储失败，纳入日常 Visualizer 浏览器专项。长曲另显式设置 `VISUALIZER_EXPORT_LONG=1`，运行 `npx playwright test tests/e2e/visualizer-offline-long.spec.ts --project=chrome --project=edge --workers=1`，再以 `node tests/scripts/verify-visualizer-output.mjs offline-long --files-only` 核验；单文件模式不声称完整四档矩阵。十五分钟源按五秒块写入 OPFS，输出按 1MiB 切片保存到测试进程，不在测试端额外整体编码为 base64。

几何/PV 预设由 `tests/e2e/visualizer-presets.spec.ts` 覆盖：元素库、静音/实际频谱、V3 往返与刷新、四段构图、seek 确定性、全屏、WebM、context recovery 和资源释放。默认使用版本化短 WAV；可显式设置 `VISUALIZER_MUSIC_FILE` 运行额外的本地音乐截图检查，文件仅留本地，不加入 fixture manifest。当前视频按 owner 的居中修改验证水平/垂直中心，保持原几何精度。

原生输入另覆盖 Web Audio 左右异频 FFT、来源/可用特征切换、失败重试和暂停 seek 的画面一致性；`tests/visualizer/native-input.test.ts` 验证缓存上限、decoded revision/取消失效和严格 native binding。时间与资源边界见 [原生输入契约](../docs/context/visualizer-native-input.md)。

## 环境

2026-10-16 Editor 公共框架回归：`npx playwright test tests/e2e/editor-frame.spec.ts tests/e2e/editor-navigation-lifecycle.spec.ts --project=chrome --project=edge --workers=1`。覆盖三种播放器样式、动画留位、页签/菜单焦点、滚动保留、草稿失败、播放列表操作与运行中任务换歌保护；旧 E1–E10 交互专项已按常驻 MusicBar 和内部滚动更新，历史 canonical 身份不改写。布局契约见 [Editor 工作区](../docs/context/editor-workspace.md)。

2026-10-17 标记改版专项：`npx playwright test tests/e2e/editor-marking.spec.ts tests/e2e/editor-marking-layout.spec.ts --project=chrome --project=edge --workers=1`。覆盖菜单／轨道删除、细分偏好、手动定时／Tap、局部视口、单项移动及四视口／DPR 1–2 布局；截图存本地忽略目录 `artifacts/editor-marking/`。领域检查纳入 `npx vitest run tests/editor`；完整本轮回归范围和历史断言调整见[标记工作区](../docs/context/editor-marking.md)。

- Node.js：24.18.0；npm：11.x。仓库使用 `.nvmrc`、`engines` 和 `package-lock.json` 锁定基线。
- Vitest：4.1.10。官方已发布但当前 npm 镜像尚未提供 Vitest 5，因此使用镜像可获得且仍受支持的 4.1 版本。
- Playwright Test：1.62.0；必需浏览器为本机稳定版 Google Chrome 与 Microsoft Edge。
- FFmpeg：8.1.2；只用于生成和检查受控 WAV/MP3/FLAC fixture。
- 当前 Visualizer V1–V6 canonical 使用 Google Chrome 152.0.7977.66 与 Microsoft Edge 152.0.4191.53；V6 已在同一本机的真实 Chrome/Edge 执行三格式、长时压力和录制专项并获 owner 批准，浏览器缺失时仍明确报告失败/blocked。

M3–M14 不建设 CI。下列命令当前均为本地门禁；正式证据要求在干净 commit 上复跑。M3–M14 与 Editor E1–E9 canonical 均已获批准；E10 正在实施。E7 的 44/44 与 E9 首个 29/29 run 因后续修订成为 `pre-revision`；E7 修订版 46/46、E8 25/25 与 E9 revised 29/29 canonical 均已获 owner 批准。

当前 `npm audit` 在安全补丁更新后剩余 1 项 low：Vite 依赖的 esbuild 0.27.3 在 Windows 开发服务器场景存在本地任意文件读取风险。仓库目标验证机为 macOS，开发服务器不得暴露到不受信网络；依赖升级提供修复版本后复核。该缺口不被描述为已修复或生产 readiness。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 运行 `vue-tsc -b` |
| `npm run transcription:models` | 下载／校验 DEC-075 的 ADT_STR、Basic Pitch、六轨辅助公开模型；单元与真实浏览器命令见 [自动标记验证](transcription/README.md) |
| `npm run eval:editor-ft` / `eval:editor-ft:provisional` | DEC-072 Editor FT 接入：docs/assets/四图bytes/types/build、处理与Editor专项、Chrome/Edge真实四轨及E7–E10相关回归；保存candidate、截图/WAV身份和已知缺口，不关闭P1 |
| `npm test` | 执行全部非 E2E Vitest 测试 |
| `npm run test:unit` | PCM、容差和 isolated IndexedDB |
| `npm run test:worker` | Worker transfer、cancel 和 error harness |
| `npm run test:analysis` | direct-Meyda 首批 golden |
| `npm run test:fixtures` | manifest、SHA-256、字节数和 ffprobe |
| `npm run test:m4:unit` | AudioEngine 的 load/play/pause/seek/ended/stale/error/unload/dispose |
| `npm run test:m4:integration` | session/store 的队列、竞态、ended、删除、清空、metadata、RAF 与 URL |
| `npm run test:m5:unit` | PersistedSessionV1 validator、SHA-256、IndexedDB 原子 current Blob/cache、abort、删除与清空 |
| `npm run test:m5:integration` | Blob 优先、0 秒 paused、权限顺序、显式 request、missing/changed、quota 和取消 |
| `npm run test:m6:unit` | 21 项 registry、config hash、PCM/frame、聚合/量化、六类 compact codec 与损坏数据拒绝 |
| `npm run test:m6:worker` | 产品 workerCore 的 0/1/4 项、非法请求、yield/progress/cancel、错误与 exact cursor |
| `npm run test:m6:integration` | AnalysisCoordinator、partial cache、stale generation、quota 与 current Blob 原子持久化 |
| `npm run test:m7:unit` | viewport/zoom anchor/x↔time、renderer 数据变换、工作区不变量和 L1/L2/L3 版本化 golden |
| `npm run test:m7:integration` | 默认/已保存空工作区、卡片/viewport 持久化和 quota 后内存继续可用 |
| `npm run test:m8:unit` | 13 项 registry、12 项 direct Meyda、项目 Flux、静音/非有限值和 scalar axis/golden |
| `npm run test:m8:integration` | 四 scalar Worker、Flux exact cursor、四卡持久化、quota 和 13 项有限值回归 |
| `npm run test:m9:unit` | 三项 registry、direct Meyda、Power 平方关系、MFCC signed 量化、Buffer envelope/尾帧与 golden |
| `npm run test:m9:integration` | 四种混合 shape、cache codec、exact cursor、stale/cancel/quota 与四张累计卡回归 |
| `npm run test:m10:unit` | 21 项集合、direct Meyda、24/1024 维、零值、相位关系、结构 codec 与按固定容差校验的 golden |
| `npm run test:m10:integration` | Loudness/Complex 混合 shape、cache round-trip、exact cursor、stale/cancel/quota 与四卡持久化 |
| `npm run test:m12:unit` | Analyzer 置顶区高度上下限、短内容优先和用户比例裁剪 |
| `npm run test:m13:unit` | FIFO reducer、0–4 项、第五项淘汰、重开年龄、唯一性、置顶高度模型与 V1 adapter |
| `npm run test:m13:integration` | V1 双向兼容、串行 workspace 保存、revision guard、quota 与 M13 Coordinator cache/generation |
| `npm run test:e1:unit` | Editor JSON V1 初始工程、canonical round-trip、微秒规范化与 strict validator |
| `npm run test:e1:integration` | playback/analysis lease、独立 IndexedDB、同/异歌草稿、原子导入和 quota 后内存保留 |
| `npm run test:e2:unit` | Editor viewport/geometry、Tempo map、拍号/single-beat、BPM onset/autocorrelation 与 golden |
| `npm run test:e2:integration` | Buffer retained PCM、tempo identity/stale、JSON viewport/tempo round-trip 与 coordinator 回归 |
| `npm run test:e3:unit` | Editor point lane/class 命令、迁移冲突、微秒唯一性、显式细分吸附与可见事件过滤 |
| `npm run test:e3:integration` | point/range JSON 兼容、独立草稿恢复、tempo 秒数稳定与 viewport-visible 模型 |
| `npm run test:e4:unit` | Editor 历史 21 项 golden、当前 overlay registry、六类纯 Canvas renderer、bounds、Buffer 去重与 exact summary |
| `npm run test:e4:integration` | Buffer-first consumer、快速换特征、错误重试、Analyzer 隔离与 overlay 草稿恢复 |
| `npm run test:e5:unit` | Editor range lane/class、半开重叠、最短网格、端点更新、迁移冲突与可见范围过滤 |
| `npm run test:e5:integration` | point/range JSON 与草稿 round-trip、无效导入隔离、tempo 秒数稳定与稳定 ID |
| `npm run test:e6:unit` | 确定性 15 分钟/20 lane/160 分类/10,000 事件拓扑、唯一 ID、范围边界和可见事件过滤 |
| `npm run test:e6:integration` | 10,000 事件 JSON 与 IndexedDB round-trip、重叠工程原子拒绝和 durable draft 保留 |
| `npm run test:docs` | 生命周期 frontmatter、内部链接和 21 项特征计数 |
| `npm run test:harness` | 证明 deliberate failure 会非零退出 |
| `npm run test:skill:visualizer-scene-generator` | 校验 SceneBriefV1 完整/缺失/非法/装饰 binding、零副作用输出与 Skill 输入门禁 |
| `npm run test:e2e` | 稳定 Chrome 的全部当前 E2E |
| `npm run test:e2e:m3` | M3 应用、Worker、IndexedDB 和三格式 smoke |
| `npm run test:e2e:m4` | M4 播放/队列/错误/资源回归及 60 秒计时 |
| `npm run test:e2e:m5` | Chrome 真实 IndexedDB/OPFS handle 的导入、刷新、current Blob、未知 schema 与清空 |
| `npm run test:e2e:m6` | Chrome 真实 module Worker、cache refresh、exact cursor、20 次资源循环和 15 分钟性能/取消 |
| `npm run test:e2e:m7` | Chrome 21 固定卡/FIFO 兼容回归、共享 zoom/cursor、点击/键盘 seek、30Hz 合并、刷新恢复、DPR/视口与单卡错误隔离 |
| `npm run test:e2e:m8` | Chrome 390/1024/1280/1920、四卡/16 项、UI hardening、13 项 scalar renderer 与刷新恢复 |
| `npm run test:e2e:m9` | Chrome Header 路由样式、四卡/19 项、Power/MFCC/Buffer renderer 与刷新恢复 |
| `npm run test:e2e:m10` | Chrome 四卡/21 项、Loudness/Complex renderer、完整 1024 bins、刷新恢复与 15 分钟四重卡性能 |
| `npm run test:e2e:m11:chrome` | Chrome 三格式/分析/恢复、键盘/焦点/reduced motion、多视口、quota 和 20 次 WebGL/RAF 生命周期 |
| `npm run test:e2e:m11:edge` | 使用真实 Edge 执行 M11 专项 hardening 场景 |
| `npm run test:e2e:m11` | 顺序执行真实 Chrome 与 Edge 的 M11 专项场景 |
| `npm run test:e2e:m12:chrome` | Chrome 执行 Analyzer 单列行、说明折叠、renderer 隔离和 Observer 清理 |
| `npm run test:e2e:m12:edge` | 使用真实 Edge 执行同一 Analyzer 单列/说明/资源专项套件 |
| `npm run test:e2e:m12` | 顺序执行真实 Chrome 与 Edge 的 Analyzer 单列/说明/资源专项套件 |
| `npm run test:e2e:m13:chrome` | Chrome 执行 21 卡、懒挂载、FIFO、快速切换、V1 恢复和四视口专项 |
| `npm run test:e2e:m13:edge` | 使用真实 Edge 执行同一 M13 全卡/FIFO 专项套件 |
| `npm run test:e2e:m13` | 顺序执行真实 Chrome 与 Edge 的 M13 专项套件 |
| `npm run test:e2e:e1` | Chrome Header/播放列表入口、“去编辑”、MusicBar 显隐、JSON picker、草稿冲突和刷新恢复 |
| `npm run test:e2e:e2` | Chrome 波形、seek、wheel/right-pan/menu、tempo boundary、输入边界、恢复与多视口 geometry |
| `npm run test:e2e:e3` | Chrome point lane/class、鼠标/键盘/右键标记、迁移对话框、可见 DOM、range 身份兼容与多视口 geometry |
| `npm run test:e2e:e4` | Chrome 当前注册特征单选 overlay、六类 renderer、三手柄、pointer-through、错误隔离与多视口 geometry |
| `npm run test:e2e:e5` | Chrome range 创建/预览/取消/端点/重叠/迁移、右键、键盘、overlay 穿透、恢复与多视口 geometry |
| `npm run test:e2e:e6:chrome` | Chrome 三格式、工程失败隔离、10,000 事件、反馈/长任务、虚拟化、无障碍与 20 次资源循环 |
| `npm run test:e2e:e6:edge` | 使用真实 Edge 执行同一 E6 最终加固套件 |
| `npm run test:e2e:e6` | 顺序执行真实 Chrome 与 Edge 的 E6 最终加固套件 |
| `npm run test:e2e:e7:chrome` | Chrome 执行双层工具栏、平面分区、30/44/152/144/88px 当前密度与多视口功能回归；E7 历史 176px 证据不改写 |
| `npm run test:e2e:e7:edge` | 使用真实 Edge 执行同一 E7 紧凑工作台套件 |
| `npm run test:e2e:e7` | 顺序执行真实 Chrome 与 Edge 的 E7 紧凑工作台套件 |
| `npm run test:e7:unit` | E7 visibility/default/menu/active-set 纯逻辑 |
| `npm run test:e7:integration` | E7 preference、刷新/导入、analysis 收敛与写失败 |
| `npm run test:e8:unit` | E8 时间轴垂直几何与 unavailable recovery 纯决策 |
| `npm run test:e8:integration` | E8 同歌恢复、route generation 与草稿原子性 |
| `npm run test:e2e:e8:chrome` | 使用真实 Chrome 执行 E8 四视口、同/异歌恢复与 marker 中心套件 |
| `npm run test:e2e:e8:edge` | 使用真实 Edge 执行同一 E8 可用性套件 |
| `npm run test:e2e:e8` | 顺序执行真实 Chrome 与 Edge 的 E8 可用性套件 |
| `npm run test:e9:unit` | E9 tempo boundary 删除、前段延伸、紧凑三级展示和 shared geometry |
| `npm run test:e9:integration` | E9 JSON V1/autosave、event seconds、stale estimate 与 keyed draft/error cleanup |
| `npm run test:e2e:e9:chrome` / `test:e2e:e9:edge` | 真实 Chrome/Edge 的 28px 合并 BPM 条、向上 guide、11px 无框输入、共享滚动、右键/键盘和 marker/category/divider 几何 |
| `npm run test:e2e:e9` | 顺序执行真实 Chrome 与 Edge 的 E9 专项 |
| `npm run test:e10:unit` | E10 measure selection、半开收集、连续复制、ID 与原子冲突纯逻辑 |
| `npm run test:e10:integration` | E10 整批 autosave、刷新、JSON V1 round-trip 与模式外行为隔离 |
| `npm run test:e2e:e10:chrome` / `test:e2e:e10:edge` | 真实 Chrome/Edge 的紧凑拍号、区间操作 pointer/键盘与深色离页 dialog |
| `npm run test:e2e:e10` | 顺序执行真实 Chrome 与 Edge 的 E10 专项；环境阻断时只记 unverified |
| `npm run test:visualizer` | 当前 Project V3 strict codec、原子组合/解析/渲染、会话、保存失败与异步失效，以及共享 host/离线导出专项 |
| `npm run test:e2e:visualizer` | Chrome/Edge 当前元素工作区、布局、GPU 像素、全屏、离线编码、换歌/草稿保护、资源释放和保存取消；短 WebM 保留在本地 artifacts/visualizer-composition/ |
| `npm run test:e2e:visualizer-layout` | 顺序执行 Chrome/Edge 当前原子元素一屏工作台、双侧滚动隔离、compact drawer 与共享 scrollbar 专项 |
| `npm run test:e2e:edge` | 使用真实 Edge 执行全部 M3–M11 E2E；缺失时明确 blocked |
| `npm run build` | TypeScript project build 和 Vite production build |
| `npm run eval:m3:provisional` | 在未提交工作树生成本地 provisional run |
| `npm run eval:m3` | 只允许在干净 commit 上生成 canonical M3 run |
| `npm run eval:m4:provisional` | M3 回归 + M4 suite 的 dirty-worktree provisional run |
| `npm run eval:m4` | 只允许在干净 commit 上执行 M3 回归 + M4 suite 并生成 canonical run |
| `npm run eval:m5:provisional` | M3/M4 回归 + M5 repository/recovery/Chrome suite 的 dirty-worktree provisional run |
| `npm run eval:m5` | 只允许在干净 commit 上执行 M3–M5 suite 并生成 canonical run |
| `npm run eval:m6:provisional` | 在 dirty worktree 执行 M3–M6 回归并生成本地实现反馈 |
| `npm run eval:m6` | 只允许在干净 commit 上执行 M3–M6 suite 并生成可登记的 canonical run |
| `npm run eval:m7:provisional` | 在 dirty worktree 执行 M3–M7 回归并生成本地实现反馈 |
| `npm run eval:m7` | 只允许在干净 commit 上执行 M3–M7 suite 并生成可登记的 canonical run |
| `npm run eval:m8:provisional` | 在 dirty worktree 执行 M3–M8 的 28 步回归并生成实现反馈 |
| `npm run eval:m8` | 只允许在干净 commit 上执行 M3–M8 28 步 suite 并生成 canonical run |
| `npm run eval:m9:provisional` | 在 dirty worktree 执行 M3–M9 的 32 步回归并生成实现反馈 |
| `npm run eval:m9` | 只允许在干净 commit 上执行 M3–M9 32 步 suite 并生成 canonical run |
| `npm run eval:m10:provisional` | 在 dirty worktree 执行 M3–M10 的 36 步回归并生成实现反馈 |
| `npm run eval:m10` | 只允许在干净 commit 上执行 M3–M10 36 步 suite 并生成 canonical run |
| `npm run eval:m11:provisional` | 在 dirty worktree 执行 M3–M11 的 38 步双浏览器回归并生成实现反馈 |
| `npm run eval:m11` | 只允许在干净 commit 上执行 M3–M11 38 步双浏览器 suite 并生成 canonical run |
| `npm run eval:m12:provisional` | 在 dirty worktree 执行 M12 unit/双浏览器与 M7–M11 相邻回归的 12 步实现反馈 |
| `npm run eval:m12` | 只允许在干净 commit 上执行 M12 12 步 suite 并生成 canonical run |
| `npm run eval:m13:provisional` | 在 dirty worktree 执行 M13 与 M7–M12、Editor E7、双浏览器及构建的 17 步实现反馈 |
| `npm run eval:m13` | 只允许在干净 commit 上执行 M13 17 步 suite 并生成 canonical run |
| `npm run eval:e1:provisional` | 在 dirty worktree 执行 E1 与 M3/M4/M6/M11 相邻回归并生成实现反馈 |
| `npm run eval:e1` | 只允许在干净 commit 上执行 18 步 E1 canonical suite 并生成可登记证据 |
| `npm run eval:e2:provisional` | 在 dirty worktree 执行 E2 与 E1/M3/M4/M6/M11 相邻回归并生成反馈 |
| `npm run eval:e2` | 只允许在干净 commit 上执行 E2 canonical suite 并生成可登记证据 |
| `npm run eval:e3:provisional` | 在 dirty worktree 执行 E3 与 E1/E2/M3/M4/M6/M11 相邻回归并生成反馈 |
| `npm run eval:e3` | 只允许在干净 commit 上执行 E3 canonical suite 并生成可登记证据 |
| `npm run eval:e4:provisional` | 在 dirty worktree 执行 E4 与 E1–E3/Analyzer renderer 相邻回归并生成反馈 |
| `npm run eval:e4` | 只允许在干净 commit 上执行 31 步 E4 canonical suite 并生成可登记证据 |
| `npm run eval:e5:provisional` | 在 dirty worktree 执行 E5 与 E1–E4/Analyzer 相邻回归并生成反馈 |
| `npm run eval:e5` | 只允许在干净 commit 上执行 35 步 E5 canonical suite 并生成可登记证据 |
| `npm run eval:e6:provisional` | 在 dirty worktree 执行 40 步 E6 双浏览器最终回归并生成实现反馈 |
| `npm run eval:e6` | 只允许在干净 commit 上执行 40 步 E6 canonical suite 并生成可登记证据 |
| `npm run eval:e7:provisional` | 在 dirty worktree 执行 46 步 E7 全屏浮层、密度、E6 基线和 M12 双浏览器回归 |
| `npm run eval:e7` | 只允许在干净 commit 上执行 46 步 E7 canonical suite 并生成可登记证据 |
| `npm run eval:e8:provisional` | 在 dirty worktree 执行 25 步 E8 与 E1/E2/E3/E7、M5、双浏览器及静态回归，只生成 scoped artifact |
| `npm run eval:e8` | 只允许在干净 E8 implementation commit 上执行 25 步 canonical suite；dirty worktree 必须拒绝 |
| `npm run eval:e9:provisional` | 在 dirty worktree 执行 E8 25 步基线加 E9 四专项的 29 步实现反馈 |
| `npm run eval:e9` | 只允许在干净 E9 implementation commit 上执行 29 步 canonical suite；DEC-052 revised canonical 已 29/29 |
| `npm run eval:e10:provisional` | 在 dirty worktree 执行 E9 29 步基线加 E10 四专项的 33 步实现反馈 |
| `npm run eval:e10` | 只允许在干净 E10 implementation commit 上执行 33 步 canonical suite；浏览器未验证时不得登记通过 |
| `npm run eval:editor-readiness:provisional` | 在 dirty worktree 对固定 E9 runtime candidate 执行 24 步针对性 readiness 审计；只生成本地反馈 |
| `npm run eval:editor-readiness` | 只允许从 clean HEAD 执行 24 步 E4–E9/双浏览器/静态门禁，并要求相对 E9 implementation 的 `src/` 无漂移 |

## 目录职责

- `tests/unit/`：纯函数与可控浏览器 API adapter。
- `tests/audio/`：M4 AudioEngine fake clock 与 AudioSessionService/store 集成。
- `tests/persistence/`：M5 原生 IndexedDB adapter、schema 和事务故障注入。
- `tests/worker/`：M3 harness、M6 基线、M8 scalar/Flux、M9 vector/waveform 与 M10 structured 产品 workerCore 合约测试。
- `tests/analysis/`：direct-Meyda extractor、committed golden、M6 platform、M7 viewport/学习、M8 scalar/Flux、M9 vector/waveform、M10 structured、置顶高度模型与 M13 FIFO/V1 adapter。
- `tests/fixtures/`：确定性生成器、短格式文件、许可、manifest 与重建校验。
- `tests/e2e/`：由 Playwright 对真实 Chrome/Edge channel 执行的浏览器场景；只有实际命令通过后才声明对应浏览器证据。
- `tests/docs/`：生命周期文档和特征计数检查。
- `tests/harness/`：被正常 Vitest 配置排除的 deliberate failure 及其自检。
- `tests/scripts/`：浏览器检测和 M3–M14、Editor、Visualizer run orchestration。
- `tests/editor/`：Editor 工程格式、草稿、lease 和 session controller 的里程碑专项测试。
- `tests/visualizer/`：Project V3 codec/引用、确定性元素合成、RendererHost、离线导出状态机与当前生命周期回归。

M4 浏览器测试中的损坏 WAV 与 65 秒、48kHz、单声道计时 WAV 都写入 `test-results/`，不提交二进制。长时钟测试用同一 DOM 采样同时读取 `performance.now()` 与 AudioContext 驱动快照；三次 seek 使用进度条真实几何。

M5 浏览器测试把受控 fixture 写入浏览器 OPFS，再由注入的 `showOpenFilePicker()` 返回真实 `FileSystemFileHandle`。它覆盖真实 IndexedDB structured clone、刷新和 current Blob，但不会制造或宣称原生权限提示通过；Chrome OS picker 的 granted/prompt/denied、恢复访问和文件临时移动必须另做人工检查。

M6 浏览器测试通过 DEV-only bridge 选择四项支持特征、读取可序列化状态并请求 exact cursor；bridge 不暴露 File、PCM、AudioBuffer 或 Worker。15 分钟确定性 silence WAV 在 OPFS 分块生成，覆盖单调进度、取消、输入反馈 ≤100ms、无分析归因 >50ms 主线程任务和资源生命周期。`spectralFlux` 的当前 Meyda 异常以预期失败断言固定，不计为支持项。

M7 浏览器测试运行时生成 Git 忽略的 `m7-learning-v1.wav`，版本化数值输入保存在 `m7-learning.v1.json`。Chrome 场景覆盖首次默认三卡、已保存空/单卡恢复、重复禁用、共享 zoom/seek、每特征最多 30Hz exact cursor 请求、≤100ms seek 可见反馈、1024/1280/1920、DPR、reduced motion 和单卡 Canvas context 错误隔离。

M8 浏览器测试运行时生成 Git 忽略的 `m8-scalars-v1.wav`，版本化数值输入保存在 `m8-scalars.v1.json`。Chrome 场景覆盖 390/1024/1280/1920、第四卡、累计 feature set 回归、静音 Energy 0、瞬态 Flux、所有 13 项 scalar renderer/exact cursor 和刷新恢复；M7 Chrome 回归覆盖 sticky、播放器/歌曲列表层级、pressed 与主题滚动条。Windows Chrome pressed 状态已由 owner 补偿复核并批准。

M9 浏览器测试运行时生成 Git 忽略的 `m9-vectors-v1.wav`，版本化数值输入保存在 `m9-vectors.v1.json`。Chrome 场景覆盖首页透明/非首页 18px blur、当前累计 feature set、Power Spectrum 512、MFCC 13、Buffer 1024、双 Canvas、鼠标/键盘 seek、四卡/视口刷新恢复和 390/1024/1280/1920。

M10 浏览器测试运行时生成 Git 忽略的 `m10-structures-v1.wav`，版本化数值输入保存在 `m10-structures.v1.json`。Chrome 场景覆盖累计 21 项、Loudness total/24 Bark bands、Complex Spectrum 完整 1024 bins 与 signed Hz、两类 320px 双 Canvas、鼠标/键盘 seek、刷新恢复、多视口/reduced motion，以及 15 分钟 Loudness/Complex/Power/Buffer 四重卡反馈与长任务门禁。

M11 专项浏览器测试在同一文件上分别运行真实 Chrome/Edge，覆盖三格式队列切换、Analyzer 结果与刷新恢复，键盘播放/进度/Analyzer seek、可见焦点、reduced motion、390/1024/1280/1920 几何、quota 后内存播放，以及 20 次 Home/Analyzer 生命周期中的 WebGL context 与 RAF 上界。`test:e2e:edge` 还会在 Edge 上执行 M3–M10 全部回归。OPFS handle 自动化与原生 OS picker 权限提示继续分开；当前候选的 Edge 原生权限与最终人工加固已由 owner 于 2026-08-26 签字，相关实现或浏览器变化后仍须重做人工矩阵。

M12 浏览器命令当前覆盖真实 Chrome/Edge 单列、说明折叠和十次路由资源释放。M7–M11 几何断言统一检查单列、完整21项、原列表默认顺序和无横向溢出，详情见 [当前 Analyzer 契约](../docs/context/analyzer-list.md)。

M13 浏览器测试断言21项完整唯一、默认0 Canvas、展开才分析、四项FIFO/八Canvas、刷新恢复和details重开复位。置顶区倒序FIFO，未活动项固定默认顺序；M14浏览器命令当前覆盖可调高度、阅读锚点、归位和图表内滚轮缩放。

E1 Chrome 测试使用注入 picker 返回浏览器 OPFS `FileSystemFileHandle`，覆盖 Header 当前歌曲、播放列表指定歌曲、“去编辑”Tooltip、MusicBar 条件隐藏、repeat-one 控件、JSON 导出、刷新暂停恢复、异歌草稿冲突、无效导入隔离和空/无效路由。它不替代原生 OS picker、浏览器离页提示或 Edge；这些缺口按 Editor eval plan 留给 owner/E6 补偿门禁。

E2 使用版本化 `editor-e2-tempo.v1.json` 锁定 60、100、128、127.5 BPM 与 silence/noise/ambiguous 低置信度输入；`fixtures:e2:golden` 同时生成 Git 忽略的 `artifacts/fixtures/editor-e2-tempo-100-v1.wav`。Chrome 场景覆盖波形、网格、游标三层 Canvas、共享 viewport、右键状态机、Tempo 边界与输入、自动估计竞态、刷新恢复和 1024/1280/1920 geometry。

E3 使用版本化 `editor-e3-points.v1.json` 固定 100 BPM、1/16–1 beat 自适应吸附、歌曲首尾和 point 事实；`fixtures:e3:golden` 同时生成 Git 忽略的 `artifacts/fixtures/editor-e3-points-v1.wav` 与 range 身份兼容工程。Chrome 场景覆盖 point lane/class、创建/删除/重复、分类迁移、右键 pan/menu、键盘、viewport-visible DOM、reduced motion 与三档视口 geometry；E3 已获 owner 批准并关闭，E5 开放后相邻回归会确认同一 range ID 仍可见。

E4 使用版本化 `editor-e4-overlay.v1.json` 固定 21 项 feature/renderer 映射、0.10/0.35/0.12 bounds 和共享时间锚点；`fixtures:e4:golden` 同时生成 Git 忽略的 `artifacts/fixtures/editor-e4-overlay-v1.wav` 与 JSON 工程。Chrome 场景覆盖 21 项选择、六类 renderer、三手柄、pointer-through、Canvas 故障隔离和 1024/1280/1920 geometry；E4 已获 owner 批准并关闭。

E5 使用版本化 `editor-e5-ranges.v1.json` 固定半开区间、相邻允许、同分类防重叠、跨分类重叠、最短自适应网格和 point-in-range 语义；`fixtures:e5:golden` 同时生成 Git 忽略的 `artifacts/fixtures/editor-e5-ranges-v1.wav` 与 JSON 工程。Chrome 场景覆盖两阶段创建、取消、端点调整与回滚、迁移冲突、右键优先级、键盘、overlay 穿透和 1024/1280/1920 geometry。

E5 clean canonical `E5-2026-08-27T11-03-22-177Z-78124177` 在 commit `781241772e05186e2fe0d006ed6ddd8bceded7af` 上 35/35 通过，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`；`project-owner` 于 2026-08-27 批准 E5 canonical 与人工范围任务，E5 为 `Complete`、E6 为 `In Progress`。

E6 quality contract 固定真实 Chrome/Edge、WAV/MP3/FLAC、15 分钟 20 lanes/160 classes/10,000 events、`<=100ms` 反馈、无归因任务 `>50ms`、viewport-visible DOM、20 次资源循环与人工 native/辅助技术补偿。clean canonical `E6-2026-08-27T15-52-33-466Z-17d7fe10` 在 commit `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` 上 40/40 通过，summary SHA-256 为 `8f81b877dc5993bcdd4d04064e85c96156c946f2c62066c2b8571dfbc8473b6e`；owner 于 2026-08-28 批准 E6 与人工补偿，E6 为 `Complete`。

E7 双浏览器套件固定验证紧凑令牌、窗口级 fixed 灰色 overlay、复合入口与 21 项菜单、按歌曲 visibility、关闭后的 Buffer-only active set、纵向滚动固定、时间列横向对齐、390/1024/1280/1920 响应式与既有交互回归。46 步 canonical 继续完整复用 E6 基线与 M12 双浏览器回归。

E7 clean run `E7-2026-08-28T15-02-48-298Z-78bc7f06` 在 commit `78bc7f06311a09948e5efae941a14599305b81a5` 上 44/44 通过，summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`；全屏浮层修订后该 run 为 `pre-revision`。修订版 clean run `E7-2026-08-29T05-23-03-986Z-080f577f` 在 commit `080f577fe20fcb22a20184dce0b15892c5299464` 上 46/46 通过，summary SHA-256 为 `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5`；owner 于 2026-08-31 批准并关闭 E7。

E8 双浏览器套件固定验证 390/1024/1280/1920 的 `72/88/88/88px` stage、6px 波形安全区、Canvas DPR、同一 URL 歌曲恢复保持 paused、异歌显式 replace 入口，以及 zoom/pan 后 marker/diamond/candidate 中心 `<=1 CSS px`。25 步 runner 回归 E1/E2/E3/E7、M5、docs、harness、typecheck、build 和 diff check；dirty run 不登记 evidence index。

E8 最新 scoped run `E8-2026-09-03T04-04-25-163Z-10a2bc0c-provisional` 在 V5 已独立提交的基线上 25/25 通过，summary SHA-256 为 `829e50c177b14bb81febc81577c179deec0a01d703362083ebf2fa28bc7e5c0a`；Chrome/Edge 最大 marker/diamond/candidate/pin 中心误差均为 `0.009375 CSS px`。较早的 `E8-2026-09-03T03-23-23-119Z-cc83d8b1-provisional`、`E8-2026-09-03T03-27-19-090Z-cc83d8b1-provisional` 与 `E8-2026-09-03T03-41-39-925Z-cc83d8b1-provisional` 分别保留为 recovery signature、candidate box 居中及 V5/E8 分离提交前反馈。所有 provisional run 均绑定 dirty worktree，不是 canonical，不进入 evidence index。

E8 clean canonical `E8-2026-09-03T04-07-28-904Z-84d9435c` 在 implementation commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 上 25/25 通过，起止工作树干净，summary SHA-256 为 `ba9ff8db30868c8bf34140a3db2bf8cd7e3d56557ca7ac8682dfa6c3ce664a42`。Chrome/Edge E8 各 3/3，四视口高度为 `72/88/88/88px`，最大中心误差 `0.009375 CSS px`；E7、E3、E2、E1、M5 与静态门禁全部通过。owner 已批准 evidence 与人工门禁，E8 为 `Complete`。

E9 quality contract 已由 2026-09-04 的完整实施指令批准。DEC-051 固定共享 viewport、full/summary/hidden 单行展示、内部 boundary 前段延伸删除、3px point candidate、分类按钮居中和单 divider；DEC-052 把独立 tempo row 修订为紧贴波形的 28px BPM 条、12px 向上 guide 与 11px/18px 无框输入。E8 canonical 与 artifact 保持历史不变。首个 run `E9-2026-09-04T02-49-18-960Z-cf0a79b1` 保持 `pre-revision`；implementation `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 的 revised run `E9-2026-09-04T03-51-33-088Z-13614673` 已 29/29 通过，summary SHA-256 为 `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c`。owner 已批准 evidence 与人工门禁，E9 为 `Complete`、R-042 为 `Mitigated`；Editor readiness 为独立后续门禁。

Editor readiness runner 固定运行时候选为 E9 implementation `13614673bbf4d824f2ee109d36e04de6b3f8aabd`，共 24 步：E4/E5 各四步、E6 四步、E7/E8/E9 双浏览器六步，以及 docs/Harness/typecheck/build/diff/source identity 六步。clean 命令拒绝 dirty worktree，且最后一步同时检查已提交与工作树中的 `src/` 漂移；artifact 使用 `EDITOR-RR-<timestamp>-<commit>`，provisional 不进入正式 evidence。

E10 quality contract 已由完整实施指令批准。DEC-057/ADR-0022 固定瞬时区间操作模式、起始 lane/class 内按真实小节右拖选择、Cmd/Ctrl+C 向后连续复制、左拖吸附移动、整批原子冲突拒绝与页面自有深色离页 `<dialog>`。E10 canonical 设计为 E9 的 29 步加 E10 unit/integration/Chrome/Edge，共 33 步；按 DEC-055 无法执行的浏览器项必须保留 `unverified / owner-review`。E10 修改产品 `src/`，因此原 E9 readiness candidate 仅保留为 `pre-E10`。

readiness provisional `EDITOR-RR-2026-09-04T07-28-02-425Z-41afe431-provisional` 在相同 runtime source tree 上 24/24 通过，summary SHA-256 为 `8963fb95b8dd5b168ce0f9da03ea04d8a0e922e9c4ebf2e6ca2637fe1a99bed4`，但因 dirty worktree 只作反馈。clean attempt `EDITOR-RR-2026-09-04T07-40-29-751Z-788be6bb` 的 14 个非浏览器步骤通过，10 个浏览器步骤均因沙箱 `listen EPERM 127.0.0.1:4173` 未启动，summary SHA-256 为 `d0221d5b35ddf499fa5895eb567db202321fb3bfdd4a85818c0bdc6651d4096d`。owner 已指示跳过沙箱外重跑并自行审阅相关 gap；不得把该 clean artifact 记为 pass。

Visualizer V1 quality 契约、实现和双浏览器 runner 已完成。clean canonical `V1-2026-09-02T07-03-26-973Z-fd44c892` 在 commit `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` 上 21/21 通过，summary SHA-256 为 `14c9ed2258baf6c9a2a3a20dfcaba65a0c643029f8510a1d9e4c6662c9c90300`；unit 12/12、integration 7/7、Chrome 4/4、Edge 4/4，并于 2026-09-02 获 owner 批准。V2 数据绑定已开放，真实场景/录制仍不得提前进入。

Visualizer V2 已实现 constant/analysis/editor-event inspector、0–4 唯一特征 planner、FeatureRegistry projection、同歌 Editor snapshot 与 60Hz absolute-time resolver。clean canonical `V2-2026-09-02T08-46-21-778Z-769faafe` 在 commit `769faafeef576bf9b98a95f6904cdb9886298530` 上 26/26 通过，summary SHA-256 为 `18b7d83d68f068ac615c56e1bb844a3c80bb1460ac884116d94cb460dd07bafb`；golden 2/2、unit 6/6、integration 5/5、Chrome 3/3、Edge 3/3。Evidence 已于 2026-09-02 获 owner 批准；V2 关闭并开放 V3 真实场景。

Visualizer V3 quality contract 固定 `visualizer-v3-lines-v1.wav` 与版本化 scene golden、单 `VisualizerRendererHost`、单 quad/shader、横竖参数隔离、point/range/analysis/constant、60Hz scene-local decay、一秒 checkpoint、同时间 frame-state hash、scene error/retry、1024/1280/1920、DPR、键盘和 20 次资源循环。原 V3 canonical 当时以 V4 中性场景验证切换；V4 实现后，当前前向回归改为真实 Cube scene 同 host 切换，历史 artifact 不修改。clean canonical `V3-2026-09-02T13-32-42-513Z-89be30eb` 在 commit `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` 上 30/30 通过，summary SHA-256 为 `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84`，正式 evidence 与人工门禁已于 2026-09-03 获 owner 批准。

Visualizer V4 Cube Swarm 使用共享 BoxGeometry、两个 MeshStandardMaterial、三个 InstancedMesh、默认 Amplitude Spectrum/Energy 双分析、60Hz rise/orbit checkpoint 与同 RendererHost context recovery。clean canonical `V4-2026-09-02T17-47-40-271Z-5c2d24a3` 已在 commit `5c2d24a3f1f413dba236563b3686237c6b8f2e21` 上 34/34 通过，summary SHA-256 为 `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2`。Owner 已批准并关闭 V4。

Visualizer V5 使用唯一 pre-Gain audio tap、同一 Canvas capture lease 和原生 MediaRecorder/save picker。clean canonical `V5-2026-09-03T03-49-31-211Z-9b5af09c` 已在 implementation commit `9b5af09c5846415a8e5465e710e6095f1e7db310` 上 40/40 通过，summary SHA-256 为 `cec1fab0310852458c2aa4fbd3bebc90eee3e213a54b7695a524736e07b07b7b`；Chrome/Edge 默认 720p30 的四个 Orthogonal/Cube 文件均通过 ffprobe/FFmpeg，三个 optional preset 在 preflight 返回 typed `preset-unavailable`。canonical 与 owner 原生保存/回放门禁均已批准；V5 已关闭。

Visualizer V6 新增版本化 hardening golden、同歌曲会话内的模板 binding 恢复、renderer 当前歌曲时间/帧时间诊断和测试专用资源探针。Chrome/Edge 专项分别使用 MP3 四特征 Cube、WAV Editor Orthogonal，以及完成 4→2→4 恢复证明后的 FLAC Orthogonal，确保每浏览器三个默认 720p30 WebM 覆盖三格式和两个模板；另覆盖 900 秒 OPFS 四特征压力、20 次 route/template/record/context lifecycle、响应与时钟阈值。重复媒体采样后 DEC-048 固定关闭 MSAA、video `motion` hint 与等价 Cube 计算优化，并把 V6 三格式 packet-gap 容忍设为最多四个目标帧间隔、Visualizer frame 峰值设为 `<60ms`；平均 30fps `±5%`、分析归因 `<50ms` 与其余媒体门禁不变，V5 阈值不改。clean canonical `V6-2026-09-03T16-33-03-497Z-ef12ce39` 已在 implementation commit `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` 上 54/54 通过，summary SHA-256 为 `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014`；2026-09-04 owner 批准 evidence 与人工门禁，V6 已关闭。

post-V6 DEC-050 viewport 修订在 clean commit `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` 上通过 Chrome/Edge layout 专项各 2/2、V1 各 4/4、V6 integration 10/10 与 Analyzer M7 Chrome 5/5。专项覆盖 `1024×720`、`1280×720/900`、`1920×1080`、DPR 1/2、document 无纵向滚动、左右 panel 隔离、边界不 chaining、compact drawer、共享 `.app-scrollbar` 和单 Canvas/renderer/视觉 RAF；这不是新的 V6 canonical，release-readiness 仍待 owner 视觉确认。

V1 quality contract 固定 AC-V101–AC-V108、V1-G01–G12、VFT-ROUTE/LEASE/PROJECT/DRAFT/FILE/LAYOUT/RESOURCE、21 步 clean canonical，以及 Chrome/Edge 原生 picker、覆盖提示和 `beforeunload` 人工补偿。V1/evidence 已批准，R-034 为 `Mitigated`；V2 批准后 R-036 也为 `Mitigated`，R-038 继续由真实 renderer 里程碑验证。

E2 clean canonical `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 已在 commit `9fc5c0a81fcf90abfbc665412277147cd958200f` 上 22/22 通过，summary SHA-256 为 `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660`；2026-08-27 owner 批准该结果并开放 E3。

E3 clean canonical `E3-2026-08-27T02-53-58-176Z-c670ddf5` 已在 commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef` 上 26/26 通过，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`；point 反馈 `28.5ms`、几何误差 `0 CSS px`，并已获 owner 批准。

E4 clean canonical `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 已在 commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` 上 31/31 通过，summary SHA-256 为 `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff`；overlay/point 几何误差 `1 CSS px`、穿透点击反馈 `5.1ms`，并已获 owner 批准。

2026-07-29，`project-owner` 按下列清单完成最新版稳定 Chrome 原生权限人工检查并确认通过。该签字不保存本地音频的文件名、路径、内容或 hash，也不替代 Edge 验证。

## M5 原生权限人工检查

1. 启动 `npm run dev`，用最新版稳定 Chrome 打开 localhost。
2. 通过 MusicBar 的导入按钮在原生 picker 中选择两段支持范围内的本地音频；检查空队列自动播放、切歌和队列状态。
3. 刷新页面；检查当前歌曲从 0 秒 paused 恢复，其他歌曲分别显示浏览器实际返回的 granted/prompt/denied 状态，且启动过程没有主动弹权限。
4. 只通过“恢复访问”触发权限请求；拒绝后队列和当前 Blob 仍可用，允许后对应歌曲恢复。
5. 临时移动一段非当前音频并刷新，检查 `file-missing` 和“重新选择”；选择内容不同时检查 `content-changed`，再选择原内容恢复。
6. 可选导入超范围长音频观察大 Blob/quota 行为；只记录 best-effort 结果，不作为门禁通过或时长承诺。无法开始播放不是规定的预期结果；只有支持范围内音频复现或失败破坏其他会话能力时才作为缺陷调查。
7. 检查页面 console error/warn；记录浏览器版本、实际状态和手工 reviewer，不记录本地文件名、路径或 hash。

## Fixture 重建

1. 使用 Node 24.18.0。
2. 安装 FFmpeg 8.1.2，并确认存在 `pcm_s16le`、`libmp3lame` 和 `flac` encoder。
3. 运行 `npm run fixtures:generate`。
4. 运行 `npm run test:fixtures`，确认 manifest 中的 SHA-256 和实际文件一致。

生成器构造 48kHz、单声道、4 秒 Float32LE master，再生成 WAV、192kbps CBR MP3 和 FLAC。短 fixture 使用 `CC0-1.0`；15 分钟容量样本与学习 PCM 运行时生成，不进入 Git。

用户提供的音频默认仅本地使用，不复制进 fixture 目录。只有 `project-owner` 明确确认许可、provenance 和 hash 后，才能作为新的受控 manifest 条目。

`public/test_audio/` 保持 Git 忽略。本地约 15 分钟范围内样本仅用于原生文件选择与权限人工检查；超范围长音频只用于 best-effort quota/大 Blob 压力观察，不作为支持承诺、通过证据或 manifest 输入。版本化文档不得写入其文件名、路径、内容或 hash。

## Golden 更新

- `npm run fixtures:golden` 只比较，不写文件。
- `npm run fixtures:golden:update` 会重写 committed golden，必须先确认 Meyda、配置或生成器确有受批准的变化。
- `npm run fixtures:m7:golden` 只验证 L1/L2/L3 学习 golden identity；`fixtures:m7:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m8:golden` 验证 M8 scalar/Flux golden 并生成本地学习 WAV；`fixtures:m8:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m9:golden` 验证 M9 vector/waveform golden 并生成本地学习 WAV；`fixtures:m9:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m10:golden` 验证 M10 structured golden 并生成本地学习 WAV；`fixtures:m10:golden:update` 才写入版本化 JSON。数值按固定 Meyda 容差（绝对 `1e-6`、相对 `1e-5`）比较，允许跨平台 ULP 级浮点差异；维度、键集与字符串/布尔/null 仍要求完全一致。
- 更新后必须审阅数值 diff，并重新运行 `test:analysis`；测试失败不得自动覆盖 golden。

## Evidence 与本地产物

`test-results/`、`playwright-report/`、`artifacts/fixtures/` 和 `artifacts/evals/<run-id>/` 只在本地保存并由 Git 忽略。未提交工作树只能产生 provisional run；只有对干净 commit 运行对应 canonical 命令的真实结果才能进入正式 evidence index。

2026-07-28 的最终 M4 provisional run 为 `M4-2026-07-28T10-15-08-817Z-20f52390-provisional`，summary SHA-256 为 `124819e3a3c7ca4e6404b126cdcc66f95cf48557fa7229494ca10d2642beb3d5`。它只作为实现反馈，不构成正式门禁证据。

2026-07-29 的 M4 canonical run 为 `M4-2026-07-29T03-32-15-929Z-e5cfe9e8`，绑定 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f`，summary SHA-256 为 `831158a07e1d08dab9dddd3e58b93047d287c6f9044badc02318cf49bd56aa25`。13/13 步骤通过；60 秒漂移 2.233ms，三次 seek 最大误差 66.827ms。完整结果与 artifact hash 见 [evidence index](../docs/quality/evidence-index.md)。

2026-07-29 的 M5 provisional run 为 `M5-2026-07-29T07-03-16-207Z-2eb98381-provisional`，summary SHA-256 为 `7b0acaf128ac4a7ceffce1449d2421127d20c8b25dcdc1ebd07b889072228530`。16/16 步骤通过；M5 Chrome 为 3/3，M4 回归 60 秒漂移 5ms、三次 seek 最大误差 66.827ms。它绑定 dirty worktree，只作实现反馈，不进入正式 evidence index。

同日 M5 canonical run `M5-2026-07-29T07-08-25-199Z-c90a3c57` 在 clean commit `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 上 16/16 通过，summary SHA-256 为 `6257426baa601289d89c10e97d76d866a637227fd042080deb947af17c982d2a`。M5 Chrome 为 3/3，M4 回归 60 秒漂移 4ms、三次 seek 最大误差 66.827ms；正式摘要见 [evidence index](../docs/quality/evidence-index.md)。

同日最终 M6 provisional run `M6-2026-07-29T10-59-23-767Z-b7fa91ed-provisional` 在 dirty worktree 20/20 通过，summary SHA-256 为 `6fd67f9a8b0184a2861a7182a1276572375e947880cf3688afe7511ca97ed3fa`。M6 Chrome 为 3/3；四项 cache payload 为 100,941 bytes、刷新为 hit 且 exact cursor 可用，20 次循环保持一个 live Worker/AudioContext，15 分钟输入最大反馈 16.7ms 且分析归因 >50ms 长任务为 0。该 run 只作实现反馈，不进入 evidence index。

2026-07-30 的 M6 canonical run `M6-2026-07-30T02-19-07-149Z-a39256ff` 在 clean commit `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` 上 20/20 通过，起止工作树均干净，summary SHA-256 为 `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae`。M6 unit 为 18/18、Worker/golden 为 13/13、coordinator 为 6/6、Chrome 为 3/3；四项 cache payload 为 100,941 bytes，刷新命中后 exact cursor 保持一致，20 次循环保持单一 live Worker/AudioContext，15 分钟输入最大反馈 17ms，分析归因 >50ms 长任务为 0。完整环境、步骤和日志 hash 已登记到 [evidence index](../docs/quality/evidence-index.md)。

同日 M7 provisional run `M7-2026-07-30T03-13-53-844Z-5b33575f-provisional` 在 dirty worktree 24/24 通过，summary SHA-256 为 `5f49ad1d18c1c5f8096beef53a6122f242bae361b76dcbe2f9d718698e663504`。M7 Chrome 为 4/4、M6 Chrome 回归为 3/3；首次三卡/四槽、保存空/单卡恢复、共享 zoom/cursor/seek、三视口/DPR/reduced motion、30Hz 合并与单卡错误隔离通过。seek 可见反馈为 2.7ms；15 分钟场景反馈最大 16.7ms，20 个进度样本单调，分析归因 >50ms 长任务为 0。该 run 只作实现反馈，不进入正式 evidence index。

首次 M7 clean run `M7-2026-07-30T03-21-14-150Z-28fc4699` 23/24，通过步骤之外的 M7 Chrome 为 3/4；固定 550ms 跨进程计时在浏览器繁忙时低估实际窗口，导致 exact-cursor 上限误判。修复为页面内 `performance.now()` 真实窗口并采用 40ms cadence 后，canonical run `M7-2026-07-30T03-30-43-095Z-f022b86e` 在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过，起止工作树干净，summary SHA-256 为 `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32`。

最终 canonical 的 M7 unit 为 8/8、integration 为 3/3、Chrome 为 4/4；页面内 624.4ms 窗口三项 exact-cursor 各 16 次、上限 20，seek 可见反馈 1.7ms。15 分钟场景最大反馈 16.8ms、20 个进度样本单调、分析归因 >50ms 长任务为 0；M3–M6 回归均通过。完整环境、24 步骤和日志 hash 见 [evidence index](../docs/quality/evidence-index.md)。

M8 provisional `M8-2026-08-21T03-19-06-614Z-486e313a-provisional` 已 28/28 通过，只作 dirty-worktree 实现反馈。clean canonical `M8-2026-08-21T03-23-18-552Z-d6dcf715` 在 commit `d6dcf715be2e6675224f079b954e2b1b544bbebd` 上 28/28 通过，起止工作树干净，summary SHA-256 为 `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef`。M8 unit 7/7、integration 6/6、Chrome 2/2；15 分钟回归最大反馈 17.8ms、分析归因长任务 0。完整日志 hash 见 [evidence index](../docs/quality/evidence-index.md)。

M9 provisional `M9-2026-08-21T09-08-40-958Z-896dbbb9-provisional` 已 32/32 通过，summary SHA-256 为 `9285bef21c715a2f36746ae7647255f00c06c40e70bc4af377baf03df7a4e9bf`。clean canonical `M9-2026-08-21T09-14-14-110Z-f88ca331` 在 commit `f88ca33149619b1a71eb30d74a1b8e266fb41a65` 上 32/32 通过，起止工作树干净，summary SHA-256 为 `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e`。M9 unit 5/5、integration 7/7、Chrome 2/2；canonical 15 分钟回归最大反馈 17.3ms、分析归因长任务 0，20 次资源循环保持单 Worker/AudioContext。

M10 provisional `M10-2026-08-22T18-17-36-129Z-2df604b9-provisional` 已 36/36 通过，summary SHA-256 为 `e9696c843256bff07cfa77b29ee9a529e9d80c6fc842c6f7437fab39a5c77166`。M10 unit 7/7、integration 13/13、Chrome 3/3；15 分钟 Loudness/Complex/Power/Buffer 四重卡最大反馈 16.2ms、分析归因长任务 0；M6 回归的 20 次资源循环保持单 Worker/AudioContext。build 最大 JS chunk 为 1,114.74 kB，warning 继续保留。该 run 只作实现反馈。

M10 clean canonical `M10-2026-08-22T18-25-01-873Z-8830e2a2` 已在 commit `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` 上 36/36 通过，summary SHA-256 为 `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1`。M10 unit 7/7、integration 13/13、Chrome 3/3；15 分钟四重卡最大反馈 17ms、分析归因长任务 0；M6 回归 20 次资源循环保持单 Worker/AudioContext。build 仍为 1,114.74 kB warning。正式 evidence 已于 2026-08-25 获 owner 批准。

M11 最终 provisional run `M11-2026-08-25T09-47-44-125Z-1b3691f9-provisional` 已在 dirty worktree 38/38 通过，summary SHA-256 为 `e84e695f8cb328390e1843b03d7af5c6f619bd2d96442fd7d97799bef5287ad5`。真实 Edge 全量 M3–M11 为 31/31；Chrome/Edge 三格式、刷新恢复、键盘、reduced motion、quota 和四视口专项各 4/4。Chrome/Edge 15 分钟四重卡最大反馈分别为 17.6ms/16.7ms，分析归因长任务均为 0；两端 20 次 Home/Analyzer 循环均为 WebGL 21 created/20 lost、2 live RAF。build 最大 JS chunk 为 1,117.54 kB，warning 保留。该 run 绑定 dirty worktree，只作实现反馈。

M11 clean canonical run `M11-2026-08-25T10-05-12-783Z-99c67792` 已在 commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过，summary SHA-256 为 `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5`。Chrome 专项 4/4、Edge 全量 31/31；Chrome/Edge 60 秒漂移 3.5ms/4.133ms，seek 最大误差 66.827ms/61.494ms；四重卡最大反馈 17.9ms/17.2ms，分析归因长任务均为 0；两端 20 次路由循环均为 WebGL 21 created/20 lost、2 live RAF。build 最大 JS chunk 为 1,117.94 kB，warning 保留。

M12 provisional run `M12-2026-08-28T07-12-30-657Z-45f51908-provisional` 已在 dirty worktree 上 12/12 通过，summary SHA-256 为 `055951e16e9749bf89f189516f3975bb340721fe05e47922f5e34148ed47d9fd`。M12 unit 为 4/4，M7/M8/M9/M10/M11 Chrome 回归分别为 5/5、2/2、2/2、3/3、4/4，M12 Chrome/Edge 均为 3/3；15 分钟回归最大反馈 16.7ms、分析归因长任务 0，M11 资源回归保持 2 live RAF。build 最大 JS chunk 为 1,284.56 kB，既有大 chunk warning 保留。该 run 只作实现反馈。

首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 因 M7 短 fixture 在观察前可能接近结束，exact-cursor 计数窗口没有播放输入而失败；失败 artifact 保留。测试在计数前把进度归零并确认 `playing`，目标用例连续 5/5 通过。修复后的 canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 在 commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上 12/12 通过，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`。M12 unit 4/4，M7/M8/M9/M10/M11 Chrome 回归 5/5、2/2、2/2、3/3、4/4，M12 Chrome/Edge 各 3/3；M7 cursor 各 14 次/607.7ms，15 分钟最大反馈 18.8ms、归因长任务 0，build 最大 JS chunk 1,284.55 kB。

M13 最终 provisional `M13-2026-08-31T17-40-46-300Z-e62140ee-provisional` 在 dirty worktree 上 17/17 通过，summary SHA-256 为 `4225440e6782c2aca5a3b13803059b7aefbdad210d134aa64235175389be33e2`。M13 unit 16/16、integration 12/12，M7–M13 Chrome 与 M12/M13 Edge 全绿；21 卡、快速十连切换、四张/八 Canvas、刷新前后单 Worker/精确值与 FIFO 年龄恢复均通过。15 分钟最大反馈 `18.6ms`、归因长任务 0；build 最大 JS chunk `1,292.10 kB`，既有 warning 保留。更早一次 provisional 在 13 步通过后因日志名 `/` 清理缺陷中止，失败目录保留；runner 修复后本次完整通过。

M13 clean canonical `M13-2026-08-31T17-44-39-680Z-63c04005` 在实现 commit `63c04005670145d83ee181d474197bce921c5300` 上 17/17 通过，summary SHA-256 为 `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc`。起止工作树干净；Chrome/Edge M13 各 2/2，M12 各 3/3；15 分钟最大反馈 `17.5ms`、归因长任务 0，刷新前后均为单 Worker，FIFO 年龄恢复后正确淘汰 Amplitude Spectrum。build 最大 JS chunk 仍为 `1,292.10 kB`。

本 README 只记录真实执行结果。`project-owner` 已批准 M11–M14 与 Editor E1–E9 canonical evidence；E9 已关闭，E10 为 `In Progress`。Analyzer 已按 M14 保持 `Ready with waivers`。Meyda 5.6.3 `spectralFlux` 上游缺陷仍保留，产品侧仅由 ADR-0005 项目实现缓解；PROD-015 仍阻断正式上线。

E1 最终 provisional `E1-2026-08-26T15-20-11-120Z-3ef4ec33-provisional` 已 18/18 通过。clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过，summary SHA-256 为 `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6`；E1 unit 9/9、integration 7/7、Chrome 4/4。M4 60 秒漂移 0.8ms、seek 最大误差 66.827ms；M6 15 分钟最大反馈 18.1ms、分析归因长任务 0、20 次资源循环保持单 Worker/AudioContext。build 最大 JS chunk 为 1,204.24 kB，warning 保留。`project-owner` 于 2026-08-26 批准 E1 canonical、原生流程与人工任务，E1 为 `Complete`，E2 已开放。
