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

## 代码定位与复用顺序

1. 结构或职责问题先读 `docs/context/system-map.md` 和下方目录表，并用当前源码核实入口；它们是人工维护的地图，不保证自动同步。
2. 已知符号、文案、配置或路径用 `rg` 搜索，再沿定义、导入和调用方检查。文档或 CSS 字面量同样用 `rg`。同名声明、引用完整性或跨层影响无法从文本命中判定时，再用可用的 TypeScript 语义工具或逐层调用检查；不要把首个同名命中当作唯一实现。
3. 新写解析、时间映射、特征、标记、场景或录制 helper 前，先检查相应领域目录与现有测试：`src/analysis/`、`src/editor/`、`src/visualizer/`、`src/audio/`。已有能力能扩展时优先复用其单一事实源；新需求若需要改变公共契约，先走架构复核。

口头概念先在 `docs/context/glossary.md` 找到项目术语，再用符号搜索确认当前位置；不要在 Skill 中维护第二份易过期的路径清单。

## 目录职责

| 区域 | 当前职责 | 主要证据 |
| --- | --- | --- |
| `src/views/` | 路由页面；Home、Analyzer、Editor 和 Visualizer V1–V5 工作台为产品表面，TestLands/ComingSoon 保持试验或通用占位 | `src/router/index.ts`、各 view |
| `src/layouts/` | 应用共享外壳；`MainLayout` 组合 Header、路由内容和 MusicBar | `src/layouts/MainLayout.vue` |
| `src/components/` | 播放条、列表、动画列表、Canvas/WebGL 背景和试验性图表 | 各 Vue SFC |
| `src/audio/` | `AudioEngine` 独占 Web Audio 节点；`AudioSessionService` 编排 File、队列命令、能量和资源释放 | `audioEngine.ts`、`audioSessionService.ts` |
| `src/analysis/` | M6 的 21 项 FeatureRegistry、AnalysisConfig、PCM/frame 工具、六类 compact codec、module Worker 与 AnalysisCoordinator | `featureRegistry.ts`、`compactCodec.ts`、`analysis.worker.ts`、`analysisCoordinator.ts` |
| `src/visualizer/` | V1 strict project/route/单草稿、V2 binding、V3/V4 scenes、单 RendererHost/context recovery，以及 V5 realtime WebM state/capture/save leases | `visualizerSessionController.ts`、`visualizerRecordingSession.ts`、`visualizerRendererHost.ts`、`recordingPresets.ts`、`videoFileIO.ts` |
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
- Analyzer 21/21 与 Analyzer-only readiness 已由版本化文档和证据确认；Editor E1–E9 与 Visualizer V1–V6 已由 clean canonical 和 owner 批准。Editor 与 Visualizer 整体 readiness 均需独立评审；`/comingsoon` 只是通用占位。
- Editor readiness 的运行时候选固定为 E9 implementation commit `13614673bbf4d824f2ee109d36e04de6b3f8aabd`；在该评审完成前，后续文档/Harness 提交必须以 `git diff ... -- src` 证明产品源代码无漂移。
- `testcomp.vue`、`TestLands.vue`、`threeDTable.vue` 和 `MeydaCard.vue` 含试验或占位内容，不应默认视为稳定公共接口。

## 证据优先级

1. 当前可复现行为和命令输出。
2. 当前源码与配置。
3. 当前 Git 历史。
4. 指定历史任务中的验证记录。
5. 命名或结构推断。

对第 4、5 类结论使用“历史证据”或“推断”标签。
