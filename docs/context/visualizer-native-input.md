# Visualizer 原生输入

owner 于本轮几何壁纸复刻修正中明确授权：频谱输入增加“原生输入”，由 Web Audio 分析，特征列表只显示可用项。

## 来源与工程

- 在频谱视觉元素的“频谱输入数据来源”中可选固定值、Analyzer、原生输入。原生特征为“频谱（立体声）”和“时域波形”；选择来源时同步切换特征列表，不保留无效的 Meyda featureId。
- 支持弦线、点阵、环形频谱、轨道几何体、旋转线框、弧簇、光轨隧道和星尘。弦线就绪前准备到当前歌曲时间的完整原生积分输入，不以当前原生帧或零值填补历史。
- 本次扩展 V3 元素 binding 的 source 联合类型：`{kind:'native',featureId:'frequency'|'waveform'}`，只允许已注册的向量输入；没有 component/projection/transform。旧 V3 常量与 Analyzer binding 保持原样可读，新 binding 不能由不认识 native 的旧程序读取；不静默迁移既有工程。
- 原生输入不占用 Analyzer 的四项特征额度，不请求 Meyda Worker/cache。旧工程可在属性中显式切换来源，或重新添加新版“几何律动”。

## Web Audio 与时间

`NativeAudioSource` 通过 AudioEngine 已有 `DecodedAudioCopyPort` 复制当前歌曲的有界 PCM；不读取麦克风或系统播放，也不创建第二条实时输出链。

每个任务使用一个静音 `OfflineAudioContext`，按 Web Audio speakers 规则混合到双声道后由两个 `AnalyserNode` 分别读取左右声道；单声道复制到两侧，多声道保留标准 down-mix 内容。FFT size 为 2048，频谱使用浏览器原生 `getByteFrequencyData`，分贝窗口为 −100 至 0 dB，`smoothingTimeConstant=0`。按绝对歌曲时间 30 Hz 取样；固定 4 秒 chunk 和前置 FFT 窗口使暂停、seek、循环与录制的数据一致，不依赖 RAF 或上一轮播放历史。

频谱由每声道 1024 个线性 bin 适配为 64 个频段：低频近似线性、高频指数展开到 16 kHz（不超 Nyquist），跳过 DC，按覆盖权重取平均并做相邻频段空间平滑。固定平方响应与 2/3 标度校正避免默认 −30 dB 上限造成过度饱和；然后编码到既有幅度参考 128，几何渲染解码后乘 owner 指定的 0.6。左右声道各自保留，不复制单声道。这是展示适配，不声称重现 Wallpaper Engine 内部 FFT 或分桶算法。

时域波形来自同一 AnalyserNode 的 `getFloatTimeDomainData`，左右平均后取绝对幅度并乘参考 128，供现有非负视觉输入使用。

## 资源与失败

- 最多一个进行中的 chunk，LRU 最多四个 chunk；播放接近边界时预取下一段。每个 chunk 同时保存两种原生特征，多个元素共享同一帧。
- 仅对启用弦线使用的特征另保留 64-band Float32 紧凑历史（每秒每特征 64×4×30 字节），使原始帧被 LRU 淘汰后仍能重建积分。seek 到尚未处理的历史时按段补齐并显示准备状态；删除对应绑定后释放该特征历史，换歌/离页全部释放。
- 缓存绑定 trackId、decoded revision、采样率、长度和声道数。换歌、离页、重试使旧任务失效；进行中的离线任务在下个暂停点结束并释放节点，旧结果不通知新页面。
- 数据未就绪时显示“原生输入准备中”；浏览器 API 或处理失败明确显示错误并提供原生重试，不切换为 Analyzer 或随机值。
- 录制启动前准备 time-zero 原生帧，等待期间工程或路由改变则退出。就绪通知只请求现有 host 的单帧重绘，不改变 binding revision 或重置其他元素的积分状态。

验证入口：`tests/visualizer/native-input.test.ts`、`tests/e2e/visualizer-presets.spec.ts`。浏览器专项包含真实左右异频输入、来源/特征切换、严格工程往返、错误恢复、seek 画面一致、WebM 和离页释放。日常验证不代表整体 readiness。
