import { expect, it, vi } from 'vitest';
import { ExampleController } from '../../src/transcription/examples/controller';
import type { ExampleWorkerPort } from '../../src/transcription/examples/controller';
import type { ExampleCommand, ExampleEvent } from '../../src/transcription/examples/protocol';
import { queryIdentity } from '../../src/transcription/examples/types';
import type { ExampleProfile, ExampleSource } from '../../src/transcription/examples/types';

function setup() {
    let descriptor = {
        trackId: 'song',
        revision: 1,
        sampleRate: 44100,
        length: 44100,
        channelCount: 2,
        durationSeconds: 1,
    };
    const source: ExampleSource = {
        key: 'b'.repeat(64),
        songHash: 'a'.repeat(64),
        trackId: 'song',
        kind: 'original',
        role: 'original',
        label: '原曲',
        frames: 44100,
        sampleRate: 44100,
        channels: 2,
        descriptor,
    };
    const profile: ExampleProfile = {
        version: 1,
        id: '12345678-1234-1234-1234-123456789abc',
        songHash: source.songHash,
        sourceKey: source.key,
        durationSeconds: 1,
        label: '声音',
        examples: [],
        threshold: 0.8,
        negativeMargin: 0.04,
        matches: [],
        queryHash: null,
    };
    const worker: ExampleWorkerPort = { onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() },
        copied = vi.fn(({ length }: { length: number }) => new Float32Array(length)),
        controller = new ExampleController(
            { getDecodedAudioDescriptor: () => descriptor, copyDecodedChannelRange: copied },
            () => worker,
        ),
        signal = new AbortController();
    const operation = controller.search(source, profile, 1e9, signal.signal, vi.fn());
    const start = vi.mocked(worker.postMessage).mock.calls[0]![0] as Extract<ExampleCommand, { type: 'start' }>;
    return {
        worker,
        controller,
        signal,
        operation,
        source,
        profile,
        copied,
        stale: () => {
            descriptor = { ...descriptor, revision: 2 };
        },
        send: (event: Omit<ExampleEvent, 'jobId'>) =>
            worker.onmessage?.({ data: { ...event, jobId: start.jobId } } as MessageEvent<ExampleEvent>),
    };
}
it('copies only bounded requested PCM and terminates on cancelled queries, ignoring late results', async () => {
    const f = setup();
    f.send({ type: 'read', requestId: 1, channel: 1, start: 10, length: 100 } as Omit<ExampleEvent, 'jobId'>);
    expect(f.copied).toHaveBeenCalledWith({ revision: 1, channel: 1, start: 10, length: 100 });
    expect(vi.mocked(f.worker.postMessage).mock.calls[1]![1]).toHaveLength(1);
    f.signal.abort();
    await expect(f.operation).rejects.toThrow('取消');
    expect(f.worker.terminate).toHaveBeenCalledOnce();
    expect(f.worker.onmessage).toBeNull();
});
it('rejects changed decoding and never copies stale audio', async () => {
    const f = setup();
    f.stale();
    f.send({ type: 'read', requestId: 1, channel: 0, start: 0, length: 10 } as Omit<ExampleEvent, 'jobId'>);
    await expect(f.operation).rejects.toThrow('改变');
    expect(f.copied).not.toHaveBeenCalled();
});
it('rejects result identity mismatch and accepts a validated current query', async () => {
    const f = setup();
    f.send({
        type: 'result',
        sourceKey: 'c'.repeat(64),
        queryHash: queryIdentity(f.profile),
        result: { matches: [], coarseCandidates: 0, refinedCandidates: 0, elapsedMs: 1, indexRestored: false },
    } as Omit<ExampleEvent, 'jobId'>);
    await expect(f.operation).rejects.toThrow('旧来源');
    const good = setup();
    good.send({
        type: 'result',
        sourceKey: good.source.key,
        queryHash: queryIdentity(good.profile),
        result: { matches: [], coarseCandidates: 0, refinedCandidates: 0, elapsedMs: 1, indexRestored: true },
    } as Omit<ExampleEvent, 'jobId'>);
    expect((await good.operation).indexRestored).toBe(true);
    expect(good.worker.terminate).toHaveBeenCalledOnce();
});
