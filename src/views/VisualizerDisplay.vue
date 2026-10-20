<template>
    <main
        ref="root"
        class="visualizer-display"
        data-testid="visualizer-display"
        @pointermove="reveal"
        @keydown="reveal"
        @focusin="hold"
        @focusout="release">
        <RealtimeVisualizer :style-id="String(route.params.styleId)" />
        <nav v-show="visible" class="display-controls" aria-label="展示控制">
            <RouterLink to="/">返回首页</RouterLink
            ><button type="button" @click="fullscreen.toggle">
                {{ fullscreen.active.value ? '退出全屏' : '全屏' }}
            </button>
        </nav>
        <div v-show="visible" class="display-player"><MusicBar :progress="0" /></div>
        <p v-if="fullscreen.error.value" class="display-error" role="alert">{{ fullscreen.error.value }}</p>
    </main>
</template>
<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import MusicBar from '../components/MusicBar.vue';
import RealtimeVisualizer from '../components/visualizer/RealtimeVisualizer.vue';
import { useVisualizerFullscreen } from '../visualizer/useVisualizerFullscreen';
const route = useRoute(),
    root = ref<HTMLElement | null>(null),
    visible = ref(true);
const fullscreen = useVisualizerFullscreen(
    root,
    () => true,
    () => false,
);
let timer: ReturnType<typeof setTimeout> | null = null,
    held = false;
function clear() {
    if (timer) clearTimeout(timer);
    timer = null;
}
function reveal() {
    clear();
    visible.value = true;
    if (!held) timer = setTimeout(() => (visible.value = false), 2000);
}
function hold() {
    held = true;
    clear();
    visible.value = true;
}
function release(event: FocusEvent) {
    if (root.value?.contains(event.relatedTarget as Node | null)) return;
    held = false;
    reveal();
}
onMounted(() => {
    reveal();
    document.addEventListener('keydown', reveal);
});
onBeforeUnmount(() => {
    clear();
    document.removeEventListener('keydown', reveal);
});
</script>
<style scoped>
.visualizer-display {
    position: relative;
    width: 100%;
    height: 100dvh;
    overflow: hidden;
    background: #000;
}
.display-controls {
    position: absolute;
    z-index: 120;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 12px;
    color: #edf5f1;
}
.display-controls > * {
    padding: 10px 16px;
    border: 1px solid #46594e;
    border-radius: 6px;
    background: #111b15e8;
}
.display-error {
    position: absolute;
    top: 72px;
    left: 24px;
    color: #edf5f1;
}
</style>
