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
next_action: "维持 M13 Ready with waivers；PROD-015 仍阻断正式上线"
---

# Analyzer Release Readiness

## Summary Decision

- Status：`Ready with waivers`；M12 结论保留为历史，当前身份为 M13。
- Reviewed date：2026-09-01。
- Reviewer：`project-owner` — approved M13 plan and authorized evidence/readiness completion。
- Scope：只覆盖当前本地音频 Analyzer 候选；不覆盖 Editor、Visualizer、远端上传、移动端、非 Chromium 或生产托管。
- Decision boundary：**Analyzer candidate is ready for release planning with waivers; this is not production launch authorization.**

M13 在 clean commit `63c04005670145d83ee181d474197bce921c5300` 上完成 17/17 canonical，交付 21 张稳定折叠卡、FIFO 活动队列、按需资源挂载和 V1 adapter。R-028/R-029/R-030 已缓解；Analyzer 候选恢复 `Ready with waivers`。PROD-015 继续独立阻断正式上线。

## Candidate Identity

下表绑定当前 M13 clean candidate。dirty provisional 与 runner 路径失败目录保留为诊断前例，不替代 canonical。

| Field | Value |
| --- | --- |
| Candidate implementation commit | `63c04005670145d83ee181d474197bce921c5300` |
| Canonical evidence registration commit | 本记录所在的 `docs: register Analyzer M13 canonical evidence` 提交 |
| Canonical run | `M13-2026-08-31T17-44-39-680Z-63c04005`；17/17；clean start/end |
| Summary SHA-256 | `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc` |
| Chrome M13 log SHA-256 | `c6ee7b4f1d755c5e8ece799a5bd15924451e4387bb924c360db4ae82d0b16ed4` |
| Edge M13 log SHA-256 | `d38983400f25830ca433d9d107da332ace5f84607eb28a730512c609861618f2` |
| Build log SHA-256 | `103092a3de50497ff6531210ec64c12ffb2bc128393c4d04c338bd31f39e89eb` |
| Diff-check log SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Artifact retention | `local-present` at `artifacts/evals/M13-2026-08-31T17-44-39-680Z-63c04005/` |

### Recorded Environment

| Item | Value |
| --- | --- |
| OS / hardware | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.64` |
| Edge | Microsoft Edge `152.0.4191.53` |

环境记录不包含序列号、UUID、UDID 或用户音频身份。性能和兼容性结论只适用于已记录候选、浏览器与硬件边界。

## Evidence Summary

- 21/21 Analyzer 特征始终按 `FEATURE_IDS` 渲染；初始无 Canvas/select/remove，最多四张展开并由一个 Worker job 分析。
- M13 unit 16/16、integration 12/12；FIFO reducer、V1 双向 adapter、generation/cache、串行 save/revision 和 quota/not-persisted 均通过。
- Chrome/Edge M13 各 2/2；快速十连切换保持四张/八 Canvas，刷新前后单 Worker、精确值和 FIFO 年龄恢复正确。
- Chrome/Edge M12 各 3/3；390/1024 单列、1280/1920 双列、18px gap，21 wrapper 无相交/横向溢出，masonry/card Observer 与 RAF 在路由后释放。
- M7–M11 相邻回归全部通过；15 分钟四重卡最大反馈 `17.5ms`、分析归因 long task 为 0，20 次资源回归为 WebGL 21 created/20 lost、2 live RAF。
- 同源 WAV、MP3、FLAC、M11 原生权限和辅助技术历史证据继续有效；M13 不改变路由、音频/Worker message、cache schema 或 Editor lease/renderer 边界。

## Coverage Summary

| Coverage type | Evidence | Gaps or proposed waivers |
| --- | --- | --- |
| Success paths | 三格式双浏览器；播放/队列/恢复；21/21 分析、cache hit、exact cursor；M13 全卡/FIFO/懒挂载与共享视口；owner 学习任务 | 学习结果只证明 owner 3/3，不泛化到广泛用户 |
| Failure paths | decode/metadata、Worker extract、quota/transaction、permission denied、cache corruption、unknown schema、renderer failure 均验证受影响边界与未受影响能力 | 原生权限提示只能人工补偿，不能全自动化 |
| Boundary paths | 0–4 活动项、第五项 FIFO、21 折叠卡/错误态/动态高度、重复与未知特征、silence、尾帧、15 分钟、390/1024/1280/1920、DPR、reduced motion | 超出约 15 分钟只作 best-effort 观察，不属于支持承诺 |
| Exception paths | stale/cancel、快速换歌、文件移动/内容变化、not-persisted、Canvas/WebGL/Observer/RAF/route dispose、辅助技术人工检查 | 没有正式 CI、axe 扫描或跨硬件基线 |

## Blockers

- 生产上线 blocker：PROD-015 尚未确定静态托管平台、域名、HTTPS/生产 URL 和 SPA fallback。该项解决前不得创建“已上线”声明，也不得把本结论当作部署授权。
- Editor boundary：Editor 不属于本 Analyzer 候选；E1–E7 已批准并关闭，M13 只回归其 lease/renderer 隔离，不把本文扩展成 Editor readiness。

## Proposed Waivers

下列 waiver 最初由 `project-owner` 于 2026-08-26 接受，并于 2026-09-01 随 M13 候选复核。W-001/W-002 因 chunk 与测试脚本变化再次触发，其余继续有效。

| ID | Risk or evidence gap | Proposed condition | Approver | Expiration or revisit trigger |
| --- | --- | --- | --- | --- |
| W-001 | R-019：最大 JS chunk 1,292.10 kB，尚无正式包体预算 | 接受当前候选 warning；不表述为包体优化完成 | `project-owner` — re-accepted 2026-09-01 | 托管方案或预算确定、chunk 增长、首屏问题复现 |
| W-002 | ENG-002：canonical 是本地流程，没有正式 CI | 只引用绑定 commit 的 clean local artifact；不宣称持续集成保障 | `project-owner` — re-accepted 2026-09-01 | 新增协作者、准备生产发布或测试脚本变化 |
| W-003 | EG-005：性能只在已登记 M1 设备上执行 | 保留实际硬件与浏览器版本，不向其他设备泛化阈值结论 | `project-owner` — accepted 2026-08-26 | 对外性能声明、目标设备扩大或结果不稳定 |
| W-004 | EG-004：学习结果只有 owner 3/3 | 只声称 owner 按 golden 解释通过，不声称普遍学习效果 | `project-owner` — accepted 2026-08-26 | 扩大用户或营销/产品学习效果声明 |
| W-005 | EG-006：OS picker 与权限气泡无法全自动化 | 接受 Chrome/Edge owner 人工签字作为当前候选补偿 | `project-owner` — accepted 2026-08-26 | 权限实现、浏览器或 OS 变化 |
| W-006 | R-020：Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在 | 仅依赖 ADR-0005 项目 Flux v1 与 golden；不得表述为 Meyda 已修复 | `project-owner` — accepted 2026-08-26 | Meyda 升级、Flux 公式或 cache/exact cursor 语义变化 |
| W-007 | ENG-007：esbuild 0.27.3 尚有 1 项 low 开发服务器 advisory | dev server 仅绑定可信本地环境，不作为生产服务或暴露到不受信网络 | `project-owner` — accepted 2026-08-26 | 上游兼容修复可用、部署方式变化或需要远程开发访问 |

R-005 的权限跨会话不持久已在架构风险中由 owner 接受；当前 Blob、显式恢复访问和可见三态是产品恢复边界。R-018 的范围漂移风险继续为 Open：Editor E1–E7 已按独立门禁关闭且不继承 Analyzer readiness，Visualizer 与其他未定义 Tab 仍不属于当前批准范围。

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
