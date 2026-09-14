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

以下为**建议标准**，尚未获得批准：

- 新颜色先在 `src/style.css` 的 `:root` 定义变量再引用；重设计时逐步收敛组件内的硬编码 hex，不新增同类散落值。
- 绿色保持 CTA、状态、焦点与数据可视化专用，不作为长段正文颜色；大面积使用仅限 hairline、glow、进度与波形/可视化的映射色。
- 焦点可见性沿用现有 `--main-color` outline 与 `outline-offset`，不改为素材的灰色 focus 表现。
- 排版与间距刻度可直接采用素材值；它们与当前仓库无冲突。

## 待人工确认

- `hairline` 的具体取值与是否纳入 token 化收敛。
- 组件内硬编码颜色收敛的范围、时机与风险，是否纳入同一轮改动。
- 是否及何时按 AGENTS.md 把设计语言落成 `docs/architecture/` 的 ADR 或设计决策记录，并在 decision-registry 登记条目。
- 视觉改版是否需要新增或修订 quality/readiness 证据。
