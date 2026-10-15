<template>
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true" class="viz-preset-preview">
        <rect width="320" height="180" :fill="cinematic?'#02030c':'#000'"/>
        <g v-if="cinematic" stroke-width="1">
            <path v-for="i in 14" :key="i" :d="polygon(i)" :stroke="i%2?'#65cfff':'#dc59ff'" :opacity=".2+i/20"/>
            <path d="M144 77 176 84 164 108zM144 77l16 14 4 17m-4-17 16-7" stroke="#e0f7ff"/>
            <g stroke="#91caff" opacity=".7"><path d="m28 20 8 5m240 126 7 5M270 28l-7 5M42 155l5-4m23-86 5 1m178 36 6 1"/></g>
        </g>
        <g v-else stroke="#dce8e0" stroke-width=".7">
            <circle cx="160" cy="90" r="63"/><circle cx="160" cy="90" r="57"/>
            <circle cx="160" cy="90" r="25" stroke-dasharray="18 4"/><circle cx="160" cy="90" r="20" stroke-dasharray="22 9"/>
            <ellipse cx="160" cy="90" rx="7" ry="16" transform="rotate(35 160 90)"/><ellipse cx="160" cy="90" rx="7" ry="16" transform="rotate(-35 160 90)"/>
            <path d="m158 76 13 24-24-4zM157 87h6v6h-6z"/>
            <rect v-for="i in 12" :key="i" x="158" y="61" width="4" height="4" :transform="`rotate(${i*30} 160 90)`"/>
        </g>
    </svg>
</template>
<script setup lang="ts">
defineProps<{cinematic?:boolean}>();
function polygon(i:number){const radius=5*Math.pow(1.28,i);return Array.from({length:5},(_,j)=>{const angle=j%4*Math.PI/2+i*.07;return(j?'L':'M')+(160+Math.cos(angle)*radius*1.5)+','+(90+Math.sin(angle)*radius);}).join(' ')+'Z';}
</script>
