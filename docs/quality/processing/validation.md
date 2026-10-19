# 处理链验证

核查日期：2026-10-19。当前模型和运行资产身份只在[模型表](../../architecture/processing/model-artifacts.md)、[FT 配置](../../architecture/processing/ft-kernel-config.md)维护；路线见[处理链路线](../../delivery/processing/roadmap.md)。本文合并旧验收、eval、golden 与失败分类中的有效要求。

## 当前功能与正式评审

DEC-074 接受当前 FT 汇总听感、复杂音乐部分串音、第三首耗时与长曲时间容忍；当前 Editor 功能交付不再被原12行试听表或 P1<900秒阻挡。历史 Chrome 1011.9541秒超900秒仍是失败事实；此接受不证明完整 P1/P2 clean canonical、原生 OS 操作或 P3/P6 完整链性能通过，不增加数值上限或扩大支持范围。

DEC-075 的分轨试听与有限乐器自动标记按[当前合同](../../architecture/processing/editor-auto-marking.md)验证；合成识别质量不冒充真实音乐质量，新增质量仍需 owner 复核。

## FT 数值、时间与资源（AC-P101–106）

| 范围 | 门槛/样例 |
| --- | --- |
| 模型/runtime | 四个 pinned revision/bytes/SHA 与官方 ORT1.30.0、JS/WASM asset identity 一致；原始四图逐个真实 session，记录 kernel placement，不能声称所有节点都在 GPU |
| role/shape | 专用 drums/bass/other/vocals 仅取 row0/1/2/3；输入 `[1,2,343980]`、输出 `[1,4,2,343980]` Float32/finite；session 顺序不重叠，故意错 row/shape/NaN 必须失败 |
| parity | 相同 ONNX/input/padding/config，隔离顺序独立 WASM reference 对 WebGPU；每模型对应 row 全 sample max absolute≤1.5e-3，另报 RMS；reference 不可用保持缺口，不用 GPU 自对照或平均值替代 |
| PCM/时间 | 原 PCM 不改动/detach；44.1/48kHz、mono复制stereo、>2ch拒绝、短段/非整尾/静音/接缝；恒等/脉冲独立 oracle 误差≤1个44.1kHz sample，真实 FT 不要求理想 impulse 或四轨相加恒等mix |
| 拼接 | segment343980、overlap85995、stride257985、尾部zero padding、无第二次 normalization；frame count=`round(source duration×44100)`，首尾静音不裁，尾校正≤1输出sample，超限失败 |
| 派生/WAV | waveform/energy/WAV 同源；energy length=`ceil(30×duration)`，RMS/dBFS/UInt16 payload与独立oracle一致；stereo IEEE Float32/44.1kHz WAV 的 header/frame/sample 独立解析 |
| 取消/资源 | 每start一个terminal，cancel幂等；下载、staging/load/inference/stitch/derive/persist、Worker崩溃和迟到结果均覆盖；temp五秒内清理或登记residual IDs，20次资源不累积 |
| 反馈/隐私 | 输入≤100ms、running heartbeat≤1s，未知总量用null；下载与处理分开计时，无伪百分比。用户PCM/stem/歌曲/WAV/歌词/私有路径/hash不上传或入Git |

fixture/version/seed/hash、oracle与配置在运行前固定；预期答案不调用待测 resampler/OLA/energy/WAV 实现。保留 silence、非零合成、row标记、脉冲、末窗、损坏asset/PCM/hash、device lost/OOM、quota和不完整artifact故障样例。

## 存储、接入与试听（AC-P201–205）

- 当前入口为 Editor 的标记/分离/自动标记页签，不恢复独立 Processor route。单播放AudioContext、既有analysis Worker外最多一个专用计算Worker，FT/自动标记共用任务槽。
- 缺失模型显示bytes、逐文件校验，cache hit不重复下载；断网/取消/checksum/runtime不符拒绝半成品，失败保留人工路径。
- 10GiB可配置与origin quota共同约束，完整OPFS artifact校验后发布IDB metadata；身份覆盖source/PCM、模型、runtime/backend/config。缺文件/损坏不能命中。
- 换歌/离页/重试撤销generation，旧消息不改UI/cache/工程；取消保留旧完整结果。清理须显式，running/leased拒绝删除，不自动驱逐。
- 当前共同transport、原曲/四轨切换/静音、buffering、seek/停止、缓存恢复与WAV检查按[接入合同](../../architecture/processing/editor-separation.md)及自动标记合同执行。

## 尚未完成的逐拍、提案与快照

- AC-P301–305：mix主输入、drums在±70ms内辅助，空鼓轨不删mix beat；允许显式mix-only，不自动换模型/CPU。beats升序界内、1ms内去重，score有限[0,1]且不是概率，无自动meter/downbeat。
- 固定/变化合成区段：±70ms最大一对一匹配，并列取总误差较小者；逐段F1≥0.95，报告TP/FP/FN/误差。BPM误差≤`max(0.5 BPM,target×1%)`。真值变化后的排除窗口预先固定为至多一个新tempo beat interval，预测/真值同时排除，不事后扩窗。
- silence/歧义/不稳定返回null BPM、空或有效候选及真实警告，不外推首尾静音；beat tracking复用analysis Worker，progress/cancel和timeout适配长任务，不以旧15秒限制误杀。
- AC-P401–405：只读proposal；小节起点/BPM/meter逐项人工确认，未确认区可single-beat，不默认伪造4/4。source/job/generation和所选目标canonical hash冲突拒绝；null目标后来创建也冲突。
- 所选目标全部准备/校验后原子应用，保留未选字段、人工marker和未选binding；失败零部分写入，保存失败保持dirty可导出。rerun/拒绝不改变已应用工程；默认other/beat映射仅在明确选择时写入。
- AC-P502–505：有效目标是携带compact energy/beat及provenance、同歌identity、严格payload长度和显式tempo刷新；过期map使相关source unavailable，刷新Editor snapshot/map一起提交，保留原detected beats和未选binding。当前V4不实现processing source；旧V1→V2/双版本读写要求已被DEC-084删除。
- AC-P601–604：后续完整任务须覆盖人工修正、工程保存恢复、cache清理后快照独立可用、手动失败恢复、当前离线WebM同步/回放和20次生命周期；此为未完成目标，不是当前pass。

## 性能与人工证据

参考机 RTX4060 Laptop 8GB；Chrome/Edge各十五分钟、原曲已解码、模型已校验缓存、结果cache miss、新session。从start的PCM hash/staging至四轨/beat proposal ready，计入session/inference/stitch/derive/persist；下载、原解码、用户等待和视频导出另报。P3/P6完整链≤900秒且无OOM，反馈≤100ms、归因任务≤50ms、heartbeat≤1s；P1历史分离<900秒只是必要前置。热session/cache hit不代替基线。

正式证据记录实际系统/浏览器/GPU/driver/供电、各阶段wall-clock、RAM/VRAM峰值及采样粒度，缺项不伪造。历史原1e-3失败、provider失败和未运行项保留在 [evidence](evidence-index.md)与 [numeric review](numeric-review.md)。

完整正式质量原要求三首许可本地歌曲12个WAV，逐轨角色辨识/串音/断裂/伪影及可用结论；DEC-074已接受的本轮汇总不再反复索取、不补造12行或第三首秒数。Chrome/Edge原生保存/取消/系统回放仍须真实记录。后续正式关闭使用适用合同、clean候选、run/summary hash与必需人工输入，不继承旧readiness或把注入成功写成真实驱动稳定。
