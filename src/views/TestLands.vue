<template>
    <main class="w-full h-full">
        <TwoDTable />
        <div v-if="!loading">
            <TestComp :data="zcrData" name="zcr" :range="[0, 100]" :progress="0" />
            <TestComp :data="energyData" name="energy" :range="[0, 100]" :progress="0" />
        </div>
    </main>
</template>
<script setup lang="ts">
import TwoDTable from '../components/twoDTable.vue';
import TestComp from '../components/testcomp.vue';
import { AudioLoader } from '../audio/AudioLoader';
import Meyda from 'meyda';
import { ref } from 'vue';

const loading = ref(true);
const audioLoader = new AudioLoader();
const zcrData: number[] = [];
const energyData: number[] = [];
audioLoader.loadAudio('/audios/night is long(148).mp3').then(
    () => {
        audioLoader.processFrames(1024, 512, (frame) => {
            const features = Meyda.extract([
                'zcr',
                'energy',
            ], frame);
            console.log(features);
            if (features && features.zcr && features.energy) {
                zcrData.push(features.zcr);
                energyData.push(features.energy);
            }
            // 其他处理...
        })
    }
).finally(() => {
    loading.value = false;
});
</script>