<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <template v-if="name==='more'"><circle cx="5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="19" cy="12" r=".8"/></template>
        <template v-else>
            <path :d="paths[name]"/>
            <path v-if="name==='repeat-one'" d="m10.5 10 1.5-1v6"/>
        </template>
    </svg>
</template>

<script setup lang="ts">
type IconName = 'sequence'|'repeat-one'|'repeat-all'|'shuffle'|'volume'|'volume-low'|'volume-muted'|'queue'|'import'|'appearance'|'more';
defineProps<{ name: IconName }>();
const repeat = 'm17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16m-14 16-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3';
const speaker = 'M11 5 6 9H3v6h3l5 4V5Z';
const paths: Record<Exclude<IconName,'more'>, string> = {
    sequence: 'M4 6h16M4 12h16M4 18h9m4-3 3 3-3 3',
    'repeat-one': repeat, 'repeat-all': repeat,
    shuffle: 'M3 6h3l12 12h3M3 18h3L18 6h3M18 3l3 3-3 3M18 15l3 3-3 3',
    volume: speaker+'M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
    'volume-low': speaker+'M15 8a6 6 0 0 1 0 8',
    'volume-muted': speaker+'m16 9 6 6m0-6-6 6',
    queue: 'M4 6h16M4 11h10M4 16h7m5-3 5 3.5-5 3.5v-7Z',
    import: 'M3 8V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8Zm9 3v6m-3-3h6',
    appearance: 'M14 3H6a3 3 0 0 0-3 3v8m7-6h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2M8 16h13m-9 2.5h.01m3 0h3',
};
</script>
