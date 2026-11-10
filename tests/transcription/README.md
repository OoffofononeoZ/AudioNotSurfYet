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

`editor-transcription.spec.ts`从真实FT结果跑五角色推理、OPFS文件校验、辅助试听、候选修正、显式应用与刷新恢复，并覆盖取消、损坏模型缓存和试听后清理。应用继续使用现有 Editor V2。完整链工程样例为验证分类路径将音符分界改为10000ms；不是产品默认值，原候选时间仍完整保存。

`qualityFixtures.ts`自编CC0受控音色包括钢琴/拨弦各自独奏、稀疏混合、无目标区、长音/重复音/分段边界，以及同时击打、快速hat与跨段击打。`quality-probe.worker.ts`执行真实六轨分离→OPFS→逐乐器Basic Pitch及分段ADT_STR。`qualityMetrics.ts`保留全部原始观测，用120ms关联窗统计漏标、多标、分类/音高错误和带符号起止误差；该窗口是报告方法，不是验收阈值。合成素材不证明真实演奏录音质量。

`audition-long.spec.ts`验证15分钟源的有界PCM调度，连续播放120秒、远端跳转、模拟读取停顿/错误时的时钟冻结，以及租约释放后的清理；不宣称已连续播放完整900秒。输入为受控transport夹具，不是再次验收已接受的FT听感或处理时间。

完整链、受控质量和长源记录分别保存到`artifacts/evals/editor-transcription/full-chain/`、`controlled-quality/`、`long-audition/`。运行浏览器期间固定相关源码与测试，避免Vite热更新使候选身份和资源生命周期失效。只运行实际受影响的回归；真实钢琴/吉他录音与owner质量结论仍需各自证据。
