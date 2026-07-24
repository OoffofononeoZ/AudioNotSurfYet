---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/product/problem-brief.md"
  - "docs/product/scope.md"
next_action: "确认每项指标是否代表目标用户价值，并给出目标、样本和评审周期"
---

# Success Metrics

当前没有分析埋点、用户基线或正式质量预算。下表是**候选指标**，目标值全部待人工确认。

| Metric | Type | Target | Observation method | Review date |
| --- | --- | --- | --- | --- |
| 本地音频选择到可播放的完成率 | leading | 待人工确认 | 在批准的浏览器/格式矩阵中执行 fixture 场景并记录成功/失败 | 待人工确认 |
| 核心播放任务完成率 | leading | 待人工确认 | 覆盖播放、暂停、上一首、下一首、跳转、删除、清空的任务测试 | 待人工确认 |
| 音频响应状态正确率 | leading | 待人工确认 | 播放时观察能量响应；暂停、错误、空队列和切换后验证归零 | 待人工确认 |
| 多视口关键控件可用率 | leading | 待人工确认 | 在批准的窄屏、桌面和宽屏矩阵核对实际几何与交互 | 待人工确认 |
| 目标用户认为视觉/分析体验有帮助的比例 | lagging | 待人工确认 | 对确认后的目标用户进行任务后问卷或访谈 | 待人工确认 |

## Guardrail Metrics

| Metric | Why it matters | Threshold |
| --- | --- | --- |
| 音频文件离开本地环境的次数 | 当前代码以本地处理为事实边界，改变会引入隐私风险 | 待隐私政策确认；未批准前不应新增上传 |
| 运行时 error/warn 与未处理拒绝 | 播放、WebGL 和对象生命周期错误会破坏可信度 | 待质量阶段设定 |
| 长会话资源增长 | 对象 URL、AudioContext、RAF 和 WebGL 资源可能累积 | 待性能预算与测量方法确认 |
| Production chunk size | 当前 Vite 有约 1 MB 大 chunk 提示 | 待性能预算确认 |
| 无障碍关键任务完成率 | fixed 控件、SVG 按钮和拖动操作可能排除键盘/辅助技术用户 | 待可访问性目标确认 |

目标、样本和观测环境未确认前，这些指标不能用于 release readiness。
