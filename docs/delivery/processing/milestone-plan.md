---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/delivery/processing/execution-plan.md"
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/delivery/processing/test-strategy.md"
  - "docs/architecture/system-design.md"
next_action: "DEC-070 ??? P1 ?????P1 In Progress???????/??/??/WAV ???? DEC-069 ????"
---

# Browser Processing Milestone Plan

## 1. Current Boundary

2026-10-04，浏览器架构与 ADR-0024–0027 已 approved。DEC-067 固定完整 P1–P6 路线、FT 数值加人工质量和节拍 70ms/F1 ≥0.95；owner 随后要求“实施计划”，批准四份落盘 delivery、相关本地提交与 P1 质量规划（DEC-068）。P0-D 为 Complete；P1 仅开放质量规划，实际实现未开工，P1–P6 保持 Planned，R-046–R-055 全部 Open。

相对目标是批准/退出节点，不是日历工期；每次进入切片时登记实际开始/复核日期。全部产品、技术和证据 review owner 为 project-owner，工程执行使用仓库协作方式，不新增未确认人员安排。状态与审批遵守 [AGENTS.md](../../../AGENTS.md)。

## 2. Milestone Register

| ID | Milestone / status | Relative target / dependency | Review checkpoint and exit evidence | Owner |
| --- | --- | --- | --- | --- |
| P0-D | Delivery docs / Complete | 2026-10-04 批准；获批 architecture | 四份文档 approved、索引/DEC-067/068、docs/diff 验证；owner 明确批准并授权相关本地提交 | project-owner |
| P1 | FT feasibility / In Progress | P0-D Complete 后首切片 | AC-P101–P106、TS-P1：四图 bytes/session/parity、时间/energy/WAV、12 WAV 人工质量、双浏览器十五分钟分离/资源；证据与 owner 关闭 | project-owner |
| P2 | Separation workspace / Planned | P1 Complete | AC-P201–P205、TS-P2：route/stage、下载/cache、quota/故障、cancel/迟到/残留、四轨结果和原生导出 | project-owner |
| P3 | Beat candidates / Planned | P2 Complete | AC-P301–P305、TS-P3：逐段 F1/BPM、变化/歧义/静音、Worker/proposal、双浏览器完整 ≤900 秒 | project-owner |
| P4 | Confirm and apply / Planned | P3 Complete | AC-P401–P405、TS-P4：小节确认、逐项 diff、hash/原子更新、rerun 和用户修改保护 | project-owner |
| P5 | Visualizer V2 / Planned | P4 Complete | AC-P501–P505、TS-P5：strict/单向迁移/V2-only、旧/新源、默认映射、stale/显式刷新/preflight | project-owner |
| P6 | Complete production / Planned | P5 Complete | AC-P601–P604、TS-P6：双浏览器完整自动/手动任务、工程独立 snapshot、媒体 A/V、最终长曲/资源、人工/缺口记录 | project-owner |

所有 exit 都包含对应专项、相关回归、绑定当前实现 commit 的 canonical 和适用 owner 人工结论；证据结构按 [test strategy](test-strategy.md)及切片质量契约登记。现有 M/E/V canonical 不移动、不改名、不重算为 P 的退出证据。

## 3. Review Points and Stop Conditions

| Milestone | Review point / date record | Stop or delay response |
| --- | --- | --- |
| P0-D | 2026-10-04 owner 批准（DEC-068） | 已关闭；P1 质量契约仍须单独评审，未批准前不安装 runtime/下载模型/实现 harness |
| P1 | 开始前核对 fixture/许可/runtime；四图短段后首次兼容性复核；长曲/试听后退出复核 | 图/参考不兼容、parity 超差、任一 WAV 不可用、OOM 或分离 ≥900 秒即停止 P2 接入；保存证据并复核方案，不静默 fallback |
| P2 | storage/发布状态机后；真实 route/下载/取消/导出后 | quota/原子发布或迟到消息失败修复本切片；不绕过容量或自动驱逐，P3 不开放 |
| P3 | 算法/config/oracle 锁定后；完整性能后 | F1/BPM/警告或 ≤900 秒失败保留 fail record；复核瓶颈/算法，不事后扩过渡窗或隐式改阈值 |
| P4 | confirmation/diff/hash 后；持久化失败和用户修改任务后 | 覆盖/部分更新即阻止关闭；修复原子性/保护后重验受影响项 |
| P5 | migration/codec 后；tempo stale/刷新/record preflight 后 | 丢 binding、双写、旧 map 使用或刷新不原子时阻止关闭；不以旧 V1 路径掩盖 V2 失败 |
| P6 | 完整任务开始前固定候选；最终媒体/长曲/缺口审计后 | 任何关键 AC/人工输入缺失保持未关闭；不以历史 readiness/豁免宣布新链就绪 |

每次 checkpoint 在 evidence 中登记实际日期、candidate identity、结果和 next action；没有可复现测量不登记预估完成日期。延期优先缩小当前验证切片或修复其前置，不并行推进尚未开放的后续功能。

## 4. First Implementation Slice

P0-D 批准与本地提交后，先准备 P1 eval/golden/失败分类并评审，然后在独立 harness 按“runtime/模型身份 → 四图短段 → 数值/时间/WAV → 三首质量 → 十五分钟/取消资源”推进。P1 exit 所需歌曲、kernel placement/峰值采样若仍缺失，先完成其他不依赖项，记录缺口，不提前关闭。

P1 的 <900 秒分离测速只判断必要条件；P3 完整分离加节拍 ≤900 秒、P6 最终集成重验后才能评价参考机目标。其他 GPU 没有同等性能承诺。

## 5. Handoff After P6

P6 关闭后，建立独立新候选 readiness review，审阅 P1–P6 evidence、残余风险与可能豁免；仅有证据支持且 owner 接受时逐项调整 R-046–R-055。历史 Analyzer/Editor/Visualizer readiness 继续保留范围/候选身份，PROD-015 与生产上线仍单独处理。

自动音色/FX、MIDI、3D 辅助图、素材生成及离线/批量/其他视频输出不属本路线。进入这些能力前重新确认产品/架构，不把它们作为 P6 收尾任务。

## 2026-10-04 Authorization Update

DEC-069/070 ?? P1 eval/golden/??????????P1?P6 ????? AC????????????????????????????????????????????????????????????/??/??/???????????????????????????????????????
