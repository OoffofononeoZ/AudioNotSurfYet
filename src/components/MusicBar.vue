<template>
    <div id="music-bar-container">
        <div class="h-16" id="music-bar">
            <button @click="toggleChangeStyle">切换样式</button>
            <button @click="togglePlay">停止/重播</button>
            <button @click="togglePause">暂停/继续</button>
            <button @click="toggleSelectFile">选择文件</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import gsap from 'gsap';
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { AudioLoader } from '../audio/AudioLoader';
import Meyda from 'meyda';
import { mapEnergyToDeg } from '../utils/utils';
const audioLoader = new AudioLoader();
const tl1 = gsap.timeline();
// const tl2 = gsap.timeline();

onMounted(() => {
    tl1.to('#music-bar-container', {
        '--offset': '0',
        duration: 0.3,
        ease: 'linear'
    }).pause();
});

onBeforeUnmount(() => {
    tl1.kill();
});

const styleMode = ref(false);
const toggleChangeStyle = () => {
    styleMode.value = !styleMode.value;
    styleMode.value ? tl1.play() : tl1.reverse();
};

const isPlaying = ref(false);
const togglePlay = () => {
    try {
        console.log(musicFile.value?.name);
        isPlaying.value ? audioLoader.stop() : audioLoader.play();
        isPlaying.value = !isPlaying.value;
    } catch (error) {
        if (musicFile.value) loadAudio(musicFile.value);
    }
};
const togglePause = () => {
    try {
        console.log(musicFile.value?.name);
        isPlaying.value ? audioLoader.pause() : audioLoader.resume();
        isPlaying.value = !isPlaying.value;
    } catch (error) {
        if (musicFile.value) loadAudio(musicFile.value);
    }
};


const musicFile = ref<File | null>(null);
const loadAudio = (file: File) => {
    audioLoader.loadAudio(URL.createObjectURL(file)).then(() => togglePlay());
}
const toggleSelectFile = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'audio/*';
    file.onchange = (e) => {
        musicFile.value = (e.target as HTMLInputElement).files?.[0] || null;
        if (musicFile.value) loadAudio(musicFile.value);
    };
    file.click();
};

let raiseSpeed = 0.5;
let fallSpeed = 0.05;
let previousEnergy = 0;
const toggleRealTime = () => {
    let rafId: number | null = null;
    if (audioLoader.getTimeDomainFloatData()) {
        rafId = requestAnimationFrame(() => {
            const features = Meyda.extract(
                ['energy'],
                audioLoader.getTimeDomainFloatData() as Float32Array
            );
            let currentEnergy = features?.energy || 0;
            let prev = previousEnergy;
            if (currentEnergy > prev) {
                previousEnergy = currentEnergy * raiseSpeed + prev * (1 - raiseSpeed);
            } else {
                previousEnergy = currentEnergy * fallSpeed + prev * (1 - fallSpeed);
            }

            // console.log(features);
            const processElement = document.getElementById('music-bar-container');
            processElement?.setAttribute(
                'style',
                `--coinc-process: ${mapEnergyToDeg(previousEnergy)}deg;`);
            toggleRealTime();
        });
    } else {
        rafId ? cancelAnimationFrame(rafId) : null;
        rafId = null;
    }
}

watch(isPlaying, (newVal) => {
    if (newVal) {
        toggleRealTime();
    }
});
</script>

<style scoped>
#music-bar-container {
    --offset: 2rem;
    --border-width: 3px;
    --coinc-process: 0deg;
    --coinc-remain: calc(360deg - var(--coinc-process));
    position: fixed;
    width: calc(100% - var(--offset) * 2 + var(--border-width) * 2);
    height: calc(4rem + var(--border-width) * 2);
    left: calc(var(--offset) - var(--border-width));
    bottom: calc(var(--offset) / 4 - var(--border-width));
    border-radius: calc(var(--offset) * 2);
    background:
        conic-gradient(rgb(145, 145, 145) 0deg var(--coinc-remain),
            transparent var(--coinc-remain) var(--coinc-process),
            rgb(145, 145, 145) var(--coinc-process) 300deg),
        conic-gradient(from 180deg,
            #27ff64,
            #80ff00,
            #fe2912,
            #ff0000,
            #fe2912,
            #80ff00,
            #27ff64);
}

#music-bar {
    width: calc(100% - var(--offset) * 2);
    margin: 0 var(--offset);
    padding: 0 2rem;
    position: fixed;
    bottom: calc(var(--offset) / 4);
    left: 0;
    z-index: 2;
    border-radius: calc(var(--offset) * 2);
    background-color: rgb(40, 40, 40);
    display: flex;
    justify-content: space-between;
    color: white;
}
</style>