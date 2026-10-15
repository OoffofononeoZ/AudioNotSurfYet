<template>
    <svg viewBox="0 0 320 180" fill="none" aria-hidden="true" class="viz-preset-preview">
        <rect width="320" height="180" fill="#000"/>
        <g stroke="#dce8e0" stroke-width=".7">
            <circle cx="160" cy="90" r="63"/><circle cx="160" cy="90" r="57"/>
            <circle cx="160" cy="90" r="25" stroke-dasharray="18 4"/><circle cx="160" cy="90" r="20" stroke-dasharray="22 9"/>
            <ellipse cx="160" cy="90" rx="7" ry="16" transform="rotate(35 160 90)"/><ellipse cx="160" cy="90" rx="7" ry="16" transform="rotate(-35 160 90)"/>
            <path d="m158 76 13 24-24-4zM157 87h6v6h-6z"/>
            <rect v-for="i in 12" :key="i" x="158" y="61" width="4" height="4" :transform="`rotate(${i*30} 160 90)`"/>
        </g>
    </svg>
</template>
