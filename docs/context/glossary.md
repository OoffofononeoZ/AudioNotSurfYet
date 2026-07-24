---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/context/index.md"
next_action: "由项目维护者确认样式模式命名和产品术语"
---

# Glossary

| Term | Definition | Why it matters | Related docs |
| --- | --- | --- | --- |
| AudioNotSurfYet | 本仓库与计划使用的项目名；`package.json` 当前包名仍为 `audiosurf` | 名称尚未形成单一代码级来源 | [index](index.md) |
| `AudioLoader` | 基于 AudioContext、AudioBufferSourceNode、AnalyserNode 和 GainNode 的播放封装 | 控制暂停/续播/跳转和分析数据生命周期 | [system map](system-map.md) |
| MusicBar | 固定在共享布局底部的播放、队列、元数据、进度和能量灯带组件 | 当前大部分播放状态都由它拥有 | [system map](system-map.md) |
| style 0 | 音频能量驱动 `--coinc-process` 的悬浮灯带样式 | 只在实际播放/分析数据存在时应有能量进度 | [working agreements](working-agreements.md) |
| style 1 | GSAP 独立循环旋转渐变的悬浮样式 | 动画值不是音频能量，切换时需显式复位 | [working agreements](working-agreements.md) |
| style 2 | 展开为视口宽矩形的 MusicBar 样式 | 进度条由 CSS 固定在矩形上边 | [working agreements](working-agreements.md) |
| audio energy | Meyda 从 Analyser 时域浮点数据中提取的 `energy` 特征 | 同时驱动 MusicBar 灯带和 Home 光线长度 | [system map](system-map.md) |
| `--coinc-process` | MusicBar CSS 圆锥渐变使用的角度变量 | GSAP 与音频循环都可能写入，所有权切换需清楚 | [decision registry](decision-registry.md) |
| playback offset | AudioLoader 保存的缓冲区秒数位置 | 暂停、跳转和续播依赖它而不是 media element currentTime | [system map](system-map.md) |
| object URL | 浏览器为本地音频或内嵌封面 Blob 创建的临时 URL | 删除、清空和卸载时需要成对释放 | [working agreements](working-agreements.md) |
| TestLands | `/testlands` 下的试验页面 | 当前不属于已批准产品表面或稳定接口 | [index](index.md) |
| lifecycle document | 带标准状态 frontmatter 的产品、设计、交付、质量、发布或复盘文档 | 下游工作依赖其批准与新鲜度 | [AGENTS.md](../../AGENTS.md) |
