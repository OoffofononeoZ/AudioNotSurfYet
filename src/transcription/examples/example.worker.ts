/// <reference lib="webworker" />
import { buildAcousticIndex } from '../acousticIndex';
import { createStemAuditionSource } from '../../processing/stemAuditionSource';
import type { PcmReader } from '../../processing/dsp';
import { ProcessingError } from '../../processing/modelManifest';
import { ExampleRepository } from './repository';
import { searchSoundExamples } from './matcher';
import { queryIdentity } from './types';
import type { ExampleCommand, ExampleEvent } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const pending = new Map<number, { resolve: (data: Float32Array) => void; reject: (error: Error) => void }>();
let requestId = 0,
    active = '';
const post = (event: ExampleEvent) => scope.postMessage(event);
scope.onmessage = event => {
    const message = event.data as ExampleCommand;
    if (message?.type === 'pcm' && message.jobId === active) {
        const read = pending.get(message.requestId);
        if (!read) return;
        pending.delete(message.requestId);
        if (message.samples instanceof Float32Array) read.resolve(message.samples);
        else read.reject(new ProcessingError('pcm-incomplete', message.error ?? '原曲读取失败。'));
    } else if (message?.type === 'start' && !active) {
        active = message.jobId;
        void run(message);
    }
};
async function run(message: Extract<ExampleCommand, { type: 'start' }>) {
    const signal = new AbortController().signal,
        repository = new ExampleRepository(),
        started = performance.now(),
        source = message.source,
        progress = (phase: string, done: number, total: number) =>
            post({ type: 'progress', jobId: active, phase, done, total });
    let lease: Awaited<ReturnType<typeof createStemAuditionSource>> | undefined;
    try {
        progress('校验声学索引', 0, 1);
        let index = await repository.restoreIndex(source, signal);
        const indexRestored = !!index;
        if (!index) {
            let reader: PcmReader;
            if (source.kind === 'original')
                reader = {
                    frames: source.frames,
                    sampleRate: source.sampleRate,
                    channels: source.channels,
                    read(channel, start, length) {
                        return new Promise((resolve, reject) => {
                            const id = ++requestId;
                            pending.set(id, { resolve, reject });
                            post({ type: 'read', jobId: active, requestId: id, channel, start, length });
                        });
                    },
                };
            else {
                lease = await createStemAuditionSource(
                    {
                        kind: source.kind,
                        directory: source.directory!,
                        resultId: source.resultId!,
                        trackId: source.trackId,
                        label: source.label,
                        mutedRoles: [],
                        stems: [
                            {
                                role: source.role,
                                frames: source.frames,
                                sampleRate: source.sampleRate,
                                left: source.left!,
                                right: source.right!,
                            },
                        ],
                    },
                    signal,
                );
                reader = {
                    frames: source.frames,
                    sampleRate: source.sampleRate,
                    channels: 2,
                    read: (channel, start, length) => lease!.read(source.role, channel as 0 | 1, start, length, signal),
                };
            }
            index = await buildAcousticIndex(reader, signal, (_, done, total) =>
                progress('建立声学索引', done, total ?? 0),
            );
            await lease?.close();
            lease = undefined;
            progress('保存声学索引', 0, 1);
            await repository.publishIndex(source, index, signal, message.cacheLimit);
        }
        const result = await searchSoundExamples(index, message.profile, signal, progress);
        post({
            type: 'result',
            jobId: active,
            sourceKey: source.key,
            queryHash: queryIdentity(message.profile),
            result: { ...result, indexRestored, elapsedMs: performance.now() - started },
        });
    } catch (error) {
        post({
            type: 'error',
            jobId: active,
            code: error instanceof ProcessingError ? error.code : 'inference-failed',
            message: error instanceof Error ? error.message : '声音检索失败。',
        });
    } finally {
        await lease?.close();
        pending.clear();
    }
}
