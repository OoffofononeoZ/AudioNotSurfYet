import { expect, test } from 'vitest';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { DEFAULT_BEAT_SNAP } from '../../src/editor/beatSnap';
import { createMarkerGridOffset } from '../../src/editor/markerGridOffset';
const project = () => {
    const p = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'grid.wav', durationSeconds: 8, sampleRate: 48000 },
    });
    p.tempoMap = [
        {
            id: 'fast',
            startSeconds: 0,
            mode: 'metered',
            beatOriginSeconds: 0,
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        {
            id: 'slow',
            startSeconds: 2,
            mode: 'metered',
            beatOriginSeconds: 2,
            bpm: 60,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
    ];
    return p;
};
test('counts adjacent cells across BPM boundaries without skipping or double-counting', () => {
    const grid = createMarkerGridOffset(project(), DEFAULT_BEAT_SNAP);
    expect(grid.shift(1.875, 2)).toBe(2.25);
    expect(grid.shift(2.25, -2)).toBe(1.875);
    expect(grid.shift(2, -1)).toBe(1.875);
    expect(grid.shift(2, 1)).toBe(2.25);
    expect(grid.shift(0.123, 0)).toBe(0.123);
    expect(grid.shift(0.123, 1)).toBe(0.25);
    expect(() => grid.shift(0, -1)).toThrow(/歌曲范围/);
    expect(() => grid.shift(8, 1)).toThrow(/歌曲范围/);
    expect(() => grid.shift(1, Number.MAX_SAFE_INTEGER)).toThrow(/歌曲范围/);
});
test('respects imported phase, clipped boundaries, triplets and custom subdivision', () => {
    const p = project();
    p.tempoMap = [{ ...p.tempoMap[0]!, beatOriginSeconds: -0.1 } as (typeof p.tempoMap)[0]];
    const grid = createMarkerGridOffset(p, DEFAULT_BEAT_SNAP);
    expect(grid.shift(0, 1)).toBe(0.025);
    expect(grid.shift(0.025, -1)).toBe(0);
    expect(grid.shift(8, -1)).toBe(7.9);
    for (const divisor of [3, 5, 64]) {
        const g = createMarkerGridOffset(p, { preset: 'custom', divisor, customDivisor: divisor });
        expect(g.shift(g.shift(1.4, 10), -10)).toBeCloseTo(g.shift(1.4, 1) - 0.5 / divisor, 5);
    }
});
test('single-beat intervals count once and unavailable BPM blocks travel in either direction', () => {
    const p = project();
    p.tempoMap = [
        p.tempoMap[0]!,
        { id: 'single', startSeconds: 2, mode: 'single-beat' },
        { ...p.tempoMap[1]!, id: 'after', startSeconds: 4 },
    ];
    let grid = createMarkerGridOffset(p, DEFAULT_BEAT_SNAP);
    expect(grid.shift(2, 1)).toBe(4);
    expect(grid.shift(4, -1)).toBe(2);
    expect(grid.shift(1.875, 3)).toBe(4.25);
    p.tempoMap[1] = { ...p.tempoMap[0]!, id: 'missing', startSeconds: 2, bpm: null } as (typeof p.tempoMap)[0];
    grid = createMarkerGridOffset(p, DEFAULT_BEAT_SNAP);
    expect(grid.shift(1.875, 1)).toBe(2);
    expect(grid.shift(2, -1)).toBe(1.875);
    expect(() => grid.shift(2, 1)).toThrow(/没有可用网格/);
    expect(() => grid.shift(1.875, 2)).toThrow(/没有可用网格/);
    expect(() => grid.shift(4, -1)).toThrow(/没有可用网格/);
    expect(() => grid.shift(3, 1)).toThrow(/没有可用网格/);
});
test('large offsets use virtual indices rather than building millions of grid cells', () => {
    const p = project();
    p.track.durationSeconds = 3600;
    p.tempoMap = [{ ...p.tempoMap[0]!, bpm: 1200 } as (typeof p.tempoMap)[0]];
    const grid = createMarkerGridOffset(p, { preset: 'custom', divisor: 64, customDivisor: 64 });
    expect(grid.shift(0, 4_608_000)).toBe(3600);
    expect(grid.shift(3600, -4_608_000)).toBe(0);
    expect(() => grid.shift(0, 4_608_001)).toThrow();
});
