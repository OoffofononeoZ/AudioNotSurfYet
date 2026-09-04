---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/editor/e10-eval-plan.md"
  - "docs/quality/editor/e10-golden-examples.md"
  - "docs/architecture/risk-register.md"
next_action: "E10 实现与证据按本分类记录失败，不改写 E9 canonical"
---

# Editor E10 Failure Taxonomy

| Type | Definition | Severity | Response |
| --- | --- | --- | --- |
| EFT-E10-SELECTION | 小节边界、lane/class 范围或 point/range 收集错误 | S1 | 阻断 E10，修复纯选择模型 |
| EFT-E10-PARTIAL | 复制/移动只处理部分事件、覆盖或跳过冲突 | S0 | 立即停止；恢复原子 validation/commit |
| EFT-E10-IDENTITY | 复制复用 ID或移动更换 ID/相对秒数 | S0 | 阻断持久化与 canonical |
| EFT-E10-POINTER | 模式泄漏、右键 pan/菜单回归、cancel 后仍提交 | S1 | 清理单 owner pointer/capture 状态并回归 E3/E5/E9 |
| EFT-E10-KEYBOARD | 快捷键劫持输入、选择不可达或焦点丢失 | S1 | 修复 editable guard、focus 与 aria-live |
| EFT-E10-METER-CLIP | 拍号分母被箭头遮挡、换行或错位 | S2 | 修复 select 内容区和目标浏览器 CSS |
| EFT-E10-LEAVE | dialog 误离页、Promise 悬挂或抑制偏好在取消时写入 | S1 | 阻断 route lifecycle，恢复安全默认 |
| EFT-E10-EVIDENCE | 环境未运行却记 pass，或改写 E9 artifact | S0 | 撤回声明并保留真实 unverified/fail artifact |

S0 表示数据/证据完整性错误，S1 阻断核心任务，S2 为必须修复的局部表现缺陷。E10 未获得完整自动或 owner 补偿证据前保持 `In Progress`。
