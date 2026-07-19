<template>
    <main class="w-full h-full overflow-y-hidden relative">
        <DotGridBg />
        <div class="absolute top-0 left-0 overflow-y-auto max-h-screen scrollbar-hide">
            <div v-for="value in source">
                <div class="rounded-md bg-transparent text-white">
                    {{ value }}
                </div>
            </div>
        </div>
    </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import DotGridBg from '../components/DotGridBg.vue';
import { analyzerData } from '../data/analyzerData';
const source = ref(analyzerData);

</script>

<style scoped></style>