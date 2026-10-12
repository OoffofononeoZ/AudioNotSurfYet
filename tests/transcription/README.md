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

- `model-probe.worker.ts` 使用真实模型 session：ADT_STR WASM encoder／完整 token prefix decoder，Basic Pitch WASM 和六轨 WebGPU；测试注入仅提供同字节模型文件，不替代推断。
- 合成鼓包含同时击打；截断用例将解码长度设为四 token，确认返回 `truncated`。合成音符覆盖长音、短音、重复音、和声及跨模型窗口；保存真实输出与已知输入，但不把合成音色当成真实钢琴／吉他质量证据。
- 音符时钟由原输入窗口绝对起点与 256-sample hop 派生，裁去模型两侧各 15 帧后拼接；不按每窗输出帧数累计时间，不吸附 tempo 网格。边界行为与真实起止误差继续由受控样例复核。
- Playwright JSON 保存源码 SHA-256、UA、真实输出与内存到忽略的 `artifacts/evals/editor-transcription/model-runs/`；report 附件同时保存。它们是工作树 provisional，不冒充 clean canonical。
- 内存复用现有 sampler：约一秒请求频率、全设备 NVIDIA 显存与所有 Chrome／Edge 进程 working set／private bytes；其他标签页可能影响结果，共享 working set 可能重复计数。报告观察峰值及采样错误，不把它当作模型独占内存或分配上限。
- 初步三链路报告保存在 `artifacts/evals/editor-transcription/models-chrome-initial/` 和 `models-edge-initial/`。后续实现变化与不同配置通过源码／配置 hash 区分，历史报告不代替当前完整链路。

`editor-transcription.spec.ts`从真实FT结果跑五角色推理、OPFS文件校验、辅助试听、候选修正、显式V1应用与刷新恢复，并覆盖取消、损坏模型缓存和试听后清理。完整链工程样例为验证分类路径将音符分界改为10000ms；不是产品默认值，原候选时间仍完整保存。

`qualityFixtures.ts`自编CC0受控音色包括钢琴/拨弦各自独奏、稀疏混合、无目标区、长音/重复音/分段边界，以及同时击打、快速hat与跨段击打。`quality-probe.worker.ts`执行真实六轨分离→OPFS→逐乐器Basic Pitch及分段ADT_STR。`qualityMetrics.ts`保留全部原始观测，用120ms关联窗统计漏标、多标、分类/音高错误和带符号起止误差；该窗口是报告方法，不是验收阈值。合成素材不证明真实演奏录音质量。

`audition-long.spec.ts`验证15分钟源的有界PCM调度，连续播放120秒、远端跳转、模拟读取停顿/错误时的时钟冻结，以及租约释放后的清理；不宣称已连续播放完整900秒。输入为受控transport夹具，不是再次验收已接受的FT听感或处理时间。

完整链、受控质量和长源记录分别保存到`artifacts/evals/editor-transcription/full-chain/`、`controlled-quality/`、`long-audition/`。运行浏览器期间固定相关源码与测试，避免Vite热更新使候选身份和资源生命周期失效。只运行实际受影响的回归；真实钢琴/吉他录音与owner质量结论仍需各自证据。
