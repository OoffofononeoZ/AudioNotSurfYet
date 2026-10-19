<template>
    <section class="viz-common-control" :data-common-control-id="control.id">
        <VisualizerParameterField
            v-if="control.kind !== 'transform'"
            :parameter="parameter"
            :binding="binding"
            :project="project"
            :element-id="first.id"
            :affected-element-ids="control.targets"
            :disabled="locked"
            @change="changed" />
        <label v-else class="viz-field"
            ><span>{{ control.label }}</span>
            <input
                v-if="typeof control.value === 'boolean'"
                type="checkbox"
                :checked="control.value"
                :aria-label="control.label"
                :disabled="locked"
                @change="$emit('change', ($event.target as HTMLInputElement).checked)" />
            <AppNumberInput
                v-else
                :model-value="Number(control.value)"
                :label="control.label"
                :editing-precision="precision"
                :min="control.field?.endsWith('Seconds') ? 0 : undefined"
                wheel-enabled
                :disabled="locked"
                @change="$emit('change', $event)" />
        </label>
        <div v-if="differences.length" class="viz-common-differences" role="status">
            <span>已有 {{ differences.length }} 个元素修改此值</span
            ><small>{{ differences.map(e => e.name).join('、') }}</small
            ><button type="button" :disabled="locked" @click="$emit('change', control.value)">重新应用</button>
        </div>
    </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import VisualizerParameterField from './VisualizerParameterField.vue';
import { changedControlElements } from '../../visualizer/commonControls';
import { elementDescriptor } from '../../visualizer/compositionModel';
import type { CommonControl, CommonValue } from '../../visualizer/resourceTypes';
import type { ElementBinding, VisualizerProjectV5 } from '../../visualizer/compositionTypes';
const props = defineProps<{ control: CommonControl; project: VisualizerProjectV5; locked: boolean }>();
const emit = defineEmits<{ change: [value: CommonValue] }>();
const first = computed(() => props.project.elements.find(e => e.id === props.control.targets[0])!);
const parameter = computed(() => ({
    ...elementDescriptor(props.project, first.value).parameters.find(p => p.id === props.control.parameterId)!,
    label: props.control.label,
}));
const binding = computed<ElementBinding>(() =>
    props.control.kind === 'binding'
        ? { parameterId: props.control.parameterId, ...(props.control.value as Omit<ElementBinding, 'parameterId'>) }
        : {
              parameterId: props.control.parameterId,
              source: { kind: 'constant', value: props.control.value as number },
          },
);
const precision = computed(() =>
    props.control.field?.endsWith('Seconds')
        ? 3
        : props.control.field?.startsWith('output')
          ? (parameter.value.range?.editingPrecision ?? 2)
          : 2,
);
const differences = computed(() => changedControlElements(props.project, props.control));
function changed(binding: ElementBinding) {
    if (props.control.kind === 'value') {
        if (binding.source.kind === 'constant') emit('change', binding.source.value);
    } else {
        const { parameterId: _id, ...value } = binding;
        emit('change', value);
    }
}
</script>
<style scoped>
.viz-common-differences {
    display: grid;
    gap: 6px;
    font-size: 12px;
    color: #d7b779;
}
.viz-common-differences small {
    color: #a6b2ab;
    overflow-wrap: anywhere;
}
.viz-common-differences button {
    justify-self: start;
    padding: 5px 9px;
    border: 1px solid #47564d;
    border-radius: 5px;
    color: #dae6df;
}
</style>
