# Editor 历史 Readiness 与待审边界

整理核查日期：2026-10-19。原E9候选在DEC-057后为pre-E10/in-review；原Ready with waivers仅是提案，W-ED-001–006及整体结论尚未获owner批准。后续功能修改不受旧source freeze阻挡，也不继承原候选身份。

## Candidate Identity

| Field | Fixed value |
| --- | --- |
| Runtime candidate | `pre-E10`：E9 implementation commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd`，仅作历史候选 |
| E9 evidence | evidence registration `299502d`；run `E9-2026-09-04T03-51-33-088Z-13614673`；29/29；summary SHA-256 `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c` |
| Milestone closure | DEC-053；closure commit `4fb0fb4ae49434080b1633b3ccc1129123d4252d` |
| Superseding change | 已发生的E10、后续标记/处理改版；旧候选不再代表当前src |
| New candidate gate | 显式正式评审任务另行固定当前实现候选与适用范围 |
| Audit Harness | commit `788be6bb8018ce6bbe4274fd5138b6d55d4cb158` |

## 两次审计事实

- dirty provisional EDITOR-RR-2026-09-04T07-28-02-425Z-41afe431为24/24 pass，summary SHA-256 8963fb95b8dd5b168ce0f9da03ea04d8a0e922e9c4ebf2e6ca2637fe1a99bed4；不是clean canonical。
- clean attempt EDITOR-RR-2026-09-04T07-40-29-751Z-788be6bb为fail，14/24 pass、10个浏览器步骤因listen EPERM 127.0.0.1:4173未启动，summary SHA-256 d0221d5b35ddf499fa5895eb567db202321fb3bfdd4a85818c0bdc6651d4096d；不能记为pass，也不是产品断言失败。
- 两次runtime source tree均为c1a362221ea040d2679cef9ca4b3af27309b1879；完整环境、身份、测量及历史E1–E9批准见[evidence](evidence-index.md)。

DEC-055由owner指示跳过该旧评审的沙箱外端口/Chrome/Edge重跑，改由owner自行审阅browser evidence gap。DEC-075另行授权新增模型/试听和必要回归，不把该授权扩展为旧评审重跑。

## 待批准豁免

下表保留旧提案/数值，不表示已接受或当前依赖审计。

| Waiver | Residual issue | Required handling | Approver / state | Reopen trigger |
| --- | --- | --- | --- | --- |
| W-ED-001 | 当前最大 JS chunk 约 `1.43 MB`，尚无正式包体预算 | 如实保留 build warning；进入生产计划前制定预算或接受性能影响 | project-owner / pending | chunk 增长、首屏问题、托管或预算确定 |
| W-ED-002 | canonical 与 readiness 仅为本地流程，没有 CI | 保留 clean identity、artifact 与 hash；不得描述为持续集成保护 | project-owner / pending | 引入 CI、多人合入或本地证据不可复现 |
| W-ED-003 | 性能证据只覆盖已登记硬件 | 登记硬件、浏览器和阈值；不外推到未测设备 | project-owner / pending | 支持矩阵、浏览器或目标硬件改变 |
| W-ED-004 | 原生 picker、`beforeunload` 与辅助技术存在浏览器自动化边界 | 延续 E6 已批准的人工补偿；相关实现或浏览器改变时重测 | project-owner / pending | 原生流程、浏览器权限或无障碍实现改变 |
| W-ED-005 | Meyda `spectralFlux` 上游缺陷仍存在 | 继续使用 ADR-0005 项目 Flux；不得声称上游已修复 | project-owner / pending | Meyda 升级、项目 Flux 改动或结果偏差 |
| W-ED-006 | esbuild low advisory 仅在可信本地开发环境可接受 | dev server 不暴露到不受信网络；兼容修复可用后升级复核 | project-owner / pending | dev server 暴露、风险升级或兼容补丁发布 |

## 后续规则

当前Editor功能与阈值见[页面契约](../../architecture/editor/interface-contracts.md)和[验证](validation.md)。如果明确要求正式readiness，需新的当前候选、适用自动化与真实人工输入；不补写未提供的picker/beforeunload/辅助技术/主观数值。owner明确接受缺口与整体结论前保持in-review。Visualizer评审独立，PROD-015继续阻断部署。
