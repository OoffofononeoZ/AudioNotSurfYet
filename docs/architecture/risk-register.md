# 当前风险与复核触发器

核查日期：2026-10-19。owner为project-owner。本页保留当前开放/接受风险及仍影响工作的上游限制；已结束阶段的完整风险表由Git的`0bd2a67:docs/architecture/risk-register.md`查回。历史Mitigated不证明最新实现已完成整体评审。

| ID | 状态 | 风险、边界与复核条件 |
| --- | --- | --- |
| R-005 | Accepted | 文件句柄权限不能保证跨会话持续；当前Blob恢复、显式requestPermission和可见状态保持。原生文件/权限实现或浏览器变化时复核 |
| R-018 | Open | 上传、未定义页面或服务端能力超出当前范围；Visualizer/Editor已实现，旧“等待V0架构”不再适用。新增范围由owner决定 |
| R-019 | Accepted（历史Analyzer候选） | 大chunk与尚无正式包体预算；M14接受1,300.63kB只绑定原候选W-001。chunk增长、首屏问题或托管/预算确定时复核，不声称当前包体优化完成 |
| R-020 | Mitigated（产品侧） | Meyda spectralFlux上游x未定义错误仍存在；项目Flux/golden缓解产品。依赖、公式、零值或cache/exact语义变动时复测 |
| R-025 | Open | E10及后续标记交互、批量/数字录入可能影响DOM/焦点/指针/性能；按最新Editor契约检查≤100ms反馈、无>50ms归因长任务与资源清理，历史批准不自动关闭观察 |
| R-043 | Open | 新元素/预设的绑定、四特征、确定性、资源、strict V4及离线导出风险；按DEC-082/084批准具体合同和针对性验证，不继承旧Scene生成步骤或整体readiness |
| R-044 | Open | 小节选择/复制/移动跨轨误选、部分提交、ID/秒数漂移、pointer或离页决策残留；预校验后原子命令、单owner临时态与安全取消，完整正式证据/人工缺口仍独立 |
| R-045 | Open | 全屏状态/唤醒/播放时间或输出/路由生命周期分叉；以Fullscreen事件为事实源、同Canvas及timer/listener对称释放。旧候选owner视觉确认缺口保留，不将新专项泛化为整体readiness |
| R-046 | Open | WebGPU/adapter/ORT/四图兼容；固定原图与官方JSEP已有独立harness成功，旧Asyncify创建失败仍保留。runtime/backend/图变化复核实际kernel/parity，不自动CPU或小模型fallback |
| R-047 | Open | resample/OLA/延迟/长度造成标记或视频漂移；原PCM身份、独立脉冲oracle、44.1/48kHz/尾部≤1sample与WAV/实际媒体检查。模型/config/codec变化重测 |
| R-048 | Open | immutable模型/ORT资产/许可/缓存漂移；实际bytes/hash已验证，不再称“未下载”。asset/config变化重新校验、checksum错误拒绝发布，公开来源与许可可追溯 |
| R-049 | Open | 参考机完整分离加节拍性能/内存；历史Chrome分离1011.9541秒>900秒，DEC-074只接受当前功能耗时。Edge普通profile长曲及P3/P6完整链独立，不外推其他设备 |
| R-050 | Open | 取消/换歌/离页/崩溃后GPU/session/OPFS残留或迟到发布；job/source/generation、防护terminal、五秒清理或residual登记，20次资源检查，保留旧完整结果 |
| R-051 | Open | 10GiB与origin quota、IDB/OPFS发布和checksum身份；先完整artifact后metadata，写时失败反馈，无自动驱逐。浏览器可能清除origin数据，容量估算不是保证 |
| R-052 | Open | row错位、单模型冒充四轨、角色/串音/伪影；四模型只取专用row，other不称lead。当前部分串音按DEC-074接受，模型/角色或新质量声明须另行复核 |
| R-053 | Open | 尚未完成逐拍/局部tempo对静音、空鼓、变化、半速倍速与评分的误导；mix主输入、drums辅助、golden/警告、无可靠结果为空，人工确认meter，不伪造概率/downbeat |
| R-054 | Open | 尚未完成proposal/apply/tempo刷新可能覆盖用户或使用旧数据；canonical hash/diff、逐项选择、原子替换、保留人工marker/binding，stale输入拒绝输出并要求显式刷新 |
| R-055 | Open | 有效剩余风险为compact处理数据的尺寸/身份/provenance、tempo-derived downbeat与strict codec；旧V1→V2迁移/双写方案已失效。当前V4尚无processing扩展，后续格式变更须明确批准和独立验证 |

## 验证与证据规则

- 按实际改动复核对应风险，不要求普通任务新建阶段计划、风险副本或readiness。只有可复现证据支持且满足相应人工边界，才调整风险状态。
- 验收阈值和独立oracle见 [Analyzer](../quality/validation.md)、[Editor](../quality/editor/validation.md)、[Visualizer](../quality/visualizer/validation.md)、[processing](../quality/processing/validation.md)。故障注入不等于真实GPU/OS/听感验证。
- [Analyzer readiness](../quality/release-readiness.md)的W-001–007、[Editor readiness](../quality/editor/release-readiness.md)的W-ED-001–006及[Visualizer readiness](../quality/visualizer/release-readiness.md)各绑定原候选。DEC-074/075不自动关闭完整P1/P2或整体readiness。
- PROD-015继续阻断生产发布。改变范围、隐私、支持矩阵、性能阈值、工程格式、重要架构或发布决定由owner确认；缺失必要输入只阻断依赖它的工作。
