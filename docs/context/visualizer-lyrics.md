# Visualizer 歌词输入（DEC-106）

歌词用于歌曲 Visualizer 预览和离线视频。`circular-depth-lyrics` 与 `black-hole-lyrics` 使用 ABI 5；首页、展示页和 Wallpaper Engine 不支持歌词输入。既有资源不迁移到 ABI 5，资源包保持 V2，工程保持 V6。

## 文件与时间

属性面板选择 UTF-8 `.lrc` 文件，支持 BOM、分钟/秒/1–3 位小数、多时间标签、空句和常见元数据。拒绝无时间文本、非法时间和增强型逐词时间标签。原始字节按 SHA-256 标识、以 base64 保存于工程可选 `lyricAssets:[{id,name,data}]`；不写入公共资源包。文件最多 2MiB、1 万条时间记录。

元素可选 `lyricBindings` 按输入 ID 保存 `{kind:'unbound'}` 或 `{kind:'lyrics',assetId,leadSeconds,tailSeconds,offsetSeconds}`。入场/离场必须大于零，默认 2/1.5 秒，时移默认 0。LRC `[offset:+毫秒]` 提前，面板正时移延后；所有 cue 使用绝对歌曲秒，元素起点只裁剪显示，不平移歌词。清除或删除元素时回收未引用素材，失败替换保留原绑定，取消或切换后的旧读取不得写回。

英文按词、汉字按字拆分，保留标点和英语缩写。队列内各 token 的到达时间均分到下一条严格更晚的时间记录，最后一句使用 4 秒间隔；这是动画推导，不声称原文件包含逐词时间。空句参与区间边界，不参与左右交替。

## 隔离与宿主所有权

ABI 5 必须是 visual、screen triangles、`executionModes:['timeline']`，声明 `contract.lyricInputs:[{id}]`；元素提供同序 `lyricInputs:[{id,label}]`，Shader 通过 `{type:'lyrics',inputId}` 声明 sampler，DrawPacket uniform 为 0–3 的受控图集页号。预设模板只可保存 unbound 歌词输入，现有预设导出筛选仍拒绝该能力。

宿主解析和分词、等待字体、按当前时间窗口栅格化文字图集。Worker 只收到不可变 `frame.lyrics[inputId]`：available、revision、leadSeconds、tailSeconds，以及 cue 的 index/time/end 和 token 的 index/text/time/page/uv/width/height。UV 使用纹理左下原点；屏幕 triangles 的 Y 轴向下，文字四边形顶边使用 v1、底边使用 v0，宽高以图集像素计。算法不读取文件、创建 Canvas、纹理或访问整份工程。未绑定时目录仍可加载与初始化，预览提示缺输入，启用元素阻止导出。

宿主最多保留每输入 4 张 2048² 图集，按活动窗口去重词组；窗口过大或单词过长明确报错，不静默截断。多页 passes 在一个透明目标内连续混合，随后参与原有图层合成。窗口变更、清除输入、删除、离页和销毁释放纹理；准备过程使用 generation 和当前帧检查，过期任务不得替换图集。

## 纵深歌词

默认白色、32px（1080p）、不透明度 1、responsiveness 50、noise/normalize 开启，输入使用完整 WE 频谱。v2改用字符图集排成完整句子，所有字符忽略token.time并共享cue.time、缩放和透明度；整句宽度最多屏幕40%。歌词沿每句的一条射线运动，首句左侧，按非空句交替左右；Seed 决定角度，范围是右侧 2–4 点钟、左侧 8–10 点钟（水平线 ±30°）。

整句排版中心在 cue 时间到达屏幕 x=25% 或 75% 位置。提前入场后运动到锚点，再继续离场；反向开关改变运动方向，文字保持正向可读。低频控制路径上的速度分布，时间校正固定入场/锚点/离场端点，并限制曲线变化率以保持单向运动及整句同步出现。跳转、输出帧率与尺寸不改变歌曲时间锚点。

现有 `circular-depth` 增加默认关闭的反向运动，正向分支保持 v3 原效果。新歌词元素单独添加，不自动加入 Circular 预设。相关外部源码、展示图和设计记录只保存在用户资源库。

## 可选字符排版与黑洞歌词

ABI5歌词输入可选granularity:'grapheme'，算法contract和元素定义必须一致；省略维持英文词/中文单字语义。字符模式按Intl.Segmenter保留空格、标点、完整组合字符和emoji；宿主以同一64px字体、关闭kerning，提供cue.lineWidth与token.offsetX/advance。offsetX是含透明padding的图块左边相对行起点的位置，advance是排版推进量，空格只占位。算法无需纹理切片或自行测字。新字段需要更新后的宿主，旧宿主拒绝未知声明，不自动退回逐词效果。

元素歌词输入可选正数defaultLeadSeconds，首次绑定时提供初始提前入场值，替换LRC保留已有lead/tail/offset，省略仍为2秒。已保存binding不随资源更新改变。字符模式沿用原有四页图集、不可变Worker数据、generation失效和纹理所有权；资源仍V2、工程仍V6。

black-hole-lyrics v2默认位置(50%,82%)、消失中心(50%,50%)、消失半径0（可调至短边50%）、白色48px，整句宽度最多90%。仅需歌词和constant参数，无Analyzer/native/marker/history。默认提前.6秒，故障入场.25秒（最多占提前窗口）。故障采用六段横向切片硬跳变、RGB分离、局部缺失和闪帧，强度0–5、默认1，跳变频率6–60Hz、默认24。不会拉伸字符或连续漂移。显示抖动默认关闭，强度默认1、范围0–5；开启后逐字平移微颤，销毁从启动时的抖动位置继续。

最长显示默认6秒，从cue.time计至开始销毁，不包含销毁。提前销毁参数默认.8秒，密集歌词限制提前量不超过句区间的一半。销毁起点=min(cue.time+最长显示,cue.end-min(提前量,句区间/2))；独立destroyDurationSeconds默认.8秒、范围.05–10秒，截止=销毁起点+持续时长，完整播放并允许跨句重叠。末句cue.end仍使用LRC四秒区间，元素/歌曲时段终点仍裁剪。

ABI5歌词输入新增可选tailSecondsParameter，必须引用算法声明的正数、constant-only number参数，元素声明精确匹配。宿主保留窗口使用max(binding.tailSeconds,该参数值)，避免长销毁被图集窗口截断；frame中的tailSeconds仍是原绑定值，旧算法行为不变。字体和窗口变化计入宿主图集签名/准备失效，最多四页与单pass65536顶点的预算保持。

## 本机字体

LyricBinding的lyrics分支可选font:{family,fullName,postscriptName}，省略保持默认字体。面板通过“读取本机字体”主动获取全部可访问字形，按完整名称排序、按PostScript名去重，可筛选。Web通过Local Font Access权限；拒绝后在浏览器中重新允许时，按提示刷新页面后重试。Electron先经平台fontCatalog端口调用仅可信主frame可用的fonts.requestAccess IPC确认，再由local-fonts检查放行。Electron字体API权限检查拒绝时直接返回空列表，不依赖权限请求回调弹窗；其他来源和算法iframe拒绝。拒绝、空列表或不支持均明确提示，旧绑定不清除，取消/换实例后的旧结果不回写。

仅所选字体标识写入V6工程，不保存字体列表、路径或字节，不分发系统字体。宿主使用local(PostScript名)加载FontFace，加载完成后测量实际字形，按最大升降部调整图集行高/基线，避免裁切。缺失字体明确报错，导出失败，保留输入与旧图集供重新选择；不静默换成默认字体。替换LRC保留字体与lead/tail/offset；字体切换、失效任务、离页释放由宿主负责，算法仍只接收受控文字图集。

两个元素展示图、算法和设计记录只保存在外部资源库，旧工程继续使用内嵌旧快照。共享渲染与歌词准备同时影响Web和Electron；适用验证和原生确认UI替身的限制随任务交付报告。

## 黑洞组合预设

外部 black-hole-visualizer-2903479369 v2 仍保留 Circular Visualizer 的背景、扩散粒子、默认隐藏的纵深粒子和前景图片，以独立 ABI3 screen/timeline+realtime 的核心、吸积盘、炫光替代 bars/outer/center，歌词默认隐藏。默认斜视20度、粉紫高亮白；核心半径216px、盘外半径720px、光晕外半径900px，尺寸按1080p高度缩放。盘面与炫光仰角均支持5–90度；样式独立，修改中心、核心半径、仰角和旋转时需保持一致。

v2提供连续发光盘面、四层湍流、宽旋流带与两级程序化光点，解析投影/遮挡及弯折近似，不积分测地线或逐粒子重力。光点密度/亮度、旋流、白热颜色和辉光独立可调；径向柔光为主，横向光芒较弱。核心半径最大10000，盘面/光晕外半径最大20000，炫光长度/宽度最大40000/20000。无需宿主运行时、ABI或工程格式变更。旧v1工程继续使用内嵌快照。

末项black-hole-lyrics v2默认enabled:false、输入unbound，不阻挡视频导出或实时能力检查；启用后沿用歌曲模式及缺失歌词的导出拒绝。现有按钮在启动导出时显示配置错误，清除错误后可继续编辑。音频仍仅WE完整频谱，audioGain只控制盘面与炫光亮度。

专项：浏览器运行 `npx playwright test tests/e2e/black-hole-visualizer.spec.ts tests/e2e/black-hole-reference.spec.ts tests/e2e/black-hole-benchmark.spec.ts --project=chrome --project=edge --workers=1 --output=artifacts/black-hole-visualizer-v2/playwright`，HTML报告另设PLAYWRIGHT_HTML_OUTPUT_DIR到任务artifacts。v1性能基线需任务artifacts中的显式v1快照，缺失时该项跳过；本地参考不存在时参考项跳过，不借用旧结果。性能区分三个组件和完整预设，GPU与提交时间分开记录，不以短时测量承诺FPS。桌面运行 `node tests/desktop/black-hole-smoke.mjs`，复用生产应用校验副本及原生端口，OS选值使用替身，不代表人工对话框验证。截图、视频、测量在artifacts/black-hole-visualizer-v2/。
