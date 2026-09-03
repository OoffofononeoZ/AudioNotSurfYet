import type {
    VisualizerResolvedParameterMap,
    VisualizerSceneFrameSnapshot,
} from './rendererTypes';

export const CUBE_SWARM_CORE_COUNT = 64;
export const CUBE_SWARM_MAX_PERIPHERAL_COUNT = 512;
export const CUBE_SWARM_SATELLITE_RADII = [1.8, 2.35, 2.9] as const;
export const CUBE_SWARM_SATELLITE_TILTS = [-25, 20, 55] as const;
export const CUBE_SWARM_STEP_SECONDS = 1 / 60;
export const CUBE_SWARM_CHECKPOINT_SECONDS = 1;
export const CUBE_SWARM_SPECTRUM_REFERENCE = 128;

export interface CubeSwarmPeripheralState {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly size: number;
    readonly rotationX: number;
    readonly rotationY: number;
    readonly rotationZ: number;
}

export interface CubeSwarmSatelliteState {
    readonly x: number;
    readonly y: number;
    readonly z: number;
    readonly angle: number;
    readonly size: number;
}

export interface CubeSwarmFrameState extends VisualizerSceneFrameSnapshot {
    readonly timeSeconds: number;
    readonly bindingRevision: number;
    readonly baseSize: number;
    readonly coreScale: number;
    readonly coreVisualScale: number;
    readonly coreAmplitudes: readonly number[];
    readonly integratedRise: number;
    readonly integratedOrbit: number;
    readonly peripheral: readonly CubeSwarmPeripheralState[];
    readonly satellites: readonly CubeSwarmSatelliteState[];
    readonly coreColor: string;
    readonly peripheralColor: string;
    readonly backgroundColor: string;
    readonly cameraDistance: number;
}

interface MotionCheckpoint {
    readonly rise: number;
    readonly orbit: number;
}

interface UnitPeripheralLayout {
    readonly x: number;
    readonly z: number;
    readonly heightOffset: number;
    readonly size: number;
    readonly rotationX: number;
    readonly rotationY: number;
    readonly rotationZ: number;
}

type ResolveValues = (timeSeconds: number) => VisualizerResolvedParameterMap;

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const positiveModulo = (value: number, divisor: number): number =>
    ((value % divisor) + divisor) % divisor;

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

const vectorValue = (
    values: VisualizerResolvedParameterMap,
    id: string,
): readonly number[] => {
    const entry = values.get(id);
    return entry?.state === 'ready' && Array.isArray(entry.value)
        ? entry.value
        : [];
};

const mulberry32 = (seed: number): (() => number) => {
    let state = seed >>> 0;
    return () => {
        state += 0x6d2b79f5;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
};

const createStableHasher = () => {
    let hash = 0x811c9dc5;
    return {
        add(part: string): void {
            for (let index = 0; index < part.length; index += 1) {
                hash ^= part.charCodeAt(index);
                hash = Math.imul(hash, 0x01000193);
            }
            hash ^= 124;
            hash = Math.imul(hash, 0x01000193);
        },
        digest(): string {
            return (hash >>> 0).toString(16).padStart(8, '0');
        },
    };
};

const quantized = (value: number): string =>
    (Number.isFinite(value) ? value : 0).toFixed(6);

export const aggregateCubeSpectrum = (
    input: readonly number[],
): number[] => {
    if (input.length === 0) return Array(CUBE_SWARM_CORE_COUNT).fill(0);
    const result: number[] = [];
    for (let index = 0; index < CUBE_SWARM_CORE_COUNT; index += 1) {
        const start = Math.floor(index * input.length / CUBE_SWARM_CORE_COUNT);
        const rawEnd = Math.floor((index + 1) * input.length / CUBE_SWARM_CORE_COUNT);
        const end = Math.min(input.length, Math.max(start + 1, rawEnd));
        let maximum = 0;
        for (let cursor = start; cursor < end; cursor += 1) {
            const value = input[cursor];
            if (typeof value === 'number' && Number.isFinite(value)) {
                maximum = Math.max(maximum, value);
            }
        }
        result.push(clamp(
            Math.log1p(maximum) / Math.log1p(CUBE_SWARM_SPECTRUM_REFERENCE),
            0,
            1,
        ));
    }
    return result;
};

export const createCubePeripheralLayout = (
    seed: number,
): readonly UnitPeripheralLayout[] => {
    const random = mulberry32(seed ^ 0x43554245);
    return Array.from({ length: CUBE_SWARM_MAX_PERIPHERAL_COUNT }, () => {
        const side = random() < 0.5 ? -1 : 1;
        return {
            x: side * (1.35 + random() * 2.25),
            z: (random() * 2 - 1) * 1.2,
            heightOffset: random() * 6,
            size: 0.08 + random() * 0.12,
            rotationX: random() * Math.PI * 2,
            rotationY: random() * Math.PI * 2,
            rotationZ: random() * Math.PI * 2,
        };
    });
};

export class CubeSwarmFrameStateResolver {
    private readonly peripheralLayout: readonly UnitPeripheralLayout[];
    private readonly satellitePhases: readonly number[];
    private bindingRevision: number | null = null;
    private readonly checkpoints = new Map<number, MotionCheckpoint>();

    constructor(seed: number) {
        this.peripheralLayout = createCubePeripheralLayout(seed);
        const random = mulberry32(seed ^ 0x53415433);
        this.satellitePhases = CUBE_SWARM_SATELLITE_RADII.map(
            () => random() * Math.PI * 2,
        );
    }

    reset(): void {
        this.bindingRevision = null;
        this.checkpoints.clear();
    }

    resolve(
        timeSeconds: number,
        bindingRevision: number,
        currentValues: VisualizerResolvedParameterMap,
        resolveValues: ResolveValues,
    ): CubeSwarmFrameState {
        if (this.bindingRevision !== bindingRevision) {
            this.bindingRevision = bindingRevision;
            this.checkpoints.clear();
        }
        const targetTime = Math.max(0, Number.isFinite(timeSeconds) ? timeSeconds : 0);
        const valuesAt = (sampleTime: number): VisualizerResolvedParameterMap =>
            Math.abs(sampleTime - targetTime) < 1e-9
                ? currentValues
                : resolveValues(sampleTime);
        this.ensureInitial();
        const checkpointSecond = Math.floor(targetTime);
        this.ensureCheckpoint(checkpointSecond, valuesAt);
        let motion = this.checkpoints.get(checkpointSecond) ?? { rise: 0, orbit: 0 };
        let cursor = checkpointSecond;
        while (cursor < targetTime - 1e-12) {
            const delta = Math.min(CUBE_SWARM_STEP_SECONDS, targetTime - cursor);
            cursor += delta;
            motion = this.advance(motion, valuesAt(cursor), delta);
        }

        const baseSize = clamp(finiteNumber(currentValues, 'baseSize', 1), 0.01, 10);
        const coreScale = clamp(finiteNumber(currentValues, 'coreScale', 1), 0, 8);
        const coreVisualScale = Math.sqrt(coreScale);
        const cubeCount = Math.round(clamp(
            finiteNumber(currentValues, 'cubeCount', 48),
            1,
            CUBE_SWARM_MAX_PERIPHERAL_COUNT,
        ));
        const coreAmplitudes = aggregateCubeSpectrum(vectorValue(currentValues, 'centerSpectrum'));
        const peripheral = this.peripheralLayout.slice(0, cubeCount).map((layout) => ({
            x: layout.x * baseSize,
            y: -3 * baseSize + positiveModulo(
                layout.heightOffset * baseSize + motion.rise * baseSize,
                6 * baseSize,
            ),
            z: layout.z * baseSize,
            size: layout.size * baseSize,
            rotationX: layout.rotationX,
            rotationY: layout.rotationY,
            rotationZ: layout.rotationZ,
        }));
        const satellites = CUBE_SWARM_SATELLITE_RADII.map((radius, index) => {
            const angle = (this.satellitePhases[index] ?? 0) + motion.orbit;
            const tilt = (CUBE_SWARM_SATELLITE_TILTS[index] ?? 0) * Math.PI / 180;
            const planarY = Math.sin(angle) * radius * baseSize;
            return {
                x: Math.cos(angle) * radius * baseSize,
                y: planarY * Math.cos(tilt),
                z: planarY * Math.sin(tilt),
                angle,
                size: 0.28 * baseSize,
            };
        });
        const coreColor = colorValue(currentValues, 'coreColor', '#f3ebef');
        const peripheralColor = colorValue(currentValues, 'peripheralColor', '#d8c7d1');
        const backgroundColor = colorValue(currentValues, 'backgroundColor', '#020403');
        const cameraDistance = clamp(
            finiteNumber(currentValues, 'cameraDistance', 8),
            1,
            100,
        );
        const hasher = createStableHasher();
        [
            'cube-swarm-v1',
            quantized(targetTime),
            quantized(baseSize),
            quantized(coreScale),
            quantized(motion.rise),
            quantized(motion.orbit),
            coreColor,
            peripheralColor,
            backgroundColor,
            quantized(45),
            quantized(0),
            quantized(0.8 * baseSize),
            quantized(cameraDistance),
            quantized(0),
            quantized(0),
            quantized(0),
        ].forEach((part) => hasher.add(part));
        coreAmplitudes.forEach((amplitude, index) => {
            const angle = index / CUBE_SWARM_CORE_COUNT * Math.PI * 2;
            const radius = 0.85 * baseSize * coreVisualScale;
            const length = baseSize * (0.12 + 0.68 * amplitude) * coreVisualScale;
            const cross = 0.08 * baseSize * coreVisualScale;
            hasher.add(quantized(amplitude));
            hasher.add(quantized(Math.cos(angle) * radius));
            hasher.add(quantized(Math.sin(angle) * radius));
            hasher.add(quantized(length));
            hasher.add(quantized(cross));
            hasher.add(quantized(cross));
        });
        for (const item of peripheral) {
            hasher.add(quantized(item.x));
            hasher.add(quantized(item.y));
            hasher.add(quantized(item.z));
            hasher.add(quantized(item.size));
            hasher.add(quantized(item.rotationX));
            hasher.add(quantized(item.rotationY));
            hasher.add(quantized(item.rotationZ));
        }
        for (const item of satellites) {
            hasher.add(quantized(item.x));
            hasher.add(quantized(item.y));
            hasher.add(quantized(item.z));
            hasher.add(quantized(item.angle));
            hasher.add(quantized(item.size));
        }
        return {
            timeSeconds: targetTime,
            bindingRevision,
            baseSize,
            coreScale,
            coreVisualScale,
            coreAmplitudes,
            integratedRise: motion.rise,
            integratedOrbit: motion.orbit,
            peripheral,
            satellites,
            coreColor,
            peripheralColor,
            backgroundColor,
            cameraDistance,
            hash: hasher.digest(),
            needsSourcePrompt: false,
        };
    }

    private ensureInitial(): void {
        if (!this.checkpoints.has(0)) {
            this.checkpoints.set(0, { rise: 0, orbit: 0 });
        }
    }

    private ensureCheckpoint(second: number, resolveValues: ResolveValues): void {
        let currentSecond = Math.max(...this.checkpoints.keys());
        let motion = this.checkpoints.get(currentSecond) ?? { rise: 0, orbit: 0 };
        while (currentSecond < second) {
            const end = currentSecond + CUBE_SWARM_CHECKPOINT_SECONDS;
            let cursor = currentSecond;
            while (cursor < end - 1e-12) {
                const delta = Math.min(CUBE_SWARM_STEP_SECONDS, end - cursor);
                cursor += delta;
                motion = this.advance(motion, resolveValues(cursor), delta);
            }
            currentSecond = end;
            this.checkpoints.set(currentSecond, motion);
        }
    }

    private advance(
        previous: MotionCheckpoint,
        values: VisualizerResolvedParameterMap,
        deltaSeconds: number,
    ): MotionCheckpoint {
        return {
            rise: previous.rise
                + clamp(finiteNumber(values, 'riseSpeed', 0.25), 0, 20) * deltaSeconds,
            orbit: previous.orbit
                + clamp(finiteNumber(values, 'orbitSpeed', 0.3), -12, 12) * deltaSeconds,
        };
    }
}
