# AudioNotSurfYet 测试说明

## 环境

- Node.js：24.18.0；npm：11.x。仓库使用 `.nvmrc`、`engines` 和 `package-lock.json` 锁定基线。
- Vitest：4.1.10。官方已发布但当前 npm 镜像尚未提供 Vitest 5，因此使用镜像可获得且仍受支持的 4.1 版本。
- Playwright Test：1.62.0；必需浏览器为本机稳定版 Google Chrome。
- FFmpeg：8.1.2；只用于生成和检查受控 WAV/MP3/FLAC fixture。
- Microsoft Edge 当前未安装。`npm run test:e2e:edge` 会以退出码 2 报告 `blocked`，不会伪装成 pass。

M3/M4 不建设 CI。下列命令当前均为本地门禁；正式证据要求在用户提交后的干净 commit 上复跑。M3 canonical run 已登记到 [evidence index](../docs/quality/evidence-index.md) 并由 owner 批准；M4 canonical run 也已登记，当前等待 owner 审批。

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
| `npm run test:docs` | 生命周期 frontmatter、内部链接和 21 项特征计数 |
| `npm run test:harness` | 证明 deliberate failure 会非零退出 |
| `npm run test:e2e` | 稳定 Chrome 的全部当前 E2E |
| `npm run test:e2e:m3` | M3 应用、Worker、IndexedDB 和三格式 smoke |
| `npm run test:e2e:m4` | M4 播放/队列/错误/资源回归及 60 秒计时 |
| `npm run test:e2e:edge` | Edge 存在时执行同一项目；缺失时明确 blocked |
| `npm run build` | TypeScript project build 和 Vite production build |
| `npm run eval:m3:provisional` | 在未提交工作树生成本地 provisional run |
| `npm run eval:m3` | 只允许在干净 commit 上生成 canonical M3 run |
| `npm run eval:m4:provisional` | M3 回归 + M4 suite 的 dirty-worktree provisional run |
| `npm run eval:m4` | 只允许在干净 commit 上执行 M3 回归 + M4 suite 并生成 canonical run |

## 目录职责

- `tests/unit/`：纯函数与可控浏览器 API adapter。
- `tests/audio/`：M4 AudioEngine fake clock 与 AudioSessionService/store 集成。
- `tests/worker/`：测试专用 Worker，不是 M6 产品 Worker。
- `tests/analysis/`：direct-Meyda extractor、committed golden 和更新脚本。
- `tests/fixtures/`：确定性生成器、短格式文件、许可、manifest 与重建校验。
- `tests/e2e/`：真实 Chrome 场景；当前不声明 Edge 已通过。
- `tests/docs/`：生命周期文档和特征计数检查。
- `tests/harness/`：被正常 Vitest 配置排除的 deliberate failure 及其自检。
- `tests/scripts/`：浏览器检测和 M3/M4 run orchestration。

M4 浏览器测试中的损坏 WAV 与 65 秒、48kHz、单声道计时 WAV 都写入 `test-results/`，不提交二进制。长时钟测试用同一 DOM 采样同时读取 `performance.now()` 与 AudioContext 驱动快照；三次 seek 使用进度条真实几何。

## Fixture 重建

1. 使用 Node 24.18.0。
2. 安装 FFmpeg 8.1.2，并确认存在 `pcm_s16le`、`libmp3lame` 和 `flac` encoder。
3. 运行 `npm run fixtures:generate`。
4. 运行 `npm run test:fixtures`，确认 manifest 中的 SHA-256 和实际文件一致。

生成器构造 48kHz、单声道、4 秒 Float32LE master，再生成 WAV、192kbps CBR MP3 和 FLAC。短 fixture 使用 `CC0-1.0`；15 分钟容量样本与学习 PCM 运行时生成，不进入 Git。

用户提供的音频默认仅本地使用，不复制进 fixture 目录。只有 `project-owner` 明确确认许可、provenance 和 hash 后，才能作为新的受控 manifest 条目。

## Golden 更新

- `npm run fixtures:golden` 只比较，不写文件。
- `npm run fixtures:golden:update` 会重写 committed golden，必须先确认 Meyda、配置或生成器确有受批准的变化。
- 更新后必须审阅数值 diff，并重新运行 `test:analysis`；测试失败不得自动覆盖 golden。

## Evidence 与本地产物

`test-results/`、`playwright-report/` 和 `artifacts/evals/<run-id>/` 只在本地保存并由 Git 忽略。未提交工作树只能产生 provisional run；只有对干净 commit 运行对应 canonical 命令的真实结果才能进入正式 evidence index。

2026-07-28 的最终 M4 provisional run 为 `M4-2026-07-28T10-15-08-817Z-20f52390-provisional`，summary SHA-256 为 `124819e3a3c7ca4e6404b126cdcc66f95cf48557fa7229494ca10d2642beb3d5`。它只作为实现反馈，不构成正式门禁证据。

2026-07-29 的 M4 canonical run 为 `M4-2026-07-29T03-32-15-929Z-e5cfe9e8`，绑定 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f`，summary SHA-256 为 `831158a07e1d08dab9dddd3e58b93047d287c6f9044badc02318cf49bd56aa25`。13/13 步骤通过；60 秒漂移 2.233ms，三次 seek 最大误差 66.827ms。完整结果与 artifact hash 见 [evidence index](../docs/quality/evidence-index.md)。

本 README 只记录已存在且至少成功执行过一次的命令。M4 canonical pass 不等同于 owner approval、Edge 矩阵、M4 Complete 或 release readiness；证据获批前不进入 M5。
