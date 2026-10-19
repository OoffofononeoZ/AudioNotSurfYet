<template>
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.55"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path :d="paths[name] || paths.square" />
    </svg>
</template>
<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
    music: 'M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m11-2a3 3 0 1 1-3-3c2 0 3 1 3 3',
    right: 'm9 5 7 7-7 7',
    add: 'M12 5v14M5 12h14',
    close: 'm6 6 12 12M18 6 6 18',
    import: 'M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5',
    export: 'M12 15V3m-4 4 4-4 4 4M4 15v5h16v-5',
    fullscreen: 'M9 4H4v5m11-5h5v5M4 15v5h5m6 0h5v-5',
    exit: 'M4 9h5V4m6 0v5h5M9 20v-5H4m16 0h-5v5',
    record: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    stop: 'M6 6h12v12H6z',
    play: 'm9 5 10 7-10 7z',
    pause: 'M8 5v14M16 5v14',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    hidden: 'm3 3 18 18M9 5a11 11 0 0 1 3 0c7 0 10 7 10 7a18 18 0 0 1-4 5M6 6a19 19 0 0 0-4 6s3 7 10 7a11 11 0 0 0 5-1',
    trash: 'M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
    up: 'm7 14 5-5 5 5',
    down: 'm7 10 5 5 5-5',
    layers: 'm12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5',
    sliders: 'M4 6h7m4 0h5M4 12h3m4 0h9M4 18h11m4 0h1M11 3v6M7 9v6m8 0v6',
    square: 'M4 4h16v16H4z',
    save: 'M5 3h12l4 4v14H3V3h2M7 3v6h10V3M7 21v-8h10v8',
};
</script>
