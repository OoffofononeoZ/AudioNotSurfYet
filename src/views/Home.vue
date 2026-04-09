<template>
    <LightBg :ray-length="rayLength">
    </LightBg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LightBg from '../components/LightBg.vue';
import { useAudioEnergy } from '../stores/audioStore';
const audioEnergy = useAudioEnergy();
const rayLength = computed(() => audioEnergy.value / 60 + 1);
</script>

<style scoped></style>