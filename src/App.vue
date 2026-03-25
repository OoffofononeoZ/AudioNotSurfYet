<template>
    <main class="bg-black w-screen h-screen">

    </main>
</template>

<script setup lang="ts">
import { AudioLoader } from './audio/AudioLoader';
import Meyda from 'meyda';

const audioLoader = new AudioLoader();

audioLoader.loadAudio('/audios/OU-ROGUELIKE(150).mp3').then(
    () => {
        audioLoader.processFrames(1024, 512, (frame) => {
            const features = Meyda.extract([
                'rms',
                'zcr',
                'energy',
                'amplitudeSpectrum',
                'spectralCentroid',
            ], frame);
            console.log(features);
            // 其他处理...
        })
    }
)
</script>
<style scoped></style>
