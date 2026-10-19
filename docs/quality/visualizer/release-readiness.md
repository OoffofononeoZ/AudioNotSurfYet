# Visualizer 历史 Readiness 与待审边界

整理核查日期：2026-10-19。V1–V6功能及canonical曾获批准；整体readiness仍in-review，旧候选为pre-fullscreen。当前V4资源组合与离线导出需要自己的候选/适用证据，不继承旧结论。

## Candidate Identity

| Field | Value |
| --- | --- |
| V6 implementation | `ef12ce397d0b1a054ce797bfa1b9ff5eb5af61cd` |
| V6 evidence registration | `636e4d2defeb90147e949bcf20b7b0690dd77424` |
| V6 canonical | `V6-2026-09-03T16-33-03-497Z-ef12ce39`；54/54 |
| V6 summary SHA-256 | `695bf0acf3831907b720551c7772ea07e0dd80a5db38e829cba868f12128a014` |
| Viewport revision implementation | `9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c` |
| Candidate status | `pre-fullscreen`；DEC-058 实现后需重新审阅 |
| Browser environment | Chrome `152.0.7977.66`；Edge `152.0.4191.53` |

## Viewport修订证据

原clean实现9f3b55beaa0c8a3d799f3f1e16f1dd66c9aee77c，登记提交22dea86：Chrome/Edge各2/2，覆盖1024×720、1280×720/900、1920×1080及DPR1/2。document/body/page不超过viewport、window.scrollY=0，双侧scrollTop/边界chaining、共享scrollbar、compact drawer与16:9/单Canvas/renderer/RAF通过。

相邻V1双浏览器各4/4、V6 integration10/10、M7 Chrome5/5及当时docs/harness/types/build/diff通过，console/pageerror无异常。该自动化没有关闭owner对一屏构图、滚动手感和scrollbar视觉的确认。

## 未关闭边界

- RR-VIS-001-MANUAL：原viewport候选最终视觉确认未登记。
- RR-VIS-002-FULLSCREEN / R-045：DEC-058原全屏候选的构图、2秒隐藏、唤醒、暂停常驻、Escape/重复点击、锁和cleanup交由owner审阅；当时跳过的自动化不记为通过。新功能专项不自动关闭这项旧评审。
- PROD-015：生产托管/域名/HTTPS URL/SPA fallback未定，持续阻断上线。

V6原54/54、六个默认WebM和人工保存/回放等边界保存在[evidence](evidence-index.md)及[历史输出测量](../../context/visualizer-output.md)。它们不证明当前新工程、离线编码或其他设备/长曲通过。

当前工作按[页面接口](../../architecture/visualizer/interface-contracts.md)和[验证](validation.md)推进；只有明确正式评审任务才固定新candidate、审阅适用媒体/资源/人工证据，并由owner决定整体结论。本次文档清理不产生readiness waiver、上线或发布批准。
