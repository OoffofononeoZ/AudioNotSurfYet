# Visualizer 实时样式与壁纸

DEC-091：owner 批准预设能力分类、首页实时样式、本站独立展示地址及 Wallpaper Engine 项目目录导出。浏览器分析当前播放器实际声音，在主音量前取样；本轮只支持无历史查询、无 Editor 标记和无局部分镜的元素。覆盖整曲的时段转换为常驻，不改写原工程或默认预设。

## 输入与能力

`realtimeCapabilities.ts` 根据有效元素、算法合同、绑定和时段计算能力，预设库与工程使用同一规则。浏览器支持当前逐帧特征和 native；壁纸动态输入限定 `wallpaperEngineSpectrum`。固定内容满足两者。局部分镜、转场、标记、未配置输入和历史查询给出具体原因；禁用元素和隐藏组不参与。

AudioEngine 按租约创建静音分析旁路，复用唯一 AudioContext。AudioWorklet 只复制 PCM，最多四组左右各 1024 sample 的缓冲；溢出明确失败。AnalysisCoordinator 互斥复用同一分析 Worker，通过专用 MessagePort 传递 PCM/回收缓冲。实时特征不创建整曲序列、不写分析缓存；Meyda 使用原配置，WE 使用原变换和平滑，输出约 30Hz。

实时输入为因果窗口，倍速会影响音高，数值不承诺与整曲展示序列相同。换歌、seek、输入切换使旧租约和结果失效；暂停、离页和销毁释放节点/端口。native 保持原 byte-frequency / signed-waveform 单位。高频输入留在运行时模块，不写 Pinia。

## 渲染边界

共享 CompositionRenderModel 不要求歌曲身份。实时模式向算法提供会话秒、当前参数和 `range:null`，拒绝历史和标记查询；原 V5、资源包 V2、ABI 1/2 与离线求值保持。RendererHost 的 animate 可独立于播放状态控制连续动画，仍只有单 Canvas、renderer 和视觉 RAF。

验证覆盖因果提取/块边界、WE 对照、分类和原渲染/分析邻接回归；后续界面与壁纸验收按实际交付记录，不构成整体 readiness。
