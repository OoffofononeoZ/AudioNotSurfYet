---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/context/system-map.md"
  - "docs/architecture/processing/worker-and-project-contracts.md"

---

# FT ONNX Model Artifacts

本文件是固定模型身份与许可来源，表格被下载工具和测试读取。实际bytes已核对；旧Asyncify session失败、随后官方JSEP四图/数值通过及当前FT功能接受分别见evidence，不把任何单项通过扩写为完整正式评审通过。

## Source and Identity

采用 StemSplit 转换的 `htdemucs_ft` 四专用模型，使用 `demucs-onnx` v0.3.0 [模型目录](https://github.com/StemSplit/demucs-onnx/blob/main/docs/models.md)所描述的 `fp16weights` 文件。这个版本标识转换方案的来源；产品运行时只使用 ONNX Runtime Web，不安装转换工具。发布者声明权重为 MIT；delivery 必须保留原模型与转换来源的许可证及 attribution。

| Role / output row | Repository | Immutable revision | File | Bytes | SHA-256 |
| --- | --- | --- | --- | --- | --- |
| drums / 0 | StemSplitio/htdemucs-ft-drums-onnx | `44f630d49a19053a61c12df7244fe1f01b9ccc4f` | `htdemucs_ft_drums_fp16weights.onnx` | 165612636 | `047764dff888cfb87da917013377d4ec7a134f7419cbe486d9c339aa17975ddd` |
| bass / 1 | StemSplitio/htdemucs-ft-bass-onnx | `6b68834ec1a38cd0b52df39daef934b0129bf8df` | `htdemucs_ft_bass_fp16weights.onnx` | 165612636 | `b533037176b14b2df31c92a5d5b3d5660d0811b9b360d3db761964768b079961` |
| other / 2 | StemSplitio/htdemucs-ft-other-onnx | `fbcaddbf49915896c2b1e8f53dc648e069ba16e9` | `htdemucs_ft_other_fp16weights.onnx` | 165612636 | `b739171a7057b3107bb0711c6222d4a619b41b13a8f04026431d30f32ad2bd71` |
| vocals / 3 | StemSplitio/htdemucs-ft-vocals-onnx | `fd6ed435870341162ac4b3e7dcc9c8a89c3ecc60` | `htdemucs_ft_vocals_fp16weights.onnx` | 165612636 | `0cbe651f535415c9d26a7bb614f7d322dd5a080fa0298f2e50f478030a994dce` |

对应发布指针：[drums](https://huggingface.co/StemSplitio/htdemucs-ft-drums-onnx/commit/44f630d49a19053a61c12df7244fe1f01b9ccc4f)、[bass](https://huggingface.co/StemSplitio/htdemucs-ft-bass-onnx/raw/6b68834ec1a38cd0b52df39daef934b0129bf8df/htdemucs_ft_bass_fp16weights.onnx)、[other](https://huggingface.co/StemSplitio/htdemucs-ft-other-onnx/raw/fbcaddbf49915896c2b1e8f53dc648e069ba16e9/htdemucs_ft_other_fp16weights.onnx)、[vocals](https://huggingface.co/StemSplitio/htdemucs-ft-vocals-onnx/commit/fd6ed435870341162ac4b3e7dcc9c8a89c3ecc60)。下载地址由 repository、immutable revision 和 file 构成 `https://huggingface.co/<repository>/resolve/<revision>/<file>`，产品不能以浮动 `main` 代替已锁定 revision。

四文件合计 662450544 bytes（约 662.5MB / 631.8MiB）；首次使用显示实际待下载总量、逐文件字节进度、校验与 cache hit 状态。部分已缓存时只下载缺失文件。下载取消、网络失败或 checksum 不符均不得发布可用模型 entry；用户音频不进入模型请求。

## Tensor and Processing Contract

- 输入为 `mix`，float32，shape `[1,2,343980]`，44.1kHz stereo、7.8 秒分段；输出为 `stems`，float32，shape `[1,4,2,343980]`，row 顺序 drums、bass、other、vocals。专用模型只取表中对应 row，其他 row 不作为该角色结果，更不能以一个专用模型冒充完整四轨。发布者 [bass](https://huggingface.co/StemSplitio/htdemucs-ft-bass-onnx) 和 [other](https://huggingface.co/StemSplitio/htdemucs-ft-other-onnx) model card 提供 tensor 与专用输出说明。
- 按 drums → bass → other → vocals 顺序：加载一个 session，完成该角色的全曲分段与 overlap-add，保存 stem，释放 session/tensor/GPU buffers 后进入下一个。不得同时保留四个模型 session 或把全曲四轨都积在内存。
- `fp16weights` 压缩权重存储，输入/输出保持 Float32；P1 实际解析还发现内部 `/real_istft/ConstantOfShape` 的 DOUBLE 常量，不能据此宣称内部全程 fp32 或全图 GPU。不能把文件名当作 fp16 compute 或更低运行内存的承诺。[转换者说明](https://github.com/StemSplit/demucs-onnx/blob/main/docs/models.md)
- 原始解码 PCM 保持不可变；mono 输入在模型边界复制为 stereo，原 source identity 不变。超过两个 channel 的分离输入明确报不兼容，不默做未定义 downmix。重采样、normalization/denormalization、overlap/窗函数、尾段 padding、拼接与精度参数必须进入版本化 config/hash，并以参考推断与合成 fixture 验证，不能跳过 preprocessing。
- 输出使用 44.1kHz，frame count 为 `round(originalDurationSeconds × 44100)`；只允许不超过一个输出 sample 的尾部长度修正。重采样时补偿滤波延迟，分段 overlap 不得重复、遗漏或平移事件；首尾静音与原始绝对秒数必须保留。
- browser WAV encoder 导出 stereo IEEE float32 WAV，按实际 frame count/sample rate 写 header；不改变增益、截静音或调用额外编码程序。waveform 与 30Hz energy 从同一已拼接 stem 生成。

## Runtime Evidence Boundary

P1 实施配置与实际部署资产见 [FT kernel configuration](ft-kernel-config.md)。这些是已授权的配置身份，不是模型兼容/质量/性能通过记录。

使用 ORT 显式 WebGPU EP，关闭 proxy Worker；在项目专用分离 Worker 内初始化 session。P1 已证明同一 ORT 1.30.0 包的 JSEP WebGPU 构建（`ort.all.min.mjs`、JSEP WASM）关闭图优化后能执行原始四图；原 `onnxruntime-web/webgpu` Asyncify 构建无法分配内部 DOUBLE 节点。JS/WASM、版本、构建及 asset hash 一起锁定，当前配置见 [FT kernel config](ft-kernel-config.md)。官方 [WebGPU 指南](https://onnxruntime.ai/docs/tutorials/web/ep-webgpu.html)与[部署指南](https://onnxruntime.ai/docs/tutorials/web/deploy.html)说明部署要求，不能替代本项目的数值、质量和性能证据。

首个切片须记录每个模型的 session 创建、实际 kernel 分配、输出 role/shape、短段 reference parity、完整 overlap-add、取消释放和参考机长曲指标。不支持的图或 WebGPU/device 失败明确返回错误；不得通过整图 WASM/CPU 重跑来掩盖问题。任何 ORT 内部 CPU kernel 分配也要在验证证据中列出并计入资源/耗时，不能宣称全图 GPU。

## Approval

2026-10-04，owner 随浏览器处理修订计划授权本模型契约和 ADR-0024/0025 获批；模型 bytes 校验、运行库锁定与浏览器验证仍是实施前置任务，R-046、R-048、R-049、R-052 保持 Open。

## P1历史Checkpoint

2026-10-04，四文件实际 bytes/size/SHA 与批准表全匹配；ORT 1.30.0 六项实际资产已锁定。clean candidate `9198b37` 的 Chrome/Edge 四图均在 session 创建处失败，具体错误及 DOUBLE 诊断见 [P1 evidence](../../quality/processing/evidence-index.md)。本轮未更改 artifact/model/runtime 身份，未进入真实推断/长曲/试听，相关风险仍 Open。

当前状态：官方ORT JSEP已在Chrome/Edge运行四原图，DEC-071数值门槛为1.5e-3，DEC-074接受当前汇总听感/长曲耗时并收尾Editor功能。历史创建失败未改写；完整P1/P2 clean及OS等缺口见[证据](../../quality/processing/evidence-index.md)和[接入记录](../../quality/processing/editor-integration-evidence.md)。模型表的revision/bytes/hash/许可未改变。
