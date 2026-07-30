---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-30
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
next_action: "M7 clean canonical 已登记为 in-review；完成 owner 操作与 3/3 学习解释后再申请关闭"
---

# Working Agreements

## Evidence and Change Scope

- 当前仓库文件、配置、Git 状态和可复现行为是事实来源；历史任务只作补充。
- 结论使用“已证实事实、推断约定、建议标准、待人工确认”分类。
- 开工前检查工作树并保留已有修改；构建可能更新生成声明，必须单独审计这类差异。
- 不把 TestLands、空组件或导航文案自动当作稳定产品契约。
- 不在当前任务范围外顺手修复；发现问题记录到对应 Skill reference、开放问题或后续阶段文档。

## Local Verification

- Node/npm 基线为 24.18.0/11.x；依赖使用 npm 和 lockfile，测试命令以 [tests README](../../tests/README.md) 为准。
- 静态门禁包括 `npm run typecheck` 与 `npm run build`；非浏览器测试由 Vitest 执行。
- `npm run test:e2e` 使用本机稳定 Chrome；Edge 缺失必须记录为 blocked，不能用 Chromium 或 skip 冒充 Edge 通过。
- M4 使用 `test:m4:unit`、`test:m4:integration` 和 `test:e2e:m4`；65 秒 WAV 与损坏文件只在 Git 忽略目录运行时生成。
- M5 使用 `test:m5:unit`、`test:m5:integration` 和 `test:e2e:m5`；测试分别覆盖 V1 repository、恢复/权限状态机和真实 Chrome IndexedDB 刷新。
- M5 自动化通过测试注入的 `showOpenFilePicker()` 返回真实 OPFS `FileSystemFileHandle`，用于可重复验证 handle 存储、Blob 优先和刷新；它不替代 Chrome 原生文件选择器的人工权限验证。
- M6 使用 `test:m6:unit`、`test:m6:worker`、`test:m6:integration` 和 `test:e2e:m6`；`eval:m6:provisional` 运行 M3–M6 回归但不写正式 evidence，`eval:m6` 要求起止均为同一 clean commit。
- M6 的 15 分钟 WAV 在浏览器 OPFS 中分块确定性生成，不进入 Git；性能断言包括反馈 ≤100ms、分析归因主线程长任务为 0、进度单调、取消可见与 20 次资源循环不单调累积。
- M6 DEV bridge 只用于浏览器黑盒触发活动特征、取消、重试、读取可序列化 snapshot 和 exact cursor；测试不得通过它读取 File、PCM、AudioBuffer 或 Worker 内部对象。
- M7 使用 `test:m7:unit`、`test:m7:integration` 和 `test:e2e:m7`；`eval:m7:provisional` 运行 M3–M7 回归但不写正式 evidence，`eval:m7` 要求起止均为同一 clean commit。
- M7 学习 WAV 在 `artifacts/fixtures/` 运行时确定性生成并保持 Git 忽略；版本化 `m7-learning.v1.json` 固定 L1/L2/L3 的 PCM hash 与直接 Meyda 数值。
- M3 仅建立本地门禁，不存在正式 CI；这项缺口不阻断 M3，但自动化声明必须限定为本地执行。
- 交互改动要在本地浏览器执行成功、失败和边界场景，并检查 console error/warn。
- 布局和可视化至少检查窄屏、常见桌面和宽屏，使用真实 DOM/canvas 几何。
- 仓库提交由同一确定性 PCM master 生成的短 WAV/MP3/FLAC、生成器、CC0 notice 和 manifest；manifest 保存 provenance、工具参数和 SHA-256。
- 15 分钟样本和学习 PCM 在运行时生成。用户提供的音频默认仅本地使用，许可和 provenance 未确认时不得进入 Git 或正式 evidence。
- `public/test_audio/` 中的本地音频保持 Git 忽略：约 15 分钟范围内的样本只用于原生文件选择、刷新与权限人工检查；超出范围的长音频只作 best-effort quota/大 Blob 压力观察，不扩大产品承诺，也不记录文件名、路径、内容或 hash。
- 当前 import/load 路径没有显式时长拒绝；超范围长音频无法开始播放不是规定的预期结果，也不单独构成 M5 门禁失败。若约 15 分钟范围内的有效格式复现，或失败破坏队列、当前会话与其他歌曲的可用性，应重新打开缺陷调查。
- 已知大 chunk 提示记录为风险，不冒充构建错误，也不在没有性能预算时自动分包。
- 交付前运行 `git diff --check`，检查 Markdown frontmatter、相对链接和最终 Git 范围。

## Evidence and Generated Files

- `test-results/`、`playwright-report/`、`artifacts/fixtures/` 和 `artifacts/evals/<run-id>/` 为 Git 忽略的本地产物。
- 未提交工作树只能产生 provisional run；正式 milestone evidence 必须引用用户提交后的干净 commit。
- M4 provisional run 只作为实现反馈；`eval:m4` 已在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过、追加 evidence index 并由 `project-owner` 批准。
- M5 dirty worktree 只运行 `eval:m5:provisional`；要求 clean HEAD 的 `eval:m5` 已对提交 `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 运行并追加正式 evidence。原生权限人工检查已由 `project-owner` 执行并与自动化结果分开记录。
- 2026-07-29 的 M5 provisional run 16/16 通过；它绑定 dirty worktree，只证明当前实现值得提交和 canonical 复跑，不关闭 M5。
- 同日 M5 canonical run 16/16 通过，起止工作树均干净且 commit 身份一致；随后 Chrome 原生权限人工检查通过并由 owner 批准，M5 已关闭。
- M6 dirty-worktree provisional `M6-2026-07-29T10-59-23-767Z-b7fa91ed-provisional` 已 20/20 通过，summary SHA-256 为 `6fd67f9a8b0184a2861a7182a1276572375e947880cf3688afe7511ca97ed3fa`；它只作实现反馈。
- M6 canonical run `M6-2026-07-30T02-19-07-149Z-a39256ff` 已在 clean commit `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` 上 20/20 通过，起止身份一致且工作树干净；summary SHA-256 为 `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae`，正式记录已追加到 [evidence index](../quality/evidence-index.md) 并由 owner 批准。
- M6 canonical artifact 已完成审批；commit 或 artifact 身份变化时必须重新运行，不能沿用旧证据。
- M7 dirty-worktree provisional `M7-2026-07-30T03-13-53-844Z-5b33575f-provisional` 已 24/24 通过，summary SHA-256 为 `5f49ad1d18c1c5f8096beef53a6122f242bae361b76dcbe2f9d718698e663504`；M7 Chrome 为 4/4、M6 Chrome 回归为 3/3，15 分钟场景最大反馈 16.7ms、分析归因 >50ms 长任务 0 个。它只作实现反馈，不进入正式 evidence index。
- 首次 M7 clean run `M7-2026-07-30T03-21-14-150Z-28fc4699` 因跨进程固定 550ms exact-cursor 计时误判为 fail；修复后的 `M7-2026-07-30T03-30-43-095Z-f022b86e` 在 clean commit `f022b86e2333ad612ecb12701b0ca05e49f2b256` 上 24/24 通过，summary SHA-256 为 `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32`，正式记录为 `in-review`。
- M3–M7 canonical run 已记录在 [evidence index](../quality/evidence-index.md)；M3–M6 已批准，M7 待 owner 学习任务与审批。本地产物保留和删除规则以 [eval plan](../quality/eval-plan.md) 为准。
- fixture、manifest 和 golden 是受版本控制的规范输入；更新必须可重建、显示 diff，并重新执行对应测试。

## Resource Ownership

- AudioEngine 独占实时 AudioContext、AudioBuffer、source、Analyser 与 Gain；AudioSessionService 独占 runtime File、封面 URL、engine 订阅和单播放 RAF。
- AnalysisCoordinator 独占产品 analysis Worker、generation、pending request、exact cursor 和 cache 合并；AudioEngine 只通过 descriptor 与分块 copy 暴露当前解码 PCM，revision 变化使 copy 和旧 Worker 结果失效。
- Worker 保留的 mono PCM、message listener 和 transferable 必须在 track/revision 变化、取消或 dispose 路径中释放；每个 MainLayout 同时最多一个 live 产品 Worker。
- 音频解码直接使用 File ArrayBuffer，不创建音频对象 URL；封面 URL 在删除、清空和 dispose 时释放。
- AudioBufferSourceNode、AudioContext、对象 URL、RAF、Observer、事件监听、GSAP tween、Three.js geometry/material/renderer 的创建与释放应成对检查。
- 用户本地音频默认只在浏览器内处理；仓库没有上传或远端处理证据。
- `SessionRepository` 独占原生 IndexedDB V1 的 `session`、`handles`、`current-blob` 和 `current-analysis-cache` 四个 object store；当前 Blob/cache 固定键替换必须在同一事务中完成。
- `audioSessionStore` 只保存可序列化的恢复状态；`FileSystemFileHandle`、File、Blob、AudioBuffer 和 IndexedDB 连接不进入 Pinia `$state`。
- 生成声明文件可能由构建插件更新；不要把这类变化与手写代码修改混为一谈。

## Review and Git

- 产品范围、高影响技术取舍和 milestone evidence 由 `project-owner` review。
- 未经明确请求，不 commit、不 push、不切换分支、不重写历史。
- 证据不完整时，不使用“测试全部通过”“无问题”或“可发布”等绝对表述。
- 通用阶段门禁、过期传播和升级规则以 [AGENTS.md](../../AGENTS.md) 为准。

## Approval Record

`project-owner` 于 2026-07-28 明确批准本约定及 M3 [evidence index](../quality/evidence-index.md)。本批准关闭 M3 并开放 M4，不改变 Edge、CI、审计或后续产品 eval 缺口。

`project-owner` 于 2026-07-29 明确批准 M4 evidence 与本修订。M4 据此关闭并开放 M5；后续 M5 新增约定需要独立复核，不由本次批准预先覆盖。

`project-owner` 于 2026-07-29 确认 M5 Chrome 原生权限人工检查通过，并明确批准 M5 evidence 与本修订。M5 据此关闭并开放 M6；本批准不覆盖 M6、Edge 或 release readiness。超范围长音频未开始播放只记录为非门禁压力观察，不改变约 15 分钟产品边界。

同日，owner 要求按 M6 详细计划实施；以上 M6 命令、DEV bridge 与资源所有权随实现形成，并在 M6 审批中完成复核。

2026-07-30，M6 canonical run 已在 clean commit 上 20/20 通过。`project-owner` 随后明确回复：“我批准 M6 canonical evidence、working agreements、system map 与 glossary；同意将 M6 标记为 Complete 并开放 M7。”本修订据此改为 `approved`，M6 改为 `Complete`，M7 门禁开放但仍保持 `Planned`。

同日，`project-owner` 明确要求实施 M7 三卡学习切片。本约定新增 M7 unit/integration/Chrome/eval 命令及运行时学习 fixture 规则；M7 改为 `In Progress`，canonical 和 owner 学习任务获批前不关闭、不开放 M8。
