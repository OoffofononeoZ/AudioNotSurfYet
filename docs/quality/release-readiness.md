---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
  - "docs/quality/failure-taxonomy.md"
  - "docs/quality/evidence-index.md"
next_action: "保留 M14 canonical artifact；PROD-015 解决前不进入生产上线"
---

# Analyzer Release Readiness

## Summary Decision

- Status：`Ready with waivers`；M14 是当前 Analyzer 候选。
- Reviewed date：2026-09-01。
- Reviewer：`project-owner` — approved M14 plan and authorized evidence/readiness completion。
- Scope：只覆盖当前本地音频 Analyzer 候选；不覆盖 Editor、Visualizer、远端上传、移动端、非 Chromium 或生产托管。
- Decision boundary：**Analyzer candidate is ready for release planning with waivers; this is not production launch authorization.**

M14 在 clean commit `0e991307d9045a1ec84ddaae0515612240894a92` 上完成 19/19 canonical，补齐 DOM/masonry 自定义顺序、Pointer Events、非拖动替代、独立 live region、FIFO 隔离与 `featureOrder` V1 持久化证据。PROD-015 继续独立阻断正式上线。

## Candidate Identity

下表绑定当前 M14 clean candidate。dirty provisional 只保留为实现反馈，不替代 canonical。

| Field | Value |
| --- | --- |
| Candidate implementation commit | `0e991307d9045a1ec84ddaae0515612240894a92` |
| Canonical evidence registration commit | 本记录所在的 `docs: register Analyzer M14 canonical evidence` 提交 |
| Canonical run | `M14-2026-09-01T02-36-49-995Z-0e991307`；19/19；clean start/end |
| Summary SHA-256 | `b169d6ff082746fc3cbe5ac6064151233c4f2869cba6e41f9dcdd7d052916fcc` |
| Chrome M14 log SHA-256 | `6790bac929147e64ca79e3e2f8d3ce3c8c8ae323465a41676015270f66ba1ab5` |
| Edge M14 log SHA-256 | `953906d828951ddcb73e87c0a2f8b7820834d5f4153fc2c010099d800e3c4bcd` |
| Build log SHA-256 | `c9993890c9974f95ff2515cd7acd868f5d8a028a4ccbf58da184f40a7721577d` |
| Diff-check log SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Artifact retention | `local-present` at `artifacts/evals/M14-2026-09-01T02-36-49-995Z-0e991307/` |

### Recorded Environment

| Item | Value |
| --- | --- |
| OS / hardware | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.65` |
| Edge | Microsoft Edge `152.0.4191.53` |

环境记录不包含序列号、UUID、UDID 或用户音频身份。性能和兼容性结论只适用于已记录候选、浏览器与硬件边界。

## Evidence Summary

- 21/21 Analyzer 特征以持久化 `featureOrder` 渲染，默认/reset 为 `FEATURE_IDS`；三横句柄、动作面板、键盘快捷键、live 播报和 data index 都跟随同一逻辑顺序。
- M14 unit 24/24、integration 19/19；permutation、before/after、首尾/no-op、V1 兼容/非法拒绝、最新 revision、quota 与 Coordinator 隔离均通过。
- Chrome/Edge M14 各 3/3；6px pointer threshold、跨列插入、长距离 auto-scroll、工作区外/Escape 取消、reload/切歌/reset、Canvas/details/focus 身份和 FIFO 队首均正确；排序前后 Worker analyze request 保持 `1 → 1`。
- Chrome/Edge M13 各 2/2；快速十连切换保持四张/八 Canvas，刷新前后单 Worker、精确值和 FIFO 年龄恢复继续正确。
- Chrome/Edge M12 各 3/3；390/1024 单列、1280/1920 双列、18px gap，21 wrapper 无相交/横向溢出，masonry/card Observer 与 RAF 在路由后释放。
- M7–M11 相邻回归全部通过；15 分钟四重卡最大反馈 `17.5ms`、分析归因 long task 为 0，20 次资源回归为 WebGL 21 created/20 lost、2 live RAF。
- 同源 WAV、MP3、FLAC、M11 原生权限和辅助技术历史证据继续有效；M13 不改变路由、音频/Worker message、cache schema 或 Editor lease/renderer 边界。

## Coverage Summary

| Coverage type | Evidence | Gaps or proposed waivers |
| --- | --- | --- |
| Success paths | 三格式双浏览器；播放/队列/恢复；21/21 分析、cache hit、exact cursor；M13 全卡/FIFO/懒挂载；M14 pointer/click/keyboard 排序、reset 与持久化；owner 学习任务 | 学习结果只证明 owner 3/3，不泛化到广泛用户 |
| Failure paths | decode/metadata、Worker extract、quota/transaction、permission denied、cache corruption、unknown schema、renderer failure 均验证受影响边界与未受影响能力 | 原生权限提示只能人工补偿，不能全自动化 |
| Boundary paths | 0–4 活动项、第五项 FIFO、21 卡/default/custom permutation、首尾/no-op/间隙/跨列/容器外、silence、尾帧、15 分钟、390/1024/1280/1920、DPR、reduced motion | 超出约 15 分钟只作 best-effort 观察，不属于支持承诺 |
| Exception paths | stale/cancel、pointer Escape/工作区外取消、快速换歌、非法 order、文件移动/内容变化、not-persisted、Canvas/WebGL/Observer/RAF/route dispose、辅助技术人工检查 | 没有正式 CI、axe 扫描或跨硬件基线 |

## Blockers

- 生产上线 blocker：PROD-015 尚未确定静态托管平台、域名、HTTPS/生产 URL 和 SPA fallback。该项解决前不得创建“已上线”声明，也不得把本结论当作部署授权。
- Editor boundary：Editor 不属于本 Analyzer 候选；E1–E7 已批准并关闭，M13 只回归其 lease/renderer 隔离，不把本文扩展成 Editor readiness。

## Proposed Waivers

下列 waiver 最初由 `project-owner` 于 2026-08-26 接受，并于 2026-09-01 随 M14 候选复核。W-001/W-002 因 chunk 与测试脚本变化再次触发，其余继续有效。

| ID | Risk or evidence gap | Proposed condition | Approver | Expiration or revisit trigger |
| --- | --- | --- | --- | --- |
| W-001 | R-019：最大 JS chunk 1,300.63 kB，尚无正式包体预算 | 接受当前候选 warning；不表述为包体优化完成 | `project-owner` — re-accepted for M14 2026-09-01 | 托管方案或预算确定、chunk 增长、首屏问题复现 |
| W-002 | ENG-002：canonical 是本地流程，没有正式 CI | 只引用绑定 commit 的 clean local artifact；不宣称持续集成保障 | `project-owner` — re-accepted for M14 2026-09-01 | 新增协作者、准备生产发布或测试脚本变化 |
| W-003 | EG-005：性能只在已登记 M1 设备上执行 | 保留实际硬件与浏览器版本，不向其他设备泛化阈值结论 | `project-owner` — accepted 2026-08-26 | 对外性能声明、目标设备扩大或结果不稳定 |
| W-004 | EG-004：学习结果只有 owner 3/3 | 只声称 owner 按 golden 解释通过，不声称普遍学习效果 | `project-owner` — accepted 2026-08-26 | 扩大用户或营销/产品学习效果声明 |
| W-005 | EG-006：OS picker 与权限气泡无法全自动化 | 接受 Chrome/Edge owner 人工签字作为当前候选补偿 | `project-owner` — accepted 2026-08-26 | 权限实现、浏览器或 OS 变化 |
| W-006 | R-020：Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在 | 仅依赖 ADR-0005 项目 Flux v1 与 golden；不得表述为 Meyda 已修复 | `project-owner` — accepted 2026-08-26 | Meyda 升级、Flux 公式或 cache/exact cursor 语义变化 |
| W-007 | ENG-007：esbuild 0.27.3 尚有 1 项 low 开发服务器 advisory | dev server 仅绑定可信本地环境，不作为生产服务或暴露到不受信网络 | `project-owner` — accepted 2026-08-26 | 上游兼容修复可用、部署方式变化或需要远程开发访问 |

R-005 的权限跨会话不持久已在架构风险中由 owner 接受；当前 Blob、显式恢复访问和可见三态是产品恢复边界。R-018 的范围漂移风险继续为 Open：Editor E1–E8 已按独立门禁关闭且不继承 Analyzer readiness，Visualizer 与其他未定义 Tab 仍不属于当前批准范围。

## Approval Record and Follow-Up

`project-owner` 于 2026-08-26 明确批准 M11 readiness。2026-08-28 又要求实施 M12，并在实现后明确回复“自行提交并完成后续即可”；该授权在 clean canonical 12/12 通过后用于批准 M12 evidence、关闭 R-028、恢复本结论并继续接受 W-001–W-007。owner 同时说明“可以不上传远程仓库”，因此本轮只创建本地提交，不推送。

历史批准原文：

`我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。`

本批准接受 W-001–W-007 并将本文改为 `approved`。后续继续遵守以下边界：

- 保留 M11/M12 历史 canonical，以及 M13 runner 失败目录、最终 provisional 与 clean canonical；仅在候选 commit、artifact identity 或受覆盖行为发生变化时重跑。
- PROD-015 解决前不创建上线声明、不选择或配置生产托管、不发布生产 URL。
- Editor E1–E7 历史批准继续独立；本文不批准或改写 Editor readiness。
- 本 readiness 只覆盖 Analyzer，不代表包含 Editor 的整体产品就绪。

2026-08-31，owner 明确要求先关闭 E7 再实施 M13，并授权 agent 自行提交与完成后续。E7 已按既有 46/46 evidence 关闭；M13 clean canonical 随后在实现 commit 上 17/17 通过。2026-09-01，本文件据该授权完成 evidence、R-028–R-030 与 W-001/W-002 复核，恢复 `Ready with waivers`。该结论不构成远程推送、生产部署或 PROD-015 的解决。

同日，owner 明确批准完整 M14 实施计划，并延续本地提交、canonical 与 evidence/readiness 完成授权。M14 clean canonical 在实现 commit `0e991307d9045a1ec84ddaae0515612240894a92` 上 19/19 通过；本文件据此完成 R-031–R-033、W-001/W-002 和当前候选身份复核，继续维持 `Ready with waivers`。该结论仍不构成远程推送、生产部署或 PROD-015 的解决。
