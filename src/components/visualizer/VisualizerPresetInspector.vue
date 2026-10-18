<template>
    <div class="viz-panel-heading">
        <h2>属性</h2>
        <span class="viz-muted">预设</span>
    </div>
    <fieldset class="viz-inspector-fields app-scrollbar" :disabled="locked" :data-preset-instance-id="preset.id">
        <section>
            <label class="viz-field"
                ><span>名称</span
                ><input
                    type="text"
                    :value="preset.name"
                    aria-label="预设名称"
                    @change="$emit('rename', ($event.target as HTMLInputElement).value)"
            /></label>
        </section>
        <VisualizerCommonControlField
            v-for="control in preset.controls"
            :key="preset.id + ':' + control.id"
            :control="control"
            :project="project"
            :locked="locked"
            @change="$emit('control', control.id, $event)" />
        <p v-if="!preset.controls.length" class="viz-muted">此预设没有共同处理参数</p>
    </fieldset>
</template>
<script setup lang="ts">
import VisualizerCommonControlField from './VisualizerCommonControlField.vue';
import type { CommonValue, PresetInstance } from '../../visualizer/resourceTypes';
import type { VisualizerProjectV4 } from '../../visualizer/compositionTypes';
defineProps<{ project: VisualizerProjectV4; preset: PresetInstance; locked: boolean }>();
defineEmits<{ rename: [name: string]; control: [id: string, value: CommonValue] }>();
</script>
