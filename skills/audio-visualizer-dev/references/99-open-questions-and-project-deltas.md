# 开放问题与工程差异

产品问题见[开放问题](../../../docs/product/open-questions.md)，当前源码入口见[system map](../../../docs/context/system-map.md)。本页只保留仍影响工程判断的缺口。

| 事项 | 当前边界与复核条件 |
| --- | --- |
| CI | 现有证据为本地运行，未建立正式CI承诺；需要CI/多人合入时另行决定 |
| 资源 | 历史M11及后续专项有资源循环证据，LightBg释放问题已有修复；所有权/浏览器/renderer变化后仍测当前计数/heap，不把旧通过当永久保证 |
| readiness | Editor/Visualizer整体评审仍有独立缺口；当前页面已实现，TestLands等仍是试验内容，功能实现不等于产品整体就绪 |
| 包体/依赖 | 大chunk、旧esbuild advisory和无正式包体预算的历史记录见[readiness](../../../docs/quality/release-readiness.md)；当前依赖状态以实际lockfile/审计为准，不沿用旧“当前macOS/零漏洞”断言 |
| 原生权限 | OPFS/stub自动化不等于OS picker/权限气泡/文件移动；相关实现或浏览器变动时复核真实流程 |
| Meyda Flux | 上游x未定义缺陷保留，项目Flux按ADR-0005与独立golden缓解产品，不声称修复依赖 |
| FT/识别 | 当前汇总听感/耗时按DEC-074接受；新识别质量、原生OS与完整正式候选/后续链性能仍独立，见[processing验证](../../../docs/quality/processing/validation.md) |

skills/是维护源，.agents/skills为生成入口；按任务读取，读取文档、skill及引用文本必须显式指定UTF-8参数（如`Get-Content -Encoding UTF8`、`rg --encoding utf-8`），更新后skills:install，不再向全局目录安装。本次工作树以实际git状态判断，不把历史任务的一次未提交文件当持续事实。

依赖/命令/路由、状态所有权、数据隐私、支持矩阵、CI或发布改变时复核对应契约与用户授权；不恢复旧阶段审批或建立新的过程文档副本。
