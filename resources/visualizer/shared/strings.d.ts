import type { SpectrumUnit } from '../../../src/visualizer/rendererTypes';
export function spectrumBands(values: readonly number[], output?: Float32Array, unit?: SpectrumUnit): Float32Array;
export class SpectralStringsState {
    reset(): void;
    resolve(
        time: number,
        key: string,
        decay: number,
        source: (time: number) => readonly number[],
        unit?: SpectrumUnit,
    ): { tick: number; position: Float32Array; velocity: Float32Array; previous: Float32Array; levels: Float32Array };
}
