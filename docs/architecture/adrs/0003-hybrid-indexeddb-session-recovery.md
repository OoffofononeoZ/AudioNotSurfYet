---
status: approved
owner: "project-owner"
last_reviewed: 2026-07-29
upstream_docs:
  - "docs/product/scope.md"
  - "docs/architecture/system-design.md"
  - "docs/architecture/interface-contracts.md"
next_action: "M7 canonical 已覆盖 workspace/cache 恢复不变量；等待 owner 刷新恢复任务与 evidence 审批"
---

# ADR-0003: Hybrid IndexedDB File-Handle and Current-Blob Recovery

## Context

只保存 FileSystemFileHandle 不能保证刷新后无提示访问，因为权限不保证跨会话持续；保存队列中所有 Blob 和分析结果又会使 15 分钟、多文件会话迅速触发 quota。产品只要求恢复最近一次会话，而不是建设长期本地曲库。

## Decision

- 使用 `showOpenFilePicker()` 获取文件与句柄，并把队列全部句柄保存在 IndexedDB。
- 只保存当前歌曲 Blob 和当前歌曲、当前配置、活动特征的分析缓存。
- 切歌时以版本化事务替换旧 current Blob/cache；失败不影响内存会话，并显示 `not-persisted`。
- 刷新恢复队列、当前歌曲、卡片、参数和视窗；播放时间重置为 0 且 paused。
- 当前歌曲优先使用保存 Blob。其他歌曲按下一首、上一首、下二首、上二首的距离顺序查询权限。
- `granted` 自动恢复；`prompt`/`denied` 只显示状态，`requestPermission()` 必须由“恢复访问”用户操作触发。
- 文件移动、权限拒绝、quota 或缓存失败不能中断当前页面内播放；缓存缺失时刷新后重新分析。

## Consequences

### Positive

- 当前歌曲可以在权限丢失时仍恢复，符合核心刷新任务。
- 存储使用量有明确上界，随当前歌曲替换而清理。
- 队列顺序和未来恢复机会保留。

### Negative

- 非当前歌曲不能保证跨刷新自动恢复。
- IndexedDB 需要处理 FileSystemFileHandle、Blob、typed array 和 schema version。
- 浏览器权限状态与自动化能力可能不同，需要真实浏览器验证。

## Alternatives

- 只保存句柄：拒绝，权限 prompt 会破坏当前歌曲刷新恢复。
- 保存全部 Blob/缓存：拒绝，超出“最近会话、当前歌曲”范围并增加 quota 风险。
- 只用 localStorage：拒绝，不能可靠保存 Blob、handle 和大型 typed array。
- 隐式 `<input type=file>` fallback：不作为默认兼容路径；它无法恢复文件句柄且会掩盖批准的恢复语义。

## Validation

- IndexedDB 契约测试覆盖完整恢复、current Blob 替换、只保存 current cache、schema version、quota 和事务中断。
- 浏览器测试覆盖 `granted`、`prompt`、`denied`、文件移动和用户取消。
- 刷新后当前歌曲存在、时间为 0、paused，卡片和配置恢复。
- 清除会话后不残留 handle、Blob 或分析缓存。

## References

- [Chrome File System Access 文档](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)
- [持久权限说明](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api)

## Approval

由 `project-owner` 于 2026-07-24 随系统计划批准。
