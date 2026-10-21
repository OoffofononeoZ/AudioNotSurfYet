# Editor 工程格式 V2

核查日期：2026-10-21。owner 以实施 osu 导入计划批准 V2、V1 显式迁移及 10–1200 BPM；完整类型与校验分别见 [types](../../../src/editor/types.ts) 和 [codec](../../../src/editor/projectCodec.ts)。V1 历史基线见 [原契约](project-format-v1.md)，不据历史验证宣称当前 readiness。

## 当前格式

- `format: 'audiosurf-editor'`、`schemaVersion: 2`，文件名仍为 `<歌曲名>.audiosurf-editor.json`。唯一输出 codec 为 `json-v2`；严格拒绝未知字段和未知版本。
- 顶层保留 projectId、createdAt、updatedAt、track、tempoMap、lanes、workspace。歌曲按 SHA-256 与实际解码时长校验；不保存 File、句柄、PCM、绝对路径或播放状态。
- point/range、轨道分类、全局唯一 ID、半开范围不重叠、viewport 和 overlay 校验沿用 V1。所有时间按微秒规范化，拒绝无法安全表示微秒的数值。
- metered 分段增加必填 `beatOriginSeconds`，允许负数或位于区间外；它只决定节拍相位。`startSeconds` 继续决定有效区间，第一段从 0 开始，内部起点严格递增且在歌曲内。
- metered BPM 为 null 或 10–1200 的有限小数。来源为 unset／estimated／user／imported；null 只允许 unset。single-beat 不带 BPM、meter 或锚点。
- 手动输入 0–10（不含 10）转换 single-beat；自动音频识别仍使用现有 20–300 搜索范围，Tap 及导入接受 10–1200。

## 节拍与编辑

相邻拍间隔固定为 `60 / BPM` 秒；网格为 `beatOriginSeconds + n * 拍间隔 / 细分`，n 可为负数。只绘制有效区间和可见窗口；显示稀疏不改变吸附。绘制、鼠标、批量及数字录入共用锚点。

- 新建 metered 段的锚点为 0；新增内部边界继承前段 BPM／meter 并锚定新增位置。
- 移动边界同步平移该段锚点，保持二者相对距离；修改 BPM 保留锚点。
- 删除边界由前段向右延伸，保留前段锚点；手动定时可显式修改节拍起点。
- tempo 操作不改变已有 point/range 秒数。

## V1 显式转换

`readEditorProject` 只处理 V1 与 V2；先按各自版本严格校验，再返回 V2。V1 仍按原 20–300 BPM、原来源枚举和原字段集合校验；每个 metered 的锚点取原 startSeconds。ID、时间戳、事件、工作区及歌曲身份保持原值，single-beat 保持原模式。不修复损坏数据，不推测其他格式。

JSON 导入、Editor 草稿恢复、Visualizer V5 内嵌 Editor 快照共用此入口。Visualizer 外层继续 V5，内嵌快照输出 V2；标记引用 ID 保持稳定。

Editor 草稿 envelope 的 schemaVersion 为 2；数据库 `audionotsurfyet-editor` 及 object store 结构仍为版本 1。恢复 V1 时只产生内存转换及运行时迁移标志，进入匹配歌曲后沿用原子 autosave 写回。取消／校验失败不改持久化记录，quota／事务失败保留旧记录并发布未保存状态。保存文件名与歌曲绑定规则不变。
