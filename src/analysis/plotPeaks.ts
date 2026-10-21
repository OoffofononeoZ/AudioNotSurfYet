import type { CompactPayload, WaveformPayload } from './types';

const maximums = new WeakMap<CompactPayload, number>();
export function payloadMaximum(payload: CompactPayload): number {
    const cached = maximums.get(payload);
    if (cached !== undefined) return cached;
    let maximum = 0;
    if (payload.kind === 'frequency-u16' || payload.kind === 'category-u16') {
        for (const value of payload.values)
            maximum = Math.max(maximum, Math.abs(value * payload.scale + payload.offset));
    } else if (payload.kind === 'complex-derived') {
        for (const value of payload.magnitude) maximum = Math.max(maximum, value * payload.magnitudeScale);
    } else if (payload.kind === 'loudness') {
        for (const value of payload.specific) maximum = Math.max(maximum, value * payload.scale + payload.offset);
    }
    maximum = Math.max(maximum, 1e-6);
    maximums.set(payload, maximum);
    return maximum;
}
export function waveformPeak(payload: WaveformPayload, first: number, last: number): { min: number; max: number } {
    let min = Infinity,
        max = -Infinity;
    for (let i = first; i < last; i++) {
        min = Math.min(min, payload.min[i] ?? 0);
        max = Math.max(max, payload.max[i] ?? 0);
    }
    return { min: min * payload.scale, max: max * payload.scale };
}
