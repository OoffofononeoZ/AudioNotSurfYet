<template>
    <section
        class="sound-examples"
        data-testid="editor-sound-examples"
        :data-state="state.status"
        aria-labelledby="sound-examples-title">
        <header>
            <div>
                <h3 id="sound-examples-title">同曲示例检索</h3>
                <p>添加声音正例或明确的反例，检索后试听并勾选候选。</p>
            </div>
            <span>{{
                state.persistence === 'saved'
                    ? '示例已保存到本机'
                    : state.persistence === 'not-persisted'
                      ? '示例尚未保存'
                      : ''
            }}</span>
        </header>
        <div class="example-controls">
            <label
                >检索来源<select
                    :value="profile?.sourceKey"
                    :disabled="disabled"
                    aria-label="示例检索来源"
                    @change="service.selectSource(($event.target as HTMLSelectElement).value)">
                    <option v-for="source in state.sources" :key="source.key" :value="source.key">
                        {{ source.label }}
                    </option>
                </select></label
            >
            <label v-if="profile"
                >声音组<select
                    :value="profile.id"
                    :disabled="disabled"
                    aria-label="示例声音组"
                    @change="service.selectGroup(($event.target as HTMLSelectElement).value)">
                    <option v-for="group in groups" :key="group.id" :value="group.id">{{ group.label }}</option>
                </select></label
            >
            <button type="button" :disabled="disabled || !profile" @click="service.createGroup()">新声音组</button>
            <label v-if="profile"
                >名称<input
                    v-model="labelDraft"
                    maxlength="120"
                    :disabled="disabled"
                    aria-label="示例声音组名称"
                    @change="service.editSettings({ label: labelDraft })"
            /></label>
        </div>
        <p v-if="!state.sources.length">当前歌曲的解码音频尚未就绪。</p>
        <template v-if="profile">
            <p class="hint">
                默认原曲；其他选项仅使用已有音轨，不会启动分离。点检索相似起音，范围检索声音片段或短乐句。
            </p>
            <fieldset :disabled="disabled">
                <legend>添加示例</legend>
                <div class="example-controls">
                    <label
                        >类型<select v-model="kind" aria-label="声音示例类型">
                            <option value="point">点</option>
                            <option value="range">范围</option>
                        </select></label
                    >
                    <label
                        >作用<select v-model="polarity" aria-label="声音示例作用">
                            <option value="positive">正例</option>
                            <option value="negative">反例</option>
                        </select></label
                    >
                    <label
                        >{{ kind === 'point' ? '时间' : '起点' }}（秒）<input
                            v-model.number="start"
                            type="number"
                            min="0"
                            :max="duration"
                            step="0.001"
                            aria-label="声音示例起点"
                    /></label>
                    <label v-if="kind === 'range'"
                        >终点（秒）<input
                            v-model.number="end"
                            type="number"
                            min="0"
                            :max="duration"
                            step="0.001"
                            aria-label="声音示例终点"
                    /></label>
                    <button type="button" @click="takeCursor">取播放位置</button>
                    <button v-if="state.selection" type="button" @click="takeSelection">取标记选区</button>
                    <button type="button" data-testid="sound-example-add" @click="add">
                        添加{{ polarity === 'positive' ? '正例' : '反例' }}
                    </button>
                </div>
            </fieldset>
            <ul class="example-list" aria-label="声音示例列表">
                <li v-for="example in profile.examples" :key="example.id">
                    <span
                        >{{ example.polarity === 'positive' ? '正例' : '反例' }} ·
                        {{ example.kind === 'point' ? '点' : '范围' }} · {{ time(example.startSeconds)
                        }}<template v-if="example.kind === 'range'">—{{ time(example.endSeconds) }}</template> 秒</span
                    >
                    <button type="button" :disabled="disabled" @click="service.listen(example.startSeconds)">
                        试听
                    </button>
                    <button type="button" :disabled="disabled" @click="service.removeExample(example.id)">移除</button>
                </li>
                <li v-if="!profile.examples.length">尚无声音示例。可从标记轨道选中点／范围，点击“用作声音示例”。</li>
            </ul>
            <div class="example-controls search-actions">
                <label
                    >相似度门限<input
                        v-model.number="thresholdDraft"
                        :disabled="disabled"
                        type="number"
                        min="0.5"
                        max="1"
                        step="0.01"
                        aria-label="示例相似度门限"
                        @change="service.editSettings({ threshold: Number(thresholdDraft) })"
                /></label>
                <label
                    >反例差值<input
                        v-model.number="negativeDraft"
                        :disabled="disabled"
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        aria-label="示例反例差值"
                        @change="service.editSettings({ negativeMargin: Number(negativeDraft) })"
                /></label>
                <button
                    v-if="state.status !== 'searching'"
                    type="button"
                    class="primary"
                    data-testid="sound-example-search"
                    :disabled="disabled || !profile.examples.some(e => e.polarity === 'positive')"
                    @click="service.search()">
                    检索当前歌曲
                </button>
                <button v-else type="button" data-testid="sound-example-cancel" @click="service.cancel()">
                    取消检索
                </button>
                <button type="button" :disabled="disabled" @click="service.clearIndex()">清理当前索引</button>
                <span v-if="state.progress" role="status"
                    >{{ state.progress.phase }} · {{ state.progress.done }} / {{ state.progress.total }}</span
                >
            </div>
            <p class="hint">相似度用于同曲比较，不表示准确率。未标注的其他声音不会自动作为反例。</p>
            <p v-if="state.summary" class="hint">
                {{ state.summary.indexRestored ? '复用已校验索引' : '新建声学索引' }} ·
                {{ (state.summary.elapsedMs / 1000).toFixed(1) }} 秒 · {{ state.summary.refinedCandidates }} 次时间对齐
            </p>
            <div v-if="profile.matches.length" class="match-results">
                <div class="example-controls">
                    <strong
                        >{{ profile.matches.length }} 个候选 · 已勾选
                        {{ profile.matches.filter(m => m.selected).length }}</strong
                    >
                    <button
                        type="button"
                        data-testid="sound-example-apply"
                        :disabled="disabled || !currentQuery || !profile.matches.some(m => m.selected)"
                        @click="service.apply()">
                        应用勾选的候选
                    </button>
                    <button type="button" :disabled="page === 0" @click="page--">上一页</button>
                    <span>{{ page + 1 }} / {{ pages }}</span
                    ><button type="button" :disabled="page + 1 >= pages" @click="page++">下一页</button>
                </div>
                <div class="match-scroll app-scrollbar">
                    <table>
                        <thead>
                            <tr>
                                <th>应用</th>
                                <th>类型</th>
                                <th>起点（秒）</th>
                                <th>终点（秒）</th>
                                <th>正例相似度</th>
                                <th>反例相似度</th>
                                <th>试听</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="match in visible" :key="match.id" data-testid="sound-example-match">
                                <td>
                                    <input
                                        type="checkbox"
                                        :checked="match.selected"
                                        :disabled="disabled"
                                        aria-label="勾选检索候选"
                                        @change="
                                            service.correctMatch(match.id, {
                                                selected: ($event.target as HTMLInputElement).checked,
                                            })
                                        " />
                                </td>
                                <td>{{ match.kind === 'point' ? '点' : '范围' }}</td>
                                <td>
                                    <input
                                        v-model.number="times[match.id]!.startSeconds"
                                        type="number"
                                        min="0"
                                        :max="duration"
                                        step="0.001"
                                        :disabled="disabled"
                                        aria-label="修正检索候选起点"
                                        @change="
                                            service.correctMatch(match.id, {
                                                startSeconds: Number(times[match.id]!.startSeconds),
                                            })
                                        " />
                                </td>
                                <td>
                                    <input
                                        v-if="match.kind === 'range'"
                                        v-model.number="times[match.id]!.endSeconds"
                                        type="number"
                                        min="0"
                                        :max="duration"
                                        step="0.001"
                                        :disabled="disabled"
                                        aria-label="修正检索候选终点"
                                        @change="
                                            service.correctMatch(match.id, {
                                                endSeconds: Number(times[match.id]!.endSeconds),
                                            })
                                        " /><span v-else>—</span>
                                </td>
                                <td>{{ match.positiveScore.toFixed(3) }}</td>
                                <td>{{ match.negativeScore?.toFixed(3) ?? '—' }}</td>
                                <td>
                                    <button
                                        type="button"
                                        :disabled="disabled"
                                        @click="service.listen(match.startSeconds)">
                                        试听
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <p v-else-if="state.status === 'ready'">没有候选通过当前门限，可增加正例或调整门限后重新检索。</p>
        </template>
        <p v-if="state.message" role="status" data-testid="sound-example-message">{{ state.message }}</p>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import type { PlaybackSnapshot } from '../types/audio';
import type { EditorExampleService } from '../transcription/examples/service';
import { queryIdentity } from '../transcription/examples/types';
const props = defineProps<{
    service: EditorExampleService;
    playback: PlaybackSnapshot;
    duration: number;
    modelBusy: boolean;
}>();
const service = props.service,
    state = shallowRef(service.getSnapshot());
onBeforeUnmount(
    service.subscribe(snapshot => {
        state.value = snapshot;
    }),
);
const profile = computed(() => state.value.profile),
    disabled = computed(() => props.modelBusy || ['restoring', 'searching'].includes(state.value.status));
const groups = computed(() => {
    const p = profile.value;
    if (!p) return [];
    const list = state.value.profiles.filter(g => g.sourceKey === p.sourceKey);
    return list.some(g => g.id === p.id) ? list : [...list, p];
});
const currentQuery = computed(() => !!profile.value && profile.value.queryHash === queryIdentity(profile.value));
const labelDraft = ref(''),
    thresholdDraft = ref(0.82),
    negativeDraft = ref(0.04),
    times = ref<Record<string, { startSeconds: number; endSeconds: number }>>({});
watch(
    [
        () => profile.value?.id,
        () => profile.value?.label,
        () => profile.value?.threshold,
        () => profile.value?.negativeMargin,
    ],
    () => {
        labelDraft.value = profile.value?.label ?? '';
        thresholdDraft.value = profile.value?.threshold ?? 0.82;
        negativeDraft.value = profile.value?.negativeMargin ?? 0.04;
    },
    { immediate: true },
);
watch(
    () => JSON.stringify(profile.value?.matches.map(m => [m.id, m.startSeconds, m.endSeconds])),
    () => {
        times.value = Object.fromEntries(
            profile.value?.matches.map(m => [
                m.id,
                { startSeconds: Number(m.startSeconds.toFixed(3)), endSeconds: Number(m.endSeconds.toFixed(3)) },
            ]) ?? [],
        );
    },
    { immediate: true },
);
const kind = ref<'point' | 'range'>('point'),
    polarity = ref<'positive' | 'negative'>('positive'),
    start = ref(0),
    end = ref(1),
    markerId = ref<string | undefined>();
const page = ref(0),
    pageSize = 50,
    pages = computed(() => Math.max(1, Math.ceil((profile.value?.matches.length ?? 0) / pageSize))),
    visible = computed(() => profile.value?.matches.slice(page.value * pageSize, (page.value + 1) * pageSize) ?? []);
watch(
    () => [profile.value?.id, profile.value?.queryHash],
    () => {
        page.value = 0;
    },
);
watch(pages, value => {
    page.value = Math.min(page.value, value - 1);
});
watch(
    () => JSON.stringify(state.value.selection),
    () => {
        if (state.value.selection) takeSelection();
    },
);
function takeSelection() {
    const selection = state.value.selection;
    if (!selection) return;
    kind.value = selection.kind;
    start.value = selection.startSeconds;
    end.value = selection.endSeconds;
    markerId.value = selection.markerId;
}
function takeCursor() {
    start.value = Math.min(props.duration - 1e-6, Math.max(0, props.playback.currentTimeSeconds));
    end.value = Math.min(props.duration, start.value + 1);
    markerId.value = undefined;
}
function add() {
    const selection = state.value.selection;
    const sameMarker =
        selection?.markerId === markerId.value &&
        selection?.startSeconds === start.value &&
        (kind.value === 'point' || selection?.endSeconds === end.value);
    service.addExample({
        polarity: polarity.value,
        kind: kind.value,
        startSeconds: start.value,
        endSeconds: kind.value === 'point' ? start.value : end.value,
        ...(sameMarker && markerId.value ? { markerId: markerId.value } : {}),
    });
}
const time = (value: number) => value.toFixed(3);
</script>
<style scoped>
.sound-examples {
    margin-top: 20px;
    padding: 20px;
    border: 1px solid var(--divider);
    border-radius: 8px;
    background: var(--surface-card-strong);
}
header,
.example-controls,
.example-list li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
}
header {
    justify-content: space-between;
    margin-bottom: 14px;
}
h3 {
    margin: 0 0 5px;
    font-size: 15px;
}
p {
    margin: 6px 0;
    font-size: 12px;
    color: var(--body);
}
label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
}
select,
input,
button {
    min-height: 30px;
    padding: 4px 8px;
    border: 1px solid var(--hairline-soft);
    border-radius: 4px;
    background: var(--editor-control);
    color: var(--ink);
    font-size: 12px;
}
input[type='number'] {
    width: 98px;
}
input[type='checkbox'] {
    width: 16px;
    min-height: 16px;
    accent-color: var(--accent);
}
button {
    cursor: pointer;
}
button:disabled,
fieldset:disabled {
    opacity: 0.55;
    cursor: default;
}
button.primary {
    color: var(--on-accent);
    background: var(--accent);
}
fieldset {
    margin: 14px 0;
    padding: 12px;
    border: 1px solid var(--divider);
    border-radius: 5px;
}
legend {
    padding: 0 5px;
    font-size: 12px;
}
.example-list {
    list-style: none;
    margin: 12px 0;
    padding: 0;
}
.example-list li {
    margin: 6px 0;
    font-size: 12px;
}
.example-list li span {
    min-width: 220px;
}
.hint {
    line-height: 1.6;
}
.search-actions {
    margin: 12px 0;
}
.match-results {
    margin-top: 16px;
}
.match-scroll {
    max-height: 400px;
    margin-top: 10px;
    overflow: auto;
}
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
    white-space: nowrap;
}
th,
td {
    padding: 7px;
    border-bottom: 1px solid var(--divider);
}
th {
    position: sticky;
    top: 0;
    background: var(--editor-panel-strong);
}
@media (max-width: 640px) {
    .sound-examples {
        padding: 12px;
    }
    .example-controls {
        align-items: flex-start;
    }
    label {
        flex-wrap: wrap;
    }
}
</style>
