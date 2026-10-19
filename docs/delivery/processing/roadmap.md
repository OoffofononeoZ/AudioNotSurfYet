# 处理链当前状态与后续路线

核查日期：2026-10-19。本页替代旧 execution/milestone 四件套中的状态与路线；验收只在[处理链验证](../../quality/processing/validation.md)维护。

## 当前状态与授权

- P0-D 已关闭。P1 FT内核和Editor接入已存在；DEC-072允许先接入，DEC-074接受当前汇总听感与长曲耗时，当前功能已收尾。完整P1/P2正式关闭仍有独立缺口。
- DEC-075分轨试听和有限乐器自动标记已实现并有专项证据；新增识别质量由owner复核。这不等于完成下述P3逐拍/tempo提案。
- DEC-069/070授权已批准路线在全部适用证据及必要人工输入满足后自主推进和分目标本地提交；普通任务不再要求逐阶段文档与审批。新范围、架构、兼容、数值阈值和发布仍由owner决定。
- 当前Editor为V1，Visualizer为V4资源组合和离线导出；旧独立Processor路由、Visualizer V2迁移、SceneRegistry和实时录制要求已删除。未来功能应接入最新架构，不恢复旧接口。

## 剩余目标

| 范围 | 有效目标及完成依据 |
| --- | --- |
| P1/P2正式证据 | 保留原性能失败、Edge普通profile长曲、原生OS操作、完整clean canonical等缺口；本轮功能接受不改写历史门禁结果 |
| P3逐拍与局部tempo | 扩展现有TS flux/onset/自相关与DP tracking，mix主输入、drums辅助；低置信度/静音不伪造拍点，F1/BPM/窗口与完整链性能按验证说明 |
| P4人工确认与应用 | 只读proposal，人工确认小节起点/BPM/meter；canonical hash/diff、逐项选择、并发冲突与原子应用，保留人工工程 |
| P5处理数据与可视化 | compact energy/beat/provenance、当前歌曲identity、显式tempo刷新和stale处理；旧V1→V2格式方案已经失效，当前V4无此扩展，不以整理文档批准新增schema |
| P6完整制作验证 | 当前歌曲→显式处理→人工修正→当前资源映射→保存恢复→离线WebM保存回放；双浏览器媒体、资源/完整性能和人工缺口独立验收 |

任务失败保留明确原因，继续可用原曲、人工标记和手动视频制作；GPU失败不自动切整图CPU/轻量模型。当前FT处理允许更长时间的接受只适用于DEC-074，不放宽P3/P6完整链目标或扩大设备/长曲支持矩阵。

## 技术入口与未进入范围

[当前处理接口与未来提案](../../architecture/processing/worker-and-project-contracts.md)、[Editor FT](../../architecture/processing/editor-separation.md)、[自动标记](../../architecture/processing/editor-auto-marking.md)、[模型](../../architecture/processing/model-artifacts.md)提供技术边界。证据分别见 [P1](../../quality/processing/evidence-index.md)、[Editor接入](../../quality/processing/editor-integration-evidence.md)、[自动标记](../../quality/processing/editor-auto-marking-evidence.md)。

自动长音色/FX、MIDI、3D分析辅助图、任意代码/Shader资源、批量制作及其他输出格式仍未进入当前路线；新增具体原子内容按内容生成合同处理。整体readiness、生产托管与发布独立，PROD-015继续阻断上线。
