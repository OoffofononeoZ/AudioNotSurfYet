import type { FeatureId } from './types';

const ids = new Set<FeatureId>(['buffer', 'rms', 'energy', 'zcr']);
const windows = new Map<number, Float32Array>();

export const isTimeDomainFeature = (id: FeatureId): boolean => ids.has(id);

/** Match Meyda's Float32 Hanning coefficients and double-precision products. */
export function extractTimeDomainFeatures(featureIds: readonly FeatureId[], frame: Float32Array) {
    let window = windows.get(frame.length);
    if (!window) {
        window = Float32Array.from(frame, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame.length - 1)));
        windows.set(frame.length, window);
    }
    const signal = Array.from(frame, (value, i) => value * window[i]!);
    let energy = 0,
        zcr = 0;
    for (let i = 0; i < signal.length; i++) {
        energy += Math.pow(Math.abs(signal[i]!), 2);
        if (i && ((signal[i - 1]! >= 0 && signal[i]! < 0) || (signal[i - 1]! < 0 && signal[i]! >= 0))) zcr++;
    }
    return Object.fromEntries(
        featureIds.map(id => [
            id,
            id === 'buffer' ? signal : id === 'energy' ? energy : id === 'zcr' ? zcr : Math.sqrt(energy / frame.length),
        ]),
    );
}
