<template>
    <fieldset
        class="binding-inspector"
        :disabled="locked"
        data-testid="visualizer-binding-inspector"
        :data-editor-lane-count="editorProject?.lanes.length ?? 0"
    >
        <section class="inspector-section editor-data" aria-labelledby="editor-data-heading">
            <div class="section-heading">
                <div>
                    <h3 id="editor-data-heading">Editor 数据</h3>
                    <p v-if="editorProject">
                        {{ editorProject.track.fileName }} · {{ editorSourceLabel }} ·
                        {{ project.editorSnapshot?.capturedAt }}
                    </p>
                    <p v-else>未载入同歌 Editor 数据；Editor event 暂不可选。</p>
                </div>
                <span class="source-badge">{{ editorProject ? '已验证' : '未连接' }}</span>
            </div>
            <div class="compact-actions">
                <button type="button" data-testid="reload-editor-draft" @click="reloadEditorDraft">
                    重新载入同歌草稿
                </button>
                <button type="button" data-testid="import-editor-json" @click="importEditorProject">
                    导入 Editor JSON
                </button>
                <button
                    type="button"
                    :disabled="!editorProject || editorReferenceCount > 0"
                    :title="editorReferenceCount > 0 ? `仍有 ${editorReferenceCount} 个参数引用 Editor 数据` : ''"
                    data-testid="remove-editor-snapshot"
                    @click="removeEditorSnapshot"
                >
                    移除
                </button>
            </div>
        </section>

        <section class="analysis-status" aria-live="polite">
            <span>分析：{{ analysisStateLabel }}</span>
            <span>{{ Math.round(runtime.analysisProgress * 100) }}%</span>
            <span data-testid="active-analysis-features">
                {{ runtime.activeFeatureIds.length }}/4：{{ activeFeatureLabels || '无' }}
            </span>
        </section>

        <section class="parameter-list" aria-label="场景参数">
            <article
                v-for="parameter in descriptor.parameters"
                :key="parameter.id"
                class="parameter-card"
                :data-parameter-id="parameter.id"
            >
                <div class="parameter-heading">
                    <div>
                        <h3>{{ parameter.label }}</h3>
                        <code>{{ parameter.id }}</code>
                    </div>
                    <output
                        :data-state="resolved(parameter.id)?.state ?? 'loading'"
                        :data-testid="`resolved-${parameter.id}`"
                    >
                        {{ resolvedLabel(parameter.id) }}
                    </output>
                </div>

                <label class="field-row">
                    <span>数据来源</span>
                    <select
                        :value="binding(parameter.id).source.kind"
                        :aria-label="`${parameter.label}数据来源`"
                        :data-testid="`binding-source-${parameter.id}`"
                        @change="setSourceKind(parameter, $event)"
                    >
                        <option
                            v-for="kind in parameter.allowedSourceKinds"
                            :key="kind"
                            :value="kind"
                            :disabled="(kind === 'editor-event' && !(editorProject?.lanes.length))
                                || (kind === 'analysis' && analysisSourceUnavailable(parameter))"
                        >
                            {{ sourceKindLabel(kind) }}
                        </option>
                    </select>
                </label>

                <template v-if="binding(parameter.id).source.kind === 'constant'">
                    <label v-if="parameter.valueKind === 'boolean'" class="field-row checkbox-row">
                        <span>固定值</span>
                        <input
                            type="checkbox"
                            :checked="constantValue(parameter.id) === true"
                            @change="setConstant(parameter, $event)"
                        >
                    </label>
                    <label v-else-if="parameter.valueKind === 'color'" class="field-row">
                        <span>固定颜色</span>
                        <input
                            type="color"
                            :value="String(constantValue(parameter.id))"
                            @input="setConstant(parameter, $event)"
                        >
                    </label>
                    <label v-else-if="parameter.valueKind === 'number'" class="field-row">
                        <span>固定值</span>
                        <input
                            type="number"
                            :min="parameter.range?.min"
                            :max="parameter.range?.max"
                            :step="parameter.range?.integer ? 1 : 'any'"
                            :value="Number(constantValue(parameter.id))"
                            @change="setConstant(parameter, $event)"
                        >
                    </label>
                    <p v-else class="field-note">空向量由真实场景的默认状态解释。</p>
                </template>

                <template v-else-if="binding(parameter.id).source.kind === 'analysis'">
                    <label class="field-row">
                        <span>分析特征</span>
                        <select
                            :value="analysisSource(parameter.id).featureId"
                            :aria-label="`${parameter.label}分析特征`"
                            :data-testid="`analysis-feature-${parameter.id}`"
                            @change="setAnalysisFeature(parameter, $event)"
                        >
                            <option
                                v-for="featureId in compatibleAnalysisFeatures(parameter)"
                                :key="featureId"
                                :value="featureId"
                                :disabled="featureDisabled(parameter.id, featureId)"
                            >
                                {{ featureLabel(featureId) }}{{ featureDisabled(parameter.id, featureId) ? '（已达四项上限）' : '' }}
                            </option>
                        </select>
                    </label>
                    <label class="field-row">
                        <span>分量</span>
                        <select
                            :value="analysisSource(parameter.id).component ?? 'default'"
                            @change="setAnalysisComponent(parameter, $event)"
                        >
                            <option
                                v-for="component in componentOptions(parameter)"
                                :key="component"
                                :value="component"
                            >{{ component }}</option>
                        </select>
                    </label>
                    <label class="field-row">
                        <span>投影</span>
                        <select
                            :value="analysisSource(parameter.id).projection.kind"
                            @change="setProjection(parameter, $event)"
                        >
                            <option
                                v-for="projection in projectionOptions(parameter)"
                                :key="projection"
                                :value="projection"
                            >{{ projection }}</option>
                        </select>
                    </label>
                    <label
                        v-if="analysisSource(parameter.id).projection.kind === 'bin'"
                        class="field-row"
                    >
                        <span>Bin（0–{{ vectorLength(parameter) - 1 }}）</span>
                        <input
                            type="number"
                            min="0"
                            :max="vectorLength(parameter) - 1"
                            :value="binProjection(parameter.id).index"
                            @change="setBin(parameter, $event)"
                        >
                    </label>
                    <div
                        v-if="analysisSource(parameter.id).projection.kind === 'band'"
                        class="band-fields"
                    >
                        <label>
                            <span>Band 起点</span>
                            <input
                                type="number"
                                min="0"
                                :max="vectorLength(parameter) - 1"
                                :value="bandProjection(parameter.id).start"
                                @change="setBand(parameter, 'start', $event)"
                            >
                        </label>
                        <label>
                            <span>Band 终点（不含）</span>
                            <input
                                type="number"
                                min="1"
                                :max="vectorLength(parameter)"
                                :value="bandProjection(parameter.id).end"
                                @change="setBand(parameter, 'end', $event)"
                            >
                        </label>
                    </div>
                </template>

                <template v-else>
                    <label class="field-row">
                        <span>Lane</span>
                        <select
                            :value="editorSource(parameter.id).laneId"
                            :data-testid="`editor-lane-${parameter.id}`"
                            @change="setEditorLane(parameter, $event)"
                        >
                            <option v-for="lane in editorProject?.lanes ?? []" :key="lane.id" :value="lane.id">
                                {{ lane.name }}（{{ lane.eventKind }}）
                            </option>
                        </select>
                    </label>
                    <label class="field-row">
                        <span>分类</span>
                        <select
                            :value="editorSource(parameter.id).innerClassId ?? ''"
                            :data-testid="`editor-class-${parameter.id}`"
                            @change="setEditorClass(parameter, $event)"
                        >
                            <option value="">整个 lane（OR/max）</option>
                            <option
                                v-for="innerClass in selectedLane(parameter.id)?.innerClasses ?? []"
                                :key="innerClass.id"
                                :value="innerClass.id"
                            >{{ innerClass.label }}</option>
                        </select>
                    </label>
                </template>

                <details v-if="binding(parameter.id).transform" class="mapping-details">
                    <summary>数值映射与平滑</summary>
                    <div class="transform-grid">
                        <label v-for="field in numericTransformFields" :key="field.key">
                            <span>{{ field.label }}</span>
                            <input
                                type="number"
                                :min="field.nonNegative ? 0 : undefined"
                                step="any"
                                :value="binding(parameter.id).transform?.[field.key]"
                                @change="setTransformNumber(parameter, field.key, $event)"
                            >
                        </label>
                        <label class="checkbox-row">
                            <span>Clamp</span>
                            <input
                                type="checkbox"
                                :checked="binding(parameter.id).transform?.clamp"
                                @change="setTransformFlag(parameter, 'clamp', $event)"
                            >
                        </label>
                        <label class="checkbox-row">
                            <span>Invert</span>
                            <input
                                type="checkbox"
                                :checked="binding(parameter.id).transform?.invert"
                                @change="setTransformFlag(parameter, 'invert', $event)"
                            >
                        </label>
                    </div>
                </details>
            </article>
        </section>
    </fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getFeatureDefinition } from '../analysis/featureRegistry';
import type { FeatureId } from '../analysis/types';
import {
    analysisComponentsForFeature,
    analysisVectorLength,
    compatibleAnalysisFeatures,
    compatibleAnalysisProjections,
    createDefaultAnalysisBinding,
    createDefaultEditorBinding,
    createProjection,
    defaultNumericTransform,
} from '../visualizer/bindingDefaults';
import { wouldExceedVisualizerFeatureLimit } from '../visualizer/bindingPlanner';
import type { VisualizerResolvedParameter } from '../visualizer/bindingResolver';
import type { VisualizerResolvedParameterMap } from '../visualizer/rendererTypes';
import type {
    SceneBindingSourceKind,
    SceneParameterDescriptor,
    SceneTemplateDescriptor,
} from '../visualizer/sceneRegistry';
import type {
    VisualizerAnalysisComponent,
    VisualizerBindingRuntimeSnapshot,
    VisualizerNumericTransformV1,
    VisualizerParameterBindingV1,
    VisualizerProjectV1,
} from '../visualizer/types';
import { useVisualizerSessionController } from '../visualizer/visualizerSessionController';

const props = defineProps<{
    project: VisualizerProjectV1;
    runtime: VisualizerBindingRuntimeSnapshot;
    descriptor: SceneTemplateDescriptor;
    resolvedValues: VisualizerResolvedParameterMap;
    locked?: boolean;
}>();

const controller = useVisualizerSessionController();
const localError = defineModel<string>('error', { default: '' });
const editorProject = computed(() => props.project.editorSnapshot?.project ?? null);
const editorReferenceCount = computed(() => props.project.scene.bindings.filter(
    (entry) => entry.source.kind === 'editor-event',
).length);
const editorSourceLabel = computed(() => ({
    none: '无来源',
    project: '工程快照',
    draft: '同歌草稿',
    imported: '导入文件',
})[props.runtime.editorSnapshotSource]);
const activeFeatureLabels = computed(() => props.runtime.activeFeatureIds
    .map((featureId) => getFeatureDefinition(featureId).label)
    .join('、'));
const analysisStateLabel = computed(() => ({
    idle: '未使用特征',
    loading: '分析中',
    ready: '已就绪',
    error: props.runtime.analysisMessage || '分析失败',
})[props.runtime.analysisState]);
const numericTransformFields: Array<{
    key: keyof Pick<VisualizerNumericTransformV1,
    'inputMin' | 'inputMax' | 'outputMin' | 'outputMax' | 'attackSeconds' | 'releaseSeconds'>;
    label: string;
    nonNegative?: boolean;
}> = [
    { key: 'inputMin', label: '输入下限' },
    { key: 'inputMax', label: '输入上限' },
    { key: 'outputMin', label: '输出下限' },
    { key: 'outputMax', label: '输出上限' },
    { key: 'attackSeconds', label: 'Attack（秒）', nonNegative: true },
    { key: 'releaseSeconds', label: 'Release（秒）', nonNegative: true },
];

const binding = (parameterId: string): VisualizerParameterBindingV1 => {
    const value = props.project.scene.bindings.find((entry) => entry.parameterId === parameterId);
    if (!value) throw new Error(`缺少参数绑定：${parameterId}`);
    return value;
};
const resolved = (parameterId: string): VisualizerResolvedParameter | undefined =>
    props.resolvedValues.get(parameterId);
const constantValue = (parameterId: string) => {
    const source = binding(parameterId).source;
    return source.kind === 'constant' ? source.value : 0;
};
const analysisSource = (parameterId: string) => {
    const source = binding(parameterId).source;
    if (source.kind !== 'analysis') throw new Error('当前不是分析绑定。');
    return source;
};
const editorSource = (parameterId: string) => {
    const source = binding(parameterId).source;
    if (source.kind !== 'editor-event') throw new Error('当前不是 Editor 绑定。');
    return source;
};
const binProjection = (parameterId: string) => {
    const projection = analysisSource(parameterId).projection;
    if (projection.kind !== 'bin') throw new Error('当前不是 bin 投影。');
    return projection;
};
const bandProjection = (parameterId: string) => {
    const projection = analysisSource(parameterId).projection;
    if (projection.kind !== 'band') throw new Error('当前不是 band 投影。');
    return projection;
};

const run = (operation: () => void) => {
    localError.value = '';
    try {
        operation();
    } catch (error) {
        localError.value = error instanceof Error ? error.message : '绑定更新失败。';
    }
};
const runAsync = async (operation: () => Promise<unknown>) => {
    localError.value = '';
    try {
        await operation();
    } catch (error) {
        localError.value = error instanceof Error ? error.message : 'Editor 数据操作失败。';
    }
};

const sourceKindLabel = (kind: SceneBindingSourceKind): string => ({
    constant: '固定值',
    analysis: 'Analyzer 特征',
    'editor-event': 'Editor 事件',
})[kind];
const featureLabel = (featureId: FeatureId): string =>
    getFeatureDefinition(featureId).label;
const featureDisabled = (parameterId: string, featureId: FeatureId): boolean =>
    wouldExceedVisualizerFeatureLimit(props.project, featureId, parameterId);
const analysisSourceUnavailable = (parameter: SceneParameterDescriptor): boolean =>
    binding(parameter.id).source.kind !== 'analysis'
    && compatibleAnalysisFeatures(parameter).every((featureId) =>
        featureDisabled(parameter.id, featureId));
const componentOptions = (parameter: SceneParameterDescriptor): VisualizerAnalysisComponent[] => {
    const source = analysisSource(parameter.id);
    return analysisComponentsForFeature(source.featureId).filter((component) =>
        parameter.allowedAnalysisComponents?.includes(component));
};
const projectionOptions = (parameter: SceneParameterDescriptor) => {
    const source = analysisSource(parameter.id);
    return compatibleAnalysisProjections(
        parameter,
        source.featureId,
        source.component ?? 'default',
    );
};
const vectorLength = (parameter: SceneParameterDescriptor): number => {
    const source = analysisSource(parameter.id);
    return analysisVectorLength(source.featureId, source.component ?? 'default');
};
const selectedLane = (parameterId: string) => {
    const source = editorSource(parameterId);
    return editorProject.value?.lanes.find((lane) => lane.id === source.laneId);
};

const setSourceKind = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const kind = (event.target as HTMLSelectElement).value as SceneBindingSourceKind;
    if (kind === 'constant') {
        controller.updateBinding({
            parameterId: parameter.id,
            source: {
                kind,
                value: typeof parameter.defaultValue === 'object'
                    ? [...parameter.defaultValue as readonly number[]]
                    : parameter.defaultValue,
            },
        });
        return;
    }
    if (kind === 'analysis') {
        const featureId = compatibleAnalysisFeatures(parameter)[0];
        if (!featureId) throw new Error('这个参数没有兼容的分析特征。');
        controller.updateBinding(createDefaultAnalysisBinding(parameter, featureId));
        return;
    }
    const lane = editorProject.value?.lanes[0];
    if (!lane) throw new Error('请先载入包含 lane 的同歌 Editor 数据。');
    controller.updateBinding(createDefaultEditorBinding(
        parameter,
        lane.id,
        undefined,
        lane.eventKind === 'point',
    ));
});

const setConstant = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const element = event.target as HTMLInputElement;
    const value = parameter.valueKind === 'boolean'
        ? element.checked
        : parameter.valueKind === 'number'
            ? Number(element.value)
            : element.value;
    controller.updateBinding({ parameterId: parameter.id, source: { kind: 'constant', value } });
});

const setAnalysisFeature = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    controller.updateBinding(createDefaultAnalysisBinding(
        parameter,
        (event.target as HTMLSelectElement).value as FeatureId,
    ));
});

const setAnalysisComponent = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const current = analysisSource(parameter.id);
    const component = (event.target as HTMLSelectElement).value as VisualizerAnalysisComponent;
    const projections = compatibleAnalysisProjections(parameter, current.featureId, component);
    const kind = projections.includes(current.projection.kind)
        ? current.projection.kind
        : projections[0];
    if (!kind) throw new Error('该分量没有兼容的投影。');
    controller.updateBinding({
        ...binding(parameter.id),
        source: {
            kind: 'analysis',
            featureId: current.featureId,
            ...(component === 'default' ? {} : { component }),
            projection: createProjection(kind),
        },
    });
});

const setProjection = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const current = analysisSource(parameter.id);
    controller.updateBinding({
        ...binding(parameter.id),
        source: {
            ...current,
            projection: createProjection(
                (event.target as HTMLSelectElement).value as ReturnType<typeof projectionOptions>[number],
            ),
        },
    });
});

const setBin = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const current = analysisSource(parameter.id);
    controller.updateBinding({
        ...binding(parameter.id),
        source: { ...current, projection: { kind: 'bin', index: Number((event.target as HTMLInputElement).value) } },
    });
});

const setBand = (
    parameter: SceneParameterDescriptor,
    field: 'start' | 'end',
    event: Event,
) => run(() => {
    const current = analysisSource(parameter.id);
    const projection = bandProjection(parameter.id);
    controller.updateBinding({
        ...binding(parameter.id),
        source: {
            ...current,
            projection: { ...projection, [field]: Number((event.target as HTMLInputElement).value) },
        },
    });
});

const setEditorLane = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const laneId = (event.target as HTMLSelectElement).value;
    const lane = editorProject.value?.lanes.find((entry) => entry.id === laneId);
    if (!lane) throw new Error('Editor lane 引用已失效。');
    controller.updateBinding(createDefaultEditorBinding(
        parameter,
        laneId,
        undefined,
        lane.eventKind === 'point',
    ));
});

const setEditorClass = (parameter: SceneParameterDescriptor, event: Event) => run(() => {
    const current = editorSource(parameter.id);
    const innerClassId = (event.target as HTMLSelectElement).value;
    controller.updateBinding({
        ...binding(parameter.id),
        source: {
            kind: 'editor-event',
            laneId: current.laneId,
            ...(innerClassId ? { innerClassId } : {}),
        },
    });
});

const setTransformNumber = (
    parameter: SceneParameterDescriptor,
    key: keyof Pick<VisualizerNumericTransformV1,
    'inputMin' | 'inputMax' | 'outputMin' | 'outputMax' | 'attackSeconds' | 'releaseSeconds'>,
    event: Event,
) => run(() => {
    const current = binding(parameter.id);
    const transform = current.transform
        ?? defaultNumericTransform(parameter, current.source.kind === 'analysis'
            ? current.source.featureId
            : undefined, current.source.kind === 'editor-event');
    controller.updateBinding({
        ...current,
        transform: { ...transform, [key]: Number((event.target as HTMLInputElement).value) },
    });
});

const setTransformFlag = (
    parameter: SceneParameterDescriptor,
    key: 'clamp' | 'invert',
    event: Event,
) => run(() => {
    const current = binding(parameter.id);
    if (!current.transform) return;
    controller.updateBinding({
        ...current,
        transform: { ...current.transform, [key]: (event.target as HTMLInputElement).checked },
    });
});

const resolvedLabel = (parameterId: string): string => {
    const entry = resolved(parameterId);
    if (!entry) return '等待求值';
    if (entry.state !== 'ready') return entry.message || entry.state;
    if (Array.isArray(entry.value)) {
        const preview = entry.value.slice(0, 3).map((value) => value.toFixed(3)).join(', ');
        return `[${entry.value.length}] ${preview}${entry.value.length > 3 ? '…' : ''}`;
    }
    return typeof entry.value === 'number'
        ? entry.value.toFixed(5)
        : String(entry.value);
};

const reloadEditorDraft = () => void runAsync(() => controller.reloadEditorDraft());
const importEditorProject = () => void runAsync(() => controller.importEditorProject());
const removeEditorSnapshot = () => run(() => controller.removeEditorSnapshot());
</script>

<style scoped>
.binding-inspector {
    display: grid;
    gap: 10px;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
}

button,
select,
input {
    min-height: 28px;
    border: 1px solid var(--hairline);
    border-radius: 4px;
    color: var(--ink);
    background: var(--surface-3);
}

button {
    cursor: pointer;
}

button:hover,
select:hover,
input:hover {
    border-color: var(--accent-soft);
}

button:focus-visible,
select:focus-visible,
input:focus-visible,
summary:focus-visible {
    outline: 2px solid var(--accent-soft);
    outline-offset: 2px;
}

.inspector-section,
.parameter-card {
    padding-bottom: 10px;
    border-bottom: 1px solid var(--divider);
}

.section-heading,
.parameter-heading,
.analysis-status,
.compact-actions,
.field-row,
.checkbox-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.section-heading h3,
.parameter-heading h3,
.section-heading p {
    margin: 0;
}

.section-heading p,
.field-note,
.parameter-heading code {
    color: var(--mute);
    font-size: .72rem;
}

.source-badge,
.parameter-heading output {
    color: var(--accent-soft);
    font-size: .72rem;
    text-align: right;
}

.parameter-heading output[data-state="error"],
.inspector-error {
    color: var(--error);
}

.compact-actions {
    justify-content: flex-start;
    margin-top: 8px;
    flex-wrap: wrap;
}

.compact-actions button {
    padding: 4px 7px;
    font-size: .72rem;
}

.analysis-status {
    align-items: flex-start;
    padding: 8px;
    border: 1px solid var(--hairline-soft);
    color: var(--body);
    font-size: .72rem;
}

.analysis-status span:last-child {
    flex: 1;
    text-align: right;
}

.inspector-error {
    margin: 0;
    font-size: .78rem;
}

.parameter-list {
    display: grid;
    gap: 10px;
}

.parameter-heading {
    align-items: flex-start;
    margin-bottom: 8px;
}

.parameter-heading h3 {
    margin: 0;
    font-size: .85rem;
}

.field-row,
.band-fields label,
.transform-grid label {
    margin: 6px 0 0;
    font-size: .76rem;
}

.field-row > span,
.band-fields span,
.transform-grid span {
    color: var(--body);
}

.field-row select,
.field-row input,
.band-fields input,
.transform-grid input {
    width: 55%;
    min-width: 0;
    min-height: 28px;
    padding: 3px 6px;
}

.checkbox-row input {
    width: auto;
}

.band-fields,
.transform-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
}

.band-fields label,
.transform-grid label {
    display: grid;
    gap: 4px;
}

.band-fields input,
.transform-grid input {
    width: 100%;
}

.mapping-details {
    margin-top: 8px;
    color: var(--body);
    font-size: .76rem;
}

.mapping-details summary {
    cursor: pointer;
}

button:disabled {
    cursor: not-allowed;
    opacity: .45;
}
</style>
