---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/delivery/processing/acceptance-criteria.md"
  - "docs/quality/processing/eval-plan.md"
  - "docs/quality/processing/evidence-index.md"
  - "docs/architecture/processing/model-artifacts.md"
next_action: "DEC-071 已批准短段 max absolute 1.5e-3；继续原图双浏览器、真实拼接/WAV、取消、试听和十五分钟验证；P1 未完成"
---

# FT Numerical Gate Review

## Observed Result

实现候选 `6d575ff` 保留四个固定 fp16weights 原始 ONNX、ORT 1.30.0 官方 JSEP 资产和显式 WebGPU；GPU 与独立 WASM reference 均 disabled 优化、numThreads=1。固定非零 stereo fixture 的 Chrome/Edge 四图均可推断，shape、finite、对应 row 和实际 GPU Conv/ConvTranspose profile 通过。

两浏览器同一结果：drums max=0.0012997835874557495、RMS约0.0000359；bass=0.0002854093909263611、other=0.0008603809401392937、vocals=0.000008197035640478134。drums 的最大偏差位于frame343969，约45个sample超过0.001。原1e-3门禁明确失败，P1不关闭、P2不开放。原始数据和失败记录见 [evidence](evidence-index.md)。这是固定短段的观察，不能推断所有歌曲质量或长曲性能。

时域分支已包含主要偏差，首层输入的std/归一化也有差异；尚未证明完整根因。隔离诊断中的矩阵/转置卷积补偿累加、两遍方差、NHWC、限制/禁用常量折叠、位置编码预计算均未让drums达标；将六个全局ReduceMean改为Float64的诊断图仍约0.001302，未采用。所有原模型和默认官方运行库保持原字节，失败不转成expected pass。

## Approved Decision

DEC-071 只把四个专用模型对应row的短段跨后端最大绝对误差上限改为 `1.5e-3`。相同原始ONNX、PCM、padding/config、独立WASM和完整sample比较仍为硬要求；RMS只报告，不代替max；shape/finite/时间/WAV/质量/取消/性能门禁不变。

理由：当前官方浏览器后端已经能运行，三轨通过，drums超出原阈值约0.00030；保留官方资产和原始模型可避免维护尚未证明有效的图/运行库改写。该批准不是质量已通过的判断，也不是发布豁免。

先同步AC-P102、eval、golden与failure taxonomy的数值标准及决定记录，再以干净候选重跑双浏览器原图、真实拼接/WAV、故障/取消、三首12轨试听和十五分钟性能。R-046–R-055仍Open，任何不可用试听、OOM、错误角色或超时仍阻止关闭。

## Approval Boundary

2026-10-04，owner 明确回复“批准 0.0015，继续完整验证（推荐）”，本文件与此项数值门禁按 DEC-071 获批。此批准不表示试听、WAV、取消、十五分钟性能或 P1 已通过。DEC-069及[milestone plan](../../delivery/processing/milestone-plan.md)保留“新产品/架构/兼容/阈值与发布决定仍需人工确认”；代码和阶段提交的既有授权继续有效。
