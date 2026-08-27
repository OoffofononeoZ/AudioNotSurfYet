---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/e5-eval-plan.md"
  - "docs/quality/editor/e4-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "owner 复核 canonical 与人工任务；新增失败继续按 range state、interval、overlap、handle、persistence 或 regression 分类"
---

# Editor E5 Failure Taxonomy

E5 继续沿用 `EFT-DRAFT`、`EFT-GEOMETRY`、`EFT-POINTER`、`EFT-FOCUS`、`EFT-OVERLAY-HIT` 与 `EFT-REGRESSION`，新增以下稳定分类。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-RANGE-LANE | range lane/class 不变量 | 空名称、最后分类删除、迁移悬空引用或误改 point 数据 | E5-EV-LANE/DRAFT | 阻断 E5；修复纯工程命令与原子迁移 |
| EFT-RANGE-STATE | pending/create 状态机 | 起点/终点顺序错误、取消仍写入、preview/capture 遗留 | E5-EV-CREATE/RIGHT | 统一状态清理入口；不得用 UI 隐藏数据错误 |
| EFT-RANGE-INTERVAL | 区间边界 | 非半开、零长、越界、最短网格或 track/tempo 边界错误 | E5-EV-INTERVAL | 阻断创建/调整；收敛到微秒规范化纯函数 |
| EFT-RANGE-OVERLAP | 重叠作用域 | 同类相交被接受、相邻被拒绝、跨分类/point 被误判或自动合并 | E5-EV-INTERVAL/LANE | 阻断 E5；修复半开 overlap validator |
| EFT-RANGE-HANDLE | 端点调整/回滚 | 手柄穿越、非法 pointerup 提交、pointercancel 未恢复或键盘语义漂移 | E5-EV-HANDLE/KEYBOARD | 恢复原 event；复用同一 endpoint command |
| EFT-RANGE-PERSISTENCE | range 保存/导入 | autosave、round-trip、quota 或 invalid import 改坏当前工程/旧草稿 | E5-EV-DRAFT | 立即阻断；保持内存与 durable 原子边界 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | point/range 工程、歌曲 identity 或 durable draft 损坏 | 立即停止 canonical，不得豁免关闭 E5 |
| S1 | 创建、取消、重叠、端点、键盘或 pointer-through 核心任务不可完成 | 阻断 E5 |
| S2 | 可恢复的焦点、提示、preview 或局部样式错误 | 修复并复跑相关 unit/E2E；按影响决定全量重跑 |
| S3 | 不影响事实和任务的轻微视觉/文案差异 | 登记并交 owner 判断人工门禁 |

canonical 失败保留 run identity、日志和分类；修复后形成新实现 commit 与新 clean canonical。E5 不把未执行的 Edge、三格式 native flow、10,000 事件或 E6 资源/辅助技术门禁归为通过。
