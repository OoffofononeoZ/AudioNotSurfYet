# Visualizer 原生输入

owner 于本轮几何壁纸复刻修正中明确授权：频谱输入增加“原生输入”，由 Web Audio 分析，特征列表只显示可用项。

## 来源与工程

- 在频谱视觉元素的“频谱输入数据来源”中可选固定值、Analyzer、原生输入。原生特征为“频谱（立体声）”和“时域波形”；选择来源时同步切换特征列表，不保留无效的 Meyda featureId。
- 支持弦线、点阵、环形频谱、轨道几何体、旋转线框、弧簇、光轨隧道和星尘。弦线就绪前准备到当前歌曲时间的完整原生积分输入，不以当前原生帧或零值填补历史。
- 当前 Project V5 binding 的 source 联合类型包含 `{kind:'native',featureId:'frequency'|'waveform'}`，只允许算法合同声明的向量输入；native 没有 component/projection/transform。旧版工程不迁移。
- 原生输入不占用 Analyzer 的四项特征额度，不请求 Meyda Worker/cache。元素可在属性中显式切换允许的来源。“几何律动”默认绑定 [Wallpaper Engine 风格近似特征](wallpaper-spectrum.md)，占一项 Analyzer 额度。

## Web Audio 与时间

`NativeAudioSource` 通过 AudioEngine 已有 `DecodedAudioCopyPort` 复制当前歌曲的有界 PCM；不读取麦克风或系统播放，也不创建第二条实时输出链。

每个任务使用一个静音 `OfflineAudioContext`，按 Web Audio speakers 规则混合到双声道后由两个 `AnalyserNode` 分别读取左右声道；单声道复制到两侧，多声道保留标准 down-mix 内容。FFT size 为 2048，频谱使用浏览器原生 `getByteFrequencyData`，分贝窗口为 −100 至 −30 dB，`smoothingTimeConstant=0`。按绝对歌曲时间 30 Hz 取样；固定 4 秒 chunk 和前置 FFT 窗口使暂停、seek、循环与录制的数据一致，不依赖 RAF 或上一轮播放历史。

频谱直接返回左 1024、右 1024 个线性 FFT byte bin（0–255，含 DC），不做特殊分频、空间平滑、平方响应或 2/3 校准。渲染参数标记 `byte-frequency` / `stereo-1024`；几何渲染在每侧等分为 64 段取峰并除 255 后乘响应系数，其他元素同样在渲染层换算单位。

时域波形来自同一 AnalyserNode 的 `getFloatTimeDomainData`，左右平均后保留有符号 Float 值；参数标记 `signed-waveform`，显示所需绝对幅度由渲染层计算。仅弦线积分使用的紧凑历史保存绝对峰值，仍属于该渲染器输入准备。

## 资源与失败

- 最多一个进行中的 chunk，LRU 最多四个 chunk；播放接近边界时预取下一段。每个 chunk 同时保存两种原生特征，多个元素共享同一帧。
- 按启用算法的 `contract.historyParameters` 保留所需特征的 64-band Float32 紧凑历史（每秒每特征 64×4×30 字节），使原始帧被 LRU 淘汰后仍能重建积分。宿主按算法请求的 60Hz tick 读取该历史，保留原有 30Hz 输入取样语义。当前弦线声明此能力；新增算法无需以 ID 加入内核名单。seek 到尚未处理的历史时按段补齐并显示准备状态；删除对应绑定后释放该特征历史，换歌/离页全部释放。
- 缓存绑定 trackId、decoded revision、采样率、长度和声道数。换歌、离页、重试使旧任务失效；进行中的离线任务在下个暂停点结束并释放节点，旧结果不通知新页面。
- 数据未就绪时显示“原生输入准备中”；浏览器 API 或处理失败明确显示错误并提供原生重试，不切换为 Analyzer 或随机值。
- 离线导出启动前准备 time-zero 原生帧，逐帧等待输入和算法；等待期间工程或路由改变则退出。就绪通知只请求现有 host 的单帧重绘，不改变 binding revision 或重置其他元素的积分状态。

验证入口：`tests/visualizer/native-input.test.ts`、`tests/e2e/visualizer-presets.spec.ts`。浏览器专项包含真实左右异频输入、来源/特征切换、严格工程往返、错误恢复、seek 画面一致、WebM 和离页释放。日常验证不代表整体 readiness。
