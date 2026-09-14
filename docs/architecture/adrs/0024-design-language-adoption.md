---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-14
upstream_docs:
  - "AGENTS.md"
  - "docs/architecture/system-design.md"
  - "skills/audio-visualizer-dev/references/60-design-language-and-brand.md"
next_action: "按 DR1–DR10 逐轮实施；每轮完成 build、相关 e2e 与人工审阅后等待 owner 确认再进入下一轮"
---

# ADR-0024: Design Language Adoption

## Context

界面当前没有设计系统：`tailwind.config.js` 的 `theme.extend` 为空，178 处十六进制颜色散落在各 `.vue` 文件中，同一强调色在不同页面各写一遍，编辑器还有局部 `--editor-divider`。`skills/audio-visualizer-dev/references/60-design-language-and-brand.md` 已经确定采用 VoltAgent 设计语言并锁定单一绿色与纯暗色，但没有落地方式、token 载体与逐页推进的边界，直接改页面会与已批准的布局契约和写死色值的自动化证据冲突。

## Decision

- 设计语言的唯一来源是 `skills/audio-visualizer-dev/references/60-design-language-and-brand.md` 与其素材 `references/design/voltagent.DESIGN.md`。主题色固定 `--main-color: #27ff64`，accent 弱化用 `#65ffa9`，只做暗色，不引入第二强调色相。
- 采用素材的排版层级、4px 间距刻度、圆角刻度（按钮 6px、卡片 8px、状态标签 9999px pill）与"1px hairline 替代阴影"的海拔模型；不引入字体文件或 `@font-face`，字体族保持现状，只对齐字号、字重、行高与字距层级。
- token 只以 `src/style.css` 的 `:root` CSS 自定义属性承载；本轮不启用 Tailwind `theme.extend`，不新增第二套 token 来源。
- 按 DR 轮次逐步实施，先共享层（token → HeaderBar → MusicBar → MusicList）再逐页（Home → Analyzer → Editor A/B → Visualizer），最后收尾。每轮只改该轮范围内的文件，硬编码收敛不做全仓扫荡。
- Canvas 绘制冻结：`src/analysis/canvasRenderer.ts`、`src/visualizer/**` 的绘制逻辑，以及 LightBg、DotGridBg、MeydaCard plot、Editor 波形/棋盘/overlay、Visualizer 预览与场景的绘制参数、配色和几何不得改动。只允许修改画布外框、容器、工具栏与刻度标签等 DOM chrome。
- hairline 归一：DR1 先把现有两组绿色系取值 `rgba(101, 255, 169, α)`、`rgba(125, 255, 179, α)` 与 `.app-scrollbar` 现值原样映射为变量；DR6 在 Analyzer 范围内收敛到统一刻度 `.12 / .18 / .28 / .42 / .52`。
- 允许在对应 DR 内改变 e2e 中写死的色值断言，但必须在同一轮更新断言，并把受影响的 milestone/证据登记为需复核；不允许先改实现、把断言留到后续轮次。
- MusicBar 样式 0 与 1 的多色 `conic-gradient` 进度环保留，登记为"单一强调色"规则的显式例外；它们是本设计语言中唯一允许的第二色相来源。

## Consequences

- Positive：出现唯一 token 来源，后续页面改动可逐轮验证与回滚；每轮范围小，owner 可在两轮之间确认视觉方向。
- Negative：每轮都要同步维护受影响的 e2e 断言与人工审阅记录；DR10 收尾需要一次 readiness/quality 复核。
- Compatibility：路由、类型、Project/JSON schema、Pinia 持久化、音频与渲染契约均不改变；DEC-050 一屏工作台与侧栏独立滚动、DEC-019 首页透明/非首页 18px blur、`.app-scrollbar` 唯一可见滚动条样式、`prefers-reduced-motion` 降级、masonry 列数断点（390/1024 → 1、1280/1920 → 2）、E9 的 28px BPM 条与 44px 行高、E10 选区语义均保持。

## Alternatives

- 不做 token 层、直接逐组件改色：拒绝；会延续散落色值，且无法逐轮验证。
- 同时启用 Tailwind `theme.extend`：拒绝；形成两套需要同步的 token 来源。
- 引入 Inter 与等宽 web 字体：拒绝；需要新增字体资源与离线可用性验证，收益不足以进入本轮范围。
- 让 canvas 配色跟随新 token：拒绝；会改动绘制代码与 golden 证据，违反本轮冻结边界。
- 一次性完成所有页面：拒绝；无法在两轮之间确认视觉方向，失败影响面过大。

## Approval

2026-09-14，`project-owner` 以明确实施指令批准"按 DR 轮次把 AudioNotSurfYet 逐步改造成 VoltAgent 设计语言"计划，其中包括轮次划分、canvas 冻结边界、仅用 CSS 变量承载 token、不更换字体、逐轮验证并等待确认的推进门禁，以及 MusicBar 多色进度环的登记例外。据此打开 DR0，并按 `docs/delivery/design-remake/execution-plan.md` 推进 DR1–DR10。
