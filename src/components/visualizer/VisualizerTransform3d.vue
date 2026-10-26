<template>
    <section>
        <h3>三维变换</h3>
        <label class="viz-field"
            ><span>所属场景</span
            ><AppSelect
                :model-value="sceneId"
                :options="options"
                label="所属三维场景"
                :disabled="disabled"
                @change="$emit('move', String($event) || null)"
        /></label>
        <VisualizerVector3Field
            :model-value="transform.position"
            label="三维位置"
            :disabled="disabled"
            @change="update('position', $event)" />
        <VisualizerVector3Field
            :model-value="transform.rotationDegrees"
            label="三维旋转（度）"
            :precision="2"
            :disabled="disabled"
            @change="update('rotationDegrees', $event)" />
        <VisualizerVector3Field
            :model-value="transform.scale"
            label="三维缩放"
            :disabled="disabled"
            non-zero
            @change="update('scale', $event)" />
    </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import VisualizerVector3Field from './VisualizerVector3Field.vue';
import type { Transform3d, Vector3Data, Scene3dItem } from '../../visualizer/scene3dTypes';
const props = defineProps<{ transform: Transform3d; sceneId: string; scenes: Scene3dItem[]; disabled: boolean }>();
const emit = defineEmits<{ change: [value: Transform3d]; move: [sceneId: string | null] }>();
const options = computed(() => [
    ...props.scenes.map(s => ({ value: s.id, label: s.name })),
    { value: '', label: '新建独立场景' },
]);
function update(key: keyof Transform3d, value: Vector3Data) {
    emit('change', { ...structuredClone(props.transform), [key]: value });
}
</script>
