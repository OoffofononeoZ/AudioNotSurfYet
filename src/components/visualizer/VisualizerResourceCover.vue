<template>
    <img :src="source" alt="" draggable="false" @error="failed = true" />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { DEFAULT_RESOURCE_PREVIEW } from '../../visualizer/resourcePreview';
const props = defineProps<{ src?: string }>();
const failed = ref(false);
const source = computed(() => (!failed.value && props.src) || DEFAULT_RESOURCE_PREVIEW);
watch(
    () => props.src,
    () => {
        failed.value = false;
    },
);
</script>

<style scoped>
img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
}
</style>
