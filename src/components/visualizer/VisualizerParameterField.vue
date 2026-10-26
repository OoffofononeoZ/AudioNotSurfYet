<template>
    <div class="viz-parameter" :data-parameter-id="parameter.id">
        <label v-if="dynamic" class="viz-field"
            ><span>{{ parameter.label }}</span
            ><AppSelect
                :model-value="analysis?.stemRole ?? binding.source.kind"
                :label="parameter.label + '数据来源'"
                :options="sourceOptions"
                :disabled="disabled"
                @change="sourceChanged"
        /></label>
        <label v-if="binding.source.kind === 'constant'" class="viz-field"
            ><span>{{ dynamic ? '固定值' : parameter.label }}</span>
            <AppNumberInput
                v-if="parameter.valueKind === 'number'"
                :model-value="Number(binding.source.value)"
                :min="parameter.range?.min"
                :max="parameter.range?.max"
                :editing-precision="parameterPrecision"
                wheel-enabled
                :label="parameter.label"
                :disabled="disabled"
                @change="constantNumber" />
            <input
                v-else-if="parameter.valueKind === 'color'"
                type="color"
                :value="binding.source.value"
                :aria-label="parameter.label"
                @input="constantChanged" />
            <input
                v-else-if="parameter.valueKind === 'boolean'"
                type="checkbox"
                :checked="binding.source.value === true"
                :aria-label="parameter.label"
                @change="constantChanged" />
            <span v-else class="viz-muted">静态</span>
        </label>
        <label v-if="native" class="viz-field"
            ><span>特征</span
            ><AppSelect
                :model-value="native.featureId"
                :label="parameter.label + '原生特征'"
                :options="nativeInputFeatures"
                :disabled="disabled"
                @change="nativeFeatureChanged"
        /></label>
        <template v-if="analysis">
            <label class="viz-field"
                ><span>特征</span
                ><AppSelect
                    :model-value="analysis.featureId"
                    :label="parameter.label + '分析特征'"
                    :options="featureOptions"
                    :disabled="disabled"
                    @change="featureChanged"
            /></label>
            <label v-if="components.length > 1" class="viz-field"
                ><span>分量</span
                ><AppSelect
                    :model-value="analysis.component ?? 'default'"
                    :label="parameter.label + '分量'"
                    :options="componentOptions"
                    :disabled="disabled"
                    @change="componentChanged"
            /></label>
            <label v-if="projections.length > 1" class="viz-field"
                ><span>投影</span
                ><AppSelect
                    :model-value="analysis.projection.kind"
                    :label="parameter.label + '投影'"
                    :options="projectionOptions"
                    :disabled="disabled"
                    @change="projectionChanged"
            /></label>
            <label v-if="analysis.projection.kind === 'bin'" class="viz-field"
                ><span>Bin</span
                ><AppNumberInput
                    :model-value="analysis.projection.index"
                    :min="0"
                    :max="vectorLength - 1"
                    :editing-precision="0"
                    wheel-enabled
                    :label="parameter.label + ' Bin'"
                    :disabled="disabled"
                    @change="projectionNumber('index', $event)"
            /></label>
            <template v-if="analysis.projection.kind === 'band'"
                ><label v-for="key in ['start', 'end'] as const" :key="key" class="viz-field"
                    ><span>{{ key === 'start' ? '频段起点' : '频段终点' }}</span
                    ><AppNumberInput
                        :model-value="analysis.projection[key]"
                        :min="key === 'start' ? 0 : analysis.projection.start + 1"
                        :max="key === 'start' ? analysis.projection.end - 1 : vectorLength"
                        :editing-precision="0"
                        wheel-enabled
                        :label="parameter.label + (key === 'start' ? '频段起点' : '频段终点')"
                        :disabled="disabled"
                        @change="projectionNumber(key, $event)" /></label
            ></template>
            <details v-if="parameter.valueKind === 'number'" class="viz-mapping">
                <summary>数值映射</summary>
                <label v-for="field in transformFields" :key="field.key" class="viz-field"
                    ><span>{{ field.label }}</span
                    ><AppNumberInput
                        :model-value="transform[field.key]"
                        :editing-precision="transformPrecision(field.key)"
                        :min="transformBounds(field.key).min"
                        :max="transformBounds(field.key).max"
                        :is-step-valid="value => validTransformStep(field.key, value)"
                        wheel-enabled
                        :label="parameter.label + field.label"
                        :disabled="disabled"
                        @change="transformChanged(field.key, $event)" /></label
                ><label class="viz-field"
                    ><span>限制范围</span
                    ><input
                        type="checkbox"
                        :checked="transform.clamp"
                        @change="transformFlag('clamp', $event)" /></label
                ><label class="viz-field"
                    ><span>反转</span
                    ><input type="checkbox" :checked="transform.invert" @change="transformFlag('invert', $event)"
                /></label>
            </details>
        </template>
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import AppSelect from '../controls/AppSelect.vue';
import AppNumberInput from '../controls/AppNumberInput.vue';
import { FEATURE_REGISTRY } from '../../analysis/featureRegistry';
import type { FeatureId } from '../../analysis/types';
import type { SceneParameterDescriptor } from '../../visualizer/parameterDescriptor';
import type { ElementBinding, VisualizerProjectV6 } from '../../visualizer/compositionTypes';
import type {
    VisualizerAnalysisComponent,
    VisualizerAnalysisProjectionV1,
    VisualizerNumericTransformV1,
} from '../../visualizer/types';
import {
    analysisComponentsForFeature,
    analysisVectorLength,
    compatibleAnalysisFeatures,
    compatibleAnalysisProjections,
    createDefaultAnalysisBinding,
    createProjection,
    defaultNumericTransform,
} from '../../visualizer/bindingDefaults';
import { nativeInputFeatures, type NativeInputFeature } from '../../visualizer/nativeAudioAnalysis';
import { isStemRole, isStemFeature } from '../../analysis/sources';
import { useStemAvailability } from '../../analysis/useStemAvailability';
import { FT_ROLES, type StemRole } from '../../processing/modelManifest';
const props = defineProps<{
    parameter: SceneParameterDescriptor;
    binding: ElementBinding;
    project: VisualizerProjectV6;
    elementId: string;
    disabled?: boolean;
    affectedElementIds?: string[];
}>();
const emit = defineEmits<{ change: [binding: ElementBinding] }>();
const dynamic = computed(() => props.parameter.allowedSourceKinds.includes('analysis'));
const analysis = computed(() => (props.binding.source.kind === 'analysis' ? props.binding.source : null));
const native = computed(() => (props.binding.source.kind === 'native' ? props.binding.source : null));
const { available: stemsAvailable } = useStemAvailability();
const features = computed(() =>
    compatibleAnalysisFeatures(props.parameter).filter(id => !analysis.value?.stemRole || isStemFeature(id)),
);
const components = computed(() =>
    analysis.value
        ? analysisComponentsForFeature(analysis.value.featureId).filter(c =>
              props.parameter.allowedAnalysisComponents?.includes(c),
          )
        : [],
);
const projections = computed(() =>
    analysis.value
        ? compatibleAnalysisProjections(
              props.parameter,
              analysis.value.featureId,
              analysis.value.component ?? 'default',
          )
        : [],
);
const vectorLength = computed(() =>
    analysis.value ? analysisVectorLength(analysis.value.featureId, analysis.value.component ?? 'default') : 0,
);
const transform = computed(
    () => props.binding.transform ?? defaultNumericTransform(props.parameter, analysis.value?.featureId),
);
const parameterPrecision = computed(
    () => props.parameter.range?.editingPrecision ?? (props.parameter.range?.integer ? 0 : 2),
);
function transformPrecision(key: string) {
    return key.startsWith('output') ? parameterPrecision.value : key.endsWith('Seconds') ? 3 : 2;
}
function transformBounds(key: string) {
    return key.startsWith('output')
        ? { min: props.parameter.range?.min, max: props.parameter.range?.max }
        : key.endsWith('Seconds')
          ? { min: 0, max: undefined }
          : { min: undefined, max: undefined };
}
function validTransformStep(key: string, value: number) {
    return key === 'inputMin'
        ? value < transform.value.inputMax
        : key === 'inputMax'
          ? value > transform.value.inputMin
          : true;
}
const transformFields = [
    { key: 'inputMin', label: '输入下限' },
    { key: 'inputMax', label: '输入上限' },
    { key: 'outputMin', label: '输出下限' },
    { key: 'outputMax', label: '输出上限' },
    { key: 'attackSeconds', label: '起音（秒）' },
    { key: 'releaseSeconds', label: '释放（秒）' },
] as const;
const projectionLabels: Record<string, string> = {
    scalar: '标量',
    full: '完整向量',
    mean: '平均值',
    max: '最大值',
    peak: '峰值位置',
    bin: '单个 Bin',
    band: '频段平均',
};
const sourceOptions = computed(() => [
    { value: 'constant', label: '固定值' },
    { value: 'analysis', label: 'analyzer（原曲）' },
    ...(props.parameter.allowedSourceKinds.includes('native') ? [{ value: 'native', label: '原生输入' }] : []),
    ...(stemsAvailable.value && props.parameter.valueKind === 'vector'
        ? FT_ROLES.map(role => ({ value: role, label: `analyzer（${role}）` }))
        : analysis.value?.stemRole
          ? [
                {
                    value: analysis.value.stemRole,
                    label: `analyzer（${analysis.value.stemRole}，需完成音频分离）`,
                    disabled: true,
                },
            ]
          : []),
    ...(props.binding.source.kind === 'unbound' ? [{ value: 'unbound', label: '未配置' }] : []),
]);
const featureOptions = computed(() =>
    features.value.map(id => ({ value: id, label: FEATURE_REGISTRY[id].label, disabled: featureDisabled(id) })),
);
const componentOptions = computed(() => components.value.map(value => ({ value, label: value })));
const projectionOptions = computed(() =>
    projections.value.map(value => ({ value, label: projectionLabels[value] ?? value })),
);
function featureDisabled(id: FeatureId) {
    const ids = new Set<FeatureId>();
    for (const e of props.project.elements)
        for (const b of e.bindings)
            if (
                !(
                    (props.affectedElementIds ?? [props.elementId]).includes(e.id) &&
                    b.parameterId === props.parameter.id
                ) &&
                b.source.kind === 'analysis' &&
                b.source.stemRole === analysis.value?.stemRole
            )
                ids.add(b.source.featureId);
    ids.add(id);
    return ids.size > 4;
}
function defaultBinding(id: FeatureId, role: StemRole | null | undefined = analysis.value?.stemRole) {
    const binding = createDefaultAnalysisBinding(props.parameter, id);
    return { ...binding, source: { ...binding.source, ...(role ? { stemRole: role } : {}) } } as ElementBinding;
}
function sourceChanged(value: string | number) {
    if (isStemRole(value)) {
        const compatible = compatibleAnalysisFeatures(props.parameter).filter(isStemFeature);
        const current = analysis.value?.featureId;
        const feature =
            current && compatible.includes(current as (typeof compatible)[number])
                ? current
                : compatible.includes('wallpaperEngineSpectrum')
                  ? 'wallpaperEngineSpectrum'
                  : compatible[0];
        if (feature && stemsAvailable.value) emit('change', defaultBinding(feature, value));
        return;
    }
    if (value === 'constant')
        emit('change', {
            parameterId: props.parameter.id,
            source: {
                kind: 'constant',
                value: structuredClone(props.parameter.defaultValue) as number | string | boolean | number[],
            },
        });
    else if (value === 'native') nativeFeatureChanged('frequency');
    else if (value === 'analysis') {
        if (analysis.value && compatibleAnalysisFeatures(props.parameter).includes(analysis.value.featureId)) {
            emit('change', defaultBinding(analysis.value.featureId, null));
            return;
        }
        const feature = features.value.includes('energy') ? 'energy' : features.value[0];
        if (feature)
            emit(
                'change',
                props.parameter.defaultBinding
                    ? ({
                          parameterId: props.parameter.id,
                          ...structuredClone(props.parameter.defaultBinding),
                      } as ElementBinding)
                    : defaultBinding(feature, null),
            );
    }
}
function nativeFeatureChanged(value: string | number) {
    emit('change', {
        parameterId: props.parameter.id,
        source: { kind: 'native', featureId: value as NativeInputFeature },
    });
}
function constantNumber(value: number) {
    emit('change', { parameterId: props.parameter.id, source: { kind: 'constant', value } });
}
function constantChanged(event: Event) {
    const input = event.target as HTMLInputElement;
    emit('change', {
        parameterId: props.parameter.id,
        source: {
            kind: 'constant',
            value:
                props.parameter.valueKind === 'boolean'
                    ? input.checked
                    : props.parameter.valueKind === 'number'
                      ? Number(input.value)
                      : input.value,
        },
    });
}
function featureChanged(value: string | number) {
    emit('change', defaultBinding(value as FeatureId));
}
function componentChanged(value: string | number) {
    if (!analysis.value) return;
    const component = value as VisualizerAnalysisComponent;
    const kinds = compatibleAnalysisProjections(props.parameter, analysis.value.featureId, component);
    if (kinds[0])
        emit('change', {
            ...props.binding,
            source: { ...analysis.value, component, projection: createProjection(kinds[0]) },
        });
}
function projectionChanged(value: string | number) {
    if (analysis.value)
        emit('change', {
            ...props.binding,
            source: {
                ...analysis.value,
                projection: createProjection(value as VisualizerAnalysisProjectionV1['kind']),
            },
        });
}
function projectionNumber(key: string, value: number) {
    if (analysis.value)
        emit('change', {
            ...props.binding,
            source: {
                ...analysis.value,
                projection: { ...analysis.value.projection, [key]: value } as VisualizerAnalysisProjectionV1,
            },
        });
}
function transformChanged(key: string, value: number) {
    emit('change', { ...props.binding, transform: { ...transform.value, [key]: value } });
}
function transformFlag(key: 'clamp' | 'invert', event: Event) {
    emit('change', {
        ...props.binding,
        transform: {
            ...transform.value,
            [key]: (event.target as HTMLInputElement).checked,
        } as VisualizerNumericTransformV1,
    });
}
</script>
