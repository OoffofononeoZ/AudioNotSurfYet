<template>
    <section class="app-workspace-hint" :role="state === 'loading' ? 'status' : undefined">
        <div class="app-workspace-hint-icon" aria-hidden="true">
            <span v-if="state === 'loading'" class="app-workspace-hint-spinner" />
            <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M9 18V5l11-2v13M9 8l11-2M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3m11-2a3 3 0 1 1-3-3c2 0 3 1 3 3" />
            </svg>
        </div>
        <component :is="heading" class="app-workspace-hint-title">{{ title }}</component>
        <p v-if="description" class="app-workspace-hint-description">{{ description }}</p>
    </section>
</template>

<script setup lang="ts">
withDefaults(
    defineProps<{
        state: 'empty' | 'loading';
        title: string;
        description?: string;
        heading?: 'h1' | 'h2';
    }>(),
    { heading: 'h2' },
);
</script>
