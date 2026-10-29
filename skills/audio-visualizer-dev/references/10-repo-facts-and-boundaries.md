# 仓库事实与边界

## 证据基线

- 仓库事实基线最后核对日期：2026-09-03；代码定位与复用顺序于 2026-10-01 补充。
- 首要来源：当前仓库的 `package.json`、配置、`src/`、Git 状态与 Git 历史。
- 补充来源：Codex 任务 `019f82bc-0838-7ab3-baba-1a7571992901`；只保留其中能由当前仓库或可复现验证支持的长期事实。
- 历史任务结论不得覆盖当前代码；差异记录在 [开放问题与项目差异](99-open-questions-and-project-deltas.md)。

## 技术栈

当前 `package.json` 和源码已证实：

- Vue 3、TypeScript、Vite 和 Vue Router 构成应用骨架。
- Pinia 与 `pinia-plugin-persistedstate` 保存配置。
- Element Plus 提供滑块、提示等 UI；Tailwind CSS 提供主要布局样式。
- GSAP 负责列表、音乐条和文字动画。
- Web Audio API 与 Meyda 负责播放数据和音频特征提取。
- Three.js 与 Canvas 2D 分别承载 WebGL 和点阵可视化。
- `music-metadata` 在浏览器端解析本地音频元数据。
- mitt 提供独立于组件树的轻量事件总线。

不得因依赖已安装就推断功能已达到产品可用状态；以实际路由和调用链为准。

## 定位入口

代码定位与复用顺序由 [导航 skill](../../audiosurf-codebase-navigation/SKILL.md) 提供。生成地图提供文件和有限引用，[system map](../../../docs/context/system-map.md) 解释当前职责，具体实现仍以源码为准。

## 目录职责

| 区域 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/views/` | 路由页面；Home、Analyzer、Editor 和 Visualizer V1–V5 工作台为产品表面，TestLands/ComingSoon 保持试验或通用占位 | `src/router/index.ts`、各 view |
| `src/layouts/` | 应用共享外壳；`MainLayout` 组合 Header、路由内容和 MusicBar | `src/layouts/MainLayout.vue` |
| `src/components/` | 播放条、列表、动画列表、Canvas/WebGL 背景和试验性图表 | 各 Vue SFC |
| `src/audio/` | `AudioEngine` 独占 Web Audio 节点；`AudioSessionService` 编排 File、队列命令、能量和资源释放 | `audioEngine.ts`、`audioSessionService.ts` |
| `src/analysis/` | M6 的 21 项 FeatureRegistry、AnalysisConfig、PCM/frame 工具、六类 compact codec、module Worker 与 AnalysisCoordinator | `featureRegistry.ts`、`compactCodec.ts`、`analysis.worker.ts`、`analysisCoordinator.ts` |
| `src/visualizer/` | Project V3 单草稿/元素 binding、单 RendererHost/context recovery、离线 WebM 编码/临时文件/保存租约 | `visualizerSessionController.ts`、`visualizerExportSession.ts`、`visualizerRendererHost.ts`、`offlineExport.ts`、`exportArtifact.ts` |
| `src/persistence/` | 原生 IndexedDB V1 最近会话、句柄、current Blob/cache 和 runtime validator | `sessionRepository.ts` |
| `src/stores/` | 持久化 UI/音量配置及可序列化播放/恢复状态 | `configStore.ts`、`audioSessionStore.ts` |
| `src/utils/` | mitt 单例、能量角度映射、时间格式化和 clamp | `emitter.ts`、`utils.ts` |
| `src/data/` | Analyzer 页面使用的静态 Meyda 特征说明 | `analyzerData.ts` |
| `public/` | 默认封面、SVG 图标和静态资源；本地测试音频目录被 `.gitignore` 排除 | `public/`、`.gitignore` |
| `tests/` | Vitest、Playwright、Worker/IndexedDB harness、确定性 fixture、golden 和本地 eval runner | `tests/README.md`、测试配置 |

## 边界

- 当前以共享 Vue 前端为主体，新增独立 Electron 宿主；无业务后端、认证或云端媒体库。双端进度与实际验证见[桌面合同](../../../docs/context/desktop.md)。
- 音频通过注入的 `AudioFileAccess` 选择，Web 使用原生浏览器 picker，Electron 使用受限 preload；runtime File 留在 session service。SessionRepository 保存队列、来源引用、唯一 current Blob 与匹配的分析 cache，Pinia 不持有资源、PCM 或 typed payload。资源目录同样经 `DirectoryFileAccess` 读取，Web 原始句柄不改，桌面路径只在主进程。
- `configStore` 继续把 `volume` 和 `musicBarSettings.style` 保存到 localStorage；M5 最近会话使用独立 IndexedDB V1，不改变 config schema。
- Analyzer当前特征与页面行为见页面契约；历史Analyzer-only readiness、Editor E1–E9和Visualizer V1–V6只覆盖原候选，Editor/Visualizer整体readiness仍独立。
- 原 Editor E9 readiness 候选只作为历史证据，E10/后续 Editor 修改后的当前候选与缺口见对应 readiness 和接入 evidence；不以历史候选冻结日常实现。
- `testcomp.vue`、`TestLands.vue`、`threeDTable.vue` 和 `MeydaCard.vue` 含试验或占位内容，不应默认视为稳定公共接口。

## 证据优先级

1. 当前可复现行为和命令输出。
2. 当前源码与配置。
3. 当前 Git 历史。
4. 指定历史任务中的验证记录。
5. 命名或结构推断。

对第 4、5 类结论使用“历史证据”或“推断”标签。
