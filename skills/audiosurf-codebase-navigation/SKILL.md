---
name: audiosurf-codebase-navigation
description: "定位 AudioNotSurfYet 的代码入口、模块职责、依赖或调用方时使用；结合生成地图与局部搜索，不负责实现或全量文档审计。"
---

# 代码定位

读取文档、`AGENTS.md`、`SKILL.md` 及其引用文本时，命令或 API 必须显式指定 UTF-8 编码参数；PowerShell 使用 `Get-Content -Encoding UTF8`，内容检索使用 `rg --encoding utf-8`。工具不支持时换用支持显式编码的读取方式，不能依赖默认编码或控制台设置；仅列文件名无需编码参数。

结构问题先看 [代码地图](../../docs/CODEMAP.md) 的相关区域；职责与设计原因看 [system map](../../docs/context/system-map.md)，口头术语先对应 [glossary](../../docs/context/glossary.md)。已知符号、报错、路径或文案直接用 `rg -n --encoding utf-8`，查文件用 `rg --files`。

显式排除 `trash/`、依赖和构建/测试产物，只读命中附近实现及必要导入，再追调用方。地图只识别有限静态本地引用，不证明运行时调用、动态注册或同名符号的完整关系。未命中的 Worker URL、动态表达式或别名回到源码核实。

音频与会话看 `src/audio/`，特征和分析 Worker 看 `src/analysis/`，标记/tempo/工程看 `src/editor/`，FT 与缓存/任务看 `src/processing/`，场景/绑定/录制看 `src/visualizer/`。页面装配与组件在 views/layouts/components；状态和持久化分别在 stores/persistence。

新增 helper 前核对这些目录及相关测试，优先扩展已有单一事实源。只读检查用 `npm run codemap:check`；结构与引用改变后在任务交付时运行 `npm run codemap`。
