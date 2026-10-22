# Visualizer 实时样式与壁纸

DEC-091：owner 批准预设能力分类、首页实时样式、本站独立展示地址及 Wallpaper Engine 项目目录导出。浏览器分析当前播放器实际声音，在主音量前取样；本轮只支持无历史查询、无 Editor 标记和无局部分镜的元素。覆盖整曲的时段转换为常驻，不改写原工程或默认预设。

## 输入与能力

`realtimeCapabilities.ts` 根据有效元素、算法合同、绑定和时段计算能力，预设库与工程使用同一规则。浏览器支持当前逐帧特征和 native；壁纸动态输入限定 `wallpaperEngineSpectrum`。固定内容满足两者。局部分镜、转场、标记、未配置输入和历史查询给出具体原因；禁用元素和隐藏组不参与。

AudioEngine 按租约创建静音分析旁路，复用唯一 AudioContext。AudioWorklet 只复制 PCM，最多四组左右各 1024 sample 的缓冲；溢出明确失败。AnalysisCoordinator 互斥复用同一分析 Worker，通过专用 MessagePort 传递 PCM/回收缓冲。实时特征不创建整曲序列、不写分析缓存；Meyda 使用原配置，WE 使用原变换和平滑，输出约 30Hz。

实时输入为因果窗口，倍速会影响音高，数值不承诺与整曲展示序列相同。换歌、seek、输入切换使旧租约和结果失效；暂停、离页和销毁释放节点/端口。native 保持原 byte-frequency / signed-waveform 单位。高频输入留在运行时模块，不写 Pinia。

## 渲染边界

共享 CompositionRenderModel 不要求歌曲身份。实时模式向算法提供会话秒、当前参数和 `range:null`，拒绝历史和标记查询；原 V5、资源包 V2、ABI 1/2 与离线求值保持。RendererHost 的 animate 可独立于播放状态控制连续动画，仍只有单 Canvas、renderer 和视觉 RAF。

验证覆盖因果提取/块边界、WE 对照、分类和原渲染/分析邻接回归；后续界面与壁纸验收按实际交付记录，不构成整体 readiness。

## 本地样式与展示

`RealtimeStyleV1` 使用独立 `audiosurf-realtime-style` / schemaVersion 1，保存有效元素、参数、图层、效果、帧率与算法快照，不含歌曲、分镜、标记或预设作者控件。仅支持 Seed 的元素保存自身 seed，不保存顶层 seed。恢复纯校验资源身份、绑定和引用；保存前另在隔离运行时验证零时刻帧，随后在独立 IndexedDB 中以 add 写入不可变 ID。已生成地址不随原工程编辑而改变。

DEC-097 替代 DEC-092 的全局 Seed：元素 seed 接受 uint32 或 null，版本号保留。空值原样进入首页/展示页快照和壁纸文件；每次创建会话按元素独立随机，尺寸变化、暂停和重试沿用当次值。校验阶段使用临时种子，不固定保存效果。旧顶层 Seed 按 V5 相同规则显式迁移，样式保留原 ID 原子写回，失败不覆盖原文。已导出的壁纸目录不自动改写。算法 ABI 仍接收数字，未声明元素传 0；算法源码和 Shader 不变。

Visualizer“实时样式”提供名称、应用到首页和生成展示地址。首页保存 homeDisplayMode/homeStyleId，保留详情切换、导航和播放器。`/display/:styleId` 继续在 MainLayout 内复用服务，隐藏侧栏，画面适应整个视口，播放/返回/全屏控件两秒隐藏，聚焦期间保持。地址限同站点、当前浏览器的本地存储；没有跨标签页播放同步。刷新恢复既有音频会话为暂停，缺失/损坏样式明确报错。

动画以会话单调时间推进，暂停播放按静音输入处理；换歌/seek/变速重置特征与映射平滑，动画时间继续。页面隐藏时暂停实时输入和动画，重新可见时重新采集；离开或切回详情释放全部实时资源。

## Wallpaper Engine 目录

`npm run wallpaper:runtime` 使用独立 Vite IIFE 入口打包共享渲染内核、Three.js 和隔离算法 bootstrap，输出到忽略的 public/wallpaper-runtime；dev/build 自动准备，不包含外部资源库。导出内嵌当前精确算法快照，目录为 index.html、style-data.js、runtime.js、project.json 和 THIRD_PARTY_LICENSES.txt；不依赖项目服务器、CDN 或歌曲文件。

“导出 Wallpaper Engine”先验证样式与准备产物，随后独立“选择目录并保存壁纸”按钮保留原生目录选择所需的用户手势。只创建唯一新子目录，不覆盖现有文件；project.json 最后写入，含 type:web、file:index.html、supportsaudioprocessing:true。取消/失败清理本次目录，清理失败明确报告路径。

运行时在 body 末尾同步注册一次 wallpaperRegisterAudioListener，校验并直接使用左右各 64 项非负有限强度，允许超过 1。只做现有绑定投影/映射，不重复执行项目 WE 近似分析。响应 applyGeneralProperties.fps 和 setPaused，使用单会话时钟与 renderer。API、Shader 或输入失败在壁纸内明确显示错误。

本轮功能验证：最终 Visualizer/音频/分析相关 166 项 Vitest、55 项工具测试和生产构建通过。Chrome/Edge 共 28 场景包含首页/展示、20 次模式切换后的音频旁路释放、目录导出/产物 file:// 离线加载及外壳/离线视频相邻回归。原生 Wallpaper Engine 独立屏外预览成功渲染，约五秒内会话时间持续推进，无 JS/Shader 错误；该预览没有收到宿主音频回调，最小官方监听示例对照也为零回调。真实系统音频响应仍未验证，不将模拟协议或加载成功写成音频验收通过。测试资料仅保存在忽略的 artifacts/visualizer-composition 下，不形成正式 readiness。

生产 preview 另经 Chrome/Edge 两项实时播放检查，确认内嵌 AudioWorklet 可加载；四份 44.1/48kHz 短 WebM 的 VP9/Opus 经 FFmpeg 完整解码。可在先生成测试壁纸目录后运行 `node tests/scripts/verify-wallpaper-host.mjs <wallpaper32.exe>` 复现原生预览检查，`--reference` 使用最小音频监听对照；脚本只打开和关闭自己命名的测试预览，不改变现有桌面壁纸/全局设置。
