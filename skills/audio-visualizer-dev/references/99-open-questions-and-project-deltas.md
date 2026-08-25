# 开放问题与项目差异

此文件只记录工程事实缺口、仓库漂移和需重新确认的项目约定。产品目标、范围、指标、隐私与 owner 问题记录在 `docs/product/open-questions.md`。

## 当前工程缺口

| ID | 分类 | 已证实证据 | 影响 | 下一步 |
| --- | --- | --- | --- | --- |
| ENG-002 | CI | M3 明确只建立本地门禁，未创建 `.github/workflows` 或其他正式 CI | 构建/测试依赖本地执行 | CI 作为独立后续决策，不阻断 M3 |
| ENG-003 | 资源释放 | M11 clean canonical 在 Chrome/Edge 各 20 次分析/播放循环保持单 Worker/AudioContext，并在 20 次 Home/Analyzer 路由循环保持 1 个有效 WebGL context 与 2 live RAF | 自动化不替代长期 heap/线程观察 | owner 在最终人工验收中保留 DevTools 长会话复核 |
| ENG-005 | 未完成表面 | ComingSoon、threeDTable、MeydaCard 为空或近空，TestLands/testcomp 为试验内容 | 不能推断公开功能或稳定接口 | 由产品 scope 决定保留、实现或删除 |
| ENG-006 | 包体积 | 当前构建存在约 1 MB chunk 警告 | 首屏和缓存风险未知 | 先确定性能预算，再决定分包策略 |
| ENG-007 | 开发依赖审计 | 安全补丁后 `npm audit` 剩余 esbuild 0.27.3 的 1 项 low，影响 Windows 开发服务器任意文件读取 | 当前 macOS 本地门禁不受直接影响，但不能宣称零漏洞 | 不向不受信网络暴露 dev server；上游提供兼容修复后升级并复核 |
| ENG-008 | 原生文件权限 | M11 clean canonical 已在真实 Edge 通过 OPFS/IndexedDB 恢复、quota 与全量 E2E；M5 Chrome 原生 picker 签字已完成 | Edge 原生 granted/prompt/denied 与文件移动仍不能自动化 | owner 在真实 Edge 重复原生权限矩阵；不得把 OPFS 自动化泛化为原生提示完成 |
| ENG-009 | Meyda feature 缺陷 | 当前 Meyda 5.6.3 对有效输入提取 `spectralFlux` 时抛出 `x is not defined`，M6 golden 已固定该复现 | 上游 extractor 不可用；产品必须使用独立、可审计的语义 | ADR-0005 项目 Flux 的公式/首帧/静音/exact cursor golden 与 M8 canonical 已通过，产品阻断缓解；上游异常事实继续保留 |

## 已关闭工程缺口

- ENG-001：2026-07-28 已删除失效的 `test:spectrogram`，建立 Vitest、Playwright、Worker、IndexedDB、fixture、golden、docs 和 deliberate-failure harness；clean-commit canonical run 与 evidence 已获 owner 批准，M3 已关闭。
- ENG-004：M11 为 `LightBg` 增加 geometry/material/render list/renderer/WebGL context 显式释放，并在 Chrome/Edge 各 20 次路由循环验证 21 created/20 lost、最终只保留当前页面 context。

## 当前仓库漂移

- 2026-07-24 初始检查发现 `components.d.ts` 有未暂存的两行删除；它是用户已有修改，后续构建不得静默覆盖。
- 本项目 Skill 源码应只存在于 `skills/audio-visualizer-dev/`；中央仓库 `/Users/huafang/Desktop/hf-main/skills` 不应因本计划改变。
- `~/.codex/skills/audio-visualizer-dev` 应是指向项目源码的软链接。若目标变成文件、目录或其他链接，停止安装并报告，不覆盖。

## 历史证据边界

Codex 任务 `019f82bc-0838-7ab3-baba-1a7571992901` 记录过：

- MusicBar 样式切换期间隐藏进度条，矩形进度条改为 CSS 锚定。
- 空列表禁止跳转，播放/暂停/清空时灯带状态复位。
- 390、1024、1280 宽度的几何检查和浏览器 console 检查曾通过。
- MusicList 自定义事件改为 kebab-case。

当前 Git 历史和源码能支持这些改动已经进入代码，但历史浏览器结果不是永久门禁证据；相关代码变化后必须重跑。

## 重新确认触发器

- package scripts、主要依赖、路由、目录职责或状态所有权变化。
- 新增测试、CI、部署或浏览器支持策略。
- 音频由本地对象 URL 转向远端 URL、媒体元素或后端处理。
- 新增第二个真实同类项目，可能需要把本 Skill 抽象为通用项目族。
- 历史任务结论与当前代码或可复现行为冲突。
