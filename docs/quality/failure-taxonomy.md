---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-30
upstream_docs:
  - "docs/quality/eval-plan.md"
  - "docs/quality/golden-examples.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/architecture/risk-register.md"
next_action: "复核 M7 首次 canonical 计时误判修复与通过 evidence；继续保留 Edge、R-019、R-020"
---

# Failure Taxonomy

## 1. Classification Model

每个失败使用两个独立字段：

```text
failure_type + severity
```

`failure_type` 描述失败发生在哪类行为，`severity` 描述当前实例的影响。类型本身不固定严重度；同一类型可以因影响范围不同被评为不同级别。

## 2. Stable Failure Types

| Type ID | Failure type | Definition | Detection or eval coverage | Typical examples | Owner |
| --- | --- | --- | --- | --- | --- |
| FT-ANALYSIS | 分析正确性 | PCM、frame、Meyda 输出、维度、量化、精确值或 21 项映射不符合批准契约 | EV-A、direct golden、registry/renderer contract | 结果超容差、NaN、尾帧错位、Loudness/Complex 维度错误 | project-owner |
| FT-TIME | 时间同步 | 播放状态、AudioContext 基准、共享游标或 seek 时间不一致 | EV-S、AudioEngine 集成、浏览器计时 | 游标偏差 >100ms、刷新恢复旧时间、卡片私有 zoom | project-owner |
| FT-IDENTITY | 任务与缓存身份 | job generation、track/config/feature hash 或 cursor request 身份错误 | EV-J、stale/cancel/cache-key 测试 | 旧歌结果覆盖新歌、错误 cache hit、迟到精确值进入 UI | project-owner |
| FT-PLAYBACK | 播放生命周期 | AudioContext、BufferSource、队列、MusicBar 或播放状态生命周期失败 | EV-S、MusicBar 回归、故障注入 | 双 AudioContext、pause 后仍有能量、source 未释放、loading 卡死 | project-owner |
| FT-PERSISTENCE | 持久化、权限与本地数据边界 | IndexedDB schema/事务、Blob/cache 保留、文件句柄权限、恢复状态或浏览器本地处理边界失败 | EV-D、IndexedDB/permission matrix、网络范围审计 | 保存全部 Blob、自动弹权限、quota 部分写入、文件变化复用旧 cache、音频被发送到网络 | project-owner |
| FT-COMPAT | 格式与浏览器兼容 | 批准格式、浏览器、采样率或视口行为不符合矩阵 | EV-B、三格式/双浏览器/三视口 | FLAC 无法播放、Edge 路径未验证却标记完成、Canvas 尺寸错误 | project-owner |
| FT-PERFORMANCE | 性能与资源 | 主线程响应、长任务、数据量、Worker/Audio/Canvas/Object URL 或 bundle 风险失控 | EV-R、trace、资源循环、build | 反馈 >100ms、主线程分析任务 >50ms、资源单调增长 | project-owner |
| FT-ACCESSIBILITY | 无障碍与交互 | 键盘、焦点、名称、reduced motion 或核心控件操作失败 | EV-U、键盘/焦点/axe-compatible 检查 | 无法换卡、焦点不可见、错误后焦点丢失 | project-owner |
| FT-VISUAL | 视觉语义 | 图表、图例、DOM 精确值或非颜色表达造成错误/误导理解 | EV-A、EV-U、golden visual/manual review | 热图与数值不一致、只靠颜色、量化裁掉小信号 | project-owner |
| FT-EVIDENCE | 证据完整性 | 测试命令、fixture provenance、环境、结果或审批记录不足以支持声明 | 全部 eval、EG-001–EG-006、文档检查 | 无效脚本被称为通过、缺 hash、缺 Edge 却声明兼容、planned 写成 pass | project-owner |

只有现有类型无法稳定表达重复问题时才增加新类型。新增或重命名类型会使历史比较与 readiness 分类待复核。

## 3. Severity Levels

| Severity | Definition | Examples | Required response | Gate effect |
| --- | --- | --- | --- | --- |
| S0 | 本地数据边界、结果身份或用户信任发生不可接受破坏，必须立即停止相关工作 | 音频/元数据被发送到网络；错误歌曲或错误 hash 的结果被当成当前结果；持久化操作破坏不相关数据 | 停止里程碑和相关测试，保存证据，定位范围，先修复并增加回归；由 project-owner 重新确认是否可继续 | 阻断当前及所有下游门禁，不允许 waiver |
| S1 | 核心批准任务、正确性、同步、性能或必需兼容路径失败 | Meyda 超容差；游标 >100ms；输入 >100ms；分析主线程任务 >50ms；当前歌曲不可播放/恢复；必需格式或键盘路径失败 | 在当前里程碑修复，补成功及相邻失败/边界回归，再由 project-owner 验证 | 阻断当前里程碑和下一门禁，不允许带入 |
| S2 | 主要体验明显退化，但存在安全、明确且不违反硬性 AC 的替代路径 | 非核心诊断不足、自动恢复失败但批准的用户恢复路径完整、非必需视觉细节退化 | 记录影响、替代路径、owner、修复计划和复查触发器；评估是否升级为 S1 | 只有不违反任何硬性 AC、范围、隐私、正确性或浏览器承诺时才可由 project-owner 接受 |
| S3 | 不误导数据、不阻断任务且不改变批准行为的轻微问题 | 非关键文案、间距或开发诊断不一致 | 记录并排入后续修复；相邻回归按风险执行 | 可不阻断，但不能用 S3 标签掩盖硬性 AC 失败 |

## 4. Gate and Waiver Rules

- 任一硬性 acceptance criterion 失败都会阻断对应里程碑，即使初始严重度被误标为 S2/S3。
- S0 和 S1 必须在进入下一门禁前关闭，并附修复及回归证据；不得 waiver。
- S2/S3 只有在不违反范围、隐私、本地数据边界、分析正确性、浏览器/格式承诺或其他硬性 AC 时，才可被接受。
- 接受 S2/S3 必须记录失败实例、影响、替代路径、approver `project-owner`、失效日期或复查触发器。
- 缺失证据默认是 `blocked`，不是 pass。若缺失证据本身导致错误质量声明，分类为 FT-EVIDENCE。
- `release-readiness.md` 创建后必须分别列出 blockers 和已接受风险，不能用“known issue”合并。
- 大型报告、trace、截图和性能 dump 只在本地保留是已批准的存储政策，本身不是失败；evidence index 必须保存摘要、关键数值、复现命令、artifact hash 和 retention state。
- 本地产物标为 `local-deleted` 后，摘要不能单独证明 readiness。需要原始证据的决策必须重新执行 eval；拒绝重跑却声称 ready 分类为 FT-EVIDENCE/S1。
- S0/S1 相关本地产物若在缺陷关闭和回归获批前被删除，分类为 FT-EVIDENCE/S1；如果删除行为同时掩盖仍可能存在的 S0 影响，继续按 S0 阻断处理。

## 5. Classification Procedure

1. 记录实际环境、fixture、操作、期望、实际结果和可复现证据。
2. 选择一个主 failure type；若存在多个独立根因，拆成多个失败实例。
3. 按用户/数据/正确性/兼容性/可靠性影响选择 severity，不按修复工作量选择。
4. 映射受影响 AC、eval ID、风险 ID 和里程碑。
5. 执行严重度要求的停止、修复、回归或 owner 接受流程。
6. 只有证据证明根因和相邻路径均受控后，才能关闭或降级。

建议实例标识格式：

```text
FAIL-<run-id>-<sequence>: <failure_type>/<severity>
```

示例：旧 track 的 Worker result 进入当前卡片，应分类为 `FT-IDENTITY/S0`；仅迟到但被正确丢弃是通过的异常场景，不是失败。

## 6. Initial Examples

| Failure instance | Type | Severity | Why |
| --- | --- | --- | --- |
| 音频或分析结果离开批准的浏览器本地边界 | FT-PERSISTENCE | S0 | 违反明确隐私和范围边界 |
| stale result 被展示为当前歌曲 | FT-IDENTITY | S0 | 用户看到错误歌曲身份的分析结果 |
| Worker 结果超出批准容差 | FT-ANALYSIS | S1 | 核心学习数据不可信 |
| 播放游标偏差 130ms | FT-TIME | S1 | 超过硬阈值 |
| 当前环境未安装 Edge且状态保持 blocked | 不是失败实例 | — | 是 EG-003 证据缺口；只有错误宣称 Edge 通过时才是 FT-EVIDENCE/S1 |
| quota 失败后显示 not-persisted 且当前页面继续可用 | 不是失败实例 | — | 是批准的 expected-failure 行为 |
| 本地产物按政策在里程碑批准后删除，index 保留摘要/hash/命令 | 不是失败实例 | — | 是允许的 retention 状态；未来 readiness 需要时重新执行 |
| 原始 trace 已删除且拒绝重跑，却宣称性能 readiness 通过 | FT-EVIDENCE | S1 | 缺少支持硬性性能声明的可复现证据 |
| 非关键辅助说明有错别字且不改变含义 | FT-VISUAL | S3 | 不影响任务或数据语义 |

## 7. M7 Closed Failure Instance

| Failure instance | Type | Severity | Evidence and disposition |
| --- | --- | --- | --- |
| `FAIL-M7-2026-07-30T03-21-14-150Z-28fc4699-01` | FT-EVIDENCE | S1 | 首次 clean canonical 的 30Hz 断言用 Node 等待 550ms 代替页面内实际时间；浏览器任务繁忙时读取发生在更晚时间，却仍使用固定 18 次上限。该 run 保持 `fail`，阻断 M7。`f022b86` 把 cadence 调整为 40ms，并用同一页面的 `performance.now()` 计算实际窗口与 30Hz 上限；单 worker 连续 8 次、完整 M7 Chrome 4/4 和第二次 clean canonical 24/24 通过。实例已由回归关闭，但原失败 artifact 保留。 |

该实例没有证明产品曾超过 30Hz；它证明原 evidence clock 无法支持该声明。关闭只恢复自动化证据可信度，不替代 owner 学习任务，也不改变 Edge、R-019 或 R-020 状态。

## 8. Q0 Approval Gate

本 taxonomy 只有在 `project-owner` 确认以下内容后才能改为 `approved`：

- 十个 failure type 足以覆盖 Q0 时的 19 个风险、M6 新增的 R-020 和七组 eval；
- S0–S3 的定义与硬性 AC 门禁一致；
- S0/S1 不允许带入下一门禁；
- S2/S3 的接受条件、approver 和复查触发器明确；
- local-only artifact 的保留、删除和 readiness 重跑规则明确；
- expected failure 与真正失败实例被清楚区分。

## 9. Approval Record

`project-owner` 于 2026-07-28 明确批准本文的十类 failure type、S0–S3、门禁响应和本地产物复现规则。
