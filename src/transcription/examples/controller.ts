import { checkCancelled, ProcessingError } from '../../processing/modelManifest';
import type { ExampleProfile, ExampleSearchResult, ExampleSource } from './types';
import { queryIdentity, validateExampleProfile } from './types';
import type { ExampleCommand, ExampleEvent } from './protocol';
import type { DecodedAudioCopyPort } from '../../analysis/pcm';

export interface ExampleWorkerPort {
    onmessage: ((event: MessageEvent<ExampleEvent>) => void) | null;
    onerror: ((event: ErrorEvent) => void) | null;
    postMessage(message: ExampleCommand, transfer?: Transferable[]): void;
    terminate(): void;
}
export class ExampleController {
    private abort: (() => void) | null = null;
    private readonly decoded: DecodedAudioCopyPort;
    private readonly factory: () => ExampleWorkerPort;
    constructor(
        decoded: DecodedAudioCopyPort,
        factory: () => ExampleWorkerPort = () =>
            new Worker(new URL('./example.worker.ts', import.meta.url), { type: 'module' }),
    ) {
        this.decoded = decoded;
        this.factory = factory;
    }
    search(
        source: ExampleSource,
        profile: ExampleProfile,
        cacheLimit: number,
        signal: AbortSignal,
        progress: (event: Extract<ExampleEvent, { type: 'progress' }>) => void,
    ): Promise<ExampleSearchResult> {
        if (this.abort) throw new ProcessingError('processing-busy', '声音检索尚未结束。');
        checkCancelled(signal);
        validateExampleProfile(profile);
        const worker = this.factory(),
            jobId = crypto.randomUUID(),
            expectedQuery = queryIdentity(profile);
        return new Promise((resolve, reject) => {
            let ended = false;
            const finish = (error?: Error, result?: ExampleSearchResult) => {
                    if (ended) return;
                    ended = true;
                    worker.onmessage = null;
                    worker.onerror = null;
                    worker.terminate();
                    signal.removeEventListener('abort', abort);
                    this.abort = null;
                    if (error) reject(error);
                    else resolve(result!);
                },
                abort = () => finish(new ProcessingError('job-cancelled', '声音检索已取消。'));
            this.abort = abort;
            signal.addEventListener('abort', abort, { once: true });
            worker.onerror = () => finish(new ProcessingError('worker-unavailable', '声音检索 Worker 无法继续。'));
            worker.onmessage = event => {
                const message = event.data;
                if (ended || !message || message.jobId !== jobId) return;
                if (message.type === 'read') {
                    try {
                        checkCancelled(signal);
                        const d = source.descriptor,
                            current = this.decoded.getDecodedAudioDescriptor();
                        if (
                            source.kind !== 'original' ||
                            !d ||
                            JSON.stringify(current) !== JSON.stringify(d) ||
                            !Number.isSafeInteger(message.channel) ||
                            message.channel < 0 ||
                            message.channel >= d.channelCount ||
                            !Number.isSafeInteger(message.start) ||
                            message.start < 0 ||
                            !Number.isSafeInteger(message.length) ||
                            message.length <= 0 ||
                            message.length > d.sampleRate * 4 ||
                            message.start + message.length > d.length
                        )
                            throw new ProcessingError('source-identity-mismatch', '原曲已改变或读取请求超出范围。');
                        const samples = this.decoded.copyDecodedChannelRange({
                            revision: d.revision,
                            channel: message.channel,
                            start: message.start,
                            length: message.length,
                        });
                        if (!samples || samples.length !== message.length)
                            throw new ProcessingError('pcm-incomplete', '原曲 PCM 不完整。');
                        worker.postMessage({ type: 'pcm', jobId, requestId: message.requestId, samples }, [
                            samples.buffer as ArrayBuffer,
                        ]);
                    } catch (error) {
                        finish(error instanceof Error ? error : Error(String(error)));
                    }
                } else if (message.type === 'progress') progress(message);
                else if (message.type === 'error') finish(new ProcessingError(message.code, message.message));
                else if (message.type === 'result') {
                    try {
                        if (message.sourceKey !== source.key || message.queryHash !== expectedQuery)
                            throw new ProcessingError('source-identity-mismatch', '声音检索返回了旧来源结果。');
                        validateExampleProfile({
                            ...profile,
                            matches: message.result.matches,
                            queryHash: expectedQuery,
                        });
                        finish(undefined, message.result);
                    } catch (error) {
                        finish(error instanceof Error ? error : Error(String(error)));
                    }
                }
            };
            try {
                worker.postMessage({ type: 'start', jobId, source, profile, cacheLimit });
            } catch (error) {
                finish(error instanceof Error ? error : Error(String(error)));
            }
            if (signal.aborted) abort();
        });
    }
    cancel(): void {
        this.abort?.();
    }
}
