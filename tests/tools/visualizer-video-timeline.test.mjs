import assert from 'node:assert/strict';
import test from 'node:test';
import { measureOfflineVideoTimeline } from '../support/visualizer-video-timeline.mjs';

test('offline frames use indexed times including a partial final frame', () => {
    const times = Array.from({ length: 11 }, (_, i) => Math.round(i * 1000 / 30) / 1000);
    assert.deepEqual(measureOfflineVideoTimeline(times, .35, 30).failures, []);
    assert.equal(measureOfflineVideoTimeline(times, .35, 30).decodedFrames, 11);
});
test('offline frames reject omissions, duplicated timestamps and a common late shift', () => {
    const times = Array.from({ length: 60 }, (_, i) => Math.round(i * 1000 / 60) / 1000);
    assert.match(measureOfflineVideoTimeline(times.slice(1), 1, 60).failures.join(' '), /frame count/);
    assert.match(measureOfflineVideoTimeline(times.map((t, i) => i === 10 ? times[9] : t), 1, 60).failures.join(' '), /frame 10/);
    assert.match(measureOfflineVideoTimeline(times.map(t => t + .12), 1, 60).failures.join(' '), /frame 0/);
    assert.throws(() => measureOfflineVideoTimeline([], 1, 0), /Invalid/);
    assert.throws(() => measureOfflineVideoTimeline([], Infinity, 30), /Invalid/);
});
