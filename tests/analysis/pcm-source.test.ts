import { expect, test, vi } from 'vitest';
import { AnalysisPcmSource } from '../../src/analysis/pcmSource';
import { createAnalysisConfig } from '../../src/analysis/config';
import type { AnalysisWorkerRequest } from '../../src/analysis/types';

test('shares preparation, ignores late acknowledgements and rejects invalidated requests', async () => {
    const source = new AnalysisPcmSource(),
        config = await createAnalysisConfig(48000);
    const engine = {
        getDecodedAudioDescriptor: () => ({
            trackId: 'song',
            revision: 1,
            sampleRate: 48000,
            length: 1024,
            channelCount: 1,
            durationSeconds: 1024 / 48000,
        }),
        copyDecodedChannelRange: vi.fn(() => new Float32Array(1024)),
    };
    const messages: AnalysisWorkerRequest[] = [];
    const post = (message: AnalysisWorkerRequest) => {
        messages.push(message);
    };
    const first = source.prepare('one', config, 'hash', engine, post);
    const shared = source.prepare('one', config, 'hash', engine, post);
    await vi.waitFor(() => expect(messages).toHaveLength(1));
    source.acknowledge('old');
    expect(source.ready).toBe(false);
    source.acknowledge('one');
    await Promise.all([first, shared]);
    await source.prepare('one', config, 'hash', engine, post);
    expect(engine.copyDecodedChannelRange).toHaveBeenCalledTimes(1);
    const pending = source.prepare('two', config, 'hash', engine, post);
    const rejected = expect(pending).rejects.toMatchObject({ code: 'stale' });
    source.clear();
    source.acknowledge('two');
    await rejected;
    expect(source.ready).toBe(false);
});
