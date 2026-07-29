---
status: in-review
owner: "project-owner"
last_reviewed: 2026-07-28
upstream_docs:
  - "docs/context/index.md"
next_action: "在 M5 增加恢复状态与 session repository 术语"
---

# Glossary

| Term | Definition | Why it matters | Related docs |
| --- | --- | --- | --- |
| AudioNotSurfYet | 本仓库与计划使用的项目名；`package.json` 当前包名仍为 `audiosurf` | 名称尚未形成单一代码级来源 | [index](index.md) |
| `AudioEngine` | 独占实时 AudioContext、AudioBuffer、source、Analyser 和 Gain 的播放服务 | 所有页面共享同一播放时钟和资源生命周期 | [ADR-0001](../architecture/adrs/0001-single-audio-engine-and-session-state.md) |
| `AudioSessionService` | 在 store 外拥有 File、封面 URL、播放命令、ended 循环、generation 和单 RAF 的应用服务 | 把运行时浏览器资源与可序列化事实分开 | [system map](system-map.md) |
| `audioSessionStore` | 保存 TrackRecord 队列、当前歌曲、PlaybackSnapshot 和当前能量的 Pinia store | 后续持久化与 Analyzer 只能依赖序列化状态 | [interface contracts](../architecture/interface-contracts.md) |
| MusicBar | 固定在共享布局底部的播放、队列、元数据、进度和能量灯带 UI | 只读取共享状态并发送 session 命令 | [system map](system-map.md) |
| style 0 | 音频能量驱动 `--coinc-process` 的悬浮灯带样式 | 只在实际播放/分析数据存在时应有能量进度 | [working agreements](working-agreements.md) |
| style 1 | GSAP 独立循环旋转渐变的悬浮样式 | 动画值不是音频能量，切换时需显式复位 | [working agreements](working-agreements.md) |
| style 2 | 展开为视口宽矩形的 MusicBar 样式 | 进度条由 CSS 固定在矩形上边 | [working agreements](working-agreements.md) |
| audio energy | Meyda 从 Analyser 时域浮点数据中提取的 `energy` 特征 | 同时驱动 MusicBar 灯带和 Home 光线长度 | [system map](system-map.md) |
| `--coinc-process` | MusicBar CSS 圆锥渐变使用的角度变量 | GSAP 与音频循环都可能写入，所有权切换需清楚 | [decision registry](decision-registry.md) |
| playback offset | AudioEngine 保存的缓冲区秒数位置 | 暂停和 seek 以此为基点，播放时间由 AudioContext `currentTime` 计算 | [system map](system-map.md) |
| `PlaybackSnapshot` | track、状态、秒数、时长、0–1 音量和 typed error 的可序列化事实 | UI 不从 AudioNode 或 RAF delta 推断播放状态 | [interface contracts](../architecture/interface-contracts.md) |
| object URL | 浏览器为内嵌封面 Blob 创建的临时 URL | 音频解码不依赖它；封面在删除、清空和 dispose 时成对释放 | [working agreements](working-agreements.md) |
| TestLands | `/testlands` 下的试验页面 | 当前不属于已批准产品表面或稳定接口 | [index](index.md) |
| lifecycle document | 带标准状态 frontmatter 的产品、设计、交付、质量、发布或复盘文档 | 下游工作依赖其批准与新鲜度 | [AGENTS.md](../../AGENTS.md) |
