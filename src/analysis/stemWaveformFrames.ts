import { analysisFrameCount, cursorFrameIndex } from './frames';
import { StemPcmReader } from './stemPcmReader';
import type { StemPcmSource } from './stemProtocol';

const WINDOW = Float32Array.from({ length: 1024 }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 1023));
/** Sixteen exact frames and one bounded PCM chunk, including arbitrary historical reads. */
export class StemWaveformFrames {
    private source: StemPcmSource;
    private reader: StemPcmReader;
    private frames = new Map<number, readonly number[]>();
    private pending = new Map<number, Promise<void>>();
    private queue = Promise.resolve();
    constructor(source: StemPcmSource, cancelled: () => boolean) {
        this.source = source;
        this.reader = new StemPcmReader(source, cancelled);
    }
    private index(time: number) {
        return cursorFrameIndex(
            time,
            this.source.frames / 44100,
            analysisFrameCount(this.source.frames),
            this.source.config,
        );
    }
    read(time: number) {
        return this.frames.get(this.index(time)) ?? null;
    }
    prepare(time: number): Promise<void> {
        const index = this.index(time);
        if (this.frames.has(index)) return Promise.resolve();
        const existing = this.pending.get(index);
        if (existing) return existing;
        const operation = this.queue
            .catch(() => {})
            .then(async () => {
                this.reader.check();
                const mono = await this.reader.mono(index * 512, 1024);
                this.reader.check();
                this.frames.set(
                    index,
                    Array.from(mono, (value, i) => value * WINDOW[i]!),
                );
                if (this.frames.size > 16) this.frames.delete(this.frames.keys().next().value!);
            });
        this.pending.set(index, operation);
        this.queue = operation;
        void operation.finally(() => this.pending.delete(index)).catch(() => {});
        return operation;
    }
}
