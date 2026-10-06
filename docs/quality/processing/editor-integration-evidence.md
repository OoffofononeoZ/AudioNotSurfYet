---
status: in-review
owner: "project-owner"
last_reviewed: 2026-10-06
upstream_docs:
  - "docs/architecture/processing/editor-separation.md"
  - "docs/delivery/processing/execution-plan.md"
  - "docs/delivery/processing/test-strategy.md"
next_action: "完成Editor界面、真实Chrome/Edge四轨链路和布局/故障/原编辑回归；本次不重跑性能门禁"
---

# Editor FT Integration Evidence

DEC-072明确批准忽略当前处理耗时先接入Editor。本文只记录Editor接入，不关闭P1、不将缺失人工质量/原生保存或十五分钟目标登记为通过。

## Shared Service Checkpoint

2026-10-05未提交实现专项：`editor-result-repository.test.ts` 8项、`editor-separation-service.test.ts` 6项与既有P1 storage/controller/kernel 20项，共34/34通过；typecheck与build通过（固定运行资产准备成功，保留已有Browserslist/大chunk提示）。此为阶段实现反馈，不是完整clean browser evidence。

服务由MainLayout提供，使用其唯一AudioEngine的原始PCM，最多一个分离Worker；测试覆盖结果checksum/metadata身份、原PCM变更、缺失/篡改文件、compact数据/模型/config损坏拒绝恢复，数据库V1→V2增量升级不删旧数据；换歌等待旧任务终态、取消/失败保留旧结果、索引失败清理新结果、运行中拒绝清理、显式清理Editor结果/残留而不删模型/其他任务，URL创建与撤销平衡。

尚未形成Editor真实分离/导出/响应式界面证据。后续追加当前候选的具体日志、截图及失败记录；自动化不冒充owner听感或原生OS结果。

## 2026-10-06 Browser Feedback

Chrome provisional `artifacts/evals/editor-ft-ui-chrome-v4.json` 为6/7：三视口/键盘/reduced-motion、GPU缺失、下载取消/重试、换歌、损坏模型、quota不足通过。四原始模型实际完成分离，四个Float32 stereo 44.1kHz WAV均2116844 bytes，独立解析所有采样finite/nonzero、SHA与发布清单一致；失败发生在刷新恢复检查，不将该组登记为通过。原trace保留于`editor-ft-ui-chrome-v4-failed/`。

快速identity调查确认同一原曲初次descriptor revision=2、刷新后=3，原全量hash包含会话revision而使恢复miss。已修复为当前revision读取/变化防护，使用原结果descriptor header对当前完整PCM重新hash；结果元数据及文件checksum仍独立校验。新增跨解码epoch测试，尚待修复后的完整Chrome/Edge链路。本次未修改FT模型、运行库、数值阈值或处理config。

此前v2供模重定向因本地公共模型endpoint缺CORS而失败；v3已到真实结果，但逐采样带trace断言开销过大，主动中止并保留`editor-ft-ui-chrome-v3-interrupted/`。v4改为一次遍历全部sample、汇总断言，不减少检查范围。以上都是实现反馈，不是clean canonical。独立Node生产模型HEAD请求在本机网络环境均fetch failed；不据此推断用户浏览器或模型URL失效，真实图测试使用受控同字节公共fixture，生产不增加本地备用路径。

Chrome v5已通过四轨/WAV、刷新恢复与人工marker保留，失败是测试未处理原Editor的未导出离页dialog，记录保留于`editor-ft-ui-chrome-v5-failed/`。v6按真实dialog验证“留在此页继续处理 / 确认离开取消”，最终8/8通过（`editor-ft-ui-chrome-v6.json`）；可用四轨、已缓存模型、清理结果/模型、六类交互/故障和跨epoch PCM复核均得到浏览器反馈。修复后存储/服务/展示及E9/E10相关非浏览器专项63/63通过。390/1280/1920空态和结果截图已目视检查：统一深色薄荷配色、角色色、四轨时间列和窄屏堆叠，页内无溢出；原Header的窄屏导航边界沿用，未作为本切片扩展。

界面实现阶段完成，下一步使用`npm run eval:editor-ft`在干净实现commit上验证双浏览器和原编辑回归。以上不提前宣称正式canonical或Edge通过。

提交前补充最后一批PCM复制及完整缓存文件校验结束时的descriptor防护；新增“最后一批被替换”的回归，相关非浏览器专项64/64、build（含typecheck）、docs与diff检查通过。该修订仍保留原hash/模型配置，不修改持久化结果。
