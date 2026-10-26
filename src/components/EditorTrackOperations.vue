<template>
    <button type="button" data-testid="marker-track-operations" :disabled="!editable || !hasEvents" @click="open">
        轨道操作
    </button>
    <Teleport to="body">
        <dialog
            ref="dialog"
            class="track-operations-dialog app-scrollbar"
            aria-labelledby="track-operations-title"
            @keydown.esc.stop
            @cancel.prevent="close">
            <h3 id="track-operations-title">轨道操作</h3>
            <label class="operation-field">
                <span>标记轨道</span>
                <AppSelect v-model="laneId" label="标记轨道" :options="options" />
            </label>
            <p>包含该轨道全部分类，共 {{ selectedLane?.events.length ?? 0 }} 个标记，包括折叠和视野外标记。</p>
            <label class="operation-field">
                <span>移动格数</span>
                <AppNumberInput
                    v-model="cells"
                    label="移动格数"
                    :min="1"
                    :max="Number.MAX_SAFE_INTEGER"
                    :step="1"
                    snap-to-step />
            </label>
            <p>按当前节拍细分移动。范围两端分别移动，跨 BPM 时长度可能变化。</p>
            <p>前移靠近歌曲开头，后移靠近歌曲结尾。越界、网格不可用或标记冲突时，整次操作取消。</p>
            <p v-if="error" role="alert">{{ error }}</p>
            <div class="operation-actions">
                <button type="button" @click="close">取消</button>
                <button
                    type="button"
                    data-testid="move-track-forward"
                    :disabled="!selectedLane?.events.length"
                    @click="apply(-1)">
                    前移
                </button>
                <button
                    type="button"
                    data-testid="move-track-backward"
                    :disabled="!selectedLane?.events.length"
                    @click="apply(1)">
                    后移
                </button>
            </div>
        </dialog>
    </Teleport>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import AppNumberInput from './controls/AppNumberInput.vue';
import AppSelect from './controls/AppSelect.vue';
import type { EditorProjectV2 } from '../editor/types';
import type { EditorBeatSnapSetting } from '../editor/beatSnap';
import { assertMarkerCellCount } from '../editor/markerGridOffset';
import { moveMarkerLane } from '../editor/markerLaneMovement';

const props = defineProps<{ project: EditorProjectV2; setting: Readonly<EditorBeatSnapSetting>; editable: boolean }>();
const emit = defineEmits<{ opening: []; updateProject: [project: EditorProjectV2]; status: [message: string] }>();
const dialog = ref<HTMLDialogElement | null>(null),
    laneId = ref<string | number>(''),
    cells = ref(1),
    error = ref('');
const hasEvents = computed(() => props.project.lanes.some(lane => lane.events.length));
const selectedLane = computed(() => props.project.lanes.find(lane => lane.id === laneId.value));
const options = computed(() =>
    props.project.lanes.map(lane => ({
        value: lane.id,
        label: `${lane.name} · ${lane.eventKind === 'point' ? '点' : '范围'} · ${lane.events.length} 个标记`,
        disabled: !lane.events.length,
    })),
);
// Compare content rather than object identity: persistence notifications can clone an unchanged project.
const signature = computed(() => JSON.stringify([props.project, props.setting, props.editable]));
let openedSignature = '';
function open() {
    if (!props.editable || !hasEvents.value) return;
    laneId.value = props.project.lanes.find(lane => lane.events.length)!.id;
    cells.value = 1;
    error.value = '';
    openedSignature = signature.value;
    emit('opening');
    dialog.value?.showModal();
}
function close() {
    dialog.value?.close();
}
function apply(direction: -1 | 1) {
    if (!props.editable || signature.value !== openedSignature) {
        close();
        return;
    }
    try {
        assertMarkerCellCount(cells.value, 1);
        const result = moveMarkerLane(props.project, String(laneId.value), direction * cells.value, props.setting);
        emit('updateProject', result.project);
        emit(
            'status',
            `已将轨道“${selectedLane.value!.name}”的 ${result.eventCount} 个标记${direction < 0 ? '前移' : '后移'} ${cells.value} 格。`,
        );
        close();
    } catch (e) {
        error.value = (e as Error).message;
    }
}
watch(signature, () => {
    if (dialog.value?.open) close();
});
onBeforeUnmount(close);
</script>
<style scoped>
.track-operations-dialog {
    width: min(470px, calc(100vw - 32px));
    max-height: calc(100dvh - 40px);
    overflow-y: auto;
    border: 1px solid var(--divider);
    border-radius: 10px;
    padding: 20px;
    background: var(--surface-1);
    color: var(--ink);
}
.track-operations-dialog::backdrop {
    background: #0009;
}
.track-operations-dialog h3 {
    font-size: 16px;
}
.track-operations-dialog p {
    font-size: 12px;
    margin: 10px 0;
    color: var(--body);
}
.track-operations-dialog [role='alert'] {
    color: var(--error);
}
.operation-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin: 16px 0;
    font-size: 13px;
}
.operation-field .app-select {
    --app-control-width: 280px;
    flex: 1;
}
.operation-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 20px;
}
button {
    border: 1px solid var(--divider);
    border-radius: 4px;
    padding: 5px 9px;
    background: var(--surface-2);
    color: var(--body);
    font-size: 12px;
}
button:disabled {
    opacity: 0.45;
}
button:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 1px;
}
</style>
