import { expect, test } from 'vitest';
import { AnalysisWindowRequests } from '../../src/analysis/windowRequests';
import type { AnalysisWorkerRequest } from '../../src/analysis/types';
import type { AnalysisWindowRequest } from '../../src/analysis/windowTypes';

const input: AnalysisWindowRequest = {
    kind: 'window-series',
    requestId: 'one',
    featureId: 'rms',
    trackHash: 'track',
    configHash: 'config',
    generation: 1,
    startSeconds: 1,
    endSeconds: 2,
    waveformBucketSamples: 1,
};

test('failed Worker cancellation still settles every pending request', async () => {
    const requests = new AnalysisWindowRequests(message => {
        if (message.kind === 'cancel-window') throw Error('Worker unavailable');
    });
    const abort = new AbortController();
    const first = requests.request(input, abort.signal);
    abort.abort();
    expect(await first).toBeNull();
    const second = requests.request({ ...input, requestId: 'two' });
    requests.clear();
    expect(await second).toBeNull();
});
test('window replies require matching identities; abort and lease cancellation resolve pending requests', async () => {
    const messages: AnalysisWorkerRequest[] = [],
        requests = new AnalysisWindowRequests(message => messages.push(message));
    const abort = new AbortController(),
        one = requests.request(input, abort.signal);
    requests.handle({ ...input, kind: 'window-series-result', generation: 2, series: null });
    abort.abort();
    expect(await one).toBeNull();
    const two = requests.request({ ...input, requestId: 'two' });
    requests.clear();
    expect(await two).toBeNull();
    expect(messages.filter(m => m.kind === 'cancel-window').map(m => m.requestId)).toEqual(['one', 'two']);
});
test('malformed display payloads are isolated and a valid nonzero time origin is accepted', async () => {
    const requests = new AnalysisWindowRequests(() => {});
    const series = {
        schemaVersion: 1 as const,
        trackHash: 'track',
        configHash: 'config',
        featureId: 'rms' as const,
        startTimeSeconds: 1,
        endTimeSeconds: 2,
        sampleStepSeconds: 0.5,
        sampleCount: 2,
        dimensions: [],
        payload: { kind: 'scalar-f32' as const, values: new Float32Array([1, 2]) },
    };
    const good = requests.request(input);
    requests.handle({ ...input, kind: 'window-series-result', series });
    expect(await good).toEqual(series);
    const bad = requests.request(input);
    requests.handle({
        ...input,
        kind: 'window-series-result',
        series: { ...series, payload: { ...series.payload, values: new Float32Array([1]) } },
    });
    expect(await bad).toBeNull();
});
