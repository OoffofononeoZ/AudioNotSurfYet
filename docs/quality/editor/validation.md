# Editor 验证

核查日期：2026-10-19。当前依据为[页面接口](../../architecture/editor/interface-contracts.md)、[Project V1](../../architecture/editor/project-format-v1.md)、[交互契约](../../architecture/editor/interaction-contracts.md)和[工作区](../../context/editor-workspace.md)。旧阶段中与当前布局、细分或播放录入冲突的要求已被替代。

## 需要覆盖的行为

| 范围 | 约束与样例 |
| --- | --- |
| route/lease | 空、错误、同歌恢复与异歌显式入口；不静默换歌或播放，repeat-one/离页恢复、旧 token 和路由 generation 失效；复用单 engine/分析 Worker |
| 工程/草稿 | V1 round-trip、未知字段/schema、歌曲 hash/时长、重复 ID、悬空引用、越界/重复 point/重叠 range；完整拒绝保留内存和旧 durable draft |
| 保存 | 250ms debounce，提交/导入/离页按 controller flush；quota/abort 保留可导出的新工程并显示 not-persisted，不误报 durable success |
| 时间/几何 | waveform/tempo 与 marker/overlay 两套视图各自内部同秒 x 误差≤1 CSS px；DPR/backing store、首尾留白、zoom/pan/resize/滚动；不把播放帧写入工程 |
| tempo | 0 起点、有序 segment、20–300 BPM；`0 <= BPM <20` 为 single-beat，非有限/负值/越界拒绝；内部 boundary 删除由前段延伸且不移动事件秒数 |
| BPM 估计 | 60/100/128/127.5 fixture 误差≤`max(0.5 BPM,target×1%)`；静音/噪声/歧义 low-confidence；不任意半拍/倍拍归一化，迟到结果不覆盖用户值 |
| point/range | 分类迁移/删除、点重复、半开范围重叠、端点/整体移动、两次点击范围、批量选择/复制；失败整批原子拒绝，不自动合并或裁剪 |
| 当前细分 | 常规/三连音/自定义1–64、鼠标/键盘共用；zoom 只影响绘制密度，tempo/zoom 不重写已有事件秒数。暂停右侧编辑限制与播放数字录入分别测试 |
| 数字实时录入 | `1–9、0`/NumPad、折叠不重编号、repeat 与别名去重、多键范围、短按下一格、暂停/曲终、seek/切源/失焦/隐藏/Esc/输入控件取消；冲突逐项反馈且合并最新工程 |
| overlay | 全视口 fixed Canvas、时间列 clip、pointer-through、参数/菜单/手柄焦点；开关/切特征/错误重试与保存记忆；不拦截底层标记操作 |
| 性能/资源 | 约15分钟、20 lanes、每 lane≤8 classes、10,000 point/range：反馈≤100ms，无 Editor/分析归因任务>50ms；仅可见事件 DOM，20 次生命周期不单调累积资源 |
| 可访问性 | 390/1024/1280/1920、DPR1/2、键盘、命名焦点、reduced motion、共享滚动；pointercancel/lostcapture/blur/离页清理临时态，console/pageerror 无新异常 |

布局尺寸、播放线15%、1–10秒 marker span、当前行高/小节模式及数字录入细节只在现行交互契约维护，不复制旧 E7/E8 的失效排版令牌。

## 验证入口与证据

复用 tests/editor、tests/audio、tests/e2e 当前专项；仅选受影响的领域逻辑、integration 和浏览器场景，完整命令见 [tests README](../../../tests/README.md)。模型/分轨/自动标记按[处理链验证](../processing/validation.md)补相应证据。

JSON picker stub、OPFS、DOM/a11y 属性只证明受控边界。真实 OS 打开/保存/取消/覆盖、beforeunload、读屏与听辨体感按适用人工记录，不补写未提供的主观数值。

[evidence index](evidence-index.md)保留 E1–E9 canonical、E7/E9 pre-revision 及 readiness 两次尝试；[readiness](release-readiness.md)保持 DEC-055/owner-review 和 pre-E10 边界。正式请求才运行对应 eval runner 并核对 clean commit、环境、summary/hash 与人工输入，日常修改不生成逐阶段三件套。
