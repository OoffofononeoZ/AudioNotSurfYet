<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="paths[name]" /></svg>
</template>
<script setup lang="ts">
defineProps<{ name: keyof typeof paths }>();
const paths = {
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
    import: 'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
    export: 'M12 15V3m-4 4 4-4 4 4M4 15v5h16v-5',
    overlay: 'm12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5',
    features: 'M4 6h7m4 0h5M4 12h3m4 0h9M4 18h11m4 0h1M11 3v6M7 9v6m8 0v6',
    left: 'M19 12H5m6-6-6 6 6 6',
    right: 'M5 12h14m-6-6 6 6-6 6',
    zoomIn: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6M6 10h8M10 6v8',
    zoomOut: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14m5 12 6 6M6 10h8',
    reset: 'M4 9a8 8 0 1 1 0 6M4 3v6h6',
};
</script>
