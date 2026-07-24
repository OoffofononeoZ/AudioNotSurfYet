# UI、路由与状态

## 路由和布局

`src/router/index.ts` 使用 `createWebHistory()`，所有当前路由都位于 `MainLayout` 下：

| 路径 | 页面 | 当前状态 |
| --- | --- | --- |
| `/` | `Home.vue` | 使用共享音频能量驱动 `LightBg` 的 `rayLength` |
| `/comingsoon` | `ComingSoon.vue` | 空占位；Header 的 Visualizer 和 Editor 都指向此路径 |
| `/analyzer` | `Analyzer.vue` | Canvas 点阵背景和静态 Meyda 数据入口 |
| `/testlands` | `TestLands.vue` | 试验页面，不应当作生产契约 |

`MainLayout.vue` 固定组合 `HeaderBar`、当前 `router-view` 和 `MusicBar`。修改页面高度、z-index、固定定位或底部空间时，要同时检查 Header 与 MusicBar。

## 组件通信

- `MusicBar` 拥有播放列表、当前索引、加载/播放状态、进度、元数据和 GSAP 时间线。
- `MusicList` 通过 `select-index`、`add-to-analysis`、`delete`、`clear`、`close-list` 事件回传操作；事件名已统一为 kebab-case。
- `audioStore.ts` 不是 Pinia store，而是模块级 `ref`：`useAudioEnergy()` 暴露只读值，`updateEnergy()` 由 MusicBar 更新，Home 消费。
- `emitter.ts` 暴露 mitt 单例，事件类型位于 `src/types/events.ts`。当前已证实 Header 发出 `settings-open`；未发现订阅方，也未发现 `music-bar-settings` 的实际发送或订阅。
- 修改 mitt 事件时必须同时检查类型定义、发送方和订阅方；没有订阅方时不要假设事件已形成可用功能。

## Pinia 持久化

`configStore.ts` 使用 key `config` 写入 `localStorage`：

- `volume`: UI 百分比值，调用 AudioLoader 时除以 100。
- `musicBarSettings.style`: 当前音乐条样式模式，代码使用 0、1、2。

播放队列、播放位置、音频元数据和能量值均未持久化。改变持久化 schema 前，先决定是否需要迁移旧数据；额外兼容逻辑需要人类确认。

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
