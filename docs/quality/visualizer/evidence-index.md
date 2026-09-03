---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-04
upstream_docs:
  - "docs/quality/visualizer/eval-plan.md"
  - "docs/quality/visualizer/golden-examples.md"
  - "docs/quality/visualizer/failure-taxonomy.md"
  - "docs/quality/visualizer/v2-eval-plan.md"
  - "docs/quality/visualizer/v2-golden-examples.md"
  - "docs/quality/visualizer/v2-failure-taxonomy.md"
  - "docs/quality/visualizer/v3-eval-plan.md"
  - "docs/quality/visualizer/v3-golden-examples.md"
  - "docs/quality/visualizer/v3-failure-taxonomy.md"
  - "docs/quality/visualizer/v4-eval-plan.md"
  - "docs/quality/visualizer/v4-golden-examples.md"
  - "docs/quality/visualizer/v4-failure-taxonomy.md"
  - "docs/quality/visualizer/v5-eval-plan.md"
  - "docs/quality/visualizer/v5-golden-examples.md"
  - "docs/quality/visualizer/v5-failure-taxonomy.md"
  - "docs/quality/visualizer/v6-eval-plan.md"
  - "docs/quality/visualizer/v6-golden-examples.md"
  - "docs/quality/visualizer/v6-failure-taxonomy.md"
  - "docs/delivery/visualizer/milestone-plan.md"
next_action: "V1–V6 canonical 与人工门禁均已批准；进入独立 Visualizer release-readiness review"
---

# Visualizer Evidence Index

## Current Gate

- V0-P、V0-A、V0-D：`Complete`。
- V1：`Complete`；clean canonical 21/21 与适用人工门禁已由 owner 批准。
- V2：`Complete`；clean canonical 26/26 已获 owner 批准；V3–V6：`Complete`，各自 canonical 与人工门禁已获批准。
- R-034–R-041 均为 `Mitigated`；整体 readiness 与生产上线仍需独立批准。
- Analyzer/Editor canonical 是相邻回归，不能替代 Visualizer evidence。

## Record Contract

每个 V 里程碑记录 run ID、实现 commit、证据 commit、clean identity、浏览器/Node/npm/Meyda、脱敏硬件、步骤结果、布局/资源指标、日志与 summary SHA-256、失败分类、未自动化项目及 reviewer 状态。原始 artifact 保存在 Git 忽略目录直到审批完成。

## V1 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V1 — Workspace foundation |
| State | `approved` |
| Implementation commit | `fd44c8921a534c22b2362ccffff7ec9e46f3ff02` |
| Evidence commit | 本记录所在的 `docs: register Visualizer V1 canonical evidence` 提交 |
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

### Result Summary

- V1 golden、project unit、foundation integration、Chrome 和 Edge 专项全部通过：unit 12/12、integration 7/7、Chrome 4/4、Edge 4/4。
- `/visualizer/:trackId?`、Header 当前歌曲入口、有效 route 的 MusicBar 隐藏、Visualizer `pause-at-end`、Editor `repeat-one` 回归和旧 token 隔离均通过自动化。
- strict `VisualizerProjectV1`、两模板 descriptor、参数范围/source/projection 约束、最多四项唯一分析特征、单草稿、quota/abort、同歌恢复和异歌冲突状态机通过自动化；V1 不获取 analysis consumer，也不启动 Visualizer Worker。
- 1280/1920 三栏、1024 互斥抽屉、单一 16:9 中性 Canvas、键盘/焦点及 route generation 通过 Chrome/Edge 专项。
- Chrome 与 Edge 的 20 次生命周期均记录 `baselineFrames=1`、`workersCreated=0`、`liveAnimationFrames=1`、`previewCanvases=1`，没有 Visualizer Worker、第二 Canvas 或场景 RAF 累积。
- M3/M4/M5/M11、Editor E1/E7 相邻回归全部通过；M4 drift 为约 7.2 ms，最大 seek error 为 66.827 ms。
- build 通过，共转换 1855 modules；analysis worker 49.62 kB。最大 JS chunk 为 1,339.49 kB（gzip 407.46 kB），既有 chunk-size warning 继续保留，不能表述为已解决。
- dirty-worktree provisional `V1-2026-09-02T03-12-25-678Z-1ebda007-provisional` 亦为 21/21，summary SHA-256 `48bfeb91b47c43c402671154a25cc10731f0bf7e884c0d9e60990acd9ea8d835`；它只作为实现过程证据，不能替代 clean canonical。

### Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `14c9ed2258baf6c9a2a3a20dfcaba65a0c643029f8510a1d9e4c6662c9c90300` |
| `01-V1-golden.log` | `e550b619b37b0353c9d54da07ca1e271f7bfbe264fafe60c0f65a300048a6be0` |
| `02-V1-project-unit.log` | `02ff6ff5fa3ea196803352a31a6694ee1b0637b9a5fa56cd7c877b824136e08b` |
| `03-V1-foundation-integration.log` | `94d9478837de34dd551f680b0236aa44f4b9656fecc760e36649cc7df01bf2ed` |
| `04-V1-Chrome.log` | `089110779685b5cc604209bdc69ee3e14b19f3f42529b9a3b9a5902c54c5dfe7` |
| `05-V1-Edge.log` | `fefd1e3bcc19020d73b11d75d64dae2b5c65a8e7f7b0aa3358eb55bfd6906ace` |
| `06-M3-Chrome-smoke.log` | `4d79467c6296868fefbf95c04dc450dd64bc60a823430ed51822ecb26b48ea0b` |
| `07-M4-engine-and-session-regression.log` | `257c38ebdb1c984954f837e2ea0255e78fb19ce46b1fa67460787b9f9812b3c5` |
| `08-M4-Chrome-regression.log` | `07c3599157789420f8148aa6baeb455ca5bc5469913a71f2caec2fa6fb6f2711` |
| `09-M5-repository-and-recovery-regression.log` | `07594b95e86f66eaf0439dc71cfb0315f45be575e11598dd5bb9b5030d3379ce` |
| `10-Editor-E1-project-unit.log` | `f958c630372f7a2f0666a92d3291968a86083b1732c58c78bd57d80664854166` |
| `11-Editor-E1-integration.log` | `a07dbdffdff37844c285e2705aa11fe1cc08f1b6e3f85364336bbdf38e3121ab` |
| `12-Editor-E1-Chrome.log` | `fcbf039eb025f3346d5f78908098122f3894c4245efbb651a8049ea89b556d94` |
| `13-Editor-E7-unit.log` | `425eaa9ef41a46f3db1acc07dbf89fdfdbb34b55545e76011498a4e4c2e88609` |
| `14-Editor-E7-integration.log` | `bf684a3cabe1d868764fb478bf8f0741cbb5330a95bd4c969e8fe779022fb0f3` |
| `15-M11-Chrome-resource-regression.log` | `cdb9ed3dd18e1e0f2b2f981c4958e56c64f151b3dd3cc2ba62529b9ee9542ab1` |
| `16-M11-Edge-resource-regression.log` | `1b2af532cbfe5dc1cf0e328a3a814408b366d1bd754fcfa663a830f94257f992` |
| `17-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `18-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `19-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `20-build.log` | `f081c6d338e3a67faeca1191ef49bd7a7cab3449636f785b904d73b474e8e7ce` |
| `21-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Review Result and Boundary

- 原生 OS 打开/保存 picker、取消、覆盖提示与 `beforeunload` 不能由 Playwright 完整控制；owner 于 2026-09-02 对适用人工门禁完成签字。本记录只登记批准，不补写用户未提供的逐项数值或文案。
- 本记录不证明 V2 动态绑定、V3/V4 场景、V5 WebM 或 V6 最终加固；中性预览明确不是完成场景。
- V1 canonical identity、artifact 与 hash 保持不变，无需重跑；V2 已另行建立 quality contract 与 canonical evidence。

### Owner Approval

2026-09-02，`project-owner` 明确回复：

`我批准 Visualizer V1 canonical evidence、工作台、pause-at-end lease、JSON V1 与草稿恢复结果；同意将 V1 标记为 Complete 并开放 V2。`

## V2 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V2 — Data binding |
| State | `approved` |
| Implementation commit | `769faafeef576bf9b98a95f6904cdb9886298530` |
| Evidence commit | 本记录所在的 `docs: register Visualizer V2 canonical evidence` 提交 |
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

### Result Summary

- V2 golden 2/2、binding unit 6/6、integration 5/5、Chrome 3/3、Edge 3/3 全部通过；V1 的 21 步基线及 M3/M4/M5/M11、Editor E1/E7 相邻回归一并通过。
- constant、analysis、editor-event inspector，21 项 FeatureRegistry 的 scalar/component/vector projection、固定变换顺序和 binding-local error 隔离均通过版本化 golden 与 unit/integration。
- 0–4 唯一 FeatureId、共享引用去重、第五项在工程和 Coordinator 前拒绝、最后引用释放及 Visualizer consumer 离页释放均通过；没有增加第二个 Worker、AudioContext、播放时钟、Canvas 或 RAF。
- 同歌 Editor 草稿/JSON、project snapshot 优先、point `1/60s` impulse、range `[start,end)`、whole-lane OR/max、错歌/损坏原子拒绝及明确 reload/import/remove 均通过。
- 60Hz 绝对时间 resolver、1 秒 checkpoint、point 默认 120ms release 与连续播放/seek/reset 后相同结果通过；V2 不轮询 exact cursor，Buffer compact projection 只使用 `[min,max]` envelope pair。
- Chrome 的 inspector 可见反馈为 9.2ms，Edge 为 6.8ms，均低于 100ms；V1 Chrome/Edge 的 20 次 route lifecycle 仍为 `workersCreated=0`、`liveAnimationFrames=1`、`previewCanvases=1`。
- M11 Chrome/Edge 三格式、quota、reduced motion、焦点、390/1024/1280/1920 geometry 与 20 次 WebGL route resource 回归均通过。
- build 通过，共转换 1862 modules；analysis worker 49.62 kB。最大 JS chunk 为 1,369.26 kB（gzip 415.87 kB），既有 chunk-size warning 继续保留，不能表述为已解决。
- dirty-worktree provisional `V2-2026-09-02T08-41-41-727Z-5b7ad7c5-provisional` 亦为 26/26，summary SHA-256 `eee4a9752dbf831d6c05f545c35179f0fe564f2dfe41adcc39ee08bc65f7befd`；它只作为实现过程证据，不能替代 clean canonical。

### Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `18b7d83d68f068ac615c56e1bb844a3c80bb1460ac884116d94cb460dd07bafb` |
| `01-V2-golden.log` | `567784b7aefd6b6d78a3f616a2c52a9c8b7d42aa2bb28d2240773ba8a097c1c2` |
| `02-V2-binding-unit.log` | `ebf15f901a5ea419ee67aacf844598a44200f85143708e28e76606c1838d5ff9` |
| `03-V2-binding-integration.log` | `afdd98d4730d644f62d63a6318f78fe80ee59e919b16596a3cb854bc06e0f619` |
| `04-V2-Chrome.log` | `a5b4571f51d21290a256ba1ee181d51c6698397091511343428f2d4daf554e8b` |
| `05-V2-Edge.log` | `76e51032012073aff0fcae40d1e0c8a27032529f027582017b084cdc090d747f` |
| `06-V1-golden.log` | `87d5d3a887b4fe6b9816e5dfc789d7c29b994df7938a5ac8acea11c8341809fe` |
| `07-V1-project-unit.log` | `365ece94401d21215ae87936fbbc55b49ad5b6ea23f5f70f090d0b0b968943cd` |
| `08-V1-foundation-integration.log` | `47d5abc42a546a8f2861ec75c72b59aafda2cf7184d195d69f92af65a54d338d` |
| `09-V1-Chrome.log` | `6a4303e818b3dcdca2b372df54d24b2582a5cfc31eb49dbdb48eb0e58a941ad7` |
| `10-V1-Edge.log` | `5925524983883c30cb90dc51f9ff141a9db24f7a972fecca3866bd063117514d` |
| `11-M3-Chrome-smoke.log` | `c91409bfeb659b42acff045b670a370d68fc349299cec9bff79536fa20b2f1ee` |
| `12-M4-engine-and-session-regression.log` | `74f73bdf2bdbda235af4fec3ee0034ad89853fe07734a51f0158b851110574bc` |
| `13-M4-Chrome-regression.log` | `05ebca99c16eb8c294604f8937338ef13e5a382216b56cc5b45ed270ebcde4cd` |
| `14-M5-repository-and-recovery-regression.log` | `dba20787de78a7f2eb3301180e2c5f5de7046dbd1133eeb19596cffd7a41b68a` |
| `15-Editor-E1-project-unit.log` | `256948cba2d3d31f93994c63d46e5169b1b4a0b67fc883e761ea1f2f7de34a2e` |
| `16-Editor-E1-integration.log` | `f44f4dfaa0ddf22ca4d8bb13465ade41e9bbc079411c7d3a0ceb40fcdc949c39` |
| `17-Editor-E1-Chrome.log` | `7580fa7476bd9b2927a02b46fb8c304169373a369e801cbf0fb5bd865d24b603` |
| `18-Editor-E7-unit.log` | `007d6e527b86adf5a56dc3e29ca254fb0555fc1f104c2ceed239702b2d1b982c` |
| `19-Editor-E7-integration.log` | `4a0cc21f7105d469b37d6e2e6e975bc65c4dcec80ffe8180ac90e7eb0dcefffd` |
| `20-M11-Chrome-resource-regression.log` | `e2d2648c3e20cc82140b2fd91bf97f8996a395566d17c721401890412db9736d` |
| `21-M11-Edge-resource-regression.log` | `a0e9b25c8c2540ff8a65da86f173bb208e61027995ebf9ef6a7fe7e3de61bb6a` |
| `22-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `23-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `24-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `25-build.log` | `adeddd111c51d81ad714d87deee8a1aaf4f4d9ccfdd2fdd3515a7eac8a288209` |
| `26-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Review Boundary

- 原生 Editor JSON picker 的选择、取消和权限由 OS 对话框拥有，自动化使用受控文件入口验证解析与原子性；owner 本次批准未补写用户未提供的逐项人工观察值。
- V2 的中间 Canvas 继续是中性预览；本记录证明数据绑定和 resolver，不证明 V3 Orthogonal Lines、V4 Cube Swarm、V5 WebM 或 V6 最终加固。
- V2 记录建立时，R-035、R-036 依据 planner、projection、Editor snapshot、原子导入与双浏览器证据改为 `Mitigated`；当时 R-037、R-038 仍等待 V3 证据，当前状态以后续 V3 record 为准。
- V2 canonical identity 保持不变且无需重跑；只有 commit、run ID、summary 或 artifact 身份变化时才重跑。

### Owner Approval

2026-09-02，`project-owner` 明确回复：

`使用项目相关技能执行此计划`

本批准关闭 V2、开放 V3，并接受现有 canonical evidence；不补写批准原文未提供的人工观察值，也不构成 V3/V4 场景、V5 WebM、V6 readiness 或生产上线通过。

## V3 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V3 — Orthogonal Lines |
| State | `approved` |
| Implementation commit | `89be30eb23d4e53d2c38f24e111cd1af7ec0840d` |
| Evidence commit | 本记录所在的 `docs: register Visualizer V3 canonical evidence` 提交 |
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

### Result Summary

- V3 golden 2/2、scene unit 4/4、renderer integration 5/5、真实 Chrome 2/2 通过；V2 固定 26 步基线全部通过，完整 canonical 为 30/30。
- Orthogonal Lines 在单一 16:9 Canvas/RendererHost/WebGLRenderer 上渲染；横竖参数、constant/analysis/Editor point/range、固定 60Hz 余辉、一秒 checkpoint、seek/刷新 frame hash、暂停单帧、DPR/resize 和键盘路径均由专项覆盖。
- Chrome 自动观测画面反馈 `1.10ms`、设置反馈 `2.30ms`、中心像素 `[31,215,109,255]`；20 次 route/template 循环后为 1 Canvas、1 active host、1 active renderer、0 pending visual RAF，scene created/disposed 为 21/20，target resolve/rendered frame 为 51/51，最大 Visualizer frame 工作 `3.40ms`。
- Cube Swarm 仍是 V4 中性预览；模板切换保持同一 host/renderer/canvas 并释放旧 scene。故障注入验证 scene 错误层与重试，transport、模板、工程和草稿保持可用。
- V1/V2、M3/M4/M5/M11 与 Editor E1/E7 相邻回归、docs、deliberate-failure harness、typecheck、build 和 diff check 均通过。build 转换 1866 modules；最大 JS chunk 为 1,381.47 kB（gzip 419.91 kB），既有 chunk-size warning 保留，不能表述为已解决。
- 最终 dirty-worktree provisional `V3-2026-09-02T13-25-25-465Z-75cbf292-provisional` 亦为 30/30，summary SHA-256 `20452afedc68ab351647464c3e6c3335e1e6def0290c2ba1d35105004648a46d`；它只作实现反馈，不替代本 clean canonical。

### Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `afe4cbe233fe1feded65380d6e976d5a4c32c2f9860fe2e0357a0d615d6a7b84` |
| `01-V3-golden.log` | `82099657ea7beaec2925bf298ba1d91ea0010b2bacffa5b0d345e25d5a931fee` |
| `02-V3-scene-unit.log` | `e3dc472ef809039805583d2871c1aca2ffe2a099da0a93c452dbc7f13a8d037c` |
| `03-V3-renderer-integration.log` | `35e86d3d9be810e517ae356b4d3642e94b6145352a77dd731f457edfd02205f1` |
| `04-V3-Chrome.log` | `cf775d2324e0f4d4e93a8b4331aa97321214df57e402a61adbaecf513d4f5038` |
| `05-V2-golden.log` | `c1714d2ab14ac29255e730ee1effe186ec5604a79d1892a9b58e24d7680622b0` |
| `06-V2-binding-unit.log` | `2b7cdab8fe6124f728a525ad97692c79a3477d3a9b0b9b4f0085a8a5fe2a1560` |
| `07-V2-binding-integration.log` | `89e7694cd562528a4f983380c0dbd67bf753a6276e6b1d8f37241ca9d0644ad5` |
| `08-V2-Chrome.log` | `436633825ea018ef97adfd9517989f2b11a32aefd415923eb5b56b088f1e48a5` |
| `09-V2-Edge.log` | `b079d1c59d129791761b446ab1fe9cf832df761ce0d500a2e6124078e919db55` |
| `10-V1-golden.log` | `dd1134ccbe5861e4db3505fe301db8646ceaa050b8d1bedc3743e9acf3ec704e` |
| `11-V1-project-unit.log` | `a734196f48758f8a781d08eddfe236e0519e4b1b0b17b64b1fe71c8cfc64dc8b` |
| `12-V1-foundation-integration.log` | `c1f71ac50269e2492399e19f13de063e93cc6ccaffc98062a646a26c53b183e0` |
| `13-V1-Chrome.log` | `d9626126dc9e8737cc0c77cdb4eb396363b503911cf2cca7809d0080d14373ff` |
| `14-V1-Edge.log` | `b8fc958de77b4666a7e651a145051fab82fdc0993615824dcfc1e893c2a8768b` |
| `15-M3-Chrome-smoke.log` | `6321abf5860fe28a36ef33befc279633717ad75355310ecf9ebaf4484f5587a6` |
| `16-M4-engine-and-session-regression.log` | `8b1952bdf15db19c2ad4283c48e68984d4d61b4db3eaef36f0ea986741fb53d3` |
| `17-M4-Chrome-regression.log` | `7a4d0a902b82d488779a4993803a96ebc5068e0e08b8654cd3a4a9811686dc77` |
| `18-M5-repository-and-recovery-regression.log` | `fd11b1423980779edae6d0a3bdb363f22ebdb0c149ca8334b952dd163d80108a` |
| `19-Editor-E1-project-unit.log` | `f49d1e38a2da688f41a1abd8898de7c4d1b3921cf19beb3c226b5624b8a3fc1d` |
| `20-Editor-E1-integration.log` | `62654aebd50aa9796f92d277bc66c2355149c2ebab1677b5d55ed062943a86b0` |
| `21-Editor-E1-Chrome.log` | `fabd60867a3eea44651a5786608748080db597b5458215f0cf3acf67bea8a445` |
| `22-Editor-E7-unit.log` | `51f6e88a358e97618e5c8ec146ee40441dcd964c369a14466ea2d201a6578c07` |
| `23-Editor-E7-integration.log` | `f1ce3788b3bfa75ab395d03a5b66a0f4976b04bf017e97fe2074010bcefea083` |
| `24-M11-Chrome-resource-regression.log` | `992bd6345922fd5baefdfd92322b3d70fc4c82d6cf726fdf36ec66fba61639e9` |
| `25-M11-Edge-resource-regression.log` | `56f4efa07d1fcace6e57cb4ee061cfb88262e58495d9dcbf597bcae6f0f55d9f` |
| `26-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `27-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `28-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `29-build.log` | `3b81b45585f9642a28f5c5e9a87e0d8a3494af8c69ba9a42c01774f9c9d0325a` |
| `30-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Review Boundary

- `project-owner` 于 2026-09-03 明确批准 Visualizer V3 canonical evidence、Orthogonal Lines 场景、确定性余辉与单 RendererHost 结果，并同意关闭 V3、开放 V4。
- 自动中心像素、state hash 和资源 counter 证明受控输入有输出且满足代码契约，不替代最终视觉审美、GPU/驱动长会话或辅助技术人工判断。
- R-037、R-038 依据 clean canonical 与 owner 人工验收改为 `Mitigated`；后续场景变更仍需作为回归风险持续验证。
- V1/V2 canonical identity 不变且无需重跑；本记录不证明 Cube Swarm、WebM、V6 readiness 或生产上线。

### Owner Review Status

已批准。`project-owner` 原文：

`我批准 Visualizer V3 canonical evidence、Orthogonal Lines 场景、确定性余辉与单 RendererHost 结果；同意将 V3 标记为 Complete 并开放 V4。`

## V4 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V4 — Cube Swarm |
| State | `approved` |
| Core feature commit | `9581730498a470e3fbd81c97414cb26087714009` |
| Canonical implementation commit | `5c2d24a3f1f413dba236563b3686237c6b8f2e21` |
| Evidence commit | 本记录所在的 `docs: register Visualizer V4 canonical evidence` 提交 |
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

### Result Summary

- V4 golden、scene unit、renderer integration 和真实 Chrome 专项全部通过；V3 固定 30 步前向基线亦全部通过，完整 clean canonical 为 34/34。
- Cube Swarm 的 64-band 对数频谱核心、seed 外围布局、Energy 上升、默认 constant 轨道、显式 orbit 改绑、descriptor 默认降级、默认两项 active analysis 与持久化 binding 保留均由 golden/unit/integration/Chrome 覆盖。
- 连续播放、direct seek、暂停与刷新在同一绝对时间得到相同 renderer-neutral hash；rise/orbit 使用固定 60Hz、一秒 checkpoint 和 binding revision identity，不读取 RAF delta。
- Chrome 自动观测画面反馈 `13ms`、设置反馈 `10.70ms`，低/高 Energy resolved rise 分别为 `0.41889` 与 `3`；均满足 `<=100ms` 设置反馈和 `<50ms` Visualizer frame 工作门禁。
- context loss/recovery 后保持 1 active host、1 active renderer、0 pending visual RAF，scene created/disposed 为 3/2，resolve/render 为 45/45，context loss/restore/failure 为 1/1/0，最大 frame 工作 `15ms`。测试只排除浏览器在受控 `WEBGL_lose_context` 注入时产生的预期平台级 `CONTEXT_LOST_WEBGL` 警告；应用 console error 与 pageerror 均为 0。
- 20 次 Orthogonal/Cube 模板切换后保持 1 Canvas、1 active host、1 active renderer、1 active visual RAF，scene created/disposed 为 42/41，resolve/render 为 97/97，最大 frame 工作 `13.60ms`；没有资源单调累积。
- V1–V3、M3/M4/M5/M11 与 Editor E1/E7 相邻回归、docs、deliberate-failure harness、typecheck、build 和 diff check 全部通过。build 转换 1867 modules；最大 JS chunk 为 1,398.38 kB（gzip 423.91 kB），既有 chunk-size warning 保留，不能表述为已解决。
- dirty provisional `V4-2026-09-02T17-36-29-618Z-151ca0bc-provisional` 为 34/34，summary SHA-256 `4d0f0c591ced70d17742ff56a5dc390146cfb2de70e642675dd79a903c3c6a40`；它只作实现反馈，不替代本 clean canonical。
- 首次 clean run `V4-2026-09-02T17-42-53-826Z-95817304` 因 V2 Edge 测试中“同歌草稿”strict locator 同时命中状态文案和按钮而失败，summary SHA-256 `7a6bb15264e3231c08ea6a01eb0f16ff112b5f72665c9fbc403560ffe0ef51df`。该 artifact 不归入 V4FT-* 产品失败，保留为 harness selector failure；commit `5c2d24a3f1f413dba236563b3686237c6b8f2e21` 将断言收窄到 inspector 文案后，V2 Edge 3/3 和本次 34/34 clean canonical 通过。

### Artifact Hashes

| Artifact | SHA-256 |
| --- | --- |
| `summary.json` | `9b2a86e3dcdd4e634317c4234418dc3444da441a3be805a980562768dba5c3b2` |
| `01-V4-golden.log` | `48b5588b468185fa590d4e65bc00b7aabe2d9c2e4fd5ac585dbee79e367ca75c` |
| `02-V4-scene-unit.log` | `7ede4fcc9537640925473f64789390895e42fc3fd4cdd5646ec86abf0f09a660` |
| `03-V4-renderer-integration.log` | `6b06e35be23dc3a70ae9a105512f2d95443868e743951f43093b1c6d6cf52e3b` |
| `04-V4-Chrome.log` | `fbf53f8817ca4853466301aa25ed49c089f00cd8eac084a3c9cf75085ec3120c` |
| `05-V3-golden.log` | `fe0a73e11acaaac10fe9252f4822bd45504cb127bcd969be82102d0a3ab083aa` |
| `06-V3-scene-unit.log` | `7aa26191b2523de87d0b37caac844fae2f058afc3ff0fccdbecef4a04be5699f` |
| `07-V3-renderer-integration.log` | `8ac4e728aff3d13135bfc4d4a6b1b6c19d0aee256f2675e7afb01cf4ed3ba41a` |
| `08-V3-Chrome.log` | `71b8b19f38b22fbc31f0779bf07f4919c147f245e919956d54495d9f34b50cb1` |
| `09-V2-golden.log` | `b3ad627b351e21586da7097c202fe83da5de31ee9d03df1f1a6edbf2a060c9ac` |
| `10-V2-binding-unit.log` | `b010e628310a55cf7fd2a33412a1a3d57f4de6ce138b8c2bc94e5029cad5e5fc` |
| `11-V2-binding-integration.log` | `1fe55219838e00701130eada67d4bbdb3e028fbef3443c3ae87fd25f96267fa4` |
| `12-V2-Chrome.log` | `f9b56df1d392277fa4813cb9ab91cd1a63f56d546157af86a9184550a57ba69d` |
| `13-V2-Edge.log` | `cae97b402181f4a848f904b310a64f28a636191c1eac4133fb4ec125bfd3daf2` |
| `14-V1-golden.log` | `b743d3b085d264dc2ddd835397fdcac9ac089268363b66947db3e5e931ab7067` |
| `15-V1-project-unit.log` | `225a2331fe8d4248adc81894f0d813227f5e359bbadfa70a3949f77272e2c70d` |
| `16-V1-foundation-integration.log` | `fedad224be51ab66c7bb0e256c5f4ad93920810097dc6944a26b336249e01277` |
| `17-V1-Chrome.log` | `12ce3e9d6d3b994b36fb25ce5ccc84c0d23b8dc9abf84855583387b4f2cc537e` |
| `18-V1-Edge.log` | `2b0f512eeb6716de09f898021ef7b079b94f78548b12196f6135c32653108598` |
| `19-M3-Chrome-smoke.log` | `849acbd80398da3d51fbfee39831e71d42901147525a81a8595dbd15e8feeb0b` |
| `20-M4-engine-and-session-regression.log` | `78862d62caee8a8aacd4a16f406220dc89367bcc5dd9ae8916a460540152b402` |
| `21-M4-Chrome-regression.log` | `6d8084d2104535ebcc7cfe42bc6fff14704af3939b1e8c4867229089e52b62b5` |
| `22-M5-repository-and-recovery-regression.log` | `e8a5a693fa99dda8e2c4a94cebd264167d2ea085d6ea369601c80305a5f68cd6` |
| `23-Editor-E1-project-unit.log` | `595da56d35711dc4a9db62c433bf93152f5979a3409adf4a241221ff2a51c330` |
| `24-Editor-E1-integration.log` | `854969ab2b3c2e4ea0712fd10686d2154fd215bc3b128b517e3a5360ab0c4784` |
| `25-Editor-E1-Chrome.log` | `8e0c02c0a897d37452dce4afa70ddd9697c58db4f8e147c82201627427fb76e3` |
| `26-Editor-E7-unit.log` | `9b0443afe3493e49062086851999cb486744f1c68f41d3e2b188d05752443a1f` |
| `27-Editor-E7-integration.log` | `462e7c3dfeb9edbaa5c54e855eae7319bfe2590ffa5411295c4e5075033fd39a` |
| `28-M11-Chrome-resource-regression.log` | `15b4b74ab228ea5ef2d9cefb2f910d52630303359cb210719b92a19756837840` |
| `29-M11-Edge-resource-regression.log` | `a2b264afeee58e1e1217d14770df0ec0d71395d3031bb1a538d9eb5cccf5c8f7` |
| `30-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `31-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `32-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `33-build.log` | `b21bb4546895c041a4ceaef92352307b1130c717a02741217fe8eb31a8bdc042` |
| `34-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Review Boundary

- 自动化已固定核心环几何、参数隔离、两项默认分析、seek/refresh hash、20 次切换与 synthetic context recovery；它不替代 Cube 最终构图、运动审美、真实 GPU/驱动长会话和辅助技术的人工作业。
- owner 必须在最新版 Chrome 人工确认核心频谱环、外围上升方块和三颗卫星；默认 active analysis 恰为 Amplitude Spectrum 与 Energy；drum 只影响 coreScale、Energy 只影响 riseSpeed、orbit 默认恒定且改绑后只影响轨道；seek/刷新确定性、20 次切换和 context recovery 可接受。
- R-039 保持 `Open`，因为 V4 synthetic recovery 不能覆盖全部 GPU/驱动故障，且 V5 录制期间 context loss 的 abort/discard 尚未实现。V4 已关闭，V5 为 `In Progress`，V6 保持 `Planned`。
- V1–V3 canonical identity 不变且无需重跑；本记录不证明 WebM、录制状态机、V6 readiness 或生产上线。

### Owner Review Status

`project-owner` 于 2026-09-03 明确批准关闭 V4 并开放 V5。该批准接受既有 34/34 canonical 与人工门禁，不补写用户未提供的额外观察值；V4 标记为 `Complete`，R-039 按剩余录制风险保持 `Open`。

## V5 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V5 — Realtime WebM export |
| State | `approved` |
| Implementation commit | `9b5af09c5846415a8e5465e710e6095f1e7db310` |
| Evidence commit | 本记录所在的 `docs: register Visualizer V5 canonical evidence` 提交 |
| Run ID | `V5-2026-09-03T03-49-31-211Z-9b5af09c` |
| Canonical result | 40/40 passed |
| Clean identity | start/end commit 均为 `9b5af09c5846415a8e5465e710e6095f1e7db310`；start/end dirty 均为 `false` |
| Summary SHA-256 | `cec1fab0310852458c2aa4fbd3bebc90eee3e213a54b7695a524736e07b07b7b` |
| Artifact root | `artifacts/evals/V5-2026-09-03T03-49-31-211Z-9b5af09c/` |
| Reviewer | `project-owner` — pending |

### Environment

| Item | Recorded value |
| --- | --- |
| OS | macOS 26.5.2, build 25F84, Darwin arm64 |
| Hardware | MacBook Pro `MacBookPro17,1`, Apple M1, 8 cores, 16 GB memory |
| Node / npm | Node v24.18.0 / npm 11.16.0 |
| Browsers | Chrome 152.0.7977.66 / Edge 152.0.4191.53 |
| Media / render / test runtime | FFmpeg/ffprobe 8.1.2 / Three.js 0.183.2 / Vitest 4.1.10 / Playwright 1.62.0 |

硬件只登记机型、芯片、核心数和内存；artifact 中的序列号、UUID 或设备标识不进入版本化证据。

### Result Summary

- V5 golden 2/2、recording unit 13/13、integration 2/2、真实 Chrome 1/1、真实 Edge 1/1 和媒体核验全部通过；V4 固定 34 步基线亦全部通过，完整 clean canonical 为 40/40。
- Chrome 与 Edge 均在页面音量为 0 时分别生成 Orthogonal Lines 和 Cube Swarm 的 720p30 WebM；四个文件均为单 VP9 视频轨加单 Opus 音轨、严格 1280×720、平均 30fps。720p60、1080p30、1080p60 在两个浏览器均于资源获取前返回 typed `preset-unavailable`，没有先录制再降级或追记 unavailable。
- 四个文件时长为 3.007–3.009 秒，A/V 结束差为 25–29ms，最大视频 packet gap 为 40–41ms；页面静音后的音频 peak RMS 为 `0.766425`。Orthogonal 的音频 burst 与中心亮闪峰值差在 Chrome/Edge 分别为 2ms/3ms，满足 `<=100ms`。
- Chrome/Edge 故障矩阵均记录 4 次 recorder start、2 次完整 finalize、2 次 abort 与 3 次保存尝试；context loss/restore/failure 为 1/1/0。结束后 active recording tap、MediaRecorder、capture stream、audio/video track 和 ready Blob 全部为 0，保持 1 host、1 renderer、1 visual RAF；最大 Visualizer frame 工作均为 14ms。
- pre-Gain 单 holder、页面音量隔离、播放 checkpoint、准备回滚、活动取消、context/renderer/track/identity/recorder 错误、双层命令锁、ready Blob 保存取消/失败重试、同 Canvas 精确尺寸恢复与 20 次生命周期资源对称性均由 unit/integration/浏览器覆盖。未完成录制没有产生 ready 半文件。
- 1024/1280/1920、capture DPR 1、键盘启动、状态文字/`aria-live`、站内离页决策和 renderer retry 通过双浏览器专项；console error 与 pageerror 为 0。原生 OS picker 的真实交互与最终人工回放仍保留 owner 门禁。
- V1–V4、M3/M4/M5/M11 与 Editor E1/E7 相邻回归、docs、deliberate-failure harness、typecheck、build 和 diff check 全部通过。M4 60 秒 drift 为 3.5ms，最大 seek error 为 61.494ms；build 转换 1870 modules，最大 JS chunk 为 1,424.40 kB（gzip 431.20 kB），既有 chunk-size warning 保留。
- 最终 dirty provisional `V5-2026-09-03T03-41-28-599Z-cc83d8b1-provisional` 为 40/40，summary SHA-256 `511ddf9557005b5bd3ffe08f697a34cb3353070812aa43a20d0dae9914d41a33`；它只作实现反馈，不替代本 clean canonical。
- 较早 provisional `V5-2026-09-03T03-15-10-729Z-cc83d8b1-provisional` 暴露 optional preset packet cadence 不稳定及并行 E8 文档链接窗口，summary SHA-256 `7fadc017232ea7d79fe8463732c18ab9abfc3a4389d192ded973fbd5ceec37eb`；据此把三个 optional preset 固定为 preflight unavailable。`V5-2026-09-03T03-38-32-968Z-cc83d8b1-provisional` 暴露串行 Playwright webServer 端口延迟释放，summary SHA-256 `6b514961cd9e4a71345861887f88d6c599aad5b75c45e8dab3c8450ac6047a79`；runner 改为逐 E2E 隔离端口后最终 provisional 与 canonical 均通过。

### Canonical Media Hashes

| Browser / scene | WebM SHA-256 |
| --- | --- |
| Chrome / Orthogonal Lines 720p30 | `612abd2826afdfcbe7ac407872984954c677d35e42991d05dfa84fcccf183316` |
| Chrome / Cube Swarm 720p30 | `01efc152c230748eabc594db527ca7ce1a343a85af71f98d0b7c837d7a73601f` |
| Edge / Orthogonal Lines 720p30 | `d9a8a61fa4df268dad88be55bf194b3f60141fb80d64413e0f6dd77e66a8a9f7` |
| Edge / Cube Swarm 720p30 | `2863587dd2556d962dd183ce7bcee4aea19e0469059e233222b89ebef9431978` |
| `media/sync-report.json` | `dffd4820ec3b2640d23ee7a0c91953e5ba6f6dea09368fa74b784f346b13575d` |

### Canonical Step Hashes

| Artifact | SHA-256 |
| --- | --- |
| `01-V5-golden.log` | `3cc4b58c713e2a5ad1906e773c5ed5f75065697fdbb65173ad85e1ab525e7e9f` |
| `02-V5-recording-unit.log` | `be86765d5d2f80abb7e9a14691132cb43fa370acd1398a36aa4a6a86b3a155c0` |
| `03-V5-recording-integration.log` | `fba8449f336b561f99e7568501afaea2011ea191e6746de2d20705ac5f8b75f9` |
| `04-V5-Chrome.log` | `0c58245c5cc5592e00e74663ac35625e214e6d773ddd756fcac42b552971f1f9` |
| `05-V5-Edge.log` | `ced22075585822056706e871f5a4a34a52bc44a51f020d714ace8bcd21cfe76c` |
| `06-V5-media-verification.log` | `813aa14af758b89980974979348e231d58c889832fce2b06fd8dd05e77bd5871` |
| `07-V4-golden.log` | `0176d70fc858b0150d88accf5d475afcbbea4a34ccb41070fb801234c4892423` |
| `08-V4-scene-unit.log` | `560726c229466b6dea14c091377a1a953dc1fa2043f3f6cdc2b8b7af426896c4` |
| `09-V4-renderer-integration.log` | `db492fb18f9af39782378221997baefad15e0eb32988f67926b554a407345560` |
| `10-V4-Chrome.log` | `964df4f502a61772fd8a5af0e961c1d6feedce907bbf9857b307c39d1ede091d` |
| `11-V3-golden.log` | `36988834bd90d57a41a9f5714f3fd024a8ff59b56955ca1d8cf091e96f5025f9` |
| `12-V3-scene-unit.log` | `56e00acb640f6eb53061957c0d666421a8d4806b640fa300d3232d4a725e2d69` |
| `13-V3-renderer-integration.log` | `0fd5284ab184728750595672a64be0c0a5e4b1cc7a8f30b4c29b7b6e5018b320` |
| `14-V3-Chrome.log` | `8832848fd163f529fe89535fe9c1ad9c37ee2c658922a1b116f2ec2bfa37e73d` |
| `15-V2-golden.log` | `b0cb4bd69944ca231a624998e9ec1a62a090b2406c5e6effc5ed8ebad0b3c793` |
| `16-V2-binding-unit.log` | `c25232736b9850088a1ae6fe7790e4b84f3ae6015996e758fdefee130c56f9b6` |
| `17-V2-binding-integration.log` | `5f54d56ca3437c2b943660b075a9322a24d8025d6d504a8815b6fd2886b09f30` |
| `18-V2-Chrome.log` | `1f6426827e8a469782882a0dc3d43e8ef5b7664c0a033fc824ee6374ed7bd1cc` |
| `19-V2-Edge.log` | `50b43c0d23a4088fd0af637d38a57d0fc69e4e167122b9fd17126ec307b15c92` |
| `20-V1-golden.log` | `0ed2734ef7cc42964f2bb0fa4d0539e3cda07b66099780af1172e673da66c984` |
| `21-V1-project-unit.log` | `e8acacaaa66d287e74509a25f230bc26dfd85fef15b73eedb6e6d1b24ddb6633` |
| `22-V1-foundation-integration.log` | `3cd50d3994e7ba1b97088b192ad604952b85fbd96687955c947a6283d8a26104` |
| `23-V1-Chrome.log` | `29771d35a4f1eace1484b9523a9f55b9a2b6b53f6c54302c55cf2a89f6758eb8` |
| `24-V1-Edge.log` | `24756967a8149ad1eb6b6291cc61d8835ce6c7eb31f97b431e1f021ac9762164` |
| `25-M3-Chrome-smoke.log` | `93172cddc43c82b22ec47504414fc05c529ef437fe571fc594b218ac67ff7977` |
| `26-M4-engine-and-session-regression.log` | `1e034bcf2abf9af310eac04362f30fceddb62021295a003ce00e2317b89f9817` |
| `27-M4-Chrome-regression.log` | `03fa439cf470a73ec68590c6ef619b37b523deeb65040f310e233533e792df9f` |
| `28-M5-repository-and-recovery-regression.log` | `2ca744297d2d3752e6543afe1843b824ddadeb10ab4c58eee6cecfd42a902362` |
| `29-Editor-E1-project-unit.log` | `c5631d727643e2433e4988d369b02abe65e32b3dca521b9147fd9c426972b8bf` |
| `30-Editor-E1-integration.log` | `00824441b08f35480afa04db81a6bb12a91a7ea3a597c1df40b5638db85721bf` |
| `31-Editor-E1-Chrome.log` | `ba871b736800095e6ef208906957a45c73fa1567a1469cb342476e6207ee48c1` |
| `32-Editor-E7-unit.log` | `66eaef39fcc70a7234b1fde8b920db74c441445623c009ee2fcfe8856c6fe2c1` |
| `33-Editor-E7-integration.log` | `5cebe1a1880574f7f4592e0968fa4ca33e091503fff8fd5c1629bd0fd04c467b` |
| `34-M11-Chrome-resource-regression.log` | `0f708aed6dc0e348271aea5c371209a7b6ac3db290a3d9f464c3db554a0332cd` |
| `35-M11-Edge-resource-regression.log` | `d5c8bf706f77c3e87a2d2e56323631664feb4987a0b3a5003f59e67fcc1a8425` |
| `36-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `37-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `38-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `39-build.log` | `2698a3e998bcc5f2a83a691cbf75767a27393ad84221866fdd7b1ec25e37966f` |
| `40-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |

### Manual Gaps and Review Boundary

- 自动化证明了默认 720p30 双浏览器文件事实、页面静音仍有音轨、事件同步、命令锁、取消/context/renderer 清理、保存失败重试和资源边界；它不能替代 owner 对最终文件的实际回放、构图审美或 OS picker 权限/取消/覆盖流程。
- owner 已在本轮批准 Chrome/Edge 默认 720p30 回放、页面音量 0 音轨、Orthogonal burst/flash 同步、录制锁、取消/context 清理，以及真实原生保存、picker 取消和失败重试人工门禁；不补写 owner 未提供的主观数值。
- V5 为 `Complete`、evidence 为 `approved`；R-039/R-040 为 `Mitigated`，V6 为 `In Progress`。R-041 仍由 V6 长时压力覆盖。
- V1–V4 canonical identity 保持不变且无需重跑；本记录不证明 15 分钟 1080p60、V6 overall readiness 或生产上线。

### Owner Review Status

2026-09-03，`project-owner` 明确“批准 V5”，并以实施计划确认该批准覆盖上列人工边界。canonical identity、artifact 和 hash 保持不变且无需重跑；本批准不构成 V6、整体 readiness 或生产上线通过。

## V6 Canonical Record

| Field | Value |
| --- | --- |
| Milestone | V6 — Final hardening |
| State | `in-review` |
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

### Result Summary

- V6 golden 3/3、unit 3/3、integration 10/10、真实 Chrome 2/2、真实 Edge 2/2 和六文件 media verification 全部通过；V5 的 40 步完整基线及 M6/M14 八项显式关键回归亦全部通过，完整 clean canonical 为 54/54。
- Chrome/Edge 均完成 MP3 四特征 Cube、WAV Editor Orthogonal、FLAC 模板 4→2→4 恢复后的 Orthogonal 录制；六个文件均为单 VP9 视频轨加单 Opus 音轨、严格 1280×720。平均帧率为 29.337–30fps，最大相邻视频 packet gap 为 98ms，满足 DEC-048 的平均 30fps `±5%` 和最多四个目标帧间隔门禁。
- 六文件容器时长与 4/4.032 秒 source 的差均不超过 27ms，A/V 结束差为 5–96ms；所有音轨非静音，RMS 为 0.261–0.270、peak 为 0.691–0.709。V5 未放宽的同步回归仍以最多两帧 packet gap 通过，Orthogonal 音频 burst 与中心亮闪差为 Chrome 37ms、Edge 32ms。
- V6 录制期间 Canvas 渲染 cadence 为 59.001–60.134fps，最大 scene frame 为 Chrome 33ms、Edge 28.8ms；900 秒四特征压力中的最大 scene frame 为 Chrome 12.7ms、Edge 14.4ms，最大反馈为 24.1ms/28.2ms，scene/transport 与播放时钟偏差不超过 0.334ms，分析归因 long task 为 0。
- Chrome/Edge 各执行 20 次 Visualizer/Analyzer/Editor/Home、模板、录制、歌曲恢复与周期性 context loss/restore。最终各保持单 AudioContext、Worker、Canvas、WebGL context、Visualizer host/renderer/RAF，recording resources、live media tracks 与 Blob URL 均为 0；受控故障没有产生 ready 半文件。
- MP3/WAV/FLAC route、paused refresh、工程导入导出、错歌拒绝、Cube 四特征、Orthogonal 双特征、模板恢复、1024/1280/1920、DPR 1/2、键盘/焦点、文字状态、reduced motion、context recovery、坏 JSON、quota、stale/cancel、无 MIME、preset unavailable、recorder/renderer failure 均由 unit/integration/双浏览器专项覆盖，console error 与 pageerror 为 0。
- M6 900 秒回归最大反馈为 16.6ms、分析归因 long task 为 0，20 次资源循环保持单 Worker/AudioContext；M14 的 21 卡片排序、FIFO 隔离和 Chrome/Edge 资源回归均通过。docs、deliberate-failure harness、typecheck、build 和 diff check 全部通过；build 转换 1871 modules，最大 JS chunk 为 1,427.74 kB（gzip 432.16 kB），既有 chunk-size warning 保留。
- 修订后的 dirty provisional `V6-2026-09-03T16-21-25-320Z-088f21d3-provisional` 为 54/54，summary SHA-256 `58af3b253562f2db04aaa692b81e221186f5ba58f1d087ef56fa1f4d222f75d1`；它只作实现反馈，不替代本 clean canonical。
- 较早 clean 尝试 `V6-2026-09-03T10-25-21-807Z-088f21d3` 在 DEC-048 前因 135ms 视频 packet gap 未通过并提前停止，没有 canonical summary；artifact 保留且不登记为通过。随后关闭 MSAA、设置 `motion` hint、采用等价 Cube 计算优化并按 owner 对小幅卡顿的取舍登记 DEC-048，最终在独立提交和新 run 上通过。

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

### Canonical Step Hashes

| Artifact | SHA-256 |
| --- | --- |
| `01-V6-golden.log` | `ee87c907bb926856b1bf5b3eb80348c23a7c212b461477d146d9cb1d677d381f` |
| `02-V6-unit.log` | `50a25eecf95f5e4f2f04e11fbd06479b56e007b6600683e1405cfb8f89c6ddb5` |
| `03-V6-integration.log` | `59778c0bfe229c6bc1c167f7102ea6104896a8c502f93ff308fdc1b84229a872` |
| `04-V6-Chrome.log` | `3c84945b4fe1e6823e9ce85b735b736551db9193f06b5b79f42cd8ecfdb10ad5` |
| `05-V6-Edge.log` | `87193431ab02a0140b4dc10e8e02a46d068c07f01c02eb53f450a49043170abe` |
| `06-V6-media.log` | `5dca27c0489c5afe3255253e579f6fef3f75dfece7b77c6d5b42a60cd5ed71bc` |
| `07-V5-golden.log` | `4d24f0b5b3b99375cbfdb69da9730f1c2e71c1fc82f425dd4c7dede76ae93d0a` |
| `08-V5-recording-unit.log` | `2eac6547c36ec34cd77fd5b4e6d167af89c7fd93a12cd8cd64a803a5cb82b229` |
| `09-V5-recording-integration.log` | `bba8960fab59272637c99903ece437134adabd2226cc667a9b86b159953d06c7` |
| `10-V5-Chrome.log` | `61c23dfcd1303d857530d2fef13b7dbb07b15773546140e00b93518b5bac4434` |
| `11-V5-Edge.log` | `c772505961b1b54113946d0d7d884a7964c67f0f1f3448aa25ad8c8ebe906b40` |
| `12-V5-media-verification.log` | `a22d070a9f3d72111176fb3fe321aca689f24b5ae49e2088de21c892cf2e955b` |
| `13-V4-golden.log` | `a5267510b4a0cb2bc6305069b87958981d2ced417183da095640d30fd710f58a` |
| `14-V4-scene-unit.log` | `225fc5fe2442dd0a90df373795057a5e96093beedade64755b5229ad7a7d7527` |
| `15-V4-renderer-integration.log` | `fce389f3e3f1a62814ff4cb5f82482c60a718b41437fcbb17bdc6c835bab7c98` |
| `16-V4-Chrome.log` | `f627ba25972edf3ebdf7593f6627a4d64c23be76851fc4a62449658022684d4a` |
| `17-V3-golden.log` | `d55c54e79d0c256d33c85313601ce86e683c5094fae1fbd582aa68ac52a389ba` |
| `18-V3-scene-unit.log` | `7ebe9741cc37001568332b94617378ef891fa4591efe69db072f4d5ecbe27d3b` |
| `19-V3-renderer-integration.log` | `9b087d639ffae3324b7213dd8f5c8b637286892a9d82cc22782f5077cedbb6db` |
| `20-V3-Chrome.log` | `d5dd60169070f2e388e90fa8ebcd861aca9814c4ef113e4b5bc83adfa40eed2c` |
| `21-V2-golden.log` | `c8f512aade67c6a426cedbe1cc9f41716f321be78d60c8a5e24526de82374ce4` |
| `22-V2-binding-unit.log` | `ceb3c49a2f5e14568fc53fa5f1bc801449cb2218b4c3c5f0ff62f89448567a17` |
| `23-V2-binding-integration.log` | `6390d058b9dc57953b4af599a9d8fc18be1040b4a5d7642744f4a75f2a59bd50` |
| `24-V2-Chrome.log` | `be648d942bc3f13bc087115d0f87db2aa1098f040db9b41b2949cc2d494774d3` |
| `25-V2-Edge.log` | `29117e61285353fa7f0e73d26a1e7ce5b2215472c72861516ebe488ced2946e3` |
| `26-V1-golden.log` | `1f1b39668f05dea3e981d3919ad1d578b11337c359aa16c7fd0981f7eb470e1e` |
| `27-V1-project-unit.log` | `ac8e36f39400549c03af0385961a95aed1205b739025b166c993cd090e9fe372` |
| `28-V1-foundation-integration.log` | `8055bc23b3888313760900bb06a0f2dbf9cdb63ecd5a2fcd7f412611593694df` |
| `29-V1-Chrome.log` | `229802f39dd634d0e3bdb49d80ab1f8f2b082b0b07378bc000996f06c660dc57` |
| `30-V1-Edge.log` | `c977790f0c0c4d68bc1e6d394dc3cf444e2cd13499a15bc53edfd5469c6e7c09` |
| `31-M3-Chrome-smoke.log` | `b849c6a1e3fc24d2619ba5caa88d3e2ef086441331985cf2d52e25d32f0264ed` |
| `32-M4-engine-and-session-regression.log` | `0696bcbf5adad120ebf2773e20fa04b3a95f309899cd6352e23871726221757b` |
| `33-M4-Chrome-regression.log` | `d512bdd6342aa10b626300b859ca32b69f9369a6b85bbfea6032897b34bc202f` |
| `34-M5-repository-and-recovery-regression.log` | `33bf0ad6c7aa85a3bf0cb2c7a241734823bf1b01d5fe0d84e5b3f58b044e1d99` |
| `35-Editor-E1-project-unit.log` | `2480f265dc5f0e7930811b6784183e11f114405a36c59f8b229a5386471ecbe9` |
| `36-Editor-E1-integration.log` | `cc0f53e048ab8eb563d252671b092dacdc7573c4c30eea323d4146efa5106aa4` |
| `37-Editor-E1-Chrome.log` | `e0ea440d0cd258a09970f1f32ada0686650120c7f5e2cce7627881d008cd38a8` |
| `38-Editor-E7-unit.log` | `f09faad23e9a2d9df30810cb60e912e30ac135d6377d8eab21272da90c41f320` |
| `39-Editor-E7-integration.log` | `fb3f30c4ed4be1c3f6adb297a17c421ef02d811c43896e1cd0388a63d19df105` |
| `40-M11-Chrome-resource-regression.log` | `24ff9b2b5827efdd618b330e9bfd3f08e81a1d1fac489ca06745a5943579d0b2` |
| `41-M11-Edge-resource-regression.log` | `d85f19f6982f6fcd5fe2f88c8c054e802573e994946aab320550c589da2781df` |
| `42-docs.log` | `bb005ed0074179a47b895a5c66e79917e37ebf18976e21fe9d27b1dd63c8f151` |
| `43-deliberate-failure.log` | `69bf5c3fa50230a4957ad0c60c8323dba68e494d92761fea0039cf5d580d70aa` |
| `44-typecheck.log` | `fadc7f66199c28d2f7cca439bb300ebeb0320158f32a0f9b52ec77031538af4d` |
| `45-build.log` | `a953b858232d042d97ee736665b431c7df21ef447d7355af7d1265c6a1d5be8b` |
| `46-diff-check.log` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `47-M6-unit-explicit-regression.log` | `e9d11342cdd1007be086c92ddb584c8ad04de2896e5a015bfec36aa7f7c720d7` |
| `48-M6-worker-explicit-regression.log` | `824cfe537f596653f7d28423b35f704be8c26add0c02804183a2bdd5e3c57bc9` |
| `49-M6-integration-explicit-regression.log` | `407eab08ca23cc3f9186674656c434eabed13ed44e10c8998b7c857c679efb80` |
| `50-M6-Chrome-explicit-regression.log` | `d71cae87204e5a8d05e5214aaad7907a7a90d82b2e52a6ebf1c7b570dc67a1dc` |
| `51-M14-unit-explicit-regression.log` | `b37549bf5d778a35295035374f7078293f6a94a945579eed3812d1bd8b679209` |
| `52-M14-integration-explicit-regression.log` | `922d2ca25b5b68cff4eb8847fd50c1e647a832ee505440faa555aeb2ee14c094` |
| `53-M14-Chrome-explicit-regression.log` | `a6657fe3bdfbfe9c3be3116db08c9df6dd6fe2a1745d25e34c60f2a1d1afa74f` |
| `54-M14-Edge-explicit-regression.log` | `541fcbeb091492cead5bc1a32a457bb0d9e0f21bc52e41fdefb6ab2435f8932b` |

### Manual Gaps and Review Boundary

- 自动化证明了双浏览器三格式、四特征/双特征模板转换、默认 720p30 六文件、短时 packet cadence、15 分钟分析压力、20 次生命周期、命令与错误隔离、键盘/焦点 DOM 状态和资源计数；它不能替代 owner 对最终视频构图、长时操作体感、辅助技术朗读或 OS picker 权限/取消/覆盖流程的实际判断。
- owner 于 2026-09-04 批准 Chrome/Edge“当前歌曲 → Editor 数据 → 四特征 Cube → Orthogonal → 默认 WebM 原生保存/回放”，并确认长时操作、键盘/焦点与 context 清理人工门禁。未提供的主观数值不补写。
- V6 为 `Complete`、evidence 为 `approved`、R-041 为 `Mitigated`；下一阶段另行创建 Visualizer 整体 release-readiness review。
- 本记录不批准 optional 1080p60、生产部署或整体 release readiness；PROD-015 继续阻断上线声明。未提交 900 秒音频、大型 WebM 或 trace，历史 V1–V5 canonical identity 未改写。

### Owner Review Status

2026-09-04，`project-owner` 明确要求“先完成并且批准和关闭 V6”，并批准本关闭计划实施。该批准覆盖上列人工制作、原生保存/回放、键盘/焦点、长时操作与 context 清理边界；canonical identity、artifact、summary 与媒体 hash 保持不变且无需重跑。本批准不构成整体 release readiness 或生产上线批准。
