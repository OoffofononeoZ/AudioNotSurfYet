# Analyzer 页面接口契约

核查日期：2026-10-19。公共播放、Worker 与持久化见[共享运行时](../shared-runtime-contracts.md)。

## 页面与消费者

- `/analyzer` 由 [Analyzer.vue](../../../src/views/Analyzer.vue)装配，持有 analyzer consumer lease；离页释放订阅、lease、Observer 与绘图资源。
- 单列原列表和 FIFO 置顶区共用特征身份。活动项最多四种且唯一，第五项淘汰最早加入项；显示顺序与队列年龄区分，取消不重置其他项年龄。
- 当前集合以 [FEATURE_IDS](../../../src/analysis/types.ts)和 [FeatureRegistry](../../../src/analysis/featureRegistry.ts)为准，包含 wallpaperEngineSpectrum；历史 21 项或 M6–M10 常量不代表当前完整集合。
- 高度、键盘、拖动取消、详情折叠与图表滚轮见[当前列表](../../context/analyzer-list.md)，Wallpaper 数据含义见[频谱说明](../../context/wallpaper-spectrum.md)。

## 计算与渲染

- activeFeatureQueue 映射为 V1 cards 保存最新 workspace revision；初始化与刷新采用当前 analyzerWorkspaceVersion，不恢复旧 featureOrder API。
- 标准分析采用 average-mono PCM、frameSize 1024、hopSize 512、hanning、13 MFCC；track/config hash 参与 cache identity。Wallpaper 频谱采用独立定义和单位。
- cache 逐 feature 部分复用，损坏项按 miss 重算；全命中仍可准备 retained PCM 供 exact cursor，不重复提取已命中特征。
- 播放快照是 cursor 秒数唯一来源，viewport zoom/pan 不改音频时钟。普通列表折叠项不常驻 Canvas，活动项按需绘制。
- 单位、分量、精确值与说明由 registry/renderer 处理；不修改 owner 指定的 Analyzer 专业文案。

## 源码与验证

类型和算法见 [analysis/types.ts](../../../src/analysis/types.ts)、[workerCore.ts](../../../src/analysis/workerCore.ts)、[session.ts](../../../src/types/session.ts)。取消、quota 和 stale 复用共享契约。

按[测试命令](../../../skills/audiosurf-testing-strategy/references/commands-and-domain-checks.md)选专项；[evidence](../../quality/evidence-index.md)和 [readiness](../../quality/release-readiness.md)属于历史候选，当前布局和新增频谱不继承其整体结论。
