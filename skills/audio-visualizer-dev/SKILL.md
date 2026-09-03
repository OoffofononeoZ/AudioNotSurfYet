---
name: audio-visualizer-dev
description: AudioNotSurfYet 项目专属的开发、诊断、代码评审、验证与文档路由指南。仅当任务明确作用于 AudioNotSurfYet 仓库，尤其涉及其 Vue 界面、路由与状态、Web Audio 播放和 Meyda 分析、Three.js/Canvas/GSAP 可视化、响应式布局、构建调试或 Harness Engineering 生命周期文档时使用；不要用于普通 Vue CRUD、其他音频项目或通用前端咨询。
---

# Audio Visualizer Dev

## 工作流

1. 确认目标是 AudioNotSurfYet：
   - 仓库应包含 `package.json`、`src/audio/audioEngine.ts`、`src/audio/audioSessionService.ts` 和 `src/components/MusicBar.vue`。
   - 若目标不是该仓库，停止使用本 Skill，改用更匹配的通用或项目 Skill。
2. 先读根 `AGENTS.md`（若存在）和 `git status --short`，再检查任务直接涉及的源码与配置。
3. 按任务只读取所需资料：
   - 仓库结构、依赖或边界：读 [仓库事实与边界](references/10-repo-facts-and-boundaries.md)。
   - 路由、布局、组件通信或状态：读 [UI、路由与状态](references/20-ui-routing-and-state.md)。
   - 音频加载、播放、跳转、元数据或能量分析：读 [音频播放与分析](references/30-audio-playback-and-analysis.md)。
   - Three.js、Canvas、GSAP、RAF 或响应式几何：读 [可视化、动画与响应式](references/40-visualization-animation-and-responsiveness.md)。
   - 构建、测试或调试：读 [构建、测试与调试](references/50-build-test-and-debug.md)。
   - 证据冲突、仓库漂移或工程约定缺口：读 [开放问题与项目差异](references/99-open-questions-and-project-deltas.md)。
4. 将任务分成最小可验证改动；保留用户已有修改，不顺手改无关问题。
5. 修改后按风险执行相关验证，并用实际证据说明“已实现”或“已验证”。

## 证据分类

在分析、评审和文档中明确区分：

- **已证实事实**：可由当前仓库文件、配置、Git 状态、命令输出或可复现交互直接支持，并注明证据位置。
- **推断约定**：由命名、代码形态或历史任务推得，但未被产品或技术负责人确认；必须标为推断。
- **建议标准**：为了降低风险提出的做法，不得写成仓库既有要求。
- **待人工确认**：涉及产品目标、范围、兼容性、隐私、发布风险、owner 或其他高影响取舍；记录影响和下一步，不代替人类决策。

仓库当前代码与配置优先于历史任务记录；出现冲突时，将差异写入 `references/99-open-questions-and-project-deltas.md` 或相应项目文档。

## 修改前检查

- 阅读最近的 `AGENTS.md` 和任务相关 reference。
- 检查工作树、目标文件及生成文件，避免覆盖用户修改。
- 确认行为契约：输入、状态迁移、输出、失败路径、边界条件和资源所有权。
- 涉及 UI 时确认路由、布局容器、定位上下文和目标视口。
- 涉及音频时确认用户手势、文件来源、AudioContext 状态、对象 URL、RAF 和节点释放责任。
- 涉及生命周期文档时，先执行下节的门禁路由。

## 文档路由

所有 AudioNotSurfYet 生命周期文档请求先交给 `$harness-doc-orchestrator` 判定阶段，再使用它指定的阶段 Skill。项目 Skill 只提供仓库事实和本地验证上下文，不复制 Harness 模板、通用阶段方法或审批规则。

- 缺少或过期的 `AGENTS.md`：先用 `$maintain-agents-guide`。
- 仓库上下文：用 `$repo-context-docs`。
- 产品意图：用 `$product-intent-docs`。
- 设计、交付、质量、发布和复盘：只有满足 Harness 上游状态门禁后才能继续。

不得通过预建空文件或大量 `TBD` 绕过审批。上游内容变化时，按 Harness 规则标记并复核受影响的下游文档。

## 修改后验证

- 运行与改动直接相关的静态检查和 `npm run build`。
- 交互改动使用真实浏览器验证目标路由，并检查控制台 error/warn。
- 音频改动覆盖加载成功、加载失败或无数据、播放/暂停/跳转、列表清空与资源释放。
- 离线分析改动覆盖 0/1/4 个活动特征、Worker progress/cancel/error、完整 cache identity、stale generation、exact cursor、持久化失败不影响播放，以及约 15 分钟输入的主线程响应与资源释放。
- 可视化和布局改动覆盖至少一个窄视口、一个常见桌面视口和一个较宽视口；核对真实几何，不只看截图。
- RAF、Observer、事件监听、Three.js 资源和对象 URL 必须检查创建与释放是否成对。
- Visualizer final hardening 使用测试专用资源探针核对 AudioContext、Worker、RAF、Canvas/WebGL、MediaStreamTrack、Observer、window/document listener 和 Blob URL；生产诊断只追加可序列化时间与资源计数，不扩大公共接口。
- 明确记录无法自动化的路径、原因、残余风险和补偿验证。
- 运行 `git diff --check`，并确认改动范围与用户请求一致。

## Git 安全边界

- 不覆盖、丢弃或格式化掉任务开始前的用户修改。
- 未经明确要求，不提交、不推送、不切换分支、不重写历史。
- 不用 `git reset --hard`、`git checkout --` 或等价方式清理工作树。
- 构建若改写生成文件，恢复用户原有差异后再交付。

## 停止条件

遇到以下情况时停止相关下游工作并说明缺口、所需输入和继续推进的风险：

- 缺少会实质改变行为的产品决策、接口契约或兼容性选择。
- 所需浏览器、音频样本、权限或运行环境不可用，且没有可信替代验证。
- 测试脚本、fixture 或上游文档缺失，无法形成声称通过所需的证据。
- 产品范围、隐私规则、浏览器支持矩阵、性能预算或 release risk 需要人类确认。
- Harness 阶段所需的上游文档不存在、不是 `approved`，或已因上游变化而过期。
