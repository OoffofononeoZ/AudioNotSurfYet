---
name: visualizer-content-generator
description: 编写外部 V2 算法元素包与仅引用已有元素的预设；先校验 VisualizerContentBriefV2，再批准具体 Content Contract，获批后封装和验证。
version: 2.0.0
---

# Visualizer 内容生成

本 skill 独立运行，不依赖应用仓库。资源位于用户指定的 assets 文件夹：elements/<id>/、presets/<id>/。输出 V2 运行包，工程和草稿仍为 V5 自包含快照。不生成 ZIP、Git 仓库或历史版本目录。

## 工作流

1. 规范化 [VisualizerContentBriefV2](references/input-contract.md)，临时 brief 放系统临时目录。只记录已知事实，缺少必要视觉/数据/时间语义时询问；可选设计在合同提出默认值。
2. 运行 `node <skill>/scripts/validate-content-brief.mjs <brief.json>`。INPUT_INCOMPLETE 返回路径化问题，停止依赖它的生成；READY_FOR_CONTRACT 仅表示完整，不是批准。不兼容 V1 输入。
3. 阅读 [内容规则](references/content-rules.md)、[资源格式与 ABI](references/resource-format.md)，核对指定资源库。预设只能精确引用已有元素；缺少元素时先单独提出并批准元素合同，生成、封装并验证元素，再创建引用它的预设。禁止预设包夹带新增元素或算法。
4. 展示具体 **Content Contract**：ID/版本、视觉及拆分、算法 ABI、参数/default bindings、静态/静音/低/高状态、数据映射/单位、时间/效果目标、seed/确定性、资源预算和验证。预设另固定清单、顺序、时段、内部引用、共同控件字段/目标/默认值/差异行为。可选默认方案须明示。
5. 输出 AWAITING_APPROVAL，等待明确指向刚展示合同的批准。批准前不得写合同、源码或测试。批准 skill、迁移或实施计划不代表批准任何未来具体内容；合同实质变化须重新批准。
6. 获批后在资源 source/ 保存轻量合同及批准来源。每个资源包含 resource-info.json、preview.svg、source/ 和 resource-package.json。创建者默认 default；创建时间用实际 ISO 8601 时间，重新封装不重置。
7. 在 skill 目录按 lockfile 运行 `npm ci`，再执行 `node <skill>/scripts/resource-library.mjs --build <assets>` 和 `--check <assets>`。源码与 Shader 必须位于自身文件夹内，不依赖其他元素的辅助代码。
8. 按 [验证矩阵](references/test-matrix.md) 检查实际内容。封装不证明算法初始化、GPU、视觉或导出通过。如实报告通过/失败/未运行与必要人工输入，不自动发布或生成 readiness 结论。

## 边界

- 全工程最多四种不同 Analyzer 特征，包含禁用元素；native 不计额度。来源仅 constant/analysis/native 或明确 unbound。Editor range 是转场时间，不是参数来源。
- 算法只在宿主隔离 Worker 运行并返回受控 DrawPacket，不在主页面求值，不创建 Canvas/Renderer/RAF/AudioContext/Worker、网络或存储旁路。宿主统一输入、合成和离线逐帧导出。
- 扩展 ABI、输入能力、工程格式、拓扑、支持矩阵、性能预算/阈值或不明许可资产，先请求独立决定；不得以 fallback 绕过失败。
- V5 快照内嵌算法、Shader、元素及预设。资源更新不得重绑、量化或覆盖既有工程。
