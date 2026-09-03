---
status: approved
owner: "project-owner"
last_reviewed: 2026-09-03
upstream_docs:
  - "docs/architecture/adrs/0018-editor-timeline-recovery-and-marker-alignment.md"
  - "docs/delivery/editor/acceptance-criteria.md"
  - "docs/delivery/editor/test-strategy.md"
  - "docs/quality/editor/e7-eval-plan.md"
next_action: "25/25 scoped/provisional 已通过；等待独立 clean canonical 与 owner 验收，暂不登记 evidence index"
---

# Editor E8 Eval Plan

## Boundary

E8 只评价三项可用性修正：共享时间轴垂直尺寸、不可用 route 的歌曲恢复编排、point marker 视觉中心。工程 JSON、Editor/Analyzer IndexedDB、AudioEngine、AudioSessionService 严格歌曲身份、tempo/point/range 领域事实、overlay 与导入导出格式保持不变。Visualizer V5 已作为独立范围先行提交，E8 不改写其实现或 canonical evidence。

## Evaluation Matrix

| Eval ID | Behavior | Coverage | Method | Pass threshold | AC / risk |
| --- | --- | --- | --- | --- | --- |
| E8-EV-TIMELINE | stage 与波形垂直几何 | 390/1024/1280/1920、resize、DPR | pure unit + Chrome/Edge DOM/Canvas probe | 高度 `72/88/88/88px`；中心 `h/2`；上下 6px；backing store 与 DPR 一致 | AC-E801；R-024/025 |
| E8-EV-EXACT-RECOVERY | URL 同一歌曲重新选择 | missing + correct + repeated state + paused | resolver unit + controller integration + dual-browser E2E | 一次有效 route retry；恢复 ready；保持 paused；无 autoplay/loop | AC-E802；R-022/023 |
| E8-EV-OTHER-TRACK | 当前歌曲与 URL 不同 | paused/playing/ended + click/keyboard | resolver unit + dual-browser route E2E | 不静默切换；CTA 名称含歌曲名；点击 `replace` 后进入当前歌曲 | AC-E803；R-022/025 |
| E8-EV-RECOVERY-FAILURE | 错误文件、权限、hash、decode | content-changed/denied/missing/decode | integration + browser fault path | route/歌曲/工程/草稿不变；仍显示不可用 | AC-E803；R-022/023 |
| E8-EV-MARKER | button/diamond/candidate/event 中心 | 四视口、zoom、pan、DPR | DOM geometry probe | X 均 `<=1 CSS px`；diamond Y `<=1 CSS px`；stem 不影响中心 | AC-E804；R-024 |
| E8-EV-ADJACENT | E1/E2/E3/E7 与 M5 恢复 | success/failure/keyboard/overlay | 25 步 runner | 全部适用步骤 pass；无 pageerror/异常 console；typecheck/build/docs/diff check 通过 | AC-E805；R-022–025/027 |

## Evidence Contract

- `eval:e8:provisional` 允许 dirty worktree，只生成本地忽略 artifact 与实现反馈；它不能更新 [evidence index](evidence-index.md)。
- `eval:e8` 必须在起止同一 clean commit 上运行，否则拒绝。固定 25 步覆盖 E8 unit/integration、Chrome/Edge、E7 unit/integration/双浏览器、E3/E2/E1 关键回归、M5 恢复、docs/harness、typecheck、build 与 diff check。
- 记录四视口 stage/Canvas/marker 实测、恢复后的 route/playback、测试命令、浏览器、run identity、日志与 summary SHA-256；截图只作本地人工补充。
- E8 只有在 clean canonical 全绿并获 owner 验收后，才可把本计划的执行记录写成正式 evidence、关闭 R-022/R-024/R-025 与标记 `Complete`。

## Current Execution State

- 2026-09-03，owner 的完整实施指令批准本 eval 契约并开放 E8。
- E8 在 Visualizer V5 尚未提交时完成三次 scoped/provisional 反馈；V5 独立提交后，owner 已允许单独提交 E8 并运行 clean canonical。
- 首次 scoped run `E8-2026-09-03T03-23-23-119Z-cc83d8b1-provisional` 25/25 通过；随后 recovery signature 把 `paused/playing/ended` 归一为单一 `playback-ready` 机会并增加单测，因此该 run 只保留为 pre-hardening 反馈。
- `E8-2026-09-03T03-27-19-090Z-cc83d8b1-provisional` 在 candidate box 精确居中修订前 25/25 通过，只保留为 pre-centering 反馈。
- `E8-2026-09-03T03-41-39-925Z-cc83d8b1-provisional` 在 V5/E8 分离提交前 25/25 通过，summary SHA-256 为 `5df5b2b7a5f57d30e661c910dcf5d0cbe16b162edfa824162e72226308ab26b5`，只保留为 scoped 反馈。
- 最新 scoped run `E8-2026-09-03T04-04-25-163Z-10a2bc0c-provisional` 在 V5 已独立提交的基线上 25/25 通过，summary SHA-256 为 `829e50c177b14bb81febc81577c179deec0a01d703362083ebf2fa28bc7e5c0a`。它覆盖 E8 Chrome/Edge 各 3/3、E7 Chrome/Edge 各 2/2、E3 Chrome 7/7、E2 Chrome 5/5、E1 Chrome 4/4、M5 Chrome 3/3 及全部 unit/integration/docs/harness/typecheck/build/diff check。
- Chrome/Edge 四视口测量一致：timeline 为 `72/88/88/88px`；marker/diamond/candidate/pin 最大 X 误差为 390px 与 1024px 视口的 `0.009375 CSS px`，marker Y 为 `0.5px`，diamond Y 为 `0px`。同歌恢复保持 paused，异歌只在显式 replace 后进入。
- 浏览器测试未捕获 `pageerror` 或异常 console；Vite 仍报告既有 browserslist stale 提示，build 仍报告既有大 chunk warning。这些 runner stderr 不冒充页面错误，也不改变 scoped 通过结论。
- 本记录不写入 evidence index，不缓解已重开的 R-022/R-024/R-025；clean canonical 与 owner 验收仍未完成。
