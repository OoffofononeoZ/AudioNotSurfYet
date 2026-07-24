---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/product/problem-brief.md"
next_action: "人工选择首个产品范围、非目标和签字人；批准前不得进入系统设计"
---

# Scope

以下内容是基于当前仓库的**建议草稿**，不是已批准承诺。

## Proposed In Scope

- 在浏览器中选择用户本地音频，并显示文件名、标题、艺术家、时长和可用封面。
- 管理当前会话内的播放队列：选择、上一首、下一首、删除与清空。
- 提供播放、暂停、进度跳转和音量控制，并保持状态一致。
- 提供当前三种 MusicBar 样式，确保切换、空队列和多视口下行为稳定。
- 播放时用实时能量驱动已存在的 MusicBar/Home 可视化，暂停、错误或清空时归零。
- 为既有 Analyzer 方向保留产品研究，但其首版功能边界需由人工决定。

## Proposed Out of Scope

- 用户账户、云端媒体库、上传、同步或服务端音频处理。
- 正式音频编辑能力；当前 Editor 只链接到占位页面。
- 在范围批准前承诺完整 3D 分析、导出、分享、协作或插件系统。
- 自动支持所有音频格式、所有浏览器和所有设备。
- 未经确认的 legacy data migration 或兼容 fallback。

## Assumptions

- **已证实事实**：当前音频通过本地 File 和对象 URL 在浏览器内处理。
- **推断约定**：首版可以围绕现有播放与响应式视觉链路收敛，而不同时完成编辑器。
- **建议标准**：把 TestLands 和占位组件留在非稳定表面，直到产品 owner 决定去留。
- **待人工确认**：用户是否接受只在当前会话保存播放队列；是否要求离线、移动端或无 WebGL fallback。

## Dependencies

- 需要确认目标用户、核心用例和 Analyzer/Visualizer/Editor 优先级。
- 需要确认浏览器/设备矩阵、隐私规则、音频格式与 fixture 许可。
- 需要确定产品 owner、技术 owner 和批准方式。
- 需要在质量阶段前确定性能预算和可访问性目标。

## Approval Notes

- Decision-makers：unknown
- Required sign-offs：至少需要产品范围 owner 明确批准本文件与 [problem brief](problem-brief.md)。
- Current state：`draft`；任何代码现状都不构成范围批准。
