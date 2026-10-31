<template>
    <section class="grid gap-2" aria-label="歌词字体">
        <span>字体：{{ font?.fullName ?? '默认字体' }}</span>
        <button type="button" class="viz-button" :disabled="disabled || busy || !available" @click="load">
            {{ busy ? '正在读取字体…' : '读取本机字体' }}
        </button>
        <p v-if="!available" class="viz-muted">当前环境不支持读取本机字体。</p>
        <p v-if="error" role="alert">{{ error }}</p>
        <template v-if="fonts.length">
            <label class="viz-field"
                ><span>筛选字体</span><input v-model="query" aria-label="筛选字体" :disabled="disabled"
            /></label>
            <label class="viz-field"
                ><span>字体</span
                ><AppSelect
                    label="歌词字体"
                    :model-value="font?.postscriptName ?? ''"
                    :options="options"
                    :disabled="disabled"
                    @change="choose"
            /></label>
        </template>
        <button
            v-else-if="font"
            type="button"
            class="viz-button"
            :disabled="disabled"
            @click="emit('change', undefined)">
            恢复默认字体
        </button>
    </section>
</template>
<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import { usePlatformPorts } from '../../platform/platformPorts';
import type { LyricFont } from '../../visualizer/lyricTypes';
const props = defineProps<{ font?: LyricFont; disabled: boolean; identity: string }>();
const emit = defineEmits<{ change: [font: LyricFont | undefined] }>();
const fontCatalog = usePlatformPorts().fontCatalog;
const available = fontCatalog.available(),
    fonts = ref<LyricFont[]>([]),
    query = ref(''),
    error = ref(''),
    busy = ref(false);
const filtered = computed(() =>
    fonts.value.filter(f => f.fullName.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())),
);
const options = computed(() => {
    const list = filtered.value.map(item => ({ value: item.postscriptName, label: item.fullName }));
    if (props.font && !list.some(item => item.value === props.font?.postscriptName))
        list.unshift({ value: props.font.postscriptName, label: props.font.fullName });
    return [{ value: '', label: '默认字体' }, ...list];
});
let pending: AbortController | undefined;
const cancel = () => {
    pending?.abort();
    pending = undefined;
    busy.value = false;
};
watch(() => [props.identity, props.disabled], cancel);
onBeforeUnmount(cancel);
async function load() {
    cancel();
    const task = new AbortController();
    pending = task;
    busy.value = true;
    error.value = '';
    try {
        const result = await fontCatalog.read(task.signal);
        if (pending === task) fonts.value = result;
    } catch (e) {
        if (pending === task && !task.signal.aborted) error.value = (e as Error).message;
    } finally {
        if (pending === task) {
            pending = undefined;
            busy.value = false;
        }
    }
}
function choose(id: string | number) {
    emit(
        'change',
        fonts.value.find(f => f.postscriptName === id),
    );
}
</script>
