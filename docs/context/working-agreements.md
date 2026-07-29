---
status: in-review
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
next_action: "完成原生权限人工检查，并随 M5 canonical evidence 由 project-owner 审批"
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
- M3 仅建立本地门禁，不存在正式 CI；这项缺口不阻断 M3，但自动化声明必须限定为本地执行。
- 交互改动要在本地浏览器执行成功、失败和边界场景，并检查 console error/warn。
- 布局和可视化至少检查窄屏、常见桌面和宽屏，使用真实 DOM/canvas 几何。
- 仓库提交由同一确定性 PCM master 生成的短 WAV/MP3/FLAC、生成器、CC0 notice 和 manifest；manifest 保存 provenance、工具参数和 SHA-256。
- 15 分钟样本和学习 PCM 在运行时生成。用户提供的音频默认仅本地使用，许可和 provenance 未确认时不得进入 Git 或正式 evidence。
- `public/test_audio/` 中的本地音频保持 Git 忽略：约 15 分钟范围内的样本只用于原生文件选择、刷新与权限人工检查；超出范围的长音频只作 best-effort quota/大 Blob 压力观察，不扩大产品承诺，也不记录文件名、路径、内容或 hash。
- 已知大 chunk 提示记录为风险，不冒充构建错误，也不在没有性能预算时自动分包。
- 交付前运行 `git diff --check`，检查 Markdown frontmatter、相对链接和最终 Git 范围。

## Evidence and Generated Files

- `test-results/`、`playwright-report/` 和 `artifacts/evals/<run-id>/` 为 Git 忽略的本地产物。
- 未提交工作树只能产生 provisional run；正式 milestone evidence 必须引用用户提交后的干净 commit。
- M4 provisional run 只作为实现反馈；`eval:m4` 已在 clean commit `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` 上通过、追加 evidence index 并由 `project-owner` 批准。
- M5 dirty worktree 只运行 `eval:m5:provisional`；要求 clean HEAD 的 `eval:m5` 已对提交 `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` 运行并追加正式 evidence。原生权限人工检查与自动化结果必须分开记录。
- 2026-07-29 的 M5 provisional run 16/16 通过；它绑定 dirty worktree，只证明当前实现值得提交和 canonical 复跑，不关闭 M5。
- 同日 M5 canonical run 16/16 通过，起止工作树均干净且 commit 身份一致；它不替代 EG-006 原生权限人工检查，owner 审批前不关闭 M5。
- 首个 canonical run 已记录在 [evidence index](../quality/evidence-index.md)；本地产物保留和删除规则以 [eval plan](../quality/eval-plan.md) 为准。
- fixture、manifest 和 golden 是受版本控制的规范输入；更新必须可重建、显示 diff，并重新执行对应测试。

## Resource Ownership

- AudioEngine 独占实时 AudioContext、AudioBuffer、source、Analyser 与 Gain；AudioSessionService 独占 runtime File、封面 URL、engine 订阅和单播放 RAF。
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

本轮新增的 IndexedDB store 所有权、OPFS 自动化边界、原生权限人工检查和本地压力音频政策尚未经过 M5 evidence 审批，因此本文重新进入 `in-review`。这不撤销上面的 M3/M4 approval。
