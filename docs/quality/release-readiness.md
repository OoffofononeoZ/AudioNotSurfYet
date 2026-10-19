# Analyzer 历史 Release Readiness

整理核查日期：2026-10-19；批准/评审日期仍为2026-09-01。原M14候选结论为Ready with waivers，reviewer为project-owner；只覆盖下列候选和历史Analyzer范围。当前单列/FIFO/Wallpaper改版不继承此结论。

## Candidate Identity

| Field | Value |
| --- | --- |
| Candidate implementation commit | `0e991307d9045a1ec84ddaae0515612240894a92` |
| Canonical evidence registration commit | `5a272f2`（原登记提交） |
| Canonical run | `M14-2026-09-01T02-36-49-995Z-0e991307`；19/19；clean start/end |
| Summary SHA-256 | `b169d6ff082746fc3cbe5ac6064151233c4f2869cba6e41f9dcdd7d052916fcc` |
| Chrome M14 log SHA-256 | `6790bac929147e64ca79e3e2f8d3ce3c8c8ae323465a41676015270f66ba1ab5` |
| Edge M14 log SHA-256 | `953906d828951ddcb73e87c0a2f8b7820834d5f4153fc2c010099d800e3c4bcd` |
| Build log SHA-256 | `c9993890c9974f95ff2515cd7acd868f5d8a028a4ccbf58da184f40a7721577d` |
| Diff-check log SHA-256 | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Artifact retention | `local-present` at `artifacts/evals/M14-2026-09-01T02-36-49-995Z-0e991307/` |

历史local-present是当时登记，本次未复核磁盘。

## Recorded Environment

| Item | Value |
| --- | --- |
| OS / hardware | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.65` |
| Edge | Microsoft Edge `152.0.4191.53` |

## 已批准豁免

以下W-001–W-007最初由owner于2026-08-26接受，随M14于2026-09-01复核；依赖/包体数值均是历史候选值，不作为当前审计。

| ID | Risk or evidence gap | Proposed condition | Approver | Expiration or revisit trigger |
| --- | --- | --- | --- | --- |
| W-001 | R-019：最大 JS chunk 1,300.63 kB，尚无正式包体预算 | 接受当前候选 warning；不表述为包体优化完成 | `project-owner` — re-accepted for M14 2026-09-01 | 托管方案或预算确定、chunk 增长、首屏问题复现 |
| W-002 | ENG-002：canonical 是本地流程，没有正式 CI | 只引用绑定 commit 的 clean local artifact；不宣称持续集成保障 | `project-owner` — re-accepted for M14 2026-09-01 | 新增协作者、准备生产发布或测试脚本变化 |
| W-003 | EG-005：性能只在已登记 M1 设备上执行 | 保留实际硬件与浏览器版本，不向其他设备泛化阈值结论 | `project-owner` — accepted 2026-08-26 | 对外性能声明、目标设备扩大或结果不稳定 |
| W-004 | EG-004：学习结果只有 owner 3/3 | 只声称 owner 按 golden 解释通过，不声称普遍学习效果 | `project-owner` — accepted 2026-08-26 | 扩大用户或营销/产品学习效果声明 |
| W-005 | EG-006：OS picker 与权限气泡无法全自动化 | 接受 Chrome/Edge owner 人工签字作为当前候选补偿 | `project-owner` — accepted 2026-08-26 | 权限实现、浏览器或 OS 变化 |
| W-006 | R-020：Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在 | 仅依赖 ADR-0005 项目 Flux v1 与 golden；不得表述为 Meyda 已修复 | `project-owner` — accepted 2026-08-26 | Meyda 升级、Flux 公式或 cache/exact cursor 语义变化 |
| W-007 | ENG-007：esbuild 0.27.3 尚有 1 项 low 开发服务器 advisory | dev server 仅绑定可信本地环境，不作为生产服务或暴露到不受信网络 | `project-owner` — accepted 2026-08-26 | 上游兼容修复可用、部署方式变化或需要远程开发访问 |

## 批准与限制

owner于2026-08-26批准Analyzer有条件就绪并开放Editor E0；后续授权在适用canonical通过后完成M12–M14证据/readiness，M14原结果19/19及人工边界仍见[evidence](evidence-index.md)。

本结论只允许原候选进入release planning，不包含Editor/Visualizer、上传、移动端、非Chromium或生产托管。PROD-015（托管、域名、HTTPS生产URL、SPA fallback）仍阻断上线；候选行为/资产身份改变须按[当前验证](validation.md)另行核查，不能以本页证明当前readiness或部署批准。
