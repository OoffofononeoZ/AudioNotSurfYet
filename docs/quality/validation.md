# Analyzer 与公共音频验证

核查日期：2026-10-19。日常任务按[验证 skill](../../skills/audiosurf-testing-strategy/SKILL.md)选择受影响专项；本文保存有效阈值和样例，不要求每次执行累计 M3–M14。

## 当前契约与覆盖

当前行为见 [Analyzer 接口](../architecture/analyzer/interface-contracts.md)、[共享运行时](../architecture/shared-runtime-contracts.md)和[列表交互](../context/analyzer-list.md)。旧双列 masonry、自定义 featureOrder 和选卡下拉不再是当前验收要求。

| 范围 | 验证要求与样例 |
| --- | --- |
| PCM/frame | 每 sample 算术平均下混；空/长度不一致拒绝。frame 起点 index×hop/sampleRate，非整帧尾部补零；使用 silence、sine、impulse 和 333-sample 尾段 |
| 数值 | 普通 Meyda 标量/向量逐元素 `abs(actual-expected) <= max(1e-6, abs(expected)*1e-5)`；Complex real/imag、Loudness total/24 bands 同样检查；维度/键集/布尔/null 精确匹配 |
| Flux/零值 | 项目 Flux 的首帧、相邻正向 L1 差、静音与 exact previous/current frame 按 ADR-0005/golden；M8 零能量标量为 0，其余 NaN/Infinity 显式失败，不声称修复 Meyda 上游 |
| 量化/游标 | 反量化误差≤半步量化误差加普通数值容差；饱和不可静默裁剪。exact cursor 比较原 frame，不读取 display 量化值；duration、快速移动、末帧和 stale 请求均覆盖 |
| 缓存 | track/config/feature 任一变化 miss，一致才 hit；部分损坏重算。取消、旧 generation、快速 queue 保存、quota/abort 不覆盖当前工作区或有效旧持久化数据 |
| FIFO/资源 | 0/1/4 项、第五项淘汰、手动收起/重开、快速切换与刷新；只为活动项挂载资源。20 次换歌/换卡/路由后 Worker、Observer、RAF、节点、URL 不单调累积 |
| 播放 | 稳态、pause/seek/ended、换歌后游标相对音频时钟误差≤100ms；seek 裁剪，暂停不自动播放；刷新 0 秒 paused；单实时 AudioContext |
| 性能 | 目标约15分钟输入，反馈≤100ms、分析归因主线程任务无单个>50ms、display series≤30 samples/s，单 job 最多四个唯一特征；不预计算全集 |
| 恢复/错误 | 当前 Blob、queryPermission 与显式 requestPermission、文件 missing/changed、decode、未知 schema、cache corruption、Worker 错误及安全清空；失败保持其他歌曲/播放可用 |
| 布局/无障碍 | 390/1024/1280/1920、DPR、滚动与缩放；键盘可完成核心操作，名称/焦点/非颜色表达与 reduced motion。当前单列/高度手柄按列表契约，console/pageerror/rejection 无新异常 |
| Wallpaper | 按[频谱说明](../context/wallpaper-spectrum.md)和当前专项核对独立单位、频段、平滑、刷新/切歌；不能用 Meyda 21 项历史通过替代 |

## Fixture、golden 与人工边界

- 复用 [fixture manifest](../../tests/fixtures/fixture-manifest.json)及 tests/analysis 下版本化 golden。PCM、encoder、seed、hash、许可和 provenance 必须可追溯；只有真实文件存在才登记 manifest。
- silence、sine、dual-tone、impulse、确定性噪声、同 RMS 谐波和相位差覆盖数值；RMS、Spectrum、Chroma 的学习样例保持 L1 音量、L2 音级、L3 谐波三类。
- fixture 更新先核对公式和输入；不以修改 golden 消除产品失败。长曲、用户歌曲和大型 trace 放忽略目录，不提交私有音频、路径或身份 hash。
- Chrome/Edge 与 MP3/WAV/FLAC 按实际影响覆盖；原生 picker、权限气泡、文件移动、辅助技术和真实长会话需要相应人工记录。OPFS/stub 通过不等于 OS 对话框通过。

## 正式证据

显式要求正式评审时才使用对应 eval runner：起止同一 clean implementation commit，保留 run、环境、结果、summary hash、原始 artifact 与必要人工批准。失败、未运行、provisional 分开登记，不通过事后放宽阈值获得 pass。

[历史 evidence](evidence-index.md)与 [Analyzer readiness](release-readiness.md)保留原候选身份、W-001–W-007 和 PROD-015；当前修改需自己的验证，历史 readiness 不自动扩展到 Editor/Visualizer。
