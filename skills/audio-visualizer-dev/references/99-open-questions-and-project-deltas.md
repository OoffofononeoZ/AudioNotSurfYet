# 开放问题与项目差异

此文件只记录工程事实缺口、仓库漂移和需重新确认的项目约定。产品目标、范围、指标、隐私与 owner 问题记录在 `docs/product/open-questions.md`。

## 当前工程缺口

| ID | 分类 | 已证实证据 | 影响 | 下一步 |
| --- | --- | --- | --- | --- |
| ENG-002 | CI | M3 明确只建立本地门禁，未创建 `.github/workflows` 或其他正式 CI | 构建/测试依赖本地执行 | CI 作为独立后续决策，不阻断 M3 |
| ENG-003 | 资源释放 | 封面对象 URL 未见 revoke；MusicBar 卸载未见 AudioLoader/队列 URL 全量释放 | 长会话或反复路由可能累积资源 | 在相关代码任务中用浏览器和资源计数复核 |
| ENG-004 | WebGL 释放 | `LightBg` cleanup 未见 geometry/material 显式 dispose | 可见性反复切换可能累积 GPU 资源 | 在可视化生命周期任务中测量并修复 |
| ENG-005 | 未完成表面 | ComingSoon、threeDTable、MeydaCard 为空或近空，TestLands/testcomp 为试验内容 | 不能推断公开功能或稳定接口 | 由产品 scope 决定保留、实现或删除 |
| ENG-006 | 包体积 | 当前构建存在约 1 MB chunk 警告 | 首屏和缓存风险未知 | 先确定性能预算，再决定分包策略 |
| ENG-007 | 开发依赖审计 | 安全补丁后 `npm audit` 剩余 esbuild 0.27.3 的 1 项 low，影响 Windows 开发服务器任意文件读取 | 当前 macOS 本地门禁不受直接影响，但不能宣称零漏洞 | 不向不受信网络暴露 dev server；上游提供兼容修复后升级并复核 |

## 已关闭工程缺口

- ENG-001：2026-07-28 已删除失效的 `test:spectrogram`，建立 Vitest、Playwright、Worker、IndexedDB、fixture、golden、docs 和 deliberate-failure harness；clean-commit canonical run 已通过并登记，M3 关闭仍等待 owner evidence review。

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
