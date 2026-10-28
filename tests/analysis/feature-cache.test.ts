import { expect, test } from 'vitest';
import { AnalysisFeatureCache } from '../../src/analysis/featureCache';
import type { AnalysisSeries, FeatureId } from '../../src/analysis/types';

const identity = { trackId: 'song', trackHash: 'hash', configHash: 'config' };
const series = (featureId: FeatureId): AnalysisSeries => ({
    schemaVersion: 1,
    trackHash: identity.trackHash,
    configHash: identity.configHash,
    featureId,
    startTimeSeconds: 0,
    sampleStepSeconds: 0.04,
    sampleCount: 1,
    dimensions: [],
    payload: { kind: 'scalar-f32', values: Float32Array.of(1) },
});

test('keeps active entries, evicts the least recently used inactive entry, and reuses encoded payloads', () => {
    const cache = new AnalysisFeatureCache();
    cache.select(identity, ['rms', 'energy', 'zcr', 'spectralFlux']);
    for (const id of ['rms', 'energy', 'zcr', 'spectralFlux'] as const) cache.put(series(id));
    const first = cache.stored()!;
    cache.select(identity, ['rms', 'spectralCentroid']);
    cache.get('energy');
    cache.put(series('spectralCentroid'));
    expect(cache.get('zcr')).toBeNull();
    expect(cache.get('rms')).not.toBeNull();
    const second = cache.stored()!;
    expect(second.payloads).toHaveLength(4);
    const key = first.manifest.cacheKeys[0];
    expect(second.payloads.find(p => p.cacheKey === key)?.payload).toBe(first.payloads[0]?.payload);
    cache.select({ ...identity, trackHash: 'changed' }, ['rms']);
    expect(cache.get('rms')).toBeNull();
});

test('restores lazily, removes corrupt entries and preserves unused slots', () => {
    const cache = new AnalysisFeatureCache();
    cache.select(identity, ['rms']);
    cache.put(series('rms'));
    const stored = cache.stored()!;
    const restored = new AnalysisFeatureCache();
    restored.restore(stored);
    restored.select(identity, []);
    expect(restored.stored()?.payloads[0]?.payload).toBe(stored.payloads[0]?.payload);
    expect(restored.get('rms')).toEqual(series('rms'));
    restored.restore({ ...stored, payloads: [{ ...stored.payloads[0]!, payload: new ArrayBuffer(1) }] });
    expect(restored.get('rms')).toBeNull();
    expect(restored.revision).toBeGreaterThan(restored.persistedRevision);
});
