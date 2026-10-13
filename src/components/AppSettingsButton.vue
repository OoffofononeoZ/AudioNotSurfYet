<template>
    <button type="button" class="app-settings" aria-label="设置" title="设置"
        :aria-expanded="settingsOpen" data-testid="app-settings" @click="toggleSettings">
        <svg aria-hidden="true"><use href="/icons.svg#nav-settings" /></svg>
    </button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { emitter } from '../utils/emitter';

const settingsOpen = ref(false);
const toggleSettings = () => {
    settingsOpen.value = !settingsOpen.value;
    emitter.emit('settings-open', settingsOpen.value);
};
</script>

<style scoped>
.app-settings {
    position: fixed; top: 12px; right: 12px; z-index: var(--layer-navigation);
    display: grid; place-items: center; width: 36px; height: 36px;
    padding: 7px; border: 0; border-radius: 6px; background: transparent;
    color: var(--body); cursor: pointer;
}
.app-settings svg { width: 22px; height: 22px; }
.app-settings:hover { color: var(--accent-soft); background: var(--control-hover); }
.app-settings:focus-visible { outline: 2px solid var(--accent-soft); outline-offset: 2px; }
</style>
