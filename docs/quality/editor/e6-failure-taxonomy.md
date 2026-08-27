---
status: in-review
owner: "project-owner"
last_reviewed: 2026-08-28
upstream_docs:
  - "docs/quality/editor/e6-eval-plan.md"
  - "docs/quality/editor/e5-failure-taxonomy.md"
  - "docs/architecture/risk-register.md"
next_action: "保留 E6 失败历史；owner 人工补偿失败继续按本 taxonomy 阻断审批"
---

# Editor E6 Failure Taxonomy

E6 继续沿用 E1–E5 的 identity、draft、geometry、pointer、focus、overlay、range 与 regression 分类，并新增最终加固失败域。

| Type ID | Failure type | Definition | Detection | Typical response |
| --- | --- | --- | --- | --- |
| EFT-BROWSER-FORMAT | 浏览器/格式不一致 | Chrome 或 Edge 的 MP3/WAV/FLAC route、decode、loop、analysis 或恢复结果不同 | E6-EV-FORMAT | 阻断 E6；修复共享产品路径，不增加浏览器专属 fallback |
| EFT-NATIVE-FLOW | 原生文件/离页流程 | picker 取消、覆盖、权限、保存或 beforeunload 破坏工程/草稿 | E6-EV-NATIVE | 阻断对应人工门禁；保留自动化与原生事实边界 |
| EFT-STRESS-FACT | 容量下数据事实错误 | 10,000 事件丢失、重复、改时、引用损坏或 range 重叠 | E6-EV-STRESS | S0 阻断；修复生成/validator/controller，不缩小数据过门禁 |
| EFT-STRESS-DOM | viewport virtualization 失效 | 一次实例化全工程事件或可见/焦点事件缺失 | E6-EV-DOM | 阻断 E6；修复可见过滤和焦点回退 |
| EFT-PERFORMANCE | 反馈或长任务超限 | 任一核心反馈 `>100ms` 或归因任务 `>50ms` | E6-EV-FEEDBACK | 阻断 E6；减少绘制/DOM/分配，不降低秒数与事件事实 |
| EFT-RESOURCE | 运行时资源累积 | AudioContext、Worker、RAF、Canvas、URL、Observer 或 listener 单调增长 | E6-EV-RESOURCE | 阻断 E6；修复 acquire/release 与卸载 cleanup |
| EFT-A11Y | 键盘/焦点/朗读/动效 | 核心任务不可达、焦点丢失、名称不清或 reduced motion 无效 | E6-EV-A11Y | S1 阻断；修复语义与状态机，不用仅视觉提示替代 |
| EFT-EVIDENCE | canonical 身份不可信 | dirty canonical、commit 漂移、步骤遗漏、环境/hash 缺失 | E6-EV-REGRESSION | 丢弃该 run 的通过资格，保留日志并在 clean commit 重跑 |

| Severity | Meaning | Gate response |
| --- | --- | --- |
| S0 | 工程、歌曲 identity、durable draft 或事件事实损坏 | 立即停止 canonical，不得豁免关闭 E6 |
| S1 | 双浏览器核心任务、性能、资源、键盘或恢复门禁失败 | 阻断 E6 与 Editor readiness |
| S2 | 可恢复的局部布局、提示、焦点或单浏览器非核心差异 | 修复并复跑专项；由影响决定是否重跑全量 |
| S3 | 不影响事实、任务和可访问性的轻微视觉/文案差异 | 登记，由 owner 在人工门禁判断 |

失败 run 必须保留 run ID、commit、环境、日志、summary 和分类。修复后创建新 implementation commit 并重新执行完整 clean canonical，不覆盖失败证据，不以 Chrome 代替 Edge，也不以模拟 picker 代替原生人工结果。
