---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
  - "docs/quality/failure-taxonomy.md"
  - "docs/quality/evidence-index.md"
next_action: "保留 M12 canonical artifact；PROD-015 解决前不进入正式上线，Editor E6 人工补偿继续独立进行"
---

# Analyzer Release Readiness

## Summary Decision

- Status：`Ready with waivers`。
- Decision date：2026-08-28。
- Reviewer：`project-owner` — approved M12 canonical evidence and continued W-001–W-007。
- Scope：只覆盖当前本地音频 Analyzer 候选；不覆盖 Editor、Visualizer、远端上传、移动端、非 Chromium 或生产托管。
- Decision boundary：**Analyzer candidate is ready for release planning with waivers; this is not production launch authorization.**

M12 在 clean commit `be655e6765a63493fb1a3a4ee99992073b06e54e` 上完成 12/12 canonical：开场文案删除、实时最短列几何、稳定 slot DOM、动态高度重排和 Observer/RAF 清理均通过真实 Chrome/Edge 证据，R-028 已缓解。Analyzer 因此恢复 `Ready with waivers`；PROD-015 继续独立阻断正式上线。

## Candidate Identity

下表只绑定本次获批的 M12 clean candidate。dirty provisional 与首次失败 run 均保留为诊断前例，不替代 canonical 身份。

| Field | Value |
| --- | --- |
| Candidate implementation commit | `be655e6765a63493fb1a3a4ee99992073b06e54e` |
| Canonical evidence registration commit | `db604b3b79fdf04a3d7c3ec5fcc2d5f3e3c77cfa` |
| Canonical run | `M12-2026-08-28T07-30-39-789Z-be655e67`；12/12；clean start/end |
| Summary SHA-256 | `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441` |
| Chrome M12 log SHA-256 | `a6326aa0d51039444df922288daec65fd333f2697c93bcab7d28df251b1df2ec` |
| Edge M12 log SHA-256 | `65ce111f0a899d5a256a513af9db361a83aae04c72afc3e5388a45b9d43f50b1` |
| Build log SHA-256 | `73c7e9121fd45ab77c8ac9de48b6a20ed711e419096f55f9fd230cc4f6772e37` |
| Diff-check log SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Artifact retention | `local-present` at `artifacts/evals/M12-2026-08-28T07-30-39-789Z-be655e67/` |

### Recorded Environment

| Item | Value |
| --- | --- |
| OS / hardware | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.64` |
| Edge | Microsoft Edge `151.0.4129.107` |

环境记录不包含序列号、UUID、UDID 或用户音频身份。性能和兼容性结论只适用于已记录候选、浏览器与硬件边界。

## Evidence Summary

- 21/21 Analyzer 特征已由 registry、Worker、cache、golden、exact cursor、六类 renderer 和最多四张唯一卡的浏览器路径覆盖。
- M12 unit 4/4；Chrome/Edge M12 各 3/3，覆盖 390/1024 单列、1280/1920 双列、18px gap、最短列平局选左、无相交和容器包围。
- 四个稳定 slot 在空槽、替换、错误态、数据到达和 `details` 展开时只更新绝对定位 wrapper；DOM/焦点/明细/Canvas 状态保持，页面无横向溢出。
- 10 次 Home/Analyzer 循环未累积 ResizeObserver、RAF、Canvas 或 console error/warn；M11 资源回归仍为 WebGL 21 created/20 lost、2 live RAF。
- M7–M10 相邻回归分别 5/5、2/2、2/2、3/3；M7 exact cursor 每项 14 次/607.7ms（上限 20），15 分钟回归最大反馈 18.8ms、分析归因 long task 为 0。
- 同源 WAV、MP3、FLAC、M11 原生权限和辅助技术历史证据继续有效；M12 不改变路由、持久化 schema、分析接口、音频行为或 `MeydaCard` props。

## Coverage Summary

| Coverage type | Evidence | Gaps or proposed waivers |
| --- | --- | --- |
| Success paths | 三格式双浏览器；播放/队列/恢复；21/21 分析、cache hit、exact cursor；M12 四槽实时最短列与共享视口；owner 学习任务 | 学习结果只证明 owner 3/3，不泛化到广泛用户 |
| Failure paths | decode/metadata、Worker extract、quota/transaction、permission denied、cache corruption、unknown schema、renderer failure 均验证受影响边界与未受影响能力 | 原生权限提示只能人工补偿，不能全自动化 |
| Boundary paths | 0/1/4 卡、空槽/错误态/动态高度、重复与未知特征、silence、尾帧、15 分钟、390/1024/1280/1920、DPR、reduced motion | 超出约 15 分钟只作 best-effort 观察，不属于支持承诺 |
| Exception paths | stale/cancel、快速换歌、文件移动/内容变化、not-persisted、Canvas/WebGL/Observer/RAF/route dispose、辅助技术人工检查 | 没有正式 CI、axe 扫描或跨硬件基线 |

## Blockers

- 生产上线 blocker：PROD-015 尚未确定静态托管平台、域名、HTTPS/生产 URL 和 SPA fallback。该项解决前不得创建“已上线”声明，也不得把本结论当作部署授权。
- Editor boundary：Editor 不属于本 Analyzer 候选；E1–E5 已完成，E6 clean canonical 已通过但人工补偿仍为 `In Progress`，不能继承本文 readiness。

## Proposed Waivers

下列 waiver 最初由 `project-owner` 于 2026-08-26 接受，并于 2026-08-28 随 M12 候选复核。W-001/W-002 因 chunk 增长和测试脚本变化触发后重新接受，其余继续有效。

| ID | Risk or evidence gap | Proposed condition | Approver | Expiration or revisit trigger |
| --- | --- | --- | --- | --- |
| W-001 | R-019：最大 JS chunk 1,284.55 kB，尚无正式包体预算 | 接受当前候选 warning；不表述为包体优化完成 | `project-owner` — re-accepted 2026-08-28 | 托管方案或预算确定、chunk 增长、首屏问题复现 |
| W-002 | ENG-002：canonical 是本地流程，没有正式 CI | 只引用绑定 commit 的 clean local artifact；不宣称持续集成保障 | `project-owner` — re-accepted 2026-08-28 | 新增协作者、准备生产发布或测试脚本变化 |
| W-003 | EG-005：性能只在已登记 M1 设备上执行 | 保留实际硬件与浏览器版本，不向其他设备泛化阈值结论 | `project-owner` — accepted 2026-08-26 | 对外性能声明、目标设备扩大或结果不稳定 |
| W-004 | EG-004：学习结果只有 owner 3/3 | 只声称 owner 按 golden 解释通过，不声称普遍学习效果 | `project-owner` — accepted 2026-08-26 | 扩大用户或营销/产品学习效果声明 |
| W-005 | EG-006：OS picker 与权限气泡无法全自动化 | 接受 Chrome/Edge owner 人工签字作为当前候选补偿 | `project-owner` — accepted 2026-08-26 | 权限实现、浏览器或 OS 变化 |
| W-006 | R-020：Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在 | 仅依赖 ADR-0005 项目 Flux v1 与 golden；不得表述为 Meyda 已修复 | `project-owner` — accepted 2026-08-26 | Meyda 升级、Flux 公式或 cache/exact cursor 语义变化 |
| W-007 | ENG-007：esbuild 0.27.3 尚有 1 项 low 开发服务器 advisory | dev server 仅绑定可信本地环境，不作为生产服务或暴露到不受信网络 | `project-owner` — accepted 2026-08-26 | 上游兼容修复可用、部署方式变化或需要远程开发访问 |

R-005 的权限跨会话不持久已在架构风险中由 owner 接受；当前 Blob、显式恢复访问和可见三态是产品恢复边界。R-018 的范围漂移风险继续为 Open：Editor 按独立 E1–E6 门禁推进且不继承 Analyzer readiness，Visualizer 与其他未定义 Tab 仍不属于当前批准范围。

## Approval Record and Follow-Up

`project-owner` 于 2026-08-26 明确批准 M11 readiness。2026-08-28 又要求实施 M12，并在实现后明确回复“自行提交并完成后续即可”；该授权在 clean canonical 12/12 通过后用于批准 M12 evidence、关闭 R-028、恢复本结论并继续接受 W-001–W-007。owner 同时说明“可以不上传远程仓库”，因此本轮只创建本地提交，不推送。

历史批准原文：

`我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。`

本批准接受 W-001–W-007 并将本文改为 `approved`。后续继续遵守以下边界：

- 保留 M11 与 M12 canonical、M12 provisional 和首次失败 artifact；仅在候选 commit、artifact identity 或受覆盖行为发生变化时重跑。
- PROD-015 解决前不创建上线声明、不选择或配置生产托管、不发布生产 URL。
- Editor E6 人工补偿与审批继续独立进行；本文不批准 Editor readiness。
- 本 readiness 只覆盖 Analyzer，不代表包含 Editor 的整体产品就绪。
