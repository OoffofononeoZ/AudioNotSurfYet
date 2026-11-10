import { describe, expect, it, vi } from 'vitest';
import { DrumBatchModel, repeatedDrumEvent } from '../../src/transcription/drumBatchModel';
import type { DrumSessions } from '../../src/transcription/drumRuntime';

describe('batched drum sequence lifecycle', () => {
    it('only detects a repeated complete identical event, not simultaneous distinct drums', () => {
        expect(repeatedDrumEvent([2, ...Array(4).fill([14, 336, 500]).flat()])).toBe(true);
        expect(repeatedDrumEvent([2, 14, 336, 500, 14, 338, 500, 14, 336, 500, 14, 338, 500])).toBe(false);
        expect(repeatedDrumEvent([2, 14, 336, 500, 15, 336, 500, 16, 336, 500, 17, 336, 500])).toBe(false);
    });
    it('pads finished rows without extending their recorded token sequence and releases tensors on cancellation', async () => {
        const disposals = vi.fn(),
            release = vi.fn(async () => {}),
            abort = new AbortController();
        class Tensor {
            type: string;
            data: Float32Array | BigInt64Array;
            dims: number[];
            constructor(type: string, data: Float32Array | BigInt64Array, dims: number[]) {
                this.type = type;
                this.data = data;
                this.dims = dims;
            }
            dispose() {
                disposals();
            }
        }
        const cross = Array.from({ length: 4 }, (_, i) => [`cross_k${i}`, `cross_v${i}`]).flat();
        let step = 0;
        const sessions = {
            backend: 'webgpu',
            adapter: null,
            setupMs: 0,
            ort: { Tensor },
            encoder: {
                inputNames: ['logmel'],
                outputNames: cross,
                release,
                run: vi.fn(async () =>
                    Object.fromEntries(
                        cross.map(name => [name, new Tensor('float32', new Float32Array(1), [2, 6, 246, 128])]),
                    ),
                ),
            },
            decoder: {
                inputNames: ['tokens', ...cross],
                outputNames: ['logits'],
                release,
                run: vi.fn(async () => {
                    const logits = new Float32Array(2800).fill(-100);
                    logits[3] = 1;
                    logits[1400 + [14, 336, 500, 3][step++]!] = 1;
                    return { logits: new Tensor('float32', logits, [2, 1400]) };
                }),
            },
        } as unknown as DrumSessions;
        const model = new DrumBatchModel(sessions),
            pcm = new Float32Array(61440);
        const rows = await model.inferBatch(
            [
                { pcm, inputStartSeconds: 0 },
                { pcm, inputStartSeconds: 2.56 },
            ],
            8,
            abort.signal,
            () => {},
        );
        expect(rows[0]!.diagnostic.tokens).toEqual([2, 3]);
        expect(rows[1]!.diagnostic.tokens).toEqual([2, 14, 336, 500, 3]);
        expect(rows[1]!.hits).toHaveLength(1);
        expect(disposals).toHaveBeenCalledTimes(17); // input + 8 cross + 4 prefixes + 4 logits
        const run = sessions.decoder.run;
        sessions.decoder.run = async feeds => {
            const outputs = await run(feeds);
            abort.abort();
            return outputs;
        };
        await expect(
            model.inferBatch(
                [
                    { pcm, inputStartSeconds: 0 },
                    { pcm, inputStartSeconds: 2.56 },
                ],
                8,
                abort.signal,
                () => {},
            ),
        ).rejects.toMatchObject({ code: 'job-cancelled' });
        expect(disposals).toHaveBeenCalledTimes(28); // also releases the in-flight batch's input/cross/prefix/logits
        await model.dispose();
        expect(release).toHaveBeenCalledTimes(2);
    });
});
