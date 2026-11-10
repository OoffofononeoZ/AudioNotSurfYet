# Editor 自动标记验证

本目录验证 DEC-075 的固定模型、预处理、鼓自定义词表、音符起止和后续 Editor 闭环。完整任务边界见 [契约](../../docs/architecture/processing/editor-auto-marking.md)。新增质量仍须 owner 试听复核；模型可运行不等于识别质量通过。

## 命令与资产

```powershell
npm run transcription:models
node tests/transcription/download-models.mjs --verify-only
node node_modules/vitest/vitest.mjs run tests/transcription
npx playwright test tests/e2e/editor-transcription.spec.ts tests/e2e/transcription-models.spec.ts tests/e2e/transcription-quality.spec.ts tests/e2e/audition-long.spec.ts --workers=1
```

下载器只使用 [固定模型表](../../src/transcription/model-artifacts.json) 中四项公开 URL，验证实际 bytes／SHA-256；Basic Pitch 另核对官方 Git blob。文件位于忽略的 `artifacts/fixtures/transcription-models/`，不提交权重。产品模型仍通过固定 HTTPS URL 下载，dev-only fixture plugin 仅暴露 manifest 中的文件名，不提供任意目录读取。

`npm run dev` / `build` 的现有 processing assets 准备流程提供同版 ORT WASM／JSEP 资产。模型归因、许可与改编记录见 [notices](../../src/transcription/THIRD_PARTY_NOTICES.md)。不安装或执行 Python、训练器或模型转换程序。

## 证据语义

### 真实歌曲鼓对照（显式运行）

`tests/e2e/transcription-benchmark.spec.ts` 默认跳过。设置 `TRANSCRIPTION_BENCH_AUDIO` 为 owner 已授权的本机歌曲路径后运行该专项；也可用 `TRANSCRIPTION_BENCH_STEM` 指向已冻结的 FT drums WAV。第一次通过原有四轨分离链生成并保存鼓音轨，后续复用相同文件，不能把原曲与分离鼓轨混作同一输入。

产物在忽略的 `artifacts/evals/transcription-optimization/`，记录源／冻结音轨／源码 hash、UA、逐窗原始 token、特征数组与类别过滤前后输出。短片包含 Black Hole 十个已报告截断位置及普通／密集／边界样例，使用生产 `MonoResampler` 预处理；WASM 基线不要求达到 GPU 性能目标。测试不修改用户音频或工程，不自动把未标注声音计为误检。

诊断新增解析、特征视图 hash、缓存数据完整性专项为 `tests/transcription/diagnostics.test.ts`。诊断导出的新 `analysis-report` 保存用途复用 Web／Electron 文件端口，不扩大文件读取权限。

旧 WASM 专项逐窗将特征和原始输出落到唯一 `*-wasm-checkpoints-*` 子目录；运行中断时已完成窗口仍可核对，部分产物不代表整个专项通过。`transcription-batch.spec.ts` 实测 GPU 批/尾批、独立 EOS、相同输入与旧 WASM 对照及截断；`onnx-constants`、`drum-batch`、`drum-windows` 单元覆盖常量展开、有界重试和推理中取消释放。

设置相同 `TRANSCRIPTION_BENCH_STEM` 后运行 `transcription-optimized-benchmark.spec.ts --project=chrome --project=edge --workers=1` 记录整曲 GPU 探针。计时含运行时/模型准备、读取、转录和重试，不含下载/FT，也未覆盖应用缓存发布；完整产品性能仍须单独记录。`node --experimental-strip-types tests/transcription/analyze-benchmark.mjs --report <报告> --reference <手工工程> --source <原音频> --stem <冻结音轨>` 验证歌曲/冻结输入 hash，输出一对一时间匹配、前 120 秒固定偏移校准及留出段。其他未标注声音只列为未复核，不计算识别 precision；该工具不修改输入。

- `model-probe.worker.ts` 使用真实模型 session：ADT_STR WASM encoder／完整 token prefix decoder，Basic Pitch WASM 和六轨 WebGPU；测试注入仅提供同字节模型文件，不替代推断。
- 合成鼓包含同时击打；截断用例将解码长度设为四 token，确认返回 `truncated`。合成音符覆盖长音、短音、重复音、和声及跨模型窗口；保存真实输出与已知输入，但不把合成音色当成真实钢琴／吉他质量证据。
- 音符时钟由原输入窗口绝对起点与 256-sample hop 派生，裁去模型两侧各 15 帧后拼接；不按每窗输出帧数累计时间，不吸附 tempo 网格。边界行为与真实起止误差继续由受控样例复核。
- Playwright JSON 保存源码 SHA-256、UA、真实输出与内存到忽略的 `artifacts/evals/editor-transcription/model-runs/`；report 附件同时保存。它们是工作树 provisional，不冒充 clean canonical。
- 内存复用现有 sampler：约一秒请求频率、全设备 NVIDIA 显存与所有 Chrome／Edge 进程 working set／private bytes；其他标签页可能影响结果，共享 working set 可能重复计数。报告观察峰值及采样错误，不把它当作模型独占内存或分配上限。
- 初步三链路报告保存在 `artifacts/evals/editor-transcription/models-chrome-initial/` 和 `models-edge-initial/`。后续实现变化与不同配置通过源码／配置 hash 区分，历史报告不代替当前完整链路。

`editor-transcription.spec.ts`从真实FT结果跑六输入推理（含 other）、OPFS文件校验、辅助试听、候选修正、显式应用与刷新恢复，并覆盖取消、损坏模型缓存和试听后清理。应用继续使用现有 Editor V2。完整链工程样例为验证分类路径将音符分界改为10000ms；不是产品默认值，原候选时间仍完整保存。

`qualityFixtures.ts`自编CC0受控音色包括钢琴/拨弦各自独奏、稀疏混合、无目标区、长音/重复音/分段边界，以及同时击打、快速hat与跨段击打。`quality-probe.worker.ts`执行真实六轨分离→OPFS→逐乐器Basic Pitch及分段ADT_STR。`qualityMetrics.ts`保留全部原始观测，用120ms关联窗统计漏标、多标、分类/音高错误和带符号起止误差；该窗口是报告方法，不是验收阈值。合成素材不证明真实演奏录音质量。

`audition-long.spec.ts`验证15分钟源的有界PCM调度，连续播放120秒、远端跳转、模拟读取停顿/错误时的时钟冻结，以及租约释放后的清理；不宣称已连续播放完整900秒。输入为受控transport夹具，不是再次验收已接受的FT听感或处理时间。

完整链、受控质量和长源记录分别保存到`artifacts/evals/editor-transcription/full-chain/`、`controlled-quality/`、`long-audition/`。运行浏览器期间固定相关源码与测试，避免Vite热更新使候选身份和资源生命周期失效。只运行实际受影响的回归；真实钢琴/吉他录音与owner质量结论仍需各自证据。

## 主要音色优化

`lead-path.test.ts` 覆盖旋律与弱和声、静音间隔、等强和弦不强选、重复起音、零能量、路径裁剪及取消；`candidate-review.test.ts` 验证角色默认互斥、手工覆盖和恢复自动判断时保留原始证据。六输入完整链验证 other 实际产出和角色元数据；不能用含糊样例没有 lead 或单元结果宣称真实音乐主旋律质量通过。

`candidate-review.test.ts`、`acoustic-index.test.ts` 覆盖原始/派生分离、静音有限值、源帧数校验、有界重采样/跨块/取消、和弦归组、共享声学起音、真实重复起音、不同通鼓/打击声、保守筛选、重复组含糊不选/强推荐/多选，以及 V2 原子应用和跨视图幂等。服务/仓库专项检查设置不触发模型重跑、命名/归属/筛选/复核决策恢复与新 analysisConfigHash 隔离。

`transcription-timbre-quality.spec.ts --project=chrome --workers=1` 用同一自编受控样例运行真实固定模型、分来源音符解码、完整鼓类、DSP 和三个筛选档位。设置 `TRANSCRIPTION_QUALITY_BASELINE=<旧 controlled-quality run>` 时先核对输入 hash 和两份辅助 WAV 完整 SHA，再保存声音起音级配对；音色预览不按音高计数，不能把此对照写成音高准确率或真实音乐接受。

仅调整后处理时，另设 `TRANSCRIPTION_REVIEW_INPUT=<本轮 raw-result.json>` 可复用原始候选重算；先在浏览器核对当前分析身份和候选，模型/DSP身份不一致则拒绝复用。新报告保留原始报告 hash 和当前源码 hash。产物在忽略的 `artifacts/evals/editor-transcription/timbre-quality/`，保留初次结果和修正后结果；不要用同样例调参后的数值冒称独立留出验证。

`band-salience.test.ts` 检查强底鼓旁的弱高频鼓声、静音及频段选择，原始全频 RMS 与按频段显著性分开。受控质量报告另列 `drumPresets`，不能只报告未筛选 raw 命中而忽略默认结果。手工归为同一组且同刻/同声学起音的点在派生层合并 rawIds，默认不同自定义声音仍分开；活动拆分仅关联实际贡献的来源。

`TRANSCRIPTION_BASELINE_REPORT=<完成的旧 WASM JSON>` 与 `TRANSCRIPTION_BENCH_STEM` 同时设置后，运行 `transcription-comparison.spec.ts --project=chrome --project=edge --workers=1` 比较完全相同的 14 个窗口起点。核对冻结 WAV hash、逐窗特征及 token 前缀，保存全部新输出/终止/耗时；不再次运行旧长测，不把短窗探针当作整曲应用性能通过。

## 同曲声音示例

`example-search`、`example-cache-apply`、`example-controller`、`example-service` 单元覆盖变音量起音/快速重复、范围时序与受限 DTW、多正例/反例、静音/来源拒绝、typed 索引校验/配额、原子与稳定来源应用、跨歌取消及解码修订后恢复。索引缓存不保存 PCM；模型输入和分离逻辑不变。

`editor-sound-examples.spec.ts --project=chrome --project=edge --workers=1` 无模型/FT 依赖，用自编 CC0 乐句验证真实 Worker DSP、反例、边界修正、试听、显式/重复应用、刷新及索引复用、取消、已有标记带入和窄屏。产物为本机 `artifacts/evals/editor-transcription/examples/`，受控重复匹配不能替代真实音乐质量。

六输入完整链和 `test:desktop:transcription` 共用 `tests/support/sound-example-flow.mjs`，额外检查原曲/已有 FT other/辅助钢琴三个来源的实际读取、索引与试听、默认未勾选、应用幂等和离线恢复；只复用已生成音轨，不调用新的分离。清理全部候选同时清理示例/索引，已应用工程保留。

## 完整产品与失败复核

`transcription-gpu-failure.spec.ts --project=chrome --project=edge --workers=1` 分别隐藏测试 Worker 的 GPU 入口、在真实解码开始时销毁 ORT 自有 GPUDevice；断言明确失败、无结果、结束释放，不能用模拟抛错替代设备丢失。`drum-gpu-guard.test.ts` 覆盖延迟取得设备、悬挂 run/release、正常清理与已知迟到 GPU map 错误的有限抑制。

整曲测试显式使用本机已授权输入，默认跳过。`TRANSCRIPTION_PRODUCT_AUDIO=<原 MP3>` 后运行 `transcription-product-benchmark.spec.ts --project=chrome --project=edge --workers=1`，固定字节模型预先核 hash 后写入测试缓存，应用仍逐项校验。使用独立持久 profile，通过真实 FT 准备当前结果；FT/下载不计时。计时从点击分析前至保存并派生预览完成，包含缓存/FT 校验、权重展开、session、PCM、推理/重试、DSP、复核与发布。FT WAV 导出及示例检索在计时/内存采样结束后执行。产物在 `artifacts/evals/transcription-optimization/product/`，保留不完整区间与环境/源码身份。需要足够本地空间，大型 fetch 失败不代表模型推断失败。

`EXAMPLE_BENCH_REFERENCE=<冻结手工 V2 工程>` 可在上述整曲测试结束后以实际已有 FT drums 交换第三轨的两个 mid 示例，固定默认 0.82 门限并记录起点/终点误差。另设 `EXAMPLE_BENCH_AUDIO` 后运行 `sound-examples-real-song.spec.ts` 独立核对默认原曲来源；end 单实例不作为留出证据。`EXAMPLE_EXPORT_INDEX=1` 将无 PCM 的 DSP typed arrays 导出供本地诊断；`analyze-example-index.mjs --index <index.json>` 的降低门限/时长探查仅为解释失败，不改变初次检验结论或产品设置。

```powershell
node --experimental-strip-types tests/transcription/analyze-product-result.mjs --report <产品 report.json> --reference <冻结手工工程> --suffix frozen507
node tests/desktop/transcription-product-benchmark.mjs --audio <原 MP3> --reference <冻结手工工程> --profile-from <成功正常 transcription result.json>
```

时间分析使用 Black Hole 的 135 BPM/八分之一拍（55.6ms）一对一关联，前 120 秒估计固定偏移并另报留出段；仅统计手工正例召回，不把其他声音计为误检。手工工程试听后可能变化，应冻结参考并保留 hash/来源，不能混用 507 与后来 506 正例。工具写出复核 V2 工程，保留人工轨和 tempo，不改输入文件。`prepare-listening-review.mjs` 生成局部 WAV/前后工程便于试听；音频不提交仓库。

桌面首次测试复制已核对的普通成功 transcription profile，实际当前 ASAR 在独立原生目录运行、准备整曲 FT、再离线计时。后续可显式改用 `--product-profile-from <成功产品 report.json>`，核对其来源链、原音频/FT WAV 和 ASAR 摘要后复制既有完整 FT；当前产品还会自行验证恢复数据，不伪造分离清单。报告包含源/执行 ASAR hash、是否复用已有 FT 和应用进程内存采样；原生保存选择返回值仍为夹具。与浏览器顺序执行，禁止并发 GPU 任务干扰计时；现有成功运行身份及已知质量限制见[自动标记契约](../../docs/architecture/processing/editor-auto-marking.md)。

桌面整曲 runner 可加 `--gpu-failure-check`：计时/采样和正常结果落盘后启动独立重算，在实际鼓解码阶段只销毁其 Worker 的 ORT GPUDevice，要求显示设备丢失、没有新保存结果、原结果保留、Worker 终止且无 page error。它不重置系统 GPU；Electron 已知 GPU map AbortError 可能先于 `device.lost`，生产保护只对此暂存最多 50ms，未确认丢失仍报告原异常。加 `--gpu-failure-only` 必须复用显式成功产品 profile，仅做失败回归并标明没有性能测量；Worker 控制台另记实际异常类型、先后顺序及默认处理是否已阻止。
