---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/v6-eval-plan.md"
  - "docs/quality/visualizer/v6-golden-examples.md"
  - "docs/quality/visualizer/v5-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "V6 canonical 与人工门禁已批准；新 readiness 缺陷按独立修订项分类"
---

# Visualizer V6 Failure Taxonomy

V1–V5 的 route、project、binding、scene、recording 与媒体分类继续有效；V6 新增跨格式、容量、全局资源和 evidence 域。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| V6FT-FORMAT | format/identity | MP3/WAV/FLAC 任一无法完成当前歌曲、恢复、工程 round-trip 或被错误混用 | V6-EV-FORMAT | 阻断 V6；修复 decode/identity/route，不做格式 fallback |
| V6FT-BINDING | heavy binding transition | 四特征不是精确集合、模板切换残留引用、出现第五项或 stale 回填 | V6-EV-STRESS/RESOURCE | 阻断 V6；修复 planner/lease/generation |
| V6FT-CLOCK | playback/scene timing | 15 分钟压力下 feedback、scene offset、frame 或 LongTask 超阈值 | V6-EV-STRESS | 阻断 V6；不得用降低事实量或新 RAF 掩盖 |
| V6FT-RESOURCE | cross-workspace lifecycle | AudioContext、Worker、RAF、Canvas/WebGL、track、Observer、listener、Blob URL 单调累积 | V6-EV-RESOURCE | S0/S1；恢复单所有者和成对 cleanup |
| V6FT-RECOVERY | compounded failure | context、quota、stale、坏 JSON、recorder 或 renderer 故障后工程/transport 不可恢复或伪造成功 | V6-EV-FAILURE | 阻断 V6；保留失败 artifact并修复原子边界 |
| V6FT-A11Y | responsive/accessibility | 三视口/DPR 下遮挡、焦点丢失、状态只靠颜色或 reduced motion 关闭用户内容 | V6-EV-LAYOUT | 修复并重跑双浏览器矩阵 |
| V6FT-MEDIA | tri-format WebM | 任一成功录制文件缺轨、codec/尺寸/平均 fps/时长不合格，或相邻 packet gap 超过 DEC-048 的四个目标帧间隔 | V6-EV-MEDIA | 阻断对应浏览器；不得追记 unavailable |
| V6FT-EVIDENCE | canonical identity | dirty canonical、步数错误、缺日志/hash/environment 或历史 artifact 被改写 | V6-EV-REGRESSION/EVIDENCE | 阻断登记；创建新的 clean run |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 数据损坏、错误歌曲覆盖、第二核心 runtime、半文件 ready 或不可恢复跨 route 失控 | 立即停止 canonical；不得豁免 |
| S1 | 三格式、默认双浏览器、四特征、资源、媒体或故障恢复门禁不成立 | 阻断 V6 |
| S2 | optional preset、单一布局、键盘/播报或诊断差异 | 修复并重跑相关层，按影响决定全量 |
| S3 | 不改变事实的低等级文案或 evidence 展示差异 | 记录并按 AC 判断，不掩盖高等级问题 |

只有资源获取前的 typed `preset-unavailable` 可作为 optional preset 能力事实；已生成媒体失败、测试超时、浏览器缺失或 harness 不稳定都不能转换为 unavailable。无法自动化的原生 picker、辅助技术和长会话体感必须保留 owner、原因、残余风险与补偿步骤。

DEC-048 前的 clean 尝试 `V6-2026-09-03T10-25-21-807Z-088f21d3` 因 135ms 视频 packet gap 触发当时的 `V6FT-MEDIA / S1` 并提前停止；该 artifact 保留为失败事实，未生成或登记 canonical summary。阈值经 owner 明确取舍后以 DEC-048 前向修订，代码和测试在独立 commit 上重跑；最终 `V6-2026-09-03T16-33-03-497Z-ef12ce39` 54/54 通过，未观察到未关闭的自动化 S0/S1。2026-09-04 owner 批准人工门禁，V6 为 `Complete`、R-041 为 `Mitigated`；该状态不外推为整体 readiness 或生产上线批准。
