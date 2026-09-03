---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/quality/editor/e8-eval-plan.md"
  - "docs/delivery/editor/acceptance-criteria.md"
next_action: "E8 golden 已由 clean canonical 与 owner 门禁批准；相关行为变化时复核"
---

# Editor E8 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E8-G01 | desktop timeline | 1024/1280/1920 ready Editor | `.timeline-stage` 为 `88px`；波形中心 44px、振幅 38px，极值位于 6px/82px | 固定桌面密度与不裁切边界 |
| E8-G02 | narrow timeline | 390px ready Editor | stage 为 `72px`；波形中心 36px、振幅 30px，极值位于 6px/66px | 固定窄屏密度 |
| E8-G03 | Canvas DPR | 四视口与代表性 DPR | CSS 尺寸正确，像素 backing store 等于 CSS×DPR，边界/按钮不溢出 | 防止只改 CSS 导致模糊或裁切 |
| E8-G04 | exact recovery | route track 文件缺失后重选同一正确文件 | 页面自动从 unavailable 进入 ready；route 不变；playback 为 paused；无 MusicBar/无 autoplay | 修复图二并保留身份 |
| E8-G05 | wrong reselection | route track 缺失后选择不同内容 | 保持 unavailable/content-changed；不切歌，不写新工程或覆盖草稿 | 保护严格身份与草稿原子性 |
| E8-G06 | other current | URL 指向无效 ID，当前有另一首 paused 歌曲 | URL 不自动变化；显示“编辑当前歌曲”，accessible name 包含歌名 | 防止静默替代 route |
| E8-G07 | explicit replace | 点击或键盘触发 E8-G06 的入口 | 使用 replace 进入当前 track Editor；保持 paused；返回键不重新进入失效地址 | 固定可逆导航语义 |
| E8-G08 | marker center | ready Editor 创建 point，覆盖四视口、zoom/pan | event X、button/diamond/candidate X 差 `<=1px`，diamond/button Y 差 `<=1px` | 修复图三中心偏移 |
| E8-G09 | marker stem | marker hover/focus/selected | stem 从中心下方 8px 开始、高 14px，不随菱形旋转且不改变中心 | 分离装饰与几何锚点 |
| E8-G10 | adjacent behavior | tempo、range、overlay、keyboard、MusicBar route | E1–E7 既有语义与资源互斥不变，无 pageerror/异常 console | 防止局部修正引入跨层回归 |

这些 golden 使用仓库 deterministic fixture、实际 DOM/Canvas 几何和播放快照，不把用户截图作为可执行输入或像素资产。E7 的 `176px/144px` 保留为历史证据，当前行为以 E8-G01/G02 为准。
