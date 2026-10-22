<template>
    <div class="realtime-visualizer" :data-realtime-state="error ? 'error' : status">
        <canvas ref="canvas" data-testid="realtime-visualizer-canvas" aria-label="实时音频可视化" />
        <div v-if="error" class="realtime-message" role="alert">
            {{ error }} <button type="button" @click="retry">重试</button>
        </div>
        <div v-else-if="status === 'loading'" class="realtime-message realtime-loading" role="status">
            正在准备实时样式
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import { RealtimeStyleRepository } from '../../visualizer/realtimeStyleRepository';
import { RealtimeSurface } from '../../visualizer/realtimeSurface';
import { RealtimeBrowserSession, useRealtimeBrowserDependencies } from '../../visualizer/realtimeBrowserSession';
const props = defineProps<{ styleId: string }>();
const dependencies = useRealtimeBrowserDependencies(),
    repository = new RealtimeStyleRepository();
const canvas = ref<HTMLCanvasElement | null>(null),
    inputError = ref(''),
    renderError = ref(''),
    status = ref('loading');
const error = computed(() => inputError.value || renderError.value);
let surface: RealtimeSurface | null = null,
    session: RealtimeBrowserSession | null = null,
    generation = 0,
    disposed = false;
function cleanup() {
    session?.dispose();
    session = null;
    surface?.dispose();
    surface = null;
}
async function load() {
    const token = ++generation;
    cleanup();
    inputError.value = '';
    renderError.value = '';
    status.value = 'loading';
    if (!canvas.value) return;
    try {
        const style = await repository.read(props.styleId);
        if (disposed || token !== generation) return;
        if (!style) throw Error('该实时样式不存在，请返回 Visualizer 重新生成。');
        surface = new RealtimeSurface(canvas.value, style, value => {
            if (token !== generation || disposed) return;
            status.value = value.state;
            if (value.state === 'error') renderError.value = value.message ?? '实时渲染失败。';
            else if (value.state === 'ready') renderError.value = '';
        });
        session = new RealtimeBrowserSession(dependencies, surface, style, message => {
            if (token === generation && !disposed) inputError.value = message;
        });
    } catch (e) {
        if (token === generation && !disposed) {
            cleanup();
            renderError.value = (e as Error).message;
        }
    }
}
function retry() {
    inputError.value = '';
    renderError.value = '';
    if (session) session.retry();
    else void load();
}
watch(() => [props.styleId, canvas.value], load, { flush: 'post', immediate: true });
onBeforeUnmount(() => {
    disposed = true;
    ++generation;
    cleanup();
    repository.close();
});
</script>
<style scoped>
.realtime-visualizer {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #000;
}
canvas {
    display: block;
    width: 100%;
    height: 100%;
}
.realtime-message {
    position: absolute;
    top: 24px;
    left: 24px;
    right: 24px;
    padding: 14px;
    background: #18231ee8;
    color: #edf5f1;
    border-radius: 8px;
}
.realtime-message button {
    margin-left: 12px;
    text-decoration: underline;
}
.realtime-loading {
    top: 64px;
    left: 50%;
    right: auto;
    width: max-content;
    max-width: calc(100% - 48px);
    transform: translateX(-50%);
    background: var(--surface-player);
    box-shadow: 0 8px 24px rgb(0 0 0 / 25%);
}
</style>
