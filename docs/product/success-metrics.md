---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-26
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
next_action: "M11 已形成阈值证据；在 Analyzer release-readiness 中审阅外推限制"
---

# Success Metrics

## Product and Learning Outcomes

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| Owner 核心任务完成 | `project-owner` 完成加载、选卡、换卡、比较、跳转、刷新恢复的全部脚本任务 | 在批准的浏览器、fixture 和视口矩阵执行任务脚本，逐项记录通过/失败与证据 | 首个三特征切片验收及后续回归 |
| 首批特征解释正确率 | owner 对 3/3 个预设音频片段正确解释 RMS、Amplitude Spectrum、Chroma 数值与听感/音色关系 | 使用预先写定答案要点的黄金片段，先完成任务再对照评分 | 首个三特征切片验收 |
| 完整特征覆盖 | `src/data/analyzerData.ts` 的 21/21 个特征均有类型定义、renderer、黄金测试和可用卡片 | feature registry 覆盖检查、自动化测试与 owner 验收 | 最终特征里程碑 |

owner-only 学习验证是当前批准方式，不推断为广泛用户研究结果。若未来需要对外声称普遍学习效果，必须补充新的样本和研究设计。

## Correctness and Synchronization

| Metric | Target | Observation method | Review point |
| --- | --- | --- | --- |
| Meyda 结果一致性 | 与同版本、同参数、同 PCM 输入的直接 Meyda 提取黄金结果在约定浮点容差内一致 | 对 silence、正弦、双音、impulse 和同源格式 fixture 逐帧/逐元素比较 | 每个特征切片 |
| 播放游标同步 | 播放、暂停、跳转和恢复后的分析游标相对 AudioContext 基准偏差不超过 100ms | 记录引擎时间、期望跳转时间和显示游标时间；覆盖正常与边界路径 | 首个切片及回归 |
| 缓存身份隔离 | track、config 或 feature 任一变化都不复用不匹配结果；取消 job 的迟到消息不进入 UI | cache-key 单元测试、Worker 集成测试和快速换歌/换卡场景 | Worker 里程碑 |

浮点容差由交付验收标准固定；如果某一特征需要不同容差，必须给出可复现原因，不能临时放宽。

## Responsiveness and Reliability Guardrails

| Metric | Threshold | Observation method |
| --- | --- | --- |
| 主线程输入反馈 | 分析期间用户输入的可见反馈保持在 100ms 内 | 浏览器性能 trace 与 Playwright 交互计时 |
| 分析归因长任务 | 不产生可归因于分析计算的主线程长任务（单任务超过 50ms） | 对最大支持时长运行 PerformanceObserver/DevTools trace |
| 分析完成时长 | 不设 wall-clock SLA；必须有进度、取消和过期结果隔离 | Worker 消息与取消场景测试 |
| 恢复韧性 | 权限 prompt/denied、文件移动、quota 失败或缓存缺失不会破坏当前页面内可用会话 | IndexedDB 与浏览器恢复矩阵 |
| 运行时信号 | 批准场景中无未处理异常、控制台 error/warn 或泄漏的 Worker/Audio/Object URL | 自动化监听、资源生命周期测试和手工控制台检查 |

## Compatibility and Accessibility Guardrails

- MP3、WAV、FLAC 的同源 fixture 在最新稳定版 Chrome 和 Edge 桌面端完成加载、播放和首批分析。
- 在 1024、1280、1920 CSS px 验证真实几何、Canvas 像素尺寸与核心控件可用性。
- 播放、切歌、跳转、选卡和换卡均可用键盘完成，焦点可见，图表结论不只依靠颜色，reduced motion 下无非必要动画。
- 当前环境没有真实 Edge 证据时，状态必须写为“Chrome 已验证、Edge 待验证”，不得宣称浏览器矩阵全部完成。

## Approval Record

上述目标和阈值由 `project-owner` 于 2026-07-24 随产品计划一并批准。delivery 文档负责定义样本、步骤、容差和证据位置；quality 阶段只有在这些证据存在后才能判断 release readiness。
