import type { FeatureId } from '../analysis/types';

/** Shared amplitude reference used by the existing spectrum renderers. */
export const SPECTRUM_REFERENCE = 128;

/** Adapt a full vector to nonnegative visual strength; scalar projections keep source units. */
export function analysisSignal(values: number[], featureId: FeatureId): number[] {
    if (!['buffer', 'chroma', 'powerSpectrum', 'mfcc'].includes(featureId)) return values;
    return values.map(value => {
        if (!Number.isFinite(value)) throw new Error('分析数据包含非有限值。');
        if (featureId === 'buffer') return Math.abs(value) * SPECTRUM_REFERENCE;
        if (featureId === 'chroma') return Math.max(0, value) * SPECTRUM_REFERENCE;
        if (featureId === 'powerSpectrum') return Math.sqrt(Math.max(0, value));
        if (featureId === 'mfcc') return Math.abs(value);
        return value;
    });
}
