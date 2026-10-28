# Visualizer 歌词输入（DEC-106）

歌词用于歌曲 Visualizer 预览和离线视频。新元素 `circular-depth-lyrics` 使用 ABI 5；首页、展示页和 Wallpaper Engine 不支持歌词输入。既有资源不迁移到 ABI 5，资源包保持 V2，工程保持 V6。

## 文件与时间

属性面板选择 UTF-8 `.lrc` 文件，支持 BOM、分钟/秒/1–3 位小数、多时间标签、空句和常见元数据。拒绝无时间文本、非法时间和增强型逐词时间标签。原始字节按 SHA-256 标识、以 base64 保存于工程可选 `lyricAssets:[{id,name,data}]`；不写入公共资源包。文件最多 2MiB、1 万条时间记录。

元素可选 `lyricBindings` 按输入 ID 保存 `{kind:'unbound'}` 或 `{kind:'lyrics',assetId,leadSeconds,tailSeconds,offsetSeconds}`。入场/离场必须大于零，默认 2/1.5 秒，时移默认 0。LRC `[offset:+毫秒]` 提前，面板正时移延后；所有 cue 使用绝对歌曲秒，元素起点只裁剪显示，不平移歌词。清除或删除元素时回收未引用素材，失败替换保留原绑定，取消或切换后的旧读取不得写回。

英文按词、汉字按字拆分，保留标点和英语缩写。队列内各 token 的到达时间均分到下一条严格更晚的时间记录，最后一句使用 4 秒间隔；这是动画推导，不声称原文件包含逐词时间。空句参与区间边界，不参与左右交替。

## 隔离与宿主所有权

ABI 5 必须是 visual、screen triangles、`executionModes:['timeline']`，声明 `contract.lyricInputs:[{id}]`；元素提供同序 `lyricInputs:[{id,label}]`，Shader 通过 `{type:'lyrics',inputId}` 声明 sampler，DrawPacket uniform 为 0–3 的受控图集页号。预设模板只可保存 unbound 歌词输入，现有预设导出筛选仍拒绝该能力。

宿主解析和分词、等待字体、按当前时间窗口栅格化文字图集。Worker 只收到不可变 `frame.lyrics[inputId]`：available、revision、leadSeconds、tailSeconds，以及 cue 的 index/time/end 和 token 的 index/text/time/page/uv/width/height。UV 使用左下原点，宽高以图集像素计。算法不读取文件、创建 Canvas、纹理或访问整份工程。未绑定时目录仍可加载与初始化，预览提示缺输入，启用元素阻止导出。

宿主最多保留每输入 4 张 2048² 图集，按活动窗口去重词组；窗口过大或单词过长明确报错，不静默截断。多页 passes 在一个透明目标内连续混合，随后参与原有图层合成。窗口变更、清除输入、删除、离页和销毁释放纹理；准备过程使用 generation 和当前帧检查，过期任务不得替换图集。

## 纵深歌词

默认白色、32px（1080p）、不透明度 1、responsiveness 50、noise/normalize 开启，输入使用完整 WE 频谱。歌词沿每句的一条射线运动，首句左侧，按非空句交替左右；Seed 决定角度，范围是右侧 2–4 点钟、左侧 8–10 点钟（水平线 ±30°）。

首词中心在 cue 时间到达屏幕 x=25% 或 75% 位置。提前入场后运动到锚点，再继续离场；反向开关改变运动方向，文字保持正向可读。低频控制路径上的速度分布，时间校正固定入场/锚点/离场端点，并限制曲线变化率以保持单向运动及首词先出现。跳转、输出帧率与尺寸不改变歌曲时间锚点。

现有 `circular-depth` 增加默认关闭的反向运动，正向分支保持 v3 原效果。新歌词元素单独添加，不自动加入 Circular 预设。相关外部源码、展示图和设计记录只保存在用户资源库。
