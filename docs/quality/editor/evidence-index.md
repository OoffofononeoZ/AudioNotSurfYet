---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-27
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/quality/editor/golden-examples.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/quality/editor/e3-eval-plan.md"
  - "docs/quality/editor/e4-eval-plan.md"
  - "docs/quality/editor/e5-eval-plan.md"
  - "docs/quality/editor/e6-eval-plan.md"
  - "docs/delivery/editor/milestone-plan.md"
next_action: "执行并登记 E6 40 步双浏览器 canonical；人工补偿获批前 E6 保持 In Progress"
---

# Editor Evidence Index

## 1. Current Gate

- E0-D：`Complete`。
- E1：`Complete`。
- E2：`Complete`。
- E3：`Complete`。
- E4：`Complete`。
- E5：`Complete`。
- E6：`In Progress`。
- E1 clean canonical 与 owner 人工门禁均已批准；Analyzer M3–M11 evidence 仍不能替代未来 Editor 里程碑证据。
- E2 clean canonical 与 owner 门禁已于 2026-08-27 获批。
- E3 clean canonical 与 owner 人工门禁已于 2026-08-27 获批；E4 clean canonical 与 owner 人工门禁随后获批。
- E4 clean canonical 31/31 与 owner 人工门禁已于 2026-08-27 获批；E5 已开放。
- E5 clean canonical 35/35 与 owner 人工范围任务已于 2026-08-27 获批；E6 已开放。

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
