# 开放问题与已决定边界

核查日期：2026-10-19。只保留仍影响当前工作或未来明确任务的问题；已被替代的单场景、V2迁移、实时录制和通用阶段门禁不再作为要求。

## 未解决问题

| ID | 问题与当前边界 | 重访条件 |
| --- | --- | --- |
| PROD-013 | 当前音频本地处理；上传、云端、账户或同步尚无产品/隐私/服务设计 | 具体远端能力被提出时由owner决定 |
| PROD-014 | Home/Analyzer/Editor/Visualizer已有职责，其他未定义导航入口不自动进入交付 | 具体页面任务明确时 |
| PROD-015 | 托管、域名、HTTPS生产URL、SPA fallback未定，继续阻断上线 | owner明确启动发布工作 |
| PROD-016 | 学习效果仅owner 3/3，未证明更广用户效果 | 对外声明或用户范围扩大 |
| PROD-017 | Editor目前只有JSON V1，尚无明确外部交换格式需求 | 有实际外部工具或交换任务 |
| PROD-018 | Editor已有内部BPM估计；不据历史“尚未实现”引入新依赖 | 现有算法在批准质量阈值下不足，新增依赖先说明并获批 |
| PROD-019 | 同类范围不重叠、无自动合并/裁剪，当前按显式细分与规范秒数编辑 | 新复合效果/自由时间任务需要改变语义 |
| PROD-022 | 全工程最多四种唯一Analyzer特征，native不占额度 | 必须使用第五项的新任务，需复核调度/cache/内存/格式 |

## 当前采用的决定

- PROD-023：自动优先、人工可修正、完整手动制作；具体范围见[产品说明](scope.md)。
- PROD-024：原始四FT专用模型、官方ORT/WebGPU、IDB/OPFS、本地音频和单处理槽；实际证据见[FT记录](../quality/processing/evidence-index.md)。
- PROD-025：已批准逐拍/局部tempo的TS路线和人工小节/BPM/meter确认，仍未完成；精度和性能见[处理链验证](../quality/processing/validation.md)。
- PROD-027：只读提案、逐项确认、compact数据及显式tempo刷新仍有效；旧V1→V2格式规定被DEC-084的V4-only替代，当前V4无processing source扩展。
- PROD-028：视频输出现为DEC-081离线确定性WebM；旧实时限定已删除。
- PROD-026/029：MIDI、自动长音色/FX、3D辅助分析仍延后。原子视觉内容按DEC-082/084的具体合同/资源包方案处理，不能沿用旧“素材生成全部延后”禁令。

当前功能接受不关闭完整P1/P2或后续P3–P6，新增识别质量仍待owner复核。Editor/Visualizer整体readiness与PROD-015独立，后续入口见[处理链路线](../delivery/processing/roadmap.md)。
