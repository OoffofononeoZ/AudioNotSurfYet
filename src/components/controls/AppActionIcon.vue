<template>
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true">
        <path :d="paths[name]" />
    </svg>
</template>
<script setup lang="ts">
defineProps<{ name: string }>();
const paths: Record<string, string> = {
    project: 'M14 3H5v18h14V8l-5-5v5h5M8 12h8M8 16h6',
    style: 'M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4M15 8h.01',
    osu: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    close: 'm6 6 12 12M18 6 6 18',
    right: 'm9 5 7 7-7 7',
    back: 'm14 5-7 7 7 7',
    home: 'm3 10 9-7 9 7v10H3V10M9 20v-7h6v7',
    display: 'M3 4h18v13H3zM8 21h8m-4-4v4',
    wallpaper: 'M3 4h18v16H3zM3 16l6-6 4 4 3-3 5 5M16 8h.01',
    copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
    check: 'm5 12 4 4L19 6',
    folder: 'M3 7V4h6l3 3h9v13H3zM3 10h18',
};
</script>
