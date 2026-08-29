---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-29
upstream_docs:
  - "docs/quality/editor/e7-eval-plan.md"
  - "docs/quality/editor/e6-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "用修订版 E7 46 步 canonical 验证 fullscreen、visibility、alignment 与 regression 分类"
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
| EFT-OVERLAY-VISIBILITY | 开关/记忆/analysis 收敛失败 | 关闭清空 feature、刷新错歌恢复、导入覆盖开关、关闭后仍请求 feature/exact cursor | E7-EV-VISIBILITY | S1；修正 controller/preference identity，不升级 JSON/DB |
| EFT-FIXED-OVERLAY | 窗口级定位或穿透失败 | 滚动后图形移动、背景未覆盖 Header、root 拦截 Header/标记 | E7-EV-FULLSCREEN | S1；修正 Teleport/fixed/pointer ownership |
| EFT-FULLSCREEN-ALIGN | 全视口 Canvas 对齐失败 | 时间列外绘制、zoom/pan/scroll 后 x 偏差超过 1px | E7-EV-ALIGNMENT | S1；修正 rect/clip/shared geometry，不私有化 viewport |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 工程、歌曲或事件事实损坏 | 立即停止 canonical |
| S1 | 核心任务、geometry、浏览器、键盘、性能或资源失败 | 阻断 E7/readiness |
| S2 | 可恢复的布局密度、文案或非核心窄屏差异 | 修复并复跑专项与受影响回归 |
| S3 | 不影响任务、事实和可访问性的轻微视觉差异 | 登记，由 owner 判断 |

失败 run 必须保留身份与日志。E7 修复后创建新实现 commit 并执行新的 clean canonical，不覆盖 E6 或失败历史。

## Recorded E7 Failures

- `E7-2026-08-28T14-41-40-086Z-3fdb8ac6-provisional` 暴露 `EFT-COMPACT-REGRESSION / S1`：合并工具栏后 persistence state 不再拥有独立、稳定的文本语义边界；另有长序列中的 route/IndexedDB 与 M7 empty-workspace 瞬态回归。状态拆分后 E1/M7 专项通过，完整 provisional 与 canonical 随后全绿。
- 没有用放宽尺寸、时间、geometry、性能或资源阈值处理失败；E6 历史 canonical 未被改写。
