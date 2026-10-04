---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-04
upstream_docs:
  - "docs/quality/processing/eval-plan.md"
  - "docs/quality/processing/golden-examples.md"
  - "docs/quality/processing/failure-taxonomy.md"
  - "docs/delivery/processing/milestone-plan.md"
next_action: "提交验证 harness 并形成 clean canonical 失败记录；复核四图 WebGPU 兼容性，P1 不关闭"
---

# Browser Processing Evidence Index

本索引按 DEC-069/070 接受实际证据记录，包括失败；approved 指记录范围和结论被既定授权接受，不表示 P1 验收通过。模型、合成 fixture、运行资产和日志只保存在忽略的本地产物目录；用户歌曲、WAV、路径和内容 hash 不入 Git。未创建新链 readiness。

## P1 Provisional — 2026-10-04

Run `P1-2026-10-04T09-05-33-154Z-9b361fca-provisional`，summary SHA-256 `67912c3c0c338fa80701c4135331d73ab029bd956a5e0b4df33eb194c74d31f2`。运行起止 HEAD=`9b361fca`，工作树未提交、状态一致；只作反馈，不是最终候选。10 个命令分组中 8 pass、Chrome/Edge 两组 fail；两浏览器各 1 个负向 lifecycle 场景通过、4 个真实图场景失败。原始日志、JSON、trace 位于 `artifacts/evals/<runId>/`，早期 profiling/资产/测试注入错误的 trace 独立保留，未作为模型不兼容依据。

| Eval / AC | Actual evidence | Conclusion |
| --- | --- | --- |
| MODEL / AC-P101 | 四文件共662450544 bytes，size/SHA 全匹配固定表；六项 ORT 资产/npm integrity 校验通过，许可/attribution 已登记 | artifact identity 通过；AC 仍因 session 失败未通过 |
| RUNTIME / AC-P101 | Chrome/Edge × drums/bass/other/vocals，硬件 adapter vendor=nvidia、architecture=lovelace、fallback=false；均在 session-create 失败 | PFT-RUNTIME / S1，阻止 P1/P2 |
| ROLE、TIME、DERIVED / AC-P102–104 | selector、恒等/脉冲、重采样、拼接、RMS/WAV、hash 与流式内核有独立 oracle/注入测试 | 合成/注入通过；真实 FT 推断、拼接及导出未验证 |
| PARITY / AC-P102 | GPU session 创建失败，未运行 WASM 对照 | unverified，不能以 mock 或同 GPU 自对照替代 |
| CANCEL、REGRESSION / AC-P103/106 | 双浏览器各20次缺GPU/取消生命周期，0残留 Worker、0新播放上下文；相关 AudioEngine/analysis Worker 回归通过 | 已验证所列负向路径；真实 FT 压力/推断取消仍未验证 |
| QUALITY、PERF / AC-P105/106 | 没有许可歌曲/试听结论；未进入长曲测速、峰值采样或原生保存/回放 | unverified，不能关闭 |

实际环境：Windows `10.0.22631`、Node `v24.18.0`、RAM `16294899712` bytes；系统 GPU discovery 为 RTX 4060 Laptop、8188MiB、driver591.86。浏览器隐藏 device/description，只能从 adapter 证明 NVIDIA Lovelace，不能把 system discovery 冒充浏览器公开的精确 device ID。kernel placement 未能形成完整图分配记录。

## Failure and Next Action

四个图的原始共同错误为 `/real_istft/ConstantOfShape` node provider 未设置，ORT `TransformerMemcpyImpl::IsNodeCompatibleWithProvider` 失败；发生在实际字节校验后、推断前，不是缺失 WebGPU 或软件下载 fallback。这里只记录现象，不声称已经查明全部底层原因。

P1 保持 In Progress；R-046–R-055 全部 Open，P2–P6 Planned。下一步复核当前图/ORT 兼容方案；本轮没有替换固定模型、运行库版本或后端，没有放宽 parity/时间/质量/性能阈值。必需试听和许可仍须 owner 提供真实结论。

## Reproduction

使用已锁定依赖；`npm run processing:models` 下载/校验忽略目录中的四模型，`npm run processing:assets` 准备同版本资产。`npm run test:e2e:p1:chrome` / `test:e2e:p1:edge` 重现图门禁，`npm run eval:p1:provisional` 产生未提交反馈；干净实现提交后 `npm run eval:p1` 产生正式记录。独立入口 `/tests/processing/index.html` 由 Vite dev server 提供，不在生产路由注册。
