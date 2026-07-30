---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-30
upstream_docs:
  - "docs/quality/eval-plan.md"
  - "docs/quality/golden-examples.md"
  - "docs/quality/failure-taxonomy.md"
  - "docs/delivery/milestone-plan.md"
  - "tests/fixtures/fixture-manifest.json"
next_action: "M6 已关闭；M7 门禁开放但保持 Planned，下一步制定并执行 M7 三卡学习切片"
---

# Evidence Index

## 1. Purpose and Gate State

本文件保存受版本控制的长期证据摘要；原始日志保存在 Git 忽略的本地 artifact 目录。M3 测试基础切片、M4 AudioEngine 切片、M5 hybrid recovery 切片和 M6 analysis platform 切片均已由 `project-owner` 批准。M6 已为 `Complete`；M7 门禁开放但仍为 `Planned`，直到明确开始实现。

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
