---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/architecture/adrs/0022-editor-marker-block-editing.md"
  - "docs/architecture/risk-register.md"
next_action: "完成 E10 unit/integration/browser 专项；浏览器不可运行时保持 unverified / owner-review"
---

# Editor E10 Eval Plan

E10 评价紧凑拍号 select、单 lane/class 小节批量选择、原子复制/移动、模式隔离和深色站内离页对话框。JSON V1、歌曲身份、AudioEngine/Worker/Overlay 与 E1–E9 历史 evidence 不变。

| Evidence | Coverage | Pass condition | Maps to |
| --- | --- | --- | --- |
| E10-EV-DOMAIN | 小节解析、point/range 收集、复制、移动 | 半开边界与完整 range 正确；复制新 ID、移动原 ID；越界/冲突整批不变 | AC-E1002–E1004；R-044 |
| E10-EV-MODE | pointer、keyboard、cleanup | 模式关闭无回归；开启只允许选择/移动/复制；cancel/lost capture 无提交 | AC-E1001/E1005；R-025/R-044 |
| E10-EV-STYLE | meter select 与 route dialog | 所有分母无遮挡；dialog 深色、焦点安全、确认/取消/抑制语义正确 | AC-E1006/E1007；R-025 |
| E10-EV-LIFECYCLE | autosave、refresh、route、JSON | 每个成功命令一次 project update；失败无持久化变化；V1 round-trip 精确 | AC-E1004/E1007；R-023/R-044 |
| E10-EV-REGRESSION | E9 29 步基线 + E10 四专项 | 完整环境 33/33；console/pageerror 0；资源不累积 | AC-E1005；R-025/R-044 |

`eval:e10` 只在 clean commit 上运行并固定 33 步。按 DEC-055，agent 不申请沙箱外端口或浏览器权限；环境阻断的 Chrome/Edge 项记录为 `unverified / owner-review`，不得计入 pass 或关闭 E10。
