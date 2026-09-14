---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-14
upstream_docs:
  - "docs/architecture/adrs/0024-design-language-adoption.md"
  - "docs/architecture/system-design.md"
  - "skills/audio-visualizer-dev/references/60-design-language-and-brand.md"
next_action: "DR2 已按 owner 要求撤回并重做（品牌/导航/Settings 对齐 token，不改 Header 背景）；等待 owner 确认"
---

# Design Remake Execution Plan (DR0–DR10)

## 1. Delivery Outcome

把已批准的设计语言按轮次落到共享 chrome（HeaderBar、MusicBar、MusicList）与四个主路由（Home、Analyzer、Editor、Visualizer），每轮形成可独立验证、可回滚的视觉交付。ComingSoon 与 TestLands 不在范围内。本计划不改变任何行为契约，不重开 M1–M14、E1–E10、V1–V6 的 canonical 身份，只在对应轮次内更新受影响的写死色值断言并登记复核要求。

## 2. Delivery Principles

- 每轮只改该轮范围内列出的文件；硬编码颜色只在本轮触及的文件内收敛，不做全仓扫荡。
- 每轮顺序固定为：实现与样式调整 → `npm run build` → 该轮相关 e2e 专项 → 真实浏览器逐页人工审阅 → 输出证据 → 提交 → 等待 owner 确认 → 进入下一轮。
- 一轮未获 owner 确认时，下一轮保持未开始；不得并行扩大范围或把断言更新推到后续轮次。
- 只改视觉与样式，不新增、删除或改写产品文案与信息架构；Home 不新增 DOM 文案或 CTA。
- Canvas 绘制冻结，见 [ADR-0024](../../architecture/adrs/0024-design-language-adoption.md)。

## 3. Fixed Parameters

| Area | Fixed value | Change rule |
| --- | --- | --- |
| Token 载体 | `src/style.css` 的 `:root` CSS 自定义属性 | 需要第二载体（如 Tailwind theme）先改 ADR-0024 |
| 字体 | 保持现有字体族，只对齐字号/字重/行高/字距层级 | 引入字体文件或 `@font-face` 需 owner 批准 |
| 主题色 | `--main-color: #27ff64`；accent 弱化 `#65ffa9` | 改变取值需复核 60-design-language-and-brand.md |
| 暗色约束 | 只做暗色，不新增 `prefers-color-scheme: light` 分支 | 出现浅色需求时停止并请求决策 |
| hairline 归一 | DR1 映射现值；DR6 收敛为 `.12 / .18 / .28 / .42 / .52` | 与其他页面共享的 `.app-scrollbar` 现值保持不变 |
| Canvas 冻结 | `src/analysis/canvasRenderer.ts`、`src/visualizer/**`、LightBg、DotGridBg、MeydaCard plot、Editor Canvas、Visualizer 预览 | 任何绘制参数、配色或几何改动都需新决策 |
| 登记例外 | MusicBar 样式 2 的 `conic-gradient` 多色进度环 | 新增例外必须写入 ADR-0024 |
| 不改动的契约 | DEC-050 一屏工作台、DEC-019 Header blur、`.app-scrollbar` 唯一滚动条、masonry 列数断点、E9 行高与 28px BPM 条、E10 选区语义 | 需要改变时停止并走独立决策 |

## 4. Round Slices

| Round | Scope | Exit evidence |
| --- | --- | --- |
| DR0 | 规划与决策：ADR-0024、本计划、DEC-059、context index 与 skill 参考收敛 | 文档通过 `npm run test:docs`，无产品代码改动 |
| DR1 | 全局 token 基线：`src/style.css` 的 `:root` 变量集，映射现有实值，零视觉回归 | build + `app-smoke` + `e9` + `m7` + `visualizer-layout` + 人工核对无视觉变化 |
| DR2 | HeaderBar：品牌字标、导航层级、hairline、focus | build + `app-smoke` + `m9`；如需改蒙层色同轮更新断言 |
| DR3 | MusicBar：三样式、进度条、跑马灯、列表开合控件 | build + `m4` + `m5`；彩虹进度环保留为登记例外 |
| DR4 | MusicList / AnimatedList / 列表空态与错误容器 | build + `m4` + `m5` + `app-smoke` |
| DR5 | Home：容器、遮罩层与响应式；不新增 DOM | build + `app-smoke` + 人工审阅 LightBg 冻结 |
| DR6 | Analyzer：工具栏、卡片 chrome、重排控件；hairline 收敛 | build + `m7` + `m9` + `m10` + `m12` + `m13` + `m14` |
| DR7 | Editor A：页面壳、工具栏、timeline stage 与 BPM 条外框 | build + `e2` + `e7` + `e8`；`EditorTimeline.vue` 只改 DOM 与样式 |
| DR8 | Editor B：point/range 行 DOM、overlay DOM chrome、菜单与 dialog | build + `e3` + `e4` + `e5` + `e7` + `e8` + `e9` + `e10` |
| DR9 | Visualizer：工具栏、模板侧栏、inspector、recording bar、transport | build + `v1`–`v6` + `visualizer-layout` |
| DR10 | 收尾：一致性核对、剩余硬编码统计与收敛、证据与 readiness 复核汇总 | build + 全量 `test:e2e` + `test:docs` + 人工审阅 + 复核结论 |

每轮允许在该页范围内追加一轮（编号顺延），条件是原轮范围实际超出预估；追加轮必须补登本表与 DEC 条目说明之外的证据要求。

## 5. Affected Evidence Registry

以下位置写死了当前设计的色值，任何轮次改动对应取值时必须同轮更新断言，并在轮次报告中列出改动：

| Spec | 断言内容 | 相关轮次 |
| --- | --- | --- |
| `tests/e2e/app-smoke.spec.ts` | 首页 Header 透明、非首页 `rgba(2, 4, 3, 0.72)` 蒙层 | DR1、DR2、DR4 |
| `tests/e2e/m9-analyzer.spec.ts` | 非首页 Header 蒙层色 | DR2、DR6 |
| `tests/e2e/m7-analyzer.spec.ts` | `.app-scrollbar` track/thumb/hover 取值 | DR1、DR6 |
| `tests/e2e/visualizer-layout-scroll.spec.ts` | 共享滚动条取值与页面无纵向滚动 | DR1、DR9 |
| `tests/e2e/e7-editor-compact.spec.ts` | overlay 蒙层 `rgba(132, 136, 135, 0.28)` | DR8 |
| `tests/e2e/e9-editor-tempo-lane.spec.ts` | BPM 条与标记色 `rgb(101, 255, 169)` | DR8 |
| `tests/e2e/e10-editor-block-editing.spec.ts` | 选区背景 `rgb(4, 16, 9)` 与边框 `rgba(101, 255, 169, 0.52)` | DR8 |

其他 e2e 依赖几何与行为事实（masonry 列数、行高、BPM 条宽度、路由、资源计数），本轮视觉改动不得使其变化；一旦变化，视为契约变更，停止该轮并请求独立决策。

## 6. Round Exit Checklist

- `npm run build` 通过。
- 该轮相关 e2e 专项通过；浏览器不可用时记录未验证项与残余风险，不记为通过。
- 真实浏览器逐页人工审阅，并在轮次报告中说明观察到的视觉结果。
- `git diff --check` 无空白错误；diff 只包含该轮范围内文件。
- 确认 canvas 冻结文件不在本页 diff 中（DR7 额外核对 `EditorTimeline.vue` 的绘制段落）。
- 写死色值断言的同轮更新清单已列出。
- 形成该轮本地提交，不 push、不 fetch。
- 输出轮次报告并等待 owner 确认后再开始下一轮。

## 7. Round Status

| Round | Status | Commit | Note |
| --- | --- | --- | --- |
| DR0 | Complete | `daaabc3` | ADR-0024、本计划、DEC-059 与 context index 已落库 |
| DR1 | Complete | — | 仅在 `src/style.css` 的 `:root` 建立 token 与值保持别名；commit hash 于 DR2 轮回填 |
| DR2 | In Progress | — | HeaderBar 对齐 token：品牌 display-md、导航白色 body-sm 与当前路由强调线、Settings 去边框；保持 DR2 之前的 Header 背景写法不变；commit hash 于确认后回填 |
| DR3 | Planned | — | MusicBar 共享 chrome |
| DR4 | Planned | — | MusicList / AnimatedList / 列表反馈态 |
| DR5 | Planned | — | Home 容器与遮罩 |
| DR6 | Planned | — | Analyzer chrome 与 hairline 收敛 |
| DR7 | Planned | — | Editor A：壳、工具栏、timeline stage |
| DR8 | Planned | — | Editor B：标记、overlay、菜单与 dialog |
| DR9 | Planned | — | Visualizer |
| DR10 | Planned | — | 收尾与 readiness 复核 |
