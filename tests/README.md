# 测试与本地产物

按实际改动选择检查，不把可用命令表作为默认执行清单。当前领域验收集中在[Analyzer](../docs/quality/validation.md)、[Editor](../docs/quality/editor/validation.md)、[Visualizer](../docs/quality/visualizer/validation.md)与[processing](../docs/quality/processing/validation.md)，任务选择见[验证skill](../skills/audiosurf-testing-strategy/SKILL.md)。

读取文档、skill 及其引用文本必须显式指定 UTF-8 参数，例如 `Get-Content -Encoding UTF8`、`rg --encoding utf-8`。文档或 skill 修改需核对读取指示及示例，完整规则见[AGENTS](../AGENTS.md#文档与-skill-读取编码)。

Node24.22.1/npm11.x，依赖版本以lockfile为准；浏览器专项使用真实已安装Chrome/Edge。历史M/E/V的环境、批准和失效候选只查evidence/readiness，不作为当前环境或产品状态。普通任务不执行累计eval、不生成阶段文档。

手写文档建议≤500行，>500提示、≥800阻断，保留正常排版和关键信息。代码按明确文件渐进format/format:check，不批量格式化。

下面保留现有命令与数据职责；历史eval runner仅在明确重放/正式评审时使用，当前界面验证以现行页面契约和专项为准。test:harness是故障检测测试基础设施，与停用的Harness文档skills无关。

## 命令

Web/Electron 改动先核对[双端阶段和验证要求](../docs/context/desktop.md)。共享行为需要双端适用检查，单端改动说明影响依据；桌面命令随实现增加，浏览器通过不证明 Electron 通过，自动化不能代替原生 OS 许可及安装操作。

桌面已提供 `npm run desktop:typecheck`、`npm run test:desktop:unit`；先运行 `npm run desktop:build`，再运行 `npm run test:desktop:smoke`；先运行 `desktop:dir`，再运行 `test:desktop:packaged` 检查 ASAR 分发。smoke 使用独立持久化 profile、生产网页产物及应用协议，检查隔离、路由、OPFS 重启恢复、WebGPU、ORT 模块和实际 VP9/VP8/Opus 编码；不等于 FT 推断、封装媒体质量、原生 picker 或安装验收。结果保存在 `artifacts/desktop/`；当前原生启动阻断见桌面专题，不记为通过。工具测试覆盖静态资源白名单，防止复制本地 public/audios、测试音频或额外模型。

`test:desktop:unit` 覆盖真实临时文件的原生授权保存/恢复/撤销、一次性工程授权、目录 junction 与路径边界、变更/缺失区分、错误去路径化、保存事务的完整提交/取消/目标变更、分块背压和双端文件端口；模拟 IPC 检查窗口/frame/origin、用途及参数拒绝。模拟 IPC 不证明真实 OS 对话框或原生协议可用，临时文件事务不证明退出/安装通过；这些独立缺口继续保留。

目录事务另覆盖预设/壁纸精确清单、整目录发布、分块取消、已有目标/外部改动保留及 junction 拒绝；清理不递归删除外来文件。预设浏览器回归检查权限拒绝和刷新重载，壁纸回归检查五文件产物及 file:// 渲染；媒体上传先等待文件绑定完成，渲染版本变化本身不能证明上传完成。

`native-startup-cleanup.test.ts` 在真实临时文件系统中延迟路径解析/source 创建，检查销毁等待尚未登记的事务、初始化取消清理及导航后新代事务保留；不依赖固定等待时间，不替代宿主关闭握手。

`native-ipc-tasks.test.ts` 检查暂停新请求、排空旧对话框/操作和清理错误传播；文件 IPC 回归另检查导航/关闭代次失效，授权存储回归检查 flush 后的选定位置可以恢复。模拟对话框不替代真实 Windows 操作。

`window-state.test.ts` 检查负坐标多显示器、显示器移除/缩小、偏好缺失/损坏、普通尺寸/最大化持久化，以及最小化/全屏和事件监听释放；使用真实临时文件和窗口事件替身，实际原生恢复另验。

`tests/e2e/desktop-file-controls.spec.ts` 在真实 Chrome/Edge 内挂载桌面控件适配器，使用注入的端口替身检查迟到选择、换源取消及新旧保存所有权；它是 UI 逻辑证据，不是 Electron 或 OS 选择器证据。上传业务回归沿用 osu、Circular 媒体、歌词、预设和 FT 专项。

`visualizer-realtime-dialog.spec.ts` 保留 Web 地址复制与弹窗回归，另在浏览器内注入桌面展示策略，检查创建后只有应用内链接、无地址/复制控件且可打开已保存样式；该项不证明 Electron 协议或打包运行。

| 命令                                                    | 作用                                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                     | 运行 `vue-tsc -b`                                                                                                                                                 |
| `npm run test:tools`                                    | 仓库工具、代码规模边界/批准例外、格式化样例、失败与只读行为；使用临时 fixture，不批量修改产品代码                                                                 |
| `npm run format:check -- <file...>`                     | 只读检查本次明确修改的手写代码格式；不检查全仓历史文件                                                                                                            |
| `npm run transcription:models`                          | 下载／校验 DEC-075 的 ADT_STR、Basic Pitch、六轨辅助公开模型；单元与真实浏览器命令见 [自动标记验证](transcription/README.md)                                      |
| `npm run eval:editor-ft` / `eval:editor-ft:provisional` | DEC-072 Editor FT 接入：docs/assets/四图bytes/types/build、处理与Editor专项、Chrome/Edge真实四轨及E7–E10相关回归；保存candidate、截图/WAV身份和已知缺口，不关闭P1 |
| `npm test`                                              | 执行全部非 E2E Vitest 测试                                                                                                                                        |
| `npm run test:unit`                                     | PCM、容差和 isolated IndexedDB                                                                                                                                    |
| `npm run test:worker`                                   | Worker transfer、cancel 和 error harness                                                                                                                          |
| `npm run test:analysis`                                 | direct-Meyda 首批 golden                                                                                                                                          |
| `npm run test:fixtures`                                 | manifest、SHA-256、字节数和 ffprobe                                                                                                                               |
| `npm run test:m4:unit`                                  | AudioEngine 的 load/play/pause/seek/ended/stale/error/unload/dispose                                                                                              |
| `npm run test:m4:integration`                           | session/store 的队列、竞态、ended、删除、清空、metadata、RAF 与 URL                                                                                               |
| `npm run test:m5:unit`                                  | PersistedSessionV1 validator、SHA-256、IndexedDB 原子 current Blob/cache、abort、删除与清空                                                                       |
| `npm run test:m5:integration`                           | Blob 优先、0 秒 paused、权限顺序、显式 request、missing/changed、quota 和取消                                                                                     |
| `npm run test:m6:unit`                                  | 21 项 registry、config hash、PCM/frame、聚合/量化、六类 compact codec 与损坏数据拒绝                                                                              |
| `npm run test:m6:worker`                                | 产品 workerCore 的 0/1/4 项、非法请求、yield/progress/cancel、错误与 exact cursor                                                                                 |
| `npm run test:m6:integration`                           | AnalysisCoordinator、partial cache、stale generation、quota 与 current Blob 原子持久化                                                                            |
| `npm run test:m7:unit`                                  | viewport/zoom anchor/x↔time、renderer 数据变换、工作区不变量和 L1/L2/L3 版本化 golden                                                                             |
| `npm run test:m7:integration`                           | 默认/已保存空工作区、卡片/viewport 持久化和 quota 后内存继续可用                                                                                                  |
| `npm run test:m8:unit`                                  | 13 项 registry、12 项 direct Meyda、项目 Flux、静音/非有限值和 scalar axis/golden                                                                                 |
| `npm run test:m8:integration`                           | 四 scalar Worker、Flux exact cursor、四卡持久化、quota 和 13 项有限值回归                                                                                         |
| `npm run test:m9:unit`                                  | 三项 registry、direct Meyda、Power 平方关系、MFCC signed 量化、Buffer envelope/尾帧与 golden                                                                      |
| `npm run test:m9:integration`                           | 四种混合 shape、cache codec、exact cursor、stale/cancel/quota 与四张累计卡回归                                                                                    |
| `npm run test:m10:unit`                                 | 21 项集合、direct Meyda、24/1024 维、零值、相位关系、结构 codec 与按固定容差校验的 golden                                                                         |
| `npm run test:m10:integration`                          | Loudness/Complex 混合 shape、cache round-trip、exact cursor、stale/cancel/quota 与四卡持久化                                                                      |
| `npm run test:m12:unit`                                 | Analyzer 置顶区高度上下限、短内容优先和用户比例裁剪                                                                                                               |
| `npm run test:m13:unit`                                 | FIFO reducer、0–4 项、第五项淘汰、重开年龄、唯一性、置顶高度模型与 V1 adapter                                                                                     |
| `npm run test:m13:integration`                          | V1 双向兼容、串行 workspace 保存、revision guard、quota 与 M13 Coordinator cache/generation                                                                       |
| `npm run test:e1:unit`                                  | Editor JSON V1 初始工程、canonical round-trip、微秒规范化与 strict validator                                                                                      |
| `npm run test:e1:integration`                           | playback/analysis lease、独立 IndexedDB、同/异歌草稿、原子导入和 quota 后内存保留                                                                                 |
| `npm run test:e2:unit`                                  | Editor viewport/geometry、Tempo map、拍号/single-beat、BPM onset/autocorrelation 与 golden                                                                        |
| `npm run test:e2:integration`                           | Buffer retained PCM、tempo identity/stale、JSON viewport/tempo round-trip 与 coordinator 回归                                                                     |
| `npm run test:e3:unit`                                  | Editor point lane/class 命令、迁移冲突、微秒唯一性、显式细分吸附与可见事件过滤                                                                                    |
| `npm run test:e3:integration`                           | point/range JSON 兼容、独立草稿恢复、tempo 秒数稳定与 viewport-visible 模型                                                                                       |
| `npm run test:e4:unit`                                  | Editor 历史 21 项 golden、当前 overlay registry、六类纯 Canvas renderer、bounds、Buffer 去重与 exact summary                                                      |
| `npm run test:e4:integration`                           | Buffer-first consumer、快速换特征、错误重试、Analyzer 隔离与 overlay 草稿恢复                                                                                     |
| `npm run test:e5:unit`                                  | Editor range lane/class、半开重叠、最短网格、端点更新、迁移冲突与可见范围过滤                                                                                     |
| `npm run test:e5:integration`                           | point/range JSON 与草稿 round-trip、无效导入隔离、tempo 秒数稳定与稳定 ID                                                                                         |
| `npm run test:e6:unit`                                  | 确定性 15 分钟/20 lane/160 分类/10,000 事件拓扑、唯一 ID、范围边界和可见事件过滤                                                                                  |
| `npm run test:e6:integration`                           | 10,000 事件 JSON 与 IndexedDB round-trip、重叠工程原子拒绝和 durable draft 保留                                                                                   |
| `npm run test:docs`                                     | 只读检查 Markdown 内部链接与规模；手写文档 >500 行提示、≥800 行失败，不强制生命周期元数据                                                                         |
| `npm run test:harness`                                  | 证明 deliberate failure 会非零退出                                                                                                                                |
| `npm run test:skill:visualizer-content-generator`       | 转调外部 skill 的 Brief V2 与封装测试；生成默认自主执行，正常交付附实际展示图                                                                                     |
| `npm run test:e2e`                                      | 稳定 Chrome 的全部当前 E2E                                                                                                                                        |
| `npm run test:e2e:m3`                                   | M3 应用、Worker、IndexedDB 和三格式 smoke                                                                                                                         |
| `npm run test:e2e:m4`                                   | M4 播放/队列/错误/资源回归及 60 秒计时                                                                                                                            |
| `npm run test:e2e:m5`                                   | Chrome 真实 IndexedDB/OPFS handle 的导入、刷新、current Blob、未知 schema 与清空                                                                                  |
| `npm run test:e2e:m6`                                   | Chrome 真实 module Worker、cache refresh、exact cursor、20 次资源循环和 15 分钟性能/取消                                                                          |
| `npm run test:e2e:m7`                                   | Chrome 21 固定卡/FIFO 兼容回归、共享 zoom/cursor、点击/键盘 seek、30Hz 合并、刷新恢复、DPR/视口与单卡错误隔离                                                     |
| `npm run test:e2e:m8`                                   | Chrome 390/1024/1280/1920、四卡/16 项、UI hardening、13 项 scalar renderer 与刷新恢复                                                                             |
| `npm run test:e2e:m9`                                   | Chrome Header 路由样式、四卡/19 项、Power/MFCC/Buffer renderer 与刷新恢复                                                                                         |
| `npm run test:e2e:m10`                                  | Chrome 四卡/21 项、Loudness/Complex renderer、完整 1024 bins、刷新恢复与 15 分钟四重卡性能                                                                        |
| `npm run test:e2e:m11:chrome`                           | Chrome 三格式/分析/恢复、键盘/焦点/reduced motion、多视口、quota 和 20 次 WebGL/RAF 生命周期                                                                      |
| `npm run test:e2e:m11:edge`                             | 使用真实 Edge 执行 M11 专项 hardening 场景                                                                                                                        |
| `npm run test:e2e:m11`                                  | 顺序执行真实 Chrome 与 Edge 的 M11 专项场景                                                                                                                       |
| `npm run test:e2e:m12:chrome`                           | Chrome 执行 Analyzer 单列行、说明折叠、renderer 隔离和 Observer 清理                                                                                              |
| `npm run test:e2e:m12:edge`                             | 使用真实 Edge 执行同一 Analyzer 单列/说明/资源专项套件                                                                                                            |
| `npm run test:e2e:m12`                                  | 顺序执行真实 Chrome 与 Edge 的 Analyzer 单列/说明/资源专项套件                                                                                                    |
| `npm run test:e2e:m13:chrome`                           | Chrome 执行 21 卡、懒挂载、FIFO、快速切换、V1 恢复和四视口专项                                                                                                    |
| `npm run test:e2e:m13:edge`                             | 使用真实 Edge 执行同一 M13 全卡/FIFO 专项套件                                                                                                                     |
| `npm run test:e2e:m13`                                  | 顺序执行真实 Chrome 与 Edge 的 M13 专项套件                                                                                                                       |
| `npm run test:e2e:e1`                                   | Chrome Header/播放列表入口、“去编辑”、MusicBar 显隐、JSON picker、草稿冲突和刷新恢复                                                                              |
| `npm run test:e2e:e2`                                   | Chrome 波形、seek、wheel/right-pan/menu、tempo boundary、输入边界、恢复与多视口 geometry                                                                          |
| `npm run test:e2e:e3`                                   | Chrome point lane/class、鼠标/键盘/右键标记、迁移对话框、可见 DOM、range 身份兼容与多视口 geometry                                                                |
| `npm run test:e2e:e4`                                   | Chrome 当前注册特征单选 overlay、六类 renderer、三手柄、pointer-through、错误隔离与多视口 geometry                                                                |
| `npm run test:e2e:e5`                                   | Chrome range 创建/预览/取消/端点/重叠/迁移、右键、键盘、overlay 穿透、恢复与多视口 geometry                                                                       |
| `npm run test:e2e:e6:chrome`                            | Chrome 三格式、工程失败隔离、10,000 事件、反馈/长任务、虚拟化、无障碍与 20 次资源循环                                                                             |
| `npm run test:e2e:e6:edge`                              | 使用真实 Edge 执行同一 E6 最终加固套件                                                                                                                            |
| `npm run test:e2e:e6`                                   | 顺序执行真实 Chrome 与 Edge 的 E6 最终加固套件                                                                                                                    |
| `npm run test:e2e:e7:chrome`                            | Chrome 执行双层工具栏、平面分区、30/44/152/144/88px 当前密度与多视口功能回归；E7 历史 176px 证据不改写                                                            |
| `npm run test:e2e:e7:edge`                              | 使用真实 Edge 执行同一 E7 紧凑工作台套件                                                                                                                          |
| `npm run test:e2e:e7`                                   | 顺序执行真实 Chrome 与 Edge 的 E7 紧凑工作台套件                                                                                                                  |
| `npm run test:e7:unit`                                  | E7 visibility/default/menu/active-set 纯逻辑                                                                                                                      |
| `npm run test:e7:integration`                           | E7 preference、刷新/导入、analysis 收敛与写失败                                                                                                                   |
| `npm run test:e8:unit`                                  | E8 时间轴垂直几何与 unavailable recovery 纯决策                                                                                                                   |
| `npm run test:e8:integration`                           | E8 同歌恢复、route generation 与草稿原子性                                                                                                                        |
| `npm run test:e2e:e8:chrome`                            | 使用真实 Chrome 执行 E8 四视口、同/异歌恢复与 marker 中心套件                                                                                                     |
| `npm run test:e2e:e8:edge`                              | 使用真实 Edge 执行同一 E8 可用性套件                                                                                                                              |
| `npm run test:e2e:e8`                                   | 顺序执行真实 Chrome 与 Edge 的 E8 可用性套件                                                                                                                      |
| `npm run test:e9:unit`                                  | E9 tempo boundary 删除、前段延伸、紧凑三级展示和 shared geometry                                                                                                  |
| `npm run test:e9:integration`                           | E9 JSON V1/autosave、event seconds、stale estimate 与 keyed draft/error cleanup                                                                                   |
| `npm run test:e2e:e9:chrome` / `test:e2e:e9:edge`       | 真实 Chrome/Edge 的 28px 合并 BPM 条、向上 guide、11px 无框输入、共享滚动、右键/键盘和 marker/category/divider 几何                                               |
| `npm run test:e2e:e9`                                   | 顺序执行真实 Chrome 与 Edge 的 E9 专项                                                                                                                            |
| `npm run test:e10:unit`                                 | E10 measure selection、半开收集、连续复制、ID 与原子冲突纯逻辑                                                                                                    |
| `npm run test:e10:integration`                          | E10 整批 autosave、刷新、JSON V1 round-trip 与模式外行为隔离                                                                                                      |
| `npm run test:e2e:e10:chrome` / `test:e2e:e10:edge`     | 真实 Chrome/Edge 的紧凑拍号、区间操作 pointer/键盘与深色离页 dialog                                                                                               |
| `npm run test:e2e:e10`                                  | 顺序执行真实 Chrome 与 Edge 的 E10 专项；环境阻断时只记 unverified                                                                                                |
| `npm run test:visualizer`                               | 当前 Project V5资源/分组 strict codec、原子组合/解析/渲染、会话、保存失败与异步失效，以及共享 host/离线导出专项                                                   |
| `npm run test:e2e:visualizer`                           | Chrome/Edge 当前元素工作区、布局、GPU 像素、全屏、离线编码、换歌/草稿保护、资源释放和保存取消；短 WebM 保留在本地 artifacts/visualizer-composition/               |
| `npm run test:e2e:visualizer-layout`                    | 顺序执行 Chrome/Edge 当前原子元素一屏工作台、双侧滚动隔离、compact drawer 与共享 scrollbar 专项                                                                   |
| `npm run test:e2e:edge`                                 | 使用真实 Edge 执行全部 M3–M11 E2E；缺失时明确 blocked                                                                                                             |
| `npm run build`                                         | TypeScript project build 和 Vite production build                                                                                                                 |
| `npm run eval:m3:provisional`                           | 在未提交工作树生成本地 provisional run                                                                                                                            |
| `npm run eval:m3`                                       | 只允许在干净 commit 上生成 canonical M3 run                                                                                                                       |
| `npm run eval:m4:provisional`                           | M3 回归 + M4 suite 的 dirty-worktree provisional run                                                                                                              |
| `npm run eval:m4`                                       | 只允许在干净 commit 上执行 M3 回归 + M4 suite 并生成 canonical run                                                                                                |
| `npm run eval:m5:provisional`                           | M3/M4 回归 + M5 repository/recovery/Chrome suite 的 dirty-worktree provisional run                                                                                |
| `npm run eval:m5`                                       | 只允许在干净 commit 上执行 M3–M5 suite 并生成 canonical run                                                                                                       |
| `npm run eval:m6:provisional`                           | 在 dirty worktree 执行 M3–M6 回归并生成本地实现反馈                                                                                                               |
| `npm run eval:m6`                                       | 只允许在干净 commit 上执行 M3–M6 suite 并生成可登记的 canonical run                                                                                               |
| `npm run eval:m7:provisional`                           | 在 dirty worktree 执行 M3–M7 回归并生成本地实现反馈                                                                                                               |
| `npm run eval:m7`                                       | 只允许在干净 commit 上执行 M3–M7 suite 并生成可登记的 canonical run                                                                                               |
| `npm run eval:m8:provisional`                           | 在 dirty worktree 执行 M3–M8 的 28 步回归并生成实现反馈                                                                                                           |
| `npm run eval:m8`                                       | 只允许在干净 commit 上执行 M3–M8 28 步 suite 并生成 canonical run                                                                                                 |
| `npm run eval:m9:provisional`                           | 在 dirty worktree 执行 M3–M9 的 32 步回归并生成实现反馈                                                                                                           |
| `npm run eval:m9`                                       | 只允许在干净 commit 上执行 M3–M9 32 步 suite 并生成 canonical run                                                                                                 |
| `npm run eval:m10:provisional`                          | 在 dirty worktree 执行 M3–M10 的 36 步回归并生成实现反馈                                                                                                          |
| `npm run eval:m10`                                      | 只允许在干净 commit 上执行 M3–M10 36 步 suite 并生成 canonical run                                                                                                |
| `npm run eval:m11:provisional`                          | 在 dirty worktree 执行 M3–M11 的 38 步双浏览器回归并生成实现反馈                                                                                                  |
| `npm run eval:m11`                                      | 只允许在干净 commit 上执行 M3–M11 38 步双浏览器 suite 并生成 canonical run                                                                                        |
| `npm run eval:m12:provisional`                          | 在 dirty worktree 执行 M12 unit/双浏览器与 M7–M11 相邻回归的 12 步实现反馈                                                                                        |
| `npm run eval:m12`                                      | 只允许在干净 commit 上执行 M12 12 步 suite 并生成 canonical run                                                                                                   |
| `npm run eval:m13:provisional`                          | 在 dirty worktree 执行 M13 与 M7–M12、Editor E7、双浏览器及构建的 17 步实现反馈                                                                                   |
| `npm run eval:m13`                                      | 只允许在干净 commit 上执行 M13 17 步 suite 并生成 canonical run                                                                                                   |
| `npm run eval:e1:provisional`                           | 在 dirty worktree 执行 E1 与 M3/M4/M6/M11 相邻回归并生成实现反馈                                                                                                  |
| `npm run eval:e1`                                       | 只允许在干净 commit 上执行 18 步 E1 canonical suite 并生成可登记证据                                                                                              |
| `npm run eval:e2:provisional`                           | 在 dirty worktree 执行 E2 与 E1/M3/M4/M6/M11 相邻回归并生成反馈                                                                                                   |
| `npm run eval:e2`                                       | 只允许在干净 commit 上执行 E2 canonical suite 并生成可登记证据                                                                                                    |
| `npm run eval:e3:provisional`                           | 在 dirty worktree 执行 E3 与 E1/E2/M3/M4/M6/M11 相邻回归并生成反馈                                                                                                |
| `npm run eval:e3`                                       | 只允许在干净 commit 上执行 E3 canonical suite 并生成可登记证据                                                                                                    |
| `npm run eval:e4:provisional`                           | 在 dirty worktree 执行 E4 与 E1–E3/Analyzer renderer 相邻回归并生成反馈                                                                                           |
| `npm run eval:e4`                                       | 只允许在干净 commit 上执行 31 步 E4 canonical suite 并生成可登记证据                                                                                              |
| `npm run eval:e5:provisional`                           | 在 dirty worktree 执行 E5 与 E1–E4/Analyzer 相邻回归并生成反馈                                                                                                    |
| `npm run eval:e5`                                       | 只允许在干净 commit 上执行 35 步 E5 canonical suite 并生成可登记证据                                                                                              |
| `npm run eval:e6:provisional`                           | 在 dirty worktree 执行 40 步 E6 双浏览器最终回归并生成实现反馈                                                                                                    |
| `npm run eval:e6`                                       | 只允许在干净 commit 上执行 40 步 E6 canonical suite 并生成可登记证据                                                                                              |
| `npm run eval:e7:provisional`                           | 在 dirty worktree 执行 46 步 E7 全屏浮层、密度、E6 基线和 M12 双浏览器回归                                                                                        |
| `npm run eval:e7`                                       | 只允许在干净 commit 上执行 46 步 E7 canonical suite 并生成可登记证据                                                                                              |
| `npm run eval:e8:provisional`                           | 在 dirty worktree 执行 25 步 E8 与 E1/E2/E3/E7、M5、双浏览器及静态回归，只生成 scoped artifact                                                                    |
| `npm run eval:e8`                                       | 只允许在干净 E8 implementation commit 上执行 25 步 canonical suite；dirty worktree 必须拒绝                                                                       |
| `npm run eval:e9:provisional`                           | 在 dirty worktree 执行 E8 25 步基线加 E9 四专项的 29 步实现反馈                                                                                                   |
| `npm run eval:e9`                                       | 只允许在干净 E9 implementation commit 上执行 29 步 canonical suite；DEC-052 revised canonical 已 29/29                                                            |
| `npm run eval:e10:provisional`                          | 在 dirty worktree 执行 E9 29 步基线加 E10 四专项的 33 步实现反馈                                                                                                  |
| `npm run eval:e10`                                      | 只允许在干净 E10 implementation commit 上执行 33 步 canonical suite；浏览器未验证时不得登记通过                                                                   |
| `npm run eval:editor-readiness:provisional`             | 在 dirty worktree 对固定 E9 runtime candidate 执行 24 步针对性 readiness 审计；只生成本地反馈                                                                     |
| `npm run eval:editor-readiness`                         | 只允许从 clean HEAD 执行 24 步 E4–E9/双浏览器/静态门禁，并要求相对 E9 implementation 的 `src/` 无漂移                                                             |

## 目录职责

- `tests/unit/`：纯函数与可控浏览器 API adapter。
- `tests/audio/`：M4 AudioEngine fake clock 与 AudioSessionService/store 集成。
- `tests/persistence/`：M5 原生 IndexedDB adapter、schema 和事务故障注入。
- `tests/worker/`：M3 harness、M6 基线、M8 scalar/Flux、M9 vector/waveform 与 M10 structured 产品 workerCore 合约测试。
- `tests/analysis/`：direct-Meyda extractor、committed golden、M6 platform、M7 viewport/学习、M8 scalar/Flux、M9 vector/waveform、M10 structured、置顶高度模型与 M13 FIFO/V1 adapter。
- `tests/fixtures/`：确定性生成器、短格式文件、许可、manifest 与重建校验。
- `tests/e2e/`：由 Playwright 对真实 Chrome/Edge channel 执行的浏览器场景；只有实际命令通过后才声明对应浏览器证据。
- `tests/docs/`：Markdown链接/规模检查，共用repo规则。
- `tests/harness/`：被正常 Vitest 配置排除的 deliberate failure 及其自检。
- `tests/scripts/`：浏览器检测和 M3–M14、Editor、Visualizer run orchestration。
- `tests/editor/`：Editor 工程格式、草稿、lease 和 session controller 的里程碑专项测试。
- `tests/visualizer/`：Project V5资源/分组 codec/引用、确定性元素合成、RendererHost、离线导出状态机与当前生命周期回归。

受控fixture、DEV bridge与oracle按各领域validation维护；历史逐阶段执行记录从evidence或Git查回，不作为当前UI规则。

## M5 原生权限人工检查

1. 启动 `npm run dev`，用最新版稳定 Chrome 打开 localhost。
2. 通过 MusicBar 的导入按钮在原生 picker 中选择两段支持范围内的本地音频；检查空队列自动播放、切歌和队列状态。
3. 刷新页面；检查当前歌曲从 0 秒 paused 恢复，其他歌曲分别显示浏览器实际返回的 granted/prompt/denied 状态，且启动过程没有主动弹权限。
4. 只通过“恢复访问”触发权限请求；拒绝后队列和当前 Blob 仍可用，允许后对应歌曲恢复。
5. 临时移动一段非当前音频并刷新，检查 `file-missing` 和“重新选择”；选择内容不同时检查 `content-changed`，再选择原内容恢复。
6. 可选导入超范围长音频观察大 Blob/quota 行为；只记录 best-effort 结果，不作为门禁通过或时长承诺。无法开始播放不是规定的预期结果；只有支持范围内音频复现或失败破坏其他会话能力时才作为缺陷调查。
7. 检查页面 console error/warn；记录浏览器版本、实际状态和手工 reviewer，不记录本地文件名、路径或 hash。

## Fixture 重建

1. 使用 Node 24.22.1。
2. 安装 FFmpeg 8.1.2，并确认存在 `pcm_s16le`、`libmp3lame` 和 `flac` encoder。
3. 运行 `npm run fixtures:generate`。
4. 运行 `npm run test:fixtures`，确认 manifest 中的 SHA-256 和实际文件一致。

生成器构造 48kHz、单声道、4 秒 Float32LE master，再生成 WAV、192kbps CBR MP3 和 FLAC。短 fixture 使用 `CC0-1.0`；15 分钟容量样本与学习 PCM 运行时生成，不进入 Git。

用户提供的音频默认仅本地使用，不复制进 fixture 目录。只有 `project-owner` 明确确认许可、provenance 和 hash 后，才能作为新的受控 manifest 条目。

`public/test_audio/` 保持 Git 忽略。本地约 15 分钟范围内样本仅用于原生文件选择与权限人工检查；超范围长音频只用于 best-effort quota/大 Blob 压力观察，不作为支持承诺、通过证据或 manifest 输入。版本化文档不得写入其文件名、路径、内容或 hash。

## Golden 更新

- `npm run fixtures:golden` 只比较，不写文件。
- `npm run fixtures:golden:update` 会重写 committed golden，必须先确认 Meyda、配置或生成器确有受批准的变化。
- `npm run fixtures:m7:golden` 只验证 L1/L2/L3 学习 golden identity；`fixtures:m7:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m8:golden` 验证 M8 scalar/Flux golden 并生成本地学习 WAV；`fixtures:m8:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m9:golden` 验证 M9 vector/waveform golden 并生成本地学习 WAV；`fixtures:m9:golden:update` 才写入版本化 JSON。
- `npm run fixtures:m10:golden` 验证 M10 structured golden 并生成本地学习 WAV；`fixtures:m10:golden:update` 才写入版本化 JSON。数值按固定 Meyda 容差（绝对 `1e-6`、相对 `1e-5`）比较，允许跨平台 ULP 级浮点差异；维度、键集与字符串/布尔/null 仍要求完全一致。
- 更新后必须审阅数值 diff，并重新运行 `test:analysis`；测试失败不得自动覆盖 golden。

## Evidence 与本地产物

日常反馈报告已运行命令、通过/失败/未运行及残余缺口即可，不新建阶段证据文件。明确正式评审时才固定clean implementation candidate，执行适用完整范围，记录run、真实环境、结果、summary/hash与必要人工结论；provisional不升级为canonical。

必要身份与批准集中在[Analyzer evidence](../docs/quality/evidence-index.md)、[Editor evidence](../docs/quality/editor/evidence-index.md)、[Visualizer evidence](../docs/quality/visualizer/evidence-index.md)及[processing evidence](../docs/quality/processing/evidence-index.md)。已结束的逐次实现反馈由Git查回，不在README重复维护。

原始日志、summary、trace、截图、长音频、WAV/WebM和模型保留在现有忽略目录与其原身份下；本次文档清理不删除或重算它们。fixture/golden/manifest仍由现有生成工具和独立oracle管理，不把Markdown当测试数据。Editor无效导入使用专用文本fixture。

用户歌曲、私有名称/路径/hash、歌词和许可不明二进制不得入库。fixture许可与来源继续核对；OS原生保存/权限、辅助技术、试听或真实GPU缺口如实记录，不能用stub/注入/合成结果替代。

## Editor 图表细节专项

`npx vitest run tests/worker/window-analysis.test.ts tests/analysis/window-requests.test.ts tests/editor/analysis-window-view.test.ts tests/editor/analysis-render-geometry.test.ts` 覆盖真实帧／PCM 峰值、时间坐标、防抖、预取及 stale／取消。

先运行 `npm run fixtures:e2:golden`，再运行 `npx playwright test tests/e2e/editor-analysis-detail.spec.ts --project=chrome --project=edge --workers=1`，检查图像内容的 15% 对齐、两处波形细化、连续缩放请求合并、播放预取、原生精度限制、高 DPR／响应式、迟到结果和刷新恢复。相邻图表类型与几何回归分别见 `e4-editor.spec.ts`、`editor-marker-redesign.spec.ts`；不据此重开历史 readiness。

`npx vitest run tests/analysis/pcm-source.test.ts tests/analysis/feature-cache.test.ts tests/analysis/streaming-series.test.ts tests/analysis/priority-tasks.test.ts tests/analysis/m6-coordinator.integration.test.ts` 检查单份 PCM、四项有界缓存、数值一致性、优先调度及同源 BPM 身份。`npx playwright test tests/e2e/analysis-loading.spec.ts --project=chrome --project=edge --workers=1` 在浏览器生成 180 秒 WAV，检查顶部波形先显示、精细窗口先于后台 BPM 返回，以及手动 BPM 不被迟到结果覆盖；`--repeat-each=3` 可采集各浏览器三轮局部耗时，不包含导入/解码。

启动现有 dev server 后，`node tests/scripts/measure-analysis-loading.mjs [baseline-commit]` 隔离比较 Git 基线与当前复制/Worker 计算，Chrome/Edge 各三轮、180 秒 48kHz 双声道、波形及四特征，并对 payload 按字段名排序后逐数组校验 SHA-256。默认基线为 DEC-108 前的 `5e7ae40`，`ANALYSIS_BENCHMARK_URL` 可覆盖默认 5173 地址；结果写入忽略目录 `artifacts/analysis-performance/comparison.json`。基线源码只读，不切分支或工作树，不包含整个页面首屏、解码或实际用户音频，不替代正式性能评审。

## osu 导入专项

`npx vitest run tests/editor/osu-import.test.ts tests/audio/prepared-local-audio.test.ts` 验证解析、时间映射与音频分阶段提交。先运行 `npm run fixtures:e2:golden` 生成测试 WAV，再运行 `npx playwright test tests/e2e/editor-osu-import.spec.ts --project=chrome --project=edge --workers=1`，验证预览／应用、音频与草稿保护、取消和恢复。构建后可加 `$env:PLAYWRIGHT_PREVIEW = '1'` 在生产包上运行同一专项。

设置 `$env:OSU_REFERENCE_ROOT = "<参考谱面根目录>"` 后，`npx vitest run tests/editor/osu-reference.test.ts` 遍历子目录中的 `.osu`／`.osz`，浏览器专项额外启用真实变速 mania 样本。外部谱面、音频和截图仅本地使用，不进入 fixture；没有环境变量时明确跳过依赖外部数据的用例。支持范围见 [osu 导入](../docs/architecture/editor/osu-import.md)。

## 外部 Visualizer 资源

资源专项从默认 `C:\Users\Ryan\Desktop\WheresYourElements\assets` 读取，使用 `$env:VISUALIZER_ASSETS_DIR = "<assets>"` 覆盖。`npm run visualizer:resources:check` 校验当前外部资源集合的源码封装与哈希；`npm run test:visualizer` 运行领域测试。缺少库时 Vitest 仅排除依赖资源的专项并明确提示，其他领域和纯逻辑测试照常运行。

`tests/visualizer/editor-markers.test.ts` 使用独立夹具验证 ABI 2 声明/查询与 V5 标记绑定，不依赖外部库。`tests/e2e/visualizer-editor-markers.spec.ts` 验证真实 Worker 权限、项目内选择/分类、恢复与短离线导出；配合 composition/sandbox 专项在 Chrome/Edge 执行。

`tests/visualizer/point-lines.test.ts` 从外部读取两种已批准直线元素，验证默认值、单分类、40/60/100ms 包络、5% 间距、分页及顶点分批。`tests/e2e/visualizer-point-lines.spec.ts` 检查真实 GPU 的全长、渐显、分类隔离、曲尾、密集批次及断库恢复/短导出；不把新增源码复制回应用测试夹具，既有几何 golden 保持不变。

`npx playwright test tests/e2e/visualizer-resource-directory.spec.ts tests/e2e/visualizer-resource-preview.spec.ts tests/e2e/visualizer-resources.spec.ts --project=chrome --project=edge --workers=1` 覆盖目录/预览/恢复、损坏刷新与 V5 独立恢复及短离线输出。SVG 专项核对嵌套路径、自动发现、渐变/滤镜/文字的实际像素、外部库元素/预设封面及脚本/外部引用拒绝。测试用真实 OPFS 句柄和 IndexedDB structured clone，picker/许可为替身；它不证明原生 OS 文件夹选择和磁盘授权 UI。原生人工检查需实际选择 assets、拒绝/恢复访问、关闭重开浏览器，并检查外部文件未被应用改写。

内容生成 skill 与专属测试仅在外部 `WheresYourElements/skill/visualizer-content-generator/` 维护。`VISUALIZER_SKILL_DIR` 可覆盖位置；上述 skill 测试及 `visualizer:resources` 命令按需加载外部脚本，缺失时明确报错，不阻断无关测试或普通应用构建。先在外部 skill 目录按其 lockfile 安装测试依赖，项目不保留 skill 副本。

## Circular Visualizer 媒体专项

运行 `npx playwright test tests/e2e/visualizer-circular.spec.ts --project=chrome --project=edge --workers=1`，覆盖独立元素、原版响应平滑、媒体导入和轮播、JSON／实时样式、四档离线视频及 file:// 壁纸。受控 PNG/WebP/JPEG、VP9 WebM 与 H.264 MP4 位于 tests/fixtures/visualizer-media；不含用户素材。输出保存在忽略的 artifacts/visualizer-composition/circular。单元测试见 media-contract.test.ts。外部 codec 用 visualizer:skill-codec:check 核对。

粒子还原专项：`npx vitest run tests/visualizer/circular-particles.test.ts` 使用保留MIT许可的原版粒子代码独立对照，正常测试不读取D盘原项目。`npx playwright test tests/e2e/visualizer-circular-particles.spec.ts --project=chrome --project=edge --workers=1` 检查真实Worker的30/60fps状态与几何一致、预设默认值、两档短视频及首页/展示恢复；粒子离线壁纸由 `visualizer-wallpaper.spec.ts` 覆盖。媒体留在忽略的 artifacts/visualizer-composition/circular-particles。

三维专项：`npx vitest run tests/visualizer/scene3d.test.ts`；`npx playwright test tests/e2e/visualizer-scene3d.spec.ts tests/e2e/visualizer-scene3d-editor.spec.ts tests/e2e/visualizer-scene3d-output.spec.ts --project=chrome --project=edge --workers=1`。覆盖 GPU 深度/裁剪、共享输入只读、关键帧与成员编辑、快照恢复、外部 ABI 4 示例和短视频。`visualizer-wallpaper.spec.ts` 同时验证原频谱和共享镜头示例的生产离线运行包。

## 歌词与反向纵深粒子

`npx vitest run tests/visualizer/lyrics.test.ts tests/visualizer/lyric-motion.test.ts tests/visualizer/circular-particles.test.ts` 覆盖解析／codec、双向顺序、毫秒锚点、突变低频的单向运动、30/60fps、seek/尺寸与原正向对照。lyrics.test 不依赖外部资源；lyric-motion 从外部包读取算法。`npx playwright test tests/e2e/visualizer-lyric-host.spec.ts tests/e2e/visualizer-lyrics.spec.ts tests/e2e/visualizer-circular-particles.spec.ts --project=chrome --project=edge --workers=1` 验证受控只读输入、图集多页及释放、正向字形像素、文件错误／旧任务、快照断库恢复与短 WebM。文件选择使用浏览器测试上传，不证明 OS picker 权限 UI；用户歌词不进入 fixture。
