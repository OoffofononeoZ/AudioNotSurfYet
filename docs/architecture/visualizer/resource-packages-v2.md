# Visualizer 可执行资源包 V2

2026-10-19，owner 批准项目内可加载算法资源包计划：原生浏览器隔离执行，工程内嵌算法，新格式替换旧格式。实施分为格式工具、隔离运行、现有内容切换；不增加后端、外部 URL 或磁盘资源包加载，不修改内容生成 skill。

## 格式基础

- 包仍为 `audiosurf-visualizer-resource`，schemaVersion 为 2，包含 algorithms、elements、presets。算法以精确 `{id,version,hash}` 引用；元素定义引用算法，预设引用元素。
- AlgorithmDefinition 包含 apiVersion:1、contract、source 和 programs。contract 声明参数能力、共同处理字段与历史输入；programs 保存具名 Shader、几何类型和 uniform 类型。
- source 为自包含 ES Module，导出 create 工厂；源码、Shader、契约共同参与规范化 JSON SHA-256。哈希用于身份，不是作者认证。校验和解析不执行源码。
- 作者文件独立维护 JS、Shader 和 JSON，封装器把文本内嵌进生成包。输入路径限制在作者目录内，模块禁止外部导入，跨包引用按算法→元素→预设顺序封装。
- Project V5 保存元素、预设和算法快照，恢复不依赖商城目录。旧 V4/V1 不迁移；生成 skill 暂时仍描述旧格式。

## 隔离与帧契约

算法在不授予同源权限的 iframe 所属 Worker 执行；CSP 禁止网络，宿主不在主页面求值算法。Worker 只获得当前工程获准的参数及分块历史输入，返回 DrawPacket。宿主校验身份、数值、缓冲与目标后，通过现有单 Canvas/WebGLRenderer 绘制。

预览保留单在途任务和最新待办，跳转/绑定/身份变化使旧结果失效；离线导出逐帧等待计算与绘制，不跳帧。实例按 UUID 隔离，历史输入和 checkpoint 保持确定性。原生方案不承诺硬性 JS 内存或 GPU 时间配额；沿用 65,536 顶点容量，算法计算等待累计超过 10 秒中止，宿主输入准备单独计时。

运行与内容切换完成后同步当前入口、工程、导出及验证契约；本页不授予新增视觉内容或发布授权。
