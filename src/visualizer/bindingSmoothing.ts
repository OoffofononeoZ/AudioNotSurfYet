import type { SceneParameterDescriptor } from './parameterDescriptor';
import type { VisualizerNumericTransformV1 } from './types';
const VISUALIZER_RESOLVER_STEP_SECONDS = 1 / 60;
const VISUALIZER_RESOLVER_CHECKPOINT_SECONDS = 1;
type ScalarSource = (timeSeconds: number, stepSeconds: number) => number;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const normalizedTarget = (
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

export const outputValue = (
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

export class ScalarSmoothingResolver {
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
