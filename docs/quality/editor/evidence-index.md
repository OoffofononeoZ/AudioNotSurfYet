---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/quality/editor/golden-examples.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/quality/editor/e3-eval-plan.md"
  - "docs/delivery/editor/milestone-plan.md"
next_action: "定义并执行 E3 point annotation eval；批准前 E4 保持 Planned"
---

# Editor Evidence Index

## 1. Current Gate

- E0-D：`Complete`。
- E1：`Complete`。
- E2：`Complete`。
- E3：`In Progress`。
- E4–E6：`Planned`。
- E1 clean canonical 与 owner 人工门禁均已批准；Analyzer M3–M11 evidence 仍不能替代未来 Editor 里程碑证据。
- E2 clean canonical 与 owner 门禁已于 2026-08-27 获批；E3 已开放，但其证据仍须独立建立。

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
