<template>
    <div class="h-16" id="music-bar">
        <button @click="togglePlay">test button</button>
    </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';
import { ref, onMounted, onBeforeUnmount } from 'vue';

const tl = gsap.timeline();

onMounted(() => {
    tl.to('#music-bar', {
        width: '99.8%',
        duration: 0.3,
        borderRadius: '0',
        margin: '0',
        bottom: '0',
        ease: 'linear'
    }).pause();
});

onBeforeUnmount(() => {
    tl.kill();
});

const isPlaying = ref(false);

const togglePlay = () => {
    isPlaying.value = !isPlaying.value;
    isPlaying.value ? tl.play() : tl.reverse();
};
</script>

<style scoped>
    #music-bar {
        --margin-horizontal: 2rem;
        width: calc(100% - 4rem);
        margin: 0 var(--margin-horizontal);
        padding: 0 var(--margin-horizontal);
        position: fixed;
        bottom: 5px;
        left: 0;
        z-index: 1000;
        border: 1px solid var(--main-color);
        border-radius: 50px;
        background: #111111;
    }
</style>