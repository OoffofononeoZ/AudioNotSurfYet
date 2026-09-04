# Required Scene Test Matrix

## Skill Gate Tests

`test:skill:visualizer-scene-generator` 至少验证：

- 完整 `SceneBriefV1` 返回 `READY_FOR_CONTRACT`。
- 缺少主要效果、绑定类型或响应语义分别返回明确路径。
- 非法 data/time/image-role 枚举被拒绝。
- analysis-vector 缺少元素映射被拒绝。
- integrated 缺少速度单位或边界行为被拒绝。
- 装饰参数声明 binding 但缺少完整响应/时间语义时被拒绝。
- validator 不写输入文件、仓库文件或其他副作用文件。

## Tests Required for Every Approved Scene

### Unit

- 主要及装饰数据映射，参数隔离和 descriptor range/default。
- 静音/未激活、低值、高值及非法/非有限 source fallback。
- vector 分段、bin/band/object 分配或适用的 scalar/editor 语义。
- seed 布局稳定、direct/attack-release/integrated 绝对时间和 checkpoint。
- 连续播放、直接 seek、暂停和刷新在同时间产生相同 `1e-6` renderer-neutral hash。

### Integration

- template union、strict codec whitelist 与 registry descriptor 完整。
- 默认 binding/active feature set，三至四项理由和四项硬上限。
- Project V1 canonical round-trip；导入、草稿和模板缓存不被默认值覆盖。
- 同一 resolved map 只解析一次，参数错误隔离，旧 binding/template revision 丢弃。
- resize、录制 capture/release、context loss/restore、renderer retry 与幂等 dispose。
- 至少 20 次新场景与现有模板切换后，Canvas/renderer/RAF/geometry/material/listener 不累积。

### Chrome and Edge E2E

- 1024/1280/1920 CSS px 与 DPR 1/2 的 16:9 预览、inspector、键盘、焦点和 reduced motion。
- 各 binding 的低/高与隔离行为；播放、暂停、seek、刷新确定性。
- 单 Canvas、WebGLRenderer、视觉 RAF、AudioContext 和 Worker 上限不变。
- 默认 720p30 录制可用，或在既有 typed capability 规则下于资源获取前失败；不得在输出失败后伪装 unavailable。
- console error、pageerror 为 0；环境无法运行时记录 `unverified` 与原因，不记作 pass。

### Targeted Regression

- V1：route、project、default template、strict JSON、单 Canvas。
- V2：binding planner、projection/transform、0–4 feature、Editor snapshot。
- V5：recording preflight、capture size、abort/cleanup、默认 720p30。
- V6：资源探针、context/renderer recovery、三格式与生命周期关键路径。

## Fixture Rule

优先复用现有确定性 fixture 和 Editor snapshot。只有它们无法表达合同中的低/高、时间或向量状态时才生成小型确定性音频，并登记生成算法、许可和 SHA-256；不得提交 15 分钟音频、大型 WebM 或 trace。

## Completion Boundary

上述矩阵证明场景实现符合合同，不创建独立 eval plan、canonical evidence 或 release-ready 结论。未执行项保持 `unverified`；产品缺陷为失败，不得改成环境 unavailable。新场景进入候选后必须重新评审现有 Visualizer readiness。
