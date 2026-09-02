import { describe, expect, test } from 'vitest';
import {
    CUBE_SWARM_CORE_COUNT,
    CUBE_SWARM_MAX_PERIPHERAL_COUNT,
    CUBE_SWARM_SATELLITE_RADII,
    CubeSwarmFrameStateResolver,
    aggregateCubeSpectrum,
    createCubePeripheralLayout,
} from '../../src/visualizer/cubeSwarmState';
import type { VisualizerResolvedParameterMap } from '../../src/visualizer/rendererTypes';

interface ValueOptions {
    spectrum?: readonly number[];
    coreScale?: number;
    riseSpeed?: number;
    orbitSpeed?: number;
    cubeCount?: number;
    baseSize?: number;
}

const values = (options: ValueOptions = {}): VisualizerResolvedParameterMap => new Map([
    ['centerSpectrum', { parameterId: 'centerSpectrum', state: 'ready', value: [...(options.spectrum ?? [0, 1, 4, 128])] }],
    ['coreScale', { parameterId: 'coreScale', state: 'ready', value: options.coreScale ?? 1 }],
    ['riseSpeed', { parameterId: 'riseSpeed', state: 'ready', value: options.riseSpeed ?? 1 }],
    ['orbitSpeed', { parameterId: 'orbitSpeed', state: 'ready', value: options.orbitSpeed ?? 0.5 }],
    ['cubeCount', { parameterId: 'cubeCount', state: 'ready', value: options.cubeCount ?? 48 }],
    ['coreColor', { parameterId: 'coreColor', state: 'ready', value: '#f3ebef' }],
    ['peripheralColor', { parameterId: 'peripheralColor', state: 'ready', value: '#d8c7d1' }],
    ['baseSize', { parameterId: 'baseSize', state: 'ready', value: options.baseSize ?? 1 }],
    ['cameraDistance', { parameterId: 'cameraDistance', state: 'ready', value: 8 }],
    ['backgroundColor', { parameterId: 'backgroundColor', state: 'ready', value: '#020403' }],
]);

const resolve = (
    resolver: CubeSwarmFrameStateResolver,
    timeSeconds: number,
    options: ValueOptions = {},
    revision = 1,
) => resolver.resolve(timeSeconds, revision, values(options), () => values(options));

describe('Visualizer V4 Cube Swarm state', () => {
    test('segments arbitrary spectra into 64 finite log-normalized maxima', () => {
        expect(aggregateCubeSpectrum([])).toEqual(Array(CUBE_SWARM_CORE_COUNT).fill(0));
        const short = aggregateCubeSpectrum([Number.NaN, -4, 1, 128]);
        expect(short).toHaveLength(CUBE_SWARM_CORE_COUNT);
        expect(short.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
        expect(short.slice(0, 32)).toEqual(Array(32).fill(0));
        expect(short.slice(32, 48)).toEqual(Array(16).fill(Math.log1p(1) / Math.log1p(128)));
        expect(short.slice(48)).toEqual(Array(16).fill(1));

        const long = aggregateCubeSpectrum(Array.from({ length: 128 }, (_, index) => index));
        expect(long[0]).toBeCloseTo(Math.log1p(1) / Math.log1p(128), 12);
        expect(long[63]).toBeCloseTo(Math.log1p(127) / Math.log1p(128), 12);
    });

    test('locks seed layout independently from the active peripheral count', () => {
        const first = createCubePeripheralLayout(41);
        const repeated = createCubePeripheralLayout(41);
        expect(first).toHaveLength(CUBE_SWARM_MAX_PERIPHERAL_COUNT);
        expect(first).toEqual(repeated);
        expect(createCubePeripheralLayout(42)).not.toEqual(first);
        expect(resolve(new CubeSwarmFrameStateResolver(41), 0, { cubeCount: 12 }).peripheral)
            .toEqual(resolve(new CubeSwarmFrameStateResolver(41), 0, { cubeCount: 48 }).peripheral.slice(0, 12));
    });

    test('integrates rise and orbit from song zero at fixed 60 Hz checkpoints', () => {
        const direct = resolve(new CubeSwarmFrameStateResolver(41), 2.5);
        const continuousResolver = new CubeSwarmFrameStateResolver(41);
        for (let frame = 0; frame <= 150; frame += 1) {
            resolve(continuousResolver, frame / 60);
        }
        const continuous = resolve(continuousResolver, 2.5);
        expect(direct.integratedRise).toBeCloseTo(2.5, 12);
        expect(direct.integratedOrbit).toBeCloseTo(1.25, 12);
        expect(direct.hash).toBe(continuous.hash);
        expect(resolve(new CubeSwarmFrameStateResolver(41), 2.5).hash).toBe(direct.hash);
    });

    test('isolates spectrum, core, rise, and orbit parameters', () => {
        const baseline = resolve(new CubeSwarmFrameStateResolver(41), 2);
        const core = resolve(new CubeSwarmFrameStateResolver(41), 2, { coreScale: 4 });
        expect(core.coreVisualScale).toBe(2);
        expect(core.peripheral).toEqual(baseline.peripheral);
        expect(core.satellites).toEqual(baseline.satellites);

        const rise = resolve(new CubeSwarmFrameStateResolver(41), 2, { riseSpeed: 3 });
        expect(rise.peripheral.map((item) => item.y)).not.toEqual(
            baseline.peripheral.map((item) => item.y),
        );
        expect(rise.satellites).toEqual(baseline.satellites);

        const orbit = resolve(new CubeSwarmFrameStateResolver(41), 2, { orbitSpeed: 1 });
        expect(orbit.peripheral).toEqual(baseline.peripheral);
        expect(orbit.satellites).not.toEqual(baseline.satellites);
        orbit.satellites.forEach((satellite, index) => {
            const radius = Math.hypot(satellite.x, satellite.y, satellite.z);
            expect(radius).toBeCloseTo(CUBE_SWARM_SATELLITE_RADII[index]!, 12);
        });

        const spectrum = resolve(new CubeSwarmFrameStateResolver(41), 2, { spectrum: [128] });
        expect(spectrum.coreAmplitudes).not.toEqual(baseline.coreAmplitudes);
        expect(spectrum.peripheral).toEqual(baseline.peripheral);
        expect(spectrum.satellites).toEqual(baseline.satellites);
    });

    test('falls back per parameter without hiding invalid resolved entries', () => {
        const invalid: VisualizerResolvedParameterMap = new Map([
            ['centerSpectrum', { parameterId: 'centerSpectrum', state: 'error', message: 'bad spectrum' }],
            ['coreScale', { parameterId: 'coreScale', state: 'loading' }],
            ['riseSpeed', { parameterId: 'riseSpeed', state: 'error', message: 'bad rise' }],
            ['orbitSpeed', { parameterId: 'orbitSpeed', state: 'ready', value: Number.NaN }],
            ['cubeCount', { parameterId: 'cubeCount', state: 'ready', value: 0 }],
        ]);
        const state = new CubeSwarmFrameStateResolver(41).resolve(1, 1, invalid, () => invalid);
        expect(state.coreAmplitudes).toEqual(Array(CUBE_SWARM_CORE_COUNT).fill(0));
        expect(state.coreScale).toBe(1);
        expect(state.integratedRise).toBeCloseTo(0.25, 12);
        expect(state.integratedOrbit).toBeCloseTo(0.3, 12);
        expect(state.peripheral).toHaveLength(1);
        expect(invalid.get('riseSpeed')).toMatchObject({ state: 'error', message: 'bad rise' });
    });
});
