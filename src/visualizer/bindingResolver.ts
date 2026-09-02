import type { AnalysisSeries, FeatureId } from '../analysis/types';
import type { EditorProjectV1 } from '../editor/types';
import type { SceneParameterDescriptor, SceneRegistry } from './sceneRegistry';
import { projectAnalysisSeries } from './analysisProjection';
import type {
    VisualizerNumericTransformV1,
    VisualizerParameterBindingV1,
    VisualizerProjectV1,
} from './types';

export const VISUALIZER_RESOLVER_STEP_SECONDS = 1 / 60;
export const VISUALIZER_RESOLVER_CHECKPOINT_SECONDS = 1;
export const VISUALIZER_POINT_RELEASE_SECONDS = 0.12;

export type VisualizerResolvedParameter = {
    parameterId: string;
    state: 'ready' | 'loading' | 'error';
    value?: number | string | boolean | number[];
    message?: string;
};

type ScalarSource = (timeSeconds: number, stepSeconds: number) => number;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const sourceKey = (binding: VisualizerParameterBindingV1): string =>
    JSON.stringify({ source: binding.source, transform: binding.transform });

const upperBound = (values: readonly number[], target: number): number => {
    let low = 0;
    let high = values.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if ((values[middle] ?? Infinity) <= target) low = middle + 1;
        else high = middle;
    }
    return low;
};

const editorSource = (
    editor: EditorProjectV1,
    laneId: string,
    innerClassId?: string,
): ScalarSource => {
    const lane = editor.lanes.find((entry) => entry.id === laneId);
    if (!lane) throw new Error('Editor lane 引用已失效。');
    if (lane.eventKind === 'point') {
        const times = lane.events
            .filter((event) => !innerClassId || event.innerClassId === innerClassId)
            .map((event) => event.atSeconds)
            .sort((a, b) => a - b);
        return (timeSeconds, stepSeconds) => {
            const first = upperBound(times, timeSeconds - Number.EPSILON);
            return (times[first] ?? Infinity) < timeSeconds + stepSeconds ? 1 : 0;
        };
    }
    const ranges = lane.events
        .filter((event) => !innerClassId || event.innerClassId === innerClassId)
        .map((event) => ({ start: event.startSeconds, end: event.endSeconds }))
        .sort((a, b) => a.start - b.start);
    const starts = ranges.map((entry) => entry.start);
    return (timeSeconds) => {
        for (let index = upperBound(starts, timeSeconds) - 1;
            index >= 0;
            index -= 1) {
            const range = ranges[index];
            if (!range) break;
            if (range.end > timeSeconds && range.start <= timeSeconds) return 1;
            if (innerClassId && range.end <= timeSeconds) break;
        }
        return 0;
    };
};

const normalizedTarget = (
    raw: number,
    transform: VisualizerNumericTransformV1,
): number => {
    if (!Number.isFinite(raw)) throw new Error('绑定源返回非有限值。');
    let value = (raw - transform.inputMin)
        / (transform.inputMax - transform.inputMin);
    if (transform.clamp) value = clamp(value, 0, 1);
    if (transform.invert) value = 1 - value;
    if (!Number.isFinite(value)) throw new Error('绑定变换返回非有限值。');
    return value;
};

const outputValue = (
    normalized: number,
    transform: VisualizerNumericTransformV1,
    descriptor: SceneParameterDescriptor,
): number => {
    const mapped = transform.outputMin
        + normalized * (transform.outputMax - transform.outputMin);
    if (!Number.isFinite(mapped)) throw new Error('绑定输出为非有限值。');
    return descriptor.range
        ? clamp(mapped, descriptor.range.min, descriptor.range.max)
        : mapped;
};

class ScalarSmoothingResolver {
    private readonly checkpoints = new Map<number, number>([[0, 0]]);
    private readonly source: ScalarSource;
    private readonly transform: VisualizerNumericTransformV1;
    private readonly descriptor: SceneParameterDescriptor;

    constructor(
        source: ScalarSource,
        transform: VisualizerNumericTransformV1,
        descriptor: SceneParameterDescriptor,
    ) {
        this.source = source;
        this.transform = transform;
        this.descriptor = descriptor;
    }

    resolve(timeSeconds: number): number {
        const targetTime = Math.max(0, timeSeconds);
        if (
            this.transform.attackSeconds === 0
            && this.transform.releaseSeconds === 0
        ) {
            return outputValue(
                normalizedTarget(
                    this.source(targetTime, VISUALIZER_RESOLVER_STEP_SECONDS),
                    this.transform,
                ),
                this.transform,
                this.descriptor,
            );
        }
        const checkpointSecond = Math.floor(targetTime);
        this.ensureCheckpoint(checkpointSecond);
        let state = this.checkpoints.get(checkpointSecond) ?? 0;
        let cursor = checkpointSecond;
        while (cursor < targetTime - 1e-12) {
            const delta = Math.min(
                VISUALIZER_RESOLVER_STEP_SECONDS,
                targetTime - cursor,
            );
            state = this.advance(state, cursor, delta);
            cursor += delta;
        }
        return outputValue(state, this.transform, this.descriptor);
    }

    private ensureCheckpoint(second: number): void {
        let current = Math.max(...this.checkpoints.keys());
        let state = this.checkpoints.get(current) ?? 0;
        while (current < second) {
            let cursor = current;
            const end = current + VISUALIZER_RESOLVER_CHECKPOINT_SECONDS;
            while (cursor < end - 1e-12) {
                const delta = Math.min(VISUALIZER_RESOLVER_STEP_SECONDS, end - cursor);
                state = this.advance(state, cursor, delta);
                cursor += delta;
            }
            current += VISUALIZER_RESOLVER_CHECKPOINT_SECONDS;
            this.checkpoints.set(current, state);
        }
    }

    private advance(state: number, time: number, delta: number): number {
        const target = normalizedTarget(this.source(time, delta), this.transform);
        const tau = target > state
            ? this.transform.attackSeconds
            : this.transform.releaseSeconds;
        const alpha = tau <= 0 ? 1 : 1 - Math.exp(-delta / tau);
        return state + (target - state) * alpha;
    }
}

export class VisualizerBindingResolver {
    private readonly scalarResolvers = new Map<string, ScalarSmoothingResolver>();
    private readonly registry: SceneRegistry;

    constructor(registry: SceneRegistry) {
        this.registry = registry;
    }

    reset(): void {
        this.scalarResolvers.clear();
    }

    resolve(
        project: VisualizerProjectV1,
        timeSeconds: number,
        getSeries: (featureId: FeatureId) => AnalysisSeries | null,
    ): VisualizerResolvedParameter[] {
        const descriptor = this.registry.get(
            project.scene.templateId,
            project.scene.templateVersion,
        );
        return project.scene.bindings.map((binding, index) => {
            const parameter = descriptor.parameters[index];
            if (!parameter || parameter.id !== binding.parameterId) {
                return { parameterId: binding.parameterId, state: 'error', message: '参数 registry 不匹配。' };
            }
            try {
                if (binding.source.kind === 'constant') {
                    return { parameterId: binding.parameterId, state: 'ready', value: structuredClone(binding.source.value) };
                }
                if (binding.source.kind === 'analysis') {
                    const analysisSource = binding.source;
                    const series = getSeries(analysisSource.featureId);
                    if (!series) return { parameterId: binding.parameterId, state: 'loading', message: '等待分析数据…' };
                    const raw = projectAnalysisSeries(
                        series,
                        analysisSource.component ?? 'default',
                        analysisSource.projection,
                        timeSeconds,
                    );
                    const source: ScalarSource = (sampleTime) => {
                        const value = projectAnalysisSeries(
                            series,
                            analysisSource.component ?? 'default',
                            analysisSource.projection,
                            sampleTime,
                        );
                        if (typeof value !== 'number') throw new Error('向量不能进入标量平滑器。');
                        return value;
                    };
                    return this.resolveDynamic(binding, parameter, raw, timeSeconds, source);
                }
                const editor = project.editorSnapshot?.project;
                if (!editor) throw new Error('工程没有 Editor 数据快照。');
                const source = editorSource(
                    editor,
                    binding.source.laneId,
                    binding.source.innerClassId,
                );
                return this.resolveDynamic(
                    binding,
                    parameter,
                    source(timeSeconds, VISUALIZER_RESOLVER_STEP_SECONDS),
                    timeSeconds,
                    source,
                );
            } catch (error) {
                return {
                    parameterId: binding.parameterId,
                    state: 'error',
                    message: error instanceof Error ? error.message : '绑定解析失败。',
                };
            }
        });
    }

    private resolveDynamic(
        binding: VisualizerParameterBindingV1,
        parameter: SceneParameterDescriptor,
        raw: number | number[],
        timeSeconds: number,
        source: ScalarSource,
    ): VisualizerResolvedParameter {
        if (Array.isArray(raw)) {
            const values = binding.transform
                ? raw.map((value) => outputValue(
                    normalizedTarget(value, binding.transform!),
                    binding.transform!,
                    parameter,
                ))
                : raw.map((value) => {
                    if (!Number.isFinite(value)) throw new Error('向量包含非有限值。');
                    return value;
                });
            return { parameterId: binding.parameterId, state: 'ready', value: values };
        }
        if (!binding.transform) {
            const value = parameter.range
                ? clamp(raw, parameter.range.min, parameter.range.max)
                : raw;
            if (!Number.isFinite(value)) throw new Error('绑定输出为非有限值。');
            return { parameterId: binding.parameterId, state: 'ready', value };
        }
        const key = `${binding.parameterId}:${sourceKey(binding)}`;
        let resolver = this.scalarResolvers.get(key);
        if (!resolver) {
            resolver = new ScalarSmoothingResolver(source, binding.transform, parameter);
            this.scalarResolvers.set(key, resolver);
        }
        return {
            parameterId: binding.parameterId,
            state: 'ready',
            value: resolver.resolve(timeSeconds),
        };
    }
}
