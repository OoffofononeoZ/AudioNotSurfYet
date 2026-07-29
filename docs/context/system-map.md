---
status: in-review
owner: "project-owner"
last_reviewed: 2026-07-28
upstream_docs:
  - "docs/context/index.md"
next_action: "在 M4 canonical run 后核对播放资源证据，并在 M5 增加恢复子系统"
---

# System Map

## System Summary

当前系统是 Vue 3 单页应用。MainLayout 创建并提供唯一的 `AudioSessionService`；服务通过 `AudioEngine` 解码、播放本地文件，并把可序列化播放快照和 Meyda 能量发布到 `audioSessionStore`。MusicBar 只读取 store 并发送命令，Home 从同一 store 读取能量。Analyzer 与 TestLands 已有路由，但前者主要展示静态说明，后者是试验表面。

## Runtime Flow

```text
本地 File
  ├→ music-metadata → TrackRecord → audioSessionStore
  └→ AudioSessionService runtime registry
        → ArrayBuffer → AudioEngine
        → AudioBufferSource → Analyser → Gain → destination
                               └→ Meyda energy
                                     → audioSessionStore
                                     ├→ MusicBar CSS
                                     └→ Home → LightBg shader
```

## Subsystems

| Subsystem | Purpose | Interfaces | Owner | Notes |
| --- | --- | --- | --- | --- |
| App shell and routing | 组合 Header、路由内容、MusicBar，并拥有 session service 生命周期 | Vue Router、provide/inject | project-owner | `createWebHistory()`；MainLayout 卸载时 dispose |
| MusicBar and queue UI | 文件选择、队列命令、进度、三种样式和错误消息 | AudioSessionService commands、audioSessionStore、MusicList events | project-owner | 不持有 File、AudioContext、播放 RAF 或队列事实 |
| AudioSessionService | 元数据、runtime File/封面、竞态、ended 循环、单 RAF 与资源释放 | File 输入；TrackRecord/PlaybackSnapshot/energy 输出 | project-owner | 非空追加不中断；快速切歌最后操作生效 |
| AudioEngine | 单一 AudioContext、解码、播放、暂停、seek、音量和时域数据 | ArrayBuffer 输入；PlaybackSnapshot/Float32Array 输出 | project-owner | AudioContext 与节点延迟创建；AudioContext 时钟为事实来源 |
| Audio session state | 保存队列、当前 track、播放快照和能量 | Pinia `audioSessionStore` | project-owner | `$state` 可 JSON 序列化，不含浏览器资源实例 |
| Config persistence | 保存 volume 与 MusicBar style | Pinia、localStorage key `config` | project-owner | schema 保持不变；volume 为 0–100 |
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

- MusicBar 仍拥有 GSAP、跑马灯和拖动预览等纯 UI 状态；播放事实由 session store 提供。
- AudioSessionService 的 runtime registry 是 File 与封面对象 URL 的唯一所有者；当前没有刷新恢复。
- `--coinc-process` 既可能由 GSAP 写入，也可能由能量 RAF 写入，模式切换需明确所有权。
- AudioContext、source、单播放 RAF 和封面 URL 由 MainLayout/session service 生命周期统一释放；Observer、GSAP 和 Three.js 仍由各组件释放。
- Header 的 settings 事件没有已发现消费者，导航中的 Visualizer/Editor 共享占位页。
- `components.d.ts` 和 `auto-imports.d.ts` 是构建插件生成文件，构建可能造成工作树变化。
