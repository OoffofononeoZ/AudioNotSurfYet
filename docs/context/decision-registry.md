# 当前决策与授权

核查日期：2026-10-21。本文保存仍有效的决定和必要批准来源；具体行为只在对应专题维护。旧过程和被替代的详细方案可从Git的`0bd2a67:docs/context/decision-registry.md`查回，不再作为当前指令。

## 持续边界

- DEC-003/006：中文文档与skill、代码标识保留原文；本地MP3/WAV/FLAC、桌面Chrome/Edge、安全上下文。上传/云端/移动端/非Chromium和生产部署未获得当前授权。
- DEC-007/018：数值/时钟/反馈门槛、owner 3/3学习边界及项目Flux保持；Meyda上游错误不伪称修复。见[Analyzer验证](../quality/validation.md)。
- 单engine/clock、序列化store、Worker/cache/stale和原子草稿理由见[共享运行时](../architecture/shared-runtime-contracts.md)及其链接ADR；最新页面规则优先于旧布局/接口。
- 历史canonical和批准只覆盖原候选，不能冻结以后源码或自动证明当前readiness；关键候选/批准保存在各领域evidence/readiness。

## 仍影响工作的决定

| ID / 日期                | 当前有效内容与来源                                                                                                                                                                                                                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEC-050 / 2026-09-04     | 可见滚动容器复用app-scrollbar，Visualizer单工作区/独立侧栏滚动；见[应用外壳](app-shell.md)和[组合](visualizer-composition.md)                                                                                                                                                                                                   |
| DEC-051–053 / 2026-09-04 | 紧凑BPM条、内部boundary删除与E9 revised canonical获批；有效几何/删除语义见[Editor交互](../architecture/editor/interaction-contracts.md)，旧独立tempo模块已删除                                                                                                                                                                  |
| DEC-054/055 / 2026-09-04 | 旧E9/pre-E10 readiness保留provisional24/24及clean14/24失败，browser gap和W-ED-001–006由owner自行审阅；不再申请该旧评审沙箱外重跑，见[Editor readiness](../quality/editor/release-readiness.md)                                                                                                                                  |
| DEC-057 / 2026-09-04     | E10小节批量/复制/移动与原子冲突要求保留，历史E9不改写；当前模式按最新[交互](../architecture/editor/interaction-contracts.md)                                                                                                                                                                                                    |
| DEC-058 / 2026-09-04     | 原生Fullscreen API、同Canvas和2秒隐藏/唤醒；旧候选人工缺口保留，见[Visualizer readiness](../quality/visualizer/release-readiness.md)                                                                                                                                                                                            |
| DEC-063/064 / 2026-10-04 | 本地四FT原图、官方ORT/WebGPU、IDB/OPFS；TS逐拍mix主输入/drums辅助和人工小节/meter确认目标，见[处理契约](../architecture/processing/worker-and-project-contracts.md)                                                                                                                                                             |
| DEC-065/066 / 2026-10-04 | 只读proposal、逐项确认、compact处理数据和tempo显式刷新仍有效；旧V2迁移/实时录制部分已由DEC-081/084替代                                                                                                                                                                                                                          |
| DEC-067/068 / 2026-10-04 | 已批准处理路线及验收：逐拍70ms/F1≥0.95、完整链参考机目标等保存在[processing验证](../quality/processing/validation.md)；文档批准不代表实测通过                                                                                                                                                                                   |
| DEC-069/070 / 2026-10-04 | 已批P1–P6在适用证据/人工输入满足后自主关闭和推进、验证后本地提交；新范围/架构/兼容/阈值和发布仍须owner决定，不要求逐阶段重复审批                                                                                                                                                                                                |
| DEC-071 / 2026-10-04     | owner明确“批准0.0015，继续完整验证”；四原模型对应row短段跨后端max absolute≤1.5e-3，其余门槛保留，见[numeric review](../quality/processing/numeric-review.md)                                                                                                                                                                    |
| DEC-072 / 2026-10-05     | 允许先把成功FT接入现有Editor，布局/设计/动效由agent决定，先于完整P1性能/人工质量收口；不是后续完整链豁免，见[FT接入](../architecture/processing/editor-separation.md)                                                                                                                                                           |
| DEC-073 / 2026-10-11     | 停用9个Harness文档skills，维护源skills/、生成.agents/skills和CODEMAP；按需文档与风险验证，替代DEC-001/002安装及通用阶段门禁                                                                                                                                                                                                     |
| DEC-074 / 2026-10-12     | owner接受当前汇总听感/复杂音乐部分串音（drums最好），第三首耗时视作通过、长曲可更久；本地链路无问题且适用测试通过后收尾。旧900秒失败、OS缺口和完整P1 clean证据仍保留，见[owner验收](../quality/processing/evidence-index.md#owner-acceptance--2026-10-12)                                                                       |
| DEC-075 / 2026-10-12     | 授权四轨共同transport、ADT_STR鼓、Basic Pitch及六轨钢琴/吉他辅助分析、候选修正和V1显式应用；不含MIDI/P3/新工程格式/readiness/发布，新增识别质量待owner复核；见[自动标记](../architecture/processing/editor-auto-marking.md)                                                                                                     |
| DEC-076 / 2026-10-13     | 可收起/窄屏导航、MusicBar和歌曲详情首页，见[应用外壳](app-shell.md)                                                                                                                                                                                                                                                             |
| DEC-077 / 2026-10-13     | Analyzer单列/FIFO置顶、可调高度、图表内缩放，替代旧masonry/featureOrder工作区；见[列表](analyzer-list.md)                                                                                                                                                                                                                       |
| DEC-078 / 2026-10-16     | Editor公共顶栏/页签/常驻MusicBar、单草稿和换歌保护，见[工作区](editor-workspace.md)                                                                                                                                                                                                                                             |
| DEC-079 / 2026-10-17     | Wallpaper Engine风格近似频谱首位注册，独立立体声DFT、平滑与单位，不冒称官方实现；原子组合工程沿用后续DEC-084，见[频谱](wallpaper-spectrum.md)                                                                                                                                                                                   |
| DEC-080 / 2026-10-17     | 历史实时输出曾按源事件/时长另行开放档位；原fps/packet-gap失败不改写，测量保存在[输出说明](visualizer-output.md)，当前链路按DEC-081                                                                                                                                                                                              |
| DEC-081 / 2026-10-17     | owner明确离线确定性导出替代实时录制：同renderer、固定帧/PCM、WebCodecs/Mediabunny/OPFS；保留真实媒体与同步阈值，见[离线导出](visualizer-offline-export.md)                                                                                                                                                                      |
| DEC-082 / 2026-10-18     | 当时要求新增元素/预设先批准具体合同；该审批已由DEC-096替代，visualizer-content-generator替代旧SceneBrief/注册步骤；见[内容合同](../architecture/visualizer/content-generation.md)                                                                                                                                                  |
| DEC-083 / 2026-10-18     | 手写代码建议≤1000、>1300警告、>2000阻断；禁止压行、按完整功能区域拆Vue、Prettier渐进显式文件格式化；见[模块skill](../../skills/audiosurf-file-modularization/SKILL.md)                                                                                                                                                          |
| DEC-084 / 2026-10-18     | 分组预设、共同处理参数及旧草稿不提示保持；V4/V1和仅应用内核限制由DEC-087替代                                                                                                                                                                                                                                                    |
| DEC-085 / 2026-10-19     | owner批准按分类行1–9/0播放录入点/范围、当前细分吸附和取消/停止规则；工程V1及鼠标暂停限制不变，见[Editor交互](../architecture/editor/interaction-contracts.md#数字键实时录入dec-085)                                                                                                                                             |
| DEC-086 / 2026-10-19     | owner要求文档建议≤500、>500提示、≥800禁提交，压缩文字且可能损失关键信息时汇报/不提交；本轮又明确冲突采用最新、删除旧规定、保留有效内容，并以“Implement the plan.”批准清理及页面契约拆分                                                                                                                                         |
| DEC-087 / 2026-10-19     | owner选择算法资源包、工程内嵌算法、浏览器原生隔离、新格式替换及暂时隐藏磁盘资源包入口，并以“Implement the plan.”批准实施；仅项目内资源，不接后端/外部源，不改内容生成skill。见[V5](../architecture/visualizer/project-format-v5.md)和[V2](../architecture/visualizer/resource-packages-v2.md)，不含发布/readiness授权           |
| DEC-088 / 2026-10-20     | owner 以实施本轮外部资源库计划授权迁移现有 13 元素/两预设到 WheresYourElements/assets、只读目录选择/句柄恢复/刷新、清理内置资源和升级独立 skill 2.0.0；替代 DEC-087 的仅项目内目录及暂不升级 skill 限制。V5 自包含与算法隔离不变，不含 ZIP、外部 Git/历史目录、未来内容合同或发布授权                                           |
| DEC-089 / 2026-10-20     | owner 要求开放 Editor 标记响应并以“Implement the plan.”批准 ABI 2 markerInputs/timingInput、V5 可选 markerBindings、项目内单点/单范围及轨道分类集合查询；外部包仅声明，初始化无标记权限。仅升级既有 fade，保留插值/终值/重叠语义，其余 14 资源不变；独立 skill 2.1.0 同步到外部，未来新内容仍逐项批准，不含 BPM、识别候选或发布 |

## DEC-092 — 空 Seed 自动随机 — 2026-10-21

工程级 Seed 已由 DEC-097 的逐元素 Seed 替代；本条保留原批准来源，文件选择器修复仍有效。

owner 选择工程每次打开自动随机、同次预览/seek/导出一致，并要求首页、展示页和壁纸也保留自动随机；随后以“Implement the plan.”批准实施。V5/RealtimeStyleV1 的 seed 扩展为 uint32 或 null，保留版本；运行时解析为数字，不改资源 ABI 或外部元素。文件选择器改用合法 .json 过滤，完整导出文件名保留。见 [V5](../architecture/visualizer/project-format-v5.md)与[实时样式](visualizer-realtime.md)，不含发布或旧 readiness 重跑。

## DEC-090 — 点标记直线测试元素 — 2026-10-20

DEC-091 / 2026-10-20：owner 以“Implement the plan.”批准本轮实时预设分类、首页可视化模式、本地 `/display/:styleId` 和 Wallpaper Engine 项目目录导出；完整有效画面保存独立样式快照，实际播放信号在主音量前分析。首轮仅无历史查询元素，整曲时段转常驻，局部分镜/Editor 标记阻止应用；壁纸仅 WE 特征/常量。不改 V5/V2/ABI，不含外部浏览器音源、跨浏览器分享或发布。见[实时样式](visualizer-realtime.md)。

DEC-090 / 2026-10-20：owner 批准两份点标记直线具体内容合同，并以“Implement the plan.”批准实施：输入限定轨道内一个分类、每点独立叠加、相邻位置至少差 5%、点时刻最亮及 40/60/100ms 包络。新增可选 categorySelection 单分类约束与点查询 includeEnd，保留 ABI 2/V2/V5 及既有输入语义；skill 2.2.0 同步外部。资源放外部 assets，不创建 Git/历史目录，不授权其他新内容或发布。

## DEC-075 — Editor Audition and Limited Transcription — 2026-10-12

DEC-075新增能力验证曾被自动审批引用DEC-055拒绝，owner随后明确“允许本轮新增能力验证，旧readiness限制保留”：允许本轮模型/试听及回归使用本地端口与Chrome/Edge，含必要沙箱外执行；不将其扩展为旧Editor readiness重跑或发布授权。

DEC-074只接受当前功能与汇总听感/长曲时间。第三首没有精确秒数、未提供逐曲逐轨12行或完整OS保存/取消/回放记录，不补造。Chrome十五分钟1011.9541秒超900秒和完整P1/P2 clean缺口保留；P3/P6完整链指标、支持范围和生产发布独立。

多目标任务按小目标分别验证、本地提交，不推送/发布/重写历史。普通工作不生成阶段三件套、canonical或readiness；重大技术取舍遵守相应批准边界，具体内容审批已由 DEC-096 替代为自主生成。

## DEC-093 — osu 导入与 Editor V2 — 2026-10-21

owner 选择 10–1200 BPM、V1 显式迁移、包内原音频、追加新轨道及可选书签／休息／Kiai，并以“Implement the plan.”批准实施。V2 增加独立节拍锚点与 imported 来源；V1 工程、草稿及 Visualizer V5 内嵌快照按明确规则转换。首轮 v14 标准／太鼓／mania，原工程与换歌保护保留，三个小目标分别验证及本地提交；不含 catch、其他版本、发布或正式 readiness。当前格式见 [V2](../architecture/editor/project-format-v2.md)。

## DEC-094 — Editor 图表精度与时间对齐 — 2026-10-21

owner 确认上方图为顶部绿色波形，并以“Implement the plan.”批准叠加层按真实时间对齐轨道、曲首／曲尾保留留白，以及按可见窗口补充 PCM 波形和未聚合分析帧。播放及暂停均自动更新；连续缩放时现有图跟随，结束 150ms 后补算。保留既有特征参数与 Wallpaper 原生 30Hz，不改工程或持久化分析格式；复用既有 Worker／播放时钟、按窗口缓存并取消旧请求。按对齐及自适应细节两个小目标分别验证和本地提交，不重开正式 readiness。

## DEC-095 — 四轨特征与来源选择 — 2026-10-22

owner 以“Implement the plan.”批准四轨 energy、幅度谱、buffer、Wallpaper 频谱接入。Analyzer 顶部切换来源，各来源独立最多四项 FIFO，只分析当前来源置顶项；Editor 叠加层改为来源／特征 Cascader，顶部波形保持原曲。Visualizer 频谱输入可混用原曲与四角色，各来源最多四种特征，原选项称 analyzer（原曲）。来源切换只改变展示，三处独立，共用绝对时间。Editor V2／Visualizer V5 以可选 stemRole 保存来源引用，Analyzer 会话保存来源队列；单分析 Worker、有界 PCM、完整身份、取消及缓存容量边界保留。分离完成并校验后开放入口，缺失引用不回退；不含新原子元素／预设、实时分轨、推送或发布。当前契约见[Analyzer](analyzer-list.md)、[Editor](editor-marking.md)、[Visualizer 输入](visualizer-native-input.md)。

## DEC-096 — 外部内容生成自主执行 — 2026-10-22

owner 明确取消 SKILL.md 和 content-rules 的强制内容批准，并以“Implement the plan.”批准本轮调整。开放创意自主设计生成，明确需求仅在关键条件不足、冲突或无法实现时询问；Content Contract 改为设计记录，替代 DEC-082 及 DEC-088/089/090 后续沿用的具体内容审批门禁，历史已批准内容不改写。预设仍仅组合已有元素，缺失时先生成并验证元素。正常交付至少一张实际展示图且填写 previewPath；owner 选择仅修改 skill 要求，封装与图片容错不变。允许外部仓库正常 Git 管理，skill 2.4.0 仅保留于 WheresYourElements/skill，删除项目维护及发现副本。ABI、工程格式、隐私、许可、支持范围和发布等独立边界不扩张。

## DEC-097 — 支持随机效果的元素独立 Seed — 2026-10-22

owner 将位置更正为右侧属性，选择新元素默认留空、旧数据一次性迁移，并明确仅迁移现有 Seed 作用、不为其他 Shader 噪声新增控制；以“Implement the plan.”批准修订方案。删除工程/样式顶层 Seed，元素以 usesSeed:true 声明能力，实例独立保存数字或空值；外部声明、版本、引用及封装器同步，算法/Shader 和 ABI 不变。旧已知快照按精确算法身份迁移，只向支持元素复制旧值；未知或混合结构不猜测，失败保留原文。V5/V1 版本保留，取代 DEC-092 全局 Seed 行为，不含推送、发布或正式 readiness。
