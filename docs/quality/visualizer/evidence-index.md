---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-02
upstream_docs:
  - "docs/quality/visualizer/eval-plan.md"
  - "docs/quality/visualizer/golden-examples.md"
  - "docs/quality/visualizer/failure-taxonomy.md"
  - "docs/quality/visualizer/v2-eval-plan.md"
  - "docs/quality/visualizer/v2-golden-examples.md"
  - "docs/quality/visualizer/v2-failure-taxonomy.md"
  - "docs/delivery/visualizer/milestone-plan.md"
next_action: "V2 26/26 clean canonical 已获 owner 批准且 V3 已开放；等待 V3 implementation commit 与 canonical evidence"
---

# Visualizer Evidence Index

## Current Gate

- V0-P、V0-A、V0-D：`Complete`。
- V1：`Complete`；clean canonical 21/21 与适用人工门禁已由 owner 批准。
- V2：`Complete`；clean canonical 26/26 已获 owner 批准；V3：`In Progress`；V4–V6：`Planned`。
- R-034–R-036 为 `Mitigated`；涉及真实场景确定性与资源的 R-037、R-038 继续为 `Open`。
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

### Manual Gaps and Review Boundary

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
- R-035、R-036 依据 V2 planner、projection、Editor snapshot、原子导入与双浏览器证据改为 `Mitigated`；R-037、R-038 继续等待 V3 真实场景确定性与资源证据。
- V2 canonical identity 保持不变且无需重跑；只有 commit、run ID、summary 或 artifact 身份变化时才重跑。

### Owner Approval

2026-09-02，`project-owner` 明确回复：

`使用项目相关技能执行此计划`

本批准关闭 V2、开放 V3，并接受现有 canonical evidence；不补写批准原文未提供的人工观察值，也不构成 V3/V4 场景、V5 WebM、V6 readiness 或生产上线通过。
