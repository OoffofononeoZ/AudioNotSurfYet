<template>
    <select class="app-select app-scrollbar" :value="modelValue" :aria-label="label"
        :disabled="disabled" @change="changed">
        <option v-for="option in options" :key="option.value" :value="option.value"
            :disabled="option.disabled">{{ option.label }}</option>
    </select>
</template>

<script setup lang="ts">
const props = defineProps<{
    modelValue: string | number;
    label: string;
    options: ReadonlyArray<{ value: string | number; label: string; disabled?: boolean }>;
    disabled?: boolean;
}>();
const emit = defineEmits<{
    'update:modelValue': [value: string | number];
    change: [value: string | number];
}>();
function changed(event: Event) {
    const raw = (event.target as HTMLSelectElement).value;
    const option = props.options.find(item => String(item.value) === raw && !item.disabled);
    if (!option) return;
    emit('update:modelValue', option.value);
    emit('change', option.value);
}
</script>

<style scoped>
.app-select {
    appearance: base-select;
    width: var(--app-control-width, 135px);
    min-width: 0;
    min-height: 30px;
    padding: 5px 9px;
    gap: 8px;
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    background: var(--surface-1);
    color: var(--ink);
    font: inherit;
    line-height: 18px;
    cursor: pointer;
    transition: border-color 120ms, background 120ms;
}
.app-select:hover:not(:disabled) { border-color: var(--hairline); background: var(--surface-ghost); }
.app-select:focus-visible { outline: 2px solid var(--hairline-focus); outline-offset: 2px; }
.app-select:disabled { opacity: .4; cursor: default; }
.app-select::picker-icon {
    content: '';
    width: 6px;
    height: 6px;
    flex: none;
    margin: 3px 2px 4px auto;
    border-right: 1.5px solid currentColor;
    border-bottom: 1.5px solid currentColor;
    transform: rotate(45deg);
    color: var(--mute);
}
.app-select:open::picker-icon { transform: translateY(3px) rotate(225deg); color: var(--accent-soft); }
.app-select::picker(select) {
    appearance: base-select;
    margin-block: 5px;
    padding: 4px;
    max-height: min(320px, 50dvh);
    overflow-y: auto;
    border: 1px solid var(--hairline-soft);
    border-radius: var(--radius-sm);
    background: var(--surface-menu);
    color: var(--ink);
    box-shadow: 0 10px 32px rgba(0, 0, 0, .4);
    scrollbar-width: inherit;
    scrollbar-color: inherit;
    scrollbar-gutter: auto;
}
.app-select option {
    gap: 8px;
    min-height: 32px;
    padding: 6px 8px;
    border-radius: 3px;
    font: inherit;
    line-height: 20px;
    cursor: pointer;
}
.app-select option:hover, .app-select option:focus-visible { background: var(--control-hover); outline: none; }
.app-select option:checked { color: var(--accent-soft); background: var(--marker-fill-soft); }
.app-select option::checkmark { color: var(--accent-soft); font-size: 12px; }
.app-select option:disabled { color: var(--mute); opacity: .45; cursor: default; }
</style>
