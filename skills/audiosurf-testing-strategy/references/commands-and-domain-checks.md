# 命令与领域检查

## 当前入口

命令定义以根 package.json 为准，完整 runner 与历史结果见 [tests README](../../../tests/README.md)。这里只提供任务选择，不能把可用命令表当作默认执行清单。

读取文档、skill 和引用文本时必须显式指定 UTF-8 参数，例如 `Get-Content -Encoding UTF8`、`rg --encoding utf-8`；仅列文件名无需编码参数。

| 用途 | 命令 |
| --- | --- |
| 项目入口与地图 | `skills:install` / `skills:check`、`codemap` / `codemap:check` |
| 文档与工具 | `test:docs`、`repo:check`、`test:tools` |
| 修改的手写代码格式 | `format -- <file...>` / `format:check -- <file...>`，只传本次明确文件，不全仓运行；2000 行硬上限另由 `repo:check` 检查 |
| 类型与生产构建 | `typecheck`、`build`；构建 prebuild 会准备 processing assets |
| Electron 安装 | 先 `desktop:package` 再 `test:desktop:install`；实际每用户安装/补丁版本升级/卸载，备份并保留用户数据，拒绝覆盖已有安装。显式 `--profile-from <成功自动标记 result.json>` 才在独立正常副本验证八模型/工程/候选/OPFS 快照、升级后离线 FT/五输入重算、卸载后同 payload 校验副本读取新旧结果；无参数只有物理保留证据，不扩展为未来 schema 迁移或质量接受 |
| Electron 入口/能力 | `test:desktop:dev` 实际执行开发命令；`desktop:build` 后 `test:desktop:smoke`，`desktop:dir` 后 `test:desktop:packaged` 检查生产能力及重启恢复。算术 ORT 图与原始编码块不替代真实 FT/封装视频验证；GPUAdapter 交给 ORT 单一设备所有者，不能预先消费后重复 requestDevice |
| Electron 文件/恢复 | `test:desktop:files` 为真实 ASAR IPC/存储/文件操作、对话框选值替身；`test:desktop:dialogs:manual` 为实际打开/保存且需人工操作，原生返回值不替换。只使用独占受控文件；两类结果分开，主进程请求不能模拟受限网页攻击者 |
| Electron 资源目录 | `test:desktop:resources` 检查独占资源副本的实际算法/封面加载、预设取消/保存、壁纸五文件、目录重启恢复与既有文件 hash；系统目录/确认选值为替身。`test:desktop:packaged` 包含 opaque iframe 内 Worker 动态导入 blob 模块，不能只用普通 postMessage 宣称算法加载通过 |
| Electron 原生目录/确认 UI | `test:desktop:directories:manual` 默认只替换初始音频选值，两个目录选择、预设保存与继续工作/退出保留真实系统 UI/回答。先等分析/画面就绪，退出以未导出的 Editor 修改触发；`--skip-catalog-dialog` 不验证资源库 OS 选择，`--close-only` 只验证退出，`--decline-only` 只验继续工作后自动强制收尾，不能称正常确认退出。限制受控目录并核对阶段/退出码/文件；人工未完成保持待验，取消或 output 中 `defer` 可结束等待，不把 ready/部分通过记为完整 run 通过 |
| Electron 封装媒体 | `test:desktop:media` 实际 ASAR 四档首次/重复同步片和几何预设输出，取消保存后重试；复用现有媒体 oracle 的 `--files-only` 严格解码/逐帧/同步门槛。结果不能转写为 Chrome/Edge `--all`、长片、模型或原生保存 UI 通过 |
| Electron 三维/展示 | `test:desktop:scene` 实际 ASAR 现有三维示例的镜头/位置编辑与草稿重启、720p30 真正输出/全解码/逐帧 PTS/动态几何、首页样式重启及模式切换、应用内展示/满视口/全屏/重启/缺失返回。全程拒绝 HTTP(S)，原库只读；系统选值替身不证明原生 UI，一例不替代四档矩阵或深度数值 oracle |
| Electron 素材输入 | `test:desktop:inputs` 实际 ASAR 的 osu/osz、Editor JSON、三图片/两视频格式及 UTF-8 LRC，检查取消/损坏保留、原音频身份/换歌保护、内嵌摘要、seek/循环/淡化、移走素材后重启和 JSON/视频输出。仅导入更新时间戳可变，其余完整内容比较；系统选值替身不证明原生 UI，合成片不扩展为任意 codec 或质量接受 |
| Electron Analyzer | `test:desktop:analyzer` 实际 ASAR 的 22 卡、三类真实 Worker/精确值、六 Canvas/DPR/共用缩放与缓存载体/二进制摘要重启一致。游标保留 PCM 可使用空特征批次，只断言显示特征不重算；不把短输入三项代表值当全特征 golden，系统选值仍为替身 |
| Electron 封装长片 | `test:desktop:media:long` 实际 ASAR 的 900 秒/1080p60 原生输入与白闪、真实分块保存和取消清理，复用严格媒体 oracle 检查 54,000 帧及同步。只采样应用自身 metrics，UI 诊断不作为精确帧数证据；不推广为任意复杂场景性能或原生保存 UI 验收 |
| Electron 模型网络/FT | `test:desktop:model-network` 覆盖真实固定 URL 的 Range、其他路径拒绝和生产算法 iframe/Worker 网络隔离；`test:desktop:ft` 覆盖真实四模型下载/校验/推断、WAV、离线恢复/推断及取消。`--profile-from` 只显式复用已验证冷下载的专属 profile，不能当作新冷下载；仍不证明自动标记/长曲/原生保存 UI |
| Electron 自动标记 | `test:desktop:transcription -- --profile-from <冷 FT result.json>` 在独立校验副本执行真实四转录模型、五输入、辅助试听、候选应用、离线恢复/重算、取消及第二副本损坏/清理；核对 V2 人工轨/tempo 保留。原 profile 保留，实际候选数量与模型链路不等于识别质量或长曲接受 |
| Electron 生命周期 | `test:desktop:lifecycle` 实际 ASAR 关闭确认返回值替身、拒绝继续编辑、草稿写失败恢复/重试、退出后草稿、原生部分保存/活动 WebM 清理，以及真实最小化播放/第二实例聚焦/窗口普通及最大化恢复。握手日志与退出码必须核对；不代替原生确认 UI、FT/ready 输出退出及崩溃恢复 |
| Electron FT/ready 视频退出 | `test:desktop:task-shutdown -- --profile-from <冷 FT result.json>` 在校验副本全程离线，真实推断完成后于后续分段阶段触发正常关闭，核对 Worker 终止、握手及旧结果；ready 文件拒绝/保存失败保留、最终确认退出及重启清理。以非重复阶段证据和文件 hash 为准，不借渲染页 window.close 或进度心跳冒充；原生确认 UI 和质量接受仍独立 |
| Electron 单文件异常恢复 | `test:desktop:save-recovery` 核对连接应用的实际 main PID/独占 EXE 和进程树后强制终止并重启，检查有据部分文件清理、目标/未登记文件/已发布输出保留、被修改残留保留与提示调用。启动器 PID 不一定是 main；不得按进程名批量结束。写中未确认 bytes、断电及目录事务不由此获得通过 |
| Electron 目录异常恢复 | `test:desktop:bundle-recovery` 实际 IPC 的预设/壁纸目录、已完成文件及半写子文件，进程树终止/重启后核对子文件先清理、目录精确清单清理；发布目录 hash 保留，外部新增或完成文件变化保留并提示。不替代资源/壁纸语义、原生 UI、断电或任意未确认写入恢复 |
| 播放与会话 | `test:m4:unit` / `test:m4:integration`、`test:e2e:m4` |
| 句柄与恢复 | `test:m5:unit` / `test:m5:integration`、`test:e2e:m5` |
| 分析平台 | `test:m6:unit` / `test:m6:worker` / `test:m6:integration` |
| Analyzer 特征与布局 | 相关 `test:m7:*` 至 `test:m14:*` 和浏览器专项 |
| Editor 工程与交互 | 相关 `test:e1:*` 至 `test:e10:*` 和浏览器专项 |
| FT 计算、任务与存储 | `test:p1:unit`、`test:p1:integration` 及 `tests/processing/` 对应切片 |
| Editor 分离接入 | Vitest 过滤 `tests/processing/editor-*.test.ts`；Playwright 的 `tests/e2e/editor-ft.spec.ts`，按 Chrome/Edge channel 选择 |
| 内容生成输入校验器 | `test:skill:visualizer-content-generator` |
| Visualizer V4 组合/输入/离线导出 | `test:visualizer` 或对应文件过滤、`test:e2e:visualizer:chrome` / `test:e2e:visualizer:edge` 中受影响专项；媒体入口见当前离线导出契约 |

执行前核实当前 package.json 中的精确命令；参数和过滤文件按实际影响选择。日常修复不运行累计 eval 链。正式 canonical/readiness 请求使用现有对应 `eval:*` 命令，继续满足各合同的干净 commit、范围、身份和人工证据要求。

## 领域检查选择

- 播放与加载：成功、decode/metadata 失败、空队列、暂停/seek、换歌/清空及节点/URL 释放。
- 离线分析：受影响的 0/1/4 活动特征、progress/cancel/error、完整 cache identity、stale generation、exact cursor 和持久化失败隔离；调度/资源/性能变化时补约 15 分钟输入与生命周期观察。
- Editor：受影响的 tempo/time、吸附、point/range、原子冲突、JSON/草稿及 overlay/geometry；数据保护与恢复修改需邻接失败路径。
- FT：真实模型身份、输出时间/声道与 WAV、取消/换歌/stale、缓存恢复/清理和 quota 错误；推断、质量或性能结论必须有实际运行与所需试听/测量。
- 布局：按支持矩阵选窄、常见和宽视口，检查 DOM/canvas 几何、滚动所有权、焦点与控制台。
- Visualizer：确定性 absolute time/seed、V4 资源/分组预设与参数/目标隔离、资源幂等释放；导出变化补输入准备、手动渲染租约、帧数/PTS、取消/恢复及实际媒体文件，遵循当前[离线导出契约](../../../docs/context/visualizer-offline-export.md)。final hardening 才使用完整测试资源探针，不扩大生产公共接口。

浏览器使用合同规定的真实 Chrome/Edge；缺少浏览器、权限或端口时注明未运行，遵守 DEC-055 等既有环境限制。OPFS 不替代原生许可提示。

## 本地事实与风险

Node.js 24.22.1 / npm 11.x；目前证据只声明本地环境，没有正式 CI。fixture/golden 使用现有 Node 原生 type stripping；build 可能更新 auto-imports.d.ts / components.d.ts，应保留用户原有差异。现有大 chunk warning 作为风险报告；不无依据分包。

调试先复现，再缩小到状态、DOM、音频节点或渲染循环，核对原始路径和相邻失败/边界。真实结果与未验证项按当前证据报告，不复制历史 run 当作本次验证。
