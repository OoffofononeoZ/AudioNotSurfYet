<template>
    <main class="min-w-full h-dvh bg-black" id="main-layout">
        <HeaderBar />
        <router-view />
        <MusicBar :progress="0" />
    </main>
</template>

<script setup lang="ts">
import { onUnmounted, provide } from 'vue';
import HeaderBar from '../components/HeaderBar.vue';
import MusicBar from '../components/MusicBar.vue';
import {
    AudioSessionService,
    audioSessionServiceKey,
} from '../audio/audioSessionService';
import { useAudioSessionStore } from '../stores/audioSessionStore';
import { useConfigstore } from '../stores/configStore';

const audioSession = new AudioSessionService(useAudioSessionStore());
audioSession.setVolume(useConfigstore().volume);
provide(audioSessionServiceKey, audioSession);

onUnmounted(() => {
    void audioSession.dispose();
});
</script>

<style scoped>

</style>
