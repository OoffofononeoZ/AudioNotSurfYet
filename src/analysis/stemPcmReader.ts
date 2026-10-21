import type { StemPcmSource } from './stemProtocol';

/** One bounded stereo chunk per source. Files are immutable verified snapshots. */
export class StemPcmReader {
    private start = -1;
    private channels: readonly [Float32Array, Float32Array] = [new Float32Array(), new Float32Array()];
    readonly source: StemPcmSource;
    private cancelled: () => boolean;
    constructor(source: StemPcmSource, cancelled: () => boolean) {
        this.source = source;
        this.cancelled = cancelled;
    }
    check() {
        if (this.cancelled()) throw Error('分轨分析已取消。');
    }
    async stereo(start: number, length: number): Promise<readonly [Float32Array, Float32Array]> {
        this.check();
        if (start < this.start || start + length > this.start + this.channels[0].length) {
            this.start = start;
            const end = Math.min(this.source.frames, start + Math.max(65536, length));
            this.channels = (await Promise.all(
                [this.source.left, this.source.right].map(
                    async file => new Float32Array(await file.slice(start * 4, end * 4).arrayBuffer()),
                ),
            )) as [Float32Array, Float32Array];
            this.check();
            if (this.channels.some(c => c.length !== end - start)) throw Error('分轨 PCM 不完整。');
        }
        const offset = start - this.start;
        return this.channels.map(c => c.subarray(offset, offset + length)) as unknown as readonly [
            Float32Array,
            Float32Array,
        ];
    }
    async mono(start: number, length: number): Promise<Float32Array> {
        const [left, right] = await this.stereo(start, length),
            result = new Float32Array(length);
        for (let i = 0; i < length; i++) {
            const value = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
            if (!Number.isFinite(value)) throw Error('分轨包含无效 PCM。');
            result[i] = value;
        }
        return result;
    }
}
