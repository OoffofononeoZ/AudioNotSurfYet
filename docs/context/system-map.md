---
status: draft
owner: "unknown"
last_reviewed: 2026-07-24
upstream_docs:
  - "docs/context/index.md"
next_action: "确认 Analyzer/Visualizer/Editor 的真实边界与子系统 owner"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 提供全局 Header 和 MusicBar；MusicBar 在浏览器内读取本地文件、解析元数据、解码并播放 AudioBuffer，再把 Meyda 能量传给 CSS 灯带和 Home 的 Three.js shader。Analyzer 与 TestLands 已有路由，但前者主要展示静态说明，后者是试验表面。

## Runtime Flow

```text
本地 File
  → music-metadata / object URL
  → MusicBar
  → AudioLoader
  → AudioBufferSource → Analyser → Gain → destination
                         ├→ Meyda energy → MusicBar CSS
                         └→ audioStore → Home → LightBg shader
```

## Subsystems

| Subsystem | Purpose | Interfaces | Owner | Notes |
| --- | --- | --- | --- | --- |
| App shell and routing | 组合 Header、路由内容、MusicBar | Vue Router、router-link、router-view | unknown | `createWebHistory()`；无服务端回退配置证据 |
| MusicBar and queue | 文件选择、队列、元数据、播放控制、进度、三种样式 | DOM file input、MusicList events、Pinia config | unknown | 运行状态主要保存在组件内 |
| AudioLoader | 解码、播放、暂停、续播、跳转、分析节点 | 对象 URL 输入；时域/频域数组输出 | unknown | 使用一次性 AudioBufferSourceNode |
| Energy bridge | 在 MusicBar 与 Home 之间共享当前能量 | `useAudioEnergy()`、`updateEnergy()` | unknown | 模块级 Vue ref，不是 Pinia |
| Config persistence | 保存 volume 与 MusicBar style | Pinia、localStorage key `config` | unknown | 未发现 schema migration |
| Home visualization | 全屏 Three.js 光线 shader | `rayLength` prop、IntersectionObserver | unknown | 使用 WebGL renderer 与 RAF |
| Analyzer surface | 展示静态 Meyda 特征数据及 DotGrid 背景 | `analyzerData`、Canvas 2D | unknown | 完整分析工作流未证实 |
| Experimental charts | 试验性的 Three.js 2D 图和瀑布流 | Vue props、TestLands | unknown | 不视为稳定接口 |
| Event bus | 跨组件事件类型与发送 | mitt singleton | unknown | `settings-open` 无已发现订阅者 |

## External Dependencies

| Dependency | Why it exists | Failure impact | Replacement or fallback |
| --- | --- | --- | --- |
| Browser Web Audio API | 解码、播放和分析本地音频 | 核心播放与能量链路不可用 | 未定义 |
| WebGL / Three.js | Home 光线和试验图表 | 部分可视化不可用 | 未定义 |
| Canvas 2D | Analyzer 点阵背景 | 背景交互不可用 | 可不影响静态数据，但未形成产品决策 |
| localStorage | 恢复音量和样式 | 配置回到默认或写入失败 | 未定义 |
| `music-metadata` | 解析本地音频标签与封面 | 元数据和封面缺失；播放能否继续需验证 | 当前有 unknown/default cover 显示 |
| Meyda | 从时域数据提取 energy | 音频响应可视化不可用 | 未定义 |

## Known Seams

- MusicBar 同时拥有文件、播放、分析、动画和大量 DOM 状态，是当前最密集的交接点。
- `--coinc-process` 既可能由 GSAP 写入，也可能由能量 RAF 写入，模式切换需明确所有权。
- 对象 URL、AudioContext、RAF、Observer、GSAP tween 和 Three.js 资源跨越组件生命周期。
- Header 的 settings 事件没有已发现消费者，导航中的 Visualizer/Editor 共享占位页。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。
