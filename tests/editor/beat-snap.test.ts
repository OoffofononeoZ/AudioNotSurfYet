import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import {
    DEFAULT_BEAT_SNAP,
    customDivisors,
    divisorColour,
    divisorForIndex,
    validateBeatSnap,
} from '../../src/editor/beatSnap';
import { generateTempoGrid, snapEditorTime } from '../../src/editor/tempoMap';
import { pointCellAtTime, movePointCell } from '../../src/editor/pointAnnotations';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { EditorDraftRepository } from '../../src/editor/editorDraftRepository';

function project() {
    const value = createInitialEditorProject({
        track: { contentHash: 'b'.repeat(64), fileName: 'test.wav', durationSeconds: 30 },
    });
    value.tempoMap = [
        {
            id: 'first',
            startSeconds: 0,
            mode: 'metered',
            beatOriginSeconds: 0,
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        },
        {
            id: 'second',
            startSeconds: 1.4,
            mode: 'metered',
            beatOriginSeconds: 1.4,
            bpm: 100,
            bpmSource: 'user',
            meter: { numerator: 3, denominator: 8 },
        },
    ];
    return value;
}
test('ports osu preset factors and hierarchical colours, including custom off-preset ticks', () => {
    expect(customDivisors(12)).toEqual([1, 2, 3, 4, 6, 12]);
    expect([0, 1, 2, 4, 8].map(i => divisorColour(divisorForIndex(i, 8)))).toEqual([
        '#ffffff',
        '#ffcc22',
        '#66ccff',
        '#ed1121',
        '#ffffff',
    ]);
    expect(divisorColour(divisorForIndex(1, 3))).toBe('#8866ee');
    expect(divisorColour(divisorForIndex(1, 13))).toBe('#ff0000');
    expect(() => validateBeatSnap({ ...DEFAULT_BEAT_SNAP, divisor: 3 })).toThrow();
    expect(() => validateBeatSnap({ ...DEFAULT_BEAT_SNAP, preset: 'custom', divisor: 65 })).toThrow();
});
test('fixed subdivision survives zoom and point/tempo snapping clamps to the same tempo boundary', () => {
    const value = project();
    const setting = { ...DEFAULT_BEAT_SNAP, divisor: 1 };
    for (const width of [100, 1000]) {
        for (const viewport of [
            { startSeconds: 0, endSeconds: 30, zoom: 1 },
            { startSeconds: 0, endSeconds: 2, zoom: 15 },
        ]) {
            value.workspace.viewport = viewport;
            expect(pointCellAtTime(1.3, value, width, setting)?.timeSeconds).toBe(1.4);
            expect(snapEditorTime(1.3, value.tempoMap, viewport, width, 30, setting)).toBe(1.4);
        }
    }
    const triplet = { ...DEFAULT_BEAT_SNAP, preset: 'triplets' as const, divisor: 6 };
    expect(movePointCell(0.5, 1, value, 1000, triplet)?.timeSeconds).toBe(0.583333);
    expect(
        generateTempoGrid(value.tempoMap, 30, { startSeconds: 0, endSeconds: 1, zoom: 30 }, triplet, 1000),
    ).toContainEqual(expect.objectContaining({ timeSeconds: 0.083333, divisor: 6, kind: 'subdivision' }));
});
test('song-specific preferences preserve custom maximum independently of selected divisor', async () => {
    const repository = new EditorDraftRepository({ indexedDB, databaseName: `snap-${crypto.randomUUID()}` });
    const setting = { preset: 'custom' as const, divisor: 3, customDivisor: 12 };
    await repository.setBeatSnap('song-a', setting);
    expect(await repository.getBeatSnap('song-a')).toEqual(setting);
    expect(await repository.getBeatSnap('song-b')).toBeNull();
    repository.close();
});
