---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/architecture/editor/project-format-v1.md"
next_action: "把 E1 JSON golden 固定为测试 fixture，并在 canonical 中登记结果"
---

# Editor E1 Golden Examples

| ID | Category | Input | Expected outcome | Why it matters |
| --- | --- | --- | --- | --- |
| E1-G01 | success | 当前歌曲首次进入 Editor | 创建默认 4/4、空 lane、全曲 viewport、overlay 0.10/0.35 的规范工程并保存 | 固定最小可用工程 |
| E1-G02 | success | 含 point/range、多个 inner class 与 tempo segment 的有效 V1 | encode → decode → encode bytes 完全一致，语义保持 | E1 schema 必须为 E3/E5 提前提供安全 round-trip |
| E1-G03 | boundary | 秒数含超过 6 位小数、range 首尾相邻、歌曲尾部事件 | 规范为微秒；相邻 range 允许；尾部边界按契约接受或拒绝 | 固定易忘的时间边界 |
| E1-G04 | failure | 顶层或嵌套未知字段、schemaVersion 非 1、format 错误 | strict validator 拒绝，当前内存与 durable draft 不变 | 防止猜测迁移或静默丢字段 |
| E1-G05 | failure | 全局重复 ID、悬空 innerClassId、重复 point | 完整校验失败且不部分应用 | 防止 identity 损坏 |
| E1-G06 | failure | 同 lane/inner class range 真重叠或 end≤start | 拒绝；端点相邻的 `[a,b)`/`[b,c)` 仍允许 | 固定半开区间语义 |
| E1-G07 | failure | 工程 hash 不同或 duration 超出 sample-rate 容差 | 拒绝导入并保留当前工程/草稿 | 防止把标注套到错误歌曲 |
| E1-G08 | exception | IndexedDB quota 或 transaction abort | 内存工程继续可用，旧 durable draft 保留，状态为 `not-persisted` | 证明失败不会毁掉工作 |
| E1-G09 | race | 旧 Editor lease 在新 route acquire 后释放 | 旧 release 无效，新 track repeat-one 保持 | 防止迟到 cleanup 泄漏 |
| E1-G10 | exception | 异歌冲突选择取消 | 可恢复时回旧歌曲 Editor 并暂停；不可恢复时保留旧草稿并返回进入前页面 | 固定 owner 选择的取消语义 |
| E1-G11 | exception | picker 取消或无效 JSON | 不替换工程，不清除 dirty/persistence 状态 | 用户取消不是错误或清空指令 |

Golden JSON 只包含虚构元数据和确定性 ID/hash，不记录用户本地路径、私有音频名称或系统设备标识。
