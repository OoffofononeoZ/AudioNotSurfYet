---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-30
upstream_docs:
  - "docs/quality/eval-plan.md"
  - "docs/delivery/acceptance-criteria.md"
  - "docs/delivery/test-strategy.md"
  - "docs/architecture/risk-register.md"
next_action: "由 owner 复核 M6 四项 Worker golden canonical evidence；获批后 M7 再进入首批 Analyzer UI 样例"
---

# Golden Examples

## 1. Evidence Boundary

以下产品、学习、失败和边界样例仍是待各里程碑实现和执行的规范。M3 已生成受控 fixture、manifest 和首批 direct-Meyda golden，并在 clean commit canonical run 中通过 identity/容差检查。M6 新增的产品 Worker 测试已在 clean commit canonical 中对 silence、sine、dual-tone 和 impulse 比较 RMS、Energy、Amplitude Spectrum、Chroma，并登记为 `in-review` evidence；owner 批准前不能关闭 M6，也不表示 M7 UI 或后续 21 项产品行为已经通过。

音频仅允许：

- 由仓库确定性脚本生成的 PCM；
- 从同一受控 PCM master 编码、并在 manifest 中记录 provenance、license、生成命令、编码器版本和 SHA-256 的 MP3/WAV/FLAC。

不得使用或提交用户私有音频、文件路径或不可追溯二进制。

固定分析参数：frame 1024、hop 512、Hanning、MFCC 13、average-mono 和实际分析 PCM sample rate。

### Fixture packaging policy

- M3 提交一个短小、确定性的 PCM master，以及由它生成的 WAV、MP3、FLAC 格式 fixture、生成脚本和 `tests/fixtures/fixture-manifest.json`。
- manifest 只能在真实文件存在时创建；每条记录必须包含 ID、路径、用途、格式、SHA-256、字节数、采样率、声道、时长、source ID、生成命令、生成器/编码器版本与参数、license 和 provenance。
- silence、正弦、双音、impulse 和三个学习样例的 PCM 可以由测试运行时确定性生成，不要求提交重复二进制。
- 15 分钟容量样本必须在运行时生成或缓存于被忽略的本地产物目录，不得提交 Git。
- fixture、生成器、编码器参数或 manifest 任一项缺失时，相关 GE/EV 保持 planned 或 blocked，不能生成黄金通过声明。
- M3 已建立生成器并提交短 PCM/WAV/MP3/FLAC、manifest 与首批 golden；2026-07-28 clean-commit canonical run 通过并记录在 [evidence index](evidence-index.md)。该证据只覆盖 M3 fixture/golden harness，不声明相关产品 eval 完成。
- M6 运行时 golden 使用确定性 PCM，直接调用同版本 Meyda 与产品 Worker/compact codec 对比；Energy 是平台验证项，不改变 M7 首批卡片仍为 RMS、Amplitude Spectrum、Chroma 的批准范围。
- 当前 Meyda `5.6.3` 的 `spectralFlux` 对有效输入抛出 `x is not defined`。M6 把它作为预期缺陷和 R-020 固化，不为追求 21 项表面通过而增加 legacy fallback。

## 2. Success Examples

| ID | Input and preconditions | Action | Numeric expectation | UI and unaffected behavior | Trace |
| --- | --- | --- | --- | --- | --- |
| GE-S01 | 440Hz 正弦，稳定段由低幅度切换为高幅度；frame 避开切换瞬间 | 播放并在两段分别读取 RMS、Amplitude Spectrum、Chroma | 每段与 direct Meyda golden 满足容差；高幅段 RMS 增大；主频峰保持在相同频率区域；A chroma 类保持主导 | 共享游标对齐两段，点击任一卡可 seek；三卡使用同一 viewport | EV-A、EV-S、EV-U；AC-P03、AC-P06、AC-A03；R-010、R-012 |
| GE-S02 | 等 RMS 的 C4+E4 段切换到 G4+B4 段 | 比较切换前后频谱和 12 类 Chroma | 各帧与 direct golden 一致；频谱峰和主导 chroma 类随音级组合变化；RMS 在生成器容差内保持相近 | 图表、精确值和听感解释指向相同时间段 | EV-A、EV-U；AC-P06、AC-A03、AC-A07；R-010 |
| GE-S03 | 相同基频与近似 RMS 的正弦段切换到 harmonic-rich 段 | 比较 RMS、频谱分布和 Chroma | 与 direct golden 一致；RMS 近似不变；后段出现更多谐波能量；主音级仍保持主导但允许可解释的谐波贡献 | 用户能够引用数值/图形说明后段听感更亮，不用颜色作为唯一证据 | EV-A、EV-U；AC-P06、AC-U03；R-010、R-014 |
| GE-S04 | 一首可分析 fixture，选择四个唯一 feature | 缩放、移动游标、替换任一卡并点击图表 seek | 四项 series 身份均匹配当前 track/config/feature；精确值对应游标 frame | 四卡共享 zoom、viewport、cursor；替换卡不创建新播放 session | EV-J、EV-S；AC-P02、AC-P03、AC-A08；R-002 |
| GE-S05 | 当前 track 已保存 Blob、卡片、参数和匹配 cache；handle 权限为 prompt | 刷新页面 | cache 身份完全匹配才使用；无旧 playing/time 数据 | 队列、当前歌曲和卡片恢复；时间 0 且 paused；不自动弹权限 | EV-D；AC-P04、AC-F01、AC-S03；R-005 |
| GE-S06 | 同一短 PCM master 编码为 MP3/WAV/FLAC，manifest 完整 | 在目标浏览器逐一加载、播放并分析适用特征 | 每个格式分别与其解码 PCM 的 direct Meyda golden 比较；不要求有损 MP3 与 WAV/FLAC 逐值相同 | 三格式均进入可播放/可分析状态，元数据和错误状态正确 | EV-A、EV-B；AC-P01、AC-A03；R-008、R-009、R-016 |

## 3. Expected-Failure Examples

| ID | Input or injected failure | Action | Expected result | Unaffected behavior | Trace |
| --- | --- | --- | --- | --- | --- |
| GE-F01 | 损坏或声明格式与内容不一致的本地文件 | 选择并尝试加载 | 不产生 AnalysisSeries、cache hit、NaN 或伪造时长；返回明确 decode/unsupported 状态 | 队列/store 不锁在 loading，其他有效歌曲仍可用 | EV-B、EV-S；AC-F07；R-008 |
| GE-F02 | Worker constructor、message 或 Meyda extract 抛错 | 启动分析 | 对应 job/card 进入可重试错误，不写入不完整 cache | 播放和未受影响卡继续；AudioEngine 不重建 | EV-J；AC-F06、AC-A09；R-002 |
| GE-F03 | job A 取消后迟到返回，当前已是 job B/另一首歌曲 | 快速换歌或换卡 | job A 的 progress/result/error 全部被 generation 与身份检查丢弃 | job B、当前歌曲和 Canvas 保持正确 | EV-J；AC-A08、AC-A09；R-002 |
| GE-F04 | 非当前歌曲 handle 为 prompt/denied | 刷新后查询，再由用户选择是否恢复访问 | 查询不弹权限；未授权 track 显示 permission-required/denied；只有用户操作后 request | 当前 Blob 歌曲仍可播放，队列顺序保留 | EV-D；AC-F01、AC-F02、AC-F03；R-005 |
| GE-F05 | current Blob/cache 写入触发 quota 或事务 abort | 换歌或保存会话 | 内存会话继续，状态为 not-persisted；不存在部分替换或伪造 cache hit | 当前页面播放/分析继续；刷新后允许重新授权或重算 | EV-D、EV-R；AC-F04、AC-R05；R-003、R-007 |

## 4. Boundary Examples

| ID | Boundary input | Action | Expected numeric/result behavior | Expected UI/resource behavior | Trace |
| --- | --- | --- | --- | --- | --- |
| GE-E01 | 全零 silence，覆盖完整 frame 和尾帧 | 提取首批及适用后续特征 | 所有输出必须有限并与 direct golden 一致；RMS/energy/频谱按 Meyda golden 为零或定义值，不允许 NaN/Infinity | 图表显示安静状态而不是缺失数据，精确值和说明可读取 | EV-A、EV-U；AC-A03、AC-U03；R-010、R-011 |
| GE-E02 | impulse 分别位于 frame 起点、hop 边界和 frame 末端 | 逐 frame 提取并检查时间 | frame start 为 `index * hop / sampleRate`；impulse 只影响 golden 规定的 frame | 游标点击定位到相应时间，边界无一帧偏移 | EV-A、EV-S；AC-A02、AC-S01；R-012 |
| GE-E03 | 长度小于 frame、等于 frame、非 hop 整倍数的 PCM | 生成 frame 并提取尾部 | 尾帧按批准规则零填充并与 direct golden 一致，sample count 正确 | 时间轴覆盖真实 duration，不绘制超出歌曲的可点击区域 | EV-A、EV-S；AC-A02、AC-S02；R-011 |
| GE-E04 | 可播放 fixture | 分别 seek 到负值、0、duration 和超过 duration | 时间裁剪至 `[0,duration]`；游标偏差 ≤100ms | 播放中重建 source 后继续，暂停中保持 paused，无异常 | EV-S；AC-S01、AC-S02；R-001、R-012 |
| GE-E05 | 确定性 15 分钟输入，四个代表性最重活动特征 | 分析期间连续执行播放、换卡、缩放和 seek | display ≤30Hz，job 仅四项，exact cursor 仍满足容差 | 每次反馈 ≤100ms，无分析归因 >50ms 主线程任务，进度/取消可用 | EV-J、EV-R；AC-R01–AC-R04；R-003、R-004 |
| GE-E06 | 同一会话反复 20 次换歌、换卡和 route dispose | 记录前后资源与错误 | 不复用错误身份或残留 job | Worker、AudioNode、RAF、object URL 不单调累积，无未处理异常 | EV-R；AC-R06；R-013 |

## 5. Exception Examples

| ID | Exception | Action | Expected result | Unaffected behavior | Trace |
| --- | --- | --- | --- | --- | --- |
| GE-X01 | 已保存 handle 指向的文件移动、消失或内容 hash 改变 | 刷新或恢复该 track | missing/changed 状态明确；内容变化时旧 cache 必须失效 | 其他 track 与当前 Blob 不受影响，用户可重新选择文件 | EV-D；AC-F05、AC-A08；R-006 |
| GE-X02 | IndexedDB session 使用未知 schema version 或损坏 manifest | 启动恢复 | 不猜测字段、不部分恢复错误身份；进入明确恢复错误或安全清除流程 | AudioEngine 可以继续接受新文件，会话可由用户重新建立 | EV-D；AC-F08、AC-F09；R-007 |
| GE-X03 | Canvas context unavailable 或单个 renderer 收到非法维度 | 打开含该卡的 Analyzer | 该卡进入可诊断错误，不显示误导性数值 | 播放、其他卡、DOM 控件与焦点仍可用 | EV-A、EV-U；AC-A10、AC-U02、AC-U03；R-011、R-014 |

## 6. Owner Learning Scoring

对 GE-S01、GE-S02、GE-S03，owner 的回答必须：

1. 指明比较的具体时间段；
2. 引用至少一个 RMS、频谱或 Chroma 的可见值/图形事实；
3. 描述实际听感或音色差异；
4. 建立数值/图形与听感之间的正确关系；
5. 不把相关性表述为 Meyda 未支持的因果结论。

每个样例仅在五项都满足时记为 pass；目标为 3/3。答案可以使用等价语言，原始回答和评分必须作为 owner 签字证据保存。

## 7. Golden Update Rules

- golden 数据必须绑定 fixture hash、生成器版本、Meyda 版本和 AnalysisConfig。
- 更新 golden 时显示旧值、新值、数值 diff 和原因；测试失败不得自动覆盖。
- fixture 编码器或浏览器解码路径改变时，相关 golden 标记待复核。
- 提交的短格式 fixture 必须可由 manifest 中的命令重建并重新计算出相同 SHA-256；无法重建时分类为证据缺口或 FT-EVIDENCE。
- 任何容差变更必须先更新并重新批准 acceptance criteria，随后使本文件和 eval plan 待复核。

## 8. Approval Record

`project-owner` 于 2026-07-28 明确批准本文的样例、fixture 入库政策和追溯规则。批准不表示任何样例已经执行或通过。
