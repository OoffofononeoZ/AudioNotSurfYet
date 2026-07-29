<template>
    <LightBg :ray-length="rayLength">
    </LightBg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import LightBg from '../components/LightBg.vue';
import { useAudioSessionStore } from '../stores/audioSessionStore';

const { currentEnergy } = storeToRefs(useAudioSessionStore());
const rayLength = computed(() => currentEnergy.value / 60 + 1);
</script>

<style scoped></style>
