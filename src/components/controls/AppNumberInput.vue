<template>
    <div class="app-number-input" :class="{ 'is-disabled': disabled }">
        <input
            ref="input"
            v-bind="$attrs"
            type="number"
            :value="empty ? '' : modelValue"
            :aria-label="label"
            :min="Number.isFinite(min) ? min : undefined"
            :max="Number.isFinite(max) ? max : undefined"
            :step="effectiveStep"
            :disabled="disabled"
            @change.stop="commit"
            @keydown.up.prevent="increment(1)"
            @keydown.down.prevent="increment(-1)"
            @keydown.enter.prevent="commit"
            v-on="wheelEnabled ? { wheel } : {}" />
        <div class="app-number-input__steps">
            <button
                type="button"
                tabindex="-1"
                :aria-label="label + '增加'"
                :disabled="disabled || !canIncrement(1)"
                @mousedown.prevent
                @click="increment(1)">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 9.5 3.5-3.5 3.5 3.5" /></svg>
            </button>
            <button
                type="button"
                tabindex="-1"
                :aria-label="label + '减少'"
                :disabled="disabled || !canIncrement(-1)"
                @mousedown.prevent
                @click="increment(-1)">
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
            </button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { numberEditingStep, stepEditedNumber } from '../../utils/numberEditing';
defineOptions({ inheritAttrs: false });
const props = withDefaults(
    defineProps<{
        modelValue: number;
        label: string;
        min?: number;
        max?: number;
        step?: number;
        snapToStep?: boolean;
        disabled?: boolean;
        editingPrecision?: number;
        wheelEnabled?: boolean;
        isStepValid?: (value: number) => boolean;
        empty?: boolean;
        allowEmpty?: boolean;
    }>(),
    { min: -Infinity, max: Infinity, step: 1 },
);
const emit = defineEmits<{ 'update:modelValue': [value: number]; change: [value: number]; clear: [] }>();
const input = ref<HTMLInputElement | null>(null);
const effectiveStep = computed(() =>
    props.editingPrecision === undefined ? props.step : numberEditingStep(props.editingPrecision),
);
function nextValue(value: number, direction: 1 | -1) {
    return stepEditedNumber(value, props.modelValue, direction, {
        precision: props.editingPrecision!,
        min: props.min,
        max: props.max,
        isValid: props.isStepValid,
    });
}
function canIncrement(direction: 1 | -1) {
    if (props.editingPrecision !== undefined) return nextValue(props.modelValue, direction) !== props.modelValue;
    return direction === 1 ? props.modelValue < props.max : props.modelValue > props.min;
}
function commit() {
    const field = input.value;
    if (!field || field.matches(':disabled')) return;
    if (props.allowEmpty && field.value === '' && !field.validity.badInput) {
        if (!props.empty) emit('clear');
        return;
    }
    const value = field.valueAsNumber;
    if (!Number.isFinite(value)) {
        field.value = String(props.modelValue);
        return;
    }
    const snapped = props.snapToStep ? Math.round(value / props.step) * props.step : value;
    const bounded = Math.max(props.min, Math.min(props.max, snapped));
    field.value = String(bounded);
    if (!props.empty && bounded === props.modelValue) return;
    emit('update:modelValue', bounded);
    emit('change', bounded);
}
function increment(direction: 1 | -1) {
    const field = input.value;
    if (!field || field.matches(':disabled')) return;
    if (!Number.isFinite(field.valueAsNumber)) field.value = String(props.modelValue);
    if (props.editingPrecision === undefined) field.stepUp(direction);
    else field.value = String(nextValue(field.valueAsNumber, direction));
    commit();
}
function wheel(event: WheelEvent) {
    if (
        !props.wheelEnabled ||
        event.ctrlKey ||
        event.metaKey ||
        event.deltaY === 0 ||
        input.value?.matches(':disabled')
    )
        return;
    event.preventDefault();
    event.stopPropagation();
    increment(event.deltaY < 0 ? 1 : -1);
}
</script>

<style scoped>
.app-number-input {
    display: flex;
    flex: none;
    width: var(--app-control-width, 135px);
    min-width: 0;
    min-height: 30px;
    overflow: hidden;
    border: 1px solid var(--divider);
    border-radius: var(--radius-xs);
    background: var(--surface-1);
    color: var(--ink);
    transition: border-color 120ms;
}
.app-number-input:hover:not(.is-disabled) {
    border-color: var(--hairline);
}
.app-number-input:focus-within {
    border-color: var(--hairline-focus);
    outline: 2px solid var(--hairline-faint);
    outline-offset: 1px;
}
.app-number-input input {
    appearance: textfield;
    flex: 1;
    width: 0;
    min-width: 0;
    padding: 5px 8px;
    border: 0;
    outline: none;
    background: transparent;
    color: inherit;
    font: inherit;
    line-height: 18px;
    font-variant-numeric: tabular-nums;
}
.app-number-input input::-webkit-inner-spin-button,
.app-number-input input::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
}
.app-number-input__steps {
    display: grid;
    grid-template-rows: 1fr 1fr;
    flex: none;
    width: 23px;
    border-left: 1px solid var(--divider);
}
.app-number-input__steps button {
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--mute);
    cursor: pointer;
}
.app-number-input__steps button + button {
    border-top: 1px solid var(--divider);
}
.app-number-input__steps button:hover:not(:disabled) {
    color: var(--accent-soft);
    background: var(--control-hover);
}
.app-number-input__steps button:disabled {
    opacity: 0.3;
    cursor: default;
}
.app-number-input__steps svg {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
}
.app-number-input.is-disabled {
    opacity: 0.4;
}
</style>
