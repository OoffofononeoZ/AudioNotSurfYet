---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-12
upstream_docs:
  - "docs/architecture/processing/editor-separation.md"
  - "docs/delivery/processing/roadmap.md"
  - "docs/quality/processing/validation.md"
next_action: "DEC-074下本轮功能验证与接入收尾完成；完整P1/P2正式评审和原生OS证据独立"
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

## First Clean Candidate

实现提交`05a200fc`的`EditorFT-2026-10-06T14-09-07-843Z-05a200fc`起止同一干净HEAD，summary SHA-256 `23eb91deb3ca4e1afeebd9ec24abff57e211612f7cb5a28512588ebb1b5898a6`，7/9命令组通过。90项非浏览器专项通过；Chrome/Edge各19/20，两个失败均为E7旧聚合圆角≤2px断言遇到此次已授权的10px工具栏。双浏览器新的Editor FT八项及E8/E9/E10、E7 overlay回归均通过；四轨/WAV/provenance、恢复/清理、故障及资源得到真实证据，整体候选仍不登记为通过。

已将E7检查明确分为新工具栏10px和其余人工主区≤2px，继续保留84px工具栏、30px控件、88/72px波形、28px BPM条、44px marker行和全部交互断言；设计依据同步到Editor契约。后续以新干净提交重跑完整runner，失败run保留原身份，不把专项补跑替代正式结果。

修订后的E7 Chrome/Edge专项4/4通过，真实工具栏78px/10px、四控件均30px、人工主区圆角0；overlay固定与pointer-through保持。收尾另修正下载/校验阶段的角色标签：后续专用模型下载显示下一角色，全量PCM/结果校验不标作某个专用模型；增加对应展示回归，不改Worker/kernel或模型。

## Current Functional Wrap-up — 2026-10-12

owner按DEC-074接受当前汇总听感、复杂音乐部分串音及第三首处理时间，允许长曲更长耗时；其他适用测试通过即可收尾本轮。接受范围及本地串音检查见 [owner验收](evidence-index.md#owner-acceptance--2026-10-12)。

`EditorFT-2026-10-11T18-17-14-403Z-acbad9f3-provisional` 起止HEAD=`acbad9f35e352effc3dce631670bc6ef65f178e7`、工作树状态不变；summary SHA-256 `fcedfe94ede488e2a78a500f1f35d5bf07951eb9db545d7666602e25b09c1f3f`。完整9/9命令组通过：文档、固定运行资产、四模型bytes、类型、构建、92项非浏览器、Chrome及Edge各20/20、diff检查；无skip/flaky。日志、截图、8份合成fixture WAV和hash在忽略的同名artifacts/evals目录。

真实浏览器覆盖四原图/正确role provenance、WAV/原PCM、缓存跨解码epoch恢复、marker保留、显式清理、缺GPU、下载取消/重试、换歌/离页、损坏模型、quota与资源释放；并覆盖E7–E10原编辑回归。390/1280/1920空态和结果截图已目视检查，四轨/导出/游标显示正常，分离工作区无溢出；原Header窄屏边界未扩展。

本轮普通功能交付在上述测试及owner接受后完成。运行身份为provisional，`integrationVerified=false`来自runner的clean-canonical条件，不是测试失败；不将本地提交或本次通过冒充完整P1/P2 canonical/readiness。先前沙箱目录权限阻挡的`EditorFT-2026-10-11T18-16-22-520Z-acbad9f3-provisional`为5/9，构建/专项/双浏览器未进入产品测试，原失败日志保留；通过run在授权的正常宿主环境执行。

尚未自动验证原生OS保存/取消/系统播放器回放及owner浏览器生产模型网络（本测试供应固定同字节公开fixture）。这些独立证据不登记为通过，本轮不再追加人工操作阻断功能收尾。报告内原固定试听/性能缺口文本由本次DEC-074记录补充解释；后续runner改为只报告其范围外的完整P1/原生/生产网络检查。
