# 应用导航与歌曲详情首页

owner 于 2026-10-13 批准本页方案并要求实现（DEC-076）。本次是应用外壳和首页展示修改，不改变播放、分析、工程或录制资源的所有权，也不形成正式 readiness 或发布结论。

## 导航与布局

- `MainLayout` 组合 `AppSidebar`、右上角 `AppSettingsButton`、路由内容和独立条件显示的 `MusicBar`，继续提供唯一音频及工作区服务。
- 桌面默认展开 216px，收起为 64px 图标栏；`config.sidebarCollapsed` 保存桌面选择，旧配置缺少该字段时使用 store 默认值 `false`。
- 收起时隐藏品牌和品牌图标，展开按钮占据原品牌图标位置。品牌及导航共用 44px 图标列，展开/收起不移动列表图标的水平或垂直位置；收起后的展开按钮、导航项悬停区域统一为 44×44px 正方形。
- `<768px` 初始隐藏，只保留展开按钮；展开使用非模态 dialog 和常规遮罩，支持 Escape、遮罩关闭和焦点恢复，播放器仍可操作。业务确认 dialog 打开时不由导航处理 Escape。成功导航后隐藏，路由拦截取消时保留菜单。窄屏开合不覆盖桌面偏好。
- 左导航包含首页、Visualizer、Analyzer、Editor、TestLands；当前页使用 `aria-current`，收起保留可访问名称和名称提示。设置仅显示右上角齿轮，继续发送既有事件；后续设置入口用于右侧侧边栏，本轮没有新增面板。
- `--app-sidebar-inset` 为桌面占位、窄屏 0；路由和 Editor 浮层控件共用该边界。Teleport 的 Canvas 和背景仍保持窗口级契约。
- MusicBar 位于内容宽度容器之外，固定按整个窗口计算：长方形模式横跨 100% 宽度，类椭圆形两侧沿用既有间隙。侧栏展开/收起不改变播放器宽度；播放列表也按窗口边界裁切。
- 播放器及其弹层位于普通应用 UI 最上层（100/110），覆盖左侧导航（40）、遮罩（39）和窗口级分析浮层（80–86）。窄屏导航不进入浏览器 modal top layer，避免阻断播放器；业务模态确认仍由其原生 dialog 管理。
- 桌面页面顶部间距为 12px，Analyzer 工具栏初始顶部 24px、sticky 顶部 8px；窄屏给展开按钮留位，页面顶部 64px、sticky 顶部 60px。
- `.app-content` 是命名为 `app-workspace` 的宽度容器。Visualizer 在可用内容宽度 `<1280px` 时使用既有互斥抽屉，其他情况三栏；支持的 `>=1024px` 浏览器视口仍保持单个 `100dvh`，`<1024px` 仍不承诺移动端工作区支持。
- Analyzer 按实际 masonry 容器宽度选择列数：`>=1232px` 两列，否则一列；间距保持 18px。侧栏切换由现有 ResizeObserver/RAF 重测，不重建卡片、Canvas、details 或分析消费者。
- 修改的可见滚动容器使用 `.app-scrollbar`。Sidebar media listener、导航订阅、背景 ResizeObserver 及既有资源按所属模块释放。

## 首页内容

- 音频能量继续驱动 `LightBg.rayLength`；背景容器尺寸变化会重新测量同一个 Renderer，reduced motion 保持静态渲染。
- 顶部按钮为选中的“详情”和原生禁用的“待完善”；没有其他展示模式或切换状态。
- 居中纵向展示歌名、艺人/专辑及正方形大封面；歌名 32–64px 自适应并完整换行，封面上限 440px，同时受内容宽度与 45dvh 限制。详情独立滚动并给底部播放器留位。
- 歌曲事实来自 `audioSessionStore.currentTrackId + queue`，封面读取 `AudioSessionService.getArtworkUrl()`；Home 不解析文件、不联网取封面、不创建或释放对象 URL。
- 无 title 时使用文件名，无艺人显示“未知艺术家”，无专辑省略专辑行。无封面或封面加载失败使用已有默认图片；旧图片的错误事件不能影响新歌曲。
- 无当前歌曲显示“未选择歌曲”及底部导入提示；刷新仍按共享会话恢复为 0 秒 paused。

## 验证入口

日常验证使用 app shell/smoke、Analyzer masonry、Editor compact/leave 与 Visualizer viewport 专项，并检查 Chrome/Edge 的 390、1024、1280、1920px 视口。重点是导航占位、焦点、取消离页、实时 metadata/封面、播放样式及重排时组件身份；历史 canonical/evidence 保持原候选语境。

2026-10-13 日常验证：最终修订后的五个界面专项 Chrome/Edge 各 20/20 通过，包含右上角纯图标设置、播放器独立宽度及窄屏导航上方的实际命中检查。跨列拖动专项双浏览器通过，选取的播放/恢复、导航层级、键盘重排与 FIFO 资源相邻检查通过。类型检查、技能入口/地图同步、仓库及文档检查通过；本次复用本地 5173 服务和指定浏览器安装路径，不生成正式 canonical/readiness。

同日侧栏对齐修正完成真实浏览器几何与悬停检查，Chrome/Edge 各两项现有导航回归通过：收起隐藏品牌，展开按钮替代品牌图标位置，列表图标坐标不变，44×44px 悬停区域完整显示。
