import assert from 'node:assert/strict';
import test from 'node:test';
import { measureOutputSynchronization } from '../support/visualizer-media-alignment.mjs';
import { measureAudioPcm, parseAudioTimeline } from '../support/visualizer-audio-timeline.mjs';

test('PCM windows retain PTS holes and cannot silently invent an audio timeline', () => {
    const log = '[Parsed_ashowinfo_0] n:0 pts:0 pts_time:0 fmt:flt rate:48000 nb_samples:480\n'
        + '[Parsed_ashowinfo_0] n:1 pts:5280 pts_time:0.11 fmt:flt rate:48000 nb_samples:480';
    const frames = parseAudioTimeline(log), pcm = Buffer.alloc(960 * 4);
    for (let i = 0; i < 960; i++) pcm.writeFloatLE(.5, i * 4);
    const result = measureAudioPcm(pcm, frames);
    assert.deepEqual(result.windows.map(w => w.time), [.005, .115]);
    assert.deepEqual(result.windows.map(w => w.sampleTime), [.005, .015]);
    assert.equal(result.rms, .5);
    assert.throws(() => parseAudioTimeline(''), /Missing/);
    assert.throws(() => parseAudioTimeline(log.replace('pts_time:0.11', 'pts_time:NOPTS')), /Invalid/);
    assert.throws(() => measureAudioPcm(pcm.subarray(4), frames), /differ/);
});

test('common audio/video delay is a source-time failure rather than relative A/V drift', () => {
    const result = measureOutputSynchronization([1, 10], [1, 10.15], [
        { time: 1.025, sampleTime: 1.025, rms: .5 },
        { time: 10.175, sampleTime: 10.025, rms: .5 },
    ], .05);
    assert.ok(result.syncDriftSeconds < 1e-9);
    assert.match(result.failures.join(' '), /shifted flash/);
    assert.match(result.failures.join(' '), /shifted audio/);
    assert.doesNotMatch(result.failures.join(' '), /A\/V event (delta|drift)/);
});

test('one flash cannot satisfy two expected source events', () => {
    const result = measureOutputSynchronization([1, 1.05], [1.02], [
        { time: 1, sampleTime: 1, rms: .5 }, { time: 1.05, sampleTime: 1.05, rms: .5 },
    ]);
    assert.equal(result.syncEvents[1].flashTime, null);
});

test('alignment follows song timestamps across a missing interval rather than counting frames', () => {
    const result = measureOutputSynchronization([.15, 1.5, 6, 10.5], [.167, 1.533, 6.017, 10.533],
        [.175, 1.525, 6.025, 10.525].map(time => ({ time, sampleTime: time, rms: .5 })), .05);
    assert.deepEqual(result.failures, []);
    assert.ok(result.syncDriftSeconds < .03);
});
test('alignment rejects a missing event, silent event and an absolute time shift', () => {
    assert.match(measureOutputSynchronization([1.5], [], [{ time: 1.525, sampleTime: 1.525, rms: .5 }], .05).failures.join(' '), /Missing or shifted flash/);
    assert.match(measureOutputSynchronization([1.5], [1.5], [{ time: 1.525, sampleTime: 1.525, rms: .02 }], .05).failures.join(' '), /Missing or shifted audio/);
    assert.ok(measureOutputSynchronization([1.5], [2], [{ time: 2.025, sampleTime: 2.025, rms: .5 }], .05).failures.length > 0);
});
test('alignment rejects cumulative drift even when individual offsets remain below 100ms', () => {
    const result = measureOutputSynchronization([1, 10], [.92, 10.08], [{ time: 1, sampleTime: 1, rms: .5 }, { time: 10, sampleTime: 10, rms: .5 }]);
    assert.ok(result.syncEvents.every(e => Math.abs(e.offset) < .1));
    assert.match(result.failures.join(' '), /drift over 100ms/);
});
test('a late flash remains in drift diagnostics instead of disappearing from the sample set', () => {
    const result = measureOutputSynchronization([.15, 6, 10.5], [.169, 5.998, 10.632],
        [.185, 6.035, 10.535].map(time => ({ time, sampleTime: time, rms: .5 })), .05);
    assert.ok(Math.abs(result.syncEvents[2].offset - .097) < 1e-9);
    assert.ok(result.syncDriftSeconds > .13);
    assert.match(result.failures.join(' '), /drift over 100ms/);
});
