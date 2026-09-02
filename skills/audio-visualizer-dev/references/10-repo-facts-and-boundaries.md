# 仓库事实与边界

## 证据基线

- 最后核对日期：2026-08-28。
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

## 目录职责

| 区域 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/views/` | 路由页面；Home 展示光线背景，Analyzer 展示分析数据入口，TestLands 是试验页，ComingSoon 是空占位 | `src/router/index.ts`、各 view |
| `src/layouts/` | 应用共享外壳；`MainLayout` 组合 Header、路由内容和 MusicBar | `src/layouts/MainLayout.vue` |
| `src/components/` | 播放条、列表、动画列表、Canvas/WebGL 背景和试验性图表 | 各 Vue SFC |
| `src/audio/` | `AudioEngine` 独占 Web Audio 节点；`AudioSessionService` 编排 File、队列命令、能量和资源释放 | `audioEngine.ts`、`audioSessionService.ts` |
| `src/analysis/` | M6 的 21 项 FeatureRegistry、AnalysisConfig、PCM/frame 工具、六类 compact codec、module Worker 与 AnalysisCoordinator | `featureRegistry.ts`、`compactCodec.ts`、`analysis.worker.ts`、`analysisCoordinator.ts` |
| `src/persistence/` | 原生 IndexedDB V1 最近会话、句柄、current Blob/cache 和 runtime validator | `sessionRepository.ts` |
| `src/stores/` | 持久化 UI/音量配置及可序列化播放/恢复状态 | `configStore.ts`、`audioSessionStore.ts` |
| `src/utils/` | mitt 单例、能量角度映射、时间格式化和 clamp | `emitter.ts`、`utils.ts` |
| `src/data/` | Analyzer 页面使用的静态 Meyda 特征说明 | `analyzerData.ts` |
| `public/` | 默认封面、SVG 图标和静态资源；本地测试音频目录被 `.gitignore` 排除 | `public/`、`.gitignore` |
| `tests/` | Vitest、Playwright、Worker/IndexedDB harness、确定性 fixture、golden 和本地 eval runner | `tests/README.md`、测试配置 |

## 边界

- 当前是单一前端仓库；未发现后端、数据库、认证、云端媒体库或部署配置。
- 音频文件由用户通过 `showOpenFilePicker()` 选择；runtime File 保存在 session service，最近队列、文件句柄、唯一 current Blob 与匹配的分析 cache 由 SessionRepository 保存，Pinia `$state` 不持有浏览器资源、PCM 或 typed payload。
- `configStore` 继续把 `volume` 和 `musicBarSettings.style` 保存到 localStorage；M5 最近会话使用独立 IndexedDB V1，不改变 config schema。
- Analyzer 21/21 与 Analyzer-only readiness 已由版本化文档和证据确认；Editor E1–E7 已由 clean canonical 和 owner 批准。Visualizer V0 产品意图与系统设计已批准，当前只开放 V1–V6 delivery planning；`/comingsoon` 仍是占位，不能推断 Visualizer 已实现或整体 readiness 已扩大。
- `testcomp.vue`、`TestLands.vue`、`threeDTable.vue` 和 `MeydaCard.vue` 含试验或占位内容，不应默认视为稳定公共接口。

## 证据优先级

1. 当前可复现行为和命令输出。
2. 当前源码与配置。
3. 当前 Git 历史。
4. 指定历史任务中的验证记录。
5. 命名或结构推断。

对第 4、5 类结论使用“历史证据”或“推断”标签。
