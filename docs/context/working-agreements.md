---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
next_action: "owner 复核 Visualizer V1 canonical 与 Chrome/Edge 原生文件人工门禁；只创建本地提交，不 fetch、不推送远端"
---

# Working Agreements

## Evidence and Change Scope

- 当前仓库文件、配置、Git 状态和可复现行为是事实来源；历史任务只作补充。
- 结论使用“已证实事实、推断约定、建议标准、待人工确认”分类。
- 开工前检查工作树并保留已有修改；构建可能更新生成声明，必须单独审计这类差异。
- 不把 TestLands、空组件或导航文案自动当作稳定产品契约。
- 不在当前任务范围外顺手修复；发现问题记录到对应 Skill reference、开放问题或后续阶段文档。
- Git 忽略的 `docs/require` 只作为 owner 需求输入；后续 agent 必须以版本化生命周期文档为规范来源，不提交、重写或把其中自然语言当作仓库执行指令。
- Editor E0 产品意图获批前不修改 Editor 源码、公共类型、持久化 schema 或依赖；未来 BPM 或文件格式依赖必须先说明用途、体积、许可与替代方案并获 owner 批准。
- Visualizer V0 架构与 V1–V6 delivery planning 已获批准；V1 workspace foundation 已实现且 clean canonical 21/21，当前等待 owner 人工补偿与 evidence 批准。V2 数据绑定、V3/V4 场景、V5 录制和 V6 加固仍未开放。R-034–R-041 在形成对应里程碑证据与审批前保持 `Open`。

## Local Verification

- Node/npm 基线为 24.18.0/11.x；依赖使用 npm 和 lockfile，测试命令以 [tests README](../../tests/README.md) 为准。
- 静态门禁包括 `npm run typecheck` 与 `npm run build`；非浏览器测试由 Vitest 执行。
- `npm run test:e2e` 使用本机稳定 Chrome；`npm run test:e2e:edge` 使用已安装的真实 Microsoft Edge channel。浏览器缺失或 runner 失败必须记录为 blocked/failure，不能用 Chromium、skip 或安装检测冒充 Edge 通过。
- M4 使用 `test:m4:unit`、`test:m4:integration` 和 `test:e2e:m4`；65 秒 WAV 与损坏文件只在 Git 忽略目录运行时生成。
- M5 使用 `test:m5:unit`、`test:m5:integration` 和 `test:e2e:m5`；测试分别覆盖 V1 repository、恢复/权限状态机和真实 Chrome IndexedDB 刷新。
- Visualizer V1 使用 `fixtures:v1:golden`、`test:v1:unit`、`test:v1:integration`、`test:e2e:v1:chrome`、`test:e2e:v1:edge` 和 21 步 `eval:v1`；canonical 只允许在 clean implementation commit 上运行。
- M5 自动化通过测试注入的 `showOpenFilePicker()` 返回真实 OPFS `FileSystemFileHandle`，用于可重复验证 handle 存储、Blob 优先和刷新；它不替代 Chrome 原生文件选择器的人工权限验证。
- M6 使用 `test:m6:unit`、`test:m6:worker`、`test:m6:integration` 和 `test:e2e:m6`；`eval:m6:provisional` 运行 M3–M6 回归但不写正式 evidence，`eval:m6` 要求起止均为同一 clean commit。
- M6 的 15 分钟 WAV 在浏览器 OPFS 中分块确定性生成，不进入 Git；性能断言包括反馈 ≤100ms、分析归因主线程长任务为 0、进度单调、取消可见与 20 次资源循环不单调累积。
- M6 DEV bridge 只用于浏览器黑盒触发活动特征、取消、重试、读取可序列化 snapshot 和 exact cursor；测试不得通过它读取 File、PCM、AudioBuffer 或 Worker 内部对象。
- M7 使用 `test:m7:unit`、`test:m7:integration` 和 `test:e2e:m7`；`eval:m7:provisional` 运行 M3–M7 回归但不写正式 evidence，`eval:m7` 要求起止均为同一 clean commit。
- M7 学习 WAV 在 `artifacts/fixtures/` 运行时确定性生成并保持 Git 忽略；版本化 `m7-learning.v1.json` 固定 L1/L2/L3 的 PCM hash 与直接 Meyda 数值。
- M8 使用 `test:m8:unit`、`test:m8:integration` 和 `test:e2e:m8`；`eval:m8:provisional` 运行 M3–M8 回归但不写正式 evidence，`eval:m8` 要求起止均为同一 clean commit。
- M8 学习 WAV 在 `artifacts/fixtures/` 运行时确定性生成；版本化 golden 固定静音、纯音、同 RMS 丰富谐波与确定性噪声/瞬态关系。Flux 按 ADR-0005 项目公式验证，不删除 Meyda 上游异常回归。
- M8 Chrome 自动化覆盖 390/1024/1280/1920 的 sticky/overlay/control/scrollbar 与四卡；Windows Chrome pressed 偶发问题已由 owner 人工复核并单独签字。相关交互或样式再变化时必须重新验证。
- M9 使用 `test:m9:unit`、`test:m9:integration` 和 `test:e2e:m9`；`eval:m9:provisional` 运行 32 步 M3–M9 回归，clean-HEAD `eval:m9` 要求起止为同一干净 commit。
- M9 的 `m9-vectors-v1.wav` 在 `artifacts/fixtures/` 运行时生成；版本化 `m9-vectors.v1.json` 固定 Power Spectrum 平方关系、MFCC 13 维/顺序、Buffer 1024 维、正负 impulse 与尾帧语义。
- M10 使用 `test:m10:unit`、`test:m10:integration` 和 `test:e2e:m10`；`eval:m10:provisional` 运行 36 步 M3–M10 回归，clean-HEAD `eval:m10` 要求起止为同一干净 commit。
- M10 的 `m10-structures-v1.wav` 在 `artifacts/fixtures/` 运行时生成；版本化 `m10-structures.v1.json` 固定 total/24 Bark bands、real/imag 各 1024、相位差、静音和正负 impulse 语义。
- M11 使用 `test:e2e:m11:chrome`、`test:e2e:m11:edge`、`eval:m11:provisional` 和 clean-HEAD `eval:m11`；两条浏览器命令必须使用真实 Chrome/Edge channel，并把浏览器产品名与版本写入 artifact。
- M11 OPFS 自动化覆盖真实 IndexedDB/FileSystemFileHandle 的可重复路径；原生 OS picker 的 granted/prompt/denied、恢复访问和文件移动由 owner 在 Chrome 与 Edge 分别人工签字，自动化不得冒充该权限提示证据。
- M12 使用 `test:m12:unit`、`test:e2e:m12:chrome`、`test:e2e:m12:edge`、`eval:m12:provisional` 和 clean-HEAD `eval:m12`；旧 Grid 列数断言改为实际 `DOMRect`、唯一横坐标、容器包围、无重叠和最短列几何。
- M12 布局断言固定 390/1024 一列、1280/1920 两列、18px gap 与平局选左，并验证稳定 slot DOM、`details`/焦点/Canvas 保持和 Observer/RAF 路由清理；测试观察播放游标前必须把短 fixture 归零并确认 `playing`。
- M13 使用 `test:m13:unit`、`test:m13:integration`、`test:e2e:m13:chrome`、`test:e2e:m13:edge`、`eval:m13:provisional` 和 clean-HEAD `eval:m13`；17 步 suite 回归 M7–M12、Coordinator/cache、Editor E7 lease/isolation、双浏览器与构建。
- M13 浏览器断言固定 21 张 `FEATURE_IDS` 顺序卡、默认 0 Canvas、FIFO 最多四项、展开后每卡两 Canvas、快速切换原子性、V1 FIFO 恢复、390–1920 masonry 和卡片/容器 Observer、RAF、Worker 生命周期；收起态不得存在选择列表、移除按钮或图表资源。
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
- M8 provisional `M8-2026-08-21T03-19-06-614Z-486e313a-provisional` 已 28/28 通过，只作实现反馈。clean canonical `M8-2026-08-21T03-23-18-552Z-d6dcf715` 在 commit `d6dcf715be2e6675224f079b954e2b1b544bbebd` 上 28/28 通过，起止工作树干净，summary SHA-256 为 `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef`。
- M9 dirty-worktree provisional `M9-2026-08-21T09-08-40-958Z-896dbbb9-provisional` 已 32/32 通过，summary SHA-256 为 `9285bef21c715a2f36746ae7647255f00c06c40e70bc4af377baf03df7a4e9bf`；它只作实现反馈，不绑定 M9 实现 commit，也不进入正式 evidence index。
- M9 clean canonical `M9-2026-08-21T09-14-14-110Z-f88ca331` 已在 commit `f88ca33149619b1a71eb30d74a1b8e266fb41a65` 上 32/32 通过，起止工作树干净，summary SHA-256 为 `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e`；正式记录已由 owner 批准。
- M10 dirty-worktree provisional `M10-2026-08-22T18-17-36-129Z-2df604b9-provisional` 已 36/36 通过，summary SHA-256 为 `e9696c843256bff07cfa77b29ee9a529e9d80c6fc842c6f7437fab39a5c77166`；它只作实现反馈，不绑定最终实现 commit，也不进入正式 evidence index。
- M10 clean canonical `M10-2026-08-22T18-25-01-873Z-8830e2a2` 已在 commit `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` 上 36/36 通过，起止工作树干净，summary SHA-256 为 `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1`；正式记录已由 owner 批准。
- M11 clean canonical `M11-2026-08-25T10-05-12-783Z-99c67792` 已在 commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过并获 owner 批准。
- M12 provisional `M12-2026-08-28T07-12-30-657Z-45f51908-provisional` 12/12 通过，只作实现反馈；首次 clean run `M12-2026-08-28T07-25-22-951Z-b50c2c1e` 因短 fixture 缺少播放前置条件失败并保留 artifact。
- M12 修复 commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 的目标用例连续 5/5 通过；clean canonical `M12-2026-08-28T07-30-39-789Z-be655e67` 随后 12/12 通过，summary SHA-256 为 `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441`，正式记录已获 owner 批准。
- M3–M12 canonical run 已记录并获 owner 批准；M13 实现期间这些记录保留为历史，不代表当前候选。本地产物保留和删除规则以 [eval plan](../quality/eval-plan.md) 为准。
- M13 最终 provisional `M13-2026-08-31T17-40-46-300Z-e62140ee-provisional` 17/17 通过，summary SHA-256 为 `4225440e6782c2aca5a3b13803059b7aefbdad210d134aa64235175389be33e2`；它绑定 dirty worktree，只作实现反馈。
- M13 clean canonical `M13-2026-08-31T17-44-39-680Z-63c04005` 在实现 commit `63c04005670145d83ee181d474197bce921c5300` 上 17/17 通过，summary SHA-256 为 `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc`；M13 已关闭，R-028–R-030 缓解，readiness 恢复。
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

2026-08-21，owner 完成 M7 人工任务与 3/3 学习解释并批准 canonical evidence，M7 据此关闭。owner 同时要求实施 M8、批准 ADR-0005，并授权按独立 commit 提交、远端无分叉时推送 `AI-Auto`；M8 canonical 与 Windows Chrome pressed 复核通过前不关闭 M8。

同日，M8 provisional 与 clean canonical 均 28/28 通过；正式记录进入 `in-review`。macOS Chrome 已自动验证四项 UI hardening、390/1024/1280/1920、四卡、累计 16 项、静音 0 与项目 Flux；Windows Chrome pressed 偶发状态仍由 owner 补偿复核，M9 尚未开放。

随后 `project-owner` 明确回复：“我批准 M8 canonical evidence 与界面稳定化结果；同意将 M8 标记为 Complete 并开放 M9。”本约定据此确认 Windows Chrome 补偿门禁完成、M8 `Complete`，并开放仍为 `Planned` 的 M9；Edge、chunk warning 与 Meyda 上游 Flux 缺陷不因本批准关闭。

2026-08-23，`project-owner` 明确回复：“我批准 M9 canonical evidence 与非首页导航栏模糊效果；同意将 M9 标记为 Complete 并开放 M10。”本约定据此前述 Windows Chrome 视觉/学习清单已签字，M9 改为 `Complete`，M10 门禁开放但编码前保持 `Planned`；未提供的逐项数值或解释不作补写。

同日，`project-owner` 明确要求实施 M10 21/21 计划并授权按既定 Git 步骤提交与安全推送。本约定据此增加 M10 命令、fixture 和 clean-identity 规则，M10 改为 `In Progress`；该授权不提前批准 M10 evidence 或 release readiness。

随后 M10 clean canonical 36/36 通过并登记 `in-review` evidence。artifact 必须保留到 owner 审批完成；M10 人工任务与批准前，M10 保持 `In Progress`，M11 保持 `Planned`，不创建 release-readiness。

2026-08-25，`project-owner` 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”本约定据此确认 M10 evidence 为 `approved`、M10 为 `Complete`，M11 门禁开放但开始实施前保持 `Planned`。Edge、1,114.74 kB chunk warning 与 Meyda 5.6.3 上游 Flux 缺陷不因本批准关闭，也不创建 release-readiness。

同日，owner 确认已安装 Edge 并明确要求开始 M11 最终加固。本机检测到 Microsoft Edge 151.0.4129.107；M11 改为 `In Progress`。只有真实 Edge runner、双浏览器格式/恢复/交互矩阵、性能资源证据和原生权限人工签字完成后，才允许关闭 M11 或创建 release-readiness。

M11 实施期间先发现并修复 current track UI 已切换但持久化状态尚未进入 `saving` 的刷新竞态；随后 dirty-worktree provisional run `M11-2026-08-25T09-47-44-125Z-1b3691f9-provisional` 38/38 通过，summary SHA-256 为 `e84e695f8cb328390e1843b03d7af5c6f619bd2d96442fd7d97799bef5287ad5`。真实 Edge 全量回归固定 `workers=1`，避免多份长场景并行造成非产品态 CPU 争用；该 provisional 不构成 canonical evidence 或 owner 签字。

随后 clean-HEAD canonical run `M11-2026-08-25T10-05-12-783Z-99c67792` 在 commit `99c67792509d07456bcb431b90468252f8b0fdc3` 上 38/38 通过，summary SHA-256 为 `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5`；Chrome M11 专项 4/4，Edge 全量 31/31。正式 evidence 保持 `in-review`；原生 Edge 权限、辅助技术人工签字和 owner 批准前不关闭 M11、不创建 release-readiness。

2026-08-26，`project-owner` 明确批准 M11 canonical evidence、Edge 原生权限与最终加固结果，同意将 M11 标记为 `Complete` 并创建 release-readiness。该签字只登记补偿门禁通过，不补写未提供的人工测量；M11 artifact 继续保留到 readiness review 完成，release-readiness 在单独批准前保持 `in-review`。

同日，`project-owner` 明确批准 Analyzer release-readiness 的 `Ready with waivers` 结论及 W-001–W-007，并同意进入 Editor E0。该批准只覆盖 Analyzer 候选，不构成生产上线授权；PROD-015 解决前不创建托管或上线声明。

随后 owner 要求实施 Editor E0 产品意图计划，并补充长音色/效果范围事件；本约定据此固定 `docs/require` 仅作输入、首版无新增依赖以及产品批准前不越级的边界。

2026-08-26，`project-owner` 明确批准 Editor E0 产品意图、点/范围事件规则、成功指标和开放问题，并同意进入 Editor E0 架构设计。随后 owner 明确回复：“我批准 Editor E0 系统设计、接口契约、风险与 ADR；同意进入 Editor E1–E6 execution planning。”Editor system design、interface contracts、project/interaction 子契约和 ADR-0006–0009 据此为 `approved`，R-022–R-027 仍为 `Open`。当前只允许创建 Editor delivery planning；该批文档获批前不编码、不安装新依赖、不创建 Editor quality evidence。

Editor delivery planning 现固定每个 E1–E6 都按专项测试、dirty provisional、实现提交、clean canonical、evidence 登记和 owner 审批依次关闭；前一里程碑未批准时不得开放下一里程碑。E6 使用运行时生成的 10,000 事件压力工程，不能把该数值写成 schema 硬上限。Editor 测试命令、fixture 和 quality evidence 只在 planning 获批并进入对应实现里程碑后创建。

同日，`project-owner` 明确批准 Editor E1–E6 execution plan、acceptance criteria、test strategy 与 milestone plan，并同意开始 E1。当前只允许创建 E1 路由、runtime lease、JSON V1、独立草稿、E1 测试与 quality evidence；E2–E6 保持 `Planned`，不安装新依赖。E1 仍必须完成 dirty provisional、clean canonical、人工任务与 owner evidence 批准后才能关闭。

E1 实现随后在不新增依赖、不修改 Analyzer session/cache schema 的前提下完成。最终 provisional `E1-2026-08-26T15-20-11-120Z-3ef4ec33-provisional` 为 18/18；clean canonical `E1-2026-08-26T15-24-21-043Z-792b424f` 在 commit `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` 上 18/18 通过，起止工作树干净，summary SHA-256 为 `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6`。原生 OS 工程 picker、浏览器离页提示和 owner 任务尚未签字，因此 E1 保持 `In Progress`、E2 保持 `Planned`。

2026-08-26，`project-owner` 明确批准 E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果，并同意关闭 E1、开放 E2。该签字完成 E1 人工补偿门禁，E2 改为 `In Progress`；E3–E6 继续等待逐里程碑证据。

2026-08-27，E2 在不新增依赖、不修改 JSON V1、Analyzer database 或 cache schema 的前提下完成。dirty provisional 与 clean canonical 均为 22/22；clean run `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` 绑定 commit `9fc5c0a81fcf90abfbc665412277147cd958200f`，起止工作树干净，summary SHA-256 为 `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660`。Chrome 测得输入反馈 `3.9ms`、几何误差 `0.1484 CSS px`；owner 任务与批准前 E2 继续为 `In Progress`，E3 继续为 `Planned`。

同日，`project-owner` 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 并开放 E3。E2 改为 `Complete`、E3 改为 `In Progress`、E4–E6 保持 `Planned`；R-026 由 BPM/cancel/stale 证据与本次签字改为 `Mitigated`。该原文不补写 owner 未提供的逐项人工数值。

同日，E3 point lane、inner class、自适应吸附、鼠标/右键/键盘点标记与 viewport-visible DOM 已提交。dirty provisional 与 clean canonical 均 26/26 通过；clean run `E3-2026-08-27T02-53-58-176Z-c670ddf5` 绑定 commit `c670ddf5494269f5a56abd20c3c5653ee5b27cef`，起止工作树干净，summary SHA-256 为 `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c`。Chrome 测得 point 反馈 `28.5ms`、波形/point 几何误差 `0 CSS px`；本事实形成 `in-review` evidence，不关闭 E3、不开放 E4。1,246.31 kB chunk warning 保留到 Editor E6/readiness 复核。

同日，`project-owner` 明确批准 E3 canonical evidence、point lane、inner class、自适应网格与点标记结果，并同意关闭 E3、开放 E4。该签字不提前批准 E4 或开放 E5。

随后 E4 交付累计 21 项单选半透明 overlay、六类 Analyzer/Editor shared Canvas renderer、Buffer-first/去重 consumer、40ms exact cursor、三手柄、pointer-through 和单层错误隔离。dirty provisional 与 clean canonical 均 31/31 通过；clean run `E4-2026-08-27T07-21-59-209Z-c9e03ab9` 绑定 commit `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2`，起止工作树干净，summary SHA-256 为 `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff`。Chrome 测得 overlay/point 几何误差 `1 CSS px`、穿透点击反馈 `5.1ms`；本事实只形成 `in-review` evidence，不关闭 E4、不开放 E5。1,256.62 kB chunk warning 与 E6 Edge/10,000 事件门禁继续保留。

同日，`project-owner` 明确批准 E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果，并同意关闭 E4、开放 E5。R-024、R-025、R-027 仍保持 `Open`，等待 E5 range 与 E6 双浏览器、资源、无障碍门禁；不从本次批准推断 E6 已开放。

随后 E5 range lane/class、两阶段创建、preview/取消、端点 pointer/keyboard 调整与 pointercancel 回滚、半开重叠、右键优先级和 point/range 持久化已提交。dirty provisional 与 clean canonical 均 35/35 通过；clean run `E5-2026-08-27T11-03-22-177Z-78124177` 绑定 commit `781241772e05186e2fe0d006ed6ddd8bceded7af`，起止工作树干净，summary SHA-256 为 `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0`。Chrome 测得 range 反馈 `35.5ms`，1024/1280/1920 的 range/timeline/overlay 几何误差均 `1 CSS px`；本事实只形成 `in-review` evidence，不关闭 E5、不开放 E6。1,281.63 kB chunk warning 与 E6 Edge/10,000 事件/资源/无障碍门禁继续保留。

同日，`project-owner` 明确批准 E5 canonical evidence、范围事件创建/调整、重叠校验、键盘与持久化结果，同意关闭 E5 并开放 E6。E5 evidence 据此改为 `approved`，E6 为 `In Progress`；R-024、R-025、R-027 继续等待 E6 双浏览器、10,000 事件、资源与辅助技术证据。

2026-08-28，E6 clean canonical 在 commit `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` 上 40/40 通过。自动化证明真实 Chrome/Edge、三格式、10,000 事件、`<=100ms` 反馈、0 个归因长任务和 20 次资源循环；`project-owner` 随后批准 E6 与原生 OS picker、`beforeunload`、辅助技术和长会话补偿门禁。E6 据此为 `Complete`，R-024、R-025、R-027 为 `Mitigated`。

同日，owner 要求先关闭 E6，再实施 Editor 紧凑工作台。E7 只改变布局密度与表现层，必须独立执行 provisional、clean canonical、evidence 和 owner 审批；E6 历史身份不得改写，Editor readiness 延后至 E7。按本次计划默认只创建本地提交，不推送远端。

同日，E7 最终 dirty provisional 44/44 通过；实现提交 `78bc7f06311a09948e5efae941a14599305b81a5` 后，clean canonical `E7-2026-08-28T15-02-48-298Z-78bc7f06` 44/44 通过，summary SHA-256 为 `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a`。Chrome/Edge 实测工具栏 79px、控件 30px、point/range 行 44px；10,000 事件最大反馈 6.7ms/4.5ms、归因长任务为 0。artifact 保留到 owner 审批，E7 仍为 `In Progress`，不创建 Editor readiness。

2026-08-29，owner 在 E7 审批前批准 ADR-0011：overlay 与入口提升为窗口级 fixed，featureId 和本地 visibility 分离，关闭时 analysis 收敛为 Buffer。原 44/44 artifact 保留为 `pre-revision`；正式 evidence 改为 46 步，仍只创建本地提交、不推送。

随后全屏浮层修订的 dirty provisional 46/46 通过；实现 commit `080f577fe20fcb22a20184dce0b15892c5299464` 上的 clean canonical `E7-2026-08-29T05-23-03-986Z-080f577f` 46/46 通过，summary SHA-256 为 `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5`。Chrome/Edge 均验证 fixed 全屏层、21 项复合菜单、滚动固定、pointer-through 与 `0 CSS px` 横轴误差；owner 人工签字前 E7 仍为 `In Progress`。

同日，`project-owner` 明确要求 agent “自行提交并完成后续即可”，并说明“可以不上传远程仓库”。M12 clean canonical 在 commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上 12/12 通过后，本次授权用于本地提交、evidence 登记、R-028 缓解和 Analyzer readiness 复核；不构成远程推送、生产部署或 Editor E6 人工补偿完成的授权。

2026-08-31，owner 在要求先关闭 E7 的 M13 计划上回复“PLEASE IMPLEMENT THIS PLAN”。该指令批准 E7 修订版 46/46 候选并关闭 E7，同时批准 M13 产品、ADR-0012、delivery 与 quality 文档，授权按 dirty provisional → 本地实现提交 → clean canonical → evidence/readiness 复核完成后续；默认不推送远端。未提供的人工观察值不得补写。

2026-09-02，`project-owner` 明确回复：“我批准 Visualizer V0 系统设计、接口契约、R-034–R-041 与 ADR-0014–0017；同意进入 Visualizer V1–V6 execution planning。”该批准只开放 Visualizer delivery planning；R-034–R-041 继续为 `Open`，V1 实现、quality evidence、整体 readiness 与生产上线均未开放。本轮按 owner 计划只创建本地文档提交，不推送。

同日，`project-owner` 明确回复：“我批准 Visualizer V1–V6 execution plan、acceptance criteria、test strategy 与 milestone plan；同意开始 V1。”V0-D 据此关闭，V1 改为 `In Progress`；必须先提交 V1 quality/eval 契约，且本轮只创建本地提交、不 fetch、不 push。

随后 V1 quality 契约与 workspace foundation 依次完成本地提交。dirty provisional `V1-2026-09-02T03-12-25-678Z-1ebda007-provisional` 21/21 通过；clean canonical `V1-2026-09-02T07-03-26-973Z-fd44c892` 在 commit `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` 上 21/21 通过，summary SHA-256 为 `14c9ed2258baf6c9a2a3a20dfcaba65a0c643029f8510a1d9e4c6662c9c90300`。Chrome/Edge 原生 picker、覆盖提示和 `beforeunload` 仍需 owner 补偿验证；V1 继续为 `In Progress`，V2 继续为 `Planned`。本轮只创建本地证据提交，不 fetch、不 push。
