---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/quality/processing/eval-plan.md"
  - "docs/quality/processing/golden-examples.md"
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/architecture/risk-register.md"
next_action: "四模型在双浏览器 session 创建失败；依据 P1 evidence 复核兼容方案，P1 未完成，P2 不开放"
---

# Browser FT P1 Failure Taxonomy

## 1. Classification Boundary

本文只分类 P1 AC-P101–P106 的失败，已按 DEC-070 approved。行为类型与严重度分别记录；同一个 PFT 可因影响不同被赋予不同严重度。owner 为 project-owner。

预期故障能否被正确拒绝是测试结果，注入本身不是缺陷：例如 checksum不符被正确拒绝可通过负向case；损坏模型仍被接收才是 PFT-MODEL 失败。环境缺失与产品失败也分开记录，但缺失关键证据同样不能关闭 P1。

## 2. Stable Failure Types

| Type ID | Definition / default severity | Detection / golden | AC / risk | Response |
| --- | --- | --- | --- | --- |
| PFT-MODEL | revision/file/bytes/checksum/许可缺失或不符被接收，半成品成为可用输入；S1 | P1-EV-MODEL；P1-G01/G02 | AC-P101；R-048 | 拒绝 artifact，保留准确错误/来源，修复校验后重验；不换浮动模型 |
| PFT-RUNTIME | ORT/assets/version、WebGPU图/session/实际后端不满足契约，隐式CPU或小模型fallback；S1 | P1-EV-RUNTIME；P1-G03/G04/G05 | AC-P101；R-046/R-048 | 停止后续接入，保存实际初始化/推断/placement证据，复核runtime；不静默降版本 |
| PFT-ROLE | 单专用模型冒充四轨、错row/role/shape/type，非finite输出未拒绝；S1 | P1-EV-ROLE；P1-G04/G06/G07 | AC-P102；R-046/R-052 | 拒绝结果，修复selector/validator和顺序释放，重验四模型 |
| PFT-NUMERIC | 对应轨max absolute>1e-3、参考不独立/不可用/非finite、只报平均误差；S1 | P1-EV-PARITY；P1-G08/G09 | AC-P102；R-046/R-052 | 保留每轨原误差/输入/config，阻止关闭，定位图/后端/预处理差异；不临时放宽 |
| PFT-TIME | PCM修改/detach、chunk缺帧/重复、重采样/拼接平移/裁静音、输出长度超限或未定义downmix；S1，源数据损坏升S0 | P1-EV-TIME；P1-G10–G14/G17 | AC-P103；R-047 | 不发布成功结果，保护原PCM；修复range/hash/resample/window/tail并重跑边界 |
| PFT-DERIVED | waveform/energy/WAV来源不一致，RMS/codec/长度/header/样本错误，失败导出误报成功；S1 | P1-EV-DERIVED；P1-G15/G16/G22 | AC-P104；R-047/R-052 | 保留源artifact，修复派生/encoder/导出反馈并独立解析复核 |
| PFT-QUALITY | 任一轨角色不可辨识或断裂/伪影导致不可用，隐藏串音问题或other误称lead；S1 | P1-EV-QUALITY；P1-G13/G18 | AC-P105；R-052 | 保存匿名听感结论，停止P2接入并复核模型/方案；不以parity替代实际质量 |
| PFT-RESOURCE | 分离≥900秒、OOM、反馈>100ms/heartbeat>1s、session重叠/累积、cancel/迟到/五秒清理登记失败；S1，原有数据不可恢复受损升S0 | P1-EV-PERF/CANCEL/REGRESSION；P1-G05/G17/G19/G20/G21/G24 | AC-P106；R-049/R-050 | 停止接入，保留耗时/资源/取消记录；清理或登记残留，修复后重跑相关阶段与长曲 |
| PFT-EVIDENCE | 候选/manifest/环境/日志身份缺项，把skip/mock/dirty/热cache/manual缺失当通过，暴露用户内容；S1，数据外泄升S0 | P1-EV-EVIDENCE；P1-G09/G22/G23/G24 | AC-P101–P106；R-048/R-049/R-052 | 撤销失实通过结论，保留实际fail/unverified；补齐独立证据/脱敏，不推断风险已缓解 |

## 3. Severity and Gate Response

沿用仓库既有 S0–S3 严重度含义，以下对应 P1 的具体影响；任何已批准 AC 被违反均阻止关闭，严重度低不构成阈值豁免。

| Severity | P1 meaning | Gate response |
| --- | --- | --- |
| S0 | 原PCM/已有工程或完整artifact不可恢复损坏、错误source覆盖、用户音频/私有信息外泄或跨runtime失控 | 立即停止相关运行，保护数据并登记事件；不得豁免关闭P1 |
| S1 | 四模型分离、数值/时间/WAV/质量/性能/取消的核心AC不满足，或关键证据缺失 | 阻止P1关闭/P2接入；修复或复核方案后重新验证 |
| S2 | 有明确恢复路径的局部状态/可访问性/错误表达问题，核心结果仍可用 | 修复并复跑相关case；若触犯反馈/错误反馈等AC，仍阻止关闭 |
| S3 | 不影响行为/AC的低等级文案或诊断差异 | 如实记录，不掩盖更高严重度或缺失证据 |

WASM参考不可用标产品/环境原因及所缺 AC-P102；缺歌曲、峰值或浏览器标 unverified 和 owner补偿，不捏造S1产品缺陷也不记通过。真实 GPU 异常与故障注入结果单列。

## 4. Failure Record and Revalidation

每实例记录 type、severity、实际影响、run/candidate身份、eval/golden/AC/risk、预期与实际、证据位置、owner、原因/未知项、恢复/补偿和下一步。模型/runtime/合成fixture身份可记录；用户歌曲仅匿名ID，不提交私有路径/名称/hash/音频。

修复后重跑原失败case和对应成功/边界case。模型/runtime/config、时间/WAV、资源/取消等影响长曲时，再重跑受影响的真实模型/浏览器/性能组；失败artifact不被新pass覆盖。验收阈值/兼容路线变化回到架构/delivery评审，不在taxonomy中隐式放宽。

P1关闭需 AC-P101–P106 全部有实际证据、适用人工结论和 owner批准；风险只能按证据逐项复核。本文落盘不改变任何风险状态，也不产生 readiness 或上线决定。

## Approval

2026-10-04，owner 要求实施本轮计划（DEC-070），本质量契约获批。DEC-069 允许证据满足后自主推进；本批准不补写模型运行、人工试听或性能结论。

## Implementation Evidence

实际运行及缺口见 [P1 evidence index](evidence-index.md)。合成/注入通过与真实四图不兼容分别记录，预期样例不是通过声明；本轮没有 P1 关闭或风险缓解结论。
