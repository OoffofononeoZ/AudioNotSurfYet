---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-01
upstream_docs:
  - "docs/quality/eval-plan.md"
  - "docs/quality/golden-examples.md"
  - "docs/quality/failure-taxonomy.md"
  - "docs/delivery/milestone-plan.md"
  - "tests/fixtures/fixture-manifest.json"
next_action: "M13 canonical 已批准；保留 artifact，候选行为变化时重新评估"
---

# Evidence Index

## Scope Routing

本文保留 Analyzer M3–M12 历史 evidence，并登记当前 M13 21 卡/FIFO 候选；Editor 使用独立 [Editor evidence index](editor/evidence-index.md)。

## 1. Purpose and Gate State

本文件保存受版本控制的长期证据摘要；原始日志保存在 Git 忽略的本地 artifact 目录。M13 clean canonical 已在实现 commit 上 17/17 通过，并按 owner 的“自行提交并完成后续”授权登记为 `approved`。PROD-015 继续阻断生产上线。

每条 `pass` 只证明对应里程碑的适用子集在被记录的 commit 和环境上可复现。它不表示完整 EV-A–EV-R、未执行里程碑、Edge 矩阵或 release readiness 已通过。

## 2. M3 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M3-2026-07-28T06-39-59-221Z-17d16f0d` |
| Milestone | M3 — Test foundation and fixtures |
| State | `pass`（仅 M3 test-foundation scope） |
| Eval IDs | EV-A、EV-J、EV-D、EV-B、EV-R 的 M3 适用子集 |
| Commit | `17d16f0da37289c1f67f75203502beef999572ea` |
| Dirty at start | `false` |
| Started at | 2026-07-28 06:39:59.221 UTC |
| Method | `npm run eval:m3` |
| Reviewer | `project-owner` — approved 2026-07-28 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M3-2026-07-28T06-39-59-221Z-17d16f0d/` |
| Summary SHA-256 | `edef2dde7f580ddea60ff76b9735f150d287bec77c314214f7a462b9cf71a0a6` |
| Failure | 无；Edge 缺失是 EG-003 evidence gap，不是 failure instance |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `150.0.7871.187` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

### Fixture and Golden Identity

所有音频均由 `m3-audio-fixtures-v1` 确定性生成，采样率 48kHz、单声道，许可为 CC0-1.0；完整 provenance 和编码参数见 [fixture manifest](../../tests/fixtures/fixture-manifest.json)。

| Fixture ID | Format / purpose | SHA-256 |
| --- | --- | --- |
| `format-master-pcm-v1` | Float32LE PCM master | `fb49bd0318a6d6e4cb5b4247bee9a8381e1fd083239dc260a8d2e0f26097e1cb` |
| `format-master-wav-v1` | WAV compatibility | `13ece6c2c1f5c441ef3e6376dc765eea65fe57ece5f2c6dcdcbea1cd2fcacb84` |
| `format-master-mp3-v1` | MP3 compatibility | `8f83304411c6d19de6db279f361a2568087c339d3eaf8312fa6f6a59da3b8771` |
| `format-master-flac-v1` | FLAC compatibility | `720fd727757f758c3b89b0ab3c59227c97255763a89c6882e49e290612380a25` |
| `first-slice.v1` | RMS、Amplitude Spectrum、Chroma direct-Meyda golden | `5e1e6724fc696414893d2b69145881f1e5141f1b1bb81753c435b70af6137209` |

## 3. Results and Traceability

| Step | Result | M3 measurement | Eval / risk trace |
| --- | --- | --- | --- |
| Fixture hashes | pass | 5/5 manifest、hash、字节与 ffprobe checks | EV-A、EV-B；R-008、R-009、R-016 |
| Unit | pass | 12/12；PCM、tolerance、isolated IndexedDB | EV-A、EV-D；R-005、R-006、R-007、R-008、R-010 |
| Worker harness | pass | 3/3；transfer、cancel、error | EV-J；R-002、R-003 |
| Analysis golden | pass | 2/2；committed golden identity 与批准容差 | EV-A；R-008、R-009、R-010、R-011 |
| Docs | pass | lifecycle frontmatter/links；feature source count 21 | EV-A、EV-R；R-019 |
| Deliberate failure | pass | harness 正确检测 child exit 1 | EV-R；R-019 |
| Typecheck | pass | `vue-tsc -b` exit 0 | EV-A、EV-J、EV-D |
| Chrome E2E | pass | 5/5；app smoke、真实 IndexedDB/Worker、WAV/MP3/FLAC | EV-J、EV-D、EV-B；R-003、R-008、R-009、R-016 |
| Build | pass with warning | 1803 modules；最大 JS chunk 1,012.69 kB | EV-R；R-017 |
| Diff check | pass | `git diff --check` exit 0 | EV-R；R-019 |

以上风险关联只表示 M3 证据覆盖到相应风险的一部分，不关闭 architecture risk。M3 使用测试专用 Worker 和 IndexedDB harness，不代表 M5/M6 产品实现已经存在。

## 4. Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `edef2dde7f580ddea60ff76b9735f150d287bec77c314214f7a462b9cf71a0a6` |
| `01-fixture-hashes.log` | `bcea186388adbdea9b698d62eeeabfe364c108495e93441009693a970dda96b8` |
| `02-unit.log` | `92d3ad100fb6bf7c5480a149f0f07b6d6a34c7cbd9dc913d3e0a92a7bb474e15` |
| `03-worker.log` | `1edad73e239504b18fd49e773b63177c65e05a067d31a4d957ac6d085a1b1aa1` |
| `04-analysis.log` | `3d5f6d57906317ce7c302116fcc901b6c9b333ba65757a5826388bca2fb03b01` |
| `05-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `06-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `07-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `08-chrome-e2e.log` | `981f49b203ba6af903d472099d4b2bd102a38060d560d298d11712f2aded7d0f` |
| `09-build.log` | `3b8dc65e27b3651fe2e0d20c0e87555fe43e6d2bcd1e0427a42782351c352191` |
| `10-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。本地产物至少保留到 M3 获批；删除后必须把本记录的 retention 改为 `local-deleted`。

## 5. Open Evidence Gaps and Warnings

- EG-003：本机没有 Edge；EV-B 浏览器矩阵、M11 和未来 readiness 继续 blocked。
- EG-004：尚无 owner 3/3 学习验证；不声明广泛用户学习效果。
- EG-005：本 run 记录了实际设备，但产品尚未批准统一基线设备。
- EG-006：OS 文件选择器和权限提示仍需要后续真实浏览器手工证据。
- EV-S、EV-U 及 M4–M11 产品行为没有被本 run 验证，保持 `planned`。
- 当前没有正式 CI；本记录只支持上述本地环境。
- `npm audit` 已知仍有一个与 Windows 开发服务器相关的 low esbuild 项；本 run 未将其声称为已修复。
- 构建通过但保留 1,012.69 kB chunk warning；它不是 M3 失败，也不是性能 readiness 通过证据。

## 6. Approval Record

`project-owner` 于 2026-07-28 明确批准本 M3 evidence 与 [working agreements](../context/working-agreements.md)。本文件改为 `approved`，M3 改为 `Complete` 并开放 M4；EG-003–EG-006、M4–M11 未执行范围及 `release-readiness.md` 后置规则保持不变。

## 7. M4 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M4-2026-07-29T03-32-15-929Z-e5cfe9e8` |
| Milestone | M4 — Single AudioEngine and shared store |
| State | `pass`（M4 适用子集；已批准） |
| Eval IDs | EV-S、EV-B、EV-R 的 M4 适用子集；EV-A、EV-J、EV-D、EV-R 的 M3 回归子集 |
| Commit | `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` |
| Dirty at start / end | `false` / `false` |
| Commit at end | `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` |
| Started at | 2026-07-29 03:32:15.929 UTC |
| Method | `npm run eval:m4` |
| Reviewer | `project-owner` — approved 2026-07-29 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M4-2026-07-29T03-32-15-929Z-e5cfe9e8/` |
| Summary SHA-256 | `831158a07e1d08dab9dddd3e58b93047d287c6f9044badc02318cf49bd56aa25` |
| Failure | 无；Edge 缺失继续作为 EG-003，构建 chunk warning 继续作为风险信号 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `150.0.7871.187` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

### Results and Traceability

| Step | Result | M4 measurement | Eval / AC / risk trace |
| --- | --- | --- | --- |
| Fixture hashes | pass | 5/5 | M3 regression；EV-A、EV-B |
| M3 unit regression | pass | 12/12 | M3 regression；EV-A、EV-D |
| M3 Worker regression | pass | 3/3 | M3 regression；EV-J |
| M3 analysis regression | pass | 2/2 | M3 regression；EV-A |
| AudioEngine unit | pass | 5/5；load/play/pause/seek/ended/stale/error/unload/dispose | EV-S、EV-R；AC-S01、AC-S02、AC-S04、AC-R06；R-001、R-012、R-013 |
| Session integration | pass | 5/5；队列、竞态、ended、删除、清空、metadata、单 RAF 与 URL 释放 | EV-S、EV-R；AC-S04、AC-S05、AC-R06；R-001、R-013 |
| Docs | pass | lifecycle frontmatter/links；feature source count 21 | EV-R；R-019 |
| Deliberate failure | pass | harness 正确检测 child exit 1 | EV-R；R-019 |
| Typecheck | pass | `vue-tsc -b` exit 0 | EV-S、EV-R |
| M3 Chrome regression | pass | 5/5；应用、真实 IndexedDB/Worker、三格式加载播放 | M3 regression；EV-B |
| M4 Chrome E2E | pass | 3/3；队列/追加/错误恢复/资源所有权；60 秒漂移 2.233ms；三次 seek 最大误差 66.827ms | EV-S、EV-B、EV-R；AC-S01、AC-S02、AC-S04、AC-S05、AC-F07、AC-R06；R-001、R-012、R-013 |
| Build | pass with warning | 1804 modules；最大 JS chunk 1,036.44 kB | EV-R；R-019 |
| Diff check | pass | `git diff --check` exit 0 | EV-R；R-019 |

时钟与 seek 测量均满足 ≤100ms 的批准阈值。M4 的资源检查覆盖单一实时 AudioContext、单 service RAF、对象 URL 释放和重复切歌路径；它不替代 M11 的 DevTools heap/线程长会话检查。三格式记录是 M3 smoke 回归，不代表 Edge 或完整格式矩阵已通过。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `831158a07e1d08dab9dddd3e58b93047d287c6f9044badc02318cf49bd56aa25` |
| `01-fixture-hashes.log` | `bd18f96775203686bfbecc5ac20136180a12a4876188c879475690c54a424b60` |
| `02-M3-unit-regression.log` | `d8d3371b4835078983f67b05c74870a7d1d4737d78d7a43fb4b769fcd4ab27bd` |
| `03-M3-worker-regression.log` | `7fc07331ccb37e8e8f980fbe3482ae2775b73ec5a193f2677ab5f541fdece228` |
| `04-M3-analysis-regression.log` | `fd52fa82a61702ceccfc99eba6a7c2909c467302e162ded00db5bcc6f017718e` |
| `05-M4-AudioEngine-unit.log` | `399430c8dff3c73ac4fc2c72054e1a33d6b011f615eaecc1e7c365366c99373a` |
| `06-M4-session-integration.log` | `c1c39a067bf7f1c7cf0c0a730456c1da937a880332eb55a1c8a4e0a471f1824e` |
| `07-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `08-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `09-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `10-M3-Chrome-regression.log` | `acea7e85c1e916cf75c383b106de752b684aa01258542097897f6e25bc668dfb` |
| `11-M4-Chrome-e2e.log` | `41774fa85a9169728b6ba0f7e49048d689fd5da6218a7e4485efed285e6318f7` |
| `12-build.log` | `509e4e2f57f20045f928a8344b36f94536e2f8f272b3052629540d8b4303c9c5` |
| `13-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。本地产物至少保留到 M4 获批；删除后必须把本记录的 retention 改为 `local-deleted`。

### M4 Approval Record

本记录来自干净 commit，13/13 步骤通过且没有 failure instance。`project-owner` 于 2026-07-29 明确批准本 M4 evidence 与 [working agreements](../context/working-agreements.md)；M4 据此改为 `Complete` 并开放 M5。该批准不构成 M5、Edge、完整 EV-B 或 release readiness 通过。

## 8. M5 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M5-2026-07-29T07-08-25-199Z-c90a3c57` |
| Milestone | M5 — IndexedDB hybrid recovery |
| State | `pass`（M5 适用子集；已批准） |
| Eval IDs | EV-D 的 M5 自动化子集；EV-S、EV-B、EV-R 的 M4 回归子集；EV-A、EV-J、EV-D、EV-R 的 M3 回归子集 |
| Commit | `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` |
| Dirty at start / end | `false` / `false` |
| Commit at end | `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` |
| Started at | 2026-07-29 07:08:25.199 UTC |
| Method | `npm run eval:m5` |
| Reviewer | `project-owner` — approved 2026-07-29 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M5-2026-07-29T07-08-25-199Z-c90a3c57/` |
| Summary SHA-256 | `6257426baa601289d89c10e97d76d866a637227fd042080deb947af17c982d2a` |
| Failure | M5 门禁内无 failure instance；Edge 缺失保持 EG-003 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `150.0.7871.187` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

### Fixture Identity

M5 canonical 自动化只使用仓库内 CC0-1.0 受控 fixture；完整 provenance、编码参数和 SHA-256 见 [fixture manifest](../../tests/fixtures/fixture-manifest.json)。本 run 未读取、复制或记录用户本地音频的文件名、路径、内容或 hash，也未把超范围压力样本计入门禁。

### Results and Traceability

| Step | Result | M5 measurement | Eval / AC / risk trace |
| --- | --- | --- | --- |
| Fixture hashes | pass | 5/5 | M3 regression；EV-A、EV-B |
| M3 unit regression | pass | 12/12 | M3 regression；EV-A、EV-D |
| M3 Worker regression | pass | 3/3 | M3 regression；EV-J |
| M3 analysis regression | pass | 2/2 | M3 regression；EV-A |
| M4 AudioEngine unit | pass | 5/5 | M4 regression；EV-S、EV-R |
| M4 session integration | pass | 5/5 | M4 regression；EV-S、EV-R |
| M5 repository unit | pass | 5/5；V1 validator、SHA-256、唯一 current Blob/cache、事务 abort、删除与清空 | EV-D；AC-R05、AC-F04、AC-F08、AC-F09；R-003、R-006、R-007 |
| M5 recovery integration | pass | 6/6；current Blob、0 秒 paused、邻近权限顺序、显式 request、missing/changed、内容 hash、quota、取消 | EV-D；AC-P04、AC-S03、AC-F01–AC-F05、AC-F08；R-005、R-006、R-007 |
| Docs | pass | lifecycle frontmatter/links；feature source count 21 | EV-R；R-019 |
| Deliberate failure | pass | harness 正确检测 child exit 1 | EV-R；R-019 |
| Typecheck | pass | `vue-tsc -b` exit 0 | EV-D、EV-S、EV-R |
| M3 Chrome regression | pass | 5/5；应用、真实 IndexedDB/Worker、三格式加载播放 | M3 regression；EV-B |
| M4 Chrome regression | pass | 3/3；60 秒漂移 4ms；三次 seek 最大误差 66.827ms | M4 regression；EV-S、EV-B、EV-R |
| M5 Chrome E2E | pass | 3/3；真实 IndexedDB/OPFS handle、刷新 0 秒 paused、current Blob、清空、未知 schema | EV-D；AC-P04、AC-S03、AC-F01、AC-F08、AC-F09；R-003、R-005、R-007 |
| Build | pass with warning | 1806 modules；最大 JS chunk 1,054.73 kB | EV-R；R-019 |
| Diff check | pass | `git diff --check` exit 0 | EV-R；R-019 |

M5 自动化覆盖 success、failure、boundary 与 exception 的可重复子集：V1/未知 schema、单 current Blob/cache、事务 abort/quota、内容 hash、权限 adapter、取消、刷新和用户清除。OPFS handle 证明 Chrome structured clone 与真实 IndexedDB 刷新链路，但不能制造原生 picker 的 prompt/denied 气泡或文件移动；这些路径由下方独立人工记录补偿，不能只凭 canonical run 宣称通过。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `6257426baa601289d89c10e97d76d866a637227fd042080deb947af17c982d2a` |
| `01-fixture-hashes.log` | `1329e092efe072d876bc0e1e55f0c81cab28429014e76e7ec2a77f467889a3c5` |
| `02-M3-unit-regression.log` | `404b6d3e4010e72911018497c6452687f60a47d8d7be37a03281128cedccf830` |
| `03-M3-worker-regression.log` | `55f62f46b2192a51a19687ec885829789fd2cc6460064771eb4d6022073f77b0` |
| `04-M3-analysis-regression.log` | `a3d7f31154a7f4d5f232afc8b98799cb34ab75fade057bc6bc03a15407644c9d` |
| `05-M4-AudioEngine-unit.log` | `76ac7f3e8562c2f17755cd1453667668cd072253e083155f60e30ac3860090cc` |
| `06-M4-session-integration.log` | `bae676f3f3830a943d0ee3999564df863cc5db4610622c2659d8b1cdcaab4932` |
| `07-M5-repository-unit.log` | `e32df068e56a598423fe1ff209e31fae17a38626af13cde676b93db4cf6bf9c9` |
| `08-M5-recovery-integration.log` | `17dc302f48f2ac89ab389f314944642b0fdf5b200d28f09a2c554030fa2c40de` |
| `09-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `10-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `11-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `12-M3-Chrome-regression.log` | `ba9449e5f21fef95bb0741c916b60065f84a03489bbcdea8a89fb287c53ad2e9` |
| `13-M4-Chrome-regression.log` | `c39e42f66c8a2370f1749fcffd3f3ec3354cbdd2fcc2d4bfd26013c667e7227d` |
| `14-M5-Chrome-e2e.log` | `95d160b166c6c1a4217dcb1913d7bda1991a0fb4885d8a375d67dede1fe9a309` |
| `15-build.log` | `688df2ca704e64b76fc9f558cb41a89b8f4e4200a76a9f999fa4486172fb86f5` |
| `16-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。本地产物至少保留到 M5 获批；删除后必须把 retention 改为 `local-deleted`。

### Chrome Native Permission Manual Record

| Field | Value |
| --- | --- |
| Date | 2026-07-29 |
| Method | 按 [tests README](../../tests/README.md) 执行 Chrome 原生 picker、刷新、权限与文件移动检查 |
| Browser | 最新稳定版 Chrome；本次人工签字未单独记录精确版本 |
| Result | `pass`（M5 Chrome 原生权限适用子集） |
| Covered | 原生选择、刷新为 0 秒 paused、启动不主动请求权限、用户触发恢复访问、granted/prompt/denied、文件移动、重新选择与内容变化 |
| Reviewer | `project-owner` |
| Artifact | `not-produced`；以本次明确人工签字为记录，不保存私有音频身份 |
| Trace | EV-D；AC-P04、AC-S03、AC-F01–AC-F05；R-005、R-006 |

本人工记录补足 M5 在 Chrome 上的 EG-006 补偿验证；它不等于文件权限提示已全自动化，也不补足 Edge 的 EG-003。

### Out-of-scope Stress Observation

`project-owner` 观察到一段超出“约 15 分钟”支持边界的本地压力输入未开始播放。当前 import/load 源码没有显式时长拒绝，因此这不是产品规定或实现设计的预期失败；该输入按既有 DEC-006/DEC-015 只作 best-effort 观察，不计入 M5 pass/fail，本轮也不对超范围样本继续诊断。版本化证据不记录其文件名、路径、内容或 hash。若约 15 分钟范围内的有效 MP3/WAV/FLAC 复现，或失败使队列、当前会话及其他歌曲不可继续使用，则重新打开格式/播放缺陷调查。

### M5 Approval Record

本记录来自干净 commit，16/16 自动化步骤通过且没有 M5 门禁内 failure instance。`project-owner` 于 2026-07-29 确认原生权限人工检查通过，并明确批准本 evidence 与 [working agreements](../context/working-agreements.md)。M5 据此改为 `Complete` 并开放 M6；该批准不构成 M6、Edge、完整 EV-A–EV-R 或 release readiness 通过。

## 9. M6 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M6-2026-07-30T02-19-07-149Z-a39256ff` |
| Milestone | M6 — Worker platform and feature registry |
| State | `pass`（M6 适用子集；已批准） |
| Eval IDs | EV-A、EV-J、EV-R 的 M6 适用子集；EV-S、EV-B、EV-D 与 M3–M5 的回归子集 |
| Commit | `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` |
| Dirty at start / end | `false` / `false` |
| Commit at end | `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` |
| Started at | 2026-07-30 02:19:07.149 UTC |
| Method | `npm run eval:m6` |
| Reviewer | `project-owner` — approved 2026-07-30 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M6-2026-07-30T02-19-07-149Z-a39256ff/` |
| Summary SHA-256 | `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae` |
| Failure | M6 门禁内无 failure instance；Edge 缺失、构建 chunk warning 与 R-020 继续作为未关闭缺口/风险 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.71` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

本记录只保留验证所需的机型、芯片、核心数和内存；本地 summary 中的设备序列号、UUID、UDID 等标识不进入版本控制证据。

### Fixture and Runtime Input Identity

短格式回归只使用仓库内 CC0-1.0 受控 fixture，完整 provenance 与 SHA-256 见 [fixture manifest](../../tests/fixtures/fixture-manifest.json)。15 分钟容量输入由 Chrome E2E 在 OPFS 中确定性分块生成 48kHz、单声道 silence WAV，测试结束后不进入 Git；本 run 未读取、复制或记录用户私有音频的文件名、路径、内容或 hash。

### Results and Traceability

| Step | Result | M6 measurement | Eval / AC / risk trace |
| --- | --- | --- | --- |
| Fixture hashes | pass | 5/5 | M3 regression；EV-A、EV-B |
| M3 unit regression | pass | 12/12 | M3 regression；EV-A、EV-D |
| M3 Worker regression | pass | 11/11 | M3/M6 Worker regression；EV-J |
| M3 analysis regression | pass | 28/28 | M3/M6 analysis regression；EV-A、EV-J |
| M4 AudioEngine unit | pass | 6/6 | M4 regression；EV-S、EV-R |
| M4 session integration | pass | 5/5 | M4 regression；EV-S、EV-R |
| M5 repository unit | pass | 5/5 | M5 regression；EV-D |
| M5 recovery integration | pass | 6/6 | M5 regression；EV-D |
| M6 platform unit | pass | 18/18；21/21 registry、config/cache identity、PCM/frame、六类 codec、损坏数据拒绝 | EV-A、EV-J；AC-A01、AC-A02、AC-A06、AC-A08、AC-A10；R-003、R-010、R-011 |
| M6 Worker and golden | pass | 13/13；0/1/4、invalid/unsupported、progress/cancel、silence/sine/dual-tone/impulse、exact cursor、R-020 expected defect | EV-A、EV-J、EV-R；AC-A02、AC-A03、AC-A07、AC-A09；R-002、R-003、R-004、R-010、R-011、R-020 |
| M6 coordinator integration | pass | 6/6；默认零特征、四项、partial cache、stale、quota、非法活动集 | EV-J、EV-D；AC-A08、AC-A09、AC-R03、AC-R04、AC-F06；R-002、R-003、R-007 |
| Docs | pass | lifecycle frontmatter/links；feature source count 21 | EV-R；R-019 |
| Deliberate failure | pass | harness 正确检测 child exit 1 | EV-R；R-019 |
| Typecheck | pass | `vue-tsc -b` exit 0 | EV-A、EV-J、EV-D |
| M3 Chrome regression | pass | 5/5；应用、真实 IndexedDB/Worker、三格式 smoke | M3 regression；EV-B |
| M4 Chrome regression | pass | 3/3；60 秒漂移 10.233ms；三次 seek 最大误差 61.494ms | M4 regression；EV-S、EV-R |
| M5 Chrome regression | pass | 3/3；真实 IndexedDB/OPFS handle 与刷新恢复 | M5 regression；EV-D |
| M6 Chrome E2E | pass | 3/3；四项真实 Worker、100,941-byte cache、刷新 hit + exact cursor、20 次资源循环、15 分钟响应/取消 | EV-A、EV-J、EV-R；AC-A03、AC-A07–AC-A09、AC-R01–AC-R04、AC-R06；R-002、R-003、R-004、R-013 |
| Build | pass with warning | 1811 modules；Worker 40.36 kB；最大 JS chunk 1,077.72 kB | EV-R；R-019 |
| Diff check | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 | EV-R；R-019 |

M6 Chrome 测量记录：四项短 fixture 产生 4 个 payload、合计 100,941 bytes；首次与刷新后的 RMS exact cursor frame start 均为 0.992 秒。20 次 start/cancel/换歌/route 循环只创建并保留 1 个 Worker 和 1 个 AudioContext，RAF live 范围为 2–3。15 分钟输入三次反馈为 10.7ms、17ms、0.3ms，最大 17ms；进度单调、取消成功，分析观察窗内超过 50ms 的 long task 为 0。

本 run 覆盖 M6 的 success、failure、boundary 与 exception 子集：四项成功分析和完整 cache；非法/不支持 feature、extract/cache failure；0/1/4、silence、impulse、尾帧与 15 分钟边界；stale generation、取消、损坏 cache、partial/full hit 和刷新异常路径。它不证明 M7 Canvas/UI、owner 3/3 学习任务、Edge 矩阵或 release readiness。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `2d955ddb994e8e2066ce3c79655d44402e297ffdc03ec63b3a7bf5a2088f08ae` |
| `01-fixture-hashes.log` | `de86de65e5aa0d70a54d329c5a4926716e548472482bf23db1682838223c6a1d` |
| `02-M3-unit-regression.log` | `4c7d4f6e7b2b7377af0d30bd06fc7a324f7642c8d6f3a682fdbe5e154ed0692c` |
| `03-M3-worker-regression.log` | `086206d5a71f4ba66ef7c28301fd4dcadeb6b2b491c2f675cd445b98fea58f5a` |
| `04-M3-analysis-regression.log` | `77f2f3e51dbceb7678992cc721e5f7b4292a9abd1d9bcc0306864bf258ee5e8e` |
| `05-M4-AudioEngine-unit.log` | `e5d9ded54b368ca08ee4a959907373cc88e75798c9ee6c5dcc22bf6cce09b3e9` |
| `06-M4-session-integration.log` | `95e551492e2d1c42f047273b7b33c264396b363d2fe4b4a2e1e3497d52a82123` |
| `07-M5-repository-unit.log` | `91f6446f26876036fef98be43475af7c20f8091c210674cfbc1f04466f711050` |
| `08-M5-recovery-integration.log` | `ad1faf485ed3d98eb708838dbaa103f503fc94f37925e298c91ebed0b836b861` |
| `09-M6-platform-unit.log` | `e0f92e2130e027b72566feb35afdea71002b93f9a718e7e0d0c74637acdcaa64` |
| `10-M6-Worker-and-golden.log` | `f74a02096ee72c7b87afc68b7015a9221c38ba5ca200175f302be2185bd6dbc8` |
| `11-M6-coordinator-integration.log` | `997dd6193d5c91210dddee63d089cac61e01b7d128d72c72478c6affb7cce6fe` |
| `12-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `13-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `14-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `15-M3-Chrome-regression.log` | `00e9185fd00a32fbf25e77b62545f10d56b581b850cecaf2010443cbc3cb9bc3` |
| `16-M4-Chrome-regression.log` | `98852338593cfb7b58a3ff9eaad9af5b6a91d1cf1fe5446045f79e280fdf8871` |
| `17-M5-Chrome-regression.log` | `5834c854826784384cc9c57efd8cd89090da2d66acf4b319bdd0bfa2be734bef` |
| `18-M6-Chrome-e2e.log` | `b26c293ea7a3e38aad34fdc5c7d046e50b0fa98db5a084449170e3da5c215b88` |
| `19-build.log` | `25cb55002484d9fbac767bd5a171cddc28489f4599d6574a8cc9a0d53a4fb023` |
| `20-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。本地产物至少保留到 M6 获批；删除后必须把 retention 改为 `local-deleted`，且不能仅凭删除后的摘要支持未来 release readiness。

### Open Gaps and Warnings

- EG-003：本机仍未安装 Edge；M6 不要求关闭双浏览器矩阵，但 M11 和未来 readiness 继续 blocked。
- EG-004：M7 owner 3/3 学习解释尚未执行；本 run 不证明学习目标。
- EG-005：记录了本机实际硬件，尚未批准跨设备性能基线；17ms 结论只绑定上述环境。
- R-020：Meyda 5.6.3 `spectralFlux` 仍抛 `ReferenceError: x is not defined`；它保持不可选并阻断未来 M8 对应 scalar coverage，不阻断 M6/M7。
- 构建保留 1,077.72 kB 主 chunk warning；它是 R-019 风险信号，不是本次 build failure，也不是性能 readiness 通过。
- 当前仍无正式 CI；本记录只支持上述本地 clean-commit 环境。

### M6 Approval Record

本记录来自干净 commit，20/20 自动化步骤通过且没有 M6 门禁内 failure instance。`project-owner` 于 2026-07-30 明确回复：“我批准 M6 canonical evidence、working agreements、system map 与 glossary；同意将 M6 标记为 Complete 并开放 M7。”据此本 evidence、[working agreements](../context/working-agreements.md)、[system map](../context/system-map.md) 与 [glossary](../context/glossary.md) 改为 `approved`，M6 改为 `Complete`，M7 门禁开放但仍保持 `Planned`，直到明确开始实现。本批准不构成 Edge、M7 UI、完整 EV-A–EV-R 或 release readiness 通过。

## 10. M7 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M7-2026-07-30T03-30-43-095Z-f022b86e` |
| Milestone | M7 — RMS, Amplitude Spectrum, Chroma vertical slice |
| State | `pass`（M7 适用自动化与 owner 学习任务；`approved`） |
| Eval IDs | EV-A、EV-S、EV-U、EV-J、EV-D、EV-R 的 M7 适用子集；M3–M6 回归子集 |
| Commit | `f022b86e2333ad612ecb12701b0ca05e49f2b256` |
| Dirty at start / end | `false` / `false` |
| Commit at end | `f022b86e2333ad612ecb12701b0ca05e49f2b256` |
| Started at | 2026-07-30 03:30:43.095 UTC |
| Method | `npm run eval:m7` |
| Reviewer | `project-owner` — approved 2026-08-21 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M7-2026-07-30T03-30-43-095Z-f022b86e/` |
| Summary SHA-256 | `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32` |
| Prior failed run | `M7-2026-07-30T03-21-14-150Z-28fc4699`，summary `1906d9661f32018125b8a093695daaa817e189be43006d41c1aa69edd9fc4189`；M7 Chrome 3/4，固定 550ms 跨进程计时误判 exact-cursor 上限，已由 `f022b86` 的页面内真实时间窗断言与 40ms cadence 修复取代 |
| Failure | 本 run 的 M7 门禁内无 failure instance；Edge 缺失、构建 chunk warning、四项 M8 UI hardening 和 R-020 继续为未关闭缺口/风险 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.71` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

本记录只保留验证所需的机型、芯片、核心数和内存；本地 summary 中的设备序列号、UUID、UDID 等标识不进入版本控制证据。

### Fixture and Golden Identity

M7 使用 `m7-learning-fixtures-v1` 确定性生成 L1/L2/L3 六个 48kHz、单声道 frame；版本化 golden 为 `tests/analysis/golden/m7-learning.v1.json`，SHA-256 `232c8fed88bd729b18196057321d3aae4a992af026505269d6a3374a21774f45`。运行时学习 WAV 与 15 分钟容量 WAV 位于 Git 忽略目录，不进入版本控制。本 run 未读取、复制或记录用户私有音频的文件名、路径、内容或 hash。

### Results and Traceability

| Step | Result | M7 measurement | Eval / AC / risk trace |
| --- | --- | --- | --- |
| Fixture hashes | pass | 5/5 | M3 regression；EV-A、EV-B |
| M3 unit regression | pass | 12/12 | M3 regression；EV-A、EV-D |
| M3 Worker regression | pass | 11/11 | M3/M6 Worker regression；EV-J |
| M3 analysis regression | pass | 36/36，含 M7 learning golden | EV-A、EV-U；AC-P06、AC-A03、AC-A07 |
| M4 AudioEngine unit | pass | 6/6 | M4 regression；EV-S、EV-R |
| M4 session integration | pass | 5/5 | M4 regression；EV-S、EV-R |
| M5 repository unit | pass | 5/5 | M5 regression；EV-D |
| M5 recovery integration | pass | 6/6 | M5 regression；EV-D |
| M6 platform unit | pass | 18/18 | M6 regression；EV-A、EV-J |
| M6 Worker and golden | pass | 13/13 | M6 regression；EV-A、EV-J |
| M6 coordinator integration | pass | 6/6 | M6 regression；EV-J、EV-D |
| M7 workspace and learning unit | pass | 8/8；viewport、zoom anchor、x↔time、renderer 变换、workspace 不变量、L1/L2/L3 | EV-A、EV-S、EV-U；AC-P03、AC-P06、AC-A03 |
| M7 workspace integration | pass | 3/3；内存先更新、quota 后当前页可用、已保存空工作区保持为空 | EV-D、EV-J；AC-F04、AC-P04 |
| M7 golden identity | pass | generator、PCM hash 与 direct-Meyda 数值 identity 一致 | EV-A、EV-U；R-010 |
| Docs | pass | lifecycle frontmatter/links；feature source count 21 | EV-R；R-019 |
| Deliberate failure | pass | harness 正确检测 child exit 1 | EV-R；R-019 |
| Typecheck | pass | `vue-tsc -b` exit 0 | EV-A、EV-J、EV-D |
| M3 Chrome regression | pass | 5/5；应用、真实 IndexedDB/Worker、三格式 smoke | M3 regression；EV-B |
| M4 Chrome regression | pass | 3/3；60 秒漂移 3.6ms；三次 seek 最大误差 66.827ms | M4 regression；EV-S、EV-R |
| M5 Chrome regression | pass | 3/3；真实 IndexedDB/OPFS handle 与刷新恢复 | M5 regression；EV-D |
| M6 Chrome regression | pass | 3/3；100,941-byte cache、刷新 hit、20 次资源循环、15 分钟最大反馈 14ms、分析长任务 0 | M6 regression；EV-A、EV-J、EV-R |
| M7 Chrome E2E | pass | 4/4；默认三卡/四槽、保存空/单卡、共享 zoom/cursor/seek、三视口、DPR、reduced motion、单卡错误隔离 | EV-S、EV-U、EV-J、EV-D、EV-R；AC-P03、AC-P04、AC-P06、AC-A09、AC-U03、AC-R01–AC-R04 |
| Build | pass with warning | 1818 modules；Worker 40.36 kB；最大 JS chunk 1,100.70 kB | EV-R；R-019 |
| Diff check | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 | EV-R；R-019 |

M7 三卡场景记录 4 个固定 slot、3 张唯一活动卡和 6 个 Canvas layer。页面内 exact-cursor 测量窗为 624.4ms，`rms`、`amplitudeSpectrum`、`chroma` 各 16 次，低于按真实窗口计算的上限 20 次；点击 seek 可见反馈为 1.7ms。1280px 与 1920px 均为双列，1024px 单列场景通过。15 分钟输入的三次反馈为 8.7ms、16.8ms、16.6ms，最大 16.8ms；20 个进度样本单调，分析归因超过 50ms 的主线程 long task 为 0，取消成功。

本 run 覆盖 M7 的 success、failure、boundary 与 exception 自动化子集：首次默认三卡、0/1/3 卡恢复、四槽与重复禁用、共享 viewport/zoom/cursor/click/keyboard seek、卡片/viewport 持久化与 quota、单卡 Canvas context failure、换歌/刷新/reduced motion/三视口/DPR、确定性 15 分钟输入和 M3–M6 回归。2026-08-21 的 owner 任务又覆盖加载、选卡、换卡、zoom/pan、鼠标与键盘 seek、刷新恢复和 3/3 学习解释。M7 仍不证明四个唯一活动特征、Edge 矩阵、M8 标量或 release readiness。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `458ffb4a0c7fc8c64397092c1324d88c3c369f7fde3fc069f47861bbbc76ed32` |
| `01-fixture-hashes.log` | `0b2c45a833b59827cbe51d0008c6cf31be389c42594de86eea55e47364119df6` |
| `02-M3-unit-regression.log` | `a03dd86fc8189ea743bff5fe919dba995838b896943d114664592f140cdee202` |
| `03-M3-worker-regression.log` | `80e024ed64a583d76ddadbeb04d504edfccea86fb5c11a6077925dbfbdff4ccc` |
| `04-M3-analysis-regression.log` | `cab36bc8eb7384d06fda42c61b42ba92653015bfe0b372b4131b6ef284a60935` |
| `05-M4-AudioEngine-unit.log` | `32069584a60e7ec8455edc99b7651f35c0865624bd4cfdd6060375e008bb153f` |
| `06-M4-session-integration.log` | `eebac7a5e5753bd7c1d4e81b1d34652b6414a44e0cea92086c1e879c172b590b` |
| `07-M5-repository-unit.log` | `fdd09f8e820456a8da64dabbaf9f16a942a877a9f1e2cbb1c296b2a39d91abc8` |
| `08-M5-recovery-integration.log` | `7ca768a191f636fd8c110be95ced536fa33a525d14eed0e7831df994ea079ad2` |
| `09-M6-platform-unit.log` | `cabd73ee10f1608631811a00bcc8e267012db15d86e040e90242be386ad4daeb` |
| `10-M6-Worker-and-golden.log` | `fa3288f932650a652a94b09ec496853a49a27f482816c1dc7f74766fa8a27441` |
| `11-M6-coordinator-integration.log` | `fbe7a34a9280153e2fcce2c776671c210147cc71d63f15d43b1e06d4b0f34937` |
| `12-M7-workspace-and-learning-unit.log` | `2c674a4b984f7611e340fcb70f0df48ea724b37061a9d76fecce7d2986284434` |
| `13-M7-workspace-integration.log` | `a40cee946aa20f28ff7599516be827a26a83bec0787b6232753619b4057e4bc4` |
| `14-M7-golden-identity.log` | `e9c86c8566c4fa8dfe27f6033376965f08fff7eec487d4801cfb69077165d8a6` |
| `15-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `16-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `17-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `18-M3-Chrome-regression.log` | `7984962d9b5b573cadfdc9fc0303b7cf4567f73ee54a9802fe3ba89d65ce1157` |
| `19-M4-Chrome-regression.log` | `894e4f95fe5983355238e5df3a27eef6e6881792dba933e4520b65af8e1a5a93` |
| `20-M5-Chrome-regression.log` | `0c945cd5e44f11b2b562d2f75ffa4dd3db75d2053a16323fd5098ab716a342a1` |
| `21-M6-Chrome-regression.log` | `4c82f55ba68bae57a8fbd965c0132a1767faa61c8f0052593f47680aae68cd63` |
| `22-M7-Chrome-e2e.log` | `3af02026e99599af52c0109315a7d34f0027eed89acdb7cd8df893d3ff3fa229` |
| `23-build.log` | `9bb859d8c96be87008b0fec6f169cbd48059410d3f517310aad3eeb70b09e767` |
| `24-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。本地产物至少保留到 M7 审批完成；删除后必须把 retention 改为 `local-deleted`。失败 run 与通过 run 均保留，以便复核修复链路。

### Open Gaps and Warnings

- EG-003：本机仍未安装 Edge；M7 不要求关闭双浏览器矩阵，但 M11 和未来 readiness 继续 blocked。
- EG-004：已关闭。owner 于 2026-08-21 完成加载、选卡、换卡、zoom/pan、鼠标与键盘 seek、刷新恢复和 3/3 学习解释。
- GE-S04 的四个唯一活动特征场景按 DEC-017 顺延到 M8 首个新增特征；M7 只证明 0–3 张获准卡和四槽基础设施。
- R-020：Meyda 5.6.3 缺陷仍存在；owner 已批准 ADR-0005 的项目内 Flux 处置，但在 M8 实现与 canonical 通过前保持 Open。
- R-021：owner 发现 sticky 间距、播放器层级、Windows Chrome pressed 状态和表格滚动条四项界面问题；它们不推翻 M7 学习结果，作为 M8 Slice 0 修复并验证。
- 构建保留 1,100.70 kB 主 chunk warning；它是 R-019 风险信号，不是本次 build failure，也不是性能 readiness 通过。
- 当前仍无正式 CI；本记录只支持上述本地 clean-commit 环境。

### M7 Approval Record

`project-owner` 于 2026-08-21 确认卡片选择/替换、缩放、平移、鼠标与键盘跳转、刷新恢复均符合预期，并提交以下 3/3 学习解释：

- L1：音高不变，RMS 增大，说明只是音量变大。
- L2：RMS 接近，但频谱和 Chroma 从 C+E 变为 G+B，说明音级组合改变。
- L3：RMS 和主音级基本不变，但后段频谱峰更多，说明谐波更丰富、音色更亮。

owner 随后明确回复：“我批准 M7 canonical evidence，同意将 M7 标记为 Complete 并开放 M8。”据此本记录改为 `approved`，M7 改为 `Complete`，M8 门禁开放。该批准不构成 Edge、M8、M9、release readiness 或四项新 UI 问题已通过。

## 11. M8 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M8-2026-08-21T03-23-18-552Z-d6dcf715` |
| Milestone | M8 — UI hardening and remaining scalar features |
| Evidence state | `approved` |
| Eval result | `pass`（28/28 steps） |
| Commit | `d6dcf715be2e6675224f079b954e2b1b544bbebd` |
| Commit at end | `d6dcf715be2e6675224f079b954e2b1b544bbebd` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-21 03:23:18.552 UTC |
| Method | `npm run eval:m8` |
| Reviewer | `project-owner` — approved 2026-08-21 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M8-2026-08-21T03-23-18-552Z-d6dcf715/` |
| Summary SHA-256 | `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef` |
| Provisional precursor | `M8-2026-08-21T03-19-06-614Z-486e313a-provisional`，28/28 pass，summary `f12da7cad228a12d5089dbb88a1de2e04302dc5f895aa117e08ec583368ada58`；只作 dirty-worktree 实现反馈 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.170` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

版本化 golden `tests/analysis/golden/m8-scalars.v1.json` 的 SHA-256 为 `ad3e41985da2f07b977539401e5f26aa98e8ece79b29502dc46d8b69ab6eb1ad`。它绑定 `m8-scalars-fixtures-v1`、Meyda 5.6.3、静音、纯音、同 RMS 丰富谐波、确定性噪声/瞬态和项目 Flux v1。运行时学习音频为 Git 忽略的 `artifacts/fixtures/m8-scalars-v1.wav`，不包含用户私有音频。本记录只写机型、芯片、核心数与内存，不写本地 artifact 中的序列号、UUID、UDID 或其他设备标识。

### Results and Traceability

| Step | Result | Measurement |
| --- | --- | --- |
| Fixture / M3–M7 regression | pass | fixture 5/5；unit 12/12；Worker 14/14；analysis 43/43；M4 6/6 + 5/5；M5 5/5 + 6/6；M6 18/18 + 13/13 + 6/6；M7 8/8 + 3/3 |
| M8 scalar unit and golden | pass | 7/7；13 项 registry、12 项 direct Meyda、Flux 公式/首帧、静音 0、非有限值失败、scalar axis domain、golden identity |
| M8 Worker/workspace integration | pass | 6/6；四项唯一 scalar job、Flux exact cursor、13 项逐项有限、M9 拒绝、四卡保存、quota/空工作区恢复 |
| Docs / harness / typecheck | pass | 生命周期与链接通过；deliberate failure 被检测；`vue-tsc -b` exit 0 |
| M3 / M4 / M5 Chrome | pass | 5/5、3/3、3/3；M4 60 秒漂移 8.833ms，三次 seek 最大误差 61.494ms |
| M6 Chrome regression | pass | 3/3；100,941-byte cache、刷新 hit/exact cursor、20 次循环保持 1 Worker/1 AudioContext；15 分钟最大反馈 16.2ms、分析长任务 0 |
| M7 Chrome regression | pass | 5/5；三卡/四槽、0/1/3 恢复、共享交互、UI hardening 自动化；seek 1.8ms；15 分钟最大反馈 17.8ms、分析长任务 0 |
| M8 Chrome E2E | pass | 2/2；390/1024/1280/1920、四卡、16 项选择、重复禁用、M9 隔离、刷新恢复、13 项 scalar renderer/exact cursor；静音 Energy 0、瞬态 Flux 283.038 |
| Build | pass with warning | 1818 modules；Worker 41.88 kB；最大 JS chunk 1,102.00 kB，R-019 warning 保留 |
| Diff / identity | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 |

M8 自动化证明 Slice 0 的 sticky 距 Header 8px、播放器/歌曲列表高于 Analyzer、macOS Chrome 的瞬时 pressed 恢复和主题滚动条；390px 下 MusicBar 导入控件也保持可达。`project-owner` 随后以本记录要求的批准语句确认 Windows Chrome 界面稳定化补偿门禁和 canonical evidence；该签字不增加新的自动化测量。R-020 的产品阻断已由项目 Flux/golden/cursor/canonical 缓解，但 Meyda 5.6.3 上游 extractor 缺陷仍存在；不得写成依赖缺陷已修复。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef` |
| `01-fixture-hashes.log` | `5a57638c31148968d25b0ab278bc71160f457a2f0eb6776bc409ac9d1fbc21f1` |
| `02-M3-unit-regression.log` | `0fa5fdbd9b4c58b493c6a11b30e3396508f434622d36a59daceb7b9bb4b3f6c9` |
| `03-M3-worker-regression.log` | `d7a71ea8a06cc3a5ca7040ac74610cf2058852ac3b2b02973af35aef5cecb291` |
| `04-M3-analysis-regression.log` | `c5069ff2bb69982ca3d019683690d9a9f6d3c7af43fdc3176daf881185aa8edd` |
| `05-M4-AudioEngine-unit.log` | `7959d66e82d593aa46aa3f5119a8e26d4693832340b4f5f3a8740138d78d23d4` |
| `06-M4-session-integration.log` | `cb8dcc6309d2e00b618c931e2e105943d51d51ac7414cd27872a200bba9e8304` |
| `07-M5-repository-unit.log` | `2061b9268c80bf1be56d7aa016d0556786e76d0749a74aa4ee1f657bbf76b0ad` |
| `08-M5-recovery-integration.log` | `2d9272660c2d2d7028a951d83eceeb0ac9742a76b717c1dfddae78ee584bd735` |
| `09-M6-platform-unit.log` | `a19318b2fa18a06ff5c2acfc87bc6eb2b4a94e1a53b62bf0b376686fc8501393` |
| `10-M6-Worker-and-golden.log` | `8aa9f5b0c37218ba74fdb2c38188d4bc370fe4dee51af6ac91b396582dafabaa` |
| `11-M6-coordinator-integration.log` | `05d5d938a166af9798a5e1c4f9c8ea9a1e29db11cd8e903390def4ff3cbe2021` |
| `12-M7-workspace-and-learning-unit.log` | `6701097e784a1f5fdcabc8eb38739719b189f8f7fab5339603d0ca345db09d2d` |
| `13-M7-workspace-integration.log` | `43f1d6271f257e89c80d8977f4e2a63182440ec1dc73817057bddb8a9a0e7a4b` |
| `14-M7-golden-identity.log` | `e9c86c8566c4fa8dfe27f6033376965f08fff7eec487d4801cfb69077165d8a6` |
| `15-M8-scalar-unit-and-golden.log` | `c40659fc352b8b3629031737628c07387a8091d3d32e97be47593faad312f255` |
| `16-M8-Worker-and-workspace-integration.log` | `3dadf7dd8aada0eca0c00c55ad34bc378ccbcf060524d1b2747e86e2110a0855` |
| `17-M8-golden-identity.log` | `b6914a1c2caa84836ded55c4b6daccbdd85296043980fac59fe4767541d86406` |
| `18-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `19-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `20-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `21-M3-Chrome-regression.log` | `ed5f70d579cf18550387b5360fb9d8596fd5db9a5f56e47bbc90760d0c2f415e` |
| `22-M4-Chrome-regression.log` | `c1098af3b9cc2d03c1815ffd681fa8f62cb001d354166bc9c835f477d5bf81b6` |
| `23-M5-Chrome-regression.log` | `0e1fe1cad060931703f9c8112bd5066242e51d470bfe9a6656b9114719ce4660` |
| `24-M6-Chrome-regression.log` | `339b1387e5ac3c4379e382cbb8a084ea50767c653c3f6f9d6c50dfa4ec069f24` |
| `25-M7-Chrome-regression.log` | `108b2a2c8148219de59f388e73e0a29b3ecb8eec7e7e965820768d2126a34e95` |
| `26-M8-Chrome-e2e.log` | `c06aafaa4598a81fb916d0d65224ea0e9b887d465a39d26aa8c17bb53be0bc09` |
| `27-build.log` | `5bd4ad773ed1b1fc31ac7a3be1cf80635607e9f92a548945ee00f929559f2fde` |
| `28-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Open Gaps and Approval Gate

- Windows Chrome 的 sticky、歌曲列表层级、连续按钮 pressed 恢复和两类精确值滚动条已由 owner 人工批准；R-021 关闭。该签字不替代未来相关改动后的回归。
- Edge 未安装；M11 与未来 readiness 的双浏览器矩阵仍不完整。
- 主 chunk 1,102.00 kB warning 与 R-019 保留。
- Meyda 5.6.3 的 `spectralFlux` 上游缺陷仍存在；产品改用 ADR-0005 项目实现，R-020 只能标记产品侧 `Mitigated`。
- `project-owner` 于 2026-08-21 明确回复：“我批准 M8 canonical evidence 与界面稳定化结果；同意将 M8 标记为 Complete 并开放 M9。”据此本记录改为 `approved`，M8 改为 `Complete`，M9 门禁开放但在实现开始前保持 `Planned`。
- 本记录不创建或证明 release readiness，也不构成 Edge、M9、M10 或完整 21/21 产品覆盖通过。

## 12. M9 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M9-2026-08-21T09-14-14-110Z-f88ca331` |
| Milestone | M9 — non-home Header blur, Power Spectrum, MFCC and Buffer |
| Evidence state | `approved` |
| Eval result | `pass`（32/32 steps） |
| Commit | `f88ca33149619b1a71eb30d74a1b8e266fb41a65` |
| Commit at end | `f88ca33149619b1a71eb30d74a1b8e266fb41a65` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-21 09:14:14.110 UTC |
| Method | `npm run eval:m9` |
| Reviewer | `project-owner` — approved 2026-08-23 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M9-2026-08-21T09-14-14-110Z-f88ca331/` |
| Summary SHA-256 | `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e` |
| Provisional precursor | `M9-2026-08-21T09-08-40-958Z-896dbbb9-provisional`，32/32 pass，summary `9285bef21c715a2f36746ae7647255f00c06c40e70bc4af377baf03df7a4e9bf`；只作 dirty-worktree 实现反馈 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.170` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

版本化 golden `tests/analysis/golden/m9-vectors.v1.json` 为 225,903 bytes，SHA-256 为 `2f6c57cd89be3c852fc9af921b67d12c4679f8947ad284557c06110a39e40849`。它绑定 `m9-vectors-fixtures-v1`、Meyda 5.6.3、固定 AnalysisConfig、silence、440Hz 纯音、近似同 RMS 丰富谐波、确定性噪声/正负 impulse 和 333-sample 非整 frame 尾段。运行时学习音频 `artifacts/fixtures/m9-vectors-v1.wav` 为 768,710 bytes，SHA-256 为 `a74d04836b60a3250988a7f2a72af381136c01018ececfa3c7ba0f7cdc445934`，保持 Git 忽略且不包含用户私有音频。本记录只写机型、芯片、核心数与内存，不写本地 artifact 中的序列号、UUID、UDID 或其他设备标识。

### Results and Traceability

| Step | Result | Measurement |
| --- | --- | --- |
| Fixture / M3–M7 regression | pass | fixture 5/5；unit 12/12；Worker 17/17；analysis 48/48；M4 6/6 + 5/5；M5 5/5 + 6/6；M6 18/18 + 13/13 + 6/6；M7 8/8 + 4/4 |
| M8 scalar / Worker regression | pass | unit 7/7；integration 7/7；项目 Flux、静音 0、四卡与累计 M8 能力无回归 |
| M9 vector/waveform unit | pass | 5/5；三项 registry/direct Meyda、Power=Amplitude²、MFCC signed 量化、Buffer envelope/尾帧、非有限值失败与 golden identity |
| M9 Worker/workspace integration | pass | 7/7；四种混合 shape、cache codec round-trip、512/13/1024 exact cursor、stale、cancel、quota、四卡持久化与 M10 拒绝 |
| Docs / harness / typecheck | pass | 生命周期与链接通过；deliberate failure 被检测；`vue-tsc -b` exit 0 |
| M3 / M4 / M5 Chrome | pass | 6/6、3/3、3/3；Header route regression 在 M3 通过；M4 60 秒漂移 6ms，三次 seek 最大误差 66.827ms |
| M6 Chrome regression | pass | 3/3；100,941-byte cache、刷新 hit/exact cursor、20 次循环保持 1 Worker/1 AudioContext；15 分钟最大反馈 15.6ms、分析长任务 0 |
| M7 Chrome regression | pass | 5/5；三卡/四槽、共享交互、UI hardening；seek 2.2ms；15 分钟最大反馈 17.3ms、分析长任务 0 |
| M8 Chrome regression | pass | 2/2；四卡、13 项 scalar、390/1024/1280/1920 与刷新恢复无回归 |
| M9 Chrome E2E | pass | 2/2；首页透明，Analyzer/ComingSoon/TestLands 18px blur；19 项选择、M10 隔离、Power 512、MFCC 13、Buffer 1024、双 Canvas、鼠标/键盘 seek、四卡/2.0×视口恢复；390/1024 单列、1280/1920 双列 |
| Build | pass with warning | 1818 modules；Worker 42.97 kB；最大 JS chunk 1,106.55 kB，R-019 warning 保留 |
| Diff / identity | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 |

自动化证明 Header 根据 `route.path` 在首页与非首页间切换，背景/blur/64px 几何正确；它不能替代 Windows Chrome 对闪烁、文字清晰度和实际视觉效果的人工判断。三类新卡以双 Canvas + DOM 精确值共享时间轴；Power Spectrum 与 direct Meyda/Amplitude² golden 对齐，MFCC 使用 C0–C12 signed 系数轴而非频率轴，Buffer 显示全曲 envelope、当前 1024-sample frame 与尾帧补 0 信息。IndexedDB V1、AnalysisConfig 与缓存二进制 schema 未改变。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e` |
| `01-fixture-hashes.log` | `b2a75a0f9c62b6d7dc62f70fa1cf125855d66d54d0ed111b90891b379f4c1879` |
| `02-M3-unit-regression.log` | `301edbaa183447ac9a26a216a2d5d1f5c026e87ba87894fbdb5dbf430a52b963` |
| `03-M3-worker-regression.log` | `50c6d7f87bf79eda27b99c335f3ca6a0f0eb9e458d4b8846becbc07c82047830` |
| `04-M3-analysis-regression.log` | `e034aa2db0a342c0e1506df6dc1dc7b6742cefe413905233bddc6e5c1fa0c175` |
| `05-M4-AudioEngine-unit.log` | `be6616b6b067e4bd2915cf0c41497f3e7835e4aa1984a0081f74366c566bfc8b` |
| `06-M4-session-integration.log` | `b4bbd67c8cc406a084c2a4ef4bcead693f8f46c8df7116a2c4dc8a0ff7547a4b` |
| `07-M5-repository-unit.log` | `630957d667d46546eeeaef8e3d56df26621aa1daf32189a2b26e577f43a323db` |
| `08-M5-recovery-integration.log` | `5a3fabcd1807b4242805b1944715d0bdcba7baebf4a105df13aa47f9ca76ebb7` |
| `09-M6-platform-unit.log` | `fdb771aaefae5657039292c1320acaa3b4a39245d78c71345d10795a3b40ec19` |
| `10-M6-Worker-and-golden.log` | `a91e0c84b944c6f80655aade1aae131340e48bab74623d3b0124fe1ec9037967` |
| `11-M6-coordinator-integration.log` | `0aa14d8d2d9c811a35d6fc81a989e839d708476e4c508810942f8c166d682aa8` |
| `12-M7-workspace-and-learning-unit.log` | `15bd9dcb84ff9fde03d8f3527f9eb3f31ebde5eb70baee4abab48c086f190cae` |
| `13-M7-workspace-integration.log` | `0469cf9c82866688be87d02ed514692ac1c10e8b1d434fe3dc41696146302598` |
| `14-M7-golden-identity.log` | `e9c86c8566c4fa8dfe27f6033376965f08fff7eec487d4801cfb69077165d8a6` |
| `15-M8-scalar-unit-and-golden.log` | `a082600baee0888e2bf705e479f9c19a1c2e554a0c4572fa57800814382ebf41` |
| `16-M8-Worker-and-workspace-integration.log` | `c7aa3e88eff4a0ca7122cd30941f46f79d1e850041a45fb7491b79a6598517ac` |
| `17-M8-golden-identity.log` | `b6914a1c2caa84836ded55c4b6daccbdd85296043980fac59fe4767541d86406` |
| `18-M9-vector-and-waveform-unit.log` | `84e4b08ade330c54a7385b33c424a0fce56ed80daed36741d29c6a435f147df9` |
| `19-M9-Worker-and-workspace-integration.log` | `cd87a7b0810ad4e5fa0bbb31a2de8e29d1701b7f7a2467cf44639f4f46872389` |
| `20-M9-golden-identity.log` | `7b1d4aaf3705a92c84922ac818e5ed620974784fb3c49fcd5891f5043870a253` |
| `21-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `22-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `23-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `24-M3-Chrome-regression.log` | `63f6147c5afae716126292ddada43d2b3d43efd9d7c7e85781ac42ab636cd4d9` |
| `25-M4-Chrome-regression.log` | `ea0613168e52091651fe39baeb4a932ffd787bf9c55b08ec81e3c1390384a199` |
| `26-M5-Chrome-regression.log` | `d6298f57aa61761690fe96ecc3bd6fe885173e16329dba3deed9a33794df526e` |
| `27-M6-Chrome-regression.log` | `1cdd6497703ed8824a66fd410aea393ce581ab59ed42d90b5ca48646cb297a1e` |
| `28-M7-Chrome-regression.log` | `107f1d022e516e32dcf61b24d3f7d9564830e760695e2b73a869ca3afdac0cf6` |
| `29-M8-Chrome-regression.log` | `f618fad2122fafb948e0fba20ea2703052281f94910d1ffb5381230eb61bcf47` |
| `30-M9-Chrome-e2e.log` | `a978e1e279f8c6e6b88852d58691f537970acd1756cd07310e59c0892973a7fd` |
| `31-build.log` | `05baca53c93cc9187ed679dd5a2d355ad8fa525bfccb3912dc18b51cbf57c95c` |
| `32-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Open Gaps and Approval Gate

- `project-owner` 已签字确认前述 Windows Chrome 导航栏视觉、学习任务与四卡/视口清单通过；本记录不补写用户未提供的逐项数值或解释原文。
- Edge 未安装；M11 与未来 readiness 的双浏览器矩阵仍不完整。
- 主 chunk 1,106.55 kB warning 与 R-019 保留。
- Meyda 5.6.3 的 `spectralFlux` 上游缺陷仍存在；产品改用 ADR-0005 项目实现，R-020 只能标记产品侧 `Mitigated`。
- `project-owner` 于 2026-08-23 明确回复：“我批准 M9 canonical evidence 与非首页导航栏模糊效果；同意将 M9 标记为 Complete 并开放 M10。”M9 evidence 据此为 `approved`，M9 为 `Complete`，M10 门禁开放但编码前保持 `Planned`。
- 本记录不创建或证明 release readiness，也不构成 Edge、M10 或完整 21/21 产品覆盖通过。

## 13. M10 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M10-2026-08-22T18-25-01-873Z-8830e2a2` |
| Milestone | M10 — Loudness, Complex Spectrum and 21/21 Analyzer coverage |
| Evidence state | `approved` |
| Eval result | `pass`（36/36 steps） |
| Commit | `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` |
| Commit at end | `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-22 18:25:01.873 UTC |
| Method | `npm run eval:m10` |
| Reviewer | `project-owner` — approved 2026-08-25 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M10-2026-08-22T18-25-01-873Z-8830e2a2/` |
| Summary SHA-256 | `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1` |
| Provisional precursor | `M10-2026-08-22T18-17-36-129Z-2df604b9-provisional`，36/36 pass，summary `e9696c843256bff07cfa77b29ee9a529e9d80c6fc842c6f7437fab39a5c77166`；只作 dirty-worktree 实现反馈 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.170` |
| Edge | `not-installed` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

版本化 golden `tests/analysis/golden/m10-structures.v1.json` 为 451,968 bytes，SHA-256 为 `6ae234c078923ae261b32688aa72757f9c167e0cdad49737a1b610ff29bbaf9d`。它绑定 `m10-structures-fixtures-v1`、Meyda 5.6.3、固定 AnalysisConfig、静音、同幅 220Hz/4kHz、相位相差 π/2 的 440Hz 纯音和正负 impulse。运行时学习音频 `artifacts/fixtures/m10-structures-v1.wav` 为 672,044 bytes，SHA-256 为 `bf0abda5a6c8964b2d6b07eb7272073415cf74f02c1c562c80cf3cb316dc4e33`，保持 Git 忽略且不包含用户私有音频。本记录只写机型、芯片、核心数与内存，不写本地 artifact 中的序列号、UUID、UDID 或其他设备标识。

### Results and Traceability

| Step | Result | Measurement |
| --- | --- | --- |
| Fixture / M3–M7 regression | pass | fixture 5/5；unit 12/12；Worker 20/20；analysis 55/55；M4 6/6 + 5/5；M5 5/5 + 6/6；M6 18/18 + 13/13 + 6/6；M7 8/8 + 4/4 |
| M8 scalar / Worker regression | pass | unit 7/7；integration 7/7；项目 Flux、静音 0、四卡与累计 M8 能力无回归 |
| M9 vector/waveform regression | pass | unit 5/5；integration 7/7；Power 512、MFCC 13、Buffer 1024 与结构 cache/exact cursor 无回归 |
| M10 structure unit and golden | pass | 7/7；21 项集合、direct Meyda、Loudness total/24 bands、Complex real/imag 各 1024、magnitude/phase、相位环绕、静音/非有限值、codec 与 signed Hz |
| M10 Worker/workspace integration | pass | 13/13；四种混合 shape、两类 codec、cache hit、exact cursor、stale/cancel/quota 与四卡保存恢复 |
| Docs / harness / typecheck | pass | 生命周期与链接通过；deliberate failure 被检测；`vue-tsc -b` exit 0 |
| M3 / M4 / M5 Chrome | pass | 6/6、3/3、3/3；三格式与 Header 路由回归通过；M4 60 秒漂移 13.333ms，三次 seek 最大误差 66.827ms |
| M6 Chrome regression | pass | 3/3；100,941-byte cache、刷新 hit/exact cursor、20 次循环保持 1 Worker/1 AudioContext，RAF 2–3；15 分钟最大反馈 15.8ms、分析长任务 0 |
| M7 Chrome regression | pass | 5/5；三卡/四槽、共享交互、UI hardening；seek 2.2ms；15 分钟最大反馈 16.6ms、分析长任务 0 |
| M8 / M9 Chrome regression | pass | 2/2 + 2/2；累计能力、Header blur、四卡、四视口与刷新恢复无回归 |
| M10 Chrome E2E | pass | 3/3；累计 21 项、Loudness 24 bands、Complex 完整 1024 bins、双 Canvas、单卡错误隔离、鼠标/键盘 seek、2.0× 视口恢复及 390/1024/1280/1920 几何 |
| M10 heavy capacity | pass | Loudness/Complex/Power/Buffer 四重卡；15 分钟输入反馈 9.5/15.8/17ms，最大 17ms；20 个进度样本单调；分析归因超过 50ms 的 long task 为 0；取消成功 |
| Build | pass with warning | 1818 modules；Worker 46.50 kB；最大 JS chunk 1,114.74 kB，R-019 warning 保留 |
| Diff / identity | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 |

自动化证明当前 registry、Worker、UI、golden 与 renderer 累计开放 21/21 项，同时仍限制最多四张唯一活动卡。Loudness 展示 total 和 B0–B23；Complex Spectrum 主图与精确表完整覆盖 bin 0–1023，并标注正频率与负频率镜像，零幅度 bin 的 phase 显示“未定义”。IndexedDB V1、AnalysisConfig、Meyda 版本和缓存二进制 schema 均未改变。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1` |
| `01-fixture-hashes.log` | `07fff3b02a4031676121aa5f9e3db039328d32269bf9d260af5ccd67d624f29c` |
| `02-M3-unit-regression.log` | `2180665cf3499626fb4d165d3e5e7b1ae67ce050505ef3a5d09fc8feae13be2e` |
| `03-M3-worker-regression.log` | `46a947d02fab0a27a03a2b52d21dc48c9b6ec9ea192177a9019ba8540b3537c0` |
| `04-M3-analysis-regression.log` | `8b9b240a6538cc6d573ff5acbcba8587556b617df642771208fb5b2debb1f775` |
| `05-M4-AudioEngine-unit.log` | `4efb6d7ed16762188ff5c01d493637631f7bc7e9141d4772ae0bcbdc0978bdce` |
| `06-M4-session-integration.log` | `c3335d6674acaa0da44871cbe87e30ab00f65ba124e6ccb4a49dc62d95dd6379` |
| `07-M5-repository-unit.log` | `e490bf7b10a37798865d027f29d59133f716a8be388f19aebff2b6787b7724a3` |
| `08-M5-recovery-integration.log` | `93b3e97c38f1c398cb5bdae398d808909bdf97e5821a219fe259a028358caa54` |
| `09-M6-platform-unit.log` | `9ccfedd2a8341743547b5680d984832e38d9fe51a60e2348e4b5230526e088d7` |
| `10-M6-Worker-and-golden.log` | `7997b5fe20e1879d1a30e173d859bb9c42fca3839385797d59d568db2128ff6c` |
| `11-M6-coordinator-integration.log` | `8ccfbce03496034e7f1f9f475cd491b64df26bd8d6c1e9c189a4ad48339f19db` |
| `12-M7-workspace-and-learning-unit.log` | `c514112cbe889e990bd4869b7d87fb268ad4e5bb446ea7376f71fc42ab7108f2` |
| `13-M7-workspace-integration.log` | `7031dacedc18dd1887cf36d15bdd10d18c26a9c0f25384eea7e1eb587ca6f7f2` |
| `14-M7-golden-identity.log` | `e9c86c8566c4fa8dfe27f6033376965f08fff7eec487d4801cfb69077165d8a6` |
| `15-M8-scalar-unit-and-golden.log` | `09bdf47c3c2ab6258813c467699b9b1d70fe184ffd4743bbb4fe8de6ce8e935b` |
| `16-M8-Worker-and-workspace-integration.log` | `5b6453c70f8a1310df62b0d5caee004fe0cd42def1f9eda4393580bc5c540fa2` |
| `17-M8-golden-identity.log` | `b6914a1c2caa84836ded55c4b6daccbdd85296043980fac59fe4767541d86406` |
| `18-M9-vector-and-waveform-unit.log` | `2f566c1cf2b1d0de3ef74378b6ea79205f778f38d99edae695fed52853324c92` |
| `19-M9-Worker-and-workspace-integration.log` | `ca8cdb7de6e922c627ca5959c27b40d2ca1d916311d1262954df6797a1295034` |
| `20-M9-golden-identity.log` | `7b1d4aaf3705a92c84922ac818e5ed620974784fb3c49fcd5891f5043870a253` |
| `21-M10-structure-unit-and-golden.log` | `2580811b547bc0f67e70ddc8c4865489e0d690171b72e693cfc5e5b45df36b1c` |
| `22-M10-Worker-and-workspace-integration.log` | `fda67d847d864af613e02723c9a4a265bd4823cb3012e19da3c4dc0df9edcb20` |
| `23-M10-golden-identity.log` | `49e32bacc75d372acf4587d95d28a5eac7e3fa51c8aaf1fc51620d03c883f0db` |
| `24-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `25-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `26-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `27-M3-Chrome-regression.log` | `a3fcc06c7a77f1ba44a2fe4712a2941207952b9e823a3302fbd60faad0ee4075` |
| `28-M4-Chrome-regression.log` | `d46920c844dd524edfa3180ff6d2e8c3407c253d3b45deca654b6e8428f5eeb3` |
| `29-M5-Chrome-regression.log` | `e2db1c63334d16b5988eb91a4c7f22a2f44c4064c8654117d7e727bda137c556` |
| `30-M6-Chrome-regression.log` | `6cf95b169ac6277a601d33e2dd1872b2307fc914e24c1367b612fbed70075dc8` |
| `31-M7-Chrome-regression.log` | `36ccbf12c5d7fb7d739afc956ccd63b16be5dd887869d8358c5e3fbbd245789c` |
| `32-M8-Chrome-regression.log` | `5d140cf9ca85ab4a27583a2d43aafe92a10d1d1beb679d032a3592d6df7d1f14` |
| `33-M9-Chrome-regression.log` | `946822519d96b10d6695fe829ed160d255381602ca7132c61e1ba3e54bf15ac2` |
| `34-M10-Chrome-e2e.log` | `db0710b95454789a75e034cf27c63fbcb4ed75fc930fdf1ba35722cb963463de` |
| `35-build.log` | `b20f1294c51812e217cea60f6abc48935853e7c6ed7171d446dd2faba4b93458` |
| `36-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。M10 审批已完成；本地产物继续按 [eval plan](eval-plan.md) 的 retention 规则管理，commit、summary 或 artifact 身份变化时必须重跑 canonical。

### Open Gaps and Approval Gate

- `project-owner` 于 2026-08-25 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”M10 evidence 据此为 `approved`，M10 为 `Complete`，M11 门禁开放但开始实施前保持 `Planned`；本记录不补写 owner 未提供的逐项数值或学习解释。
- 该 M10 canonical 执行时 Edge 未安装；本记录本身不证明双浏览器矩阵，后续 M11 evidence 另行登记。
- 主 chunk 1,114.74 kB warning 与 R-019 保留；本 run 不构成 bundle readiness 通过。
- Meyda 5.6.3 的 `spectralFlux` 上游缺陷仍存在；产品改用 ADR-0005 项目实现，R-020 仅为产品侧 `Mitigated`。
- M10 四重卡 15 分钟场景证明渐进、反馈、long-task 与取消门禁；完整计算完成后的内存/缓存压力仍由 M11 继续验证。
- 本记录不创建或证明 release readiness，也不构成 Edge、M11 或发布通过。

## 14. M11 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M11-2026-08-25T10-05-12-783Z-99c67792` |
| Milestone | M11 — format, recovery, performance, resource and accessibility hardening |
| Evidence state | `approved` |
| Eval result | `pass`（38/38 steps） |
| Commit | `99c67792509d07456bcb431b90468252f8b0fdc3` |
| Commit at end | `99c67792509d07456bcb431b90468252f8b0fdc3` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-25 10:05:12.783 UTC |
| Method | `npm run eval:m11` |
| Reviewer | `project-owner` — approved 2026-08-26 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M11-2026-08-25T10-05-12-783Z-99c67792/` |
| Summary SHA-256 | `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5` |
| Provisional precursor | `M11-2026-08-25T09-47-44-125Z-1b3691f9-provisional`，38/38 pass，summary `e84e695f8cb328390e1843b03d7af5c6f619bd2d96442fd7d97799bef5287ad5`；只作 dirty-worktree 实现反馈 |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Vitest | `4.1.10` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `151.0.7922.174`；runtime UA `Chrome/151.0.7922.34` |
| Edge | Microsoft Edge `151.0.4129.107`；runtime UA `Edg/151.0.7922.34` |
| FFmpeg | `8.1.2` |
| Meyda | `5.6.3` |

本记录只写机型、芯片、核心数与内存；本地 artifact 内的序列号、UUID、UDID 和设备标识不得写入版本化文档。

### Results and Traceability

| Step | Result | Measurement |
| --- | --- | --- |
| Fixture / M3–M10 non-browser regression | pass | 26 个前置步骤全部通过；fixture 5/5、M3 unit 12/12、Worker 20/20、analysis 55/55；M4–M10 unit/integration/golden 无回归 |
| Docs / harness / typecheck | pass | 生命周期 frontmatter/链接与 21 项计数通过；deliberate failure 被检测；`vue-tsc -b` exit 0 |
| Chrome M3–M10 regression | pass | M3 6/6、M4 3/3、M5 3/3、M6 3/3、M7 5/5、M8 2/2、M9 2/2、M10 3/3 |
| Chrome M11 hardening | pass | 4/4；WAV/MP3/FLAC 切换、分析和刷新恢复；键盘播放/进度/音量/Analyzer seek、可见焦点与 reduced motion；quota 保留播放；390/1024/1280/1920 无横向溢出 |
| Edge M3–M11 matrix | pass | 31/31，真实 `msedge` channel；与 Chrome 相同的格式、播放、恢复、21 项 Analyzer、性能、资源和 M11 专项矩阵 |
| Clock and seek | pass | Chrome 60 秒漂移 3.5ms、seek 最大误差 66.827ms；Edge 漂移 4.133ms、seek 最大误差 61.494ms；均 ≤100ms |
| 15-minute base capacity | pass | Chrome/Edge 最大输入反馈 17.2ms/16.2ms；20 个进度样本单调；分析归因超过 50ms 的 long task 均为 0；取消成功 |
| 15-minute heavy capacity | pass | Loudness/Complex/Power/Buffer 四重卡；Chrome/Edge 最大反馈 17.9ms/17.2ms；分析归因超过 50ms 的 long task 均为 0；取消成功 |
| Analysis resources | pass | Chrome/Edge 的 M6 20 次循环均保持 1 live Worker、1 live AudioContext，RAF 区间 2–3 |
| Home/Analyzer resources | pass | Chrome/Edge 各 20 次路由循环均为 WebGL 21 created/20 lost、最终 1 个有效 context、2 live RAF |
| Build | pass with warning | 1818 modules；Worker 46.50 kB；最大 JS chunk 1,117.94 kB，R-019 warning 保留 |
| Diff / identity | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 |

自动化覆盖真实 Chrome/Edge、三格式、恢复、quota、unknown schema、21/21 Analyzer、最重性能、资源、键盘、焦点、reduced motion 和多视口。它没有自动操纵原生 OS 文件选择器或权限气泡，也没有替代 VoiceOver/Narrator 等辅助技术人工体验；`project-owner` 于 2026-08-26 以最终批准为这两项补偿门禁签字。本记录只登记人工检查通过，不补写用户未提供的逐项测量、浏览器提示文本或辅助技术输出。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5` |
| `01-fixture-hashes.log` | `f14ae96bca87160ba1012c774b9e801af6e1926ebd1ce1b19dcad33a63cacdc0` |
| `02-M3-unit-regression.log` | `d15c2ff91c8d7d76e0f59f5ee949159082cc090da52046bd9266c7a01f68788d` |
| `03-M3-worker-regression.log` | `3c66bf58e675312387360734162bf53b8577e17b5da156f8276854524a94bcef` |
| `04-M3-analysis-regression.log` | `c9af941f6579786592dcc3b074aeefe7219abd7aa212d3f0fcef06484fbf33cd` |
| `05-M4-AudioEngine-unit.log` | `233a60dd6d8d598542be6364406f72274e1d73f1f419786f63bb57d16b0a3125` |
| `06-M4-session-integration.log` | `2b81ab8b2977e30a13559a98b5583a8c9f2926b63139ff87ce891940cc5646cc` |
| `07-M5-repository-unit.log` | `fe2b49ce248284ec53831d3a2413247a675587bac2c246bc8dbe3a3696fc5429` |
| `08-M5-recovery-integration.log` | `e257c007005e7caed5c2f171c7db5a47eb59f44c339aea0ac76943cce080b3eb` |
| `09-M6-platform-unit.log` | `154851421d95a010fdc91bf889fc7e42e739d9fc9f8f6c407616770c37c96d40` |
| `10-M6-Worker-and-golden.log` | `092142e24d295c10aba4f14c6c401d30c4f3b10f23e5e2c48db7de70691ba8cb` |
| `11-M6-coordinator-integration.log` | `6d99bb5463abb539f226e8b4d617bb20a77435496a7241f05437bf433c2a99cc` |
| `12-M7-workspace-and-learning-unit.log` | `a00739b066982d8755dace75f9e15d8e9a276d777e8fb4d9a6e91fab8cedbce4` |
| `13-M7-workspace-integration.log` | `c47a3958e156800a1842d04232302b2c117ca31d6281dccf80495302eef79bbd` |
| `14-M7-golden-identity.log` | `e9c86c8566c4fa8dfe27f6033376965f08fff7eec487d4801cfb69077165d8a6` |
| `15-M8-scalar-unit-and-golden.log` | `9ad6603e54dbd7a2a6fa60ceb75d5c8e608f7e896a56124104f190ec375b3fbd` |
| `16-M8-Worker-and-workspace-integration.log` | `6d3b5ab5affd7d6cadb103dead4f3cc47a8595117a79732ff744608666b0587f` |
| `17-M8-golden-identity.log` | `b6914a1c2caa84836ded55c4b6daccbdd85296043980fac59fe4767541d86406` |
| `18-M9-vector-and-waveform-unit.log` | `82336cb74ea7d18e73ecb5d73d76578bd326590f26e6f5a317c282dd683f4253` |
| `19-M9-Worker-and-workspace-integration.log` | `995659f00e505360faac5662e6f5e0753741aa022d6a0653b4dd6eaac8532383` |
| `20-M9-golden-identity.log` | `7b1d4aaf3705a92c84922ac818e5ed620974784fb3c49fcd5891f5043870a253` |
| `21-M10-structure-unit-and-golden.log` | `9f696872f529c9f3d4a1ff12e7864f86e9217f99d373bf8d764b9c215dc939a1` |
| `22-M10-Worker-and-workspace-integration.log` | `61dcaa1194ed62ecc76f4e5b8f63d87f4f25a4c59776a9e30c76a5c1b0a416e4` |
| `23-M10-golden-identity.log` | `49e32bacc75d372acf4587d95d28a5eac7e3fa51c8aaf1fc51620d03c883f0db` |
| `24-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `25-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `26-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `27-M3-Chrome-regression.log` | `5ea68bece69ae8b615eff94200047b04edd4770a774a4f34a0ec65887152cd10` |
| `28-M4-Chrome-regression.log` | `3b9eeb992b013c7eb1093fa564472a64c7790dba05f907bf24fbcb8d0b46d6a8` |
| `29-M5-Chrome-regression.log` | `3ad71f01a34c46737a20118a172d7ee4da0a45070952bec9057f2117d00092bb` |
| `30-M6-Chrome-regression.log` | `c36037104b031416053aed76f3bcf91eb8e253f5381f2d1087433292ca48f8e9` |
| `31-M7-Chrome-regression.log` | `782be6c0bdb9b5cbad3f503852310b42cc5bc1d83d16dec1a39d4c149e101980` |
| `32-M8-Chrome-regression.log` | `a45bcf18c29109eacbf16090270c13a5dd7083fb99e790620468585fa4af8ec2` |
| `33-M9-Chrome-regression.log` | `92b96fd456521b9f17e233061da66a6594acaaafa79469770cf64f4fae5fd124` |
| `34-M10-Chrome-regression.log` | `97e71ceb97d84b92ec36692ea4b4a3ce72aa67f8104c0b2ebb575cbd87823553` |
| `35-M11-Chrome-hardening.log` | `4ba4a69aec7fa54559767da6a1f98628a5cb6929e364071dec1a54969e8cf0f7` |
| `36-M3-M11-Edge-matrix.log` | `6cc96b1853f2c17ca34ed9184f616e709b38082604dd293b613e5dca4fbcfb36` |
| `37-build.log` | `cd1972dc509ede0f29a8633e4f18504732483175d51ee7cf712f69a15b39ade4` |
| `38-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致；artifact 必须至少保留到 M11 审批与 release-readiness review 完成。

### Approval and Remaining Readiness Inputs

- 真实 Chrome/Edge 自动化矩阵已在 clean commit 上通过；EG-003 据此关闭。
- `project-owner` 于 2026-08-26 明确回复：“我批准 M11 canonical evidence、Edge 原生权限与最终加固结果；同意将 M11 标记为 Complete 并创建 release-readiness。”该签字补足 Edge 原生文件选择器/权限、文件移动与恢复访问，以及辅助技术和人工长会话的 M11 补偿门禁；未产生独立 artifact，也不把这些路径表述为自动化覆盖。
- 主 chunk 1,117.94 kB warning 与 R-019 保留；Meyda 5.6.3 `spectralFlux` 上游缺陷仍存在，产品侧继续由 ADR-0005 缓解。
- M11 为 `Complete`，本 evidence 为 `approved`。现在允许创建 `release-readiness.md`，但 readiness 在 owner 单独审阅豁免前必须保持 `in-review`，不得表述为正式上线授权。

## 15. M12 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M12-2026-08-28T07-30-39-789Z-be655e67` |
| Milestone | M12 — Analyzer measured masonry layout and header simplification |
| Evidence state | `approved` |
| Eval result | `pass`（12/12 steps） |
| Commit | `be655e6765a63493fb1a3a4ee99992073b06e54e` |
| Evidence registration commit | `db604b3b79fdf04a3d7c3ec5fcc2d5f3e3c77cfa` |
| Commit at end | `be655e6765a63493fb1a3a4ee99992073b06e54e` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-28 07:30:39.789 UTC |
| Method | `npm run eval:m12` |
| Reviewer | `project-owner` — approved 2026-08-28 via “自行提交并完成后续即可” |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M12-2026-08-28T07-30-39-789Z-be655e67/` |
| Summary SHA-256 | `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441` |
| Provisional precursor | `M12-2026-08-28T07-12-30-657Z-45f51908-provisional`，12/12 pass，summary `055951e16e9749bf89f189516f3975bb340721fe05e47922f5e34148ed47d9fd`；只作 dirty-worktree 实现反馈 |
| Failed canonical precursor | `M12-2026-08-28T07-25-22-951Z-b50c2c1e`，summary `dffbf4347450e5c5b9bbf233db831fdcd7ce1a9c098236a2876caa70669fa9d9`；M7 观察窗问题见 failure taxonomy，保持 `fail` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.64` |
| Edge | Microsoft Edge `151.0.4129.107` |

### Results and Traceability

| Step | Result | Measurement / trace |
| --- | --- | --- |
| M12 masonry unit | pass | 4/4；单列、双列、平局左列、动态高度重算、容器高度和无重叠；EV-B/EV-U，AC-U05/U06，R-028 |
| Docs / typecheck | pass | 生命周期 frontmatter/链接与 21 项计数通过；`vue-tsc -b` exit 0 |
| M7 Chrome regression | pass | 5/5；三项 exact cursor 在页面内 607.7ms 窗口各 14 次、上限 20；seek 2.2ms；15 分钟最大反馈 16.9ms、归因长任务 0 |
| M8/M9/M10 Chrome regression | pass | 2/2、2/2、3/3；累计 21 项、四卡、四视口、vector/structured/错误隔离无回归；15 分钟四重卡最大反馈 18.8ms、归因长任务 0 |
| M11 Chrome hardening regression | pass | 4/4；三格式、恢复、键盘/reduced motion、quota 和 20 次路由资源回归；WebGL 21 created/20 lost、2 live RAF |
| M12 Chrome masonry | pass | 3/3；开场文案不存在、状态 live region/sticky、四视口最短列、空槽/四卡/增删替换、details/focus/Canvas/seek/zoom、renderer failure 与 Observer/RAF 清理 |
| M12 Edge masonry | pass | 3/3；与 Chrome 相同的 M12 success、failure、boundary、exception 契约在真实 `msedge` channel 通过 |
| Build | pass with warning | 1845 modules；Worker 49.62 kB；最大 JS chunk 1,284.55 kB、gzip 392.06 kB；R-019/W-001 继续披露 |
| Diff / identity | pass | `git diff --check` exit 0；起止 commit 相同且工作树干净 |

M12 不改变路由、Pinia/IndexedDB schema、四槽持久化、分析/音频接口或 `MeydaCard` props。四个 slot 0–3 DOM 保持稳定，视觉只更新绝对定位包装层；TestLands 与 `@chenglou/pretext` 未修改。双浏览器场景证明实际 DOMRect 的 390/1024 单列、1280/1920 双列、18px gap、容器包围和无相交，并证明动态高度变化不关闭 `details`、不丢失焦点或 Canvas。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441` |
| `01-M12-masonry-unit.log` | `51d6f96d1019a31815eb8e0f93a4aa7552c603725b6aff6cd2e029aa4303e43d` |
| `02-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `03-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `04-M7-Analyzer-Chrome-regression.log` | `6d55f8c187b33058db6f0afde61de71c5c5404b1064312abfaaa0d9ac40a07a7` |
| `05-M8-Analyzer-Chrome-regression.log` | `c98f943f6ba5713c7ca0dce742f2a2fbc5ac633908790257298224f00af9092e` |
| `06-M9-Analyzer-Chrome-regression.log` | `f6fa4627c3e87e0ba1fcdd3f4e150191be868caa9faf17bb4be037a683030c73` |
| `07-M10-Analyzer-Chrome-regression.log` | `12996d7edb4abf570a7bc2447459d870bfb8a8b9b192166677fa5e43200b0d7a` |
| `08-M11-Chrome-hardening-regression.log` | `8bb534224849e15572dbbd991a2a6e675b3741229a32be1df5a2642d39bdafa9` |
| `09-M12-Chrome-masonry.log` | `a6326aa0d51039444df922288daec65fd333f2697c93bcab7d28df251b1df2ec` |
| `10-M12-Edge-masonry.log` | `65ce111f0a899d5a256a513af9db361a83aae04c72afc3e5388a45b9d43f50b1` |
| `11-build.log` | `73c7e9121fd45ab77c8ac9de48b6a20ed711e419096f55f9fd230cc4f6772e37` |
| `12-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

`summary.json.sha256` 已独立核对并与 `summary.json` 一致。通过 run 与首轮失败 run 的本地 artifact 均保留；后者用于证明 failure instance 的发现、修正和关闭过程。

### Approval and Remaining Boundary

- `project-owner` 于 2026-08-28 明确要求 agent 自行提交并完成后续；canonical 通过后，本 M12 evidence、R-028 缓解和 readiness 复核据此获批准，M12 改为 `Complete`。
- 首轮 canonical 的 M7 空计数不是产品 cadence 失败，而是短 fixture 已接近 ended 时观察窗没有游标更新；`be655e6` 在计数前 seek 到 0 并确保 playing，目标场景连续 5/5、完整 M7 5/5 和第二次 canonical 12/12 通过。
- 正式上线仍由 PROD-015 阻断；本 evidence 不选择托管平台、不发布 URL，也不扩大到 Editor readiness。

## 16. M13 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M13-2026-08-31T17-44-39-680Z-63c04005` |
| Milestone | M13 — All cards collapsed with FIFO active analysis |
| Evidence state | `approved` |
| Eval result | `pass`（17/17 steps） |
| Implementation commit | `63c04005670145d83ee181d474197bce921c5300` |
| Evidence registration commit | 本记录所在的 `docs: register Analyzer M13 canonical evidence` 提交 |
| Commit at end | `63c04005670145d83ee181d474197bce921c5300` |
| Dirty at start / end | `false` / `false` |
| Started at | 2026-08-31 17:44:39.680 UTC |
| Method | `npm run eval:m13` |
| Reviewer | `project-owner` — approved via M13 指令中的“自行提交并完成后续”授权 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M13-2026-08-31T17-44-39-680Z-63c04005/` |
| Summary SHA-256 | `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc` |
| Provisional precursor | `M13-2026-08-31T17-40-46-300Z-e62140ee-provisional`，17/17 pass，summary `4225440e6782c2aca5a3b13803059b7aefbdad210d134aa64235175389be33e2`；只作 dirty-worktree 实现反馈 |
| Harness failure precursor | `M13-2026-08-31T17-27-10-749Z-e62140ee-provisional`；前 13 步通过后日志文件名 `/` 未清理导致 runner 中止，目录保留且不冒充产品 failure |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.64` |
| Edge | Microsoft Edge `152.0.4191.53` |

### Results and Traceability

| Step group | Result | Measurement / trace |
| --- | --- | --- |
| M13 unit / integration | pass | 16/16 + 12/12；FIFO、唯一性、V1 adapter、串行 save/revision、quota 与 Coordinator generation/cache |
| M7–M11 Chrome regression | pass | 5/5、2/2、2/2、3/3、4/4；三格式、21 项、共享 viewport/seek/exact、quota、20 次资源循环；15 分钟最大反馈 `17.5ms`、归因长任务 0 |
| M12 Chrome / Edge | pass / pass | 各 3/3；21 wrapper 四视口最短列、动态高度、details/focus/Canvas、renderer failure、masonry/card Observer 和 RAF 清理 |
| M13 Chrome / Edge | pass / pass | 各 2/2；21 张稳定卡、默认 0 Canvas、快速十连切换后四张/八 Canvas、第五项 FIFO、焦点、刷新前后单 Worker/精确值和 FIFO 年龄恢复 |
| Editor E7 isolation | pass | unit 2/2、integration 4/4；Analyzer M13 未破坏已批准的 Editor lease/renderer 边界 |
| Build | pass with warning | 1846 modules；Worker 49.62 kB；最大 JS chunk `1,292.10 kB`、gzip `393.75 kB`；R-019/W-001 继续披露 |
| Docs / typecheck / diff / identity | pass | lifecycle links/21 feature count、`vue-tsc -b`、`git diff --check`；起止 commit 相同且工作树干净 |

M13 固定渲染 `FEATURE_IDS` 顺序的 21 个 wrapper，新工作区活动队列为空；卡片收起态只有输出类型、标题、简介与展开按钮。展开时才挂载 Canvas、精确值、明细与卡片 Observer；最多四项，展开第五项以一次 reducer 提交淘汰 FIFO 队首。运行时使用 `activeFeatureQueue`，V1 `activeCards` 只作兼容 carrier，workspace 写入由不可变快照、串行队列和 revision guard 保证最新状态获胜。

### Local Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc` |
| `01-M13-queue-and-masonry-unit.log` | `068761f5fff5683762a88cf4cc754c6278554c5d58a27d17a73a0d5c98f79fbc` |
| `02-M13-workspace-and-coordinator-integration.log` | `d7b6d9fdf631e80ccc67ae2019ff444b817029d99410e010c0005d5b00c6aef8` |
| `05-M7-Analyzer-Chrome-regression.log` | `d7f1ec1da608846b75a46551c46a62447c600f4b6702281ae67f86574bf0a281` |
| `08-M10-Analyzer-Chrome-regression.log` | `bf377fbc74fb014f5878e4b71ea3c09cf27bf931b046e667ce906f56baf3c00a` |
| `09-M11-Chrome-hardening-regression.log` | `5c3934636db890f08b537894901fc7a6ca6eaa7f0ca8b5a83c418fd94757f2c0` |
| `10-M12-Chrome-masonry-regression.log` | `3d0114d957fcabff7d9ac8a2584e98bde46d172780f7dcc9cb6d4d094fa8a078` |
| `11-M12-Edge-masonry-regression.log` | `de8c8191119526783b72d8f7fbff58ed3ae5b168ccf58b9cc1a2595c303fec39` |
| `12-M13-Chrome-FIFO.log` | `c6ee7b4f1d755c5e8ece799a5bd15924451e4387bb924c360db4ae82d0b16ed4` |
| `13-M13-Edge-FIFO.log` | `d38983400f25830ca433d9d107da332ace5f84607eb28a730512c609861618f2` |
| `14-E7-lease-renderer-unit-regression.log` | `f2384d7f0d09ea8ca7198b19f58cf3e015f8b7ebf894dec46553b0fa608d465a` |
| `15-E7-lease-renderer-integration-regression.log` | `3573cc23235956b77cb6643726286e2eac2d898a05984d14845632f4e6b2a936` |
| `16-build.log` | `103092a3de50497ff6531210ec64c12ffb2bc128393c4d04c338bd31f39e89eb` |
| `17-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Approval and Remaining Boundary

- `project-owner` 已批准 M13 计划并授权 agent 自行提交、完成 canonical 与后续 evidence/readiness；本 clean run 满足该门禁，因此 M13 为 `Complete`，R-028/R-029/R-030 为 `Mitigated`。
- M14 只保留拖动排序后续项；本候选没有三横图标、拖动、顺序 schema 或提前持久化。
- 正式上线仍由 PROD-015 阻断；本 evidence 不推送、不部署、不创建生产 URL，也不扩大到 Editor readiness。
