import { describe, expect, test } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
    createInitialEditorProject,
    decodeEditorProject,
    encodeEditorProjectV2,
    readEditorProject,
    validateEditorProjectV2,
} from '../../src/editor/projectCodec';
import { EditorDraftRepository, EDITOR_DRAFT_KEY } from '../../src/editor/editorDraftRepository';
import {
    applyBpmInput,
    generateTempoGrid,
    insertTempoBoundary,
    moveTempoBoundary,
    snapEditorTime,
} from '../../src/editor/tempoMap';
import { pointCellAtTime } from '../../src/editor/pointAnnotations';
import { markerFixture } from '../visualizer/marker-input-fixture';
import { validateComposition } from '../../src/visualizer/compositionCodec';

function project() {
    let id = 0;
    return createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 12, sampleRate: 48000 },
        createId: () => `id-${++id}`,
        now: () => new Date('2026-10-21T00:00:00Z'),
    });
}
function legacy() {
    const p = project();
    return {
        ...p,
        schemaVersion: 1,
        tempoMap: p.tempoMap.map(s => {
            if (s.mode !== 'metered') return s;
            const { beatOriginSeconds: _, ...rest } = s;
            return { ...rest, bpm: 120, bpmSource: 'user' };
        }),
    };
}

describe('Editor V2 timing and explicit V1 conversion', () => {
    test('converts a V5 embedded V1 snapshot while retaining marker references', () => {
        const fixture = markerFixture();
        const before = fixture.project;
        const raw = JSON.parse(JSON.stringify(before));
        raw.editorSnapshot.project.schemaVersion = 1;
        for (const segment of raw.editorSnapshot.project.tempoMap) delete segment.beatOriginSeconds;
        const after = validateComposition(raw);
        expect(after).toEqual(before);
        expect(after.editorSnapshot!.project.schemaVersion).toBe(2);
    });
    test('migrates strict V1 without changing identities, markers, workspace or timing', () => {
        const old = legacy();
        const current = readEditorProject(old);
        expect(current).toEqual({ ...old, schemaVersion: 2, tempoMap: [{ ...old.tempoMap[0], beatOriginSeconds: 0 }] });
        expect(decodeEditorProject(JSON.stringify(old))).toEqual(current);
        expect(decodeEditorProject(encodeEditorProjectV2(current))).toEqual(current);
        expect(() => readEditorProject({ ...old, surprise: 1 })).toThrow();
        expect(() => readEditorProject({ ...old, schemaVersion: 3 })).toThrow();
        expect(() => readEditorProject({ ...old, tempoMap: [{ ...old.tempoMap[0], bpm: 1020 }] })).toThrow();
        expect(() => validateEditorProjectV2(old)).toThrow();
    });
    test.each([10, 15, 127.5, 1020, 1200])('round-trips %s BPM with an imported anchor', bpm => {
        const p = project();
        const base = p.tempoMap[0]!;
        if (base.mode !== 'metered') throw Error('fixture');
        p.tempoMap = [{ ...base, bpm, bpmSource: 'imported', beatOriginSeconds: -1.866 }];
        expect(decodeEditorProject(encodeEditorProjectV2(p))).toEqual(p);
        expect(applyBpmInput(base, String(bpm))).toMatchObject({ ok: true, segment: { bpm, mode: 'metered' } });
    });
    test('rejects invalid values and keeps the single-beat input boundary explicit', () => {
        const base = project().tempoMap[0]!;
        expect(applyBpmInput(base, '9.999')).toMatchObject({ ok: true, segment: { mode: 'single-beat' } });
        for (const input of ['1200.01', '-1', 'Infinity', 'NaN', '']) expect(applyBpmInput(base, input).ok).toBe(false);
        const p = project();
        expect(() =>
            validateEditorProjectV2({ ...p, tempoMap: [{ ...p.tempoMap[0], beatOriginSeconds: Infinity }] }),
        ).toThrow();
    });
    test('uses negative and future anchors consistently in drawing, snapping and point cells', () => {
        const p = project(),
            base = p.tempoMap[0]!;
        if (base.mode !== 'metered') throw Error('fixture');
        p.tempoMap = [{ ...base, bpm: 123, bpmSource: 'imported', beatOriginSeconds: -1.866 }];
        const setting = { preset: 'common', divisor: 1, customDivisor: 5 } as const;
        const viewport = { startSeconds: 0, endSeconds: 1, zoom: 1 };
        expect(generateTempoGrid(p.tempoMap, 12, viewport, setting)[0]!.timeSeconds).toBe(0.08522);
        expect(snapEditorTime(0.09, p.tempoMap, viewport, 1000, 12, setting)).toBe(0.08522);
        expect(pointCellAtTime(0.09, p, 1000, setting)!.timeSeconds).toBe(0.08522);
        p.tempoMap = [{ ...base, bpm: 120, bpmSource: 'imported', beatOriginSeconds: 0.927231 }];
        expect(generateTempoGrid(p.tempoMap, 12, viewport, setting).map(x => x.timeSeconds)).toEqual([
            0.427231, 0.927231,
        ]);
        const inserted = insertTempoBoundary(p.tempoMap, 2, () => 'boundary');
        expect(inserted[1]).toMatchObject({ startSeconds: 2, beatOriginSeconds: 2 });
        expect(moveTempoBoundary(inserted, 'boundary', 3, 12)[1]).toMatchObject({
            startSeconds: 3,
            beatOriginSeconds: 3,
        });
        expect(applyBpmInput(p.tempoMap[0]!, '144')).toMatchObject({ segment: { beatOriginSeconds: 0.927231 } });
    });
    test('restores V1 drafts without destructive writes and writes only V2 envelopes', async () => {
        const indexedDB = new IDBFactory(),
            databaseName = 'editor-v2-migration';
        const repository = new EditorDraftRepository({ indexedDB, databaseName });
        await repository.restore();
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open(databaseName);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        const old = { schemaVersion: 1, savedAt: '2026-10-21T00:00:00Z', project: legacy() };
        await new Promise<void>((resolve, reject) => {
            const t = db.transaction('draft', 'readwrite');
            t.objectStore('draft').put({ key: EDITOR_DRAFT_KEY, envelope: old });
            t.oncomplete = () => resolve();
            t.onerror = () => reject(t.error);
        });
        const restored = (await repository.restore())!;
        expect(restored).toMatchObject({ schemaVersion: 2, migratedFromV1: true, project: { schemaVersion: 2 } });
        const persisted = await new Promise<any>((resolve, reject) => {
            const r = db.transaction('draft').objectStore('draft').get(EDITOR_DRAFT_KEY);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        expect(persisted.envelope).toEqual(old);
        await repository.replace({ schemaVersion: 2, savedAt: restored.savedAt, project: restored.project });
        expect(await repository.restore()).toEqual({
            schemaVersion: 2,
            savedAt: restored.savedAt,
            project: restored.project,
        });
        db.close();
        repository.close();
    });
});
