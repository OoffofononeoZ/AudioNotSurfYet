---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/quality/editor/e7-eval-plan.md"
  - "docs/quality/editor/e6-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "按 E7 provisional/canonical 记录真实失败，不覆盖 E6 历史"
---

# Editor E7 Failure Taxonomy

E7 沿用 E1–E6 的 geometry、pointer、focus、performance、resource、regression 与 evidence 分类，并增加紧凑布局专属失败域。

| Type ID | Failure type | Definition | Detection | Response |
| --- | --- | --- | --- | --- |
| EFT-DENSITY | 密度契约失败 | toolbar、waveform、lane、radius 或间距超过 AC-E701/E702 | E7-EV-TOOLBAR/DENSITY | S2；修正 CSS/模板，不缩小内容或隐藏能力过门禁 |
| EFT-COMPACT-OVERFLOW | 紧凑布局遮挡/溢出 | 操作不可见、错误换行、多个滚动容器冲突或固定层遮挡 | E7-EV-RESPONSIVE | 桌面核心操作为 S1，窄屏非核心为 S2；修复布局 |
| EFT-COMPACT-HIT | 命中与焦点退化 | 控件小于 24px、焦点不可见、pointer/keyboard 命中偏移 | E7-EV-TASK | S1；恢复命中尺寸和焦点，不放宽可访问性 |
| EFT-COMPACT-CANVAS | Canvas 尺寸/geometry 漂移 | CSS 尺寸变化后 backing store 或共享 x 坐标超限 | E7-EV-RESPONSIVE/TASK | S1；修正 resize/共享列宽，保持 `<=1px` |
| EFT-COMPACT-REGRESSION | E1–E6 或 M12 回归 | 既有功能、资源、性能或 Analyzer masonry 失败 | E7-EV-STRESS/ADJACENT | 按原 taxonomy 严重度阻断 E7 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 工程、歌曲或事件事实损坏 | 立即停止 canonical |
| S1 | 核心任务、geometry、浏览器、键盘、性能或资源失败 | 阻断 E7/readiness |
| S2 | 可恢复的布局密度、文案或非核心窄屏差异 | 修复并复跑专项与受影响回归 |
| S3 | 不影响任务、事实和可访问性的轻微视觉差异 | 登记，由 owner 判断 |

失败 run 必须保留身份与日志。E7 修复后创建新实现 commit 并执行新的 clean canonical，不覆盖 E6 或失败历史。
