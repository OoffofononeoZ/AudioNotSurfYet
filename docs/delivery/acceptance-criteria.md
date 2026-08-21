---
status: approved
owner: "project-owner"
last_reviewed: 2026-08-21
upstream_docs:
  - "docs/product/success-metrics.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
  - "docs/delivery/execution-plan.md"
next_action: "在每个里程碑 PR/变更记录中引用适用 AC 编号并附可复现证据"
---

# Acceptance Criteria

## 1. Evidence Rules

- “通过”必须附命令输出、测试报告、浏览器记录、性能 trace、截图/几何数据或 owner 签字。
- 自动化只覆盖 Chrome 时，Edge 项必须保持待验证。
- 单一 happy path 不能代表格式、权限、恢复或资源生命周期完成。
- 任一数值容差变更必须更新本文并重新批准，不能在失败测试中临时放宽。

## 2. Product Task Acceptance

| ID | Criterion | Evidence |
| --- | --- | --- |
| AC-P01 | 用户可从本地选择有效 MP3/WAV/FLAC，看到队列和当前歌曲，并开始播放 | 三格式 E2E、错误 fixture 结果 |
| AC-P02 | Analyzer 可显示 0–4 张卡，活动 feature ID 不重复；任一卡可替换 | registry invariant + Playwright |
| AC-P03 | 四张卡共享 viewport、zoom 和 cursor；任一图表点击会 seek 全局播放 | 交互 E2E，记录期望/实际时间 |
| AC-P04 | 刷新恢复队列、当前歌曲、活动卡和固定参数；播放时间为 0 且 paused | IndexedDB + 浏览器刷新测试 |
| AC-P05 | owner 完成加载、选卡、换卡、比较、跳转、刷新恢复脚本中的每一步 | 签字的任务脚本与证据链接 |
| AC-P06 | owner 对 3/3 黄金片段正确解释 RMS、Amplitude Spectrum、Chroma 与听感/音色关系 | 预写答案要点、owner 回答和评分 |

M7 适用解释：AC-P02/P03 在本里程碑验证固定四槽与 0–3 张唯一活动卡，活动 ID 仅为 `rms`、`amplitudeSpectrum`、`chroma`；第四槽在三卡活动时显示 M8 后续提示。四张唯一活动特征的完整场景从 M8 首个新增特征后开始执行。无保存工作区默认三卡，已保存空工作区必须恢复为空。

M8 适用解释：四槽允许从累计 16 项中选择 0–4 张唯一活动卡；首次默认仍是 M7 三卡，已保存空工作区保持为空。M8 Slice 0 要求 sticky 距 Header 8px、MusicBar 及直属弹层高于 Analyzer、pressed 状态在 pointerup/pointercancel/blur 后恢复，并让精确值表格滚动条与主题一致。

### Learning golden segments

1. **L1 — Same pitch, rising level**：440Hz 正弦从低幅度变高。期望解释：RMS 增大；主频仍在约 440Hz；Chroma 的 A 类保持主导。
2. **L2 — Pitch-class change**：C4+E4 段切换到 G4+B4 段。期望解释：频谱主峰与 Chroma 类别随音高集合变化；RMS 在归一化后可保持相近。
3. **L3 — Same pitch class, brighter timbre**：相同基频和近似 RMS 的正弦段切换到含更多谐波的合成段。期望解释：Amplitude Spectrum 变宽、听感更亮；RMS 可近似不变；Chroma 仍主要指向相同音级并可能出现谐波影响。

答案允许使用等价语言，但必须同时引用声音、时间段和至少一个可见数值/图形证据。

## 3. Analysis Correctness

| ID | Criterion | Threshold / method |
| --- | --- | --- |
| AC-A01 | mono 混合正确 | 每 sample 等于所有输入声道算术平均；单声道不变；空/长度不一致输入返回 typed error |
| AC-A02 | frame 时间正确 | frame start 为 `index * hopSize / sampleRate`；尾帧零填充规则与直接提取一致 |
| AC-A03 | Worker 结果与批准的提取契约一致 | 非零能量输入的 12 项 M8 非 Flux 标量及 Meyda 向量逐元素满足 `abs(actual-expected) <= max(1e-6, abs(expected)*1e-5)`；Flux 对齐 ADR-0005 项目 golden；零能量 M8 标量为 0；其他 NaN/Infinity 必须显式失败 |
| AC-A04 | Complex Spectrum 一致 | real、imag 分别使用 AC-A03 容差；维度和 bin 顺序一致 |
| AC-A05 | Loudness 一致 | `total` 和 24 个 `specific` 值逐项使用 AC-A03 容差 |
| AC-A06 | 展示量化误差可界定 | 反量化误差不超过半个量化步长加 AC-A03 容差；饱和必须被测试并禁止静默裁剪有效范围 |
| AC-A07 | 精确游标值不使用量化显示值 | 与游标原始 frame 的直接 Meyda 结果满足 AC-A03 |
| AC-A08 | 缓存身份正确 | trackHash/configHash/featureId 任一变化均 miss；完全一致才 hit |
| AC-A09 | stale job 被隔离 | 已取消或旧 generation 的 progress/result/error 不改变当前 store、cache 或 Canvas |
| AC-A10 | 特征登记与累计产品覆盖完整 | M6 registry 对 `analyzerData.ts` 21/21 abbreviation 穷尽，每项有 shape、renderer、range、实际 dimensions、delivery milestone 与 Worker support 状态；各项黄金、renderer 和可用卡片按 M7–M10 累计，只有 M10 可声明 21 项产品覆盖完成 |

若某特征因 Meyda 本身的数值稳定性需要更宽容差，必须提供固定 fixture、误差分布、原因和独立批准，并以 feature-specific exception 写入本文。

## 4. Playback and Synchronization

| ID | Criterion | Threshold / method |
| --- | --- | --- |
| AC-S01 | 播放游标同步 | 稳态播放、pause、seek、切歌和 ended 后，显示游标相对 AudioContext 基准绝对偏差 ≤100ms |
| AC-S02 | seek 正确 | Canvas/键盘 seek 被裁剪至 `[0,duration]`，播放中重建 source 后继续；暂停中保持 paused |
| AC-S03 | 刷新状态 | 刷新后无自动播放，时间为 0；旧 session 的 playing/time 不被恢复 |
| AC-S04 | 单一实时上下文 | 同一 app session 只创建一个实时 AudioContext；重复 load/route 不增加 |
| AC-S05 | MusicBar 不回归 | 现有播放、暂停、上下首、进度、音量和能量响应通过批准的回归脚本 |

游标测试至少覆盖 0 秒、尾部、播放 60 秒后的稳态、连续三次 seek 和播放中换歌。

## 5. Responsiveness and Capacity

| ID | Criterion | Threshold / method |
| --- | --- | --- |
| AC-R01 | 输入反馈 | 在目标最大输入分析期间，选卡、换卡、播放/暂停和 seek 的可见反馈 ≤100ms |
| AC-R02 | 主线程长任务 | 分析 start–complete/cancel 区间内无可归因于分析计算的主线程 task >50ms |
| AC-R03 | 显示采样上限 | 持久化/传输的 display series ≤30 samples/second |
| AC-R04 | 活动计算上限 | Worker 每个 job 最多四个唯一 feature；不预计算全部 21 项 |
| AC-R05 | 数据上限 | IndexedDB 只存在当前 Blob 和当前 track 当前配置的活动分析缓存 |
| AC-R06 | 资源清理 | 反复 20 次换歌/换卡/route 销毁后 Worker、AudioNode、RAF、object URL 不单调累积；无未处理异常 |

不设置全曲完成 wall-clock SLA。15 分钟分析必须显示进度、允许取消，并让当前播放/交互保持可用。

## 6. Recovery and Failure

| ID | Criterion | Expected behavior |
| --- | --- | --- |
| AC-F01 | 当前 Blob 恢复 | 文件句柄权限为 prompt/denied 时，当前歌曲仍从保存 Blob 恢复 |
| AC-F02 | 邻近权限顺序 | 其他歌曲按下一、上一、下二、上二顺序查询；查询本身不弹权限 |
| AC-F03 | 用户触发权限 | 只有用户点击“恢复访问”后调用 `requestPermission()` |
| AC-F04 | quota/cache 失败 | 当前页面播放继续；显示不能持久化；刷新后重算，不伪造 cache hit |
| AC-F05 | 文件移动/变化 | 明确显示 missing/changed；旧 cache 不复用；其他歌曲和当前 Blob 不受影响 |
| AC-F06 | Worker 失败 | 对应卡显示可重试错误；播放和其他卡继续 |
| AC-F07 | decode/格式错误 | 无效 track 显示可理解错误，不使队列/store 卡在 loading |
| AC-F08 | schema version | V1 完整恢复；未知版本进入明确恢复错误或安全清除流程，不猜测字段 |
| AC-F09 | 清除会话 | session、handle、Blob、cache 全部删除，内存 engine 可按 UI 规则继续或显式清空 |

## 7. Accessibility and Viewports

| ID | Criterion | Evidence |
| --- | --- | --- |
| AC-U01 | 核心键盘任务 | 播放、切歌、seek、选卡、换卡全部不用指针即可完成 |
| AC-U02 | 焦点和名称 | 所有交互控件有可访问名称和可见焦点；换卡/错误后焦点位置可预测 |
| AC-U03 | 非颜色表达 | 图例有文字/刻度/图形或数值；DOM 提供游标精确值与摘要 |
| AC-U04 | Reduced motion | `prefers-reduced-motion` 下关闭非必要过渡，游标仍准确 |
| AC-U05 | Viewport geometry | 390、1024、1280、1920 CSS px 无关键控件遮挡/越界；sticky 与 overlay 层级正确；Canvas CSS 与 backing store 尺寸正确 |
| AC-U06 | Runtime cleanliness | 三视口和核心流程无 console error/warn、pageerror 或未处理 rejection |

## 8. Browser and Format Matrix

| Browser | MP3 | WAV | FLAC | IndexedDB | File permissions | Status rule |
| --- | --- | --- | --- | --- | --- | --- |
| Latest stable Chrome desktop | Required | Required | Required | Required | granted/prompt/denied | 自动化 + 手工证据 |
| Latest stable Edge desktop | Required | Required | Required | Required | granted/prompt/denied | 必须有真实 Edge 证据 |

当前未发现 Edge 安装时，Chrome 可单独通过，但 AC 浏览器矩阵整体不能标记完成。

## 9. Milestone Exit Rule

里程碑只能在所有适用 AC 有证据、相关风险已复核、失败/边界路径已覆盖后关闭。不能自动验证的路径必须写出原因、手工步骤、结果和残余风险。
