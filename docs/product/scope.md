# 产品范围与成功标准

核查日期：2026-10-19。面向本地音频可视化视频创作，自动优先、可人工修正，也能完整手动完成制作。当前界面、技术契约与验证从[上下文入口](../context/index.md)进入。

## 当前能力

- Home/MusicBar提供本地歌曲队列、metadata/封面、播放/seek/音量和四种播放模式；共享歌曲、音频时钟和最近会话恢复。
- Analyzer展示当前注册特征及Wallpaper风格频谱，单列原列表与最多四项FIFO常驻区，共享时间/精确值；owner指定的专业说明完整保留。
- Editor提供tempo/point/range、独立marker时间视图、overlay、草稿/换歌保护、播放数字录入、FT四轨/试听、有限乐器自动标记和显式人工修正/应用；工程写入V2并显式迁移V1。
- Visualizer采用V4原子元素、分组预设、共同处理参数、JSON资源包过渡版、本地资源库、原生输入与离线WebM导出。新增元素/预设先批准具体内容合同。
- 原有自动处理路线尚未完成的逐拍/局部tempo、只读提案和处理数据映射见[剩余路线](../delivery/processing/roadmap.md)。已批准目标、已实现与已验证分别记录。

## 支持与数据边界

- 本地MP3/WAV/FLAC，最新桌面Chrome/Edge，安全上下文HTTPS或localhost。约15分钟为既有目标输入；更长音频可作观察，DEC-074允许当前FT长曲更久，不扩大后续完整链性能承诺。
- 界面检查覆盖390/1024/1280/1920与DPR，但窄屏检查不等于完整移动端/非Chromium支持；Visualizer工作区支持范围保持≥1024px。
- 音频、metadata、工程和分析结果在浏览器本地；公开模型/运行资产可以联网下载并校验，不授权上传用户音频、账户、云处理或跨设备同步。
- Analyzer最近会话、Editor单草稿、Visualizer单草稿和独立资源库各有明确持久化所有权；刷新不自动播放。权限跨会话持续性不能假定，恢复访问须用户手势。
- 依赖、工程格式、兼容性、支持矩阵、性能阈值和重要架构取舍变更说明用途、代价、许可及影响，由owner决定；不新增自动fallback绕过错误。

## 成功标准

- 能完成“本地歌曲→分析/标记或适用自动处理→人工修正→元素/预设映射→工程保存恢复→WebM保存回放”；自动失败仍有原曲和完整人工路径。
- 正确性、同步、反馈、几何、资源和媒体按[Analyzer](../quality/validation.md)、[Editor](../quality/editor/validation.md)、[Visualizer](../quality/visualizer/validation.md)、[处理链](../quality/processing/validation.md)的有效阈值验收。
- 错误、取消、换歌、配额或持久化失败不破坏用户已有工程；可访问名称、键盘、可见焦点、文字状态和reduced motion保持可用。
- 历史Analyzer学习任务只有owner的3/3结果，不外推普遍学习效果；模型数值、合成识别和实际听感分别报告。
- 已实现/通过/失败/未运行及人工缺口分开登记；历史canonical不替代当前验证，功能收尾不等于整体readiness或上线。

## 尚未进入范围

远端音频/麦克风/直播/账户/云同步、MIDI、自动长音色/FX、3D分析辅助图、任意JS/DSL/Shader资源、公开商城治理、批量制作和其他视频格式需要独立需求。当前离线导出和原子内容已进入范围，不再受旧“仅两个模板/实时录制”限制。

正式托管平台、域名、HTTPS/生产URL和SPA fallback仍由PROD-015阻断上线；不把本地工具或历史readiness当作部署授权。具体未决问题见[开放问题](open-questions.md)，批准来源见[决策登记](../context/decision-registry.md)。
