# Editor 试听与有限自动标记：当前证据

范围与授权见 [DEC-075](../../context/decision-registry.md#dec-075--editor-audition-and-limited-transcription--2026-10-12) 和 [契约](../../architecture/processing/editor-auto-marking.md)。以下为 2026-10-12 工作树 provisional；底层 HEAD 为 `ea2ace1`，新增源码的 SHA-256 保存在每项运行 JSON。没有本轮 clean canonical、readiness 或发布结论。

## 已实际执行

- 固定四项新增模型实际 bytes／SHA-256 全部匹配 manifest，Basic Pitch 另匹配官方 Git blob `c30e5f9438e798604b7177aa26be1fe64482f767`。合计 209572912 bytes；独立公开文件在忽略的 `artifacts/fixtures/transcription-models/`，未提交权重。
- 初步真实 Chrome／Edge 各 3/3：Basic Pitch WASM、ADT_STR WASM encoder／decoder、六轨 WebGPU。真实输出 tensor 形状、有限值、目标音高及有效 token 输出检查通过。
- 扩展真实双浏览器 **8/8**：每浏览器 Basic Pitch 原始 tensor＋六秒四窗转写、ADT_STR 正常解码、四 token 上限截断、六轨 WebGPU。测试 UA 为 Chrome `151.0.7922.34` 和 Edge `151.0.7922.34`；这与历史其他任务浏览器版本不同，不能挪用历史环境信息。
- 相关 Vitest **15/15**：共享模型校验、有界重采样／相邻及重叠请求 phase、stereo mono、错误／取消、ADT_STR DFT 对照／静音／词表／同时类别／同类去重，以及音符多音／重复／跨窗／静音／取消。新增模型、音符及辅助分离模块的 `vue-tsc -b` 通过。

原始首轮 HTML／JSON 在 `artifacts/evals/editor-transcription/models-chrome-initial/`、`models-edge-initial/`。扩展运行 JSON 在 `artifacts/evals/editor-transcription/model-runs/`，保存 UA、源码 hash、模型／runtime／config identity、输出、时间和内存样本；不依赖易被下一次运行覆盖的 `test-results/` 作为唯一证据。

## 初步耗时与内存

| 扩展短输入探针 | Chrome | Edge |
| --- | --- | --- |
| Basic Pitch 探针总耗时，包含原始 tensor 与六秒转写 | 0.921s | 0.956s |
| 六秒转写，四窗，读取＋推断＋后处理（模型已加载） | 0.244s | 0.242s |
| ADT_STR 2.56s 合成鼓，总耗时 | 9.061s | 9.199s |
| 六轨 7.8s 输入单次探针，总耗时 | 18.058s | 18.694s |
| ADT_STR 期间浏览器 aggregate working set 观察峰值 | 2057457664 bytes | 1938493440 bytes |
| 六轨期间浏览器 aggregate working set 观察峰值 | 2891939840 bytes | 2806112256 bytes |
| 六轨期间浏览器 aggregate private bytes 观察峰值 | 4572774400 bytes | 4603195392 bytes |
| 六轨期间全设备 NVIDIA 显存观察峰值 | 3697 MiB | 3700 MiB |

总探针时间包含同字节 dev fixture 获取、校验、session 初始化与推断；不是纯 kernel 时间或歌曲完整链路。六轨测试之前的 aggregate working set 分别为 1540820992／1433968640 bytes，设备显存为 1296／1299 MiB，便于区分已有浏览器／桌面占用与观察变化。采样约一秒请求频率、全设备 GPU 和全部 Chrome／Edge 进程；其他标签页影响及 working set 共享计数均保留。全部八项采样无错误；短 Basic Pitch 只有两次样本，可能漏掉瞬时峰值。以上不承诺模型独占内存、上限或全曲性能。

## 真实输出发现与质量边界

ADT_STR 合成输入安排 13 次 hat、4 次 kick 和3次预设 snare 噪声击打，输出17个去重候选（13 hat／4 kick）；同时类别保留，EOS 正常结束。3 次预设 snare 未输出 snare，相关位置输出较强 hat。此输入是受控合成音色且尚未经过 FT，不代表真实 snare／真实 FT drums 的质量验证。不能把模型 session 成功扩写为鼓分类已获接受。

六秒 Basic Pitch 受控输入包括长 A4、短重复 A4、重叠 C4／E4；两浏览器输出完全相同的6个候选，实际输入4个音符。A4 长音起止为 `0.359909..2.243810`（输入 `0.37..2.23`），短音为 `3.102948..3.349841`（输入 `3.13..3.36`）。C4／E4 分别在另一声音加入／退出时被拆为两个候选：这是需复核的多标／音符终止错误，未通过任何 owner 质量验收。源音符时间和全部实际候选保存于 JSON，不能以选取正确片段掩盖多标。

初始六轨探针只证明tensor/backend/有限值；当前完整链已验证原曲分段、OPFS、只保留row 4/5及释放后逐乐器转写。受控音色质量正在补充，真实演奏录音与owner识别质量结论仍缺独立证据。

## 当前实现与最终验证

已接入共同试听（FT四轨静音、四秒读取/八秒准备、暂停/seek/loop、原曲与辅助来源、离页/清理释放）和有限自动标记（选择/真实进度/取消、OPFS缓存、Canvas预览/分页、类别/乐器/未知修正、删除恢复、逐乐器分界、V1显式原子应用）。准备期间后发的暂停优先；独立输入失败保留未完成信息，全部输入失败或取消保留上一完整候选。

- 最终Vitest：44文件243项通过，覆盖主播放与Editor原逻辑、预处理/词表/音符提取、V1去重/边界/重叠原子拒绝、命令竞态/释放和缓存损坏/取消。
- Chrome/Edge：共30个不同场景适用验证通过，分轮运行。固定实现的FT/完整标记链/模型/受控质量为28项；长源2项在专用普通profile通过。缓存大小提示修正后完整链两浏览器重新通过，不累加重复用例。
- 完整标记链包括真实FT→五角色分析→六轨辅助OPFS及文件hash→逐乐器Basic Pitch→辅助试听→修正/删除恢复→显式应用→刷新恢复/重复应用保护→取消→损坏模型拒绝/旧结果保留→试听后清理。手工marker与120 BPM tempo保留。
- 独立模型实际使用ADT_STR/BP WASM和六轨WebGPU，无全模型备用provider；正常/截断均有真实输出。
- 短FT场景覆盖四静音、声音energy、共同clock、暂停/seek/loop、标记页签保持试听、原曲切换位置、离页/换歌/取消/缓存/模型损坏/quota与390/1280/1920布局。
- 最终build/typecheck通过；工具13/13及文档链接检查通过。入口/地图、repo与diff审阅在本地提交前同步。

最终完整链记录：`full-chain/chrome-1791817944787/`与`edge-1791818069964/`。两浏览器默认300ms纯预览样例均通过生产apply与V1校验（含point/range）；界面修正/应用测试另用10000ms分界验证重分类，原候选结束时间仍完整保存。

## 新增耗时与内存

环境：Windows 11 10.0.22631；AMD Ryzen 9 7945HX；可见内存15912988 KiB；RTX 4060 Laptop GPU 8188 MiB、driver 591.86。实际UA均为151.0.7922.34。

| 六秒完整链新增分析（不含此前FT） | Chrome | Edge |
| --- | --- | --- |
| 转录总时间（含获取/校验/初始化） | 24.921s | 25.552s |
| 其中辅助分离 | 18.748s | 19.297s |
| 全链采样的aggregate working set峰值 | 3162357760 bytes | 2925961216 bytes |
| 全链采样的aggregate private bytes峰值 | 5464887296 bytes | 5038911488 bytes |
| 全设备NVIDIA显存峰值 | 3902 MiB | 3755 MiB |

内存采样包含FT和新增分析，以及已有浏览器/设备占用；起始WS为692297728/660221952 bytes，显存1331/1334 MiB。采样均无错误；不承诺独占内存、上限或全长处理时间。14秒辅助转录＋8秒多段鼓的受控质量探针总时间为81.353/82.015s；原始阶段时间、样本和方法均保留，不能与纯kernel时间混淆。

## 受控质量及明确限制

自编CC0钢琴/拨弦音色包括独奏、稀疏混合、无目标区、8个已知音符、长音、短重复音和跨模型/辅助分段边界。两浏览器均输出29候选：120ms一对一关联窗匹配8项、漏标0、多标21。匹配项音高/乐器错误0仅指这8项；其余21项中11项与另一乐器已知同音高音符时间相交，存在明显串音/重复与拆分。无目标区起点≥11.4s还有3候选。Chrome匹配项起点平均绝对误差17.51ms、终点386.81ms；两浏览器原始带符号误差均保存，未隐藏提前结束或拆分。

八秒鼓安排106击打（快速hat、同时kick/hat、snare、跨2.56s边界），两浏览器实际100候选：漏标6、多标0、匹配项分类错0、截断0。Chrome起点平均绝对误差48.40ms；漏标kick 2.61/5.17s与hat 5.01/7.57/7.65/7.73s。关联窗是报告方法，不是owner质量门禁。原始输入、输出和误差在`controlled-quality/chrome-1791817302411/`及`edge-1791817677577/`。

合成素材不能证明真实演奏录音或复杂音乐质量；新增识别质量尚未获owner接受。钢琴/吉他只能作为人工复核候选，不能据模型链可运行宣称准确识别乐器存在。

## 长源连续性与故障历史

普通任务profile两浏览器quota均10GiB；15分钟44.1kHz四轨OPFS源连续播放120秒，最大单次读取176400 frames（四秒）、最多一项并发读取。远端600/890秒seek、注入读取停顿后132秒处buffering冻结/恢复、读取错误时890秒冻结、返回原曲保持位置、租约close一次和删除后残留为空均通过。没有连续播放全部900秒，也没有借此重新验收FT听感或15分钟处理时间。记录在`long-audition/chrome-1791818337542/`及`edge-1791818481053/`；profile仅本轮创建并在结束后清理。

失败事实保留：初轮完整链fixture缺CORS，实际显示全部输入未完成（`full-chain-cors-failure/`）；运行中改依赖触发Vite热更新使Edge FT回到idle（`full-chain-edge-interrupted/`）；首轮长源8000Hzmetadata被生产44100Hz契约拒绝（`fixed-suite-before-long-fix/`）；标准临时上下文写约1.27GB PCM触发quota（`long-source-quota-failure/`）。这些失败没有记为通过，后续分别修复夹具、固定工作树或改用专用普通测试profile重验，未改变产品支持矩阵。

## 本地复核样例与交付边界

`artifacts/evals/editor-transcription/review/index.html`提供输入、Chrome/Edge钢琴/吉他辅助WAV、鼓短片、可点击候选时间，以及原曲和默认300ms/界面修正后的V1工程。五项媒体真实加载/播放、29项候选跳转、390/1280布局检查通过。音频、权重与大型报告留在忽略目录；不提交到源码。

既有DEC-055 readiness限制、DEC-074已接受FT听感/第三首耗时与PROD-015发布边界保留。本次本地提交不将provisional改写为clean canonical，不包含P3、正式readiness或发布。
