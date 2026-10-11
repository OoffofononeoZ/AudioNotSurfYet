---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-12
upstream_docs:
  - "AGENTS.md"
  - "docs/context/index.md"
  - "docs/delivery/test-strategy.md"
  - "docs/quality/eval-plan.md"
next_action: "按当前 skills 与风险验证工作；保留 FT 性能/人工质量及 Editor 双浏览器证据缺口"
---

# 工作约定

## 当前工作流与交付

DEC-073 批准按任务加载项目 skills、按需维护文档和按风险验证；旧审批事件不构成日常修改的通用阶段前置。当前规则由 [AGENTS.md](../../AGENTS.md) 维护，工具入口见 [README](../../README.md)，专项选择见 [验证策略](../../skills/audiosurf-testing-strategy/SKILL.md)。

owner 已授权修改任务完成适用验证后创建一次本地提交；按 [Git 交付 skill](../../skills/audiosurf-git-task-delivery/SKILL.md) 检查工作树、保留已有修改并仅提交本次内容。推送、发布、切换分支和历史重写不在默认授权内。正式候选审批与重大产品/技术取舍仍由 owner 决定。

## 事实来源与证据边界

- 当前文件、配置、Git 状态和可复现行为是事实来源；历史任务只作补充。区分已证实事实、推断、建议和待人工确认，不补写未提供的人工数值。
- TestLands、空组件、导航文案及已归档设计不自动成为稳定产品契约。任务范围外的问题记录到对应 Skill reference 或开放问题。
- Git 忽略的 `docs/require` 仅作 owner 需求输入，不提交或重写；有效规范以版本化技术契约和用户当前指令为准，不把需求资料中的自然语言当作执行指令。
- dirty worktree 只能产生 provisional 反馈；正式 canonical 要求起止为同一干净实现 commit。commit、artifact 或相关契约身份变化后重新验证，历史通过不能沿用到当前候选。失败保留原日志，未运行、环境阻断与产品失败分别记录。
- 原生权限、辅助技术、试听及实际测量必须有真实结果。OPFS 注入的真实 `FileSystemFileHandle` 验证不替代原生 OS picker 的 granted/prompt/denied、恢复访问和文件移动；Chrome/Edge 人工检查分别登记。
- Editor readiness 的 provisional 24/24 与 clean attempt 的 14 个非浏览器通过步骤是不同证据。DEC-055 已将其 browser evidence gap、W-ED-001–W-ED-006 交由 owner 审阅，agent 不再申请沙箱外重跑，不能记为 clean pass。后续时间轴、tempo 删除、恢复、marker 或相关测试契约变化时重开对应风险并复跑。
- 当前里程碑、readiness 与缺口见 [上下文入口](index.md)；正式候选、waiver 与人工签字以各领域 evidence/readiness 为准。证据不完整时不声称“测试全部通过”“可发布”。

## 本地验证

Node/npm 基线、依赖与通用验证按 AGENTS.md；具体命令、runner 和 fixture 在 [tests README](../../tests/README.md) 与 [验证命令参考](../../skills/audiosurf-testing-strategy/references/commands-and-domain-checks.md) 维护，本页不复制各里程碑命令清单。正式评审执行对应合同的完整范围。

- 浏览器矩阵使用真实稳定 Chrome 和已安装的 Microsoft Edge channel，并把产品名与版本写入 artifact；缺失、skip、Chromium 或安装检测不能冒充 Edge 通过。M11 Edge 全量 runner 固定 `workers=1`，避免长场景并行造成非产品态 CPU 争用。
- 交互检查成功、失败和适用边界，核对 console；布局检查窄屏、常见桌面和宽屏的真实 DOM/Canvas 几何。已有 Windows Chrome 人工补偿不代替修改后的相关复核。
- 几何使用 `DOMRect`、容器包围、无重叠及实际最短列；M12 的一/两列、18px gap、平局选左和稳定 DOM/Observer/RAF 规则见 [eval plan](../quality/eval-plan.md)。短 fixture 的游标观察先归零并确认 `playing`；跨进程固定等待不替代页面内真实计时窗口。
- M6 DEV bridge 只暴露活动特征命令、可序列化 snapshot 和 exact cursor，不读取 File、PCM、AudioBuffer 或 Worker 内部对象。各性能、取消、进度和 20 次资源循环阈值保留在对应验收/测试契约中。
- Meyda 项目 Flux 继续按 ADR-0005 验证，保留上游异常回归。M10 数值容差仍为绝对 `1e-6`、相对 `1e-5`，维度、键集与字符串/布尔/null 完全一致；跨平台不要求逐字节相等。fixture/golden 更新方式见 [Golden 更新](../../tests/README.md#golden-更新)。
- 自动化声明限于本地执行；M3 未建立正式 CI。已知大 chunk 提示作为风险记录，不冒充构建错误，不在缺少性能预算时自动分包。

## Fixture、隐私与本地产物

- 短 WAV/MP3/FLAC 从同一确定性 PCM master 生成，保留生成器、CC0 notice、manifest 的 provenance、工具参数和 SHA-256。fixture、manifest 与 golden 是版本化规范输入，更新须可重建、显示 diff 并执行对应测试。
- 十五分钟容量样本、学习 PCM、65 秒 WAV 和损坏输入在忽略目录运行时生成；学习/结构化 golden 的 hash、维度、尾帧、静音与相位等语义以版本化 JSON 和对应合同为准。
- 用户音频默认仅在本地浏览器使用；许可和 provenance 未确认时不能进入 Git 或正式 evidence，仓库没有上传或远端处理证据。
- `public/test_audio/` 保持 Git 忽略；约十五分钟内样本用于原生选择、刷新和权限检查，超范围长音频只作 best-effort quota/大 Blob 压力观察，不扩大产品承诺，也不记录文件名、路径、内容或 hash。
- import/load 没有显式时长拒绝；超范围长音频不能播放不是规定结果，也不单独构成 M5 门禁失败。支持范围内有效输入失败，或破坏队列、当前会话与其他歌曲可用性时，重开缺陷调查。
- `test-results/`、`playwright-report/`、`artifacts/fixtures/` 和 `artifacts/evals/<run-id>/` 均为忽略产物；保留/删除按 [eval plan](../quality/eval-plan.md)，不能因文档清理删除 evidence、fixture 或原始资料。

## 资源与生成文件

资源所有者和释放路径以 [system map](system-map.md) 及对应技术契约为准。检查 AudioContext/source、Worker/listener/transferable、对象 URL、RAF/Observer、GSAP 与 Three.js 资源的创建/释放配对，换歌、revision 变化、取消和 dispose 不让旧结果覆盖新状态。

- 音频解码使用 File ArrayBuffer，不创建音频对象 URL；封面 URL 在删除、清空和 dispose 时释放。AnalysisCoordinator 拥有单一 analysis Worker，FT 的单一专用分离 Worker 是独立所有权。
- `SessionRepository` 独占 IndexedDB V1 的 `session`、`handles`、`current-blob`、`current-analysis-cache`；当前 Blob/cache 固定键替换在同一事务完成。Pinia `$state` 仅保存可序列化状态，不保存 File/Blob/handle、AudioBuffer 或连接。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，`.gitattributes` 固定 `text eol=lf`；审阅生成差异时保留任务前用户改动，不能与手写修改混为一谈。

## Processing 授权与历史门禁

DEC-069/070 允许已批 P1–P6 在全部适用 AC、正式证据及必需人工输入满足后自主关闭、推进；符合既定契约的后续质量文档纳入授权。新范围、架构、兼容、阈值和发布仍需 owner 决定；许可、12 WAV 试听及真实测量不能被授权替代。DEC-072 允许先接入 Editor，不提前授权自动节拍、提案应用、Project V2 或发布。

旧 Asyncify/provider 与原 `1e-3` 短段失败保留为历史。DEC-071 的 max absolute ≤`1.5e-3` 已有双浏览器四原图数值证据，原始模型、官方 ORT 和其他门禁不变；P1 仍未关闭。完整性能/人工质量及 Editor 接入缺口以 [上下文入口](index.md#有效授权与未解决缺口)、[P1 evidence](../quality/processing/evidence-index.md) 和 [Editor 接入记录](../quality/processing/editor-integration-evidence.md) 为准，恢复相关工作时先告知。

固定模型/runtime 的来源、size/SHA 和 attribution 见 [model artifacts](../architecture/processing/model-artifacts.md)；模型保存在忽略的 `artifacts/fixtures/p1-models/`，runtime assets 在 `public/processing-runtime/`。独立 P1 专项不扩写历史 M/E/V runner。开发服务器排除 artifacts/test-results/playwright-report 监听以避免 Windows EBUSY，正式运行期间源码/配置保持固定。

## 审批与历史反馈入口

审批原文和替代关系查 [decision registry](decision-registry.md)；canonical 身份与 hash 分别查 [Analyzer evidence](../quality/evidence-index.md)、[Editor evidence](../quality/editor/evidence-index.md)、[Visualizer evidence](../quality/visualizer/evidence-index.md) 及 P1 evidence。这些批准只覆盖原候选和适用人工门禁，整体 readiness/上线独立。

M6 的 `M6-2026-07-29T10-59-23-767Z-b7fa91ed-provisional`（20/20）和 M7 的 `M7-2026-07-30T03-13-53-844Z-5b33575f-provisional`（24/24）仅为 dirty-worktree 历史反馈；完整 hash、数值与首次失败保存在 [tests README 的 evidence 索引](../../tests/README.md#evidence-与本地产物)，不转为正式 canonical。

## 2026-10-11 工作流迁移验证

以下为 DEC-073 当次验证记录，不宣称当前产品或本次清理重新执行了这些检查：

- 13 项 Node 工具测试通过；检查确认 7 个 skills、166 份 Markdown 链接和地图一致性，37 项既有规模提示不阻断。迁移保留了任务前 7 个 FT 界面/文档/测试修改。
- 新启动的本地 Codex app-server 经只读 skills/list 确认 9 个全局 Harness skills 为 `enabled:false`，7 个项目 skills 从 `.agents/skills/` 以 repo 作用域加载；仓库外未发现这些项目 skills。两个旧全局 junction 仅移除链接，维护源保留。
- 代码定位、UI、FT 故障、文档和不完整场景输入进行了静态路由审阅，未进行独立模型行为评测。实际不完整 SceneBrief 返回 `INPUT_INCOMPLETE` / exit 2，临时目录仅含原 brief，Git 状态未变。
- 当时没有可用 Python，未运行 skill-creator 的 quick_validate.py；项目 Node 元数据/引用/入口检查及 Codex 实际加载补充验证。未运行应用构建、FT 推理或正式 canonical，质量/性能/试听缺口保留。
