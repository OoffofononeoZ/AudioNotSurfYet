<template>
    <main class="bg-black w-screen h-screen">
        <TwoDTable />
        <TestComp :data="zcrData" name="zcr" :range="[0, 100]" :progress="0"/>
        <TestComp :data="energyData" name="energy" :range="[0, 100]" :progress="0"/>
    </main>
</template>

<script setup lang="ts">
import TwoDTable from './components/twoDTable.vue';
import TestComp from './components/testcomp.vue';

const data = () => {
    const data = [];
    for (let i = 0; i < 1024; i++) {
        data.push(Math.random() * 100);
    }
    console.log(data);
    return data;
}
import { AudioLoader } from './audio/AudioLoader';
import Meyda from 'meyda';

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
)
</script>
<style scoped></style>
