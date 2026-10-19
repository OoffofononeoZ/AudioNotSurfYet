# Analyzer 历史证据索引

整理核查日期：2026-10-19。本次只核对和精简既有记录，未重跑历史评估。

M3–M14 已批准；最新历史候选为 M14。当前单列/FIFO 和 Wallpaper 频谱采用现行页面契约，不继承旧候选 readiness。

原生权限：M5 Chrome 于 2026-07-29、M11 Edge 于 2026-08-26 由 owner 人工批准；OPFS/stub 自动化不替代这些人工操作。M7 的 L1/L2/L3 为 owner 3/3，不外推学习效果；解释分别是音量增加、音级 C+E→G+B、谐波增多。

Meyda spectralFlux 上游错误仍存在，项目 Flux 只缓解产品侧。M14 的 W-001/W-002 随 chunk/runner 变化复核后接受，其余 W-001–W-007 边界见 [readiness](release-readiness.md)。PROD-015 继续阻断上线。

## 记录边界

- 下列结果、环境、保留状态均是原运行时的登记，本次未重新确认本地产物是否仍存在。
- 仅保留 canonical 身份、环境、批准来源和关键媒体 hash；重复步骤/日志清单与已结束调试过程可用 Git 查看整理前的 `ac25c2a:docs/quality/evidence-index.md`。原始 artifact 不改名、不覆盖、不删除。
- summary hash、候选 commit 和 run 必须共同匹配，历史 pass 不证明当前源码、其他设备、整体 readiness 或生产发布。

## 2. M3 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M3-2026-07-28T06-39-59-221Z-17d16f0d` |
| Milestone | M3 — Test foundation and fixtures |
| State | `pass`（仅 M3 test-foundation scope） |
| Commit | `17d16f0da37289c1f67f75203502beef999572ea` |
| Dirty at start | `false` |
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

## 7. M4 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M4-2026-07-29T03-32-15-929Z-e5cfe9e8` |
| Milestone | M4 — Single AudioEngine and shared store |
| State | `pass`（M4 适用子集；已批准） |
| Commit | `e5cfe9e8ab62301f3c5b0ddcdd37847a2e131a0f` |
| Dirty at start / end | `false` / `false` |
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

本记录来自干净 commit，13/13 步骤通过且没有 failure instance。`project-owner` 于 2026-07-29 明确批准本 M4 evidence 与 [working agreements](../context/working-agreements.md)；M4 据此改为 `Complete` 并开放 M5。该批准不构成 M5、Edge、完整 EV-B 或 release readiness 通过。

## 8. M5 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M5-2026-07-29T07-08-25-199Z-c90a3c57` |
| Milestone | M5 — IndexedDB hybrid recovery |
| State | `pass`（M5 适用子集；已批准） |
| Commit | `c90a3c5738de5b7a4efb7eb24cddc49da3713b44` |
| Dirty at start / end | `false` / `false` |
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

本记录来自干净 commit，16/16 自动化步骤通过且没有 M5 门禁内 failure instance。`project-owner` 于 2026-07-29 确认原生权限人工检查通过，并明确批准本 evidence 与 [working agreements](../context/working-agreements.md)。M5 据此改为 `Complete` 并开放 M6；该批准不构成 M6、Edge、完整 EV-A–EV-R 或 release readiness 通过。

## 9. M6 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M6-2026-07-30T02-19-07-149Z-a39256ff` |
| Milestone | M6 — Worker platform and feature registry |
| State | `pass`（M6 适用子集；已批准） |
| Commit | `a39256ff7afdd4167bfdebdd693bcc8b3ba20e94` |
| Dirty at start / end | `false` / `false` |
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

本记录来自干净 commit，20/20 自动化步骤通过且没有 M6 门禁内 failure instance。`project-owner` 于 2026-07-30 明确回复：“我批准 M6 canonical evidence、working agreements、system map 与 glossary；同意将 M6 标记为 Complete 并开放 M7。”据此本 evidence、[working agreements](../context/working-agreements.md)、[system map](../context/system-map.md) 与 [glossary](../context/glossary.md) 改为 `approved`，M6 改为 `Complete`，M7 门禁开放但仍保持 `Planned`，直到明确开始实现。本批准不构成 Edge、M7 UI、完整 EV-A–EV-R 或 release readiness 通过。

## 10. M7 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M7-2026-07-30T03-30-43-095Z-f022b86e` |
| Milestone | M7 — RMS, Amplitude Spectrum, Chroma vertical slice |
| State | `pass`（M7 适用自动化与 owner 学习任务；`approved`） |
| Commit | `f022b86e2333ad612ecb12701b0ca05e49f2b256` |
| Dirty at start / end | `false` / `false` |
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

owner 随后明确回复：“我批准 M7 canonical evidence，同意将 M7 标记为 Complete 并开放 M8。”据此本记录改为 `approved`，M7 改为 `Complete`，M8 门禁开放。该批准不构成 Edge、M8、M9、release readiness 或四项新 UI 问题已通过。

## 11. M8 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M8-2026-08-21T03-23-18-552Z-d6dcf715` |
| Milestone | M8 — UI hardening and remaining scalar features |
| Evidence state | `approved` |
| Eval result | `pass`（28/28 steps） |
| Commit | `d6dcf715be2e6675224f079b954e2b1b544bbebd` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m8` |
| Reviewer | `project-owner` — approved 2026-08-21 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M8-2026-08-21T03-23-18-552Z-d6dcf715/` |
| Summary SHA-256 | `bc624121e9479d62c2519ab7d2cf60a2bd8d7f7affd44a2128f645ce642f34ef` |

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

- Windows Chrome 的 sticky、歌曲列表层级、连续按钮 pressed 恢复和两类精确值滚动条已由 owner 人工批准；R-021 关闭。该签字不替代未来相关改动后的回归。

- `project-owner` 于 2026-08-21 明确回复：“我批准 M8 canonical evidence 与界面稳定化结果；同意将 M8 标记为 Complete 并开放 M9。”据此本记录改为 `approved`，M8 改为 `Complete`，M9 门禁开放但在实现开始前保持 `Planned`。

## 12. M9 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M9-2026-08-21T09-14-14-110Z-f88ca331` |
| Milestone | M9 — non-home Header blur, Power Spectrum, MFCC and Buffer |
| Evidence state | `approved` |
| Eval result | `pass`（32/32 steps） |
| Commit | `f88ca33149619b1a71eb30d74a1b8e266fb41a65` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m9` |
| Reviewer | `project-owner` — approved 2026-08-23 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M9-2026-08-21T09-14-14-110Z-f88ca331/` |
| Summary SHA-256 | `acb9ced1b448671955704efe33d846cd06059f6a8fd1343fb50f7a847672220e` |

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

- `project-owner` 已签字确认前述 Windows Chrome 导航栏视觉、学习任务与四卡/视口清单通过；本记录不补写用户未提供的逐项数值或解释原文。

- `project-owner` 于 2026-08-23 明确回复：“我批准 M9 canonical evidence 与非首页导航栏模糊效果；同意将 M9 标记为 Complete 并开放 M10。”M9 evidence 据此为 `approved`，M9 为 `Complete`，M10 门禁开放但编码前保持 `Planned`。

## 13. M10 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M10-2026-08-22T18-25-01-873Z-8830e2a2` |
| Milestone | M10 — Loudness, Complex Spectrum and 21/21 Analyzer coverage |
| Evidence state | `approved` |
| Eval result | `pass`（36/36 steps） |
| Commit | `8830e2a2edddd9a5db4796ec6f5d5da8ee3c5f72` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m10` |
| Reviewer | `project-owner` — approved 2026-08-25 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M10-2026-08-22T18-25-01-873Z-8830e2a2/` |
| Summary SHA-256 | `30eb11b9985adc8c6d84e01b84f31a75785a4d8e39bdef22e85dd153f2637ea1` |

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

- `project-owner` 于 2026-08-25 明确回复：“我批准 M10 canonical evidence 与 21/21 Analyzer 特征覆盖；同意将 M10 标记为 Complete 并开放 M11。”M10 evidence 据此为 `approved`，M10 为 `Complete`，M11 门禁开放但开始实施前保持 `Planned`；本记录不补写 owner 未提供的逐项数值或学习解释。

## 14. M11 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M11-2026-08-25T10-05-12-783Z-99c67792` |
| Milestone | M11 — format, recovery, performance, resource and accessibility hardening |
| Evidence state | `approved` |
| Eval result | `pass`（38/38 steps） |
| Commit | `99c67792509d07456bcb431b90468252f8b0fdc3` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m11` |
| Reviewer | `project-owner` — approved 2026-08-26 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M11-2026-08-25T10-05-12-783Z-99c67792/` |
| Summary SHA-256 | `7d637525b5c9e6aa6fb45dc0818ac1fb59bbef90b90abf3ed2d6e6119ac631b5` |

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

- `project-owner` 于 2026-08-26 明确回复：“我批准 M11 canonical evidence、Edge 原生权限与最终加固结果；同意将 M11 标记为 Complete 并创建 release-readiness。”该签字补足 Edge 原生文件选择器/权限、文件移动与恢复访问，以及辅助技术和人工长会话的 M11 补偿门禁；未产生独立 artifact，也不把这些路径表述为自动化覆盖。

## 15. M12 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M12-2026-08-28T07-30-39-789Z-be655e67` |
| Milestone | M12 — Analyzer measured masonry layout and header simplification |
| Evidence state | `approved` |
| Eval result | `pass`（12/12 steps） |
| Commit | `be655e6765a63493fb1a3a4ee99992073b06e54e` |
| Evidence registration commit | `db604b3b79fdf04a3d7c3ec5fcc2d5f3e3c77cfa` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m12` |
| Reviewer | `project-owner` — approved 2026-08-28 via “自行提交并完成后续即可” |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M12-2026-08-28T07-30-39-789Z-be655e67/` |
| Summary SHA-256 | `76ffab8e9fd5db6370c22aa78c7ee08a0708d7a5d97e1b749fca284d4c696441` |
| Failed canonical precursor | `M12-2026-08-28T07-25-22-951Z-b50c2c1e`，summary `dffbf4347450e5c5b9bbf233db831fdcd7ce1a9c098236a2876caa70669fa9d9`；M7 观察窗问题见 failure taxonomy，保持 `fail` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.64` |
| Edge | Microsoft Edge `151.0.4129.107` |

- `project-owner` 于 2026-08-28 明确要求 agent 自行提交并完成后续；canonical 通过后，本 M12 evidence、R-028 缓解和 readiness 复核据此获批准，M12 改为 `Complete`。

## 16. M13 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M13-2026-08-31T17-44-39-680Z-63c04005` |
| Milestone | M13 — All cards collapsed with FIFO active analysis |
| Evidence state | `approved` |
| Eval result | `pass`（17/17 steps） |
| Implementation commit | `63c04005670145d83ee181d474197bce921c5300` |
| Evidence registration commit | `6a46ae57231c7983338c8d064c2d7aba85eee42c` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m13` |
| Reviewer | `project-owner` — approved via M13 指令中的“自行提交并完成后续”授权 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M13-2026-08-31T17-44-39-680Z-63c04005/` |
| Summary SHA-256 | `25732179105b31b7bb05dfdb6626db1264567208a505a7cbf71434a4562e2afc` |
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

- `project-owner` 已批准 M13 计划并授权 agent 自行提交、完成 canonical 与后续 evidence/readiness；本 clean run 满足该门禁，因此 M13 为 `Complete`，R-028/R-029/R-030 为 `Mitigated`。

## 17. M14 Canonical Run Record

| Field | Value |
| --- | --- |
| Run ID | `M14-2026-09-01T02-36-49-995Z-0e991307` |
| Milestone | M14 — Accessible card reordering and persistence |
| Evidence state | `approved` |
| Eval result | `pass`（19/19 steps） |
| Implementation commit | `0e991307d9045a1ec84ddaae0515612240894a92` |
| Evidence registration commit | `5a272f2cfdffab1917de55bf74b4909789d5e9b5` |
| Dirty at start / end | `false` / `false` |
| Method | `npm run eval:m14` |
| Reviewer | `project-owner` — approved via 完整 M14 实施指令与“自行提交并完成后续”授权 |
| Retention | `local-present` |
| Artifact root | `artifacts/evals/M14-2026-09-01T02-36-49-995Z-0e991307/` |
| Summary SHA-256 | `b169d6ff082746fc3cbe5ac6064151233c4f2869cba6e41f9dcdd7d052916fcc` |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2 (`25F84`), Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`；Apple M1 8-core；16 GB memory |
| Node / npm | Node `v24.18.0`；npm `11.16.0` |
| Playwright Test | `1.62.0` |
| Chrome | Google Chrome `152.0.7977.65` |
| Edge | Microsoft Edge `152.0.4191.53` |

- `project-owner` 批准完整 M14 计划，并已授权 agent 自行提交、执行 canonical 与完成后续；本 clean run 满足该门禁，因此 M14 为 `Complete`，R-031/R-032/R-033 为 `Mitigated`。
