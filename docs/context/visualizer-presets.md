# Visualizer 几何元素与预设

核查日期：2026-10-19。当前定义存于[预设资源](../../public/visualizer-resources/v1/presets)，[资源包V1过渡版](../architecture/visualizer/resource-packages-v1.md)声明控件/目标，[Project V4](../architecture/visualizer/project-format-v4.md)保存预设组及共同值。不再沿用V3“展开后不保留预设身份”的规则。

## 几何律动

owner于2026-10-16指定复刻Wallpaper Engine workshop 3093808768的geometric visualizer，responsiveness=0.6；参考输入为owner给出的本地index/project和静音/播放截图，不复制p5运行库、字体或远程依赖。目标为双环、12频段方块、中心方块/棱锥、三个旋转环、小棱锥与19条弧，非歌曲标题识别。

- 预设包含11个可独立编辑元素；黑背景不请求分析。十二频段方块默认amplitudeSpectrum full，其余频谱输入默认wallpaperEngineSpectrum full，新建共请求两项，响应系数0.6；导入/旧草稿不自动改绑。
- Wallpaper近似输入为左右各64的立体声128向量，允许短时>1，直接乘0.6，不再次按Meyda标度换算。双环直接使用完整数组，保留真实零尾和声道接缝。
- 已有Amplitude Spectrum绑定把mono64段复制到左右槽；native采用[当前线性FFT byte bins/有符号波形](visualizer-native-input.md)及固定单位换算。旧特殊分频、空间平滑、平方响应、2/3校准和环向零尾适配已删除。
- 几何以短边1600为设计参考、位置归一化；形状/数量/半径/尺寸/速度/相位/阈值/线宽/响应可编辑。线段用三角形，共享动态BufferGeometry/ShaderMaterial并对称释放。
- 源逐帧旋转以60fps转为绝对歌曲秒，随机颜色采用seed/绝对帧索引；seek、循环与离线输出可重现，不引入独立Scene/Canvas/renderer/RAF。

## 棱镜航行

12个元素包含可独立添加的光轨隧道和跃迁星尘。四段默认分镜覆盖0–18%、18–46%、46–80%、80–100%，对应六边、方形、三角、八边隧道；只是可修改默认时段，不声称识别副歌或节拍。隧道采用深度投影、双色光晕和绝对时间扭转，星尘轨道由seed固定。

## 分组与共同处理参数

V4把预设保留为默认折叠顶层组，移动整组、组内排序、显隐/删除与effect目标清理按工程契约。共同处理控件仅在声明范围内批量写入；单独修改子元素显示差异，再次应用共同值覆盖目标字段。几何律动两种输入分别声明控件，棱镜航行保留其输入/分镜，不把样式常量混作共同处理参数。

## 验证

按[当前Visualizer验证](../quality/visualizer/validation.md)核对重复添加/UUID、共同值/差异、导入/草稿、自包含资源、两种默认频谱、静音/真实输入、四段构图、同时间seek与短WebM/context/离页资源。

既有记录：2026-10-17默认绑定修订单元3项与Chrome/Edge各3项通过；两预设四份短WebM经FFprobe/严格递增PTS及FFmpeg解码，1280×720 VP9、48kHz双声道Opus。V4分组/资源回归摘要见[组合工作区](visualizer-composition.md)。本地用户音乐截图/媒体留在忽略目录，不提交歌曲，不形成新canonical/readiness。旧展开工厂与逐阶段反馈由Git查回。
