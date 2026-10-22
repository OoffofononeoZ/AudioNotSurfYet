<template>
    <section class="grid gap-2" :data-media-input="definition.id">
        <h3>{{ definition.label }}</h3>
        <label class="viz-field"
            ><span>素材</span
            ><input
                type="file"
                :accept="accept"
                :multiple="definition.multiple"
                :disabled="disabled || busy"
                @change="select"
        /></label>
        <p v-if="busy" class="viz-muted" role="status">正在读取并验证素材…</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <template v-if="binding.kind === 'media'">
            <p class="viz-muted break-all">{{ names }}</p>
            <label class="viz-field"
                ><span>填充</span
                ><AppSelect
                    :model-value="binding.fit"
                    label="媒体填充"
                    :options="fitOptions"
                    :disabled="disabled || busy"
                    @change="value => patch({ fit: value as 'cover' | 'contain' | 'initial' })"
            /></label>
            <template v-if="binding.assetIds.length > 1">
                <label class="viz-field"
                    ><span>轮播间隔（秒）</span
                    ><AppNumberInput
                        :model-value="binding.intervalSeconds"
                        :min="0.001"
                        :editing-precision="3"
                        label="轮播间隔"
                        :disabled="disabled || busy"
                        @change="
                            value =>
                                patch({
                                    intervalSeconds: value,
                                    crossfadeSeconds: Math.min(
                                        value,
                                        binding.kind === 'media' ? binding.crossfadeSeconds : 0,
                                    ),
                                })
                        "
                /></label>
                <label class="viz-field"
                    ><span>淡化（秒）</span
                    ><AppNumberInput
                        :model-value="binding.crossfadeSeconds"
                        :min="0"
                        :max="binding.intervalSeconds"
                        :editing-precision="3"
                        label="轮播淡化"
                        :disabled="disabled || busy"
                        @change="value => patch({ crossfadeSeconds: value })"
                /></label>
            </template>
            <button type="button" class="viz-button" :disabled="disabled || busy" @click="clear">清除素材</button>
        </template>
    </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import { importMediaFiles } from '../../visualizer/mediaImport';
import type { MediaAsset, MediaBinding, MediaInputDefinition } from '../../visualizer/mediaTypes';
const props = defineProps<{
    elementId: string;
    definition: MediaInputDefinition;
    binding: MediaBinding;
    assets: MediaAsset[];
    disabled: boolean;
}>();
const emit = defineEmits<{
    change: [payload: { elementId: string; inputId: string; binding: MediaBinding; assets: MediaAsset[] }];
}>();
const busy = ref(false),
    error = ref('');
let pending: AbortController | null = null;
const fitOptions = [
    { value: 'cover', label: '覆盖' },
    { value: 'contain', label: '完整显示' },
    { value: 'initial', label: '原始尺寸' },
];
const accept = computed(() =>
    props.definition.kinds
        .flatMap(k => (k === 'image' ? ['image/png', 'image/jpeg', 'image/webp'] : ['video/webm', 'video/mp4']))
        .join(','),
);
const names = computed(() =>
    props.binding.kind === 'media'
        ? props.binding.assetIds.map(id => props.assets.find(a => a.id === id)?.name ?? '素材缺失').join('、')
        : '',
);
function cancel() {
    pending?.abort();
    pending = null;
    busy.value = false;
}
watch(() => [props.elementId, props.disabled], cancel);
onBeforeUnmount(cancel);
function patch(value: Partial<Exclude<MediaBinding, { kind: 'none' }>>) {
    if (props.binding.kind === 'media')
        emit('change', {
            elementId: props.elementId,
            inputId: props.definition.id,
            binding: { ...props.binding, ...value },
            assets: [],
        });
}
function clear() {
    emit('change', { elementId: props.elementId, inputId: props.definition.id, binding: { kind: 'none' }, assets: [] });
}
async function select(event: Event) {
    const input = event.target as HTMLInputElement,
        files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length) return;
    cancel();
    const task = new AbortController();
    pending = task;
    busy.value = true;
    error.value = '';
    const elementId = props.elementId,
        inputId = props.definition.id;
    try {
        const result = await importMediaFiles(files, props.definition, task.signal);
        task.signal.throwIfAborted();
        emit('change', { elementId, inputId, ...result });
    } catch (e) {
        if (!task.signal.aborted) error.value = (e as Error).message;
    } finally {
        if (pending === task) {
            pending = null;
            busy.value = false;
        }
    }
}
</script>
