# Visualizer 几何元素与预设

owner 于 2026-10-16 要求：新增可独立编辑的原子视觉元素，复刻 Wallpaper Engine workshop 3093808768 的 geometric visualizer（responsiveness 0.6），在元素库增加“预设”，并额外创作歌曲 PV 风格组合；每个完成阶段单独本地提交。

本任务扩展现有 Project V3 ElementRegistry 与组合器，不注册完整内置 Scene，不引入新的工程格式、分析来源、Canvas、renderer 或 RAF。预设最终展开为普通元素，可单独修改及删除，导出与草稿沿用现有 V3 codec。

## 原项目与响应

参考为 owner 指定的本地 index.html、project.json 和两张静音/播放截图；不复制其 p5 运行库、字体或远程依赖。源实现为双环频谱、12 个频段方块、中心方块/棱锥、三个旋转环、三个小棱锥和 19 条弧。截图未显示曲名；复刻按该视觉组合执行。

原项目的输入为 Wallpaper Engine 音频数组，当前输入为已有 Analyzer amplitudeSpectrum，两者数值标度不同。使用固定 log reference 128 归一化后乘响应系数 0.6，不按每首歌动态归一化；这是输入适配，不声称与 Wallpaper Engine FFT 逐 bin 等价。双环、尺寸、弧线和填色公式沿源结构。源逐帧旋转以 60 fps 转为绝对歌曲秒；随机彩色改用 seed 和绝对帧索引，seek/循环/录制可重现。

几何以短边 1600 为设计参考，位置为归一化画面坐标。新增环形频谱、轨道几何体、旋转线框和旋转弧簇；形状、数量、半径、尺寸、速度、相位、阈值、线宽与响应系数可独立编辑。线段使用三角形，避免依赖平台 WebGL 宽线支持。几何仅共用一组动态 BufferGeometry/ShaderMaterial，并在组合器释放时回收。

## 阶段状态

1. 几何原子元素：已实现。几何确定性/静音轮廓/响应映射、V3 codec 与组合器专项 15 项通过；类型检查通过。实际 GPU 与预设组合在后续阶段验证。
2. 元素库“预设”与 geometric visualizer 复刻：已实现。“几何律动”展开为 11 个普通元素，保留原工程元素并排在其上方；无隐藏场景或特殊工程字段。细线增加解析抗锯齿。类型检查、38 项 Visualizer 测试通过；Chrome/Edge 各一项真实 GPU/导入导出/离页草稿恢复/搜索测试通过，已检查静音和受控频谱截图。
3. PV 风格预设：待实现。
4. 实际浏览器、音频及输出回归：待继续。测试发现直接刷新 Visualizer 会早于歌曲 session 恢复完成进入页面，待修复时序后回归。不产生正式 readiness 或发布结论。
