# Wallpaper Engine 风格频谱（近似）

本页记录 owner 授权实施计划后的当前算法与接口。它用于音频响应动画，不用于精确响度或声学测量，不承诺与当前 Wallpaper Engine 逐值相同。Sucrose 和社区壁纸只作背景对照，不混入其算法。

## 依据与取舍

- [官方接口](https://docs.wallpaperengine.io/en/web/audio/visualizer.html)：128 个值，左 0–63、右 64–127，每侧从低到高；约 30Hz，通常 0–1，允许超过 1。
- [开发者历史评论](https://steamcommunity.com/sharedfiles/filedetails/?id=837435817)：Biohazard 于 **2017-01-31** 提及默认约 33% 零填充、与采样率关联的输入长度和避免跳过桶的规则。此历史描述不证明今天的全部实现。
- [OWE Audio System](https://github.com/deepratna-awale/open-wallpaper-engine-mac/wiki/Audio-System) 和固定提交 [4aaec723](https://github.com/deepratna-awale/open-wallpaper-engine-mac/tree/4aaec723/OpenWallpaperEngine/Audio) 的 `AudioSpectrumBlockTransform.swift` / `AudioSpectrumSmoothing.swift`：仅作为未公开细节的近似参考。该提交的输入块没有上述补零，其特殊复数编码也不作为官方事实或本项目输入。

项目独立实现实数 PCM 的 Bluestein DFT，卷积采用可复用 radix-2 FFT，无新运行时依赖。保持 127 的输入幅度因子，但不加入 DC 偏置或虚部倒数。没有额外时域窗；OWE 的余弦权重作用于输出频率。

## 固定算法

- `N = floor(max(sampleRate/44100, 1) × 1920)`；`P = floor(N × 0.67)` 个连续 PCM 样本，其余尾部为零。此处把“33%”解释为 DFT 长度中的零比例，是本项目明确选择。
- 每声道扫描 DFT bin 1–639。`t=(bin−1)/639`；候选桶 `floor(t^0.25 × 64) % 64`，实际桶不超过前桶加一，保证全部 64 桶有真实 bin 覆盖。各桶取 `sqrt(0.501−0.499 cos(πt)) × abs(DFT)` 的最大值，再乘 `0.001 × 640/(N/2)`。
- 默认录音音量 50 对应倍率 1；可选录音阈值关闭。16 组、每组 8 值，组峰值至少为总峰的 0.333；低于 0.0001 输出静音。组级别每步最多上升 `1/30`、下降 `1/60`，除数下限 0.001；声音重新开始时按参考规则初始化为 1。
- 平滑每个 30Hz 步跟随 `min(20/30,1)`，输出每步变化限于 `±min(40/30,1)`。不裁剪到 1。静音输出零，平滑历史保留，组级别继续接近峰值。
- 不使用粉噪校准、空间模糊、最低能量或零尾裁剪。频段表给出覆盖的 DFT bin 边界，不能理解成校准滤波器的通带。

## 时间、声道与生命周期

生产块不重叠、不丢弃块间 PCM。块在累计 P 个样本后完成；消费者在 `t=k/30` 读取最近完成的块并推进一次增益和平滑。首块完成前输出零，歌尾不足一整块的剩余 PCM 不作为已完成块提前读取。序列从歌曲零点确定，暂停、seek、循环、录制不受页面 RAF 频率或访问顺序影响。

单声道复制；双声道独立。四声道按 `0.5×(L+SL)` / `0.5×(R+SR)` 下混；5.1 为 `L+sqrt(1/2)×(C+SL)` / `R+sqrt(1/2)×(C+SR)`，忽略 LFE；其他声道数按 Web Audio speakers 的 discrete 情况取前两路。

沿用唯一 AnalysisCoordinator/Worker。只有此特征缓存未命中时在已有分块 PCM copy 中额外构造立体声；复制时检查 generation/revision，计算后不保留立体声 PCM。Worker 在最多 32 个消费者帧或约 8ms 后 yield，取消/换歌结果隔离。既有 Meyda 1024/512/Hanning/average-mono 提取不变；series 汇总已拆为独立模块，避免新算法并入 Meyda 适配器。

## Payload、界面与工程

`wallpaperEngineSpectrum` 是定义列表第一项，仍受最多四项 FIFO 约束。`stereo-spectrum-f32` 固定 width 128、step 1/30；完整 Float32 值供热图、数值表、Visualizer、缓存和精确游标共享。缓存校验非负有限值、形状、时间步、长度和特征身份，算法版本及固定参数进入 config hash。恢复缓存后无需重算立体声来读取游标。

Analyzer 上方分别显示左右热图，下方分别显示 64 根当前柱；数值表含数组索引、声道、频段、参考频率范围及无缩短的原始数值。颜色/柱高范围随数据自适应，保留超过 1 的值，复用共享时间视口与分层 Canvas。简介展开后可点击上述三个来源。

Visualizer 完整向量和标量投影均支持该特征；完整向量采用同一 30Hz 帧，不插值。运行时参数携带 `we-strength`、`stereo-64` 元数据。新“几何律动”绑定此向量，直接乘响应系数 0.6；旧工程保持原绑定，可手动选择或重新添加预设。原生输入保留，但恢复原始 Web Audio FFT/有符号波形，见[原生输入](visualizer-native-input.md)。环形轮廓恢复完整数组直接重复，真实零尾与接缝保留。

Analyzer 工作区标记 `analyzerWorkspaceVersion:2`；旧标记或缺少标记时，清空活动项、视口、manifest 和缓存 payload 后写回当前格式。移除排序字段及 helper，不迁移旧顺序；保留歌曲队列、句柄、当前 Blob 与独立 Editor/Visualizer 草稿。当前格式继续严格校验活动项和视口。

## 验证入口与边界

数值：`tests/analysis/wallpaper-spectrum.test.ts`；混合/缓存：`tests/analysis/m6-coordinator.integration.test.ts`；浏览器：`tests/e2e/wallpaper-spectrum.spec.ts`、`tests/e2e/visualizer-presets.spec.ts`。15 分钟回归沿用 `m6-analysis.spec.ts` 的 ≤100ms 交互反馈、无分析归因 >50ms 主线程长任务及取消检查，四项中包含本特征。日常功能验证不更新历史 canonical 或整体 readiness，也不以消除零值作为验收标准。

2026-10-17 本轮功能验证：类型检查、生产构建与 40 文件 **229 项**相关 Vitest 通过。Chrome/Edge 各 **26 个不同场景**分批通过，包含新特征/链接/双声道图表/完整表格、混合活动项、刷新 cache hit、精确游标、旧工作区清理、原生切换/失败重试、几何预设、实际音乐画面/短录制，以及 M6/M7/M12/M13/M14 相邻回归。浏览器测试修订了旧文案、首项顺序、像素取整、工作区展开方式及顺序播放末尾假设；资源测试明确选列表循环，缩放精度和性能门槛不变。恢复缓存先于解码触发消费者注入，避免在缓存到达前重算。

包含新特征的 15 分钟四项分析，在一轮 Chrome/Edge 中最大反馈为 **9.3ms / 9.1ms**，进度单调且取消通过，无分析归因 >50ms 主线程长任务。包含新特征的 20 次切歌/路由/取消循环，两端均为 1 个 Worker、1 个 AudioContext，RAF 范围 2–3；GPU context recovery 与离页释放另通过。独立 Editor 草稿基础集成 11 项包含在上述 229 项内，草稿格式未增加 Analyzer 版本字段。

使用本地音乐的无元数据四秒片段检查两处画面并录制；两端 WebM 均经 FFmpeg 完整解码，视频 1280×720、VP9，按实际包时间戳测得约 **29.98fps / 29.73fps**。媒体仅留在忽略目录 `artifacts/visualizer-composition/presets/`，不新增受控 fixture 或记录用户原文件信息。构建保留既有大 chunk 与 Browserslist 数据过期提示。此结果为功能反馈，不是 clean canonical、整体 readiness 或发布批准。
