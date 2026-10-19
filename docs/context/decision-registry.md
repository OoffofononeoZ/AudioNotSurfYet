# 当前决策与授权

核查日期：2026-10-19。本文保存仍有效的决定和必要批准来源；具体行为只在对应专题维护。旧过程和被替代的详细方案可从Git的`0bd2a67:docs/context/decision-registry.md`查回，不再作为当前指令。

## 持续边界

- DEC-003/006：中文文档与skill、代码标识保留原文；本地MP3/WAV/FLAC、桌面Chrome/Edge、安全上下文。上传/云端/移动端/非Chromium和生产部署未获得当前授权。
- DEC-007/018：数值/时钟/反馈门槛、owner 3/3学习边界及项目Flux保持；Meyda上游错误不伪称修复。见[Analyzer验证](../quality/validation.md)。
- 单engine/clock、序列化store、Worker/cache/stale和原子草稿理由见[共享运行时](../architecture/shared-runtime-contracts.md)及其链接ADR；最新页面规则优先于旧布局/接口。
- 历史canonical和批准只覆盖原候选，不能冻结以后源码或自动证明当前readiness；关键候选/批准保存在各领域evidence/readiness。

## 仍影响工作的决定

| ID / 日期 | 当前有效内容与来源 |
| --- | --- |
| DEC-050 / 2026-09-04 | 可见滚动容器复用app-scrollbar，Visualizer单工作区/独立侧栏滚动；见[应用外壳](app-shell.md)和[组合](visualizer-composition.md) |
| DEC-051–053 / 2026-09-04 | 紧凑BPM条、内部boundary删除与E9 revised canonical获批；有效几何/删除语义见[Editor交互](../architecture/editor/interaction-contracts.md)，旧独立tempo模块已删除 |
| DEC-054/055 / 2026-09-04 | 旧E9/pre-E10 readiness保留provisional24/24及clean14/24失败，browser gap和W-ED-001–006由owner自行审阅；不再申请该旧评审沙箱外重跑，见[Editor readiness](../quality/editor/release-readiness.md) |
| DEC-057 / 2026-09-04 | E10小节批量/复制/移动与原子冲突要求保留，历史E9不改写；当前模式按最新[交互](../architecture/editor/interaction-contracts.md) |
| DEC-058 / 2026-09-04 | 原生Fullscreen API、同Canvas和2秒隐藏/唤醒；旧候选人工缺口保留，见[Visualizer readiness](../quality/visualizer/release-readiness.md) |
| DEC-063/064 / 2026-10-04 | 本地四FT原图、官方ORT/WebGPU、IDB/OPFS；TS逐拍mix主输入/drums辅助和人工小节/meter确认目标，见[处理契约](../architecture/processing/worker-and-project-contracts.md) |
| DEC-065/066 / 2026-10-04 | 只读proposal、逐项确认、compact处理数据和tempo显式刷新仍有效；旧V2迁移/实时录制部分已由DEC-081/084替代 |
| DEC-067/068 / 2026-10-04 | 已批准处理路线及验收：逐拍70ms/F1≥0.95、完整链参考机目标等保存在[processing验证](../quality/processing/validation.md)；文档批准不代表实测通过 |
| DEC-069/070 / 2026-10-04 | 已批P1–P6在适用证据/人工输入满足后自主关闭和推进、验证后本地提交；新范围/架构/兼容/阈值和发布仍须owner决定，不要求逐阶段重复审批 |
| DEC-071 / 2026-10-04 | owner明确“批准0.0015，继续完整验证”；四原模型对应row短段跨后端max absolute≤1.5e-3，其余门槛保留，见[numeric review](../quality/processing/numeric-review.md) |
| DEC-072 / 2026-10-05 | 允许先把成功FT接入现有Editor，布局/设计/动效由agent决定，先于完整P1性能/人工质量收口；不是后续完整链豁免，见[FT接入](../architecture/processing/editor-separation.md) |
| DEC-073 / 2026-10-11 | 停用9个Harness文档skills，维护源skills/、生成.agents/skills和CODEMAP；按需文档与风险验证，替代DEC-001/002安装及通用阶段门禁 |
| DEC-074 / 2026-10-12 | owner接受当前汇总听感/复杂音乐部分串音（drums最好），第三首耗时视作通过、长曲可更久；本地链路无问题且适用测试通过后收尾。旧900秒失败、OS缺口和完整P1 clean证据仍保留，见[owner验收](../quality/processing/evidence-index.md#owner-acceptance--2026-10-12) |
| DEC-075 / 2026-10-12 | 授权四轨共同transport、ADT_STR鼓、Basic Pitch及六轨钢琴/吉他辅助分析、候选修正和V1显式应用；不含MIDI/P3/新工程格式/readiness/发布，新增识别质量待owner复核；见[自动标记](../architecture/processing/editor-auto-marking.md) |
| DEC-076 / 2026-10-13 | 可收起/窄屏导航、MusicBar和歌曲详情首页，见[应用外壳](app-shell.md) |
| DEC-077 / 2026-10-13 | Analyzer单列/FIFO置顶、可调高度、图表内缩放，替代旧masonry/featureOrder工作区；见[列表](analyzer-list.md) |
| DEC-078 / 2026-10-16 | Editor公共顶栏/页签/常驻MusicBar、单草稿和换歌保护，见[工作区](editor-workspace.md) |
| DEC-079 / 2026-10-17 | Wallpaper Engine风格近似频谱首位注册，独立立体声DFT、平滑与单位，不冒称官方实现；原子组合工程沿用后续DEC-084，见[频谱](wallpaper-spectrum.md) |
| DEC-080 / 2026-10-17 | 历史实时输出曾按源事件/时长另行开放档位；原fps/packet-gap失败不改写，测量保存在[输出说明](visualizer-output.md)，当前链路按DEC-081 |
| DEC-081 / 2026-10-17 | owner明确离线确定性导出替代实时录制：同renderer、固定帧/PCM、WebCodecs/Mediabunny/OPFS；保留真实媒体与同步阈值，见[离线导出](visualizer-offline-export.md) |
| DEC-082 / 2026-10-18 | 新增原子元素和预设（含纯复用）先校验brief并批准具体合同，visualizer-content-generator替代旧SceneBrief/注册步骤；见[内容合同](../architecture/visualizer/content-generation.md) |
| DEC-083 / 2026-10-18 | 手写代码建议≤1000、>1300警告、>2000阻断；禁止压行、按完整功能区域拆Vue、Prettier渐进显式文件格式化；见[模块skill](../../skills/audiosurf-file-modularization/SKILL.md) |
| DEC-084 / 2026-10-18 | JSON资源包过渡版、内嵌定义、分组预设/共同处理参数、仅V4、旧草稿不提示；不开放任意JS/Shader/DSL，见[V4](../architecture/visualizer/project-format-v4.md)与[资源包](../architecture/visualizer/resource-packages-v1.md) |
| DEC-085 / 2026-10-19 | owner批准按分类行1–9/0播放录入点/范围、当前细分吸附和取消/停止规则；工程V1及鼠标暂停限制不变，见[Editor交互](../architecture/editor/interaction-contracts.md#数字键实时录入dec-085) |
| DEC-086 / 2026-10-19 | owner要求文档建议≤500、>500提示、≥800禁提交，压缩文字且可能损失关键信息时汇报/不提交；本轮又明确冲突采用最新、删除旧规定、保留有效内容，并以“Implement the plan.”批准清理及页面契约拆分 |

## DEC-075 — Editor Audition and Limited Transcription — 2026-10-12

DEC-075新增能力验证曾被自动审批引用DEC-055拒绝，owner随后明确“允许本轮新增能力验证，旧readiness限制保留”：允许本轮模型/试听及回归使用本地端口与Chrome/Edge，含必要沙箱外执行；不将其扩展为旧Editor readiness重跑或发布授权。

DEC-074只接受当前功能与汇总听感/长曲时间。第三首没有精确秒数、未提供逐曲逐轨12行或完整OS保存/取消/回放记录，不补造。Chrome十五分钟1011.9541秒超900秒和完整P1/P2 clean缺口保留；P3/P6完整链指标、支持范围和生产发布独立。

多目标任务按小目标分别验证、本地提交，不推送/发布/重写历史。普通工作不生成阶段三件套、canonical或readiness；重大技术取舍和具体内容合同继续遵守相应批准边界。
