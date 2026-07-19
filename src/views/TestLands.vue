<template>
    <main class="w-full h-full">
        <div v-if="!loading">
            <!-- <TwoDTable :data="loudnessData" name="loudness" :range="[0, 100]" :progress="0" />
            <TwoDTable :data="energyData" name="energy" :range="[0, 100]" :progress="0" /> -->
        </div>
        <TestComp />
    </main>
</template>
<script setup lang="ts">
import TwoDTable from '../components/TwoDTable.vue';
import TestComp from '../components/testcomp.vue';
import { AudioLoader } from '../audio/AudioLoader';
import Meyda from 'meyda';
import { ref, watch } from 'vue';

const loading = ref(true);
const audioLoader = new AudioLoader();
const loudnessData: number[] = [];
const energyData: number[] = [];
// audioLoader.loadAudio('/audios/KARAKURI - Winning Day (SprightS Remix) (1).mp3').then(
//     () => {
//         audioLoader.processFrames(1024, 512, (frame, index) => {
//             const features = Meyda.extract([
//                 'loudness',
//                 'energy',
//             ], frame);
//             console.log(index, features);
//             if (features && features.loudness && features.energy) {
//                 loudnessData.push(features.loudness.total);
//                 energyData.push(features.energy);
//             }
//             // 其他处理...
//         })
//     }
// ).finally(() => {
//     loading.value = false;
// });
watch(loading, (newVal) => {
    if (!newVal) {
        console.log(loudnessData.length, energyData.length);
    }
})
</script>