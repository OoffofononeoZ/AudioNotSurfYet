import { expect, test } from 'vitest';
import { TapTempoEstimator } from '../../src/editor/tapTempo';
test('starts at the second tap, averages every interval and resets after four seconds of idle', () => {
    const estimator = new TapTempoEstimator();
    expect(estimator.tap(0)).toEqual({ count: 1, bpm: null });
    expect(estimator.tap(500)).toEqual({ count: 2, bpm: 120 });
    expect(estimator.tap(1500)).toEqual({ count: 3, bpm: 80 });
    expect(estimator.tap(2500)).toEqual({ count: 4, bpm: 72 });
    expect(estimator.tap(7000)).toEqual({ count: 1, bpm: null });
    estimator.reset();
    estimator.tap(0);
    expect(estimator.tap(3000).bpm).toBe(20);
});
test('caps averaging history and exposes out-of-range estimates for UI rejection', () => {
    const estimator = new TapTempoEstimator();
    for (let index = 0; index < 200; index++) estimator.tap(index * 100);
    expect(estimator.tap(20000)).toEqual({ count: 129, bpm: 600 });
    expect(() => estimator.tap(Infinity)).toThrow();
});
