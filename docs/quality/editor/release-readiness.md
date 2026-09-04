---
status: in-review
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/context/decision-registry.md"
  - "docs/product/scope.md"
  - "docs/product/open-questions.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/risk-register.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/evidence-index.md"
  - "docs/quality/editor/e9-eval-plan.md"
next_action: "由 owner 自行审阅未在 clean HEAD 重跑的双浏览器项，并决定是否接受 W-ED-001–W-ED-006 与 Ready with waivers 结论"
---

# Editor Release Readiness

## 1. Proposed Decision

- Candidate conclusion：`Ready with waivers`，当前仅为待审提案。
- Review state：`owner-review`（frontmatter 继续为 `in-review`）；按 DEC-055 不再由 agent 申请沙箱外浏览器重跑，未在 clean HEAD 验证的项目交由 owner 自行审阅。
- Decision boundary：本文件只评价 Editor E1–E9 候选是否可进入后续 release planning，不批准生产部署。
- Production boundary：PROD-015 继续阻断正式上线；Visualizer readiness 独立保持 `in-review`，不能由本结论替代。

## 2. Candidate Identity and Freeze

| Field | Fixed value |
| --- | --- |
| Runtime candidate | E9 implementation commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` |
| E9 evidence | evidence registration `299502d`；run `E9-2026-09-04T03-51-33-088Z-13614673`；29/29；summary SHA-256 `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c` |
| Milestone closure | DEC-053；closure commit `4fb0fb4ae49434080b1633b3ccc1129123d4252d` |
| Allowed post-candidate changes | 文档、测试 Harness、readiness runner 与本地 artifact；不得修改产品 `src/` |
| Drift gate | `git diff --quiet 13614673bbf4d824f2ee109d36e04de6b3f8aabd..HEAD -- src` 必须为 exit 0 |
| Audit Harness | commit `788be6bb8018ce6bbe4274fd5138b6d55d4cb158` |

任何 `src/` 漂移都会使本候选身份失效并阻断审计。产品修复必须回到对应 Editor 里程碑/风险，形成新的 implementation commit 与 clean evidence；不得把测试或文档提交伪装成运行时候选。

## 3. Review Scope

### Included

- Editor E1–E9 已批准的 route/playback lease、JSON V1、草稿与原子导入、共享时间轴、tempo、point/range、21 项 overlay、紧凑工作台、恢复、marker 与 BPM 标记条。
- 本地 MP3、WAV、FLAC；约 15 分钟受控场景；10,000 事件；最新可用桌面 Chrome 与 Edge。
- 成功、失败、边界、stale/cancel、资源生命周期、键盘/焦点、reduced motion、console/pageerror 与构建/文档/Harness 完整性。

### Excluded

- Analyzer 或 Visualizer 的整体 readiness 结论。
- 上传、云端媒体、移动端产品支持、Firefox、生产托管、部署、监控与回滚。
- 新产品功能、公共 TypeScript API、JSON/IndexedDB schema、AudioEngine、Worker、Overlay 或路由变更。

## 4. Targeted Audit Contract

`eval:editor-readiness` 固定为 24 步；clean 模式拒绝 dirty worktree，并生成 `EDITOR-RR-<timestamp>-<commit>` 本地 artifact。provisional 允许 dirty worktree但不得冒充正式 clean evidence。DEC-055 后 runner 保留供 owner 或未来获准环境使用，本轮 agent 不再申请沙箱外监听端口或启动 Chrome/Edge。

| Steps | Coverage | Required result |
| --- | --- | --- |
| 1–4 | E4 golden、unit、integration、Chrome | overlay 21 项、geometry、pointer-through、错误隔离通过 |
| 5–8 | E5 golden、unit、integration、Chrome | range 状态机、半开重叠、键盘、持久化通过 |
| 9–12 | E6 unit、integration、Chrome、Edge | MP3/WAV/FLAC、10,000 事件、性能、资源、辅助能力回归通过 |
| 13–18 | E7、E8、E9 Chrome/Edge | 紧凑工作台、恢复、marker、BPM 条与交互双浏览器通过 |
| 19–24 | docs、Harness、typecheck、build、diff check、`src/` identity | 六项全部通过；候选 source tree 与 E9 implementation 一致 |

适用门禁继续为：用户设置和 transport 反馈 `<=100ms`；共享时间几何误差 `<=1 CSS px`；分析归因任务不超过 50ms；route/lifecycle 后 live 资源回到对应基线；页面异常 console 与 `pageerror` 为 0。构建 warning 必须如实登记，不能改记为通过优化。

Runner 必须记录起止 commit 与 dirty 状态、固定运行时候选、source tree identity、Node/npm/Vitest/Playwright、Chrome/Edge、OS/architecture、几何/性能/资源指标、每步日志 hash 与 summary SHA-256。任何步骤失败，summary 必须为 fail 且 artifact 保留。

## 5. Current Audit Evidence

| Field | Provisional feedback | Clean attempt |
| --- | --- | --- |
| Run | `EDITOR-RR-2026-09-04T07-28-02-425Z-41afe431-provisional` | `EDITOR-RR-2026-09-04T07-40-29-751Z-788be6bb` |
| Result | 24/24 pass；仅作 dirty-worktree 实现反馈 | 14/24 pass，10 个浏览器步骤因 `listen EPERM 127.0.0.1:4173` 未启动；summary 为 fail |
| Commit identity | 起止 `41afe4314f3cd4fbd4c5430b01b225732381a302`；dirty true/true | 起止 `788be6bb8018ce6bbe4274fd5138b6d55d4cb158`；dirty false/false |
| Runtime source | candidate/source tree `13614673…` / `c1a362221ea040d2679cef9ca4b3af27309b1879`，identity pass | 同一 candidate/source tree，identity pass |
| Browser environment | Chrome `152.0.7977.76`；Edge `152.0.4191.62` | 版本已记录，但浏览器测试未启动 |
| Summary SHA-256 | `8963fb95b8dd5b168ce0f9da03ea04d8a0e922e9c4ebf2e6ca2637fe1a99bed4` | `d0221d5b35ddf499fa5895eb567db202321fb3bfdd4a85818c0bdc6651d4096d` |

provisional 的 24/24 在相同 runtime source tree 上给出以下非正式反馈：E4/E5 最大反馈分别约 `2.3ms`/`34.1ms`；E6 双浏览器 900 秒、10,000 事件最大反馈分别约 `11.4ms`/`9.8ms`，归因长任务为 0、geometry 为 0；E8/E9 最大边界误差 `0.009375 CSS px`；E6 20 次和 E9 10 次生命周期资源回到既定 route 基线；页面专项无异常 console/pageerror。它不能替代 clean browser evidence。

clean attempt 的 E4/E5 golden/unit/integration、E6 unit/integration、docs、Harness、typecheck、build、diff check 和 source identity 共 14 步通过。10 个 Chrome/Edge 步骤均由同一沙箱端口权限限制阻断，不是产品断言失败；artifact 和 fail 结果保留，不改写为 unavailable 或 pass。

### Owner-directed Review Gap

`project-owner` 于 2026-09-04 指示跳过沙箱外监听端口和 Chrome/Edge 自动化重跑，并把相关未验证项改为自行审阅。因此本轮不再追求 clean 24/24，也不生成虚假的 canonical pass。Owner 后续自行确认 E4–E9 的 Chrome/Edge 交互、三格式/10,000 事件、几何、资源、键盘/焦点和 console/pageerror，并与 W-ED-001–W-ED-006 一并作 readiness 决策。

## 6. Approved Milestone Evidence Baseline

E1–E9 当前 canonical 和 owner evidence 均为 `approved`；其中 E7 旧 44/44 与 E9 首个 29/29 artifact 保持 `pre-revision`，只使用各自修订后的 canonical 作为当前基线。完整 run、commit、environment、hash 与人工边界见 [Editor evidence index](evidence-index.md)。readiness 审计是针对当前候选的重新抽样，不改写任何历史 canonical。

## 7. Proposed Waivers

| Waiver | Residual issue | Required handling | Approver / state | Reopen trigger |
| --- | --- | --- | --- | --- |
| W-ED-001 | 当前最大 JS chunk 约 `1.43 MB`，尚无正式包体预算 | 如实保留 build warning；进入生产计划前制定预算或接受性能影响 | project-owner / pending | chunk 增长、首屏问题、托管或预算确定 |
| W-ED-002 | canonical 与 readiness 仅为本地流程，没有 CI | 保留 clean identity、artifact 与 hash；不得描述为持续集成保护 | project-owner / pending | 引入 CI、多人合入或本地证据不可复现 |
| W-ED-003 | 性能证据只覆盖已登记硬件 | 登记硬件、浏览器和阈值；不外推到未测设备 | project-owner / pending | 支持矩阵、浏览器或目标硬件改变 |
| W-ED-004 | 原生 picker、`beforeunload` 与辅助技术存在浏览器自动化边界 | 延续 E6 已批准的人工补偿；相关实现或浏览器改变时重测 | project-owner / pending | 原生流程、浏览器权限或无障碍实现改变 |
| W-ED-005 | Meyda `spectralFlux` 上游缺陷仍存在 | 继续使用 ADR-0005 项目 Flux；不得声称上游已修复 | project-owner / pending | Meyda 升级、项目 Flux 改动或结果偏差 |
| W-ED-006 | esbuild low advisory 仅在可信本地开发环境可接受 | dev server 不暴露到不受信网络；兼容修复可用后升级复核 | project-owner / pending | dev server 暴露、风险升级或兼容补丁发布 |

## 8. Blockers and Failure Handling

- PROD-015 未决定静态托管平台、域名、HTTPS/生产 URL 和 SPA fallback；解决前不创建上线声明或生产 release plan。
- Visualizer release-readiness 继续是独立文件、独立 owner 结论；Editor 通过不能关闭其修订项。
- 产品缺陷：阻断 readiness，重开对应风险/里程碑并形成新候选；历史 canonical 不改写。
- 测试/Harness 缺陷：保留失败 artifact，修复测试后在新 clean commit 从头重跑 24 步。
- evidence identity、浏览器或 fixture 缺失：明确标记 blocked/evidence gap，不以缩小范围或替代浏览器伪造通过。
- 本轮端口/浏览器 evidence gap 已由 DEC-055 改为 owner 自行审阅；在 owner 明确结论前，本文保持 `in-review`。

## 9. Approval Boundary

本文继续保持 `in-review`。只有 `project-owner` 自行审阅 browser evidence gap，并明确接受整体 `Ready with waivers` 结论以及 W-ED-001–W-ED-006，才可把 frontmatter 改为 `approved` 并登记最终结论。该批准仍不解决 PROD-015、不授权部署，也不创建 `docs/release/`。
