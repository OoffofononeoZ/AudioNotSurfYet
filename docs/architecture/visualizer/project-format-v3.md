# Visualizer Project V3 与元素组合

owner 于 2026-10-15 随改版计划批准本接口和兼容决定。本页为当前实现契约；[Project V1](project-format-v1.md) 与旧 binding/scene 文档保留历史候选语境。

## 工程与兼容

- format 仍为 audiosurf-visualizer，schemaVersion 为 3；新建、草稿、导出只写 V3。V2 曾为处理绑定方案预留，本轮不实现 processingSnapshot。
- 顶层包含 projectId、createdAt/updatedAt、同歌 track、16:9 output、全工程 seed、elements，以及可选的已验证 EditorProjectV1 快照。Editor 格式不变。
- 元素包含稳定 UUID、已注册 type/version、name、enabled、layer、timing、完整 bindings；影响效果额外包含 targets。新工程 elements 为空。
- bindings 复用 constant/analysis、FeatureRegistry component/projection 和数值映射；不允许 editor-event、分轨分析、脚本或远端资源。全工程最多四个不同 Analyzer 特征；仅启用元素参与当前分析请求。
- strict codec 拒绝未知字段、类型/版本、非法数值、重复 ID、跨歌快照、失效标记/目标和不兼容投影。导入候选完整校验后才原子替换工程。
- 输入或转场尚未选择时使用明确 unbound，效果可以暂时没有目标，草稿可保存；启用的未配置元素阻止录制。
- V1/V2 JSON 导入直接拒绝。原 IndexedDB database/store/version 保持不变；旧版或无效 envelope 只读保留，提供原始 JSON 导出、明确覆盖、取消，不能静默清除或自动转换。
- 同歌草稿自动恢复，异歌单草稿仍需明确处理；列表直接选歌和删除当前歌曲在变更音频前处理覆盖，取消保持歌曲/工程。清空队列不清除 Visualizer 单草稿。
- 250ms 合并串行写入，并发 flush 等待同一次完整 drain；失败保留内存及最新 pending，beforeunload 提醒，显式重试或导出后处理。Editor 异步刷新以最新请求为准，非法刷新不替换现有快照。

## 时间与效果

普通视觉/影响元素使用歌曲秒数的手动起止时间。转场只引用同歌 Editor 快照的单个 range laneId/eventId，起止时间跟随快照，只读显示；Editor 数据仅显式刷新，不猜测音色或 FX 名称。

目标为整个合成画面，或多个视觉元素 ID；效果不能引用其他效果。指定目标分别处理，再按 layer 和稳定列表顺序合成，最后执行整体效果。删除视觉元素原子移除目标引用，保留效果供重新配置。

转场前为起始透明度，转场后保持终值。对同一目标，后开始的转场接管；同起点按较高层级及稳定顺序接管。不会把已经淡出的终值与后续淡入相乘。

## 资源与录制

单 RendererHost、WebGLRenderer、输出 Canvas、视觉 RAF；三个可复用离屏 render targets 完成目标处理和整体处理。shader、几何及 targets 在重试、context loss 和离页时释放。

参数解析以绝对歌曲时间为准，标量平滑为固定 60Hz 与一秒 checkpoint。弦线固定 60Hz 采样、120Hz 积分、一秒 checkpoint；seek/循环重建，不能累加 RAF delta。

预览随 MusicBar 留位和侧栏变化 resize；录制复用同一画布，严格 preset/DPR 1。音频服务的录制传输租约优先于单曲循环，到末尾只收尾一次；pre-Gain 音频、能力矩阵、保存/取消和产物离页保护继续有效。

当前新工作区及分阶段验证状态见 [组合工作区](../../context/visualizer-composition.md)。历史 V1–V6 evidence 不证明当前组合模型 readiness。
