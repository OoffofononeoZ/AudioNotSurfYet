# 构建、测试与调试

## 当前命令

| 命令 | 当前含义 | 门禁解释 |
| --- | --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 | 用于浏览器交互，不代表构建通过 |
| `npm run build` | 先运行 `vue-tsc -b`，再运行 `vite build` | 当前最基本静态与生产构建门禁 |
| `npm run preview` | 预览构建产物 | 适合核对生产资源路径 |
| `npm run test:spectrogram` | 执行 `tsx test.ts` | 当前不可作为通过门禁 |

## 已知测试缺口

- 仓库根目录当前没有 `test.ts`，因此 `test:spectrogram` 的目标文件缺失。
- 计划来源还记录过受限环境中的 `tsx` IPC 权限错误；当测试文件补齐后，需要在实际执行环境重新确认，不能只沿用历史结论。
- 未发现 Vitest/Jest/Playwright 配置、单元测试目录或正式 CI 配置。
- 因此“测试通过”目前最多能表示构建和明确执行的浏览器场景通过，不能表述为完整自动化测试通过。

## 构建风险

- Vite 当前会报告约 1 MB 级别的大 chunk 警告。它是已知风险提示，不是构建错误。
- `components.d.ts` 与 `auto-imports.d.ts` 由 Vite 插件维护；运行构建可能更新生成声明。构建前后要比较 Git 差异，保留用户原有修改。
- `dist/` 被 `.gitignore` 排除；不要把生成产物当作源码变更。

## 浏览器验证

涉及交互、布局、AudioContext 或 WebGL 时：

1. 启动本地 Vite。
2. 打开目标路由并等待 DOM 就绪。
3. 执行任务对应的成功、失败和边界场景。
4. 读取 DOM 状态与真实几何；必要时截图作为补充，不以截图替代状态检查。
5. 检查 console error/warn。
6. 结束浏览器会话并关闭开发服务器。

音频场景应使用允许的本地 fixture，检查队列、进度、能量、暂停、清空和错误恢复。没有 fixture 时，明确记录未验证项。

## 调试顺序

- 先复现，再缩小到状态、DOM、音频节点或渲染循环。
- 优先读取现有响应式值、CSS 变量、RAF 句柄和对象所有权，不先加兼容分支。
- 对定位问题读取 `getBoundingClientRect()`；对播放问题读取 AudioLoader 的 loaded/playing/time/duration；对渲染问题检查 canvas 数量、尺寸和控制台。
- 修复后复跑原始场景，并增加至少一个相邻失败或边界场景。

## 交付前检查

- `npm run build`
- 相关浏览器场景及控制台
- Markdown/配置改动的语法和链接检查
- `git diff --check`
- `git status --short` 与改动范围审计
- 明确列出未运行或不能通过的测试及原因
