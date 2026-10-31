# Web / Electron 双端与桌面实施

核查日期：2026-10-31。owner 已批准长期实施计划（DEC-111，原重复登记号 DEC-108 已更正），本文件是双端合同、Goal 里程碑与续作入口；实现和验证按阶段更新，不把计划写成现有能力。

## 目标与边界

- 完整保留现有 Chrome/Edge 网页端、开发和构建方式；新增 Windows x64 Electron 桌面端，共享 Vue UI、播放、分析、Editor、FT/自动标记、Visualizer 和工程 codec。
- 桌面目标覆盖现有主要功能：音频/工程/osu/媒体/歌词导入、资源库、用户预设、FT WAV、离线 WebM、实时样式、应用内展示页与 Wallpaper Engine 目录导出。
- 原生文件对话框及选定位置恢复；模型首次按需下载，固定版本/hash 校验后缓存，之后可离线使用。不上传用户音频、不接账户或云同步。
- 最小化继续播放和任务；普通关闭退出，未保存修改/进行中任务需确认，确认后取消任务、落盘并释放资源。单实例重复启动聚焦已有窗口。
- 交付未签名、按用户安装的 Windows x64 NSIS 本地安装包。升级保留数据，卸载保留用户数据及外部文件。不含签名、公开发布、自动更新、托盘、开机启动、文件关联、系统 URL 协议注册、macOS/Linux。
- 桌面支持须有本机系统/GPU/版本和实际安装包证据；不会由 Chrome/Edge 历史结果自动获得。既有质量、性能、工程及隐私边界保持，PROD-015 的生产发布限制未撤销。

## 架构合同

共享领域 → 平台端口 → Web 或 Electron 实现；不复制两套业务代码。

- `src/platform/` 集中共享端口与双端适配，入口注入实现；组件/领域不导入 Node/Electron API，也不各自探测宿主。
- `electron/` 承担主进程、preload、原生文件授权及生命周期。主进程与 preload 分别构建，preload 为单文件 CommonJS；Node/Electron 能力不进入网页依赖图。
- 开发模式连接 Vite，安装版通过固定 `app://audiosurf/` 加载本地网页产物。注册标准、安全、支持 Fetch 的协议；history 页面使用 SPA fallback，缺失静态文件真实报错，正确提供 Worker/WASM/runtime MIME。
- 保持 `nodeIntegration: false`、`contextIsolation: true`、`sandbox: true`，子框架/Worker 无 Node 集成。IPC 只公开具体功能，校验窗口/frame/来源/参数。DEC-109 明确批准宿主 `script-src` 增加 `blob:`，使 Worker 动态导入算法模块通过继承策略；宿主也获得执行 blob 模块的能力。算法 iframe 的 opaque origin、nonce/blob 脚本和 `connect-src 'none'` 保持，其他隔离与权限不变。
- 模型连接沿用固定 Hugging Face/CDN 来源；DEC-110 另批准宿主 connect-src 中的 Basic Pitch 单文件 URL（固定 revision/路径），不放开整个 GitHub origin。其他 revision/文件路径仍拒绝；算法子层依然禁止网络。模型完整 bytes/hash 校验、后端及许可不变。
- 音频来源和目录采用平台引用与端口操作；浏览器句柄仅由 Web 实现持有。主进程保存用户明确选择的路径与授权，renderer 使用不透明引用；不伪造浏览器句柄、不把含方法对象跨 IPC 持久化。
- 大文件流式读取、分块写入并等待背压；失败/取消不覆盖已有有效文件，临时文件按所有者清理。资源库加载只读；显式预设导出仅新增唯一预设目录；壁纸只写入本次新建目录。
- 单文件保存的异常恢复只由主进程日志授权，记录确认过的临时文件路径、父目录/文件身份、stat 和增量 SHA-256。userData 下 `native-save-journal` 使用两个 V1/checksum/sequence 槽交替写入并 sync；不增加独立元数据临时文件。重启只检查记录中的精确路径，全部核对后逐个 unlink，不扫描选定目录，不接触已发布目标；正常提交/取消清除记录。写入中未确认 bytes、登记前残留、外部改动、链接替换或无法核对者保留；损坏/保留通过原生提示报告。没有有效日志槽时拒绝新增单文件保存，避免静默失去清理依据；此机制不宣称断电恢复保证。
- 目录事务由独立 `native-bundle-journal` 记录临时根、父目录/source 身份、合同清单、已完成文件的 stat/源 bytes 摘要；两类日志共用 `NativeJournalStore` 的同版双槽持久化，单文件 V1 字段与载体保持。进行中的子文件复用单文件日志，重启先恢复子文件再核对目录；外部新增/修改、根或 source 被替换时保留目录。清理先验证全部现存文件，再持久化 cleaning 标记，逐文件 unlink、逐空目录 rmdir；已标记清理允许先前移除的自有文件缺失，未标记时缺失视为变化。完成发布后只清除日志，不追踪改名后的目标；不递归删除，不扫描或删除未登记目录。发布子文件与目录日志确认之间的未确认窗口仍保守保留。
- IndexedDB/OPFS 先复用既有实现，固定 userData/session/origin。原生路径记录由主进程管理；Pinia 不保存 File/handle/PCM/Worker。Web 既有数据库/草稿恢复不破坏，桌面数据独立；两端通过现有工程文件交换，不扫描浏览器 profile。
- 保留工程格式与内嵌资源快照、单 engine/clock/renderer、Worker 数量/所有权、取消和 stale identity。文件移动/删除/内容变化明确提示重新选择，不以旧缓存掩盖身份变化。
- 桌面展示页在应用内打开；Web 保留现有地址行为，桌面不提供无法在外部浏览器使用的网页地址复制入口。
- Electron 与 electron-builder 使用实施时受支持的稳定版并锁定精确版本及 lockfile；能力验证后冻结。网页输出位置保留，桌面 staging/安装包放在独立忽略产物目录；打包仅包含运行必需代码、runtime、图标及许可，不含开发 fixture、用户文件、模型缓存或外部资源库。

## Goal 里程碑

Goal 于 2026-10-29 启动，2026-10-31 按批准的本地交付范围完成；各小目标依次验证并分别本地提交，不推送或发布。后续修改继续遵守双端合同，历史阶段证据不外推为其他机器或正式 readiness。

| 阶段 | 交付及验收 | 当前状态 |
| --- | --- | --- |
| D0 双端合同/基线 | AGENTS、六个项目 skills、相关文档同步；记录 Web 基线及独立缺口 | 完成：文档/仓库检查、Web 类型与构建通过 |
| D1 宿主/能力 | 独立开发/打包入口、安全协议/路由/runtime；真实 ORT、WebGPU、OPFS、算法隔离及短片 WebCodecs | 基础宿主/能力完成：开发、应用目录及 ASAR、算法动态模块隔离、ORT GPU 算术、硬件 WebGPU、OPFS 重启及短片编码通过；封装 WebM 短矩阵也通过 |
| D2 端口/恢复 | 原生音频选择、来源引用、队列/资源目录恢复；Web 数据兼容，覆盖缺失/变化/权限/stale | 当前本机场景通过：真实 WAV 与资源库目录选择；ASAR 三格式播放、队列/草稿/资源目录重启、变化/缺失拒绝旧 Blob 及权限边界通过 |
| D3 文件交互 | 工程/osu/媒体/歌词、FT WAV、视频、预设/壁纸读写；原生保存/取消/失败/大文件清理 | 当前本机场景通过：真实 Editor JSON 保存、预设确认及壁纸目录选择/落盘；ASAR 工程回读、osu/osz、三图片/两视频/LRC、素材移走后恢复、分块写入/取消、WebM 保存取消重试及实际 FT WAV 通过；人工分段证据见下文，不冒称完整目录 run 通过 |
| D4 功能对齐 | 打包环境实际验证主要页面、模型、三维/实时/离线输出；Web 邻接回归 | ASAR 资源/四档短媒体、十五分钟 1080p60 长片、FT 四图和自动标记五输入、缓存离线推断/试听/取消/损坏保护通过；对应短输入与 Chrome/Edge 输出一致。三维/主要素材编辑与实际输出、首页样式及应用内展示/全屏/恢复通过；页面邻接与最终回归见 D7 |
| D5 生命周期 | 退出保护、任务/资源清理、草稿落盘、最小化、窗口位置恢复、单实例 | 当前本机场景通过：ASAR 修改/写失败重试、FT/活动 WebM/ready 输出/原生保存退出、最小化期间播放/FT/WebM 继续、普通/最大化恢复、单实例及单文件/目录异常恢复；真实继续工作与退出 UI 分别验证，证据边界见下文 |
| D6 安装升级 | 产品身份/图标/许可，按用户 NSIS 安装、启动、升级保留数据和卸载保留用户文件 | 当前本机范围完成：实际每用户安装、0.0.0→0.0.1 同实现夹具升级、默认数据保留，独立 profile 工程/八模型/结果读取、升级后离线重算及卸载后再读取通过；不证明未来 schema 迁移 |
| D7 双端收口 | 双端构建/适用回归/产物检查，文档与 skills 一致，安装包及校验信息交付 | 完成：双端构建/最终 NSIS、107 宿主测试、Chrome/Edge 首轮 56 项及修复后 12 项 Editor 回归、新 ASAR 页面/安全与产物一致性通过；最终新包安装升级保留/卸载后读取、最小化任务通过，普通目录安装器与校验文件已交付 |

D0–D7 已按本机范围完成；下文按阶段保留失败、部分结果及最终通过身份，不把早期“待验证”当作当前阶段状态。原先原生异常来自项目目录 Low Integrity 继承，开发/验证及交付均使用校验后的普通用户目录副本。不增加静默 fallback；能力不支持时保留明确错误和现有人工路径。

## 验证与续作

- 基线：开始工作树/暂存区干净，分支 `codex-design-remake`，既有实现 commit `5c3e014`。Node 24.22.1/npm 11.19.1；本次 Web 类型、文档及仓库检查通过。Web 生产构建通过（沙箱外、项目内 TEMP/TMP，避开上级目录/系统临时目录访问限制）；保留既有大 chunk、Browserslist 提示。产品行为尚未重测。
- 文档/skill 修改只运行适用文档与仓库检查，不要求未落地桌面的产品测试。共享代码变化覆盖 Web Chrome/Edge 与 Electron 的适用场景；单端改动说明另一端不受影响的依据。
- 平台接口/IPC 测试覆盖未授权来源、路径越界、权限、序列化、取消、迟到结果和资源释放；构建检查网页产物不依赖 Node/Electron。
- Playwright 增加独立 Electron 入口，区分开发与打包模式；真实浏览器沿用现有 runner。原生 OS 对话框、安装/升级、试听和 GPU/媒体必须真实验证，stub 不替代。
- 固定 FT/自动标记模型实际下载/校验/推断，检查缓存离线使用、换歌/取消和释放；WebM 覆盖四档、帧数/PTS/音画同步及长任务，沿用有效阈值。DEC-074 已接受的当前听感/耗时不重设为新门槛。
- 续作先核对当前 Goal、阶段、工作树和最新用户指令，从已验证位置继续。每小目标完成格式化/适用检查、文档同步、`skills:install`、`codemap`、`repo:check` 与 diff 审阅后本地提交；工具变化补 `test:tools`，打包变化补双端构建。
- 只记录当前阶段、必要结果、提交及下一步；不生成阶段三件套或例行正式 readiness。外部输入只阻断依赖项，继续独立工作；未验证/失败不得记为通过，不提前标记 Goal 完成。
- D0 提交 `14bb696`。D1 锁定 Electron 45.1.0、electron-builder 26.18.1；宿主/网页类型检查、独立桌面构建及未安装应用目录打包、2 项资源边界和 59 项工具测试通过；Chrome 6 项原有冒烟回归通过。新增宿主地图、独立 staging、受限应用协议和只读宿主标识；尚未接原生文件接口。
- D1 环境：Windows 11 家庭中文版 10.0.22631 x64。运行库镜像下载后由安装器校验；独立下载 ZIP 的 SHA-256 为 `55eaba17abff7b5bba6c3bbc85068967379024fe742fe9c7fdba9118922ccbe2`，与 npm 包内官方 checksum 一致。官方直连首次失败，镜像传输不改变版本/bytes。
- D1 最初的 `0x80000003` 在开发/打包、最小 main、隔离 userData/TEMP、禁用 GPU 和独立 44.10.0 均复现，Node 模式可用；未替换项目版本。同版符号将 RVA `0x344c64a` 定位到 Chromium `sandbox/policy/sandbox.cc:71` 的 `Sandbox::Initialize`，返回 12（`SBOX_ERROR_CANNOT_CREATE_WINSTATION`）及 LastError 5。现已定位：受管项目根及 EXE 继承 Low Integrity，导致可执行文件降级运行；普通桌面双击同样受影响。并非业务 main 或 SmartScreen 提示已证明的故障，也不据此归因于 GPU。下面普通目录对照、安装及能力测试已解开此阻断；始终保留 sandbox，真实模型和封装媒体仍待验证。
- 打包资源由明确白名单复制，关闭 Vite 自动 public 复制并排除 node_modules；已发现并修复 public/audios 随包复制问题，源文件保留，重新生成后实际 ASAR 检查不含用户音频、测试音频、模型权重或开发依赖。D6 产品图标与 NSIS 进展见下文。
- npm audit 当前树报告 15 项（6 high），列名不含 Electron/electron-builder；未自动升级既有 Vue/Vite/Meyda 等依赖。后续按实际适用性审阅，不能视作发布安全通过。
- D1 宿主基础提交 `5b78df9`。D2 原生只读授权保存在主进程 userData；preload 只公开选音频/资源目录、描述、权限及受限目录读取。读取端点校验 Electron 的 initiatorOrigin，IPC 同时校验窗口、主 frame token 和 origin；路径规范化/realpath 防止越界与 junction 扩权。目录子文件复用目录授权，撤销后不遗留独立子授权。
- D2 原生基础提交 `79e72ff`。应用入口与 MainLayout 已注入音频端口，service 通过不透明引用读文件和查询权限，既有 IndexedDB V1 载体未改。桌面有持久化来源时跳过旧 Blob，实际源缺失、变化或引用丢失明确不可用；无外部来源的内嵌 File 保留 Blob 恢复。慢选择、清空/销毁和初始化期间较新的播放操作有失效保护。
- D2 当前宿主/Web 类型、Web 构建、110 项相关单元/集成通过（含 14 项原生基础及新增桌面恢复/取消竞争）；末次异步保护及错误传播修正后，针对性 32 项与桌面生产构建再次通过。真实 Chrome/Edge 的 V1 队列/Blob/未知 schema 恢复各 3 项通过。原生对话框、协议、实际桌面队列恢复仍未验证，不以注入端口或模拟 IPC 代替。
- owner 原生结果：双击未安装应用出现 SmartScreen 未知发布者提示，选择继续运行后仍未打开窗口；确认正常桌面会话也无法启动，未要求更改系统安全设置。该结果不证明 SmartScreen 是原生异常的根因，签名仍不在本次范围。
- D2 音频接入提交 `4ec3329`；资源目录现经注入的只读端口选择、列举和读取，目录 IDB 的 V1/key 保留，Web 存原始句柄、Electron 存纯数据引用。共享资源校验及封面读取不调用具体句柄方法，取消/失败保留可用库；D3 的写入进展见下文。
- D2 目录阶段：双端类型/生产构建、41 项目录/原生边界/预设单元集成及文档/仓库检查通过；Chrome/Edge 的目录加载/恢复/异常、封面和预设保存各 10 项通过。原生引用跨主进程授权存储/IDB 恢复、相对路径、取消及缺失/撤权由单元/集成覆盖，不替代实际 OS 对话框。独立探针能够按 Chromium 相同请求权限创建并立即关闭自己的临时 window station，未更改系统设置，故系统资源耗尽并未得到证实。
- D2 目录接入提交 `662f8b5`。D3 独立文件基础已接入 Editor/Visualizer 工程与 WebM gateway，Web 继续 picker，桌面主进程限定用途/窗口/frame/来源，保存对话框仅接收建议文件名，路径不由 renderer 提供。工程读取使用临时授权并在读完后释放，不扩大持久化路径记录。
- 原生保存事务使用选定目录中的独占 `.audiosurf-<UUID>.tmp`；每块最多 1 MiB，逐块确认、拒绝并发写及不完整提交，完整同步后 rename 发布；取消/失败只清理本次文件，目标外部变化/符号链接明确拒绝。原子发布已开始时不撤销成功提交；这是传输分块界限，不是支持文件大小或性能预算变化。导航/renderer 崩溃触发清理，但宿主退出等待、进程异常退出后的遗留处理仍待 D5。
- Editor 旧工程选择在新选择、编辑、离页或销毁后失效，导出完成不会清除保存期间的新修改提醒；这些共享保护有针对性测试，工程 codec/schema 未变。真实原生文件对话框和运行能力仍未验证。
- D3 文件基础验证：72 项相关单元/集成、Web/Electron 类型及生产构建通过。真实 Chrome/Edge 的工程传递、Editor 和 WebM 相邻回归各 13 项通过、各 4 项显式长矩阵未开启；Editor 竞争修正后 Chrome 受影响 5 项再次通过。未借此宣称桌面编码或四档长任务通过。
- 2026-10-29 普通桌面启动对照：经现有桌面 Shell 启动的独立最小 Electron 子进程仍以 `0x80000003` 退出，未写 main 入口日志；不依赖资源管理器文件夹窗口，不变更系统设置。此结果进一步排除了仅自动化父进程启动方式所致的假设，但具体访问拒绝来源仍未知；owner 的纯 Electron 欢迎窗口结果尚未收到。
- D3 文件基础提交 `0433b4a`。集中平台控件现已接入图片/视频、LRC 与预设封面，Web 继续 HTML 上传，桌面使用按用途限定的临时多选授权，成功/失败均释放全部引用；身份/锁定/卸载取消旧读取。osu 源一次性读取，另选音频保留来源引用，扩展过滤不改变普通音频支持范围。FT WAV 在桌面按当前结果身份读取 Blob，再复用分块保存；Web 保留原下载链接。
- 2026-10-30 最小 Electron 探针仍以 `0x80000003` 退出。FT 页面按要求正常格式化后为 1374 行，超过推荐/警告阈值但未越过 2000 行阻断；已审阅职责，上传/下载平台交互独立在 `components/platform/`，未压缩排版或增加规模豁免。
- 输入/WAV 阶段验证：59 项原生边界/文件端口/osu/FT 单元集成通过；真实 Chrome/Edge 各 9 项上传/恢复/FT 业务流程及各 2 项注入端口的控件竞争测试通过，Chrome 的 LRC 锁定取消再测通过。Web/Electron 类型与生产构建、文档/仓库检查通过；控件测试由浏览器托管，不是桌面原生对话框、模型或实际 WAV 保存证据。
- 输入/WAV 阶段提交 `2753d91`。目录导出通过 `DirectoryExportAccess` 注入，保留共享预设依赖校验与壁纸五文件格式。Web 继续原有句柄写权限/目录选择；桌面只读库授权不自动获得写权限，须由原生确认授权本次 `presets/<唯一 ID>`，并拒绝目录联接重定向；壁纸位置由原生目录对话框选择。
- 原生目录事务限定精确文件清单与顺序，逐文件复用 1 MiB 分块确认，在同目录临时文件夹完成后整体 rename。既有目标、被替换路径或外部改动拒绝发布；取消仅删除本次已跟踪且身份未变的文件，不递归删除外部新增内容，无法清理明确报错。导航/renderer 崩溃触发清理；退出等待与异常退出遗留处理仍待 D5，实际 OS 保存未验证。
- 目录回归定位并修复共享媒体输入竞争：同 ID 的定义对象刷新曾误取消正在读取的素材；现按实际身份/锁定/工程修订比较，保留真正换源取消。测试先等待素材绑定再导出，避免无关渲染更新掩盖缺失媒体。
- 目录阶段验证：62 项原生边界/目录事务/双端端口与预设/壁纸单元集成、Web/Electron 类型及生产构建通过；真实 Chrome/Edge 各 5 项目录业务回归和各 1 项媒体竞争测试通过，含五文件壁纸 file:// 渲染。格式、文档和仓库检查通过；原生 IPC 替身与真实临时文件测试不等于 Electron 对话框或退出验证。
- 目录阶段提交 `94e63b2`。D4 展示页经 `DisplayPageAccess` 提供地址策略：Web 保留本地地址和复制，Electron 仅显示应用内相对路由及打开入口，不创建外部浏览器不可用的地址。样式 ID、快照、IndexedDB 和渲染流程不变。
- 展示策略验证：Web 类型检查与格式检查通过；Chrome/Edge 各 5 项既有弹窗/复制/取消回归和各 1 项应用内展示策略测试通过，确认快照可保存并沿相对路由渲染。桌面策略测试由浏览器托管，不是 Electron 协议或打包运行证据。
- 展示策略提交 `2095755`。D5 原生保存/目录事务现在跟踪尚未登记临时对象的初始化任务，取消/销毁会等待其失败清理；预设 source 初始化纳入事务操作，避免清理抢先移除目录。导航清理仅取消旧代，新页面事务继续有效。改动限 `electron/files/`，Web 不依赖这些宿主模块。
- 初始化清理阶段的 54 项原生单元/集成（含 4 项新竞争用例）、宿主类型、桌面生产构建及格式/文档/仓库检查通过；它只证明事务管理器的等待边界。后续正常关闭握手见下文，崩溃遗留处理仍未完成，实际原生退出尚未验证。
- 初始化清理提交 `770c39f`。窗口偏好以独立 V1 JSON 保存在 userData，只含普通 bounds 和最大化标记；移动/调整结束及关闭时同步原子保存，最小化/全屏不覆盖普通状态。恢复按当前显示器工作区限制位置/尺寸，显示器移除后保持窗口可见；最小尺寸沿用 1024×640，缺失/损坏偏好采用默认位置，损坏有日志且不删除其他数据。最大化在 ready-to-show 后应用。
- 窗口阶段验证：57 项宿主测试通过，含 3 项真实临时偏好文件/窗口事件替身用例；宿主类型、桌面生产构建及格式/文档/仓库检查通过。逻辑覆盖负坐标显示器、移除/缩小、损坏偏好及监听释放；这些不是本机实际窗口恢复证据。改动仅在 Electron 宿主，Web 不读取窗口偏好。
- 窗口阶段提交 `821f782`。文件 IPC 现在共用 `NativeIpcTasks` 生命周期，可暂停新请求并等待已发起请求结束；导航递增代次。音频与资源库选择同一次性输入一样重新核对窗口/frame/origin/代次，迟到对话框不得为新页面返回授权引用或覆盖新状态。授权存储提供等待串行写入的 flush；此阶段尚未把暂停/排空接到最终关闭握手。
- IPC 生命周期阶段的 62 项宿主测试（新增暂停/排空、迟到选择与授权落盘用例）、宿主类型、桌面生产构建及格式/文档/仓库检查通过。改动限 Electron 文件/宿主模块，Web 依赖图与存储行为不变；实际原生选择、关闭和安装仍未验证。
- IPC 生命周期提交 `8acafdb`。D5 关闭由主进程协调固定的 inspect/prepare/dispose/resume 阶段，正常关闭与应用退出共用单次流程；未导出 Editor 修改、待保存草稿、进行中任务、ready WebM 或原生文件操作需原生确认。页面未响应时另行提示可能丢失内存修改，只有用户明确选择退出才继续；不会因检查超时自动销毁窗口。
- MainLayout 经生命周期端口注册唯一运行时，Web 保留原 beforeunload。确认后锁定界面，失效旧输入/tempo/导出任务，先落盘候选修正再取消 FT/自动标记，排空会话事务并保存两种工程草稿与会话；准备失败恢复编辑，保留当前工程和 ready 输出。原生暂停新 IO 但允许释放/abort，等待事务与授权写入；已拒绝且未发布引用的选择不阻断退出。全部确认后按所有权释放服务、卸载 Vue，再销毁窗口。
- 生命周期 IPC 校验主窗口/frame/origin、请求 ID 和结果结构；新文档、renderer 崩溃或重新注册使旧请求失效。准备/文件收尾失败不关闭窗口；销毁阶段失败保留窗口并报告，不能记为正常退出。自动标记清缓存也纳入等待，避免销毁提前返回。仅正常关闭流程已接入，异常进程退出遗留仍待处理。
- 关闭阶段单元/集成覆盖 169 项、25 个文件；Chrome/Edge 各 3 项关闭场景、6 项播放快捷键及 4 项普通 Web 相邻回归通过，覆盖真实草稿、保存失败恢复及 FT 下载取消。捕获阶段播放快捷键显式遵守收尾锁，避免退出中重新播放。双端类型、生产构建、格式/文档/仓库检查通过；协议替身和浏览器托管共享应用不等于 Electron 或原生对话框证据。恢复 Goal 后最小 Electron 探针仍在进入 main 前以 `0x80000003` 退出。
- 关闭阶段提交 `1671c92`。D6 沿用产品名 AudioNotSurfYet、应用 ID `local.audionotsurfyet.desktop` 和仓库版本 0.0.0；主进程设置同一 AppUserModelID。`electron/assets/icon.svg` 复用现有 nav-home 唱片标记，builder 转换并写入 EXE；Windows `signExecutable:false` 明确关闭应用与安装器签名，仍编辑图标和版本资源，不依赖机器证书或签名凭据。
- 安装器保持 oneClick、perMachine:false、deleteAppDataOnUninstall:false，关闭安装后自动运行；不新增文件关联、协议注册、更新器或发布。`desktop:package` 对最终 EXE 产物生成流式 SHA-256 旁文件。图标工具 Node 下载曾超时，PowerShell 从官方地址下载后与安装版工具的固定 SHA-256 一致再放入预期缓存，未更换版本或跳过校验。
- D6 包检查：安装器和应用 EXE 的 Authenticode 均为 NotSigned，产品名/版本及实际 EXE 图标已核对；当前 ASAR 共 50 条目、48,350,096 bytes，含宿主/preload/renderer/第三方声明，无 node_modules、用户/测试音频、测试宿主或模型权重。目录恢复实现后重建安装器 129,142,285 bytes，SHA-256 为 `d3bb672127e0dbf1147675151043ec750467426ef45073881b396a9d406814f4`，自动旁文件与实算一致。0.0.0 是本地实施产物，不是发布；生产和升级夹具共用 `scripts/lib/desktop-package.mjs`。
- 原生目录对照：同字节 NSIS 探针在项目目录以完整性 RID 4096（Low）运行，独立 HKCU 写入及直接 Win32 API 均失败（返回 5）；复制到普通用户目录后 RID 8192（Medium）、写入/读取/自身标记清理成功。流式新副本和普通 `Copy-Item` 均验证，源/目标 SHA-256 相同；只读 ACL 显示项目继承 Low 标签、普通用户目录无此标签。不修改 ACL/标签、系统安全设置或 Electron sandbox。构建仍用项目 TEMP；原生安装/卸载使用普通目录 TEMP，防止临时卸载器也降为 Low。
- `test:desktop:install` 的真实结果在忽略目录 `artifacts/desktop/install-verification/54b6e587-10e0-4ff6-9cda-227b3a46441c/`。先备份原有 81 文件、4,182,391 bytes；同字节安装器在 `%LOCALAPPDATA%/AudioNotSurfYet-GoalSmoke/<ID>` 实际按用户安装到含空格的独占目录。HKCU 注册、桌面/开始菜单快捷方式、安装 payload hash/版本/NotSigned 通过，安装版显示共享主界面并确认 sandbox/contextIsolation=true、nodeIntegration=false，实际截图已核对。
- 仅临时 ASAR 夹具版本改为 0.0.1，仓库及交付包保持 0.0.0。真实升级和卸载后原有文件、空目录、专属标记及外部文件逐一核对通过；卸载注册/快捷方式/安装目录已移除，专属用户数据标记随后删除，原始 81 文件保持一致。65 项工具测试、Web/Electron 类型/生产构建及独立打包通过；安装验证只证明物理保留，尚不证明既有工程数据库/真实模型缓存升级后可读。
- 安装基础阶段提交 `c6062ed`。开发/能力测试现通过 `scripts/lib/desktop-native-runtime.mjs` 创建普通用户目录内的独占副本并逐文件校验，隔离原生 TEMP；不改变项目 ACL/标签或产品沙箱。成功结束后核对完整文件集/内容再逐文件清理，变化、junction 或外来文件会使清理拒绝并保留副本。测试 profile/日志按 run 留存；Web 依赖图与产品工程/推理逻辑未改。
- D1 实测：Windows 11 10.0.22631 x64，Electron 45.1.0/Chromium 156.0.8078.49，硬件适配器为 NVIDIA Lovelace，设备清单含 RTX 4060 Laptop GPU、驱动 32.0.15.9186。应用目录 run `smoke-application-29c8db71-4541-446e-82b4-c1f209d35c9a`、ASAR run `smoke-packaged-dcb94d60-b29c-4133-8424-023f2428543c` 均通过：secure app 协议、主要路由、缺失静态资源 404、Web Locks、OPFS 写入和真实重启读取；iframe/Worker 为 opaque origin 且无 Node/桥，主窗口 sandbox/contextIsolation=true、Node/Worker Node=false。
- 锁定 ORT 的 WebGPU provider 实际运行项目生成的 float32 加法 ONNX 图，得到 `[3,5,7,9]`；只指定 webgpu，未尝试 CPU。分别编码 VP9/VP8 各 3 帧，PTS 均为 `[0,33333,66667]` μs，Opus 产生 6 块；WebGL2 可创建。生产主界面截图已核对。证据在 `artifacts/desktop/capabilities/<run>/`；这不是 FT/自动标记真实模型、封装视频或质量验收。
- 开发命令 run `development-check-bbf90b36-d444-4a35-89e2-f4a657623875` 通过：实际启动 `desktop.mjs dev --inspect-browser`，临时 inspector 只监听 localhost；普通开发命令不开放该端口。Vite/Electron 桥、无 Node 全局、Editor 路由及空工作区 `window.close()` 通过，进程退出 0 后执行副本已清理。隐藏 profile 的开发截图曾超时，已关闭当时仍存活的窗口后再测试；开发专项不宣称视觉证据，图像来自生产入口。此改动只影响桌面开发/验证工具，不改变 Web 页面或发布包源代码；本轮双端类型/生产构建和 69 项工具测试通过。
- 能力/开发阶段提交 `261a54f`。文件集成 `test:desktop:files` 的实际 ASAR run `files-8499936a-3331-4c88-ac57-bd8fd35989d1` 通过 13 项检查：三格式逐首播放；未知引用/用途拒绝、已知读取 URL 对实际 null-origin/无 Node 渲染窗口不可读、一次性输入授权释放；Editor JSON 取消/中文路径保存与 Visualizer 完整快照传递；2 MiB+37 bytes 逐块提交及取消保留原目标且无临时文件。系统对话框选值为替身，字节夹具不代表有效 WebM。
- 同一 ASAR/profile 实际重启恢复队列、Editor 草稿并 paused/0 秒，启动没有重新弹选择器；确认 current Blob 存在后改变源 bytes 或移走源文件，均保持不可播放及 content-changed/file-missing，恢复原 bytes 后可重新加载。全程使用独占文件副本，未改用户源文件；正常路径无 page/console error。结果和项目传递截图在 `artifacts/desktop/files/<run>/`。此阶段仅添加测试/命令与文档，Web、领域实现和工程格式未改，不重复无关产品构建。
- 真实原生操作 run `manual-files-2879996f-0555-4e3d-a6a7-0d77f29c6d84` 已由 owner 实际点击打开/保存并回复完成；原生函数只预填独占夹具/位置，未替换结果。完成计数各 1、WAV 播放、磁盘 Editor V2/一条点轨道及导出 hash 与源一致均已核对，实际截图已检查，测试进程退出 0。Windows Computer Use 的 native pipe 不可用（os error 2），此项由人工完成；资源目录等尚未得到同类证据。整理后的复跑入口为 `test:desktop:dialogs:manual`，结果在 `artifacts/desktop/manual-files/<run>/`。
- 文件与人工阶段提交 `f51bb2f`。资源专项先在旧 ASAR 复现 `Failed to fetch dynamically imported module: blob:null/...`，是宿主 CSP 阻止 Worker 的 blob 模块导入；基础 postMessage 成功不足以覆盖算法链。经 owner 明确批准 DEC-109 后仅宿主 script-src 增加 blob:，子层策略/Node/网络边界未变，已重建 NSIS；Web 不依赖此 Electron 宿主规则。
- CSP 修复后的实际 ASAR run `smoke-packaged-13cade89-a7bc-41a4-ae60-30d1ed43eebb` 通过原能力检查及新增 Worker 动态导入，得到 moduleValue=7、origin=null、Node/process/桥均 undefined，主窗口 sandbox/contextIsolation=true、Node/Worker Node=false。资源 run `resources-f9347145-d569-4884-9d4a-28fb885336b9` 通过 5 项：28 元素及全部封面实际加载、环形频谱渲染、预设取消/保存/刷新且工程不变、壁纸五文件落盘、重启目录恢复及既有资源 hash 不变；无 page/console error，实际截图已核对。两项证据在各自 capabilities/resources 目录；目录选值和写入确认是替身，尚不证明原生文件夹 UI 或 Wallpaper Engine 实际宿主。
- 本轮 Web/Electron 类型、Web 生产构建、77 项宿主单元/集成及格式/文档/仓库检查通过；桌面 ASAR/安装器的实际 CSP 与校验旁文件已核对。改动只在 Electron 宿主、测试与文档；网页依赖图、算法子层源码和共享工程格式未改，不宣称重复执行了浏览器业务回归。
- CSP/资源阶段提交 `8de50fe`。实际 ASAR 媒体 run `media-580a9733-a7e3-45f0-8c15-769868071bf1` 整体通过：四档分别首次/同页重复 12 秒同步片及 3 秒几何预设，共 12 份 VP9/Opus、4,860 帧；首次保存取消后 ready 输出可重试，实际分块落盘。页面音量为零，captureStream/MediaRecorder 被测试守卫拒绝。复用既有媒体 oracle 的 `--files-only`，完整解码、精确帧数和逐帧 PTS 全过；最大事件偏差 35.5ms、相对漂移 17ms、尾差 21ms、时长差 20ms，沿用 100ms/250ms 门槛，不冒充 Chrome/Edge `--all` 或长片通过。截图已核对；过程在 desktop/media，原文件/capture/measurement 在 visualizer-composition/output 对应 run 前缀下。
- 先前 `media-121b2683-dfbe-4acb-b526-70e7e4c0f7fb` 的 12 份媒体测量已通过，但隐藏窗口截图超时使 runner 失败；随后仅调整测试末尾显示专属窗口，再完整复跑通过并清理未变执行副本。此次只添加测试、命令和文档，共享导出、Web 与桌面产品代码不变，不重复无关产品构建。
- 上述资源 run 的实际壁纸五文件另在本机 Chrome 156.0.8078.73 以 file:// 运行，通过音频回调、暂停/恢复、有效像素和无 HTTP(S) 请求检查，结果及已核对截图为 `wallpaper-offline-chrome.json/png`。回调由测试提供，不证明真实 Wallpaper Engine 宿主。
- 媒体阶段提交 `a5fce3e`。模型连接先在 ASAR run `model-network-58398b06-995b-4641-94b8-3d6ec08f9bb6` 记录到 Basic Pitch 的 connect-src violation；其余 7 模型均有真实 206/1024-byte 数据。owner 随后明确批准 DEC-110。重建后的 run `model-network-82718d79-b98d-4b2d-800f-d4773c415c2d` 通过全部 8 个固定地址取样、其他 revision/文件路径拒绝；实际生产算法 iframe 不能读取 parent/Node/桥，在其中创建的 Worker 对该已获宿主许可 URL 仍产生 connect-src violation。Range 不等于完整自动标记模型推断。
- FT 冷运行 `ft-737176d7-697d-4afd-b4fa-91fe12659daf` 实际下载/产品校验四原模型共 662,450,544 bytes，NVIDIA Lovelace 非 fallback 的 WebGPU EP 完成 6 秒四轨，保存并重启恢复四份 WAV、试听与取消均通过；8 个真实模型/CDN 请求，没有离线 HTTP 请求。最后重做成功后，测试误断言结果仅一条而失败；既有 repository 本就保留多个结果，产品未改。此原 run 保留失败状态，不冒称整体通过。
- 修正结果选择后，以 `--profile-from` 明确复用上述专属 profile，并核对原八份 WAV hash；新 ASAR run `ft-4cbfda29-0976-469b-bb60-f2aeba8cb096` 全程离线（并拒绝 HTTP(S)）整体通过：两次四模型缓存推断、重启后相同 WAV、试听/暂停/原曲切换、取消保留旧结果及 Worker 释放。每轨 264,600 帧、2,116,844 bytes，float32/stereo/44.1kHz，全部样本有限且非全零，输出 hash 与 OPFS 清单一致；无 page error 或远程请求，实际截图已核对。它是受控短输入的功能证据，不重开 DEC-074 听感或充当完整 P1 clean evidence；原生 WAV 保存选值仍是替身。结果在 desktop/ft，对应 profile 保留供后续升级验证。
- DEC-110 新包能力 run `smoke-packaged-baea135d-7c9a-4961-8305-3bff77637bbf` 通过原能力/隔离及 OPFS 重启检查；宿主类型、Web/桌面生产构建与 77 项宿主测试通过。此宿主策略不进入 Web 依赖图，共享处理/工程/模型身份均未改。
- 本轮真实 Chrome/Edge 各 1 项既有完整 FT 专项通过（四模型/导出、试听、恢复、离页保护、结果/模型清理），模型夹具 bytes/hash 已独立核对。`ft-web-b9258b1a-8324-48fc-9f8e-ce5b89cabe2a` 中两浏览器四轨与上述桌面 WAV 逐样本比较，8 行最大绝对差/RMSE 均为 0，文件 SHA-256 也一致；`desktop-parity.json` 保存本次 6 秒输入比较，不推广到任意设备/输入或正式 P1 canonical。转录下载工具的 PowerShell 授权检查未通过，改用 Node 流式只读验证四文件 SHA-256/size（Basic Pitch 另核 Git blob）均符合固定 manifest，未改系统执行策略；这些本地夹具检查不等于桌面自动标记推断。
- 模型连接/FT 阶段提交 `b3fb8e2`。自动标记 ASAR run `transcription-788a8775-1575-4a0d-9b85-a806fa0e9de6` 在校验复制的独立 FT profile 上整体通过 7 项检查：四个转录模型真实下载/产品校验（209,572,912 bytes）、五输入完成、辅助 WAV/试听、候选改类/删除恢复/应用、离线重启及重复应用保护、取消释放 Worker、完整离线重算、第二副本的损坏模型报错及显式清理。应用采用显式 10000ms 点标记分界，人工轨和 tempoMap 保留，导出/恢复均为现有 V2。
- 此 6 秒输入生成 34 个候选（鼓 0、低音 13、人声 6、钢琴 7、吉他 8），失败/鼓截断为空；不由链路完成宣称鼓种或乐器识别质量接受。辅助 guitar/piano 各 264,600 帧、float32/stereo/44.1kHz，样本有限/非全零且 hash 与 OPFS 清单一致。在线有 7 个模型/CDN 请求，离线无远程请求或 page error；实际截图已核对。正常主 profile 保留全部有效模型、工程和候选供升级验证，损坏/清理仅作用于第二副本，原 FT profile 保留。
- 同轮 Chrome/Edge 既有完整链专项通过，唯一输出 `transcription-web-66c5a3c9-249d-4334-a107-2051f19d6881` 的 `.last-run.json` 为 passed/无失败，identity 及源 hash 在 `editor-transcription/full-chain/chrome-1793370403679`、`edge-1793370553454`。剔除结果/候选随机 ID 后，桌面在线、离线及双浏览器的 34 个候选语义字段完全一致，两辅助 WAV hash 也一致，比较保存在本次桌面 run 的 `web-parity.json`。仅测试/文档及复用测试 profile helper 改动，Web/桌面产品处理链、模型与工程格式未改，不重复产品构建；它不是新听感/识别质量接受或正式 readiness。
- 自动标记阶段提交 `ccbb8cd`。实际 ASAR 长片 run `media-long-0d9361df-81aa-46da-81fa-6f3e33624969` 整体通过：900 秒/48kHz 受控音源、原生频谱 wireform 与四处白闪，1080p60 VP9/Opus 实际分块保存 391,395,858 bytes；页面音量为零且拒绝实时媒体 API。既有 `offline-sync-v4 --files-only` 完整解码 54,000 帧、精确帧数及逐帧 PTS 全过，最大帧间隔 17ms、事件偏差 35.5ms、尾差 21ms、时长 900.02 秒；测量精度内未见累计漂移，未放宽原阈值。
- 此次长片导出 208.472 秒，再次导出后取消 1223ms，OPFS 输出为空、活动 OfflineAudioContext 为零；实际编码帧和应用截图已核对。104 次约两秒采样中，renderer/main 两次往返合计最大 7ms、JS heap 峰值 150,544,498 bytes，应用进程工作集/私有内存合计峰值 1,612,404/1,556,280 KB。共享页可能重复计数，未测 GPU 显存，不构成任意复杂工程性能保证。生产无开发 diagnostics，初始输出页未挂载进度条时 progress=null，精确帧数以媒体 oracle 为准；原生保存选值仍为替身。结果/采样在 desktop/media-long，对应 WebM/capture/measurement 在 visualizer-composition/output。
- 本小目标仅测试、命令与文档变更，双端产品导出/工程格式未改；扩展 fixture 的默认短片生成结果与先前验证 bundle 在归一随机实例 ID 后完全相同，不重复无关产品构建或四档矩阵。现有浏览器长片证据保持独立，不能由本次桌面结果更新其版本/身份。
- 长片阶段提交 `3738c23`。随后窗口实测在本机 scaleFactor=1.5 时发现构造函数将已保存 1100×700 恢复为 1102×702；独占 `window-probe-7ff99647-a31e-4525-b305-dbb7d7d989b1` 比较隐藏/显示/重新 setBounds，前两者不变、后者精确还原。宿主现于创建后、监听偏好前重设已限制到显示器的外框，防止尺寸逐次漂移；最大化恢复也在测试 profile 执行，只有自动显示保持抑制，生产逻辑及最小尺寸未变。
- 修复后实际 ASAR 生命周期 run `lifecycle-ed87e291-b876-4742-b69d-dd190560a9d6` 整体 10 项通过：最小化期间播放时间继续、第二 EXE 退出 0 并恢复/聚焦唯一窗口；拒绝关闭仅 inspect 且可继续编辑；受控 IDB 写失败阻止退出、resume 后能重试并保存 BPM 143；确认退出依次 inspect/prepare/dispose，真实进程退出 0，重启草稿及 1100×700 普通 bounds 一致。最大化重启仍保持原普通 bounds，未完成原生保存的 1024-byte 临时文件清空，活动 WebM 退出后重启 OPFS 为空且草稿仍为 143。四个 session 的握手/确认/closed 日志和已核对截图保存在 desktop/lifecycle；OS 选择/确认结果为替身，不证明真实确认 UI 或显示器移除行为。
- 生命周期最初测试分别遇到退出后重新查询 Playwright 句柄、读取非原子测试日志和未悬停预览工具栏的问题；均仅修正测试观察/交互后完整重跑，上述通过身份是最终 run，先前失败记录未改写。新包能力 run `smoke-packaged-479ef061-9d02-4acd-bd70-097c33ef8867` 的原能力/安全/算法隔离及 OPFS 重启全部通过；77 项宿主测试、双端类型/生产构建通过。宿主单元测试首次受 esbuild 目录访问限制未启动，在沙箱外同命令通过。窗口改动限 electron，Web 不依赖宿主模块，不更改共享工程或输出链路。
- 窗口/生命周期阶段提交 `2357df3`。现已接入上面的单文件异常保存日志，全部 91 项宿主测试通过，含 14 项新日志/真实文件用例：已确认部分文件恢复、目标/未登记文件保留、替换/改动/未确认尾部保护、父目录与日志目录 junction、双槽中断/损坏/schema/hash 拒绝、并发及初始化/写日志期间取消、持久化失败不覆盖目标。类型与新 NSIS 构建通过；改动仅 Electron，Web 不导入这些模块，已有 Web 构建与新桌面 renderer 的 20 个 JS/CSS 文件 SHA-256 逐项相同。
- 实际 ASAR run `save-recovery-4c215054-1d70-4f21-9a72-94fbd5d68882` 整体 4 项通过：三次核对独占 EXE/实际 main PID 及所属进程后强制终止进程树，确认所有已记录进程已退出，再实际重启。1MiB 已确认部分文件确实在终止后残留、重启后清除；原目标、未登记同前缀文件和完整发布的 1MiB 文件 hash 不变；外部改动后的残留保留且调用提示，最终正常退出 0。OS 保存/提示响应为替身，无 page error；结果与 PID/启动器/退出码/保留 hash 在 desktop/save-recovery，不作为断电、目录或原生提示 UI 通过。
- 此专项初期把 Playwright 启动器当作实际 main，并只观察 exitCode，随后重启因实际旧进程占用 profile 失败；已改用连接应用返回且路径核对过的 main PID/进程树并记录退出信号。旧失败 run 保持失败，唯一确认属于该失败独占副本的残留树已按完整路径和命令行复核后结束，原文件/profile/证据保留。新增日志等待后的生命周期 run `lifecycle-1db07be6-190f-4562-81fd-aaaae730c149` 10 项再次通过；文件 run `files-a1ce59c6-e26f-44a2-8e34-053d3ade154b` 13 项通过，含真实多块保存/取消、工程传递、三格式播放、权限和重启/源变化保护，无 page/console error。
- 单文件恢复阶段提交 `c367666`。目录日志现已接入真实预设/壁纸事务；通用双槽存储提取未改变单文件 V1 载体，完整宿主 107 项通过，包含 16 项目录恢复测试：两种临时树、半写子文件先恢复、根/source/父目录 junction、外部新增或完成文件变化/hash不符保留、持久化清理标记后续作、发布/正常取消保留、初始化等待取消、close-file 日志失败及非法清单拒绝。宿主类型、独立 NSIS 构建及包白名单/NotSigned/SHA 检查通过；改动只在 Electron，现有 Web 产物与重建 renderer 的 20 个 JS/CSS hash 仍完全一致。
- 实际 ASAR 目录 run `bundle-recovery-8ccb9265-32b1-42b4-b331-68bd33dc4a42` 整体 6 项通过：预设和壁纸各有已完成文件及 8192-byte 半写子文件，核对实际 main/EXE/进程树后终止，再重启清理精确目录；预设场景含 source 内半写文件。完整发布五文件目录 hash 保持，外部新增或已完成文件改动均保留目录与其他完整文件，独立半写文件仍按自身日志清理，保留提示被调用；原用户标记和未登记目录 hash 不变，无 page error，最后正常退出 0。传输内容是受控 bytes，不代替资源语义或壁纸渲染；OS 选择/确认/提示仍为替身，清理中断仅由逻辑/真实文件测试覆盖，不扩大为断电保证。
- 共用进程所有权/提示测试 helper 后，单文件实际 run `save-recovery-8003afe0-d6fc-4b33-8a81-4b7409c2884d` 4 项再次通过。两类恢复结果/退出 PID/hash 分别在 desktop/bundle-recovery 与 desktop/save-recovery，测试 profile 和外部改动残留按 run 保留，成功执行副本已核对后清理。正常资源 run `resources-65abbd98-43d6-45f3-a48c-de4d531ffab0` 的资源目录、预设保存/取消、真实壁纸五文件、重启及原库 hash 保留共 5 项通过，page/console error 为空；这些实际资源语义与输出证据独立于前述受控传输 bytes，仍不证明 OS 目录 UI 或 Wallpaper Engine 宿主。
- 目录恢复阶段提交 `27a273c`。实际 ASAR 任务退出 run `task-shutdown-b1f20623-28a4-475b-b620-527c3edda508` 在校验复制的冷 FT profile 上全程离线，整体 6 项通过：真实 Worker 首次分段推断已进入 stitch 后，下一 inference 阶段触发主进程窗口正常关闭，观察到 terminate 与 inspect/prepare/dispose，进程退出 0；重启后的原结果元数据和 processing-p1 目录集合与基线一致，新任务目录消失。没有 HTTP(S) 请求或 page error，原 profile 只读复制，不冒称新冷下载或完整新四图结果。
- 同一 run 生成 158,815-byte 待保存 WebM（空场景，仅验证文件生命周期），拒绝关闭仍 ready；受控 session IDB 写失败后 prepare/resume 恢复，文件名/大小/SHA-256 与关闭前完全相同。恢复写入并确认关闭才 dispose，进程退出 0；再次重启后 visualizer-export 为空，BPM 145 草稿及旧 FT 结果仍在。三个 session 的确认/握手日志、Worker 事件、ready 文件摘要和已核对截图在 desktop/task-shutdown；确认响应为替身，不证明原生确认 UI、媒体质量或新听感接受。
- 首轮测试误将 Worker 重复心跳当作第二次推断，并使用渲染页 window.close，实际未经过原生关闭握手；固定版本的[CloseContents](https://github.com/electron/electron/blob/v45.1.0/shell/browser/api/electron_api_web_contents.cc#L1697)与[窗口销毁路径](https://github.com/electron/electron/blob/v45.1.0/shell/browser/api/electron_api_browser_window.cc#L107)支持该观察，产品 `src/` 与 `electron/` 均未调用它。测试改为非重复阶段证据和主进程窗口入口；中间运行另补上现有 Editor 离页确认后完整重跑，旧失败 run 保持失败。此次仅测试/命令/文档变化，Web/桌面共享实现、模型、工程格式和安装包不变，不重复产品构建。
- 任务退出阶段提交 `da778f4`。D6 实际安装 run `8a8d8b9d-ba1f-4ab0-8508-3f0f920974d5` 使用当前交付安装器，复核无已有安装/快捷方式/进程后备份默认 userData 的 84 文件、4,191,660 bytes；专属 36-byte 标记计入安装/升级/卸载各 85 文件保留检查，最后移除标记并逐一复核原基线。真实 HKCU 注册、含空格安装目录、两快捷方式、ASAR hash/版本及 NotSigned 检查、实际 0.0.0→0.0.1 升级和卸载全部通过，命令退出 0。
- 同次安装另从已通过自动标记 run 的正常 profile 创建校验副本，未使用其损坏/清理副本，不写 owner 默认工程或原模型资料。实际安装 EXE 的 app version/路径/userData 与三项隔离参数已核对；两个版本均导出/恢复 V2 工程（6 轨，人工轨 1 事件）、4 个 FT 记录和 2 个各 34 候选的自动标记记录，完整领域快照完全相同。八模型合计 872,023,456 bytes、64 份 OPFS 原 PCM/planar/WAV 合计 89,280,880 bytes 的大小和 SHA-256 全部核对，零 HTTP(S)/page error。
- 升级后真实离线重算 FT 与五输入自动标记通过，未应用新候选时完整导出工程保持不变。卸载后的同 payload 校验副本直接再读取保留 profile，8 模型、5 个 FT/3 个自动标记记录及 83 份新旧音频摘要均有效，零远程请求/page error；副本完整性核对后清理。初始安装截图在窗口显示后过早采集，未作布局通过依据；增加字体/两帧绘制等待后的 post-uninstall 截图已核对。该补充直接检查在原安装 run 上完成，并纳入复跑入口，不重复安装或覆盖旧证据。
- 结果、领域快照、导出工程、默认数据私有备份及截图在 install-verification 对应 run，逻辑 profile 留在普通用户专属目录。0.0.1 仅忽略目录夹具版本，仓库/交付包保持 0.0.0；它验证当前实现的保留与读取，不承诺未来 schema 迁移、识别质量或公开发布。此次仅测试 helper/入口与文档变化，双端产品和交付包未改，不重复产品构建。
- D6 数据阶段提交 `70b21a9`。三维 ASAR run `scene-4b8d7e28-9ab7-4336-9dc4-b9af3d2f12d0` 整体 7 项通过：现有 shared-camera-demo 两立方体，实际 UI 修改镜头轨迹为 12 秒、第二关键帧 X=-2、元素 X=-0.9，真实重启后完整 V6 工程相同。720p30/三秒 VP9+Opus 输出 419,601 bytes，经原媒体 oracle 的 `--files-only` 全解码/90 帧逐帧 PTS 通过，视频/音频尾分别 3/3.02 秒；每帧两色几何及动态帧摘要通过，截图/实际解码帧已核对，不代替深度数值 oracle 或任意场景质量。
- 同一 run 首页实时样式实际重启、三次模式切换均恢复单 canvas；V2 快照保留镜头/变换。桌面创建相对 `/display/<ID>`，不显示外部地址或复制入口，`app://` 内导航后 canvas 精确覆盖实际 1440×900 视口，真实全屏/退出通过。再次重启保留独立样式，缺失样式报错且可返回首页。HTTP(S)、page/console error 均为空；六个原资源元数据/包/源码 hash 未变。结果/工程/样式/截图在 desktop/scene，WebM 与严格测量在 visualizer-composition/output；OS 文件/目录选值仍为替身。
- 前两轮因测试未打开响应式元素面板/展开预设层级而失败，旧 run 保留；改为现有 UI 入口后完整重跑通过，未修改产品代码、资源、工程格式或交付包。此次仅测试/命令/文档变化，Web 依赖和共享行为未变，不重复产品构建或浏览器专项。
- 三维阶段提交 `8cef244`。输入 ASAR run `inputs-57f7f91a-0034-47cf-988b-ec1f96b9f37a` 整体 8 项通过：独立 osu 追加六轨并保留人工事件/137 BPM；osz 双难度、损坏音频/原音频不匹配拒绝、换歌取消后原草稿不变，显式应用后实际包内音频 hash、三轨和负一秒导入锚点正确，暂停且真实重启/Editor JSON 往返相同。
- 同一 run 实际读取 PNG/JPEG/WebP 与两视频文件，检查内嵌 Base64/SHA-256、颜色/轮播淡化和帧间 seek/往返/1.2 秒循环；UTF-8 中英文 LRC 摘要、取消和无时间戳拒绝保留通过。移走本次五媒体/LRC 源文件后，真实重启的完整 V6 草稿相同；再次 JSON 导入按既有实现仅更新 updatedAt，其余完整字段相同。前后两份四秒 720p30/VP9+Opus 输出各 120 帧，全解码/逐帧 PTS、音频非静音和 20ms 尾差通过；实际编辑截图、恢复截图和编码帧已核对。HTTP(S)、page/console error 为空，结果/工程/截图在 desktop/inputs，视频/严格测量在 composition output；系统选择结果仍为替身，不扩大为任意编码/质量接受。
- 初期测试分别误点负时间区域、未计入控件 label 的可访问名称，以及对 JSON 导入更新时间作完全相等断言；均修正观察/交互后完整重跑，旧失败 run 保留。首次最终重跑还曾因自动审批额度错误而未执行，服务恢复后通过原审批流程运行成功。此次仅测试、命令与文档变化，双端共享代码、格式、外部资源及安装包未改，不重复产品构建或浏览器专项。
- 输入阶段提交 `6cce2c7`。`test:desktop:directories:manual` 仅预填/限制独占位置，保留真实目录及 message box 回答，初始音频明确为替身。`manual-directories-156b10cd-7c30-4601-a688-6e0b1600b5f7` 的资源库选择由 owner 实际完成，原生返回路径和全部目录读取通过；整体 run 随后因测试过早截取频谱输入封面而失败，不冒称整体通过。
- 避免重做已验步骤，`--skip-catalog-dialog` 明确替换首个选择；`manual-directories-4f1d6601-293b-42d7-9655-d95127dc79b1` 实际预设确认 response=0 与壁纸目录选择通过，磁盘新预设 JSON 及五文件分别核对；index/project/runtime/style/licenses 为 641/161/1,326,229/23,621/17,828 bytes，摘要在 partial-result。随后测试错误地以已保存 Visualizer 草稿触发关闭，应用按 inspect/prepare/dispose 正常关闭，未弹退出确认；整体保持 incomplete。只结束了核对路径/命令/父 PID 后的等待 Node runner，原日志/profile 保留。
- 已修正分析输入/画面就绪等待、准备/失败诊断和关闭触发条件，退出改用明确含未导出修改的 Editor。`--close-only` 的 `manual-directories-85457831-60bf-4794-b6de-3474f624dc68` 中 owner 实际只点一次“退出”，原生 response=1、inspect/prepare/dispose 和 closed=true 已核对；原 runner 因期望先继续工作而保持 deferred，单项 UI 证据在 partial-result，不额外宣称该 run 单独捕获了正常 main 退出码。
- owner 明确允许重试继续工作，`--decline-only` 的 `manual-directories-f53b8958-76eb-4712-be4b-55f4101a0b8a` 整体通过其限定检查：真实 response=0，阶段只有 inspect、窗口未关闭、Editor 添加轨道仍可用，截图已生成，随后仅测试 app.exit 收尾（cleanupExitCode=0），不作为正常确认退出。它与前一实际退出 UI 及既有正常关闭/退出码自动化证据分别保留，不把不同操作合称同次完整 run 通过。中间失败/deferred 资料均保留，未改产品源码或静默重试封面。
- 提取共用资源夹具后 `resources-5e60a269-f823-4dbb-849d-c979346f96aa`，加入正确就绪等待后 `resources-de109f52-2a4d-4159-b4ee-9de33e6f7d0a`，均实际 ASAR 五项业务回归通过且 page/console error 为空；OS 回答为替身。双端生产构建在 `final-verification/d7-d8b685fa-c80e-4ed9-8cdf-c229fa2e9687` 通过，保留原 chunk 提示；Chrome/Edge 回归仍在运行，不能预记通过。本轮仅测试/命令/文档变化，产品实现和安装包未改。
- 原生交互阶段提交 `9ec1030`。D7 首轮真实 Chrome/Edge 页面/三格式/恢复/分析/Editor/展示策略共 58 项中 56 项通过，两个一万事件用例因导入后再次选择既有 RMS 不触发菜单 change 而失败；测试改用显式浮层开关，原 run 保持失败。随后原 50ms 门槛发现 51–57ms 长任务，CPU profile 定位到关闭的 `EditorTrackOperations` 内容签名仍 JSON 序列化全工程。
- 共享修复只在打开时计算签名，保持同内容克隆、不合法移动、真实工程/网格/播放变化与关闭后禁止提交的语义。Chrome/Edge 的 E6 和轨道操作共 12 项完整通过；一万事件两浏览器最大反馈 39.6/39.1ms，50ms 以上长任务为零，1024/1280/1920 对齐误差均零。原阈值、900 秒/一万事件夹具及 codec 不变，不重写原失败或宣称正式 canonical；日志/CPU 诊断/修复结果在本次 final-verification 下。PowerShell 原日志原样保留，另有显式 UTF-8 副本及 log-encodings 摘要映射。
- 新 `test:desktop:analyzer` 的最终新包 run `analyzer-71eb7301-b02a-4c16-b885-b0a8e93f56e6` 三项通过：22 卡、三类真实 Worker/精确游标、DPR 与共用缩放、三个缓存 payload 共 100,179 bytes 及完整载体重启相同；重启的 prepare-source 和空特征批次只初始化游标 PCM，不重算显示特征。全程零 HTTP(S)/page/console error，截图已核对；早期测试的初始导航/静音取样/误判空批次失败均保留，未修改生产分析链。
- 新包输入 run `inputs-8720ec29-3c31-470b-aeac-78d1c0f8169c` 九项通过，新增真实轨道移动保留事件 ID 与网格变化关闭，其余导入/恢复和两份真实媒体也重新通过。新包能力 `smoke-packaged-549a082d-e03d-4733-b8bf-82daf444a3c0` 的 GPU/编码/隔离/算法模块/OPFS 重启通过。此次共享改动只在该弹窗，不更改模型、输出数学、存储格式或宿主授权，既有模型/长片质量证据保持各自身份。
- 共享修复后 Web 构建和 NSIS 再生成通过；新包仍未签名、0.0.0，129,143,074 bytes，SHA-256 `b6d5bf4afb730329f21d4cb411ec5e50f2e0f53c4afb6b6665edeb2eee4d1168`，旁文件一致。ASAR 50 条目/42 文件逐一与最终 staging 相同，Web/desktop 20 个 JS/CSS hash 完全相同，无用户资料、外部资源库、fixture、node_modules 或模型权重；NotSigned/身份检查在 artifact-audit-final 与 windows-package-audit-final，保留修复前审计文件。
- 共享修复阶段提交 `9a65845`。最终安装器实际 run `60fa2cef-b46f-485e-9111-d97b23dfde30` 再次通过真实安装、0.0.0→0.0.1 同实现夹具升级、卸载与保留检查：默认 84 文件/4,191,660 bytes 基线备份及 36-byte 专属标记全程保持，最后标记清理及基线复核通过。实际安装的两个版本均读取独立正常副本的八模型/64 音频文件、工程及候选；升级后离线 FT 和五角色重算、卸载后同 payload 再读取八模型/83 音频文件均通过，零 HTTP(S)/page error。结果包含 postUninstall，不依赖先前补充脚本；不扩展为未来 schema 迁移保证。
- 已将当前安装器与 `.sha256` 流式复制到 `%USERPROFILE%/Downloads/AudioNotSurfYet-0.0.0-20261031-900e814d/` 新目录，源与副本字节数/摘要一致，记录在本轮 final-verification 的 delivery.json；不复制项目安全标签、不改 ACL 或 sandbox。最终宿主 main/preload 的 SHA-256 与前述安装/生命周期阶段完全相同；`27a273c` 之后产品源码仅有上述共享弹窗修复，模型/导出/宿主旧证据仍各自保留身份。
- 最终范围核对补齐最小化任务：`minimized-tasks-e0c8320b-9067-4720-99ef-81672dd074ca` 整体两项通过，独立校验副本全程离线。真实四模型 FT 推断开始后最小化，61,330ms 后仍最小化且新结果完成，四份 WAV 各 2,116,844 bytes 与新记录摘要一致；Worker 已释放。实际工程导出确认 30 秒/1080p60 参数，编码开始后最小化，5,595ms 后仍最小化且 ready，恢复后原生端口保存 836,443-byte VP9/Opus WebM。69 次状态采样均最小化且 backgroundThrottling=false，零 HTTP(S)/page error，截图已核对。
- 该视频的 `--files-only` 文件检查完整解码 1,800 帧、逐帧 PTS、非静音及 30.02 秒时长通过，无失败或丢帧警告；它只有一个空场景输出，不作为完整档位矩阵或场景质量通过。首轮测试未等队列导入/展开列表，随后用 option 的通用 enabled 断言过早选择，实际输出默认 720p30；这些 run 保持 failed。现直接等待 disabled 属性移除并核对真实导出工程，独立视频诊断和最终完整专项均通过，未改产品或放宽媒体门槛。
- 本轮只补充测试/命令与文档；Web 与桌面产品代码、工程格式和已验证的最终安装包未改，复用 `9a65845` 的构建与各专项证据。六个项目 skills 的双端要求保持并重新同步发现入口/代码地图。D0–D7 的实施目标已满足，后续按双端合同维护；既有 P3/识别质量、正式 readiness、PROD-015 发布限制和原支持边界不由此关闭或扩大。

正式范围、质量/性能和批准仍从[产品范围](../product/scope.md)、[决策登记](decision-registry.md)与[上下文入口](index.md)按需读取。
