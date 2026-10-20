# ABI 2 工程内标记输入

外部文件夹和资源包不接触歌曲标记。资源只声明能力，加入工程后由用户选定标记；算法只能在 prepareFrame 的输入回调中查询当前实例获准的事件。初始化 create() 不提供标记接口。宿主不发送整个 Editor 工程、轨道名称、BPM、未应用识别候选、音频或未选分类。

## 声明与绑定

算法 apiVersion:2，contract 新增非空 markerInputs，每项 `{id,eventKind,selectionModes}`：eventKind 为 point/range，selectionModes 为非空、不重复的 single/collection 数组。元素定义新增同顺序 markerInputs，额外提供非空 label；可以收窄选择模式，不能改变 ID/类型或扩大能力。

transition 可声明 timingInput，指向其 single-only range 输入。该输入由已有 element.timing 的 editor-range 引用提供，不在 markerBindings 重复保存。普通输入由 Project V5 实例的 markerBindings 以输入 ID 为键保存：

- `{kind:'unbound'}`：尚未选择；启用时阻止导出。
- `{kind:'single',laneId,eventId}`：同歌快照中类型匹配的一个点或范围。
- `{kind:'collection',laneId,innerClassIds?}`：同一轨道的全部分类，或非空、不重复的明确分类集合。轨道存在但没有事件时返回空集合。

资源默认不保存实际绑定；预设模板的独立 markerBindings 必须完整且全部为 unbound。禁止在外部资源中嵌入实际 laneId、eventId 或 innerClassIds。实例的标记绑定随 V5 快照保存，恢复不依赖外部库或当前 Editor 草稿。

## 查询

prepareFrame(frame,input) 可以 await input.markers(query)。

单个输入：`{inputId}`，返回唯一所选事件；不带时间窗口或游标。集合输入：`{inputId,startSeconds,endSeconds,cursor?}`，要求 `0 ≤ startSeconds < endSeconds ≤ 歌曲时长`，可以查询未来窗口供预览布局使用。

返回 `{eventKind,events,nextCursor}`。点事件为 `{id,innerClassId,atSeconds}`，范围事件为 `{id,innerClassId,startSeconds,endSeconds}`。点按半开窗口筛选，范围只要与半开窗口有真实重叠即返回；端点相接不算重叠。结果按起始时间、ID 稳定排序，每页最多 256 项。nextCursor 非空时用完全相同的输入和窗口继续查询，直到 null；不得把第一页当完整结果。游标不允许跨实例、输入、窗口或工程修订使用。

算法只依据获准时间、事件和 seed 计算画面；不修改快照，不自行读取磁盘。返回副本可在算法内处理，不能影响宿主。不要把异步查询用于播放时钟累计触发：相同绝对时间重复求值、seek、循环和离线逐帧必须一致。

输入变化、快照替换、取消或离页后，旧查询失效。缺失引用是错误，不选择同名项代替；合法空集合须按具体合同表现。不同实例的回调不能相互调用，已经结束的帧不能继续使用旧输入回调。

## 版本与验证

ABI 1 的历史源码和帧接口继续支持；仅 ABI 2 可声明和查询标记。包仍为 V2，工程仍为 V5。新增标记驱动内容继续先批准具体 Content Contract。

验证声明收窄、外部包无真实引用、单点/单范围、分类筛选、空集合、分页边界、失效游标、实例隔离、初始化阶段拒绝、刷新/取消/stale 和短离线导出。旧 fade 的范围前后终值及重叠接管必须保持。
