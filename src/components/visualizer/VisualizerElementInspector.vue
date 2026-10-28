<template>
    <div class="viz-panel-heading">
        <h2>属性</h2>
        <span v-if="descriptor" class="viz-muted">{{ kindLabel }}</span>
    </div>
    <fieldset
        v-if="element && descriptor"
        class="viz-inspector-fields app-scrollbar"
        :disabled="locked"
        :data-element-id="element.id">
        <section>
            <label class="viz-field"
                ><span>名称</span
                ><input
                    type="text"
                    :value="element.name"
                    aria-label="元素名称"
                    @change="$emit('update', { name: inputValue($event) })"
            /></label>
            <div v-if="descriptor.usesSeed" class="viz-field">
                <span>Seed</span>
                <div class="flex items-center gap-1">
                    <AppNumberInput
                        :key="element.id + ':seed'"
                        :model-value="element.seed ?? 0"
                        :empty="element.seed === null"
                        allow-empty
                        placeholder="自动随机"
                        :min="0"
                        :max="4294967295"
                        :editing-precision="0"
                        wheel-enabled
                        label="元素 Seed"
                        :disabled="locked"
                        @change="$emit('update', { seed: $event })"
                        @clear="$emit('update', { seed: null })" />
                    <button
                        type="button"
                        class="viz-icon-button small"
                        aria-label="清空元素 Seed"
                        title="清空 Seed"
                        :disabled="locked || element.seed === null"
                        @click="$emit('update', { seed: null })">
                        <VisualizerIcon name="close" />
                    </button>
                </div>
            </div>
        </section>
        <VisualizerTransform3d
            v-if="descriptor.scene3dDefaults && element.transform3d"
            :transform="element.transform3d"
            :scene-id="currentScene!.id"
            :scenes="availableScenes"
            :disabled="locked"
            @change="$emit('update', { transform3d: $event })"
            @move="$emit('move-scene', $event)" />
        <section v-if="element.targets">
            <h3>影响对象</h3>
            <label class="viz-field"
                ><span>目标</span
                ><AppSelect
                    :model-value="element.targets.kind"
                    label="影响对象范围"
                    :disabled="locked"
                    :options="targetOptions"
                    @change="targetKindChanged"
            /></label>
            <div v-if="element.targets.kind !== 'composition'" class="viz-targets">
                <label v-for="target in effectTargets" :key="target.id" class="viz-field"
                    ><span>{{ target.name }}</span
                    ><input
                        type="checkbox"
                        :checked="element.targets.ids.includes(target.id)"
                        @change="targetChanged(target.id, $event)"
                /></label>
                <p v-if="!effectTargets.length" class="viz-muted">先添加视觉元素</p>
            </div>
        </section>
        <section>
            <h3>{{ descriptor.kind === 'transition' ? '转场输入' : '时间范围' }}</h3>
            <template v-if="descriptor.kind === 'transition'"
                ><VisualizerMarkerInput
                    :key="element.id + ':timing'"
                    :project="project"
                    :binding="timingBinding"
                    label="转场范围标记"
                    event-kind="range"
                    :selection-modes="['single']"
                    :disabled="locked"
                    @change="markerChanged" />
                <div v-if="range" class="viz-time-summary">
                    <span>起始 {{ range.startSeconds.toFixed(3) }} s</span
                    ><span>终止 {{ range.endSeconds.toFixed(3) }} s</span>
                </div>
                <p v-else class="viz-muted">从底栏载入同歌 Editor 数据</p></template
            >
            <template v-else-if="element.timing.kind === 'manual'"
                ><label class="viz-field"
                    ><span>起始（秒）</span
                    ><AppNumberInput
                        :model-value="element.timing.startSeconds"
                        :min="0"
                        :editing-precision="3"
                        wheel-enabled
                        :is-step-valid="value => element?.timing.kind === 'manual' && value < element.timing.endSeconds"
                        :max="project.track.durationSeconds"
                        label="元素起始时间"
                        :disabled="locked"
                        @change="timeChanged('startSeconds', $event)" /></label
                ><label class="viz-field"
                    ><span>终止（秒）</span
                    ><AppNumberInput
                        :model-value="element.timing.endSeconds"
                        :min="0"
                        :editing-precision="3"
                        wheel-enabled
                        :is-step-valid="
                            value => element?.timing.kind === 'manual' && value > element.timing.startSeconds
                        "
                        :max="project.track.durationSeconds"
                        label="元素终止时间"
                        :disabled="locked"
                        @change="timeChanged('endSeconds', $event)" /></label
            ></template>
        </section>
        <section v-for="input in independentMarkerInputs" :key="input.id">
            <h3>{{ input.label }}</h3>
            <VisualizerMarkerInput
                :key="element.id + ':' + input.id"
                :project="project"
                :binding="element.markerBindings![input.id]!"
                :label="input.label"
                :event-kind="input.eventKind"
                :selection-modes="input.selectionModes"
                :category-selection="input.categorySelection"
                :disabled="locked"
                @change="markerBindingChanged(input.id, $event)" />
        </section>
        <VisualizerLyricInput
            v-for="input in descriptor.lyricInputs ?? []"
            :key="'lyric-' + input.id"
            :element-id="element.id"
            :project-revision="project.updatedAt"
            :definition="input"
            :binding="element.lyricBindings![input.id]!"
            :assets="project.lyricAssets ?? []"
            :disabled="locked"
            @change="$emit('lyrics', $event)" />
        <VisualizerMediaInput
            v-for="input in descriptor.mediaInputs ?? []"
            :key="element.id + ':' + input.id"
            :element-id="element.id"
            :definition="input"
            :binding="element.mediaBindings![input.id]!"
            :assets="project.mediaAssets ?? []"
            :disabled="locked"
            @change="$emit('media', $event)" />
        <section>
            <h3>{{ descriptor.inputParameter ? '输入与视觉参数' : '视觉参数' }}</h3>
            <VisualizerParameterField
                v-for="parameter in descriptor.parameters"
                :key="element.id + ':' + parameter.id"
                :parameter="parameter"
                :binding="element.bindings.find(b => b.parameterId === parameter.id)!"
                :project="project"
                :element-id="element.id"
                :disabled="locked"
                @change="$emit('binding', $event)" />
        </section>
    </fieldset>
    <div v-else class="viz-inspector-empty"><VisualizerIcon name="sliders" /><span>选择一个元素</span></div>
</template>
<script setup lang="ts">
import VisualizerTransform3d from './VisualizerTransform3d.vue';
import { elementScene, sceneGroups } from '../../visualizer/scene3dModel';
import { movableScenes } from '../../visualizer/scene3dActions';
import VisualizerMediaInput from './VisualizerMediaInput.vue';
import VisualizerLyricInput from './VisualizerLyricInput.vue';
import type { LyricAsset, LyricBinding } from '../../visualizer/lyricTypes';
import type { MediaAsset, MediaBinding } from '../../visualizer/mediaTypes';
import { computed } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import VisualizerIcon from './VisualizerIcon.vue';
import VisualizerMarkerInput from './VisualizerMarkerInput.vue';
import type { MarkerBinding } from '../../visualizer/editorMarkerTypes';
import VisualizerParameterField from './VisualizerParameterField.vue';
import { elementDescriptor, elementRange, elementAlgorithm } from '../../visualizer/compositionModel';
import type { ElementBinding, VisualizerElement, VisualizerProjectV6 } from '../../visualizer/compositionTypes';
const props = defineProps<{ project: VisualizerProjectV6; element: VisualizerElement | null; locked: boolean }>();
const emit = defineEmits<{
    'move-scene': [sceneId: string | null];
    update: [patch: Partial<VisualizerElement>];
    binding: [binding: ElementBinding];
    lyrics: [payload: { elementId: string; inputId: string; binding: LyricBinding; assets: LyricAsset[] }];
    media: [payload: { elementId: string; inputId: string; binding: MediaBinding; assets: MediaAsset[] }];
}>();
const descriptor = computed(() => (props.element ? elementDescriptor(props.project, props.element) : null));
const kindLabel = computed(
    () => ({ visual: '视觉元素', modifier: '影响效果', transition: '转场' })[descriptor.value?.kind ?? 'visual'],
);
const range = computed(() => (props.element ? elementRange(props.project, props.element) : null));
const visualElements = computed(() =>
    props.project.elements.filter(
        e =>
            elementDescriptor(props.project, e).kind === 'visual' &&
            !elementDescriptor(props.project, e).scene3dDefaults,
    ),
);
const currentScene = computed(() => (props.element ? elementScene(props.project, props.element.id) : undefined));
const availableScenes = computed(() => (props.element ? movableScenes(props.project, props.element.id) : []));
const effectTargets = computed(() =>
    props.element?.targets?.kind === 'scenes3d' ? sceneGroups(props.project) : visualElements.value,
);
const timingBinding = computed<MarkerBinding>(() =>
    props.element?.timing.kind === 'editor-range'
        ? { kind: 'single', laneId: props.element.timing.laneId, eventId: props.element.timing.eventId }
        : { kind: 'unbound' },
);
const independentMarkerInputs = computed(
    () =>
        descriptor.value?.markerInputs?.filter(
            input =>
                input.id !==
                (props.element ? elementAlgorithm(props.project, props.element).contract.timingInput : undefined),
        ) ?? [],
);
const targetOptions = [
    { value: 'composition', label: '整个画面' },
    { value: 'elements', label: '指定元素' },
    { value: 'scenes3d', label: '指定三维场景' },
];
const inputValue = (event: Event) => (event.target as HTMLInputElement).value;
function timeChanged(key: 'startSeconds' | 'endSeconds', value: number) {
    if (props.element?.timing.kind === 'manual') emit('update', { timing: { ...props.element.timing, [key]: value } });
}
function markerChanged(binding: MarkerBinding) {
    emit('update', {
        timing:
            binding.kind === 'single'
                ? { kind: 'editor-range', laneId: binding.laneId, eventId: binding.eventId }
                : { kind: 'unbound' },
    });
}
function markerBindingChanged(id: string, binding: MarkerBinding) {
    emit('update', { markerBindings: { ...props.element!.markerBindings, [id]: binding } });
}
function targetKindChanged(value: string | number) {
    emit('update', {
        targets:
            value === 'composition'
                ? { kind: 'composition' }
                : { kind: value === 'scenes3d' ? 'scenes3d' : 'elements', ids: [] },
    });
}
function targetChanged(id: string, event: Event) {
    if (!props.element?.targets || props.element.targets.kind === 'composition') return;
    const checked = (event.target as HTMLInputElement).checked;
    emit('update', {
        targets: {
            kind: props.element.targets.kind,
            ids: checked ? [...props.element.targets.ids, id] : props.element.targets.ids.filter(item => item !== id),
        },
    });
}
</script>
