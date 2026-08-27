# UI、路由与状态

## 路由和布局

`src/router/index.ts` 使用 `createWebHistory()`，所有当前路由都位于 `MainLayout` 下：

| 路径 | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | `Home.vue` | 使用共享音频能量驱动 `LightBg` 的 `rayLength` |
| `/comingsoon` | `ComingSoon.vue` | Visualizer 空占位 |
| `/analyzer` | `Analyzer.vue` | Canvas 点阵背景和静态 Meyda 数据入口 |
| `/editor/:trackId?` | `Editor.vue` | E1 路由/工程基础已获批准；E2 时间轴/tempo/BPM clean canonical 为 in-review |
| `/testlands` | `TestLands.vue` | 试验页面，不应当作生产契约 |

Editor `/editor/:trackId?`、Header 当前歌曲入口、播放列表“去编辑”和 MusicBar 条件隐藏已由 E1 实现并获批准。E2 已增加波形/网格/游标 Canvas、共享 viewport、seek/zoom/pan、tempo boundary、BPM/拍号/single-beat 和刷新恢复；clean canonical 22/22 通过但尚待 owner 批准。E3 point、E4 overlay、E5 range 和 E6 加固仍不得写成已实现事实。

`MainLayout.vue` 固定组合 `HeaderBar`、当前 `router-view` 和 `MusicBar`，并创建/提供唯一 `AudioSessionService` 与 `AnalysisCoordinator`。修改页面高度、z-index、固定定位或底部空间时，要同时检查 Header 与 MusicBar。

## 组件通信

- `MainLayout` 创建并 provide 唯一 `AudioSessionService` 与 `AnalysisCoordinator`，在布局卸载时先 dispose coordinator 再释放 session service。
- `MusicBar` 读取 `audioSessionStore` 并调用 session commands；只拥有拖动预览、列表开合、跑马灯和 GSAP 样式时间线。
- `MusicList` 通过 `select-index`、`add-to-analysis`、`delete`、`clear`、`restore-access`、`reselect-track`、`clear-persisted` 和 `close-list` 事件回传操作；事件名已统一为 kebab-case。
- `MusicList` 的 `edit-track` 入口先显式播放目标歌曲，再导航到带 track ID 的 Editor；Header Editor 入口只使用当前歌曲且不隐式改变播放状态。
- `audioSessionStore` 是 Pinia store，保存 `TrackRecord[]`、current track ID、`PlaybackSnapshot`、persistence snapshot、analysis snapshot 和当前 energy；Home 与 MusicBar 读取同一能量。
- runtime File、封面对象 URL、AudioContext、AudioBuffer 和 AudioNode 均不得进入 store。
- `emitter.ts` 暴露 mitt 单例，事件类型位于 `src/types/events.ts`。当前已证实 Header 发出 `settings-open`；未发现订阅方，也未发现 `music-bar-settings` 的实际发送或订阅。
- 修改 mitt 事件时必须同时检查类型定义、发送方和订阅方；没有订阅方时不要假设事件已形成可用功能。

## Pinia 持久化

`configStore.ts` 使用 key `config` 写入 `localStorage`：

- `volume`: UI 百分比值，AudioSessionService 转为 0–1 Gain 值。
- `musicBarSettings.style`: 当前音乐条样式模式，代码使用 0、1、2。

播放位置和能量不持久化。原生 IndexedDB V1 保存最近队列、元数据、文件句柄、唯一 current Blob 与匹配 analysis cache；刷新固定回到 0 秒 paused。未知 schema 不猜测迁移，UI 显示可清除的错误。恢复失败状态进入 TrackRecord，File、Blob、handle、PCM 和 compact payload 仍不进入 Pinia。

## 响应式 UI 边界

- Header 和 MusicBar 都是 fixed 元素；路由内容使用 `h-dvh` 或屏幕高度相关样式。
- MusicBar 的样式 2 进度条由 CSS 固定在矩形上边；不要重新引入依赖一次性 `offsetLeft/offsetTop` 的定位。
- 样式切换由 GSAP 时间线管理，`isStyleTransitioning` 在动画期间隐藏进度条并阻止重复切换。
- 信息跑马灯依赖 `ResizeObserver`、DOM 宽度和 GSAP tween；内容或字体变化后需要重新测量并清理旧 tween。
- `AnimatedList` 使用全局键盘监听和滚动可见性动画；组件卸载时必须移除监听。

## 变更检查

- 新路由：检查 Header 导航、MainLayout 占位、直接访问与刷新。
- 状态变更：检查刷新后的 localStorage 恢复、非法旧值和默认值。
- 组件事件：检查事件名大小写、类型和父子两端。
- fixed/absolute 布局：至少验证窄屏、常见桌面和宽屏，读取 `getBoundingClientRect()` 核对几何。
- 设置功能：在缺少实际订阅方时，先把它视为未完成链路。
