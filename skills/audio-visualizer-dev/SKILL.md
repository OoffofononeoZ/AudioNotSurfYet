---
name: audio-visualizer-dev
description: "开发、诊断或评审 AudioNotSurfYet 的 Vue 界面、播放、音频分析、Editor、FT 分离、Visualizer 与录制。新增内置场景使用 visualizer-scene-generator；不用于其他音频项目。"
---

# Audio Visualizer Dev

确认目标包含 `src/audio/audioEngine.ts`、`src/audio/audioSessionService.ts` 和 `src/components/MusicBar.vue`。读取根 AGENTS.md 与任务相关源码；跨模块定位、拆分、验证和交付分别按项目对应 skill 处理，不默认加载全部。

## 按领域读取

| 当前任务 | 资料 |
| --- | --- |
| 技术栈与运行时边界 | [仓库事实与边界](references/10-repo-facts-and-boundaries.md) |
| 路由、布局、通信与状态 | [UI、路由与状态](references/20-ui-routing-and-state.md) |
| 文件加载、播放、跳转与分析 | [音频播放与分析](references/30-audio-playback-and-analysis.md) |
| Three.js、Canvas、动画与几何 | [可视化、动画与响应式](references/40-visualization-animation-and-responsiveness.md) |
| FT 模型、分离任务与 Editor 接入 | [浏览器处理链](references/60-processing-and-editor-separation.md) |
| 工程差异、未解决问题与漂移 | [项目差异](references/99-open-questions-and-project-deltas.md) |

新增内置场景使用 `$visualizer-scene-generator`；修改已有场景继续使用本 skill。处理新能力时先核对任务范围与相关接口、设计决定；已有浏览器处理架构和 Editor FT 接入已授权，当前状态以 [上下文入口](../../docs/context/index.md) 和证据为准。

## 页面设计文案

- 后续新增或明确要求改写的页面文案直接说清功能，避免宣传句、比喻、重复解释、额外英文眉题、技术徽标和功能清单；不靠冗余文字填补布局或吸引注意。
- 保留会影响用户操作与判断的必要提示，例如耗时、前置条件、取消或删除后果、错误恢复和保存状态；功能名称、控件标签、单位与数据标记仍须清楚可辨。
- 既有代码只修改 owner 明确指出的文案区域，其余冗余由 owner 后续逐项说明；不因这条设计约束自行开展全页面或全仓库清理。
- owner 指定的文案和内容映射原样保留。特别是 `src/data/analyzerData.ts` 的标题与说明，经 `FeatureRegistry` 映射到 `MeydaCard.vue` 展示，不压缩、改写、删除或另建摘要替代；Analyzer 可按 [当前列表契约](../../docs/context/analyzer-list.md) 默认单行折叠并由独立图标展开完整原文；专业内容较长不代表冗余。

## 领域约束

- Pinia 只持有可序列化状态；File、AudioBuffer、节点、Worker 和 typed payload 按运行时模块所有权保存与释放。
- 播放与分析复用现有 service、lease、clock 和 Coordinator。跟踪 source identity、generation/revision、取消与迟到消息，保持换歌后的最后一次操作生效。
- UI 修改先确认路由、布局容器、定位上下文和目标视口；高频数值/几何更新复用现有 Canvas、RAF 和生命周期模块。
- 新增或修改样式时按 [CSS 样式归置](references/20-ui-routing-and-state.md#css-样式归置与渐进迁移)选择 Tailwind、共享 CSS 或组件 `<style>`；旧写法只在本次实际涉及样式修改时渐进迁移。
- 可见滚动容器复用 `.app-scrollbar`；样式和动画不得破坏焦点、输入、现有滚动与资源所有权。
- 确认音频用户手势、AudioContext 状态、对象 URL 和节点释放。持久化失败不能破坏当前播放，缓存必须匹配完整身份。
- Visualizer 使用现有单 RendererHost、Canvas、视觉 RAF 与确定性歌曲时间；录制复用既有 pre-Gain tap、capture lease 和 typed capability 行为。
- 改变公共接口、工程格式、时间基准、binding 或渲染拓扑等重要取舍时说明影响并由用户确认。不通过增加 fallback 绕过失败。

针对实际影响选择成功、失败、边界和资源清理验证，使用 [验证策略](../audiosurf-testing-strategy/SKILL.md)。已实现、已验证、未运行和推断分别说明；没有实际数据不得补写试听、性能或发布结论。
