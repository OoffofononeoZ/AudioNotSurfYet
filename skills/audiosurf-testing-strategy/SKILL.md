---
name: audiosurf-testing-strategy
description: "AudioNotSurfYet 修改后选择必要验证或判断证据时使用；按文档、逻辑、界面、FT、场景和媒体风险挑选现有专项，不默认累计测试或构建。"
---

# 验证策略

读取文档、`AGENTS.md`、`SKILL.md` 及其引用文本时，命令或 API 必须显式指定 UTF-8 编码参数；PowerShell 使用 `Get-Content -Encoding UTF8`，内容检索使用 `rg --encoding utf-8`。工具不支持时换用支持显式编码的读取方式，不能依赖默认编码或控制台设置；仅列文件名无需编码参数。

按实际行为与影响选择最小必要验证。当前入口见 [命令与领域检查](references/commands-and-domain-checks.md)，详细 runner 见 [tests README](../../tests/README.md)。普通修改不自动创建正式 evidence。

| 改动 | 验证选择 |
| --- | --- |
| 文档或 skill | 元数据、入口、链接、命令与授权边界，读取指示及示例中的显式 UTF-8 参数；手写 Markdown >500 行提示、≥800 行阻断。文字精简需审阅信息保留；不默认运行产品测试或构建 |
| 仓库工具 | `test:tools` 覆盖输出、过期检测、规模边界/批准例外、失败与只读行为；修改的手写代码按显式文件运行 `format:check` |
| 时间、codec、validator、状态或数值逻辑 | 类型检查及相关单元/集成，覆盖适用边界和已发现问题 |
| UI、交互或布局 | 真实浏览器复现目标操作与相邻异常，核对状态、几何、焦点和控制台 |
| 播放、分析、分离或存储 | 相关领域专项、取消/换歌/stale、失败隔离与资源释放 |
| 场景或录制 | 具体合同的映射、确定性、资源与媒体验证，选择受影响的邻接回归 |
| 依赖、打包、资源加载或产物交付 | 运行适用构建及产物检查 |

已有 dev server 可用于诊断，不为小改动再启动第二套服务。成功、失败、边界覆盖按实际影响选择；不逐字测试文档标题，也不镜像实现计算式。

正式 canonical/readiness 才按对应合同执行完整范围、干净实现 commit 和身份记录。保留既有阈值、fixture、golden 和浏览器支持矩阵，不能以日常小范围通过代替正式评审。

无法运行时记录原因、已完成检查、残余风险及适用人工补偿；未运行、失败和通过分别报告。OPFS 自动化不替代原生 picker 许可，静态检查不替代模型推断、媒体回放或试听。交付按 [Git skill](../audiosurf-git-task-delivery/SKILL.md) 同步工具生成物。
