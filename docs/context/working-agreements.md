---
status: in-review
owner: "project-owner"
last_reviewed: 2026-07-28
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
next_action: "由 project-owner 审阅本约定和 M3 evidence index；批准后将两者标为 approved"
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
- M3 仅建立本地门禁，不存在正式 CI；这项缺口不阻断 M3，但自动化声明必须限定为本地执行。
- 交互改动要在本地浏览器执行成功、失败和边界场景，并检查 console error/warn。
- 布局和可视化至少检查窄屏、常见桌面和宽屏，使用真实 DOM/canvas 几何。
- 仓库提交由同一确定性 PCM master 生成的短 WAV/MP3/FLAC、生成器、CC0 notice 和 manifest；manifest 保存 provenance、工具参数和 SHA-256。
- 15 分钟样本和学习 PCM 在运行时生成。用户提供的音频默认仅本地使用，许可和 provenance 未确认时不得进入 Git 或正式 evidence。
- 已知大 chunk 提示记录为风险，不冒充构建错误，也不在没有性能预算时自动分包。
- 交付前运行 `git diff --check`，检查 Markdown frontmatter、相对链接和最终 Git 范围。

## Evidence and Generated Files

- `test-results/`、`playwright-report/` 和 `artifacts/evals/<run-id>/` 为 Git 忽略的本地产物。
- 未提交工作树只能产生 provisional run；正式 M3 evidence 必须引用用户提交后的干净 commit。
- 首个 canonical run 已记录在 [evidence index](../quality/evidence-index.md)；本地产物保留和删除规则以 [eval plan](../quality/eval-plan.md) 为准。
- fixture、manifest 和 golden 是受版本控制的规范输入；更新必须可重建、显示 diff，并重新执行对应测试。

## Resource Ownership

- AudioBufferSourceNode、AudioContext、对象 URL、RAF、Observer、事件监听、GSAP tween、Three.js geometry/material/renderer 的创建与释放应成对检查。
- 用户本地音频默认只在浏览器内处理；仓库没有上传或远端处理证据。
- 生成声明文件可能由构建插件更新；不要把这类变化与手写代码修改混为一谈。

## Review and Git

- 产品范围、高影响技术取舍和 milestone evidence 由 `project-owner` review。
- 未经明确请求，不 commit、不 push、不切换分支、不重写历史。
- 证据不完整时，不使用“测试全部通过”“无问题”或“可发布”等绝对表述。
- 通用阶段门禁、过期传播和升级规则以 [AGENTS.md](../../AGENTS.md) 为准。
