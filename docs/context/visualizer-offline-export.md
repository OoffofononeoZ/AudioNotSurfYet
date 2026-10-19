# Visualizer 离线视频导出

owner 于 2026-10-17 明确要求「不再使用实时录制，替换为离线确定性导出」，并批准实现计划。当前唯一视频生成链路为解码 PCM、绝对帧调度、同一 RendererHost 的手动渲染、WebCodecs/Mediabunny、OPFS 临时 WebM 与原生保存。历史录制数据见[输出质量说明](visualizer-output.md)，不用于当前能力判断。

## 时间、画面和音频

- 总时长 `D = decoded.length / decoded.sampleRate`；帧数 `ceil(D × fps)`，第 i 帧按 `i/fps` 求值。微秒时间戳直接计算，不累加 RAF 间隔或读取实时 AudioContext 时间。最后输入帧时长截到 D；容器或编码器的帧时长量化/Opus padding 仍须通过实际媒体门槛。
- 导出租约取消预览 RAF、重置场景并以输出尺寸/DPR 1 绘制。每帧先准备 Analyzer/原生输入及合同声明的历史，await 隔离算法返回 DrawPacket，再同步绘制和截图；编码等待或让出主线程不会跳过任何帧。预览与导出复用一个 Canvas 和 WebGLRenderer。取消、尺寸或身份变化使未完成帧失效，迟到包不得绘制。
- 从已解码 PCM 每次最多复制一秒，复用 speakers 双声道下混，连续重采样到 48kHz、编码双声道 Opus。页面音量不影响导出，不读取麦克风、系统播放或实时录制 tap。
- 使用固定 `mediabunny@1.61.6`，VP9 优先、VP8 次选，质量编码模式。音视频按最多一秒窗口交错输入，等待编码/写入背压；不缓存全部视频帧或额外复制整曲 PCM。依赖许可见 [第三方声明](../../THIRD_PARTY_NOTICES.md)。

| 输出 | 尺寸 | 视频目标码率 |
| --- | --- | --- |
| 720p30 | 1280×720 | 6 Mbps |
| 720p60 | 1280×720 | 9 Mbps |
| 1080p30 | 1920×1080 | 10 Mbps |
| 1080p60 | 1920×1080 | 16 Mbps |

音频目标码率 192 kbps。码率是目标值，不保证文件大小。底栏和执行预检使用同一实际配置能力查询；检查 WebCodecs、临时文件 API 及对应编码配置。四档不再按旧实时结果禁用，不支持时明确报错，不自动降档。当前 [Project V5](../architecture/visualizer/project-format-v5.md) 内嵌算法与 Shader，分组启用门控适用于输入准备与逐帧导出；已有输出档位不变。

## 交互与资源

`idle → preparing → exporting → finalizing → ready/error`。导出先检查配置和分析，再捕获播放检查点、独占 transport 并暂停播放。进度按已完成帧数计算，每秒最多十次 UI 通知。工程、播放/seek、换歌和队列修改使用导出锁；音量可调整。

成功、取消和失败均释放手动渲染租约并恢复最新预览尺寸；仅在歌曲及 decoded revision 仍匹配时恢复原播放状态和位置。身份变化或离页不恢复旧歌曲。WebGL 丢失、输入失败、编码错误与配额错误终止任务，旧任务不得提交迟到结果。

OPFS `visualizer-export` 下每个 UUID 文件持有独立 Web Lock，生成中和 ready 时均持锁。新任务清理无锁遗留文件，跳过其他标签页活动文件；不支持刷新续作。WebM 使用可回写封装，包含时长和定位信息。完成后保留磁盘支持的 File，保存取消/失败可重试；保存成功、丢弃、任务失败或离页删除临时文件。浏览器异常退出后的残留由下次任务清理。

## 验证与限制

2026-10-17 本机 Chrome `155.0.8059.80`、Edge `155.0.4283.45`：99 项相关单元/集成、22 项工具测试和生产构建通过。覆盖播放检查点、取消/身份变化、渲染目标释放、保存重试、配额失败，以及编码结束和恢复预览期间的 decoded revision 变化；新任务重置进度和上次错误。构建仍报告既有大 chunk 与 Browserslist 数据过期提示。

常规 Visualizer 浏览器专项各 32 项通过；每浏览器 4 项矩阵用例在下述显式运行中完成，另 1 项可选本地音乐双预设截图未在常规运行开启。专项包含输出配置/能力拒绝、保存取消、context recovery、资源清理，以及原生弦线 seek 到 9.2 秒后导出并恢复相同帧 hash。弦线输出各 360 帧并完整解码通过；44.1/48kHz 的 2.35 秒分块核心样例各 71 帧、48kHz 双声道，解码后跨分块区域连续有效，无静音缺口。

完整四档矩阵 `offline-matrix` 为每浏览器/档位首次同步片、同页重复同步片和音乐，共 24 份 VP9/Opus 文件、10,080 帧。`offline-frames-v3` 对所有文件验证精确帧数和每帧时间戳，全部通过；没有以掉帧警告放宽离线结果。同步片包含首秒前后的多个事件，音量设为零；禁止实时媒体 API，并暂停实时时钟。720p60 重复场景另施加 4 倍 CPU 限速。结果最大音画事件差 35.5ms、事件间相对漂移 17ms、音画尾部差 21ms、源时长差 20ms，均在原有 100ms/250ms 预算内。音乐使用实际几何预设，导出画面已抽帧检查。

十五分钟浏览器任务 `offline-long` 均完成 1080p60 的 54,000 帧、保存后再次导出并取消；取消后无临时输出文件和活动 OfflineAudioContext。源为 48kHz 单声道连续底音，加 0.15、1.5、450、898.5 秒同步脉冲，画面使用原生频谱 wireform 与白闪；这是受控长曲链路检查，不代表完整几何预设或任意复杂工程的性能。

两份长片的完整解码、精确 54,000 帧和逐帧 PTS 均通过；最大帧间隔 17ms，白闪均落在源事件时间。四个事件音画偏差均为 35.5ms，在 10ms RMS 窗口的测量精度内未见累计漂移；音画尾部差约 21ms、容器时长均为 900.02 秒。`--files-only` 仅判定这些长片通过，不把它们计作另一份完整四档矩阵。

| 浏览器 | 导出耗时 | 取消耗时 | 采样最大页面响应 | 采样峰值 JS heap |
| --- | --- | --- | --- | --- |
| Chrome | 263.289 秒 | 61ms | 90ms | 172.3MiB |
| Edge | 254.579 秒 | 68ms | 38ms | 178.0MiB |

页面响应/heap 每两秒采样，系统内存按约一秒采样。Chrome/Edge 运行期间分别观察到浏览器工作集峰值 1781.1/1664.9MiB、private bytes 峰值 1888.7/1816.9MiB、设备 GPU 显存峰值 2525/2537MiB。浏览器计数聚合本机所有 Chrome/Edge 进程并可能重复计算共享工作集，GPU 为设备整体；JS heap 不包含原生/GPU 内存。这些是本机观测值，不是独占进程归因、内存上限或新性能承诺。首次长曲运行在已编码完毕后的测试端大文件复制触发默认 5 秒等待超时；将测试保存等待改为 120 秒后，两浏览器重跑通过，未据此修改产品保存实现。

复现短矩阵时设置 `VISUALIZER_OUTPUT_MATRIX=1`、`VISUALIZER_OUTPUT_RUN=offline-matrix`，运行 `visualizer-output.spec.ts` 的 Chrome/Edge 专项，再执行 `node tests/scripts/verify-visualizer-output.mjs offline-matrix --all`。长曲设置 `VISUALIZER_EXPORT_LONG=1`，运行 `visualizer-offline-long.spec.ts` 的双浏览器专项，再执行 `node tests/scripts/verify-visualizer-output.mjs offline-long --files-only`。原始视频、capture 与版本化 measurement 保存在本地忽略目录 `artifacts/visualizer-composition/output/`，不加入仓库。

确定性指时间轴、帧求值和音轨同步，不要求不同设备/编码器产生逐字节相同的文件，也不承诺导出快于实时。上述为阶段实现与工作树的功能证据，不标记正式 canonical；OPFS 自动化不代替原生 OS picker 人工验收，不改变历史 readiness 或发布边界。
