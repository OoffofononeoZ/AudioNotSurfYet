---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/quality/editor/golden-examples.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/quality/editor/e3-eval-plan.md"
  - "docs/quality/editor/e4-eval-plan.md"
  - "docs/quality/editor/e5-eval-plan.md"
  - "docs/quality/editor/e6-eval-plan.md"
  - "docs/quality/editor/e7-eval-plan.md"
  - "docs/quality/editor/e8-eval-plan.md"
  - "docs/quality/editor/e9-eval-plan.md"
  - "docs/delivery/editor/milestone-plan.md"
next_action: "由 owner 自行审阅 readiness browser evidence gap 与 W-ED-001–W-ED-006；历史 E1–E9 canonical 不改写"
---

# Editor Evidence Index

## 1. Current Gate

- E0-D：`Complete`。
- E1：`Complete`。
- E2：`Complete`。
- E3：`Complete`。
- E4：`Complete`。
- E5：`Complete`。
- E6：`Complete`。
- E7：`Complete`。
- E8：`Complete`；clean canonical 与 owner 人工门禁均已批准。
- E9：`Complete`；revised 29/29 clean canonical 与人工门禁均已批准，首个独立模块 run 保持 `pre-revision`，R-042 为 `Mitigated`。
- Editor readiness：`in-review / owner-review`；provisional 24/24 仅作反馈，clean attempt 14/24 且 10 个浏览器步骤由沙箱端口权限阻断，等待 owner 自行审阅。
- E1 clean canonical 与 owner 人工门禁均已批准；Analyzer M3–M11 evidence 仍不能替代未来 Editor 里程碑证据。
- E2 clean canonical 与 owner 门禁已于 2026-08-27 获批。
- E3 clean canonical 与 owner 人工门禁已于 2026-08-27 获批；E4 clean canonical 与 owner 人工门禁随后获批。
- E4 clean canonical 31/31 与 owner 人工门禁已于 2026-08-27 获批；E5 已开放。
- E5 clean canonical 35/35 与 owner 人工范围任务已于 2026-08-27 获批；E6 已开放。
- E6 clean canonical 40/40、原生 OS picker、`beforeunload`、辅助技术与长会话补偿已于 2026-08-28 获 owner 批准；E7 紧凑工作台布局已开放，Editor readiness 延后至 E7 审批。
- E7 修订版 clean canonical 已在实现 commit `080f577fe20fcb22a20184dce0b15892c5299464` 上 46/46 通过；原 44/44 run 保留为 `pre-revision`。2026-08-31 owner 批准修订版候选并关闭 E7，未提供的人工测量不补写。
- E8 clean canonical 已在实现 commit `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` 上 25/25 通过；owner 已复核紧凑高度、恢复语义和 marker 可读性门禁并批准关闭 E8。
- E9 首个 clean run 已在实现 commit `cf0a79b176d99eb183368818ce90ac5731d1cfa8` 上 29/29 通过；DEC-052 后证据为 `pre-revision`，不再代表当前 owner 审批候选。
- E9 revised clean run 已在实现 commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd` 上 29/29 通过并获 owner 批准；当前证据为 `approved`。

## 2. Record Contract

每个 E 里程碑记录：run ID、实现 commit、证据 commit、clean identity、浏览器/Node/npm、非敏感硬件摘要、步骤 pass/fail、provisional 关联、日志/summary SHA-256、失败分类、未自动化项目和 reviewer 状态。原始 artifact 保存在 Git 忽略目录直到 owner 审批完成。

## 3. E1 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E1-2026-08-26T15-24-21-043Z-792b424f` |
| Milestone | E1 — Entry, playback and project foundation |
| State | `approved`（18/18 自动化及 owner 人工门禁） |
| Implementation commit | `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` |
| Evidence commit | 本记录所在的 `docs: register Editor E1 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` |
| Started at | 2026-08-26 15:24:21.043 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E1 unit | 9/9 pass | 空工程、完整 point/range canonical round-trip、微秒规范化、unknown/schema/ID/point/range/越界/hash/时长拒绝 |
| E1 integration | 7/7 pass | 独立 IndexedDB、同歌恢复、异歌 conflict/取消回旧歌、原子导入、quota 后内存保留、repeat token、analysis consumer stale/no-job |
| E1 Chrome | 4/4 pass | Header 当前歌曲、播放列表指定歌曲与“去编辑”Tooltip、MusicBar 显隐、播放控件、JSON 导出、刷新 0 秒 paused 草稿恢复、异歌冲突、无效导入隔离、空/无效路由 |
| M3/M4/M6 unit/integration | pass | M3 12/12 + Worker 20/20；M4 6/6 + 6/6；M6 Worker 13/13 + coordinator 6/6 |
| M3 Chrome | 6/6 pass | shell、Header、IndexedDB/Worker 与 WAV/MP3/FLAC |
| M4 Chrome | 3/3 pass | 60 秒漂移 `0.8ms`；三次 seek 最大误差 `66.827ms` |
| M6 Chrome | 3/3 pass | cache `100,941` bytes、refresh hit/exact cursor、20 次循环单 Worker/AudioContext；15 分钟最大反馈 `18.1ms`、分析归因长任务 `0` |
| M11 Chrome | 4/4 pass | 三格式、刷新、键盘/reduced motion、多视口、quota、20 次 Home/Analyzer WebGL/RAF 生命周期 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,825 modules；最大 JS chunk `1,204.24 kB`，已知 warning 保留 |
| Diff check | pass | canonical 起止工作树干净；`git diff --check` exit 0 |

### Provisional History and Failure Instance

- 最终 dirty-worktree provisional：`E1-2026-08-26T15-20-11-120Z-3ef4ec33-provisional`，18/18 pass，summary SHA-256 `673f46da9784717ecefe1289985b74753987079200f20043438d839312eb134b`。
- 较早 provisional `E1-2026-08-26T10-07-16-384Z-3ef4ec33-provisional` 为 17/18 fail，summary SHA-256 `c0d9397768097a15c645cd63c7dbcca8aa1660b80863eb3d9e593168b8eaa9d9`。失败类型为 `EFT-REGRESSION / S2`：M6 开发桥仍在 Home 路由直接调用，违反新规则“只代理当前有效 Analyzer lease”。测试改为先进入 Analyzer 再调用；修正后 M6 Chrome 独立 3/3、最终 provisional 与 canonical 均通过。失败 artifact 保留，不覆盖或改写。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `db51ba98b757ccd524d298243c6118eb24fad60101a74f20a5ff98478a5d5bc6` |
| `01-E1-project-unit.log` | `e6c6489d0d24705a95a3e2785fbbc38689908390f6b197de283fb037a3e9ff78` |
| `02-E1-foundation-integration.log` | `b9f9484f3c27940d2b1897fb469beec44a1d53768f993f9eea91e20071e3476b` |
| `03-M3-unit-regression.log` | `7a4ba2f584c57315d2b14afbb47e74fa5bf9fd34d3852a5efd8fb520dbfe08c6` |
| `04-M3-Worker-regression.log` | `9847a7588e126632c144824b11a6031733be8c2f21eb93b33bb2da558911c240` |
| `05-M4-AudioEngine-regression.log` | `4bb876a923032c3ef190e3310c895e0d0c2cbc5595d4004fa9cd3b6e7b7e1f85` |
| `06-M4-session-regression.log` | `a6d087229b8e03d600b2988557a89fed5c64ddbc10bb53faf4c8ed7e0549cdd7` |
| `07-M6-Worker-regression.log` | `ad20fe1edfe24e6641049b62442c839a157f055817f25686595f9ff91943de62` |
| `08-M6-coordinator-regression.log` | `e5a4498c6203ca8f15a45cbdfcef226b22c216622598f39bed5f9f115d5e37c8` |
| `09-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `10-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `11-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `12-E1-Chrome.log` | `de41a50170b237ded1498f6126997315a6dcf7f6fb416a3f4cb61140e018cd95` |
| `13-M3-Chrome-regression.log` | `91a548109b1ec11297c29f665a2309bb00b131eadf3fc5ee8e51e1d1a4752713` |
| `14-M4-Chrome-regression.log` | `b81e13e25f94e85ab84840057f26f7023eb3a4b76ffcea06f7608d10dc1b564d` |
| `15-M6-Chrome-regression.log` | `759ff4ebd6958391d42307c891a07ccdcf655dd5fc3c05a8b00c6c8e0ad06e07` |
| `16-M11-Chrome-resource-regression.log` | `c095565bb4b8e350ed35c43d68ef39708c58d43f5fcdb5c4c0f92095d62d6664` |
| `17-build.log` | `2afb60b7a75ee004f718a627cdbd8639f0dc422455c314c3f8dbde200219ae15` |
| `18-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval Gate

- Playwright 注入的 OPFS picker 验证 native handle 接口与原子读写，但不能代替真实 OS 打开、保存、取消和覆盖对话框。
- 浏览器原生 `beforeunload` 文案不可自动化；owner 需检查只在写入 pending/in-flight 时出现。
- E1–E5 只要求 Chrome 专项；真实 Edge Editor 全量仍按批准计划留到 E6。
- `project-owner` 于 2026-08-26 明确回复：“我批准 Editor E1 canonical evidence、路由与播放 lease、JSON V1 和草稿恢复结果；同意将 E1 标记为 Complete 并开放 E2。”本签字完成 E1 人工门禁；原生 picker 与离页提示仍属于浏览器无法完全自动化的补偿事实，相关实现变化或 E6 双浏览器加固时需重新复核。
- R-022、R-023 据 E1 canonical 与本次 owner 签字改为 `Mitigated`；R-027 仍等待 E2/E4 对真实 Editor analysis consumer 的进一步证据。

## 4. E2 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E2-2026-08-26T16-42-47-634Z-9fc5c0a8` |
| Milestone | E2 — Timeline and tempo |
| State | `approved`（22/22 自动化与 owner 门禁已批准） |
| Implementation commit | `9fc5c0a81fcf90abfbc665412277147cd958200f` |
| Evidence commit | 本记录所在的 `docs: register Editor E2 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `9fc5c0a81fcf90abfbc665412277147cd958200f` |
| Started at | 2026-08-26 16:42:47.634 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E2 tempo golden | pass | 60、100、128、127.5 BPM 在批准容差内；silence、固定噪声和歧义输入均为 low-confidence；运行时 100 BPM WAV 生成成功 |
| E2 unit | 5/5 pass | viewport normalize/reset、anchor zoom、pixel/25% pan、time↔x、DPR、tempo 插入/继承/移动、拍号、single-beat、输入边界、网格、BPM estimator |
| E2 integration | 17/17 pass | retained Buffer PCM、tempo identity/stale、viewport/tempo JSON round-trip、迟到估计不覆盖用户 BPM、E1 controller 与 M6 coordinator 回归 |
| E2 Chrome | 5/5 pass | waveform/grid/cursor Canvas、click/keyboard seek、wheel zoom、右键 pan/菜单、boundary 插入/拖动、BPM/拍号/single-beat/非法值、刷新恢复、1024/1280/1920 |
| E2 Chrome metrics | pass | 输入到可见反馈 `3.9ms`（门禁 `<=100ms`）；boundary/时间几何误差 `0.1484 CSS px`（门禁 `<=1 CSS px`） |
| E1 regression | pass | unit 9/9、integration 8/8、Chrome 4/4；路由、lease、JSON、草稿和失败隔离保持通过 |
| M3/M4/M6 unit/integration | pass | M3 12/12 + Worker 20/20；M4 6/6 + 6/6；M6 Worker 13/13 + coordinator 7/7 |
| M3/M4 Chrome | pass | M3 6/6；M4 3/3，60 秒漂移 `2.5ms`，三次 seek 最大误差 `66.827ms` |
| M6 Chrome | 3/3 pass | cache `100,941` bytes、refresh hit/exact cursor；20 次循环单 Worker/AudioContext；15 分钟最大反馈 `17.9ms`、分析归因长任务 `0` |
| M11 Chrome | 4/4 pass | 三格式、刷新、键盘/reduced motion、多视口、quota 与 20 次 WebGL/RAF 生命周期回归 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,831 modules；最大 JS chunk `1,224.74 kB`，既有 chunk warning 保留 |
| Diff check | pass | canonical 起止工作树干净；`git diff --check` exit 0 |

### Provisional History

- 最终 dirty-worktree provisional：`E2-2026-08-26T16-38-11-839Z-c5cdd2a6-provisional`，22/22 pass，summary SHA-256 `dc7088684f469e3186b3919695be34f21b870b1db6865054ddc557ed87d3b393`。
- 本轮没有被覆盖或隐藏的 provisional failure。运行过程中发现的 Vue reactive proxy `structuredClone` 与 E1 fake coordinator 接口漂移均在 provisional 前修复，并分别由 Chrome tempo 操作和 E1 8/8 integration 固定回归。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `4465c20343af9092601296b86a229200579f648ffa90641411b88f9861ba8660` |
| `01-E2-tempo-golden.log` | `2aa9988e158f22c4f25da1fc726f46aebc40cdb50002e02a4968896a28263cb2` |
| `02-E2-timeline-unit.log` | `11b570b294fb977d0fe03ad50594f0b2d2b5dc7e9cc4bcbdda592380c03f162e` |
| `03-E2-timeline-integration.log` | `72f16a042c5dd3b31ae35ae55fdfefe3226c04bcc9b6e5438ac48810f1331e9d` |
| `04-E1-project-unit-regression.log` | `c35789e75741f846033ef2b1f4c99215be7ef0a8816513d9922a0c44a606aa60` |
| `05-E1-foundation-integration-regression.log` | `f69f710dfd13c169dfc962661dfd967bde59afed44d41d4afd43235b005db27d` |
| `06-M3-unit-regression.log` | `3ea38f180f87ac009f0281cd0248f7fd41afea1d679ea733012967cedee1ef47` |
| `07-M3-Worker-regression.log` | `fa8cc515f7593891386f49a0afee623d32c123cc6cd21ec79e72066358015674` |
| `08-M4-AudioEngine-regression.log` | `de37d047b67754304760b20383ece1d04c462ec0154e1d00c2eccd7b628c61b5` |
| `09-M4-session-regression.log` | `e9cd1fb4d32478d024b5d34d1d34afde090a87f1bba263d4b7a7e501212f521b` |
| `10-M6-Worker-regression.log` | `703dd724e5db2c783f564b23cf4e5bc074c529b3694249da7a84335da739b824` |
| `11-M6-coordinator-regression.log` | `149c239a9310ae97bc4c112796954d489abd2106b0dacc9fed527bccd474d551` |
| `12-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `13-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `14-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `15-E2-Chrome.log` | `84e703b88f63b361434d708e2a65b7741ed279e8b705ea1569862c6ab853480b` |
| `16-E1-Chrome-regression.log` | `307bbd834e399867d978018ec618ecf179a3f9cee8be4fef89caf4506bafed69` |
| `17-M3-Chrome-regression.log` | `5d44c770ded6526faa72e3466dcd5d090e6fd13b45ec7cf74aaee93b51009580` |
| `18-M4-Chrome-regression.log` | `7e53cfb6f56e7c1b46c7d944770f6f854799a4722641287dfadb9336324904ed` |
| `19-M6-Chrome-regression.log` | `e06304ceae48ecc2ff74dfee4b709069876d082f36fcacac864c8c53d290ab30` |
| `20-M11-Chrome-resource-regression.log` | `53abc4566b9d81a0ff540967f33727538b1df4f4d97db0d6c694213bee13e8d0` |
| `21-build.log` | `a75e62039425b9fb6d64578eacbfa7779bf6a98e41adfea3fe748e0eb0b75781` |
| `22-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval

- E2 专项按批准计划只在稳定 Chrome 自动化；真实 Edge 的 Editor 全量、原生 picker、离页提示和辅助技术仍保留到 E6，不能从 Analyzer M11 或本轮 Chrome 结果外推。
- BPM golden 证明固定合成输入和低置信度边界，不代表任意真实歌曲都能可靠识别；低置信度时继续要求手动输入。
- 2026-08-27，owner 原文“我已经提交了，批准此次结果并且开放下一步”批准 E2 并开放 E3；不从该原文补写未提供的逐项人工测量值。
- R-026 根据 BPM golden、竞态证据与本次签字改为 `Mitigated`。R-024、R-025、R-027 继续等待 E3/E4/E6 的 geometry、交互、consumer 与双浏览器门禁。

## 5. E3 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E3-2026-08-27T02-53-58-176Z-c670ddf5` |
| Milestone | E3 — Point annotation |
| State | `approved`（26/26 自动化与 owner point task 已批准） |
| Implementation commit | `c670ddf5494269f5a56abd20c3c5653ee5b27cef` |
| Evidence commit | 本记录所在的 `docs: register Editor E3 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `c670ddf5494269f5a56abd20c3c5653ee5b27cef` |
| Started at | 2026-08-27 02:53:58.176 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E3 point golden | pass | 100 BPM、4/4、歌曲首尾、full/zoomed viewport 与 1/4/1/16 beat 吸附事实匹配；运行时 WAV 与 range 兼容工程生成成功 |
| E3 unit | 6/6 pass | lane/class 新增重命名、最少一个分类、迁移/删除/冲突、微秒唯一性、0/duration、single-beat、1/16–1 beat、自适应移动与 visible filter |
| E3 integration | 4/4 pass | point/range JSON round-trip、独立草稿与 viewport 恢复、迁移后 tempo 修改不改秒数、viewport-visible 模型 |
| E3 Chrome | 7/7 pass | 鼠标/键盘/右键创建删除与重复提示、分类迁移/删除/取消、4px pan 与 quick menu、range 只读、1024/1280/1920、reduced motion、刷新恢复与 console/pageerror |
| E3 Chrome metrics | pass | 输入到可见反馈 `28.5ms`（门禁 `<=100ms`）；波形与 point 时间列几何误差 `0 CSS px`（门禁 `<=1 CSS px`）；viewport 外 marker 不实例化 |
| E1/E2 regression | pass | E1 unit 9/9、integration 8/8、Chrome 4/4；E2 golden、unit 5/5、integration 17/17、Chrome 5/5；E2 反馈 `4ms`、几何误差 `0.2047 CSS px` |
| M3/M4/M6 unit/integration | pass | M3 12/12 + Worker 20/20；M4 6/6 + 6/6；M6 Worker 13/13 + coordinator 7/7 |
| M3/M4 Chrome | pass | M3 6/6；M4 3/3，60 秒漂移 `1.533ms`，三次 seek 最大误差 `66.827ms` |
| M6 Chrome | 3/3 pass | cache `100,941` bytes、refresh hit/exact cursor；20 次循环单 Worker/AudioContext；15 分钟最大反馈 `17.7ms`、分析归因长任务 `0` |
| M11 Chrome | 4/4 pass | 三格式/刷新、键盘/reduced motion、多视口、quota 与 20 次 WebGL/RAF 生命周期回归 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,835 modules；最大 JS chunk `1,246.31 kB`，warning 如实保留并等待 Editor E6/readiness 复核 |
| Diff check | pass | canonical 起止工作树干净；`git diff --check` exit 0 |

### Provisional History and Pre-canonical Corrections

- 最终 dirty-worktree provisional：`E3-2026-08-27T02-49-45-436Z-3b561f0b-provisional`，26/26 pass，summary SHA-256 `df76da941044843cdff9e06d23cd897a3219b9b4934dab213203c6640a7e55bd`。
- provisional 前的专项 Chrome 迭代曾检出 `EFT-POINTER / S1` 与 `EFT-GEOMETRY / S1`：正常 `lostpointercapture` 清除了 quick menu、测试在滚动后使用了失效页面坐标、lane 外框造成 2 CSS px 宽度差；同时受控重命名输入会被旧 prop 回写。实现改为区分正常释放/取消、使用 draft-on-input/blur commit，并让两个时间列共享同一网格外框；最终专项 7/7、provisional 与 canonical 均通过。未覆盖或改写 canonical 失败 artifact，本轮没有 canonical failure。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `2a0a46b9a0e9b459ee17b11919451f074205fda58801d84a1274dbd12f5cfe4c` |
| `01-E3-point-golden.log` | `f31f700d278cf3e4cf7ae1e43893e6bc0535de6c0ebf672b1d76aa3efc943fc6` |
| `02-E3-point-unit.log` | `7019d3c251a9840ba9565dc69c5f8bbd3a0e8ce5f20fb13e614e0f1872ab37ef` |
| `03-E3-point-integration.log` | `5366ba4760189681d080890d0dcc65f3c3aa29b590fc154c4bf1a7715168c333` |
| `04-E2-tempo-golden-regression.log` | `2aa9988e158f22c4f25da1fc726f46aebc40cdb50002e02a4968896a28263cb2` |
| `05-E2-timeline-unit-regression.log` | `e67eec67be6ea4d6e2507943b75c944ad5ada2c9b80029050709e0715e8429bd` |
| `06-E2-timeline-integration-regression.log` | `edc2687a5eec909289c1ef137e5201102860ace3af944492a634247eba877d22` |
| `07-E1-project-unit-regression.log` | `ba82abbe8b2bb2aabcd6b21c31ec160d24b78ec685018102154ab9dedca5e7d4` |
| `08-E1-foundation-integration-regression.log` | `81438611cc6d178d3e8aee511534b4194bfcf46580a392dfac21961813696736` |
| `09-M3-unit-regression.log` | `48ab6c5ff2cf913117a16c25ca32ce3034bd785d1e491a5ecbcbdee62464018a` |
| `10-M3-Worker-regression.log` | `de182137b09b062ba8983e5d96b2440a0841ad97878e1e51dac67aac755b35fb` |
| `11-M4-AudioEngine-regression.log` | `0f3d54c2107536f59d77c0279cca6f322b3cb4a393613227ea20f973dff610a9` |
| `12-M4-session-regression.log` | `6791517ce7b3f271367b07fa614d6e26773239e6a16f2c9ab67e481329918670` |
| `13-M6-Worker-regression.log` | `513dec39d7830ef0459e10623e48d7ea2fac52f332fd5665504a87666ef1874a` |
| `14-M6-coordinator-regression.log` | `a3ed5db4965a36f0b8a96d829c5fdfdc454837c1e28fa9c127a26dc600e6c5ef` |
| `15-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `16-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `17-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `18-E3-Chrome.log` | `a594f8e06e15f056e6bb9c2b8167fcf1d02c2154c887f160cfa23e8d8f584d3e` |
| `19-E2-Chrome-regression.log` | `9d938b922842fbd5ca88d66f618349e884edb04e6e74cdd89a7b7f0e87a6954c` |
| `20-E1-Chrome-regression.log` | `86e888acdb334bca0212065e277d99e4d6094c1d7bb01212678db1263e4c174d` |
| `21-M3-Chrome-regression.log` | `889fcf0b4b81838d2712d26a38ee6e700faae1c19b11c4daa66d4d5aa714b1e8` |
| `22-M4-Chrome-regression.log` | `46db58a29ac6babc34e7db16d28ee155db30a162547b683593bb94632b16317b` |
| `23-M6-Chrome-regression.log` | `a08c5c3c4e070bb44d6a84350aebdcc2666d1368f1295ccc8df737ea1828ff27` |
| `24-M11-Chrome-resource-regression.log` | `b35c1117e3f9ac6fdf031960695e731baf1a280eaedd13477f06cb12d1425dda` |
| `25-build.log` | `f39d7379449ea3b0ce7a04e961da5476f8ce96af678950dac93cbcfe3ade28ec` |
| `26-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval

- E3 专项按批准计划只在稳定 Chrome 自动化；真实 Edge、10,000 事件、原生 picker 和辅助技术长会话仍留到 E6，不能从本轮结果外推。
- 自动化验证了 pointer/keyboard/focus-visible、reduced motion 和 aria-live 的可操作契约，但不能替代 owner 对标记密度、样式清晰度和真实连续听辨任务的判断。
- 2026-08-27，owner 原文“我批准 Editor E3 canonical evidence、point lane、inner class、自适应网格与点标记结果；同意将 E3 标记为 Complete 并开放 E4。”完成 E3 人工门禁；不补写用户未提供的逐项测量。
- R-024、R-025 已获得 E3 point 层的 Chrome geometry/pointer/visible-DOM 证据，但在 E4 overlay 与 E6 双浏览器/10,000 事件复核前继续保持 `Open`；R-027 继续等待 E4 consumer/overlay 证据。

## 6. E4 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E4-2026-08-27T07-21-59-209Z-c9e03ab9` |
| Milestone | E4 — Analysis overlay |
| State | `approved`（31/31 自动化与 owner 人工门禁已批准） |
| Implementation commit | `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` |
| Evidence commit | 本记录所在的 `docs: register Editor E4 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `c9e03ab9554aa5bac5649fa84e1d822f056ad0e2` |
| Started at | 2026-08-27 07:21:59.209 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E4 overlay golden | pass | 21 项 feature 与六类 renderer 映射、0.10/0.35/0.12 bounds、共享时间锚点和运行时 WAV/JSON 工程匹配 |
| E4 unit | 4/4 pass | registry 穷尽、bounds clamp/1%/5%、Buffer 去重、exact summary、shared renderer success/shape failure |
| E4 integration | 3/3 pass | Buffer-first、保存 overlay 激活、快速切换追上最终特征、error retry、last-ready waveform、草稿和 Analyzer workspace 隔离 |
| E4 Chrome | 7/7 pass | 21 项选择与六类 renderer、三手柄 pointer/keyboard/reduced motion、pointer-through、Canvas 故障隔离、刷新恢复、1024/1280/1920 |
| E4 Chrome metrics | pass | overlay/point 时间列几何误差 `1 CSS px`（门禁 `<=1 CSS px`）；穿透点击反馈 `5.1ms`（门禁 `<=100ms`） |
| E1–E3 regression | pass | E1 unit/integration/Chrome、E2 golden/unit/integration/Chrome、E3 golden/unit/integration/Chrome 全部通过；E3 反馈 `44ms`、几何误差 `0 CSS px` |
| M6–M10 regression | pass | M6 Worker/coordinator；M7–M10 renderer unit 与 Chrome 全部通过；M10 15 分钟四重卡最大反馈 `17.2ms`、分析归因长任务 `0` |
| M11 Chrome | 4/4 pass | 三格式、键盘/reduced motion、多视口、quota 与 20 次 WebGL/RAF 生命周期回归 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,840 modules；最大 JS chunk `1,256.62 kB`，warning 如实保留到 Editor E6/readiness 复核 |
| Diff check | pass | canonical 起止工作树干净；`git diff --check` exit 0 |

### Provisional History and Pre-canonical Corrections

- 最终 dirty-worktree provisional：`E4-2026-08-27T07-18-13-982Z-67946ad6-provisional`，31/31 pass，summary SHA-256 `fbb3f08c8da9f5d74af6066a67c625821678c9638387df81b6e1e63c7d1f2198`。
- provisional 前专项 Chrome 首次发现两个测试编排问题：lane locator 同时命中容器与名称控件，以及 Canvas 恢复时 retry 控件因 reactive 重绘而不稳定。测试改为定位实际 lane 容器并在同一浏览器任务中恢复 context 后触发重试；产品侧同时用 integration 固定快速换特征最终一致性与错误强制重试。最终专项、provisional 与 canonical 均通过，本轮没有被覆盖的 canonical failure。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `790f7f76f113fad6f005992f8fd10d94b0b77451acd58717c8c221edd54628ff` |
| `01-E4-overlay-golden.log` | `eab36a9bc0292695c2ddab58761166cc40e5aec54d44612da96b251ee9600ba1` |
| `02-E4-overlay-unit.log` | `b1236a85cc42ffb08e61e829ef667bdee6ef37496ae865f250b6ebebaea02608` |
| `03-E4-overlay-integration.log` | `21bcb7b6743eaa98dabec1dd3f868057f95e418d6970ee429e5b22f8c25a5fd9` |
| `04-E3-point-golden-regression.log` | `f31f700d278cf3e4cf7ae1e43893e6bc0535de6c0ebf672b1d76aa3efc943fc6` |
| `05-E3-point-unit-regression.log` | `7c48cd33c0bb6932a6e04399db51b3226eab93ed82ff3e1e47ea070bfb3108b1` |
| `06-E3-point-integration-regression.log` | `503f5dd4044ad37b90c169d5d75622b6514b3df392a2f4e5b15453225026683b` |
| `07-E2-tempo-golden-regression.log` | `2aa9988e158f22c4f25da1fc726f46aebc40cdb50002e02a4968896a28263cb2` |
| `08-E2-timeline-unit-regression.log` | `be834a2f90e4b66bd4e3ce0e242075f442eac26411a9e280dff4ac03614b435a` |
| `09-E2-timeline-integration-regression.log` | `24324033db4885cce52811e934b19874db0218e857c7caa150ff648531e980cd` |
| `10-E1-project-unit-regression.log` | `01e63df7c3468f6497533184fe6c6ab1a901a0cc443d5b0e650ef17d2925c689` |
| `11-E1-foundation-integration-regression.log` | `14ea3ac9be7d31a9375db0c2d20f95418613f53d8d742435602da25f9ff16a01` |
| `12-M6-Worker-regression.log` | `c44b4a14416325fbcc26b24cfc7b36bace706fba7d0f6c6b242d7403e7de7a27` |
| `13-M6-coordinator-regression.log` | `2dc99161dc3d0c4ca05e0b4a5680084f66fa4423087d59de34f73e1bfa4a77d5` |
| `14-M7-renderer-unit-regression.log` | `34e9beab741f658e9855e0d151761bc39b431ad5ed83186b8fa616942868fd2e` |
| `15-M8-renderer-unit-regression.log` | `25f3ef4ca72e2a9cfef5e0726db90779ad3aa82ce7e465a353dc3f3e9ab3bd9c` |
| `16-M9-renderer-unit-regression.log` | `9b57f4c10259f59bf9d83d77937c3a258c4e39ba0f24c0db53069a2ee08f8ac2` |
| `17-M10-renderer-unit-regression.log` | `f43373897166faecea0e20a09ce8922e1c62bfc74c3c66a5b3dd8985d3dd6f7a` |
| `18-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `19-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `20-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `21-E4-Chrome.log` | `ff771dff8a2d3923daa09afd15f11b3be157169ed568fd42dbfb82fadf13ea97` |
| `22-E3-Chrome-regression.log` | `bfd0fc12d9e6fd921ffdd2cea56ae46aab20fb06e441b5cc4bd7437492eb2cad` |
| `23-E2-Chrome-regression.log` | `e2b956fe82a803c79f55b8d2610463474b692858da000e545654899f17a1dd07` |
| `24-E1-Chrome-regression.log` | `40ef4dc68c2366cf403be8da59b12ba05b6fa99b8a05ee765899bed7d4cb4353` |
| `25-M7-Chrome-renderer-regression.log` | `b4b57744a6556ac22432962af3f83805a0a4777b312d2db21ebcef3af6320ca4` |
| `26-M8-Chrome-renderer-regression.log` | `e147a6540c1e155a472dcacf4e944773d823b340cbd5b036e646c3cc15bcd74e` |
| `27-M9-Chrome-renderer-regression.log` | `1ad916c28bac4c058f839bac5edc30a0c7c0705b841c8d48ffa6a7a761cf2659` |
| `28-M10-Chrome-renderer-regression.log` | `7c5100fd65e9de4a6cb56c4d36c200b63e9d6a5fe8bb765902fed377edf54e1f` |
| `29-M11-Chrome-resource-regression.log` | `bd2064ba719f1d493c21019810e933282d539724f7e43eebf12125e0a197d986` |
| `30-build.log` | `848a3de73b520e8fbf21d981fb22b762df47f6f290003c6984d81526a491d023` |
| `31-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval Gate

- E4 专项按批准计划只在稳定 Chrome 自动化；真实 Edge、10,000 事件、原生 picker 和辅助技术长会话仍留到 E6，不能从本轮结果外推。
- 自动化验证了 pointer-through、键盘手柄、reduced motion、错误隔离和多视口几何，但不能替代 owner 对半透明图形清晰度、连续换特征和真实标记任务的视觉判断。
- `project-owner` 于 2026-08-27 明确回复：“我批准 Editor E4 canonical evidence、21 项分析叠加、三手柄、pointer-through 与错误隔离结果；同意将 E4 标记为 Complete 并开放 E5。”本签字完成 E4 人工门禁，不补写 owner 未提供的逐项测量。
- R-024、R-027 已获得 E4 Chrome geometry/consumer/renderer isolation 证据，但在 E6 双浏览器/资源复核前继续保持 `Open`；R-025 继续等待 E5 range 与 E6 10,000 事件/辅助技术门禁。

## 7. E5 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E5-2026-08-27T11-03-22-177Z-78124177` |
| Milestone | E5 — Range annotation |
| State | `approved`（35/35 自动化与 owner 人工范围任务均已批准） |
| Implementation commit | `781241772e05186e2fe0d006ed6ddd8bceded7af` |
| Evidence commit | 本记录所在的 `docs: register Editor E5 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `781241772e05186e2fe0d006ed6ddd8bceded7af` |
| Started at | 2026-08-27 11:03:22.177 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E5 range golden | pass | 100 BPM、半开 `[start,end)`、相邻允许、同分类防重叠、跨分类重叠、point-in-range、single-beat 和 full/zoomed 最短吸附匹配 |
| E5 unit | 7/7 pass | range lane/class、命名、半开 overlap、歌曲边界、最短网格、single-beat、端点更新/回滚、迁移冲突、可见范围与稳定删除 |
| E5 integration | 5/5 pass | point/range JSON V1、独立草稿、viewport/tempo/overlay 恢复、invalid overlap 原子拒绝、tempo/zoom 不改秒数、迁移后稳定 ID |
| E5 Chrome | 7/7 pass | 两阶段创建、preview、Esc/右键取消、pointer/keyboard 删除、端点键盘/拖动与 pointercancel 回滚、重叠拒绝、跨分类允许、迁移冲突、quick menu、overlay 穿透、刷新与 1024/1280/1920 |
| E5 Chrome metrics | pass | 输入到可见反馈 `35.5ms`（门禁 `<=100ms`）；range/timeline/overlay 三视口几何误差均 `1 CSS px`（门禁 `<=1 CSS px`） |
| E1–E4 regression | pass | E1 unit/integration/Chrome、E2 golden/unit/integration/Chrome、E3 golden/unit/integration/Chrome、E4 golden/unit/integration/Chrome 全部通过；E3 导入 range 身份回归已随 E5 开放更新 |
| M6–M10 regression | pass | M6 Worker/coordinator；M7–M10 renderer unit 与 Chrome 全部通过；M10 15 分钟四重卡最大反馈 `17.7ms`、分析归因长任务 `0` |
| M11 Chrome | 4/4 pass | 三格式、键盘/reduced motion、多视口、quota 与 20 次 WebGL/RAF 生命周期回归 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,844 modules；最大 JS chunk `1,281.63 kB`，warning 如实保留到 Editor E6/readiness 复核 |
| Diff check | pass | canonical 起止工作树干净；`git diff --check` exit 0 |

### Provisional History and Pre-canonical Corrections

- 最终 dirty-worktree provisional：`E5-2026-08-27T10-58-47-206Z-56a0250d-provisional`，35/35 pass，summary SHA-256 `f821166e699b2866876e10269b41875b843cda9eb8eb2c8365dabd624c361e83`。
- provisional 前的专项 Chrome 首次发现 `EFT-RANGE-STATE / S1`：正常释放 pointer capture 后触发的 `lostpointercapture` 会再次执行取消路径并清除刚打开的 quick menu。实现改为没有活动 pointer 时忽略迟到的 lost-capture；同时测试改为在滚动后重新读取可见坐标，并固定 pointercancel 端点回滚。最终 E5 Chrome 7/7、provisional 与 canonical 均通过，本轮没有 canonical failure。

### Manual Approval

`project-owner` 于 2026-08-27 明确回复：“我批准 Editor E5 canonical evidence、范围事件创建、调整、重叠校验、键盘与持久化结果；同意将 E5 标记为 Complete 并开放 E6。”该签字批准已登记的 E5 canonical 与人工范围任务，不补写 owner 未提供的逐项测量，也不提前批准 E6。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `6928f75cbdeb6d77e54c81b3547f7caee0b39d4c6881884b1d1d7065f3dde1b0` |
| `01-E5-range-golden.log` | `73079981621572050edb3675ef4755fe8638a3060aeea2ab5e0bd101774a1c20` |
| `02-E5-range-unit.log` | `60125649cdb88faab3b0f7cce57b3d2b6690976fa1907d0dd37f03f22e9bec48` |
| `03-E5-range-integration.log` | `20e821662d47bd9bcce8c9e1b7cda730478791195ff06d520fe8fe2a2cbca71e` |
| `04-E5-Chrome.log` | `0101655fe91eee5a6550a390ab2fae3bb41582ee819b63ad5991524382ffb243` |
| `05-E4-overlay-golden-regression.log` | `eab36a9bc0292695c2ddab58761166cc40e5aec54d44612da96b251ee9600ba1` |
| `06-E4-overlay-unit-regression.log` | `1d8bc500fbe37bad4dc4407541f45c45c99bdb7c1d74674579d9b1361f60dae7` |
| `07-E4-overlay-integration-regression.log` | `0edd9afc94fadbe66d767a4effc5db5ffa372a6a7ee954a240b0a0d2f5eb53ff` |
| `08-E3-point-golden-regression.log` | `f31f700d278cf3e4cf7ae1e43893e6bc0535de6c0ebf672b1d76aa3efc943fc6` |
| `09-E3-point-unit-regression.log` | `64195398e71dec64b43d5f322b1906e1c32e5dd725e9fea869dd3457e1bd1f25` |
| `10-E3-point-integration-regression.log` | `da5231f2003e7392f83310d7dc9919e6bce5c7d8af7dd27a86f901614187fc0c` |
| `11-E2-tempo-golden-regression.log` | `2aa9988e158f22c4f25da1fc726f46aebc40cdb50002e02a4968896a28263cb2` |
| `12-E2-timeline-unit-regression.log` | `f648425017a43053bf59864c97c4d5a1cf005385bb4f9a4e00cf0fbd12fe47b9` |
| `13-E2-timeline-integration-regression.log` | `68bde825ebf5614d14839bc981b31d30433dca4692140848a8d488a2f8083489` |
| `14-E1-project-unit-regression.log` | `e6ab1b3e4a6521185e1fb25d1dad57af97073329148f13b00b88d88c5f263b2f` |
| `15-E1-foundation-integration-regression.log` | `3fd6d78c4e01ee19d5cf48e2019c88bf3dd5ceb7141b30f4f34aeb7d5e4194dc` |
| `16-M6-Worker-regression.log` | `3e4044d601a73fe7b3912d26b42cbb279ffcde0f9cf5e4a2704ba2567a8e97e0` |
| `17-M6-coordinator-regression.log` | `81fc415f138a69910a00de76b6270948e6ce71a79b0aa873cde0081f55b852e1` |
| `18-M7-renderer-unit-regression.log` | `c7f86536f76640adc39c5e3d88a4020ea67c41efc4c52a8f48ed30364b9f7bc1` |
| `19-M8-renderer-unit-regression.log` | `88141a9aa19a91f9aed556d700a14cc08bc79355dec721f7bf9909b050017e56` |
| `20-M9-renderer-unit-regression.log` | `4eb204b888726185119187f56b7d1e1c81002eede22388794225b08d5e71c69e` |
| `21-M10-renderer-unit-regression.log` | `e57f9a83bb26ad7aea17d20b27a12bf826d1c0f62ad4086ac6754bb351422bd7` |
| `22-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `23-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `24-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `25-E4-Chrome-regression.log` | `7f50e8a49bf0911858b3fab005acc336045daa4db45b5b81b4c7ade59e33b99e` |
| `26-E3-Chrome-regression.log` | `6cac2e102e64c3a4e78f0e959028e8004baf4b70fbd8c8ada8214b37ce88826e` |
| `27-E2-Chrome-regression.log` | `b111c5cc13d268db682b8e4f56213cb5a8e224381595978ff5d334dc5d783382` |
| `28-E1-Chrome-regression.log` | `c9a69d30aa37b4a93533824ce0b98a2c1de65f2ab1d62f4aaadb9f74f54aa95a` |
| `29-M7-Chrome-renderer-regression.log` | `ad9a312f9c4b9cbf92c65fa18ae50241c569034ed924994723bcb4080d7112ce` |
| `30-M8-Chrome-renderer-regression.log` | `0b757b04f53385c80518a6c711b19f64859fa767148c02185e9cdc6c9769da9e` |
| `31-M9-Chrome-renderer-regression.log` | `8e7480d5fde9124dd5b21b3f46680fe1ee718832e9830226706b1ad686b1e3aa` |
| `32-M10-Chrome-renderer-regression.log` | `a6f9734b6b708a017a027f3580327f3cffe280d46fbad7da4e2f8f5f6ec26827` |
| `33-M11-Chrome-resource-regression.log` | `462bcb813581595c7fef7595b57e291cb6b8fbe2929ddfc82ac084bc4448c899` |
| `34-build.log` | `3762734e4d2aad296d56075df5c7200848d83774bfb40fa0c6877b5b807b97a1` |
| `35-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval Gate

- E5 专项按批准计划只在稳定 Chrome 自动化；真实 Edge、MP3/WAV/FLAC Editor 全量、10,000 事件、原生 picker、资源与辅助技术长会话仍留到 E6，不能从本轮结果外推。
- 自动化验证了 pointer/keyboard、重叠矩阵、pointercancel 回滚、overlay 穿透、reduced motion、刷新和多视口几何，但不能替代 owner 对连续长音色/效果标注、视觉清晰度和真实 JSON 导入导出的判断。
- `project-owner` 已于 2026-08-27 完成人工范围任务并批准 E5；真实 Edge、三格式 native flow、10,000 事件、资源与辅助技术仍由 E6 独立验证。
- R-024、R-025 获得 E5 Chrome range geometry/state/keyboard 证据，R-023 获得 range import/draft 回归；按已批准风险策略，R-024/R-025/R-027 仍保持 `Open`，E6 再执行双浏览器、10,000 事件、资源与辅助技术门禁。

## 8. E6 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E6-2026-08-27T15-52-33-466Z-17d7fe10` |
| Milestone | E6 — Final hardening |
| State | `approved`（40/40 自动化与 owner 人工补偿门禁已批准） |
| Implementation commit | `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` |
| Evidence commit | 本记录所在的 `docs: register Editor E6 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `17d7fe1046ed02a3fb5137ccfe7cbf5590093aff` |
| Started at | 2026-08-27 15:52:33.466 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E6 unit / integration | 3/3 + 3/3 pass | 固定 seed 的 20 lanes、160 classes、5,000 point + 5,000 range；ID、半开相邻、跨分类重叠、尾部边界、JSON/IndexedDB round-trip 与 invalid import 原子隔离 |
| E6 Chrome / Edge | 3/3 + 3/3 pass | WAV/MP3/FLAC、当前 track、repeat-one、mismatch 隔离、刷新暂停恢复、10,000 事件、reduced motion、键盘焦点和 20 次 lifecycle |
| Stress identity | pass | seed `3858767910`；15 分钟；10,000 events；运行时工程 SHA-256 `1ee69629a2ea40342b503653ac31ac2c7eabad361d570c3b3d5a5be625bce5f0`；10,182/10,182 ID 唯一 |
| Visible DOM / Canvas | pass | 90 秒 viewport 的时间过滤上限为 500 point + 560 range；采样时实际 DOM 为 378 point + 0 range，只实例化垂直可见 surface；165 Canvas 中可见 backing store 异常为 0 |
| Feedback / long tasks | pass | Chrome 最大 `4.5ms`，Edge 最大 `4.2ms`，均低于 `100ms`；两浏览器 Editor/分析归因 `>50ms` 长任务为 `0` |
| Geometry | pass | Chrome/Edge 在 1024/1280/1920 的 timeline/event/overlay 最大差均为 `1 CSS px` |
| Resource lifecycle | pass | 两浏览器各 20 次 Editor/Analyzer/Home、换歌与 overlay 循环后为 1 Worker、1 AudioContext、1–2 RAF、0 Object URL、1 ResizeObserver、1 Home Canvas，无单调累积 |
| Edge Analyzer regression | 4/4 pass | 三格式队列/分析恢复、键盘/reduced motion/390–1920、quota 和 20 次 WebGL/RAF 生命周期 |
| E1–E5 / M6–M11 regressions | pass | E1–E5 unit/integration/Chrome、M6 Worker/coordinator、M7–M10 renderer unit/Chrome、M11 Chrome 全部通过 |
| Build | pass with warning | 1,844 modules；最大 JS chunk `1,282.91 kB`，既有 warning 如实保留到 Editor readiness review |
| Docs / harness / typecheck / diff | pass | lifecycle links、deliberate failure detection、`vue-tsc -b`、canonical 起止 clean 与 `git diff --check` |

### Provisional and Failed-attempt History

- 最终 dirty-worktree provisional：`E6-2026-08-27T15-37-05-240Z-5448a9d9-provisional`，40/40 pass，summary SHA-256 `07128cc377f0d2d2134ba76acd8bcf3c3c08bedbf539182e09444a3a3d2910e7`。
- 较早 provisional `E6-2026-08-27T14-41-27-498Z-5448a9d9-provisional` 为 38/40 fail，summary SHA-256 `10d1e26b5faa0ad731c6241ef51f3b7313ee54f01d7a0bf3b4011b5467998f79`。失败属于 `EFT-REGRESSION / S1`：E3/E5 刷新断言未先滚动到新的纵向可见 surface；测试按 viewport-visible DOM 契约修正后通过。
- clean commit `e27e0c00…` 的第一次 canonical 尝试在 Chrome 20 次生命周期中暴露测试竞态：异歌 conflict 异步出现前测试只检查一次，导致等待 `ready` 超时。该次运行被明确终止，没有生成 summary，也不作为 canonical。测试改为等待 `ready | conflict` 后，专项 20 次循环通过，并以独立提交 `17d7fe1` 固定；最终 clean canonical 40/40 通过。
- E6 反馈计时从浏览器内实际 `pointerdown` / `keydown` / `input` 开始，不包含 Playwright 发出输入前的驱动等待；`100ms` 产品门禁未放宽。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `8f81b877dc5993bcdd4d04064e85c96156c946f2c62066c2b8571dfbc8473b6e` |
| 40 个排序后 `*.log` SHA-256 清单的 SHA-256 | `da3216dd6d8f099bff97e895cb70d83ed0de76887e5922eb4394906dd5bf4495` |
| `01-E6-hardening-unit.log` | `9af204e8632249eca31197a6b1f59b2fff07d0470ae8776340e980cfc9d24093` |
| `02-E6-hardening-integration.log` | `c68f95cc09f0a0e38e8d93c9be32a465903690da1959d86b61cc44c0643b14ec` |
| `03-E6-Chrome.log` | `1b5b72571ebebb28ae72cd19ea8cbe9e06e7d8f1f8b9c32299becb5c09d51d67` |
| `04-E6-Edge.log` | `ddf1281a2de03fe1d549e0a8fa7aa99a9db8c5d334fa87a19eabf46ae3eb5cb0` |
| `05-M3-M11-Edge-critical-regression.log` | `baa197f5422e1e7a6dcbb599e80dfb75cdb1e3d32ccd2507c3285f67780828bb` |
| `09-E5-Chrome-regression.log` | `101f85b3385670119dfce45cafac107a4ec4500173fd0657020ce60e81c5da0f` |
| `30-E4-Chrome-regression.log` | `0a9f613bcc30ddab77bfc6cc7c54969e4d381aab7d5a607413d1fcf4b3b68f05` |
| `31-E3-Chrome-regression.log` | `e366436cec57030d753190b336991b5c6738560a29593769d1d6b858243b257d` |
| `32-E2-Chrome-regression.log` | `dbabebeec222ca60dfb95a42b196282bbcaeb751c03d1eedf1b9828f406b28ac` |
| `33-E1-Chrome-regression.log` | `9d8f7c4acf5061d312b215226f20a2f7c49ec7ae6786b35b05791b78f00e51c9` |
| `38-M11-Chrome-resource-regression.log` | `a07ba4e826db4b04d5e3acf49f905d761ecbf37333fee30f968913b08421c6b1` |
| `39-build.log` | `941dd2c92102119c45522ffed70310478999d0fb77cfb985282a03d0f5c14a2e` |
| `40-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval Gate

- 自动化中的工程 picker 使用浏览器 OPFS/stub 验证原子读写、取消与错误隔离，不能替代 Chrome/Edge 的真实 OS 打开、保存和覆盖对话框。
- 原生 `beforeunload` 提示、辅助技术朗读和真实长会话操作体感不能由 Playwright 结果替代；这些项目必须由 owner 补偿验证。
- 自动化已验证键盘语义、可见焦点、reduced motion 和非纯颜色结构，但仍需 owner 使用真实辅助技术完成核心任务。
- 2026-08-28，`project-owner` 在明确询问批准范围后回复“只批准e6，之后先修改我说的页面修改”，并随后要求实施 E6 关闭与 E7 紧凑工作台计划。本记录据此只登记 E6 原生文件、辅助技术与长会话补偿门禁已获批准，不补写 owner 未提供的逐项数值。
- E6 据此改为 `Complete`，R-024、R-025、R-027 改为 `Mitigated`。紧凑布局作为新的 E7 候选独立验证，不反向改写本 run；Editor release-readiness 延后到 E7 evidence 获批。

## 9. E7 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E7-2026-08-28T15-02-48-298Z-78bc7f06` |
| Milestone | E7 — Compact workbench layout |
| State | `pre-revision`（44/44 自动化通过，但 2026-08-29 全屏浮层修订后不再是正式候选） |
| Implementation commit | `78bc7f06311a09948e5efae941a14599305b81a5` |
| Evidence commit | 本记录所在的 `docs: register Editor E7 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `78bc7f06311a09948e5efae941a14599305b81a5` |
| Started at | 2026-08-28 15:02:48.298 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E7 Chrome / Edge | pass / pass | 两端实测双层工具栏 `79px`、顶部控件 `30px`、point/range 行 `44px`、名称/分类列 `152/144px`、主区域圆角 `0px`、Header 后页面起点 `72px` |
| Responsive density | pass | 两端覆盖 390×844、1024×900、1280×900、1920×1080；桌面波形 `176px`，窄屏波形 `144px`；1024×900 可见工具栏、波形、tempo 与标记行 |
| Geometry / Canvas | pass | E2–E5 回归记录的最大多层时间映射误差为 `0.01 CSS px`；E6 压力 geometry 为 `0`；165 个 Canvas backing store 异常为 `0` |
| 10,000-event feedback | pass | Chrome 最大 `6.7ms`，Edge 最大 `4.5ms`；均低于 `100ms`；Editor/分析归因 `>50ms` 长任务为 `0` |
| Visible DOM / resources | pass | 固定 seed `3858767910`、10,000 events、工程 SHA-256 `1ee69629a2ea40342b503653ac31ac2c7eabad361d570c3b3d5a5be625bce5f0`；采样 DOM 为 315 point + 0 range；20 次循环后 1 Worker、1 AudioContext、1 RAF、0 Object URL、1 ResizeObserver、1 Canvas |
| E1–E6 regression | pass | E1–E5 golden/unit/integration/Chrome、E6 unit/integration/Chrome/Edge、M6 Worker/coordinator、M7–M11 适用回归全部通过 |
| M12 adjacent regression | pass | M12 unit 与真实 Chrome/Edge 动态 masonry 回归通过；稳定 DOM、最短列和资源清理契约未被 Editor 样式修改破坏 |
| Build | pass with warning | 1,845 modules；最大 JS chunk `1,285.28 kB`，既有 warning 如实保留到整体 readiness review |
| Docs / harness / typecheck / diff | pass | lifecycle links、deliberate failure detection、`vue-tsc -b`、canonical 起止 clean 与 `git diff --check` |

### Provisional and Failed-attempt History

- 最终 dirty-worktree provisional：`E7-2026-08-28T14-52-46-743Z-3fdb8ac6-provisional`，44/44 pass，summary SHA-256 `417e6ec636cdf6d6733128adf48d6df234406d6f981dc5274a9f2dfe2c3390c9`。
- 较早 provisional `E7-2026-08-28T14-41-40-086Z-3fdb8ac6-provisional` 为 42/44 step groups pass，summary SHA-256 `c471705176c585d2cf8f04bd93ba00426d649fe91d2164d62fdd1dc26f91b824`。E1 的 exact persistence-state 文本因紧凑工具栏合并而失去稳定语义边界，另有同一长序列中的 route/IndexedDB timing 与 M7 empty-workspace 瞬态失败；状态文本拆回独立 DOM 后，E1 与 M7 专项均独立通过，随后完整 provisional 与 clean canonical 全绿。失败 run 保留，不覆盖。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `43f63963fafa774ea18a8ddda290d573fd7869a269fc71798c22ca3076b14a4a` |
| 44 个排序后 `*.log` SHA-256 清单的 SHA-256 | `4c8852416e283b28f03d9f70015f1c71e92151f6a973730af43d244cc37ba176` |
| `01-E7-Chrome-compact-workbench.log` | `6ecdbf9b5b868ae737dbce1553adf3bd29bc31c034d0f22adca146cff90f8531` |
| `02-E7-Edge-compact-workbench.log` | `b9042e45330145af81b1dbf60dbec16f7fdb7dec941929953f42897c7f8f934f` |
| `03-M12-masonry-unit-regression.log` | `e87632d51a4700d1447635541345ae374320a7f4b394bb033a3c8789cc710cf2` |
| `04-M12-dual-browser-regression.log` | `05cdd6960b12cb071ad09b0ebe679235ee73f99555137ac8ef161c69b0c4204e` |
| `07-E6-Chrome.log` | `0875de5f107bcf1e1c951e4a3d592c9d5f5308bede6af5629318e2d14dbc4d9a` |
| `08-E6-Edge.log` | `775c77f56d4f47e0191b0b7469a06de078669e91c2473ea2b512a1dda335c53e` |
| `43-build.log` | `d7dc193712a6aab1286989c6464e9dc13ade8c898adf5090e9e04cbedfda3202` |
| `44-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Approval Gate

- 自动化以 computed style、DOM/Canvas geometry、真实任务状态和本地 artifact 截图固定可复现事实；FL Studio 参考图未复制进仓库，也不是像素 golden。
- 紧凑度、视觉层级、长会话可读性和真实辅助技术操作体感仍需 owner 在 Chrome 与 Edge 人工判断；自动化不能替代该视觉签字。
- E7 在 owner 批准前保持 `In Progress`，本 evidence 保持 `in-review`。不得从 44/44 自动化结果推断 E7 已关闭或包含 Editor 的 release-readiness 已创建。

## 10. Revised E7 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E7-2026-08-29T05-23-03-986Z-080f577f` |
| Milestone | E7 — Compact workbench + fullscreen overlay revision |
| State | `approved`（46/46 自动化与既有人工补偿由 owner 接受） |
| Implementation commit | `080f577fe20fcb22a20184dce0b15892c5299464` |
| Evidence commit | 本记录所在的 `docs: register revised Editor E7 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `080f577fe20fcb22a20184dce0b15892c5299464` |
| Started at | 2026-08-29 05:23:03.986 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E7 unit / integration | pass / pass | 旧草稿默认、歌曲 hash 隔离、visibility round-trip、导入不覆盖开关、关闭保留 `featureId` 且 active set 收敛为 Buffer、写失败保留内存状态 |
| E7 Chrome / Edge | pass / pass | 全视口 fixed root、`rgba(132, 136, 135, 0.28)` 灰色背景、窗口级复合入口、21 项临时菜单、Escape/焦点、pointer-through 与滚动固定均通过 |
| Density / responsive | pass | 两端工具栏 `79px`、控件 `30px`、point/range 行 `44px`、名称/分类列 `152/144px`、主区域圆角 `0px`；覆盖 390/1024/1280/1920，桌面/窄屏波形 `176/144px` |
| Fullscreen geometry | pass | 两浏览器在 1280×900 的 marker-column 横轴误差为 `0 CSS px`；纵向滚动后 root、Canvas、图形、入口和手柄 viewport 坐标不变 |
| 10,000-event feedback | pass | 固定 seed `3858767910`；Chrome 最大 sampled feedback `12.4ms`，Edge `11.2ms`；均低于 `100ms`，Editor/分析归因 `>50ms` 长任务为 `0` |
| Visible DOM / resources | pass | 10,000 events 工程 SHA-256 `1ee69629a2ea40342b503653ac31ac2c7eabad361d570c3b3d5a5be625bce5f0`；采样为 315 point + 0 range；20 次循环后保持 1 Worker、1 AudioContext、2 RAF、0 Object URL、1 ResizeObserver、1 Canvas，无单调累积 |
| Regression | pass | E1–E6、M6–M11 适用回归与 M12 unit/Chrome/Edge 均通过；旧 44/44 artifact 未改写 |
| Build | pass with warning | 1,845 modules；最大 JS chunk `1,292.23 kB`，既有 warning 如实保留到整体 readiness review |
| Docs / harness / typecheck / diff | pass | lifecycle links、deliberate failure detection、`vue-tsc -b`、canonical 起止 clean 与 `git diff --check` |

### Provisional History

- Dirty-worktree provisional `E7-2026-08-29T05-12-55-339Z-7a763a94-provisional` 46/46 通过，summary SHA-256 `d59f2e903e813d761a786ba99cbbac5ae0183cbca80ba37a649c9b2da703c66d`。
- Clean canonical 绑定独立实现 commit `080f577fe20fcb22a20184dce0b15892c5299464`；起止工作树均干净。旧 44/44 run 与其失败/provisional 历史继续保留，不覆盖。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `da7c5e7a931a1e8c6cb3a64c3eeac8f5cb7d5cc6d6b604de6e4ea7b009ec13f5` |
| `01-E7-fullscreen-overlay-unit.log` | `390b7ad73dc3a86cd9fa0bec71b1d766394693e48be8bb098103c5cb919920e3` |
| `02-E7-fullscreen-overlay-integration.log` | `13b13af5cf1196f6a3c6772c9afcc806fa3739d7bacfc293ca8ba6facdee6b84` |
| `03-E7-Chrome-fullscreen-workbench.log` | `161953579809c6cd19a73d825d2a906610c9f8862889306161d03f67150bbb4e` |
| `04-E7-Edge-fullscreen-workbench.log` | `720085922a53a57d68d1d6cdcb6d5e449ebb4c063b4b6b03f5e66f9fe540766a` |
| `09-E6-Chrome.log` | `742c4ac67c10d4d7faa1f0314a1414d25abcd50e7e015565563736515626052c` |
| `10-E6-Edge.log` | `6a8e0caf445bf74bdd8d63c264ee2ad8233f65af7f72226e8a390483698213b7` |
| `45-build.log` | `ea0e5ebf2db68e00649528d541f9c9ac51f5b9918de8c203ebe1a974dc224431` |
| `46-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Boundary and Approval

- 自动化证明 fixed geometry、计算样式、21 项菜单、开关/刷新记忆、Buffer-only 收敛、pointer-through 和双浏览器回归；它不能替代 owner 对灰色覆盖强度、图形可读性、底层操作体感和真实辅助技术的判断。
- 2026-08-31，owner 在明确要求先关闭 E7 再实施 M13 的计划上回复“PLEASE IMPLEMENT THIS PLAN”，接受本记录已有的 46/46、artifact 与人工补偿并关闭 E7；该批准不补写 owner 未提供的逐项人工数值。
- E7 为 `Complete`，本 evidence 为 `approved`；M13 仅改变 Analyzer，不重开 Editor 候选。

## 11. E8 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E8-2026-09-03T04-07-28-904Z-84d9435c` |
| Milestone | E8 — Timeline, recovery and marker usability |
| State | `approved`（25/25 自动化与 owner 人工门禁均通过） |
| Implementation commit | `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` |
| Evidence commit | 本记录所在的 `docs: register Editor E8 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `84d9435cc6e8d1edb0932ff1b8dcd1b84dff32b5` |
| Started at | 2026-09-03 04:07:28.904 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E8 unit / integration | 5/5 + 2/2 pass | `88px/72px` 垂直几何、6px 安全区、exact-route 纯恢复决策、异歌显式入口、迟到 route generation 与草稿原子性 |
| E8 Chrome / Edge | 3/3 + 3/3 pass | 四视口、Canvas DPR、同歌正确/错误重选、保持 paused、异歌 CTA accessible name 与显式 `router.replace` |
| Timeline density | pass | 390/1024/1280/1920 的 stage 为 `72/88/88/88px`；波形上下保留 6px，边界控件未溢出 |
| Marker geometry | pass | 两浏览器最大 marker/diamond/candidate/pin X 误差 `0.009375 CSS px`；marker Y `0.5px`，diamond Y `0px`，均低于 `1 CSS px` |
| E7 regression | pass | unit 2/2、integration 4/4、Chrome/Edge 各 2/2；overlay geometry `0 CSS px`，工具栏 79px、point/range 行 44px |
| E3 regression | pass | golden、unit 6/6、integration 4/4、Chrome 7/7；输入反馈 `29.9ms`、geometry `0 CSS px` |
| E2 regression | pass | golden、unit 5/5、integration 17/17、Chrome 5/5；输入反馈 `3.5ms`、geometry `0.01 CSS px` |
| E1 / M5 regression | pass | E1 unit 9/9、integration 8/8、Chrome 4/4；M5 Chrome 恢复 3/3 |
| Docs / harness / typecheck | pass | lifecycle links、deliberate failure detection、`vue-tsc -b` |
| Build | pass with warning | 1,871 modules；最大 JS chunk `1,426.08 kB`，既有 chunk warning 如实保留 |
| Diff / identity | pass | canonical 起止均为同一 clean commit；`git diff --check` exit 0 |

E8 Chrome/Edge 测试均捕获 `pageerror` 和异常 console 并要求为空。runner stderr 中的 browserslist stale 与 Vite 大 chunk 提示属于已知工具链 warning，不被误记为页面错误或静默忽略。

### Provisional History

- 最终 dirty-worktree provisional：`E8-2026-09-03T04-04-25-163Z-10a2bc0c-provisional`，25/25 pass，summary SHA-256 `829e50c177b14bb81febc81577c179deec0a01d703362083ebf2fa28bc7e5c0a`。
- `E8-2026-09-03T03-41-39-925Z-cc83d8b1-provisional` 25/25 pass，summary SHA-256 `5df5b2b7a5f57d30e661c910dcf5d0cbe16b162edfa824162e72226308ab26b5`，保留为 V5/E8 分离提交前反馈。
- 更早的两个 provisional 分别暴露并修正 recovery signature 合并和 candidate box 中心几何；它们不覆盖最终 provisional 或 canonical，也不登记为正式 evidence。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `ba9ff8db30868c8bf34140a3db2bf8cd7e3d56557ca7ac8682dfa6c3ce664a42` |
| `01-E8-usability-unit.log` | `caffa81d07dfe828d00d3ac64dd439f514622a25fa19f4a29ed3a95376814f95` |
| `02-E8-recovery-integration.log` | `99cfe372b6eabe3c8b9cf85e6a48edee23da6dc829daa4db3492021e6bd34523` |
| `03-E8-Chrome-usability.log` | `e577b2a9a6ce594d5cc19ce097597c48d1de2698b44d18a0183b4f742f41f796` |
| `04-E8-Edge-usability.log` | `2b33ca244459176db35bfb33607d0f58e226a75e06a4703735bb5567568d7ad7` |
| `05-E7-overlay-unit-regression.log` | `d4fa967977f02552d319f5c41a54c07729a0357b966a22faddc5198c67b5068f` |
| `06-E7-overlay-integration-regression.log` | `9953a0c15aff99222c164e5e4fa2365a9ca229218a6180e9390f62c4d4cdce0b` |
| `07-E7-Chrome-workbench-regression.log` | `a4dc8cd1e8993e6d95801e0fede285bbd263c1833ac7f631b96605bdc4d5e8f2` |
| `08-E7-Edge-workbench-regression.log` | `f43da4367a873578504a7e0905d43d79d0bec14cfc3ce7d0b267dd6340ad868c` |
| `09-E3-point-golden-regression.log` | `f31f700d278cf3e4cf7ae1e43893e6bc0535de6c0ebf672b1d76aa3efc943fc6` |
| `10-E3-point-unit-regression.log` | `3b5d35201dce231194933a99d87db5dc892f070d95e09ef329d11c412f0f575b` |
| `11-E3-point-integration-regression.log` | `a100a9991eb798830d2adc901fadee3403cee3e3f60ab17742daf592c6f03a57` |
| `12-E3-Chrome-point-regression.log` | `ea13c3c143be37102b3af5c0912faf66e36eddced8e76339ac648f1e81c448e9` |
| `13-E2-tempo-golden-regression.log` | `2aa9988e158f22c4f25da1fc726f46aebc40cdb50002e02a4968896a28263cb2` |
| `14-E2-timeline-unit-regression.log` | `25f4eb38a54e8e965ad45bcc1046922cf4837750220163fcbf1a6c310d11a878` |
| `15-E2-timeline-integration-regression.log` | `75ba26e4d77dfe39b347a1e162145f30da904763096519847a437b159a11c177` |
| `16-E2-Chrome-timeline-regression.log` | `29c66b8a5716887ad874a438277dcf01d61345e2cb3b5e3da5b722f418fb3fac` |
| `17-E1-project-unit-regression.log` | `60a0432437dbf8149542717f2568e1edc733acc231510f1f1e0f739c059a74b1` |
| `18-E1-foundation-integration-regression.log` | `e429360413a35e36be97db39960890ac71713ed9d48f94d12211c84965a3371a` |
| `19-E1-Chrome-route-regression.log` | `54b018db26ba2ffa7dc81963557d5a6e6bf50c64b65fa6112f67596263b2adfa` |
| `20-M5-recovery-regression.log` | `9d25555567d9449d7fcecf4932106286c7e38ec1a6338d99b35f5085d81dc43e` |
| `21-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `22-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `23-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `24-build.log` | `526fcb5d7a9186d3888aff4655c81895f37096458a305045cc63001bc499d6cb` |
| `25-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Boundary and Approval Gate

- 自动化证明 DOM/Canvas 几何、同歌恢复保持 paused、异歌不静默切换、accessible name 与双浏览器回归；它不能替代 owner 对 72/88px 密度、波形可读性、marker/stem 视觉中心和真实文件重选操作的判断。
- owner 人工边界包括：桌面/窄屏波形密度可接受；正确同歌重选后不自动播放；异歌入口文案与返回行为清晰；point marker、候选框和 stem 在实际缩放下易辨识。
- 2026-09-03，owner 要求评估 E8 是否可关闭并授权在满足时批准。审计确认 clean identity、25/25 结果、artifact hash、四视口密度、paused 恢复、显式异歌切换与 marker 几何均满足已批准门禁；owner 据此批准 canonical 与上述人工边界，不补写未提供的额外主观数值。
- E8 为 `Complete`，R-022/R-024/R-025 为 `Mitigated`。Editor 整体 readiness 仍需独立 review，本批准不自动推定 readiness。

## 12. E9 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E9-2026-09-04T02-49-18-960Z-cf0a79b1` |
| Milestone | E9 — Tempo lane and marker interaction |
| State | `pre-revision`（29/29 自动化通过；DEC-052 紧凑条修订后不再是正式候选） |
| Implementation commit | `cf0a79b176d99eb183368818ce90ac5731d1cfa8` |
| Evidence commit | 本记录所在的 `docs: register Editor E9 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `cf0a79b176d99eb183368818ce90ac5731d1cfa8` |
| Started at | 2026-09-04 02:49:18.960 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E9 unit / integration | 9/9 + 4/4 pass | 首/内部/未知/连续删除、前段延伸、ID/设置稳定、full/summary/hidden 临界宽度、共享 time↔x；JSON V1、单草稿原子替换及 point/range 秒值稳定 |
| E9 Chrome / Edge | 3/3 + 3/3 pass | 专用 BPM 轨道、三级展示、右键/Delete 删除、错误草稿清理、刷新恢复、首尾固定边界、分类按钮、3px candidate、单 divider、reduced motion 与页面错误检查 |
| Shared geometry | pass | 两浏览器均覆盖 390/1024/1280/1920 与 DPR 1/2；波形、BPM 轨道和内部 caret 最大误差 `0.009375 CSS px`，低于 `1 CSS px` |
| Shared scrolling | pass | 390px 外层 EditorTimeline `scrollLeft=120` 且 `overflow-x:auto`；BPM stage `scrollLeft=0`、`overflow-x:hidden`；共享容器 computed `scrollbar-width:thin` |
| Presentation / accessibility | pass | full、summary、hidden 随自然内容宽度切换且不换行；输入错误使用 `aria-invalid/aria-describedby` 和公共 `aria-live`；内部边界可聚焦并响应 Delete |
| Route resources | pass | Chrome/Edge 各 10 次 Editor/Analyzer 往返；live ResizeObserver 始终为 3，live Canvas 始终为 4，无单调累积 |
| E8 25-step baseline | 25/25 pass | E8/E7/E3/E2/E1/M5、docs、Harness、typecheck、build 与 diff check 全部通过；E1–E8 历史 artifact 未改写 |
| Build | pass with warning | 1,871 modules；最大 JS chunk `1,432.66 kB`，既有 Vite chunk warning 如实保留 |
| Identity | pass | canonical 起止均为同一 clean implementation commit；summary 记录 `result: pass`，`git diff --check` exit 0 |

E9 Chrome/Edge 专项均捕获 `pageerror` 和异常 console 并要求为空。Browserslist stale 与 Vite chunk size 属于 runner/toolchain warning，不是页面运行错误。

### Provisional History

- 最终 dirty-worktree provisional：`E9-2026-09-04T02-45-05-001Z-b046ab53-provisional`，29/29 pass，summary SHA-256 `df3ab895935fa5c148321813bb2c8488f7c0909f02189dab178d0b9ae073f35c`。
- provisional 绑定当时 dirty worktree，只用于进入 implementation commit；正式 canonical 绑定 `cf0a79b176d99eb183368818ce90ac5731d1cfa8`，两者身份未混用。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `d4c15f6801e6df4289dad97b816036a095a21e5781a314f1f3166ab663f3ca4a` |
| `26-E9-tempo-lane-unit.log` | `a12d4ee2ec9c2bc41a91a9370d0ba395a002f87fde4a980226d7d19142a124a4` |
| `27-E9-persistence-integration.log` | `95977f836dea427e5db9c89a46b5b2560fa7b0aba7a69099cfab979273d9a495` |
| `28-E9-Chrome-tempo-lane.log` | `836cd5500289fab6febae06b461837213d807a90c15fc3b680bf5c4df97cf267` |
| `29-E9-Edge-tempo-lane.log` | `ef2e2baeb38773d226c08e9e115934f0b54e5321e83b202322eeb7a2bed393c6` |
| `24-build.log` | `d68ed42693f0075d5c203636733a9ea91b171fd7dd590587c81c99c48004c3fb` |
| `25-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Revision Boundary

2026-09-04，owner 在人工门禁中要求把独立 66px tempo row 改为紧贴波形的 28px BPM 标记条，辅助线只向上指向波形，移除重复左 rail，并将 BPM/拍号改为 11px 无框行内编辑。该变化影响 DOM 拓扑、geometry、presentation threshold 与视觉验收，因此本 run 保留为 `pre-revision`，artifact 和 hash 不删除、不改写；修订版候选仍执行 29 步。

### Manual Boundary and Approval Gate

- 自动化证明 DOM/Canvas 几何、共享滚动、删除事实、草稿恢复、计算样式与双浏览器资源基线；它不能替代 owner 对分类按钮视觉居中、candidate 竖线辨识度、BPM 轨道信息密度、三级缩放观感和右键删除直觉性的判断。
- Owner 需在 Chrome/Edge 确认：“+分类”双轴居中；候选为单一绿色竖线；BPM caret/时间/输入与波形直观对齐；缩放时 full/summary/hidden 合理；右键删除为前段延伸；板块间只有一条横线。
- 本记录继续为 `pre-revision`，且 artifact/identity 不改写。第 13 节 revised canonical 已获 owner 批准，E9 为 `Complete`、R-042 为 `Mitigated`，Editor release-readiness 已开放。

## 13. Revised E9 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E9-2026-09-04T03-51-33-088Z-13614673` |
| Milestone | E9 — Compact BPM strip revision |
| State | `approved`（29/29 自动化与 owner 人工门禁均通过） |
| Implementation commit | `13614673bbf4d824f2ee109d36e04de6b3f8aabd` |
| Evidence commit | 本记录所在的 `docs: register revised Editor E9 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `13614673bbf4d824f2ee109d36e04de6b3f8aabd` |
| Started at | 2026-09-04 03:51:33.088 UTC |
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

### Results and Traceability

| Step group | Result | Evidence |
| --- | --- | --- |
| E9 unit / integration | 10/10 + 4/4 pass | 首/内部/未知/连续删除、前段延伸、ID/设置稳定、紧凑 full/summary/hidden 临界宽度、共享 time↔x；JSON V1、autosave、stale cleanup 与 point/range 秒值稳定 |
| E9 Chrome / Edge | 3/3 + 3/3 pass | 390/1024/1280/1920、DPR 1/2、三级展示、右键/Delete 删除、刷新恢复、分类按钮、3px candidate、单 divider、reduced motion 与页面错误检查 |
| Compact geometry | pass | 两浏览器均为 strip/status `28px`、waveform gap `0`、caret gap `0`、guide `1×12px`、guide bottom error `0`、重复 tempo rail `0`；最大 boundary X 误差 `0.009375 CSS px` |
| Shared scrolling | pass | 390px outer EditorTimeline `scrollLeft=120`、`overflow-x:auto`、`scrollbar-width:thin`；BPM strip `scrollLeft=0`、`overflow-x:hidden`，不存在第二滚动状态 |
| Presentation / accessibility | pass | BPM/拍号 11px 同基线、18px 透明无框输入；focus/invalid 才显示绿色边线；来源只在 accessible name/title；内容不换行 |
| Route resources | pass | Chrome/Edge 各 10 次 Editor/Analyzer 往返；live ResizeObserver 始终 `3–3`，live Canvas 始终 `4–4` |
| E8 25-step baseline | 25/25 pass | E8/E7/E3/E2/E1/M5、docs、Harness、typecheck、build 与 diff check 全部通过；历史 artifact 未改写 |
| Build | pass with warning | 1,871 modules；最大 JS chunk `1,433.62 kB`，既有 Browserslist/Vite chunk warning 如实保留 |
| Identity | pass | canonical 起止均为同一 clean implementation commit；summary 为 `pass`，`git diff --check` exit 0 |

Chrome/Edge E9 专项均捕获 `pageerror` 和异常 console 并要求为空。工具链 stale/chunk warning 不属于页面运行错误。

### Provisional History

- Revised dirty-worktree provisional：`E9-2026-09-04T03-47-53-947Z-951824c6-provisional`，29/29 pass，summary SHA-256 `bf643e6f5551da90fc58c064f6420301c3c34d824a9810358120a577be791365`。
- provisional 只用于实现反馈；正式 canonical 绑定 clean commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd`。第 12 节 pre-revision artifact、identity 和 hash 未改写。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `a9d195fba7715213366068143a12977600e5e166b93064cd532012ff7f992b7c` |
| `26-E9-tempo-lane-unit.log` | `d962a16c1f8e20d0f812315f96e96c71ae23611e8c361d435367814c5a44e0ad` |
| `27-E9-persistence-integration.log` | `b1b3b48c2f77b51f6f64c4d0a9915d86d4c8a21497c84812ffec7e3553828312` |
| `28-E9-Chrome-tempo-lane.log` | `f7b55d5ac5a8597641aa31b8b03e18233449d6c0b33c8ba6a82ddb799a1ffd39` |
| `29-E9-Edge-tempo-lane.log` | `bace652ebbbe996cebafca7c65ebdbd9fa375828d627e5692621bcc959701592` |
| `24-build.log` | `2a0d8c4c9daf1ea6d18548c06f7fd5393d620840a4e6e9613b5c7b87b9db698a` |
| `25-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Boundary and Approval Gate

- 自动化证明紧凑拓扑、共享坐标/滚动、删除事实、恢复、计算样式与资源基线；不能替代 owner 对信息密度和实际交互体感的判断。
- `project-owner` 于 2026-09-04 批准已有修改，并通过完整关闭计划确认：BPM 条融入波形、caret/guide 方向、11px 无框输入、重复左标签移除、共享滚动、full/summary/hidden、前段延伸删除、分类按钮、candidate 和单 divider 人工门禁通过；不补写未提供的主观数值。
- DEC-053 据此保持 canonical identity、artifact 与 hash 不变且无需重跑；E9 为 `Complete`、本 evidence 为 `approved`、R-042 为 `Mitigated`，并开放独立 Editor release-readiness 评审。第 12 节旧 run 继续为 `pre-revision`。

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
