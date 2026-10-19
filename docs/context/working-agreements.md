# 工作约定

核查日期：2026-10-19。工作规则以[AGENTS](../../AGENTS.md)为准，工具命令见[README](../../README.md)，领域契约从[上下文入口](index.md)按需读取。

## 修改与文档

- 开始检查工作树、分支、暂存区和相关skill，保留用户修改；源码/配置/实际行为与最新明确用户决定是核查依据，历史任务不是当前工作树状态。
- 普通任务更新已有相关专题；独立持续主题才新建。过程反馈放在交付中，不生成阶段三件套、例行canonical或readiness，不使用Harness文档skill。
- 冲突采用最新决定，删除失效旧规定并保留有效目标、阈值、批准和证据缺口。清理前核对工具/测试消费者，迁移后修复正文/frontmatter/skill链接；原文由Git查回，不建归档或读取trash。
- 接口按共享运行时及页面维护，字段链接源码/validator；验证要求在领域validation集中维护。last_reviewed只更新实际核查内容。
- 代码推荐≤1000行、>1300警告、>2000阻断，具体例外需owner批准文件/额度/原因。正常排版，不压行；Vue按完整功能区域拆分，详见[模块skill](../../skills/audiosurf-file-modularization/SKILL.md)。
- 手写Markdown建议≤500行、>500提示、≥800禁止提交；精简文字，保留正常结构。可能损失关键内容时保留原文并汇报/停止提交，不靠拆行、长单行或历史豁免过门禁。

## 验证和证据

- 按改动风险选择相关静态、Vitest、浏览器、媒体或性能专项；命令与fixture见[tests README](../../tests/README.md)，不默认累计eval或应用构建。
- 几何测DOMRect/Canvas、边界/焦点/滚动与资源；短fixture计时先归零并确认playing，页面内真实时间窗优先于跨进程固定等待。高频DEV诊断不泄露File/PCM/Worker内部对象。
- 原生OS权限/保存/回放、辅助技术、试听和GPU/性能结论必须有真实结果；OPFS/stub、合成、注入和安装检测只证明其有限边界，不冒充实际Edge或人工检查。
- 日常反馈、未运行、环境阻断和产品失败分开报告。正式canonical需起止同一clean implementation commit、真实环境、run/summary hash和必要人工输入；历史pass不证明当前候选。
- 既有Editor readiness按DEC-055交由owner审阅，不申请旧任务沙箱外重跑；DEC-075另行允许新增能力/回归的本地端口与Chrome/Edge，见[授权登记](decision-registry.md)。
- DEC-074接受当前FT汇总听感/长曲耗时，历史1011.9541秒超900秒不改写，未提供的12行/第三首秒数/OS记录不补造。完整P1/P2、P3/P6完整链性能、整体readiness与PROD-015独立。

## 交付

按[Git skill](../../skills/audiosurf-git-task-delivery/SKILL.md)同步skills:install/codemap、repo:check和diff检查，工具变更补test:tools。多个小目标逐个完成验证并分别本地提交；单目标可一次提交。仅暂存对应内容，不推送、发布、切换分支或改写历史。

只读任务不生成或提交文件。Git忽略的原始需求和本地产物保留其用途/许可边界，不按文档清理顺带删除。
