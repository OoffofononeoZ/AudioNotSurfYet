---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/scope.md"
  - "docs/product/success-metrics.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
  - "docs/quality/failure-taxonomy.md"
  - "docs/quality/evidence-index.md"
next_action: "project-owner 审阅候选身份、拟议豁免与生产部署边界"
---

# Analyzer Release Readiness

## Summary Decision

- Status：`Ready with waivers`（proposed；等待 owner 单独批准）。
- Decision date：2026-08-26（review draft）。
- Reviewer：`project-owner` — waiver approval pending。
- Scope：只覆盖当前本地音频 Analyzer 候选；不覆盖 Editor、Visualizer、远端上传、移动端、非 Chromium 或生产托管。
- Decision boundary：**Analyzer candidate is ready for release planning with waivers; this is not production launch authorization.**

M11 canonical、Edge 原生权限与最终加固已获 owner 批准，因此当前批准范围内没有产品代码 ship blocker。PROD-015 的托管平台、域名和 SPA fallback 尚未决定，正式上线仍被阻断；本文获批也只开放后续阶段选择，不表示应用已经发布。

## Candidate Identity

| Field | Value |
| --- | --- |
| Candidate implementation commit | `99c67792509d07456bcb431b90468252f8b0fdc3` |
| Canonical evidence registration commit | `2c491d020160dce80720339d565ba7a51cb3cb4d` |
| M11 approval ledger commit | `79e395062c7a4066d0af65574f6d7fce48e04915` |
| Canonical run | `M11-2026-08-25T10-05-12-783Z-99c67792`；38/38；clean start/end |
| Summary SHA-256 | `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5` |
| Chrome hardening log SHA-256 | `4ba4a69aec7fa54559767da6a1f98628a5cb6929e364071dec1a54969e8cf0f7` |
| Edge matrix log SHA-256 | `6cc96b1853f2c17ca34ed9184f616e709b38082604dd293b613e5dca4fbcfb36` |
| Build log SHA-256 | `cd1972dc509ede0f29a8633e4f18504732483175d51ee7cf712f69a15b39ade4` |
| Diff-check log SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Artifact retention | `local-present` at `artifacts/evals/M11-2026-08-25T10-05-12-783Z-99c67792/` |

### Recorded Environment

| Item | Value |
| --- | --- |
| OS / hardware | macOS 26.5.2 (`25F84`), Darwin arm64；MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Chrome | Google Chrome `151.0.7922.174`；runtime UA `Chrome/151.0.7922.34` |
| Edge | Microsoft Edge `151.0.4129.107`；runtime UA `Edg/151.0.7922.34` |
| Meyda / FFmpeg | Meyda `5.6.3`；FFmpeg `8.1.2` |

环境记录不包含序列号、UUID、UDID 或用户音频身份。性能和兼容性结论只适用于已记录候选、浏览器与硬件边界。

## Evidence Summary

- 21/21 Analyzer 特征已由 registry、Worker、cache、golden、exact cursor、六类 renderer 和最多四张唯一卡的浏览器路径覆盖。
- 同源 WAV、MP3、FLAC 已在真实 Chrome/Edge 中完成加载、切换、分析和刷新恢复；Edge 全量 M3–M11 为 31/31，Chrome M11 专项为 4/4。
- Chrome/Edge 60 秒漂移为 3.5ms/4.133ms，seek 最大误差为 66.827ms/61.494ms，均满足 ≤100ms。
- 15 分钟四重卡最大输入反馈为 17.9ms/17.2ms，分析归因超过 50ms 的主线程 long task 均为 0。
- 两端 20 次分析/播放循环保持单 Worker/AudioContext；20 次 Home/Analyzer 路由循环均为 WebGL 21 created/20 lost、最终 1 个有效 context 和 2 live RAF。
- `project-owner` 于 2026-08-26 批准 M11 canonical evidence、Edge 原生权限与最终加固结果。人工补偿没有独立 artifact，本文不把原生 picker、辅助技术或人工长会话表述为自动化覆盖。

## Coverage Summary

| Coverage type | Evidence | Gaps or proposed waivers |
| --- | --- | --- |
| Success paths | 三格式双浏览器；播放/队列/恢复；21/21 分析、cache hit、exact cursor；四卡与共享视口；owner 学习任务 | 学习结果只证明 owner 3/3，不泛化到广泛用户 |
| Failure paths | decode/metadata、Worker extract、quota/transaction、permission denied、cache corruption、unknown schema、renderer failure 均验证受影响边界与未受影响能力 | 原生权限提示只能人工补偿，不能全自动化 |
| Boundary paths | 0/1/4 卡、重复与未知特征、silence、尾帧、15 分钟、390/1024/1280/1920、DPR、reduced motion | 超出约 15 分钟只作 best-effort 观察，不属于支持承诺 |
| Exception paths | stale/cancel、快速换歌、文件移动/内容变化、not-persisted、Canvas/WebGL/route dispose、辅助技术人工检查 | 没有正式 CI、axe 扫描或跨硬件基线 |

## Blockers

- Analyzer 候选代码 blocker：无，前提是下列 waivers 由 `project-owner` 明确接受。
- 生产上线 blocker：PROD-015 尚未确定静态托管平台、域名、HTTPS/生产 URL 和 SPA fallback。该项解决前不得创建“已上线”声明，也不得把本结论当作部署授权。
- Editor blocker：Editor 仍在当前批准范围之外；readiness 获批后只能先进入 E0 产品意图，不得直接编码。

## Proposed Waivers

| ID | Risk or evidence gap | Proposed condition | Approver | Expiration or revisit trigger |
| --- | --- | --- | --- | --- |
| W-001 | R-019：最大 JS chunk 1,117.94 kB，尚无正式包体预算 | 接受当前候选 warning；不表述为包体优化完成 | `project-owner` — pending | 托管方案或预算确定、chunk 增长、首屏问题复现 |
| W-002 | ENG-002：canonical 是本地流程，没有正式 CI | 只引用绑定 commit 的 clean local artifact；不宣称持续集成保障 | `project-owner` — pending | 新增协作者、准备生产发布或测试脚本变化 |
| W-003 | EG-005：性能只在已登记 M1 设备上执行 | 保留实际硬件与浏览器版本，不向其他设备泛化阈值结论 | `project-owner` — pending | 对外性能声明、目标设备扩大或结果不稳定 |
| W-004 | EG-004：学习结果只有 owner 3/3 | 只声称 owner 按 golden 解释通过，不声称普遍学习效果 | `project-owner` — pending | 扩大用户或营销/产品学习效果声明 |
| W-005 | EG-006：OS picker 与权限气泡无法全自动化 | 接受 Chrome/Edge owner 人工签字作为当前候选补偿 | `project-owner` — pending | 权限实现、浏览器或 OS 变化 |
| W-006 | R-020：Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在 | 仅依赖 ADR-0005 项目 Flux v1 与 golden；不得表述为 Meyda 已修复 | `project-owner` — pending | Meyda 升级、Flux 公式或 cache/exact cursor 语义变化 |
| W-007 | ENG-007：esbuild 0.27.3 尚有 1 项 low 开发服务器 advisory | dev server 仅绑定可信本地环境，不作为生产服务或暴露到不受信网络 | `project-owner` — pending | 上游兼容修复可用、部署方式变化或需要远程开发访问 |

R-005 的权限跨会话不持久已在架构风险中由 owner 接受；当前 Blob、显式恢复访问和可见三态是产品恢复边界。R-018 的未来 Tab/Editor 范围漂移继续为 Open，它不属于当前 Analyzer 候选功能。

## Approval Gate and Follow-Up

Readiness 只有在 owner 审阅候选身份、blocker 与 W-001–W-007 后才能改为 `approved`。批准前：

- 保留 M11 canonical artifact，不重新运行 canonical，除非候选 commit、artifact identity 或受覆盖行为发生变化；
- 不创建 `docs/release/`，不选择或配置托管，不发布生产 URL；
- 不开始 Editor 代码或安装新依赖。

建议批准原文：

`我批准 Analyzer release-readiness 的有条件就绪结论及所列豁免；同意进入 Editor E0，Analyzer 正式上线继续等待托管方案。`

获批后，本文改为 `approved`，W-001–W-007 记录批准人和日期；随后优先进入 Editor E0 产品意图。该范围变化后，本 readiness 继续作为 Analyzer-only 历史候选记录，不代表包含 Editor 的整体产品就绪。
