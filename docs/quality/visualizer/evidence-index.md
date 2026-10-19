# Visualizer 历史证据索引

整理核查日期：2026-10-19。本次只核对和精简既有记录，未重跑历史评估。

本页 V1–V6 是历史里程碑编号，不是当前 schemaVersion；当前工程为 Project V4，输出为离线导出。旧场景、pause-at-end 和实时 WebM 的历史通过记录不作为当前接口。

V1–V6 先后获批。V5 于 2026-09-03 批准默认 720p30 回放、静音音轨、原生保存/取消/重试；V6 于 2026-09-04 批准完整人工制作、长会话、键盘/焦点及 context 清理。自动化不替代真实 OS/辅助技术/视觉结论，也不把未测 optional 档位记为通过。

viewport/fullscreen 修订、当前未完成视觉确认和 PROD-015 见 [readiness](release-readiness.md)；原始输出测量见[输出说明](../../context/visualizer-output.md)。

## 记录边界

- 下列结果、环境、保留状态均是原运行时的登记，本次未重新确认本地产物是否仍存在。
- 仅保留 canonical 身份、环境、批准来源和关键媒体 hash；重复步骤/日志清单与已结束调试过程可用 Git 查看整理前的 `ac25c2a:docs/quality/visualizer/evidence-index.md`。原始 artifact 不改名、不覆盖、不删除。
- summary hash、候选 commit 和 run 必须共同匹配，历史 pass 不证明当前源码、其他设备、整体 readiness 或生产发布。

## V1 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V1 — Workspace foundation |
| State | `approved`（以本节后续 owner 批准为准） |
| Implementation commit | `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` |
| Evidence commit | `4cb05c1462de6efd12cddcbe890c52332c18a164` |
| Run ID | `V1-2026-09-02T07-03-26-973Z-fd44c892` |
| Canonical result | 21/21 passed |
| Clean identity | start/end commit 均为 `fd44c8921a534c22b2362ccffff7ec9e46f3ff02`；start/end dirty 均为 `false` |
| Summary SHA-256 | `14c9ed2258baf6c9a2a3a20dfcaba65a0c643029f8510a1d9e4c6662c9c90300` |
| Artifact root | `artifacts/evals/V1-2026-09-02T07-03-26-973Z-fd44c892/` |
| Reviewer | `project-owner` — approved 2026-09-02 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Analysis / test runtime | Meyda 5.6.3 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

2026-09-02，`project-owner` 明确回复：

`我批准 Visualizer V1 canonical evidence、工作台、pause-at-end lease、JSON V1 与草稿恢复结果；同意将 V1 标记为 Complete 并开放 V2。`

## V2 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V2 — Data binding |
| State | `approved`（以本节后续 owner 批准为准） |
| Implementation commit | `769faafeef576bf9b98a95f6904cdb9886298530` |
| Evidence commit | `157bc2e1e70e390bf82b582f47a57d41fc7c218f` |
| Run ID | `V2-2026-09-02T08-46-21-778Z-769faafe` |
| Canonical result | 26/26 passed |
| Clean identity | start/end commit 均为 `769faafeef576bf9b98a95f6904cdb9886298530`；start/end dirty 均为 `false` |
| Summary SHA-256 | `18b7d83d68f068ac615c56e1bb844a3c80bb1460ac884116d94cb460dd07bafb` |
| Artifact root | `artifacts/evals/V2-2026-09-02T08-46-21-778Z-769faafe/` |
| Reviewer | `project-owner` — approved 2026-09-02 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Analysis / test runtime | Meyda 5.6.3 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

2026-09-02，`project-owner` 明确回复：

本批准关闭 V2、开放 V3，并接受现有 canonical evidence；不补写批准原文未提供的人工观察值，也不构成 V3/V4 场景、V5 WebM、V6 readiness 或生产上线通过。

## V3 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V3 — Orthogonal Lines |
| State | `approved`（以本节后续 owner 批准为准） |
| Implementation commit | `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` |
| Evidence commit | `9aa6e1bd8f1bb971d3b4dd5a61e3a1380ef0a2ae` |
| Run ID | `V3-2026-09-02T13-32-42-513Z-89be30eb` |
| Canonical result | 30/30 passed |
| Clean identity | start/end commit 均为 `89be30eb23d4e53d2c38f24e111cd1af7ec0840d`；start/end dirty 均为 `false` |
| Summary SHA-256 | `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84` |
| Artifact root | `artifacts/evals/V3-2026-09-02T13-32-42-513Z-89be30eb/` |
| Reviewer | `project-owner` — approved 2026-09-03 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Render / analysis / test runtime | Three.js 0.183.2 / Meyda 5.6.3 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

已批准。`project-owner` 原文：

`我批准 Visualizer V3 canonical evidence、Orthogonal Lines 场景、确定性余辉与单 RendererHost 结果；同意将 V3 标记为 Complete 并开放 V4。`

## V4 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V4 — Cube Swarm |
| State | `approved`（以本节后续 owner 批准为准） |
| Core feature commit | `9581730498a470e3fbd81c97414cb26087714009` |
| Canonical implementation commit | `5c2d24a3f1f413dba236563b3686237c6b8f2e21` |
| Evidence commit | `5f4a8ca3666fa75112a7489aa975c7022ef0310a` |
| Run ID | `V4-2026-09-02T17-47-40-271Z-5c2d24a3` |
| Canonical result | 34/34 passed |
| Clean identity | start/end commit 均为 `5c2d24a3f1f413dba236563b3686237c6b8f2e21`；start/end dirty 均为 `false` |
| Summary SHA-256 | `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2` |
| Artifact root | `artifacts/evals/V4-2026-09-02T17-47-40-271Z-5c2d24a3/` |
| Reviewer | `project-owner` — approved 2026-09-03 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Render / test runtime | Three.js 0.183.2 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

`project-owner` 于 2026-09-03 明确批准关闭 V4 并开放 V5。该批准接受既有 34/34 canonical 与人工门禁，不补写用户未提供的额外观察值；V4 标记为 `Complete`，R-039 按剩余录制风险保持 `Open`。

## V5 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V5 — Realtime WebM export |
| State | `approved`（以本节后续 owner 批准为准） |
| Implementation commit | `9b5af09c5846415a8e5465e710e6095f1e7db310` |
| Evidence commit | `10a2bc0c7a30413d80689ed41dc98caae33ec21f` |
| Run ID | `V5-2026-09-03T03-49-31-211Z-9b5af09c` |
| Canonical result | 40/40 passed |
| Clean identity | start/end commit 均为 `9b5af09c5846415a8e5465e710e6095f1e7db310`；start/end dirty 均为 `false` |
| Summary SHA-256 | `cec1fab0310852458c2aa4fbd3bebc90eee3e213a54b7695a524736e07b07b7b` |
| Artifact root | `artifacts/evals/V5-2026-09-03T03-49-31-211Z-9b5af09c/` |
| Reviewer | `project-owner` — approved 2026-09-03（V5 后续批准） |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Media / render / test runtime | FFmpeg/ffprobe 8.1.2 / Three.js 0.183.2 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

2026-09-03，`project-owner` 明确“批准 V5”，并以实施计划确认该批准覆盖上列人工边界。canonical identity、artifact 和 hash 保持不变且无需重跑；本批准不构成 V6、整体 readiness 或生产上线通过。

### Canonical Media Hashes

| Browser / scene | WebM SHA-256 |
| --- | --- |
| Chrome / Orthogonal Lines 720p30 | `612abd2826afdfcbe7ac407872984954c677d35e42991d05dfa84fcccf183316` |
| Chrome / Cube Swarm 720p30 | `01efc152c230748eabc594db527ca7ce1a343a85af71f98d0b7c837d7a73601f` |
| Edge / Orthogonal Lines 720p30 | `d9a8a61fa4df268dad88be55bf194b3f60141fb80d64413e0f6dd77e66a8a9f7` |
| Edge / Cube Swarm 720p30 | `2863587dd2556d962dd183ce7bcee4aea19e0469059e233222b89ebef9431978` |
| `media/sync-report.json` | `dffd4820ec3b2640d23ee7a0c91953e5ba6f6dea09368fa74b784f346b13575d` |

## V6 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V6 — Final hardening |
| State | `approved`（以本节后续 owner 批准为准） |
| Implementation commit | `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` |
| Evidence commit | `636e4d2defeb90147e949bcf20b7b0690dd77424` |
| Run ID | `V6-2026-09-03T16-33-03-497Z-ef12ce39` |
| Canonical result | 54/54 passed |
| Clean identity | start/end commit 均为 `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd`；start/end dirty 均为 `false` |
| Summary SHA-256 | `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014` |
| Artifact root | `artifacts/evals/V6-2026-09-03T16-33-03-497Z-ef12ce39/` |
| Reviewer | `project-owner` — approved 2026-09-04 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Media / render / test runtime | FFmpeg/ffprobe 8.1.2 / Three.js 0.183.2 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

2026-09-04，`project-owner` 明确要求“先完成并且批准和关闭 V6”，并批准本关闭计划实施。该批准覆盖上列人工制作、原生保存/回放、键盘/焦点、长时操作与 context 清理边界；canonical identity、artifact、summary 与媒体 hash 保持不变且无需重跑。本批准不构成整体 release readiness 或生产上线批准。

### Canonical Media Hashes

| Browser / format / scene | WebM SHA-256 | Avg fps / max packet gap |
| --- | --- | --- |
| Chrome / MP3 / Cube Swarm 720p30 | `7e5346b1d1bf53425b15a45d9a7c239c07f006419c5de65eb68452033981efdc` | 29.353 / 76ms |
| Chrome / WAV / Orthogonal Lines 720p30 | `f7765b1f336dd343b10cd94fa0fe88b280101dea1ef578936747b1c1f286d0e5` | 30 / 41ms |
| Chrome / FLAC / Orthogonal Lines 720p30 | `049dcf587ee01ca657088eb44be6568ac8b7f67d0ec7a84aaa6bcc4d29abda27` | 29.907 / 56ms |
| Edge / MP3 / Cube Swarm 720p30 | `667c0af7c1e4400810d13e130352f36a6f221b8c7b7bf5034653d9077bb3b9f5` | 29.337 / 98ms |
| Edge / WAV / Orthogonal Lines 720p30 | `c272f2c5326ad602d38a38d6af5ea4f63c359d60bc4e7d8331680d7865ec5458` | 30 / 39ms |
| Edge / FLAC / Orthogonal Lines 720p30 | `853b024e8962c317817eca30f4555e89e1d8cdc17819cb5e1f973226221ee9cd` | 29.970 / 51ms |
| `media/v6-media-report.json` | `5b92aa5e7d42e020dd808790f814deabba3e8e901f879717613a6f86f35e91e6` | threshold/result record |
| Chrome capability matrix | `6026215eb386dd6aa14d540e82e47cefb77992a7a012fed60c7db64cc24d976f` | three formats + resources |
| Edge capability matrix | `5966030b8dd65b267d64b32a9527ffd70614e6e5afa0e784c968c705e8051ebf` | three formats + resources |
