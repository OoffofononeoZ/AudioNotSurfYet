import { describe, expect, test } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { parseOsu } from '../../src/editor/osu/parseOsu';
import { osuTempoMap } from '../../src/editor/osu/osuTiming';
import { applyOsuBeatmap, defaultOsuTempoReplacement } from '../../src/editor/osu/osuMarkers';
import { normalizeOsuPath, openOsuArchive } from '../../src/editor/osu/osuArchive';
import { DEFAULT_OSU_IMPORT_OPTIONS } from '../../src/editor/osu/osuTypes';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { osuFixture } from '../support/osu-fixture';

function project() {
    let id = 0;
    return createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'audio.wav', durationSeconds: 5 },
        createId: () => `initial-${++id}`,
        now: () => new Date('2026-10-21T00:00:00Z'),
    });
}
const options = { ...DEFAULT_OSU_IMPORT_OPTIONS, replaceTempo: true };

describe('osu v14 conversion', () => {
    test('recognizes type bit flags and computes repeated slider duration with effective SV', () => {
        const map = parseOsu('\uFEFF' + osuFixture());
        expect(map.objects.map(o => [o.kind, o.timeMs, o.endTimeMs])).toEqual([
            ['circle', 500, 500],
            ['slider', 1100, 1600],
            ['spinner', 2000, 2500],
        ]);
        let n = 0;
        expect(osuTempoMap(map.timingPoints, 5, () => `tempo-${++n}`)).toMatchObject([
            { startSeconds: 0, beatOriginSeconds: -1, bpm: 120, meter: { numerator: 4, denominator: 4 } },
        ]);
    });
    test('red points reset SV, green points at the same time override it, and equal BPM may reset phase', () => {
        const timing = '0,500,4,1,0,100,1,0\n1000,400,3,1,0,100,1,0\n1000,-50,4,1,0,100,0,0\n1500,400,4,1,0,100,1,0';
        const map = parseOsu(osuFixture({ timing, objects: '0,0,1000,2,0,L|140:0,1,140\n0,0,1600,2,0,L|140:0,1,140' }));
        expect(map.objects.map(o => o.endTimeMs)).toEqual([1200, 2000]);
        let n = 0;
        expect(osuTempoMap(map.timingPoints, 5, () => String(++n))).toMatchObject([
            { bpm: 120 },
            { startSeconds: 1, bpm: 150, meter: { numerator: 3, denominator: 4 } },
            { startSeconds: 1.5, bpm: 150 },
        ]);
    });
    test('preserves mania chords and concurrent holds in key categories, appending independent batches', () => {
        const map = parseOsu(
            osuFixture({
                mode: 3,
                objects:
                    '64,192,500,1,0\n192,192,500,1,0\n64,192,1000,128,0,2000:0:0:0:0:\n192,192,1000,128,0,2500:0:0:0:0:',
            }),
        );
        const base = project(),
            first = applyOsuBeatmap(base, map, options);
        expect(base.lanes).toHaveLength(0);
        expect(first.lanes).toHaveLength(2);
        expect(first.lanes[0]!.innerClasses.map(c => c.label)).toEqual(['键 1', '键 2']);
        expect(first.lanes[0]!.events).toHaveLength(2);
        expect(first.lanes[1]!.events).toHaveLength(2);
        const second = applyOsuBeatmap(first, map, { ...options, replaceTempo: false });
        expect(second.lanes).toHaveLength(4);
        expect(second.lanes.slice(0, 2)).toEqual(first.lanes);
        expect(second.tempoMap).toEqual(first.tempoMap);
        expect(defaultOsuTempoReplacement(base)).toBe(true);
        expect(defaultOsuTempoReplacement(first)).toBe(false);
    });
    test('imports selected auxiliary tracks and forms continuous Kiai intervals', () => {
        const map = parseOsu(osuFixture());
        const next = applyOsuBeatmap(project(), map, {
            ...options,
            notes: false,
            bookmarks: true,
            breaks: true,
            kiai: true,
        });
        expect(next.lanes.map(l => l.name)).toEqual(['osu · Test · 书签', 'osu · Test · 休息', 'osu · Test · Kiai']);
        expect(next.lanes[2]!.events).toMatchObject([{ startSeconds: 1, endSeconds: 2 }]);
    });
    test('fails without partial changes on duplicates, overlap, out-of-track events or invalid tempo', () => {
        const base = project(),
            snapshot = structuredClone(base);
        for (const objects of [
            '64,192,500,1,0\n64,192,500,1,0',
            '64,192,1000,128,0,3000:0:0:0:0:\n64,192,2000,128,0,4000:0:0:0:0:',
            '64,192,6000,1,0',
        ]) {
            expect(() => applyOsuBeatmap(base, parseOsu(osuFixture({ mode: 3, objects })), options)).toThrow();
            expect(base).toEqual(snapshot);
        }
        expect(() => applyOsuBeatmap(base, parseOsu(osuFixture({ timing: '0,40,4,1,0,100,1,0' })), options)).toThrow(
            /10–1200/,
        );
        expect(() => parseOsu(osuFixture().replace('v14', 'v13'))).toThrow(/v14/);
        expect(() => parseOsu(osuFixture({ mode: 2 }))).toThrow(/模式/);
        expect(() => parseOsu(osuFixture({ objects: '0,0,NaN,1,0' }))).toThrow();
    });
});

describe('osz archive reading', () => {
    test('lists difficulties, retains individual parse errors and reads only selected relative audio', async () => {
        const audio = new Uint8Array([1, 2, 3]);
        const bytes = zipSync({
            'set/map.osu': strToU8(osuFixture()),
            'set/unsupported.osu': strToU8(osuFixture({ mode: 2 })),
            'set/audio.wav': audio,
            'background.png': new Uint8Array(100),
        });
        const archive = await openOsuArchive(bytes);
        expect(archive.beatmaps).toHaveLength(2);
        expect(archive.beatmaps[0]!.beatmap!.difficulty).toBe('Test');
        expect(archive.beatmaps[1]!.error).toMatch(/模式/);
        expect(await archive.readAudio('set/map.osu', 'AUDIO.wav')).toEqual({ name: 'AUDIO.wav', bytes: audio });
        await expect(archive.readAudio('set/map.osu', 'missing.wav')).rejects.toThrow(/找不到音频/);
        archive.release();
        await expect(archive.readAudio('set/map.osu', 'audio.wav')).rejects.toThrow(/释放/);
    });
    test('rejects broken, ambiguous, absent and cancelled inputs', async () => {
        await expect(openOsuArchive(new Uint8Array([1]))).rejects.toThrow();
        await expect(openOsuArchive(zipSync({ 'a.txt': strToU8('empty') }))).rejects.toThrow(/没有/);
        await expect(
            openOsuArchive(zipSync({ 'a.osu': strToU8(osuFixture()), 'A.osu': strToU8(osuFixture()) })),
        ).rejects.toThrow(/重复/);
        const abort = new AbortController();
        abort.abort();
        await expect(openOsuArchive(zipSync({ 'a.osu': strToU8(osuFixture()) }), abort.signal)).rejects.toMatchObject({
            name: 'AbortError',
        });
        expect(normalizeOsuPath('set/../audio.wav')).toBe('audio.wav');
        expect(() => normalizeOsuPath('../audio.wav')).toThrow();
    });
});
