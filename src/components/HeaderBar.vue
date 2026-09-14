<template>
    <header
        class="w-full h-16 fixed top-0 left-0"
        :class="{ 'main-header--contextual': !isHome }"
        id="main-header"
    >
        <section class="min-w-32">
            <router-link to="/" class="header-brand">AUDIOSURF</router-link>
        </section>
        <section class="header-nav">
            <router-link :to="visualizerTarget" class="header-nav-link" data-testid="header-visualizer-link">Visualizer</router-link>
            <router-link to="/analyzer" class="header-nav-link">Analyzer</router-link>
            <router-link :to="editorTarget" class="header-nav-link" data-testid="header-editor-link">Editor</router-link>
            <router-link to="/testlands" class="header-nav-link">TestLands</router-link>
        </section>
        <section class="min-w-32 flex justify-end">
            <button @click="toggleSettings" class="header-settings" :aria-expanded="settingsOpen"
                aria-label="打开或关闭设置">Settings</button>
        </section>
    </header>
</template>

<script setup lang="ts">
import { emitter } from '../utils/emitter';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAudioSessionStore } from '../stores/audioSessionStore';

const route = useRoute();
const audioSessionStore = useAudioSessionStore();
const isHome = computed(() => route.path === '/');
const editorTarget = computed(() => audioSessionStore.currentTrackId
    ? { name: 'editor', params: { trackId: audioSessionStore.currentTrackId } }
    : { name: 'editor' });
const visualizerTarget = computed(() => audioSessionStore.currentTrackId
    ? { name: 'visualizer', params: { trackId: audioSessionStore.currentTrackId } }
    : { name: 'visualizer' });
const settingsOpen = ref(false);
const toggleSettings = () => {
    settingsOpen.value = !settingsOpen.value;
    emitter.emit('settings-open', settingsOpen.value);
}
</script>
<style scoped>
#main-header {
    backdrop-filter: none;
    background: transparent;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    z-index: var(--layer-header);
}

.header-brand {
    color: var(--ink);
    font-size: var(--text-display-md-size);
    font-weight: var(--text-display-md-weight);
    line-height: var(--text-display-md-line);
    letter-spacing: var(--text-display-md-tracking);
    text-decoration: none;
}

.header-nav {
    display: flex;
    gap: var(--space-lg);
}

.header-nav-link {
    position: relative;
    color: var(--ink-strong);
    font-size: var(--text-body-sm-size);
    font-weight: var(--text-body-sm-weight);
    line-height: var(--text-body-sm-line);
    text-decoration: none;
    transition: color 120ms ease;
}

.header-nav-link:hover,
.header-nav-link:focus-visible {
    color: var(--accent-soft);
}

.header-nav-link.router-link-active {
    color: var(--accent);
}

.header-nav-link.router-link-active::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: -6px;
    height: 2px;
    border-radius: var(--radius-pill);
    background: var(--accent);
    pointer-events: none;
}

.header-settings {
    color: var(--ink);
    font-family: inherit;
    font-size: var(--text-body-sm-size);
    font-weight: var(--text-body-sm-weight);
    line-height: var(--text-body-sm-line);
    background: transparent;
    border: none;
    padding: var(--space-md) var(--space-lg);
    cursor: pointer;
    transition: color 120ms ease;
}

.header-settings:hover,
.header-settings:focus-visible {
    color: var(--accent-soft);
}

#main-header.main-header--contextual {
    -webkit-backdrop-filter: blur(18px);
    backdrop-filter: blur(18px);
    background: rgba(2, 4, 3, 0.72);
}
#main-header::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 1px;
    top: 100%;
    left: 0;
    background: linear-gradient(90deg, #0000, var(--main-color), #0000);
    pointer-events: none;
    z-index: 1;
}

#main-header a:focus-visible,
#main-header button:focus-visible {
    border-radius: 4px;
    outline: 2px solid var(--main-color);
    outline-offset: 4px;
}
</style>
