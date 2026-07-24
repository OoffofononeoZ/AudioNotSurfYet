# 音频播放与分析

## 当前播放链路

`MusicBar.vue` 的已证实链路：

1. 创建 `<input type="file" accept="audio/*" multiple>` 获取本地文件。
2. 用 `music-metadata.parseBlob()` 读取标题、艺术家、时长和内嵌封面。
3. 为音频文件创建对象 URL，保存到组件内 `musicFileUrl`；元数据保存在 `albumInfo`。
4. `playAt()` 让 `AudioLoader.loadAudio()` fetch 对象 URL、解码 AudioBuffer、设置音量与 ended callback，然后播放。
5. 独立 RAF 更新播放进度；另一个 RAF 从 Analyser 读取时域浮点数据并用 Meyda 提取 `energy`。
6. 平滑后的能量在样式 0 中经 `mapEnergyToDeg()` 写入 CSS 变量，同时原始能量通过 `audioStore` 驱动 Home 光线长度。

## AudioLoader 状态模型

`src/audio/audioLoader.ts` 当前节点链路为：

```text
AudioBufferSourceNode → AnalyserNode → GainNode → audioContext.destination
```

- AudioBufferSourceNode 是一次性的；每次恢复或跳转后需要创建新 source。
- `playbackOffsetSec` 保存暂停/跳转位置，`playbackStartContextTime` 用 AudioContext 时钟计算当前进度。
- 主动停止 source 时用 `suppressEndedCallback` 阻止误触发自动下一首。
- `pause()` 累加经过时间并停止 source；`resume()` 从当前 offset 创建新 source。
- `setPlaybackOffsetPercent()` 只改变 offset。调用方要负责在播放中先暂停、设置，再恢复。
- `destroy()` 停止、断开 Analyser/Gain、关闭旧 AudioContext，并重新创建 AudioContext/Gain 供后续使用。

不要把 HTMLMediaElement 语义套到此实现；这里播放核心是已解码的 AudioBuffer。

## MusicBar 状态边界

- `audioReady` 表示当前 buffer 已成功解码，`isLoading` 防止并发加载，`isPlaying` 驱动进度与能量 RAF。
- `canSeek` 只有在队列非空、音频就绪且未加载时为真。
- 拖动开始时暂停，拖动结束后写入 offset，并仅在拖动前正在播放时恢复。
- 删除当前项会选择可用的相邻项；清空队列会停止、销毁、归零进度和能量。
- ended callback 调用下一索引，索引归一化使队列循环播放。

## 能量处理

- Meyda 输入来自 `AnalyserNode.getFloatTimeDomainData()`。
- 上升和下降使用不同平滑系数；当前值分别为 0.5 与 0.05。
- `mapEnergyToDeg()` 将能量非线性映射到矩形半周对应的 180–360 度。
- 不播放、无时域数据、切换样式或清空列表时必须停止 RAF 并将共享能量/CSS 进度归零。
- 样式 1 的循环渐变由 GSAP 时间线独立驱动，不是音频能量；切出该模式时必须显式清理内联 CSS 值。

## 对象和资源生命周期

已证实：

- 删除或清空列表会 revoke 音频文件对象 URL。
- 内嵌封面也可能创建对象 URL，但当前删除/清空路径未显式 revoke 它。
- MusicBar 卸载会停止 RAF、监听和 GSAP，但当前未显式调用 `audioLoader.destroy()`，也未遍历释放仍在队列中的对象 URL。

后两项是资源生命周期风险，不是本 Skill 自动授权的功能修改。涉及修复时要覆盖重复加载、删除、清空、路由卸载和再次播放。

## 测试数据与失败路径

- 优先使用用户提供或仓库允许的本地短音频 fixture；不要擅自上传或联网获取用户音频。
- 覆盖无文件、无效/损坏音频、无元数据、无封面、零时长或解码失败。
- 覆盖浏览器尚未允许 AudioContext、`resume()` 异步、快速切歌和加载中删除。
- 校验暂停/续播/跳转/ended 的 offset 连续性，而不只观察图标。
- 检查错误后 `isLoading`、`audioReady`、`isPlaying`、进度和能量是否回到一致状态。
