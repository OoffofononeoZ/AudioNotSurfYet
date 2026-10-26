<template>
    <div class="viz-vector-field">
        <span>{{ label }}</span>
        <div class="grid grid-cols-3 gap-1">
            <label v-for="(value, index) in modelValue" :key="index" class="viz-vector-axis"
                ><span>{{ axes[index] }}</span
                ><AppNumberInput
                    :model-value="value"
                    :label="label + ' ' + axes[index]"
                    :editing-precision="precision ?? 3"
                    wheel-enabled
                    :disabled="disabled"
                    :is-step-valid="value => !nonZero || value !== 0"
                    @change="change(index, $event)"
            /></label>
        </div>
    </div>
</template>
<script setup lang="ts">
import AppNumberInput from '../controls/AppNumberInput.vue';
import type { Vector3Data } from '../../visualizer/scene3dTypes';
const props = defineProps<{
    modelValue: Vector3Data;
    label: string;
    disabled: boolean;
    precision?: number;
    nonZero?: boolean;
}>();
const emit = defineEmits<{ change: [value: Vector3Data] }>();
const axes = ['X', 'Y', 'Z'];
function change(index: number, value: number) {
    const next = [...props.modelValue] as Vector3Data;
    next[index] = value;
    emit('change', next);
}
</script>
<style scoped>
.viz-vector-field {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
    font-size: 12px;
    min-width: 0;
    --app-control-width: 100%;
}
.viz-vector-axis {
    display: grid;
    gap: 3px;
    min-width: 0;
}
.viz-vector-axis > span {
    font-size: 10px;
    color: var(--ink-muted);
}
</style>
