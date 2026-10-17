import assert from 'node:assert/strict';
import test from 'node:test';
import { measureOutputSynchronization } from '../support/visualizer-media-alignment.mjs';

test('alignment follows song timestamps across a missing interval rather than counting frames', () => {
    const result = measureOutputSynchronization([.15, 1.5, 6, 10.5], [.167, 1.533, 6.017, 10.533],
        [.175, 1.525, 6.025, 10.525].map(time => ({ time, rms: .5 })), .05);
    assert.deepEqual(result.failures, []);
    assert.ok(result.syncDriftSeconds < .03);
});
test('alignment rejects a missing event, silent event and an absolute time shift', () => {
    assert.match(measureOutputSynchronization([1.5], [], [{ time: 1.525, rms: .5 }], .05).failures.join(' '), /Missing or shifted flash/);
    assert.match(measureOutputSynchronization([1.5], [1.5], [{ time: 1.525, rms: .02 }], .05).failures.join(' '), /Missing or shifted audio/);
    assert.ok(measureOutputSynchronization([1.5], [2], [{ time: 2.025, rms: .5 }], .05).failures.length > 0);
});
test('alignment rejects cumulative drift even when individual offsets remain below 100ms', () => {
    const result = measureOutputSynchronization([1, 10], [.92, 10.08], [{ time: 1, rms: .5 }, { time: 10, rms: .5 }]);
    assert.ok(result.syncEvents.every(e => Math.abs(e.offset) < .1));
    assert.match(result.failures.join(' '), /drift over 100ms/);
});
test('a late flash remains in drift diagnostics instead of disappearing from the sample set', () => {
    const result = measureOutputSynchronization([.15, 6, 10.5], [.169, 5.998, 10.632],
        [.185, 6.035, 10.535].map(time => ({ time, rms: .5 })), .05);
    assert.ok(Math.abs(result.syncEvents[2].offset - .097) < 1e-9);
    assert.ok(result.syncDriftSeconds > .13);
    assert.match(result.failures.join(' '), /drift over 100ms/);
});
