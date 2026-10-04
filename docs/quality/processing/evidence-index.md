---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/quality/processing/eval-plan.md"
  - "docs/quality/processing/golden-examples.md"
  - "docs/quality/processing/failure-taxonomy.md"
  - "docs/delivery/processing/milestone-plan.md"
next_action: "DEC-071 已批准短段 max absolute 1.5e-3；继续原图双浏览器、真实拼接/WAV、取消、试听和十五分钟验证；P1 未完成"
---

# Browser Processing Evidence Index

本索引按 DEC-069/070 接受实际证据记录，包括失败；approved 指记录范围和结论被既定授权接受，不表示 P1 验收通过。模型、合成 fixture、运行资产和日志只保存在忽略的本地产物目录；用户歌曲、WAV、路径和内容 hash 不入 Git。未创建新链 readiness。

## P1 Provisional — 2026-10-04

Run `P1-2026-10-04T09-05-33-154Z-9b361fca-provisional`，summary SHA-256 `67912c3c0c338fa80701c4135331d73ab029bd956a5e0b4df33eb194c74d31f2`。运行起止 HEAD=`9b361fca`，工作树未提交、状态一致；只作反馈，不是最终候选。10 个命令分组中 8 pass、Chrome/Edge 两组 fail；两浏览器各 1 个负向 lifecycle 场景通过、4 个真实图场景失败。原始日志、JSON、trace 位于 `artifacts/evals/<runId>/`，早期 profiling/资产/测试注入错误的 trace 独立保留，未作为模型不兼容依据。

| Eval / AC | Actual evidence | Conclusion |
| --- | --- | --- |
| MODEL / AC-P101 | 四文件共662450544 bytes，size/SHA 全匹配固定表；六项 ORT 资产/npm integrity 校验通过，许可/attribution 已登记 | artifact identity 通过；AC 仍因 session 失败未通过 |
| RUNTIME / AC-P101 | Chrome/Edge × drums/bass/other/vocals，硬件 adapter vendor=nvidia、architecture=lovelace、fallback=false；均在 session-create 失败 | PFT-RUNTIME / S1，阻止 P1/P2 |
| ROLE、TIME、DERIVED / AC-P102–104 | selector、恒等/脉冲、重采样、拼接、RMS/WAV、hash 与流式内核有独立 oracle/注入测试 | 合成/注入通过；真实 FT 推断、拼接及导出未验证 |
| PARITY / AC-P102 | GPU session 创建失败，未运行 WASM 对照 | unverified，不能以 mock 或同 GPU 自对照替代 |
| CANCEL、REGRESSION / AC-P103/106 | 双浏览器各20次缺GPU/取消生命周期，0残留 Worker、0新播放上下文；相关 AudioEngine/analysis Worker 回归通过 | 已验证所列负向路径；真实 FT 压力/推断取消仍未验证 |
| QUALITY、PERF / AC-P105/106 | 没有许可歌曲/试听结论；未进入长曲测速、峰值采样或原生保存/回放 | unverified，不能关闭 |

实际环境：Windows `10.0.22631`、Node `v24.18.0`、RAM `16294899712` bytes；系统 GPU discovery 为 RTX 4060 Laptop、8188MiB、driver591.86。浏览器隐藏 device/description，只能从 adapter 证明 NVIDIA Lovelace，不能把 system discovery 冒充浏览器公开的精确 device ID。kernel placement 未能形成完整图分配记录。

## P1 Canonical — Candidate 9198b37

Run `P1-2026-10-04T09-24-45-541Z-9198b372`，summary SHA-256 `28423c589f615811e1b27c2e90bd72109549d6640ed4ac39b04bf3a969076679`；起止 commit 均为 `9198b3725b726f1937c453a5858542b3657b88e7`，起止工作树均干净。10个命令分组8 pass、2 fail；unit16、integration18、邻接回归22项通过。Chrome/Edge 各1个20次生命周期场景通过、4个真实图场景失败，无 skip/flaky；四图均仍未建立 session，parity 未运行。该正式失败记录被 DEC-069 接受，不是 P1 通过或关闭。

本轮正式日志/JSON/trace 在 `artifacts/evals/<runId>/`；固定模型校验和六个实际运行资产身份与上表一致，未包含用户歌曲。独立合成 fixture 的版本、许可和固定 SHA 在 `tests/processing/fixture-manifest.json`；内核配置和 provenance 身份在 [kernel config](../../architecture/processing/ft-kernel-config.md)。

### Graph Diagnosis

在固定 bytes 上使用 protobuf schema 解析（未写回 ONNX），四图的 IR=8、default opset=17，共同节点 `/real_istft/ConstantOfShape` 的 `value` tensor data_type=11。官方 [ONNX v1.20.1 schema](https://github.com/onnx/onnx/blob/v1.20.1/onnx/onnx.proto3) 将 11 定义为 DOUBLE；固定 [ORT WebGPU supported types](https://github.com/microsoft/onnxruntime/blob/v1.30.0/onnxruntime/core/providers/webgpu/webgpu_supported_types.h) 的浮点类型表包含 float/MLFloat16，不含 double。这是内部 Float64 路径与浏览器运行支持不匹配的诊断线索；尚未证明只改此节点即可解决全部图兼容性，未更改固定模型或运行库。

## Failure and Next Action

四个图的原始共同错误为 `/real_istft/ConstantOfShape` node provider 未设置，ORT `TransformerMemcpyImpl::IsNodeCompatibleWithProvider` 失败；发生在实际字节校验后、推断前，不是缺失 WebGPU 或软件下载 fallback。这里只记录现象，不声称已经查明全部底层原因。

P1 保持 In Progress；R-046–R-055 全部 Open，P2–P6 Planned。下一步复核当前图/ORT 兼容方案；本轮没有替换固定模型、运行库版本或后端，没有放宽 parity/时间/质量/性能阈值。必需试听和许可仍须 owner 提供真实结论。

## Reproduction

使用已锁定依赖；`npm run processing:models` 下载/校验忽略目录中的四模型，`npm run processing:assets` 准备同版本资产。`npm run test:e2e:p1:chrome` / `test:e2e:p1:edge` 重现图门禁，`npm run eval:p1:provisional` 产生未提交反馈；干净实现提交后 `npm run eval:p1` 产生正式记录。独立入口 `/tests/processing/index.html` 由 Vite dev server 提供，不在生产路由注册。

## JSEP Compatibility Investigation — 2026-10-04

本轮 owner 要求继续完成 FT 并逐阶段本地提交，另授权使用本地音乐目录或生成音频测试；本记录只登记本地使用授权，不推断歌曲再分发许可，不提交路径/歌曲/hash。

同包 ORT 1.30.0 的 JSEP WebGPU 构建，固定原模型、原合成 fixture、numThreads=1/proxy=false，GPU 与独立 WASM reference 均关闭图优化。Chrome/Edge 四图全部 session/run 成功，shape/finite 与对应 row 通过，实际 GPU profile 记录 Conv/ConvTranspose；两浏览器结果一致：

| Role | Max absolute error | Numeric gate |
| --- | --- | --- |
| drums | 0.0012997835874557495 | fail：阈值仍为0.001 |
| bass | 0.0002854093909263611 | pass |
| other | 0.0008603809401392937 | pass |
| vocals | 0.000008197035640478134 | pass |

原始 JSON/trace 在忽略目录 `artifacts/evals/p1-jsep-four-{chrome,edge}/` 与对应 JSON。该记录是未提交候选的调查证据，不是 canonical/P1 close；全部 kernel placement、十五分钟资源、WAV 与人工结论尚未形成。

隔离诊断包括：原 native disabled 仍报 DOUBLE provider；JSEP/WASM all 优化均 `std::bad_alloc`；disabled 均成功；禁用 ConstantFolding、NHWC 未使 drums 达到门禁；只把342个 iSTFT DOUBLE 窗口常量转为Float32的诊断副本使 native 可推断，但不能证明精度通过。原始 ONNX 未写回。相关 probes 使用独立配置，不进入 canonical 验收套件，也不把失败变成 expected pass。

四图初始化修复已本地提交为 `6d575ff`，34项专项、类型/构建/文档校验通过；诊断模型/运行库仅由dev fixture whitelist提供，不进入生产dist。后续精度诊断未解决drums超差，批准后的标准见 [numeric review](numeric-review.md)；现执行 DEC-071 的1.5e-3，不默认采用任何派生图/运行库。

2026-10-04，owner 明确回复“批准 0.0015，继续完整验证（推荐）”。DEC-071 据此批准四专用模型对应 row 短段跨后端 max absolute ≤`1.5e-3`，保留原始模型和官方运行库，继续全部适用验证。上文按原 `1e-3` 的失败属于历史记录；P1 仍 In Progress、P2 Planned、R-046–R-055 Open。详见 [numeric review](numeric-review.md)。

## Real Pipeline Provisional — 2026-10-04

Chrome 专项 `artifacts/evals/p1-real-pipeline-chrome.json` 两场景通过：20000-frame / 44.1kHz stereo 补零和400003-frame / 48kHz mono 跨段均完成四原图顺序 load/release；每轨 WAV header/frame/finite/planar 全 sample 与独立 WAV 重算的30Hz energy、waveform 一致，暂存源 hash 重验通过。处理时间分别约77.93秒（下载另计17.18秒）和98.90秒；初始反馈≤0.3ms、最大心跳间隔747.1ms。

六个真实取消阶段（staging/load/inference/stitch/derive/persist）均唯一终态且≤5秒清理/登记。此为未提交候选的专项反馈，尚非 clean canonical。新增20次真实任务资源计数、双浏览器十五分钟和三首本地音频12 WAV 生成进入完整 runner，尚未宣称通过；owner 听感与原生操作仍待人工结论。

## Canonical Environment Failure — 389fd32

`P1-2026-10-04T12-29-04-163Z-389fd32e` 起止 commit/worktree 相同且干净；summary SHA-256 `8091556abc6259d9b8db148e06396eab1bc5aaf2e47bb682540e9125052ea532`，10组9 pass。Edge 四原图按 DEC-071 的1.5e-3全部通过；Chrome前三轨通过、vocals因Vite进程退出报 `Failed to fetch`。Vite在创建本地试听产物时监听到锁定文件并报 `EBUSY`；不是模型精度失败。失败原日志/trace保留，未重标通过，昂贵 pipeline/performance/listening 组因图组不完整未执行。

修复在开发服务器监听中排除 artifacts/test-results/playwright-report 等产物目录；仍通过白名单 middleware读取固定公开模型。源码变更仍会触发HMR，因此正式候选运行期间不修改源码或Git状态。

## Canonical Long-Storage Failure — ac1ba49

`P1-2026-10-04T12-42-18-237Z-ac1ba498` 起止 commit/worktree 相同且干净；summary SHA-256 `7554d0ddcdbfd2bb7d8d502790eed0bb862bc16ba8166c1244d47e91b39fac46`，15组12 pass。双浏览器各四原图 parity、真实短段/48k mono跨段WAV/摘要、20次真实取消循环及下载取消/损坏模型/quota测试通过；两浏览器最长取消终态均4500.5ms，稳定点资源/临时目录/结果metadata/residual清空。两个十五分钟组和第三首歌曲生成失败；前两首八个WAV仅作为未完成试听材料保留。

新增原始异常诊断的 Chrome 重现 `artifacts/evals/p1-long-diagnostic-chrome.json` 显示 `QuotaExceededError`，发生在 drums / persist，done=38181780、total=39690000。原错误笼统映射为 inference-failed，现按既有契约明确映射 quota-exceeded，abort全部stem writer、释放session并清理本任务。预检不是实际写入成功保证。

默认隔离上下文使用临时存储。[Chromium quota说明](https://groups.google.com/a/chromium.org/g/blink-dev/c/00aHBCiUGzo/m/B0Dq06SFAQAJ)指出隐私窗口真实容量基于RAM，estimate可报人为扩大的值；大型参考改用[官方persistent context](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)的独立普通磁盘profile，不改用户profile，不提高或伪造quota。十五分钟fixture处理期间持有完整48k stereo原始PCM，准备时间另计，并在处理后重验原始PCM全量hash。

普通Chrome重测 `artifacts/evals/p1-persistent-long-chrome.json` 完成四轨：每轨39690000frames，WAV/planar及独立30Hz摘要一致，原始PCM不变；但处理1016.6576秒，超过900秒，性能门禁仍失败。反馈1.4ms、最大heartbeat749.5ms；设备wide显存观测峰值4373MiB、所有Chrome/Edge进程aggregate WS约2.62GB、private bytes约5.25GB；1秒请求采样包含其他tab，非应用独占分配量。保留失败trace，不关闭P1或风险；下一步优化重复重采样并重测。
