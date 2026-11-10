<template>
    <section v-if="groups.length" class="duplicate-review" aria-label="跨来源重复复核">
        <h4>{{ groups.length }} 组疑似重复</h4>
        <details v-for="group in groups" :key="group.id" :data-duplicate-group="group.id">
            <summary>
                {{ group.startSeconds.toFixed(3) }} 秒 · {{ group.candidateIds.length }} 个来源 · 已保留
                {{ group.selectedIds.length }} 个
            </summary>
            <p>
                {{
                    group.recommendedId
                        ? '推荐项具有更强的音量和起音证据；可多选保留合奏。'
                        : '证据相近，默认不应用；请选择需要保留的声音。'
                }}
            </p>
            <label v-for="id in group.candidateIds" :key="id">
                <input
                    type="checkbox"
                    :checked="group.selectedIds.includes(id)"
                    :disabled="busy"
                    @change="toggle(group, id, ($event.target as HTMLInputElement).checked)" />
                {{ label(id) }} <strong v-if="id === group.recommendedId">推荐</strong>
                <button
                    type="button"
                    @click="emit('seek', candidates.find(candidate => candidate.id === id)!.startSeconds)">
                    试听
                </button>
            </label>
            <button type="button" :disabled="busy" @click="service.selectDuplicates(group.id, null)">恢复推荐</button>
        </details>
    </section>
</template>
<script setup lang="ts">
import type { DuplicateReviewGroup } from '../transcription/candidateReview';
import type { MarkerCandidate } from '../transcription/candidateTypes';
import { INSTRUMENT_LABELS } from '../transcription/candidateTypes';
import { useEditorTranscriptionService } from '../transcription/editorTranscriptionService';
const props = defineProps<{ groups: DuplicateReviewGroup[]; candidates: MarkerCandidate[]; busy: boolean }>();
const emit = defineEmits<{ seek: [seconds: number] }>();
const service = useEditorTranscriptionService();
function label(id: string): string {
    const candidate = props.candidates.find(candidate => candidate.id === id);
    return candidate
        ? `${INSTRUMENT_LABELS[candidate.instrument]} · ${candidate.source.inputRole} · ${candidate.startSeconds.toFixed(3)} 秒`
        : id;
}
function toggle(group: DuplicateReviewGroup, id: string, checked: boolean): void {
    service.selectDuplicates(
        group.id,
        checked ? [...group.selectedIds, id] : group.selectedIds.filter(candidate => candidate !== id),
    );
}
</script>
<style scoped>
.duplicate-review {
    border: 1px solid var(--divider);
    border-radius: var(--radius-sm);
    padding: 12px;
}
h4 {
    margin: 0 0 8px;
    color: var(--ink);
    font-size: 13px;
}
details + details {
    border-top: 1px solid var(--divider);
    margin-top: 8px;
    padding-top: 8px;
}
summary {
    cursor: pointer;
    color: var(--body);
    line-height: 1.7;
}
p {
    color: var(--mute);
    line-height: 1.7;
}
label {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
    padding: 5px 0;
}
input {
    accent-color: var(--accent);
}
strong {
    color: var(--accent);
    font-size: 11px;
}
button {
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    padding: 5px 9px;
    background: var(--surface-3);
    color: var(--ink);
    font: inherit;
    cursor: pointer;
}
button:disabled {
    opacity: 0.45;
    cursor: default;
}
button:focus-visible,
summary:focus-visible,
input:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}
</style>
