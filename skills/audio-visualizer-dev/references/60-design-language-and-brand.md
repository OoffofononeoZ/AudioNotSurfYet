# 设计语言与品牌约束

## 适用范围

- 用于 AudioNotSurfYet 的视觉与设计语言任务：色板、排版层级、组件 chrome、圆角与边框、间距刻度，以及 Home/Analyzer/Editor/Visualizer 的外观重设计。
- 不改变行为契约。DEC-050 一屏工作台与侧栏独立滚动、DEC-019 首页透明/非首页 18px blur Header、`.app-scrollbar` 复用、`prefers-reduced-motion` 降级、路由与 recording/project 契约均不受视觉重设计影响。

## 来源与本地化

- 设计语言来源：`https://getdesign.md/voltagent/design-md` 的 VoltAgent 设计分析，使用 Stitch DESIGN.md 格式。
- 技能内素材：`references/design/voltagent.DESIGN.md`，于 2026-09-14 本地化。该副本是本技能内唯一权威素材，其他文档不得引用仓库外的同名文件或本机未纳入版本控制的目录。
- 本地化只改动了两处强调色并删除了 light/on-light 内容，其余取值保持上游原样；因此素材中未本地化的 token 一律以实现时仓库现值为准，见下方对照表。

## 强制约束

由 owner 于 2026-09-14 明确：主题色必须使用项目当前绿色，且整个产品不准备白色版本。

1. 主题色固定为 `--main-color: #27ff64`（`src/style.css`），用于 CTA、状态、焦点、品牌与数据可视化映射；accent 弱化/hover 用 `#65ffa9`。不得替换为素材中的其他绿色，也不得引入第二强调色相。
2. 只做暗色。不实现白色/浅色主题，不增加 `prefers-color-scheme: light` 分支，不保留 on-light 取值或"浅底深字"的反色逻辑。
3. 素材的 `colors` 段只描述角色与关系（accent 专用于 CTA、状态与品牌；canvas 是唯一画布）。具体取值一律以本文件与当前代码为准。
4. 素材、旧实现与本文件冲突时，以本文件和既有行为契约优先；无法在不破坏既有契约的前提下落地时，停止并说明缺口，不自行取舍。

## 采用的设计语言要素

采用素材的排版层级、4px 间距刻度、圆角刻度（按钮 6px、卡片 8px、仅状态标签使用 9999px pill）、以 1px hairline 边框替代阴影的海拔模型、Sans + 等宽字体配对，以及"单一深色画布"的单调性。这些与当前仓库不冲突，是本次重设计的主要收益。

## 不采用

- 素材 `colors` 段的原始取值（已本地化的两处强调色除外）。
- 已从素材删除的 `hairline-soft`，以及全部 light-mode / on-light 语境，包括原先"浅底深字"的强调卡片反色语义。
- 素材中的英文文案、代码 mockup 与营销页组件内容；本项目复用其设计语言，不复用其页面结构。

## 项目现值对照表

素材未本地化的 token 以实现时仓库现值为准；标注为**建议标准**的取值尚未获得批准，仅供落地时参考。

| 角色 | 素材值 | 项目现值 | 依据 |
| --- | --- | --- | --- |
| accent（CTA、状态、焦点、品牌） | `#27ff64`（素材已本地化） | `#27ff64` | `src/style.css` 的 `--main-color` |
| accent 弱化 / hover | `#65ffa9`（素材已本地化） | `#65ffa9` | 当前使用量最高的强调色 |
| accent 深色 / 内联链接 | `#10b981` | 建议 `#7dffb3`（**建议标准**） | 现用于滚动条与高亮边框 |
| on-accent 文本 | `#101010` | `#020403` | 绿色承接面上的深色文本 |
| canvas | `#101010` | `#020403` | Analyzer 页面底色 |
| canvas-soft（输入、代码块、面板） | `#1a1a1a` | `#0b1710` / `#041009` / `#07110d` | 现网面板底色 |
| hairline（1px 卡片/按钮边框） | `#3d3a39` | 尚无 token：现状为绿色系 1px `rgba(101,255,169,α)`（Visualizer/Editor）与 `rgba(125,255,179,α)`（Analyzer/MeydaCard），常用 α 为 .18/.22/.24/.28/.34/.42/.48 | 待归一，见待人工确认 |
| ink（默认文本） | `#f2f2f2` | `#effff6` | 现网正文色 |
| ink-strong（高强调文本） | `#ffffff` | 无独立 token | 素材值是暗色画布上的纯白文本，不属于白色主题 |
| body（次级文本） | `#bdbdbd` | `#a9c7b6` | 现网次级文本 |
| mute（最低优先级文本） | `#8b949e` | `#91a99a` | 现网说明文本 |
| 警示 | 素材未定义 | `#f8ff87` | Analyzer 现用值 |
| 错误 | 素材未定义 | `#ffb0a8` | Analyzer 现用值 |

## 落地规则

以下规则已由 DEC-059/ADR-0024 批准：

- token 只以 `src/style.css` 的 `:root` CSS 自定义属性承载；不启用 Tailwind `theme.extend`，不引入第二套 token 来源。
- 新颜色先定义变量再引用；硬编码 hex 只在当前轮次触及的文件内收敛，不做全仓扫荡。
- 绿色保持 CTA、状态、焦点与数据可视化专用，不作为长段正文颜色；大面积使用仅限 hairline、glow、进度与波形/可视化的映射色。
- 焦点可见性沿用现有 `--main-color` outline 与 `outline-offset`，不改为素材的灰色 focus 表现。
- 字体族保持现状，只对齐字号、字重、行高与字距层级；不引入字体文件或 `@font-face`。
- canvas 绘制冻结：`src/analysis/canvasRenderer.ts`、`src/visualizer/**` 的绘制逻辑，以及 LightBg、DotGridBg、MeydaCard plot、Editor 波形/棋盘/overlay、Visualizer 预览与场景的绘制参数、配色和几何都不改动；只改画布外框、容器、工具栏与刻度标签等 DOM chrome。
- MusicBar 样式 2 的多色 `conic-gradient` 进度环是"单一强调色"规则的显式例外，也是唯一允许的第二色相来源。
- 按 DR 轮次推进，每轮完成 `npm run build`、该轮相关 e2e 与人工浏览审阅，并在同一轮更新受影响的写死色值断言后等待 owner 确认。

## 决策来源

- [ADR-0024](../../../docs/architecture/adrs/0024-design-language-adoption.md)：设计语言采用、token 载体、canvas 边界、字体策略与登记例外。
- [Design remake execution plan](../../../docs/delivery/design-remake/execution-plan.md)：DR0–DR10 轮次范围、固定参数、受影响证据与每轮退出门禁。
- `hairline` 归一由 ADR-0024 固定：DR1 先映射现值，DR6 在 Analyzer 范围收敛为 `.12 / .18 / .28 / .42 / .52`。

## 开放项

- 受影响页面的 quality/readiness 复核范围，在 DR10 收尾时评估。
