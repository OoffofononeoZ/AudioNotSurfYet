import type {
    VisualizerResolvedParameterMap,
    VisualizerSceneFrameSnapshot,
} from './rendererTypes';

export const ORTHOGONAL_LINES_STEP_SECONDS = 1 / 60;
export const ORTHOGONAL_LINES_CHECKPOINT_SECONDS = 1;

export interface OrthogonalLineDirectionState {
    readonly enabled: boolean;
    readonly sourceIntensity: number;
    readonly displayIntensity: number;
    readonly color: string;
    readonly thicknessCssPx: number;
    readonly brightness: number;
    readonly lengthRatio: number;
    readonly mainAlpha: number;
    readonly haloAlpha: number;
    readonly haloWidthCssPx: number;
}

export interface OrthogonalLinesFrameState extends VisualizerSceneFrameSnapshot {
    readonly timeSeconds: number;
    readonly bindingRevision: number;
    readonly horizontal: OrthogonalLineDirectionState;
    readonly vertical: OrthogonalLineDirectionState;
}

interface EnergyCheckpoint {
    readonly horizontal: number;
    readonly vertical: number;
}

type ResolveValues = (timeSeconds: number) => VisualizerResolvedParameterMap;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const finiteNumber = (
    values: VisualizerResolvedParameterMap,
    id: string,
    fallback: number,
): number => {
    const entry = values.get(id);
    return entry?.state === 'ready'
        && typeof entry.value === 'number'
        && Number.isFinite(entry.value)
        ? entry.value
        : fallback;
};

const booleanValue = (
    values: VisualizerResolvedParameterMap,
    id: string,
    fallback: boolean,
): boolean => {
    const entry = values.get(id);
    return entry?.state === 'ready' && typeof entry.value === 'boolean'
        ? entry.value
        : fallback;
};

const colorValue = (
    values: VisualizerResolvedParameterMap,
    id: string,
    fallback: string,
): string => {
    const entry = values.get(id);
    return entry?.state === 'ready' && typeof entry.value === 'string'
        ? entry.value
        : fallback;
};

const decayEnergy = (
    previous: number,
    current: number,
    decaySeconds: number,
    deltaSeconds: number,
): number => decaySeconds <= 0
    ? current
    : Math.max(current, previous * Math.exp(-4 * deltaSeconds / decaySeconds));

const stableHash = (value: string): string => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const directionState = (
    prefix: 'horizontal' | 'vertical',
    values: VisualizerResolvedParameterMap,
    displayIntensity: number,
): OrthogonalLineDirectionState => {
    const enabled = booleanValue(values, `${prefix}Enabled`, true);
    const sourceIntensity = clamp(finiteNumber(values, `${prefix}Intensity`, 0), 0, 1);
    const visibleIntensity = enabled ? clamp(displayIntensity, 0, 1) : 0;
    const brightness = Math.max(0, finiteNumber(values, `${prefix}Brightness`, 1));
    const thicknessCssPx = Math.max(0, finiteNumber(values, `${prefix}Thickness`, 2));
    const brightnessExcess = Math.max(0, brightness - 1);
    return {
        enabled,
        sourceIntensity,
        displayIntensity: visibleIntensity,
        color: colorValue(values, `${prefix}Color`, prefix === 'horizontal' ? '#64f6b5' : '#f4f7f5'),
        thicknessCssPx,
        brightness,
        lengthRatio: visibleIntensity,
        mainAlpha: clamp(visibleIntensity * brightness, 0, 1),
        haloAlpha: clamp(visibleIntensity * (0.12 * brightness + 0.22 * brightnessExcess), 0, 1),
        haloWidthCssPx: thicknessCssPx * (3 + 2 * brightnessExcess),
    };
};

export class OrthogonalLinesFrameStateResolver {
    private bindingRevision: number | null = null;
    private readonly checkpoints = new Map<number, EnergyCheckpoint>();

    reset(): void {
        this.bindingRevision = null;
        this.checkpoints.clear();
    }

    resolve(
        timeSeconds: number,
        bindingRevision: number,
        currentValues: VisualizerResolvedParameterMap,
        resolveValues: ResolveValues,
    ): OrthogonalLinesFrameState {
        if (this.bindingRevision !== bindingRevision) {
            this.bindingRevision = bindingRevision;
            this.checkpoints.clear();
        }
        const targetTime = Math.max(0, Number.isFinite(timeSeconds) ? timeSeconds : 0);
        const valuesAt = (sampleTime: number): VisualizerResolvedParameterMap =>
            Math.abs(sampleTime - targetTime) < 1e-9
                ? currentValues
                : resolveValues(sampleTime);
        this.ensureInitial(valuesAt);
        const checkpointSecond = Math.floor(targetTime);
        this.ensureCheckpoint(checkpointSecond, valuesAt);
        let energy = this.checkpoints.get(checkpointSecond) ?? { horizontal: 0, vertical: 0 };
        let cursor = checkpointSecond;
        while (cursor < targetTime - 1e-12) {
            const delta = Math.min(ORTHOGONAL_LINES_STEP_SECONDS, targetTime - cursor);
            cursor += delta;
            energy = this.advance(energy, valuesAt(cursor), delta);
        }

        const horizontal = directionState('horizontal', currentValues, energy.horizontal);
        const vertical = directionState('vertical', currentValues, energy.vertical);
        const hashInput = JSON.stringify({
            timeSeconds: targetTime.toFixed(6),
            horizontal: {
                ...horizontal,
                sourceIntensity: horizontal.sourceIntensity.toFixed(6),
                displayIntensity: horizontal.displayIntensity.toFixed(6),
                mainAlpha: horizontal.mainAlpha.toFixed(6),
                haloAlpha: horizontal.haloAlpha.toFixed(6),
            },
            vertical: {
                ...vertical,
                sourceIntensity: vertical.sourceIntensity.toFixed(6),
                displayIntensity: vertical.displayIntensity.toFixed(6),
                mainAlpha: vertical.mainAlpha.toFixed(6),
                haloAlpha: vertical.haloAlpha.toFixed(6),
            },
        });
        return {
            timeSeconds: targetTime,
            bindingRevision,
            horizontal,
            vertical,
            hash: stableHash(hashInput),
            needsSourcePrompt: horizontal.sourceIntensity === 0 && vertical.sourceIntensity === 0,
        };
    }

    private ensureInitial(resolveValues: ResolveValues): void {
        if (this.checkpoints.has(0)) return;
        const values = resolveValues(0);
        this.checkpoints.set(0, {
            horizontal: clamp(finiteNumber(values, 'horizontalIntensity', 0), 0, 1),
            vertical: clamp(finiteNumber(values, 'verticalIntensity', 0), 0, 1),
        });
    }

    private ensureCheckpoint(second: number, resolveValues: ResolveValues): void {
        let currentSecond = Math.max(...this.checkpoints.keys());
        let energy = this.checkpoints.get(currentSecond) ?? { horizontal: 0, vertical: 0 };
        while (currentSecond < second) {
            const end = currentSecond + ORTHOGONAL_LINES_CHECKPOINT_SECONDS;
            let cursor = currentSecond;
            while (cursor < end - 1e-12) {
                const delta = Math.min(ORTHOGONAL_LINES_STEP_SECONDS, end - cursor);
                cursor += delta;
                energy = this.advance(energy, resolveValues(cursor), delta);
            }
            currentSecond = end;
            this.checkpoints.set(currentSecond, energy);
        }
    }

    private advance(
        previous: EnergyCheckpoint,
        values: VisualizerResolvedParameterMap,
        deltaSeconds: number,
    ): EnergyCheckpoint {
        const horizontal = clamp(finiteNumber(values, 'horizontalIntensity', 0), 0, 1);
        const vertical = clamp(finiteNumber(values, 'verticalIntensity', 0), 0, 1);
        return {
            horizontal: decayEnergy(
                previous.horizontal,
                horizontal,
                Math.max(0, finiteNumber(values, 'horizontalDecay', 0)),
                deltaSeconds,
            ),
            vertical: decayEnergy(
                previous.vertical,
                vertical,
                Math.max(0, finiteNumber(values, 'verticalDecay', 0)),
                deltaSeconds,
            ),
        };
    }
}
