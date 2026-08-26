---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/quality/editor/eval-plan.md"
  - "docs/quality/editor/golden-examples.md"
  - "docs/quality/editor/failure-taxonomy.md"
  - "docs/delivery/editor/milestone-plan.md"
next_action: "owner 复核 E1 canonical 与人工缺口；批准前 E1 保持 In Progress，E2 保持 Planned"
---

# Editor Evidence Index

## 1. Current Gate

- E0-D：`Complete`。
- E1：`In Progress`。
- E2–E6：`Planned`。
- E1 clean canonical 已通过并登记，但 reviewer 状态仍为 `in-review`；Analyzer M3–M11 evidence 不能替代 Editor 人工审批。

## 2. Record Contract

每个 E 里程碑记录：run ID、实现 commit、证据 commit、clean identity、浏览器/Node/npm、非敏感硬件摘要、步骤 pass/fail、provisional 关联、日志/summary SHA-256、失败分类、未自动化项目和 reviewer 状态。原始 artifact 保存在 Git 忽略目录直到 owner 审批完成。

## 3. E1 Canonical Record

| Field | Value |
| --- | --- |
| Run ID | `E1-2026-08-26T15-24-21-043Z-792b424f` |
| Milestone | E1 — Entry, playback and project foundation |
| State | `pass`（18/18 自动化；owner review pending） |
| Implementation commit | `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` |
| Evidence commit | 本记录所在的 `docs: register Editor E1 canonical evidence` 提交 |
| Dirty at start / end | `false` / `false` |
| Commit at end | `792b424fbab8e3621ad24d8c9add47d1c9bffcb4` |
| Started at | 2026-08-26 15:24:21.043 UTC |
| Method | `npm run eval:e1` |
| Reviewer | `project-owner` — pending |
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
- owner 尚未完成本轮人工任务，因此 E1、E1 quality 文档和本 evidence 均保持 `in-review`，R-022/R-023/R-027 不因自动化通过而提前关闭，E2 保持 `Planned`。
