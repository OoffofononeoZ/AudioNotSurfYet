---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
next_action: "确认本地验证矩阵、生成文件政策和 review owner"
---

# Working Agreements

## Evidence and Change Scope

- 当前仓库文件、配置、Git 状态和可复现行为是事实来源；历史任务只作补充。
- 结论使用“已证实事实、推断约定、建议标准、待人工确认”分类。
- 开工前检查工作树。本计划开始时 `components.d.ts` 已有用户修改，任何构建生成结果都必须保留该初始差异。
- 不把 TestLands、空组件或导航文案自动当作稳定产品契约。
- 不在当前任务范围外顺手修复；发现问题记录到对应 Skill reference、开放问题或后续阶段文档。

## Local Verification

- 最基本静态门禁是 `npm run build`，它包含 `vue-tsc -b` 和 Vite production build。
- 当前没有可用的完整自动化测试门禁；`npm run test:spectrogram` 指向不存在的 `test.ts`。
- 交互改动要在本地浏览器执行成功、失败和边界场景，并检查 console error/warn。
- 布局和可视化至少检查窄屏、常见桌面和宽屏，使用真实 DOM/canvas 几何。
- 音频验证使用有权使用的本地短 fixture；无 fixture 时明确记录加载、解码与实时能量路径未验证。
- 已知大 chunk 提示记录为风险，不冒充构建错误，也不在没有性能预算时自动分包。
- 交付前运行 `git diff --check`，检查 Markdown frontmatter、相对链接和最终 Git 范围。

## Resource Ownership

- AudioBufferSourceNode、AudioContext、对象 URL、RAF、Observer、事件监听、GSAP tween、Three.js geometry/material/renderer 的创建与释放应成对检查。
- 用户本地音频默认只在浏览器内处理；仓库没有上传或远端处理证据。
- 生成声明文件可能由构建插件更新；不要把这类变化与手写代码修改混为一谈。

## Review and Git

- 产品范围与高影响技术取舍需要人工 review；当前 owner 均为 `unknown`。
- 未经明确请求，不 commit、不 push、不切换分支、不重写历史。
- 证据不完整时，不使用“测试全部通过”“无问题”或“可发布”等绝对表述。
- 通用阶段门禁、过期传播和升级规则以 [AGENTS.md](../../AGENTS.md) 为准。
