# AudioNotSurfYet 测试说明

## 环境

- Node.js：24.18.0；npm：11.x。仓库使用 `.nvmrc`、`engines` 和 `package-lock.json` 锁定基线。
- Vitest：4.1.10。官方已发布但当前 npm 镜像尚未提供 Vitest 5，因此使用镜像可获得且仍受支持的 4.1 版本。
- Playwright Test：1.62.0；必需浏览器为本机稳定版 Google Chrome 与 Microsoft Edge。
- FFmpeg：8.1.2；只用于生成和检查受控 WAV/MP3/FLAC fixture。
- 当前检测到 Google Chrome 151.0.7922.174 与 Microsoft Edge 151.0.4129.107；`npm run test:e2e:edge` 使用真实 `msedge` channel，浏览器缺失时仍以退出码 2 报告 `blocked`。

M3–M11 不建设 CI。下列命令当前均为本地门禁；正式证据要求在干净 commit 上复跑。M3–M10 canonical run 已获批准，M10 已为 `Complete`；owner 已明确要求开始 M11，当前为 `In Progress`。M5 Chrome 原生权限、M7 学习任务、M8 Windows Chrome 界面稳定化与 M9 导航栏视觉/学习清单均已单独签字通过；Edge 原生权限仍等待 M11 人工签字。

当前 `npm audit` 在安全补丁更新后剩余 1 项 low：Vite 依赖的 esbuild 0.27.3 在 Windows 开发服务器场景存在本地任意文件读取风险。仓库目标验证机为 macOS，开发服务器不得暴露到不受信网络；依赖升级提供修复版本后复核。该缺口不被描述为已修复或生产 readiness。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run typecheck` | 运行 `vue-tsc -b` |
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
| `npm run test:m10:unit` | 21 项集合、direct Meyda、24/1024 维、零值、相位关系、结构 codec 与 golden |
| `npm run test:m10:integration` | Loudness/Complex 混合 shape、cache round-trip、exact cursor、stale/cancel/quota 与四卡持久化 |
| `npm run test:docs` | 生命周期 frontmatter、内部链接和 21 项特征计数 |
| `npm run test:harness` | 证明 deliberate failure 会非零退出 |
| `npm run test:e2e` | 稳定 Chrome 的全部当前 E2E |
| `npm run test:e2e:m3` | M3 应用、Worker、IndexedDB 和三格式 smoke |
| `npm run test:e2e:m4` | M4 播放/队列/错误/资源回归及 60 秒计时 |
| `npm run test:e2e:m5` | Chrome 真实 IndexedDB/OPFS handle 的导入、刷新、current Blob、未知 schema 与清空 |
| `npm run test:e2e:m6` | Chrome 真实 module Worker、cache refresh、exact cursor、20 次资源循环和 15 分钟性能/取消 |
| `npm run test:e2e:m7` | Chrome 四槽三卡、共享 zoom/cursor、点击/键盘 seek、30Hz 合并、刷新恢复、DPR/视口与单卡错误隔离 |
| `npm run test:e2e:m8` | Chrome 390/1024/1280/1920、四卡/16 项、UI hardening、13 项 scalar renderer 与刷新恢复 |
| `npm run test:e2e:m9` | Chrome Header 路由样式、四卡/19 项、Power/MFCC/Buffer renderer 与刷新恢复 |
| `npm run test:e2e:m10` | Chrome 四卡/21 项、Loudness/Complex renderer、完整 1024 bins、刷新恢复与 15 分钟四重卡性能 |
| `npm run test:e2e:m11:chrome` | Chrome 三格式/分析/恢复、键盘/焦点/reduced motion、多视口、quota 和 20 次 WebGL/RAF 生命周期 |
| `npm run test:e2e:m11:edge` | 使用真实 Edge 执行 M11 专项 hardening 场景 |
| `npm run test:e2e:m11` | 顺序执行真实 Chrome 与 Edge 的 M11 专项场景 |
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

## 目录职责

- `tests/unit/`：纯函数与可控浏览器 API adapter。
- `tests/audio/`：M4 AudioEngine fake clock 与 AudioSessionService/store 集成。
- `tests/persistence/`：M5 原生 IndexedDB adapter、schema 和事务故障注入。
- `tests/worker/`：M3 harness、M6 基线、M8 scalar/Flux、M9 vector/waveform 与 M10 structured 产品 workerCore 合约测试。
- `tests/analysis/`：direct-Meyda extractor、committed golden、M6 platform、M7 viewport/学习、M8 scalar/Flux、M9 vector/waveform 与 M10 structured golden。
- `tests/fixtures/`：确定性生成器、短格式文件、许可、manifest 与重建校验。
- `tests/e2e/`：由 Playwright 对真实 Chrome/Edge channel 执行的浏览器场景；只有实际命令通过后才声明对应浏览器证据。
- `tests/docs/`：生命周期文档和特征计数检查。
- `tests/harness/`：被正常 Vitest 配置排除的 deliberate failure 及其自检。
- `tests/scripts/`：浏览器检测和 M3–M11 run orchestration。

M4 浏览器测试中的损坏 WAV 与 65 秒、48kHz、单声道计时 WAV 都写入 `test-results/`，不提交二进制。长时钟测试用同一 DOM 采样同时读取 `performance.now()` 与 AudioContext 驱动快照；三次 seek 使用进度条真实几何。

M5 浏览器测试把受控 fixture 写入浏览器 OPFS，再由注入的 `showOpenFilePicker()` 返回真实 `FileSystemFileHandle`。它覆盖真实 IndexedDB structured clone、刷新和 current Blob，但不会制造或宣称原生权限提示通过；Chrome OS picker 的 granted/prompt/denied、恢复访问和文件临时移动必须另做人工检查。

M6 浏览器测试通过 DEV-only bridge 选择四项支持特征、读取可序列化状态并请求 exact cursor；bridge 不暴露 File、PCM、AudioBuffer 或 Worker。15 分钟确定性 silence WAV 在 OPFS 分块生成，覆盖单调进度、取消、输入反馈 ≤100ms、无分析归因 >50ms 主线程任务和资源生命周期。`spectralFlux` 的当前 Meyda 异常以预期失败断言固定，不计为支持项。

M7 浏览器测试运行时生成 Git 忽略的 `m7-learning-v1.wav`，版本化数值输入保存在 `m7-learning.v1.json`。Chrome 场景覆盖首次默认三卡、已保存空/单卡恢复、重复禁用、共享 zoom/seek、每特征最多 30Hz exact cursor 请求、≤100ms seek 可见反馈、1024/1280/1920、DPR、reduced motion 和单卡 Canvas context 错误隔离。

M8 浏览器测试运行时生成 Git 忽略的 `m8-scalars-v1.wav`，版本化数值输入保存在 `m8-scalars.v1.json`。Chrome 场景覆盖 390/1024/1280/1920、第四卡、累计 feature set 回归、静音 Energy 0、瞬态 Flux、所有 13 项 scalar renderer/exact cursor 和刷新恢复；M7 Chrome 回归覆盖 sticky、播放器/歌曲列表层级、pressed 与主题滚动条。Windows Chrome pressed 状态已由 owner 补偿复核并批准。

M9 浏览器测试运行时生成 Git 忽略的 `m9-vectors-v1.wav`，版本化数值输入保存在 `m9-vectors.v1.json`。Chrome 场景覆盖首页透明/非首页 18px blur、当前累计 feature set、Power Spectrum 512、MFCC 13、Buffer 1024、双 Canvas、鼠标/键盘 seek、四卡/视口刷新恢复和 390/1024/1280/1920。

M10 浏览器测试运行时生成 Git 忽略的 `m10-structures-v1.wav`，版本化数值输入保存在 `m10-structures.v1.json`。Chrome 场景覆盖累计 21 项、Loudness total/24 Bark bands、Complex Spectrum 完整 1024 bins 与 signed Hz、两类 320px 双 Canvas、鼠标/键盘 seek、刷新恢复、多视口/reduced motion，以及 15 分钟 Loudness/Complex/Power/Buffer 四重卡反馈与长任务门禁。

M11 专项浏览器测试在同一文件上分别运行真实 Chrome/Edge，覆盖三格式队列切换、Analyzer 结果与刷新恢复，键盘播放/进度/Analyzer seek、可见焦点、reduced motion、390/1024/1280/1920 几何、quota 后内存播放，以及 20 次 Home/Analyzer 生命周期中的 WebGL context 与 RAF 上界。`test:e2e:edge` 还会在 Edge 上执行 M3–M10 全部回归。OPFS handle 自动化与原生 OS picker 权限提示继续分开，后者必须由 owner 人工签字。

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
- `npm run fixtures:m10:golden` 验证 M10 structured golden 并生成本地学习 WAV；`fixtures:m10:golden:update` 才写入版本化 JSON。
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

本 README 只记录真实执行结果。M10 clean canonical 与 21/21 Analyzer 特征覆盖已于 2026-08-25 获 owner 批准，M10 为 `Complete`；M11 当前为 `In Progress`，仍需 clean canonical、Edge 原生权限和辅助技术人工签字。Meyda 5.6.3 `spectralFlux` 上游缺陷仍保留，产品侧仅由 ADR-0005 项目实现缓解；当前不得创建或宣称 release readiness。
