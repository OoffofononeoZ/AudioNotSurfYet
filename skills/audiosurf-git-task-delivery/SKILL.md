---
name: audiosurf-git-task-delivery
description: "AudioNotSurfYet 修改任务开始和完成交付时使用；保留用户修改，验证并同步项目入口与地图后仅本地提交本次改动。只读任务不提交。"
---

# 修改任务与本地交付

owner 已授权修改任务完成适用验证后本地提交一次，无需再次确认；不包含推送、部署、发布、切换分支或历史重写。

## 开始

读取 `git status --short`、当前分支和暂存区，记录本次将触及的文件及已有修改。不以 reset、checkout、批量覆盖或格式化清理工作树。Git 所有权检查失败时，确认目标是当前仓库，仅对命令使用 `git -c safe.directory=<当前仓库绝对路径>`，不设置全局或通配信任。

## 完成

1. 按实际改动运行适用验证，修复相关失败；不能运行的部分如实说明。
2. 修改交付时运行 `npm run skills:install`、`npm run codemap` 和 `npm run repo:check`；工具实现变化再运行 `npm run test:tools`。检查 `git diff --check`。
3. 审阅 diff，区分用户已有修改；只暂存本次文件或明确片段。审阅 `git diff --cached`、`--name-status` 和 `--check`。
4. 已有无关暂存修改时用临时索引隔离本次提交，保留用户索引；同文件混合改动无法可靠分离时说明阻碍，不一起提交。
5. 创建一次对应 feat/fix/refactor/docs/test/chore 本地提交，地图和发现入口随本次任务提交。提交后核对短提交号、剩余状态和用户修改。

只读、无变化或仅检查任务不生成文件、不创建空提交。构建改写生成声明时保留任务前用户差异，只交付必要生成变化。大型音频、权重、模型产物及秘密配置遵守现有忽略规则，不能用 `git add .` 顺带提交。正式证据仍需真实干净实现 commit；提交本身不能证明 canonical 或 readiness 通过。
