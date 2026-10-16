<template>
    <div class="feature-description">
        <button v-if="overflowing" type="button" class="description-toggle"
            :aria-label="(expanded ? '收起 ' : '展开 ') + label + ' 特征说明'"
            :title="expanded ? '收起说明' : '展开说明'" :aria-expanded="expanded"
            :aria-controls="descriptionId" @click="$emit('toggle')">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path :d="expanded ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'" /></svg>
        </button>
        <span v-else class="description-spacer" aria-hidden="true"></span>
        <div ref="textArea" class="description-area">
            <p :id="descriptionId" class="description" :class="{ 'is-expanded': expanded && overflowing }">{{ text }}</p>
            <p ref="probe" class="description-probe" aria-hidden="true">{{ text }}</p>
            <p v-if="featureId === 'wallpaperEngineSpectrum' && expanded" class="source-links">
                <a href="https://docs.wallpaperengine.io/en/web/audio/visualizer.html" target="_blank" rel="noopener noreferrer">官方接口</a> ·
                <a href="https://steamcommunity.com/sharedfiles/filedetails/?id=837435817" target="_blank" rel="noopener noreferrer">开发者历史说明（2017）</a> ·
                <a href="https://github.com/deepratna-awale/open-wallpaper-engine-mac/wiki/Audio-System" target="_blank" rel="noopener noreferrer">OWE 近似参考</a>
            </p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps<{ featureId: string; label: string; text: string; expanded: boolean }>();
defineEmits<{ toggle: [] }>();
const descriptionId = 'feature-description-' + props.featureId;
const textArea = ref<HTMLElement | null>(null);
const probe = ref<HTMLElement | null>(null);
const overflowing = ref(false);
let observer: ResizeObserver | null = null;
let frame: number | null = null;
let disposed = false;
const measure = () => {
    frame = null;
    if (!probe.value || disposed) return;
    const line = parseFloat(getComputedStyle(probe.value).lineHeight);
    overflowing.value = probe.value.getBoundingClientRect().height > line + 1;
};
const schedule = () => {
    if (!disposed && frame === null) frame = requestAnimationFrame(measure);
};
watch(() => props.text, schedule, { flush: 'post' });
onMounted(() => {
    observer = new ResizeObserver(schedule);
    if (textArea.value) observer.observe(textArea.value);
    schedule();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener('loadingdone', schedule);
});
onBeforeUnmount(() => {
    disposed = true;
    observer?.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    document.fonts.removeEventListener('loadingdone', schedule);
});
</script>

<style scoped>
.feature-description { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px;
    align-items: start; margin-top: 8px; color: var(--body); font-size: 0.8rem; line-height: 1.55; }
.description-area { min-width: 0; position: relative; overflow: hidden; }
.description, .description-probe { margin: 0; line-height: inherit; }
.description { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.description.is-expanded { white-space: normal; }
.source-links { margin: 8px 0 0; } .source-links a { color: var(--accent); }
.description-probe { position: absolute; top: 0; left: 0; width: 100%; visibility: hidden;
    pointer-events: none; white-space: normal; }
.description-toggle { display: grid; place-items: center; width: 24px; height: 24px; margin-top: -2px;
    border: 0; border-radius: 4px; padding: 3px; background: transparent; color: var(--mute); cursor: pointer; }
.description-toggle svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; }
.description-toggle:hover { color: var(--accent); background: var(--control-hover); }
.description-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
