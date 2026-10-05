---
status: approved
owner: "project-owner"
last_reviewed: 2026-10-05
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/processing/ft-kernel-config.md"
next_action: "按DEC-072接入Editor，验证真实分离、缓存、导出、取消与原编辑功能；性能及人工质量缺口独立保留"
---

# Editor Four-Stem Separation

DEC-072来源为owner明确要求：暂不考虑运行时间，把当前成功分离的实现接入Editor，授权agent决定页面布局、设计和动效，按阶段本地提交。该指令批准当前Editor接入例外：不等待P1性能及全部人工质量记录收口；不将缺口写成通过，不降低全链900秒目标，不开放自动节拍/提案/V2或发布。本文件细化已授权实现，P1历史与R-046–R-055仍保留。

## Workspace and Ownership

- `/editor/:trackId?`复用现有歌曲、播放租约与唯一AudioEngine；ready状态增加“标记编辑 / 音轨分离”两个工作区，默认标记编辑。当前任务在切换工作区时继续，换歌、确认离页、清空歌曲则取消；全应用最多一个分离Worker，无第二个播放AudioContext。
- MainLayout提供单个Editor分离服务，页面组合展示组件；单例串行等待旧任务终态后才允许新任务，generation/source/revision保护覆盖恢复、处理、导出和清理。原Editor V1、人工marker/tempo/overlay、草稿、导入导出不被分离修改。
- 使用四个原始FT专用模型、固定官方ORT、当前PCM/拼接/WAV配置；生产模型地址使用immutable HTTPS模型表，测试仅由网络拦截提供同字节公开fixture，不加入本地模型或CPU备用路径。dev/build自动准备并校验固定运行资产。
- 点击显式开始，先告知缺失模型bytes与本地音频隐私。下载和处理分开计时；显示真实phase、对应阶段单位及elapsed，不伪造整体百分比或剩余时间。初始化无可计量单位时使用不定进度；取消/错误后可重试，原曲播放和人工编辑可用。

## Results and Storage

- 四轨统一原曲绝对时间，waveform min/max与30Hz能量来自现有输出；四角色drums/bass/other/vocals分别展示，other不称lead。概览点击/键盘可跳转原曲，播放游标跟随原transport；本切片不创建stem播放器。导出为真实Float32 stereo 44.1kHz WAV，不把波形截图当音频。
- IndexedDB保存模型、结果metadata及Editor结果校验清单，OPFS保存原PCM/planar/WAV；Editor目录有独立前缀。默认10GiB容量可配置，同时受实际origin quota约束，写前/写时明确失败，不自动驱逐。
- 结果恢复需要当前原PCM全量hash、descriptor/revision、四模型/运行资产/backend/config身份一致；角色、frame、series与文件size/checksum核对后才展示。缺失/损坏拒绝命中，提供重新处理或显式清理；不静默展示旧歌结果。
- 新任务失败/取消保留旧完整结果；rerun不隐式删除旧缓存。完整artifact校验后才发布Editor索引，索引失败清理本次未发布结果。结果清理/模型清理须用户显式操作；运行或验证中拒绝清理，其他Editor/Visualizer草稿不被删除。崩溃残留Editor目录列为可显式清理项，恢复不自动驱逐。
- WAV对象URL归服务拥有，切换结果、换歌、离页/dispose逐一撤销；校验hash有界分块与让出任务，组件动画尊重prefers-reduced-motion。新增可见滚动容器复用app-scrollbar。

## Verification Boundary

验收本切片：真实Chrome/Edge从主应用导入歌曲→Editor→显式分离→四轨真实结果/导出，缓存恢复、失败/取消/换歌/离页、模型与结果清理、原编辑回归及390/1280/1920布局。自动化不替代owner听感和原生OS保存/回放；完整长曲耗时仍记录为未达标，当前任务不以其阻止Editor接入。P2更大范围和P3–P6状态另行按证据登记。
