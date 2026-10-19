import type { SpectrumUnit, VisualizerResolvedParameterMap } from '../../../src/visualizer/rendererTypes';
export class GeometricBatch {
    positions: Float32Array;
    colors: Float32Array;
    edges: Float32Array;
    pixelSize: number;
    count: number;
    reset(): void;
    line(a: readonly number[], b: readonly number[], width: number, color: readonly number[]): void;
    triangle(a: readonly number[], b: readonly number[], c: readonly number[], color: readonly number[]): void;
}
export function geometricSpectrum(
    input: readonly number[],
    sensitivity: number,
    output?: Float32Array,
    unit?: SpectrumUnit,
): Float32Array;
export function buildGeometricElement(
    batch: GeometricBatch,
    element: unknown,
    values: VisualizerResolvedParameterMap,
    time: number,
    seed: number,
    aspect: number,
    levels: Float32Array,
): number;
export function createRadialSpectrumSampler(levels: ArrayLike<number>): (index: number) => number;
