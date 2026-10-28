import { expect, test } from 'vitest';
import { resourcePack } from '../support/visualizer-assets.mjs';
import { createTestAlgorithm } from './algorithm-runtime-fixture';
import { validateDrawPacket } from '../../src/visualizer/drawPacket';
import type { AlgorithmFrame, DrawPacket } from '../../src/visualizer/algorithmTypes';

const pack = resourcePack('elements/circular-depth-lyrics'),
    algorithm = pack.algorithms[0];
const spectrum = (time: number) => [Math.floor(time * 17) % 3 === 0 ? 0 : 3, ...Array(127).fill(0)];
function frame(time: number, reverse = false): AlgorithmFrame {
    return {
        time,
        mode: 'timeline',
        seed: 123,
        revision: 'same',
        width: 1920,
        height: 1080,
        range: { startSeconds: 0, endSeconds: 15 },
        parameters: {
            ...Object.fromEntries(pack.elements[0].parameters.map((p: any) => [p.id, { value: p.defaultValue }])),
            responsiveness: { value: 100 },
            noise: { value: false },
            normalize: { value: false },
            spectrum: { value: spectrum(time) },
            reverse: { value: reverse },
        },
        lyrics: {
            lyrics: {
                available: true,
                revision: 'file',
                leadSeconds: 2,
                tailSeconds: 1.5,
                cues: [0, 1].map(index => ({
                    index,
                    time: 3.125 + index * 4,
                    end: 7.125 + index * 4,
                    tokens: [0, 1, 2].map(i => ({
                        index: i,
                        text: ['Hello', 'longword', 'again'][i]!,
                        time: 3.125 + index * 4 + (i * 4) / 3,
                        width: i === 1 ? 1600 : 160,
                        height: 88,
                        uv: [0, 0, 0.2, 0.1],
                        page: i === 1 ? 1 : 0,
                    })),
                })),
            },
        },
    };
}
const history = (time: number) => ({
    history: async ({ startTick, endTick }: any) => {
        expect(endTick).toBeLessThanOrEqual(Math.floor(time * 60 + 1e-8));
        return Array.from({ length: endTick - startTick }, (_, i) => ({
            time: (startTick + i) / 60,
            value: spectrum((startTick + i) / 60),
        }));
    },
});
function rows(packet: DrawPacket) {
    const result: number[][] = [];
    for (let i = 2; i < (packet.state?.length ?? 0); i += 6) result.push(packet.state!.slice(i, i + 6));
    return result;
}

test.each([false, true])('lyric first tokens reach both exact millisecond anchors, reverse=%s', async reverse => {
    const runtime = await createTestAlgorithm(algorithm);
    for (const index of [0, 1]) {
        const time = 3.125 + index * 4,
            f = frame(time, reverse);
        const packet = validateDrawPacket(await runtime.prepareFrame(f, history(time) as any), algorithm);
        const row = rows(packet).find(r => r[0] === index && r[1] === 0)!;
        expect(row[2]).toBe(index ? 0.75 : 0.25);
        expect(row[3]).toBeGreaterThan(0.24);
        expect(row[3]).toBeLessThan(0.76);
        expect(row[4]).toBe(1);
        expect(row[5]).toBe(1);
    }
});

test.each([false, true])(
    'abrupt bass changes preserve monotonic motion and first-word order, reverse=%s',
    async reverse => {
        const runtime = await createTestAlgorithm(algorithm),
            seen = new Set<string>(),
            distances = new Map<string, number>();
        for (let tick = 0; tick <= 1200; tick++) {
            const time = tick / 120;
            const packet = validateDrawPacket(
                await runtime.prepareFrame(frame(time, reverse), history(time) as any),
                algorithm,
            );
            expect(Math.abs(packet.state![1]!)).toBeLessThanOrEqual(0.5);
            for (const row of rows(packet)) {
                const [cue, word, x] = row as [number, number, number];
                const key = cue + ':' + word,
                    distance = Math.abs(x - 0.5),
                    previous = distances.get(key);
                if (previous !== undefined) {
                    if (reverse) expect(distance).toBeLessThanOrEqual(previous + 1e-10);
                    else expect(distance).toBeGreaterThanOrEqual(previous - 1e-10);
                }
                if (word > 0) expect(seen.has(cue + ':' + (word - 1))).toBe(true);
                seen.add(key);
                distances.set(key, distance);
            }
        }
        expect(seen.has('0:0') && seen.has('1:0') && seen.has('1:1')).toBe(true);
    },
);

test('lyric motion survives cadence, seeks, changes and resize; unbound input needs no history', async () => {
    const a = await createTestAlgorithm(algorithm),
        b = await createTestAlgorithm(algorithm);
    expect(await a.prepareFrame({ ...frame(1), lyrics: undefined }, {} as any)).toEqual({ passes: [] });
    for (let tick = 0; tick <= 180; tick++) {
        const time = tick / 60;
        const current = await a.prepareFrame(frame(time), history(time) as any);
        if (tick % 2 === 0) expect(current).toEqual(await b.prepareFrame(frame(time), history(time) as any));
    }
    const expected = await a.prepareFrame(frame(7.125, true), history(7.125) as any);
    await a.prepareFrame(frame(0.5, true), history(0.5) as any);
    expect(await a.prepareFrame(frame(7.125, true), history(7.125) as any)).toEqual(expected);
    expect(await a.prepareFrame({ ...frame(7.125, true), width: 1280, height: 720 }, history(7.125) as any)).toEqual(
        expected,
    );
    const changed = frame(7.125, true);
    changed.parameters.responsiveness = { value: 30 };
    const fresh = await createTestAlgorithm(algorithm);
    expect(await a.prepareFrame(changed, history(7.125) as any)).toEqual(
        await fresh.prepareFrame(changed, history(7.125) as any),
    );
});
