# Editor 历史证据索引

整理核查日期：2026-10-19。本次只核对和精简既有记录，未重跑历史评估。

E1–E9 已批准；E7/E9 使用 revised canonical，旧 run 保持 pre-revision。E10 曾进入 In Progress，后续标记界面与 DEC-085 已实现；本次整理不虚构 E10 正式关闭或新的 readiness。

Editor readiness 保留 pre-E10 候选和 DEC-055 owner-review 边界；provisional 24/24 与 clean attempt 14/24 分别记录在末节。后续分离/自动标记功能证据见 [FT 接入](../processing/editor-integration-evidence.md)与[自动标记](../processing/editor-auto-marking-evidence.md)。

E1–E5 的专项主要为 Chrome，不推定当时完成 Edge；E6 的原生文件、beforeunload、辅助技术和长会话补偿由 owner 于 2026-08-28 批准。E7、E8、E9 后续视觉批准仅适用于其原候选，未提供的主观数值不补写。整体 [readiness](release-readiness.md)和 PROD-015 独立。

## 记录边界

- 下列结果、环境、保留状态均是原运行时的登记，本次未重新确认本地产物是否仍存在。
- 仅保留 canonical 身份、环境、批准来源和关键媒体 hash；重复步骤/日志清单与已结束调试过程可用 Git 查看整理前的 `ac25c2a:docs/quality/editor/evidence-index.md`。原始 artifact 不改名、不覆盖、不删除。
- summary hash、候选 commit 和 run 必须共同匹配，历史 pass 不证明当前源码、其他设备、整体 readiness 或生产发布。

## 3. E1 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E1-2026-08-26T15-24-21-043Z-792b424f` |
| Milestone | E1 — Entry, playback and project foundation |
| State | `approved`（18/18 自动化及 owner 人工门禁） |
| Implementation commit | `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` |
| Evidence commit | `f6e689dd93d755eccc805b3902359954c4fe18aa` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e1` |
| Reviewer | `project-owner` — approved 2026-08-26 |
| Retention | `local-present`，至少保留到 E1 审批完成 |
| Artifact root | `artifacts/evals/E1-2026-08-26T15-24-21-043Z-792b424f/` |
| Summary SHA-256 | `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary | Google Chrome `152.0.7977.64` |
| Chrome test user agent | Chrome `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制本地 artifact 中的序列号、UUID、UDID 或设备标识。E1 自动化只使用仓库受控 CC0 音频与浏览器 OPFS 临时文件；未读取或登记用户私有音频身份。

- E1–E5 只要求 Chrome 专项；真实 Edge Editor 全量仍按批准计划留到 E6。

- `project-owner` 于 2026-08-26 明确回复：“我批准 Editor E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；同意将 E1 标记为 Complete 并开放 E2。”本签字完成 E1 人工门禁；原生 picker 与离页提示仍属于浏览器无法完全自动化的补偿事实，相关实现变化或 E6 双浏览器加固时需重新复核。

## 4. E2 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` |
| Milestone | E2 — Timeline and tempo |
| State | `approved`（22/22 自动化与 owner 门禁已批准） |
| Implementation commit | `9fc5c0a81fcf90abfbc665412277147cd958200f` |
| Evidence commit | `3c203509fa292b239eb671e2021bee81f23fd9c3` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e2` |
| Reviewer | `project-owner` — approved 2026-08-27 |
| Retention | `local-present`；E2 身份变化时才重跑 |
| Artifact root | `artifacts/evals/E2-2026-08-26T16-42-47-634Z-9fc5c0a8/` |
| Summary SHA-256 | `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary | Google Chrome `152.0.7977.64` |
| Chrome test user agent | Chrome `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E2 使用仓库生成的确定性 PCM/WAV 和浏览器临时状态，不记录用户私有音频身份。

- E2 专项按批准计划只在稳定 Chrome 自动化；真实 Edge 的 Editor 全量、原生 picker、离页提示和辅助技术仍保留到 E6，不能从 Analyzer M11 或本轮 Chrome 结果外推。

- 2026-08-27，owner 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 并开放 E3；不从该原文补写未提供的逐项人工测量值。

## 5. E3 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E3-2026-08-27T02-53-58-176Z-c670ddf5` |
| Milestone | E3 — Point annotation |
| State | `approved`（26/26 自动化与 owner point task 已批准） |
| Implementation commit | `c670ddf5494269f5a56abd20c3c5653ee5b27cef` |
| Evidence commit | `36e0fa4df8acd50df3d36f44419b03f6be42e171` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e3` |
| Reviewer | `project-owner` — approved 2026-08-27 |
| Retention | `local-present`；E3 身份变化时才重跑 |
| Artifact root | `artifacts/evals/E3-2026-08-27T02-53-58-176Z-c670ddf5/` |
| Summary SHA-256 | `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary | Google Chrome `152.0.7977.64` |
| Chrome test user agent | Chrome `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E3 使用仓库生成的确定性 100 BPM WAV、虚构 point/range 工程与浏览器临时状态，不记录用户私有音频身份。

- E3 专项按批准计划只在稳定 Chrome 自动化；真实 Edge、10,000 事件、原生 picker 和辅助技术长会话仍留到 E6，不能从本轮结果外推。

- 2026-08-27，owner 原文“我批准 Editor E3 canonical evidence、point lane、inner class、自适应网格与点标记结果；同意将 E3 标记为 Complete 并开放 E4。”完成 E3 人工门禁；不补写用户未提供的逐项测量。

## 6. E4 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E4-2026-08-27T07-21-59-209Z-c9e03ab9` |
| Milestone | E4 — Analysis overlay |
| State | `approved`（31/31 自动化与 owner 人工门禁已批准） |
| Implementation commit | `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` |
| Evidence commit | `eff24c02b68b3423db04791af912b09726c9601b` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e4` |
| Reviewer | `project-owner` — approved 2026-08-27 |
| Retention | `local-present`；E4 身份变化时才重跑 |
| Artifact root | `artifacts/evals/E4-2026-08-27T07-21-59-209Z-c9e03ab9/` |
| Summary SHA-256 | `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary | Google Chrome `152.0.7977.64` |
| Chrome test user agent | Chrome `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E4 使用仓库生成的确定性 WAV/JSON 工程和浏览器临时状态，不记录用户私有音频身份。

- E4 专项按批准计划只在稳定 Chrome 自动化；真实 Edge、10,000 事件、原生 picker 和辅助技术长会话仍留到 E6，不能从本轮结果外推。

- `project-owner` 于 2026-08-27 明确回复：“我批准 Editor E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果；同意将 E4 标记为 Complete 并开放 E5。”本签字完成 E4 人工门禁，不补写 owner 未提供的逐项测量。

## 7. E5 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E5-2026-08-27T11-03-22-177Z-78124177` |
| Milestone | E5 — Range annotation |
| State | `approved`（35/35 自动化与 owner 人工范围任务均已批准） |
| Implementation commit | `781241772e05186e2fe0d006ed6ddd8bceded7af` |
| Evidence commit | `dd1b43326f6589cab74f9fb75893a2ddf72aa1cf` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e5` |
| Reviewer | `project-owner` — approved 2026-08-27 |
| Retention | `local-present`；至少保留到 E5 审批完成 |
| Artifact root | `artifacts/evals/E5-2026-08-27T11-03-22-177Z-78124177/` |
| Summary SHA-256 | `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary | Google Chrome `152.0.7977.64` |
| Chrome test user agent | Chrome `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E5 只使用仓库生成的确定性 100 BPM WAV、虚构 point/range 工程与浏览器临时状态，不记录用户私有音频身份。

- `project-owner` 已于 2026-08-27 完成人工范围任务并批准 E5；真实 Edge、三格式 native flow、10,000 事件、资源与辅助技术仍由 E6 独立验证。

- R-024、R-025 获得 E5 Chrome range geometry/state/keyboard 证据，R-023 获得 range import/draft 回归；按已批准风险策略，R-024/R-025/R-027 仍保持 `Open`，E6 再执行双浏览器、10,000 事件、资源与辅助技术门禁。

## 8. E6 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E6-2026-08-27T15-52-33-466Z-17d7fe10` |
| Milestone | E6 — Final hardening |
| State | `approved`（40/40 自动化与 owner 人工补偿门禁已批准） |
| Implementation commit | `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` |
| Evidence commit | `45f519085efec7a5a71e094d7aff4fa1eb9020b2` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e6` |
| Reviewer | `project-owner` — approved 2026-08-28 |
| Retention | `local-present`；作为 E6 历史候选保留 |
| Artifact root | `artifacts/evals/E6-2026-08-27T15-52-33-466Z-17d7fe10/` |
| Summary SHA-256 | `8f81b877dc5993bcdd4d04064e85c96156c946f2c62066c2b8571dfbc8473b6e` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.64` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `151.0.4129.107` / Edge `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E6 使用仓库受控音频、运行时生成的 15 分钟 WAV、虚构工程与浏览器临时状态，不读取或登记用户私有音频身份。

- 2026-08-28，`project-owner` 在明确询问批准范围后回复“只批准e6，之后先修改我说的页面修改”，并随后要求实施 E6 关闭与 E7 紧凑工作台计划。本记录据此只登记 E6 原生文件、辅助技术与长会话补偿门禁已获批准，不补写 owner 未提供的逐项数值。

## 9. E7 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E7-2026-08-28T15-02-48-298Z-78bc7f06` |
| Milestone | E7 — Compact workbench layout |
| State | `pre-revision`（44/44 自动化通过，但 2026-08-29 全屏浮层修订后不再是正式候选） |
| Implementation commit | `78bc7f06311a09948e5efae941a14599305b81a5` |
| Evidence commit | `fb22d7d600c7f9bcbb42af0c7eb8bb09e982f7e3` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e7` |
| Reviewer | 不适用；修订前历史记录 |
| Retention | `local-present`；至少保留到 E7 审批完成 |
| Artifact root | `artifacts/evals/E7-2026-08-28T15-02-48-298Z-78bc7f06/` |
| Summary SHA-256 | `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.64` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `151.0.4129.107` / Edge `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E7 使用仓库受控 fixture、运行时压力工程与浏览器临时状态，不读取或登记用户私有音频身份。

2026-08-29，owner 在审批前要求把 overlay 改为全视口 fixed 灰色层、窗口级复合入口及按歌曲本地 visibility。该变化影响挂载、geometry、analysis active set 与持久化边界，因此本 44/44 run 保留为 `pre-revision`，不删除、不冒充修订版 evidence。修订版候选随后在新实现 commit 上执行 46 步 clean canonical，身份见第 10 节。

- 紧凑度、视觉层级、长会话可读性和真实辅助技术操作体感仍需 owner 在 Chrome 与 Edge 人工判断；自动化不能替代该视觉签字。

## 10. Revised E7 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E7-2026-08-29T05-23-03-986Z-080f577f` |
| Milestone | E7 — Compact workbench + fullscreen overlay revision |
| State | `approved`（46/46 自动化与既有人工补偿由 owner 接受） |
| Implementation commit | `080f577fe20fcb22a20184dce0b15892c5299464` |
| Evidence commit | `e62140ee12dd44cfbb1e1468df90be2c588a59d8` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e7` |
| Reviewer | `project-owner` — approved 2026-08-31 |
| Retention | `local-present`；作为 E7 正式 canonical 保留 |
| Artifact root | `artifacts/evals/E7-2026-08-29T05-23-03-986Z-080f577f/` |
| Summary SHA-256 | `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.64` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `151.0.4129.107` / Edge `151.0.7922.34` |
| Meyda | `5.6.3` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。修订版 E7 使用仓库受控 fixture、运行时压力工程与浏览器临时状态，不读取或登记用户私有音频身份。

- 2026-08-31，owner 在明确要求先关闭 E7 再实施 M13 的计划上回复“PLEASE IMPLEMENT THIS PLAN”，接受本记录已有的 46/46、artifact 与人工补偿并关闭 E7；该批准不补写 owner 未提供的逐项人工数值。

## 11. E8 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E8-2026-09-03T04-07-28-904Z-84d9435c` |
| Milestone | E8 — Timeline, recovery and marker usability |
| State | `approved`（25/25 自动化与 owner 人工门禁均通过） |
| Implementation commit | `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` |
| Evidence commit | `0df0fc4ad403e9fab71601b23d6307c0fbb1a414` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e8` |
| Reviewer | `project-owner` — approved 2026-09-03 |
| Retention | `local-present`；至少保留到 E8 审批完成 |
| Artifact root | `artifacts/evals/E8-2026-09-03T04-07-28-904Z-84d9435c/` |
| Summary SHA-256 | `ba9ff8db30868c8bf34140a3db2bf8cd7e3d56557ca7ac8682dfa6c3ce664a42` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.66` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `152.0.4191.53` / Edge `151.0.7922.34` |

本记录只保存机型、芯片、核心数和内存，不复制 artifact 中的序列号、UUID、UDID 或设备标识。E8 使用仓库受控 WAV/MP3、虚构工程与浏览器临时状态，不读取或登记用户私有音频身份。

- 2026-09-03，owner 要求评估 E8 是否可关闭并授权在满足时批准。审计确认 clean identity、25/25 结果、artifact hash、四视口密度、paused 恢复、显式异歌切换与 marker 几何均满足已批准门禁；owner 据此批准 canonical 与上述人工边界，不补写未提供的额外主观数值。

- E8 为 `Complete`，R-022/R-024/R-025 为 `Mitigated`。Editor 整体 readiness 仍需独立 review，本批准不自动推定 readiness。

## 12. E9 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E9-2026-09-04T02-49-18-960Z-cf0a79b1` |
| Milestone | E9 — Tempo lane and marker interaction |
| State | `pre-revision`（29/29 自动化通过；DEC-052 紧凑条修订后不再是正式候选） |
| Implementation commit | `cf0a79b176d99eb183368818ce90ac5731d1cfa8` |
| Evidence commit | `c19ec16ac0564ff293a880f9bda8aedae275845c` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e9` |
| Reviewer | `project-owner` — requested revision 2026-09-04 |
| Retention | `local-present`；至少保留到 E9 审批完成 |
| Artifact root | `artifacts/evals/E9-2026-09-04T02-49-18-960Z-cf0a79b1/` |
| Summary SHA-256 | `d4c15f6801e6df4289dad97b816036a095a21e5781a314f1f3166ab663f3ca4a` |

### Environment

| Item | Recorded value |
| --- | --- |
| Platform / architecture | Darwin / arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.76` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `152.0.4191.62` / Edge `151.0.7922.34` |

E9 使用仓库受控 WAV、版本化虚构 tempo golden 与浏览器临时状态；本记录不包含用户私有音频、设备序列号或其他敏感标识。

- 本记录继续为 `pre-revision`，且 artifact/identity 不改写。第 13 节 revised canonical 已获 owner 批准，E9 为 `Complete`、R-042 为 `Mitigated`，Editor release-readiness 已开放。

## 13. Revised E9 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E9-2026-09-04T03-51-33-088Z-13614673` |
| Milestone | E9 — Compact BPM strip revision |
| State | `approved`（29/29 自动化与 owner 人工门禁均通过） |
| Implementation commit | `13614673bbf4d824f2ee109d36e04de6b3f8aabd` |
| Evidence commit | `299502d91de4845803ae6f68eb3a44ee09cf6137` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:e9` |
| Reviewer | `project-owner` — approved 2026-09-04 |
| Retention | `local-present`；纳入 Editor release-readiness 证据链 |
| Artifact root | `artifacts/evals/E9-2026-09-04T03-51-33-088Z-13614673/` |
| Summary SHA-256 | `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c` |

### Environment

| Item | Recorded value |
| --- | --- |
| Platform / architecture | Darwin / arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest / Playwright | `4.1.10` / `1.62.0` |
| Chrome binary / test user agent | Google Chrome `152.0.7977.76` / Chrome `151.0.7922.34` |
| Edge binary / test user agent | Microsoft Edge `152.0.4191.62` / Edge `151.0.7922.34` |

本 run 只使用仓库受控 WAV、版本化虚构 tempo golden 和浏览器临时状态；不包含用户私有音频或设备标识。

- `project-owner` 于 2026-09-04 批准已有修改，并通过完整关闭计划确认：BPM 条融入波形、caret/guide 方向、11px 无框输入、重复左标签移除、共享滚动、full/summary/hidden、前段延伸删除、分类按钮、candidate 和单 divider 人工门禁通过；不补写未提供的主观数值。

## 14. Editor Release-readiness Audit Record

### Candidate and Harness

| Field | Value |
| --- | --- |
| Runtime candidate | `13614673bbf4d824f2ee109d36e04de6b3f8aabd` |
| Runtime source tree | `c1a362221ea040d2679cef9ca4b3af27309b1879` |
| E9 closure | DEC-053；evidence `299502d`；29/29 approved |
| Readiness contract | DEC-054；status `in-review` |
| Audit Harness | `788be6bb8018ce6bbe4274fd5138b6d55d4cb158` |
| Browser review mode | DEC-055；owner 自行审阅，不再由 agent 申请沙箱外端口/浏览器 |

### Provisional Feedback

| Field | Value |
| --- | --- |
| Run ID | `EDITOR-RR-2026-09-04T07-28-02-425Z-41afe431-provisional` |
| Result | 24/24 pass；dirty-worktree feedback，不是 clean canonical |
| Start/end commit | `41afe4314f3cd4fbd4c5430b01b225732381a302` / same |
| Dirty start/end | true / true |
| Chrome / Edge | `152.0.7977.76` / `152.0.4191.62` |
| Source identity | candidate/current tree 均为 `c1a362221ea040d2679cef9ca4b3af27309b1879`；pass |
| Summary SHA-256 | `8963fb95b8dd5b168ce0f9da03ea04d8a0e922e9c4ebf2e6ca2637fe1a99bed4` |

该 run 在相同 runtime source tree 上覆盖 E4–E9：E4/E5 最大反馈约 `2.3ms`/`34.1ms`；E6 双浏览器 900 秒、10,000 事件最大反馈约 `11.4ms`/`9.8ms`，归因长任务为 0、geometry 为 0；E8/E9 最大边界误差 `0.009375 CSS px`；E6 20 次和 E9 10 次生命周期资源回到既定基线；页面专项无异常 console/pageerror。由于 Harness/package/docs 尚未提交，该 run 不升级为正式 evidence。

### Clean Environment-blocked Attempt

| Field | Value |
| --- | --- |
| Run ID | `EDITOR-RR-2026-09-04T07-40-29-751Z-788be6bb` |
| Result | fail；14/24 pass，10 个 browser steps 未启动 |
| Start/end commit | `788be6bb8018ce6bbe4274fd5138b6d55d4cb158` / same |
| Dirty start/end | false / false |
| Source identity | candidate/current tree 均为 `c1a362221ea040d2679cef9ca4b3af27309b1879`；pass |
| Environment failure | 所有 Chrome/Edge 步骤均为 `listen EPERM: operation not permitted 127.0.0.1:4173` |
| Summary SHA-256 | `d0221d5b35ddf499fa5895eb567db202321fb3bfdd4a85818c0bdc6651d4096d` |

通过的 14 步为 E4/E5 golden/unit/integration、E6 unit/integration，以及 docs、Harness、typecheck、build、diff check、runtime source identity。10 个浏览器步骤没有运行产品断言，因此不能记为 pass，也不据此重开 E4–E9；失败 artifact 原样保留。

### Review Boundary

`project-owner` 指示跳过沙箱外监听和 Chrome/Edge 重跑，把相关未验证项改为自行审阅。readiness 因此保持 `in-review`，不形成 clean 24/24 canonical 声明。Owner 后续需自行审阅 browser evidence gap、W-ED-001–W-ED-006 及整体 `Ready with waivers` 结论；PROD-015 和独立 Visualizer readiness 继续阻断整体 release planning。
