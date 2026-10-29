<template>
    <section class="grid gap-2" :data-lyric-input="definition.id">
        <h3>{{ definition.label }}</h3>
        <label class="viz-field"
            ><span>LRC 文件</span
            ><PlatformFileInput
                purpose="lyrics"
                :selection-key="`${elementId}:${definition.id}:${projectRevision}`"
                accept=".lrc,text/plain"
                :disabled="disabled || busy"
                @files="select"
                @error="message => (error = message)"
        /></label>
        <p v-if="busy" class="viz-muted" role="status">正在读取歌词…</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <p v-if="binding.kind === 'unbound'" class="viz-muted">请选择带时间戳的 UTF-8 LRC 文件。</p>
        <template v-else>
            <p class="viz-muted break-all">{{ assets.find(a => a.id === selectedAsset)?.name }}</p>
            <label class="viz-field"
                ><span>提前入场（秒）</span
                ><AppNumberInput
                    :model-value="binding.leadSeconds"
                    :min="0.001"
                    :editing-precision="3"
                    label="歌词提前入场"
                    :disabled="disabled || busy"
                    @change="value => patch({ leadSeconds: value })"
            /></label>
            <label class="viz-field"
                ><span>离场时长（秒）</span
                ><AppNumberInput
                    :model-value="binding.tailSeconds"
                    :min="0.001"
                    :editing-precision="3"
                    label="歌词离场时长"
                    :disabled="disabled || busy"
                    @change="value => patch({ tailSeconds: value })"
            /></label>
            <label class="viz-field"
                ><span>歌词时移（秒）</span
                ><AppNumberInput
                    :model-value="binding.offsetSeconds"
                    :editing-precision="3"
                    label="歌词时移"
                    :disabled="disabled || busy"
                    @change="value => patch({ offsetSeconds: value })"
            /></label>
            <p class="viz-muted">正值延后，负值提前。歌词时间跟随歌曲，不随元素起点平移。</p>
            <button type="button" class="viz-button" :disabled="disabled || busy" @click="clear">清除歌词</button>
        </template>
    </section>
</template>
<script setup lang="ts">
import PlatformFileInput from '../platform/PlatformFileInput.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import { importLyricFile } from '../../visualizer/lyricImport';
import type { LyricAsset, LyricBinding, LyricInputDefinition } from '../../visualizer/lyricTypes';
const props = defineProps<{
    elementId: string;
    projectRevision: string;
    definition: LyricInputDefinition;
    binding: LyricBinding;
    assets: LyricAsset[];
    disabled: boolean;
}>();
const emit = defineEmits<{
    change: [payload: { elementId: string; inputId: string; binding: LyricBinding; assets: LyricAsset[] }];
}>();
const busy = ref(false),
    error = ref('');
let pending: AbortController | null = null;
const selectedAsset = computed(() => (props.binding.kind === 'lyrics' ? props.binding.assetId : ''));
const cancel = () => {
    pending?.abort();
    pending = null;
    busy.value = false;
};
watch(
    [
        () => props.elementId,
        () => props.projectRevision,
        () => props.definition.id,
        () => props.disabled,
        () => JSON.stringify(props.binding),
    ],
    cancel,
);
onBeforeUnmount(cancel);
async function select(files: File[]) {
    const file = files[0];
    if (!file) return;
    cancel();
    const task = new AbortController();
    pending = task;
    busy.value = true;
    error.value = '';
    const elementId = props.elementId,
        inputId = props.definition.id;
    try {
        const result = await importLyricFile(file, task.signal);
        if (pending !== task || task.signal.aborted || props.elementId !== elementId) return;
        emit('change', { elementId, inputId, ...result });
    } catch (cause) {
        if (!task.signal.aborted && pending === task) error.value = (cause as Error).message;
    } finally {
        if (pending === task) {
            pending = null;
            busy.value = false;
        }
    }
}
function patch(value: Partial<Extract<LyricBinding, { kind: 'lyrics' }>>) {
    if (props.binding.kind === 'lyrics')
        emit('change', {
            elementId: props.elementId,
            inputId: props.definition.id,
            binding: { ...props.binding, ...value },
            assets: [],
        });
}
function clear() {
    cancel();
    error.value = '';
    emit('change', {
        elementId: props.elementId,
        inputId: props.definition.id,
        binding: { kind: 'unbound' },
        assets: [],
    });
}
</script>
