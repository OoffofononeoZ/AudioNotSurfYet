---
name: audiosurf-file-modularization
description: "新增、重构或评审 AudioNotSurfYet 代码职责与格式时使用；手写文件推荐不超过 1000 行，超过 1300 行警告、2000 行阻断；Vue 组件按完整功能区域拆分。"
---

# 模块职责

## 规模与格式

手写代码文件推荐不超过 1000 行。1001–1300 行结合职责审阅，不自动警告或强制拆分；1301–2000 行由 `repo:check` 警告；超过 2000 行阻断检查。第三方、生成文件、锁文件与产物除外；文档的 150/300 行整理提示另行维护。

行数按正常排版后完整文件的物理行计算，包括 Vue template/script/style、注释和空行；末尾换行不多算一行。禁止合并独立语句、压缩函数/CSS、挤掉必要结构或调宽格式配置来规避行数。不要因规模提示批量重构历史文件，也不为凑行数制造空壳转发模块。

修改的手写代码按显式文件运行 `npm run format -- <file...>`，再运行 `npm run format:check -- <file...>` 和行数检查；不对全仓、用户无关改动或生成文件执行格式化。Prettier 不支持的代码类型（如 PowerShell）人工保持正常排版，不强行套用其他 parser。

参考 [testcomp.vue](../../src/components/testcomp.vue) 与 [MusicList.vue](../../src/components/MusicList.vue) 的可读排版，统一选项以 [.prettierrc.json](../../.prettierrc.json) 为准，不照搬示例中的个别不一致写法。Vue 属性较多时，推荐按“v-if/v-for 等 Vue 逻辑 → 数据及属性 → 事件”组织；不强制每属性一行，不自动排序属性。行宽是排版参考，不是硬性限制。

极端特殊文件只有取得 owner 针对该文件的明确批准后，才能在 [规模策略](../../scripts/lib/code-size-policy.mjs) 登记具体仓库路径、获准最大行数、原因与批准来源。默认无例外；禁止通配豁免或文件内 ignore 注释；超过已批准额度仍阻断。批准本规则不批准任何具体文件例外。

## 按职责拆分

Vue 的“拆分组件”是把页面中的完整功能区域提取为子组件，由子组件承接相关模板、交互逻辑和局部样式，父组件通过清楚的 props/events/slots 装配。只把 CSS 或 TS/JS 迁出原文件不算完成组件拆分，也不能作为有实际 UI 边界时的替代。

纯计算、共享状态、通用样式或资源生命周期仍可按实际职责抽成模块或共享 CSS；这是相应职责的提取，不等同于拆分 UI 组件。独立功能边界明确时，不必等到达到推荐行数才拆分。

- Vue 页面负责装配；功能区域和交互组件承担各自 UI。可复用状态、事件与生命周期放 composables/controller，领域模型不与模板耦合。
- audio service/engine 分开命令编排与播放节点；analysis Coordinator/Worker 分开主线程调度、数值计算、cache 与 stale identity。
- Editor 区分时间/tempo、标记操作、工程 codec、持久化和 Canvas geometry；复用已有时间及吸附逻辑。
- FT 区分模型/运行库身份、PCM 处理、Worker 推断、任务控制、存储和 UI presentation；不把张量运算混入组件。
- Visualizer 区分 binding、确定性场景状态、renderer host、录制状态与文件 IO，保留单资源所有者。
- 工具和测试也按职责拆分；高频数值和渲染更新不要深度写入整个 Vue 响应式树。

文件同时承担多个独立功能区域或资源所有权时，结合本次改动提取可独立解释和验证的职责，不按行数机械拆文件。核对调用方、父子接口、资源创建/释放和相邻测试；结构或引用变化后按交付规则重新生成地图，不手改 codemap。
