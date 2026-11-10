<template>
    <section
        class="transcription-workspace"
        data-testid="editor-transcription"
        :data-state="state.status"
        aria-label="自动标记候选">
        <section class="transcription-intro" aria-labelledby="transcription-title">
            <div class="intro-heading">
                <div class="intro-icon"><EditorIcon name="features" /></div>
                <div>
                    <h2 id="transcription-title">自动标记</h2>
                    <p>选择分析输入，生成并复核标记候选。</p>
                </div>
            </div>
            <div class="input-section">
                <h3>分析输入</h3>
                <div class="input-options" role="group" aria-label="自动标记分析输入">
                    <label
                        v-for="role in TRANSCRIPTION_ROLES"
                        :key="role"
                        :class="{ 'is-selected': state.selectedRoles.includes(role) }">
                        <input
                            type="checkbox"
                            :checked="state.selectedRoles.includes(role)"
                            :disabled="busy"
                            @change="toggleRole(role)" />
                        <span
                            ><strong>{{ INSTRUMENT_LABELS[role] }}</strong
                            ><small
                                >{{ role === 'drums' ? 'ADT_STR' : 'Basic Pitch'
                                }}{{ role === 'piano' || role === 'guitar' ? ' · 辅助分离' : ' · FT'
                                }}{{ role === 'other' ? ' · 主旋律候选' : '' }}</small
                            ></span
                        >
                    </label>
                </div>
            </div>
            <footer class="task-actions">
                <label
                    >鼓推理
                    <select
                        :value="state.drumBackend"
                        :disabled="busy"
                        aria-label="鼓推理方式"
                        @change="
                            service.setDrumBackend(($event.target as HTMLSelectElement).value as 'webgpu' | 'wasm')
                        ">
                        <option value="webgpu">WebGPU</option>
                        <option value="wasm">WASM（慢速）</option>
                    </select>
                </label>
                <span v-if="state.drumBackend === 'wasm'">慢速模式可能耗时较长，不适用 GPU 耗时目标。</span>
                <span>待下载模型 {{ formatBytes(state.missingModelBytes) }}</span>
                <button
                    v-if="!busy"
                    type="button"
                    class="primary"
                    data-testid="transcription-start"
                    :disabled="!state.ftResultId || !state.selectedRoles.length"
                    @click="service.start()">
                    <EditorIcon name="plus" />{{ result ? '重新分析' : '生成候选' }}
                </button>
                <button
                    v-else
                    type="button"
                    data-testid="transcription-cancel"
                    :disabled="['cancelling', 'clearing'].includes(state.status)"
                    @click="service.cancel()">
                    {{ state.status === 'cancelling' ? '取消中…' : '取消分析' }}
                </button>
            </footer>
        </section>

        <div v-if="busy" class="task-progress" role="status" data-testid="transcription-progress">
            <div>
                <strong>{{ phaseLabel }}</strong
                ><span v-if="state.progress"
                    >{{ state.progress.role }} · {{ state.progress.completedUnits
                    }}<template v-if="state.progress.totalUnits !== null"> / {{ state.progress.totalUnits }}</template>
                    · {{ clockTime(state.progress.elapsedMs / 1000) }}</span
                >
            </div>
            <progress
                v-if="state.progress?.totalUnits"
                :value="state.progress.completedUnits"
                :max="state.progress.totalUnits" /><progress v-else />
        </div>
        <p
            v-if="state.message"
            class="task-message"
            :class="{ error: state.status === 'error' || !!state.errorCode }"
            :role="state.errorCode ? 'alert' : 'status'"
            data-testid="transcription-message">
            {{ state.message }}
        </p>

        <EditorTranscriptionReview
            v-if="state.bundle && state.preview"
            :state="state"
            :playback="playback"
            :duration="duration"
            :active="active"
            @seek="emit('seek', $event)" />
        <section v-else-if="!busy" class="candidate-empty" aria-label="暂无自动标记候选">
            <EditorIcon name="overlay" />
            <h3>尚无标记候选</h3>
            <p>
                {{ state.ftResultId ? '选择分析输入后，点击“生成候选”。' : '请先在「音轨分离」完成当前歌曲的分离。' }}
            </p>
        </section>

        <section class="cache-panel" aria-label="自动标记缓存">
            <div class="cache-tools">
                <div>
                    <h3>缓存</h3>
                    <p>工程标记保留；缓存不自动驱逐。</p>
                </div>
                <button type="button" :disabled="busy" @click="pendingClear = 'results'">清理辅助音频与候选缓存</button
                ><button type="button" :disabled="busy" @click="pendingClear = 'models'">清理新增模型缓存</button>
            </div>
            <div v-if="pendingClear" class="cache-confirm" role="group" aria-label="确认清理自动标记缓存">
                <span>{{
                    pendingClear === 'results'
                        ? '删除全部自动标记候选与辅助音频？'
                        : '删除新增模型缓存？下次分析需重新下载。'
                }}</span
                ><button type="button" :disabled="busy" data-testid="transcription-confirm-clear" @click="confirmClear">
                    确认清理</button
                ><button type="button" @click="pendingClear = null">取消</button>
            </div>
        </section>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue';
import type { PlaybackSnapshot } from '../types/audio';
import { useEditorTranscriptionService } from '../transcription/editorTranscriptionService';
import { TRANSCRIPTION_ROLES, INSTRUMENT_LABELS } from '../transcription/candidateTypes';
import type { TranscriptionRole } from '../transcription/candidateTypes';
import { clockTime, formatBytes } from '../processing/presentation';
import EditorIcon from './EditorIcon.vue';
import EditorTranscriptionReview from './EditorTranscriptionReview.vue';
defineProps<{ playback: PlaybackSnapshot; duration: number; active: boolean }>();
const emit = defineEmits<{ seek: [seconds: number] }>();
const service = useEditorTranscriptionService(),
    state = shallowRef(service.getSnapshot());
onBeforeUnmount(
    service.subscribe(snapshot => {
        state.value = snapshot;
    }),
);
const result = computed(() => state.value.bundle?.result ?? null);
const busy = computed(() => ['restoring', 'running', 'cancelling', 'clearing'].includes(state.value.status));
const pendingClear = ref<'results' | 'models' | null>(null);
const phaseLabel = computed(() =>
    state.value.status === 'restoring'
        ? '校验并恢复候选'
        : state.value.status === 'cancelling'
          ? '取消并释放分析'
          : state.value.status === 'clearing'
            ? '清理缓存'
            : ({
                  prepare: '准备分析',
                  'model-download': '下载模型',
                  'model-verify': '校验模型',
                  'model-load': '载入模型',
                  'drum-model-prepare': '准备鼓推理模型',
                  'drum-preprocess': '鼓频谱处理',
                  'drum-encode': '编码鼓片段',
                  'drum-decode': '解码鼓击打',
                  'drum-windows': '鼓片段完成',
                  'drum-retry-windows': '重试局部鼓区间',
                  'acoustic-index': '分析局部声音与起音',
                  'lead-path': '整理主旋律候选',
                  'pitch-preprocess': '准备音符片段',
                  'pitch-inference': '识别音符',
                  'pitch-decode': '整理音符候选',
                  'auxiliary-input': '准备辅助分离',
                  'auxiliary-inference': '分析钢琴与吉他',
                  'auxiliary-persist': '保存辅助音频',
              }[state.value.progress?.phase ?? ''] ??
              state.value.progress?.phase ??
              '准备分析'),
);
function toggleRole(role: TranscriptionRole): void {
    service.setRoles(
        state.value.selectedRoles.includes(role)
            ? state.value.selectedRoles.filter(r => r !== role)
            : [...state.value.selectedRoles, role],
    );
}
async function confirmClear(): Promise<void> {
    const kind = pendingClear.value;
    if (!kind) return;
    pendingClear.value = null;
    await service.clear(kind);
}
</script>
<style scoped>
.transcription-workspace {
    width: 100%;
    max-width: 1480px;
    margin: 0 auto;
    color: var(--ink);
    font-size: 12px;
}
.transcription-intro,
.cache-panel {
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    background: var(--surface-card-strong);
}
.intro-heading {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 28px 28px 24px;
}
.intro-icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--hairline-soft);
    border-radius: var(--radius-sm);
    color: var(--accent-soft);
    background: var(--surface-chip);
}
.intro-icon svg {
    width: 22px;
    height: 22px;
}
h2 {
    margin: 0;
    font-size: 22px;
    line-height: 28px;
    font-weight: 500;
}
h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
}
.intro-heading p {
    margin: 8px 0 0;
    color: var(--body);
    font-size: 13px;
    line-height: 1.65;
}
.input-section {
    padding: 0 28px 28px;
}
.input-section h3 {
    margin-bottom: 12px;
    color: var(--body);
    font-size: 12px;
}
.input-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
    gap: 8px;
}
.input-options label {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 12px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-sm);
    background: var(--surface-3);
    cursor: pointer;
}
.input-options label:hover {
    border-color: var(--hairline);
}
.input-options label.is-selected {
    border-color: var(--hairline-focus);
    background: var(--control-active);
}
.input-options strong {
    display: block;
    font-weight: 500;
}
.input-options small {
    display: block;
    margin-top: 5px;
    color: var(--mute);
    font-size: 10px;
}
input[type='checkbox'] {
    flex: none;
    width: 14px;
    height: 14px;
    margin: 0;
    accent-color: var(--accent-soft);
}
button,
select {
    box-sizing: border-box;
    min-height: 32px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    padding: 6px 10px;
    background: var(--surface-1);
    color: var(--ink);
    font: inherit;
    font-size: 12px;
}
button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
}
button svg {
    width: 16px;
    height: 16px;
}
button:hover:not(:disabled),
select:hover:not(:disabled) {
    border-color: var(--hairline);
    background: var(--control-hover);
}
button:disabled,
input:disabled,
select:disabled {
    opacity: 0.45;
    cursor: default;
}
button.primary {
    border-color: transparent;
    background: var(--accent-soft);
    color: var(--on-accent);
}
button.primary:hover:not(:disabled) {
    background: var(--accent-bright);
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
.task-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding: 16px 24px;
    border-top: 1px solid var(--divider);
    background: var(--surface-3);
}
.task-actions > span {
    margin-right: auto;
    color: var(--mute);
    font-size: 11px;
}
.task-actions button {
    min-height: 34px;
}
.task-progress {
    margin-top: 16px;
    padding: 20px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-md);
    background: var(--surface-3);
}
.task-progress > div {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
}
.task-progress strong {
    font-weight: 500;
}
.task-progress span {
    color: var(--mute);
}
.task-progress progress {
    display: block;
    width: 100%;
    height: 5px;
    margin-top: 16px;
    accent-color: var(--accent-soft);
}
.task-message {
    margin: 16px 0;
    padding: 12px 16px;
    border-left: 2px solid var(--hairline-focus);
    background: var(--surface-3);
    color: var(--body);
    line-height: 1.7;
    overflow-wrap: anywhere;
}
.error {
    color: var(--error);
}
.task-message.error {
    border-color: var(--error-hairline);
}
.candidate-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 176px;
    padding: 24px;
    margin: 20px 0;
    text-align: center;
}
.candidate-empty > svg {
    width: 28px;
    height: 28px;
    margin-bottom: 16px;
    color: var(--mute);
}
.candidate-empty h3 {
    font-size: 14px;
    color: var(--body);
}
.candidate-empty p {
    margin: 8px 0 0;
    color: var(--mute);
    line-height: 1.7;
}
.cache-panel {
    margin-top: 20px;
    padding: 20px 24px;
}
.cache-tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
}
.cache-tools > div {
    margin-right: auto;
}
.cache-tools p {
    margin: 6px 0 0;
    color: var(--mute);
    font-size: 11px;
    line-height: 1.7;
}
.cache-confirm {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--divider);
}
.cache-confirm > span {
    flex: 1 1 240px;
    color: var(--body);
    line-height: 1.7;
}
@media (max-width: 700px) {
    .intro-heading {
        padding: 20px;
        gap: 12px;
    }
    .input-section {
        padding: 0 20px 20px;
    }
    .task-actions {
        padding: 16px 20px;
    }
    .cache-panel {
        padding: 20px;
    }
    .cache-tools > div {
        flex-basis: 100%;
        margin-bottom: 8px;
    }
}
</style>
