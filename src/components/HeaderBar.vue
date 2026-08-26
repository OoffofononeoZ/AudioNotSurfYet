<template>
    <header
        class="w-full h-16 fixed top-0 left-0"
        :class="{ 'main-header--contextual': !isHome }"
        id="main-header"
    >
        <section class="min-w-32">
            <router-link to="/" class="text-white font-bold text-2xl">AUDIOSURF</router-link>
        </section>
        <section class="flex gap-4">
            <router-link to="/comingsoon" class="text-white">Visualizer</router-link>
            <router-link to="/analyzer" class="text-white">Analyzer</router-link>
            <router-link :to="editorTarget" class="text-white" data-testid="header-editor-link">Editor</router-link>
            <router-link to="/testlands" class="text-white">TestLands</router-link>
        </section>
        <section class="min-w-32 flex justify-end">
            <button @click="toggleSettings" class="text-white" :aria-expanded="settingsOpen"
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
