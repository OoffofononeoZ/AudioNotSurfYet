import { expect, test } from 'vitest';
import { TapTempoEstimator } from '../../src/editor/tapTempo';
test('ignores warm-up taps, previews after eight and resets after four seconds of idle', () => {
    const estimator = new TapTempoEstimator();
    for (const time of [0, 100, 200, 300, 1000, 1500, 2000]) expect(estimator.tap(time).bpm).toBeNull();
    expect(estimator.tap(2500)).toEqual({ count: 8, bpm: 120 });
    expect(estimator.tap(7000)).toEqual({ count: 1, bpm: null });
    estimator.reset();
    for (let index = 0; index < 7; index++) estimator.tap(index * 3000);
    expect(estimator.tap(21000).bpm).toBe(20);
});
test('caps averaging history and exposes out-of-range estimates for UI rejection', () => {
    const estimator = new TapTempoEstimator();
    for (let index = 0; index < 200; index++) estimator.tap(index * 100);
    expect(estimator.tap(20000)).toEqual({ count: 132, bpm: 600 });
    expect(() => estimator.tap(Infinity)).toThrow();
});
