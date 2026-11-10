import 'fake-indexeddb/auto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { ACOUSTIC_CONFIG_HASH } from '../../src/transcription/acousticIndex';
import type { AcousticIndex } from '../../src/transcription/acousticIndex';
import { ExampleRepository } from '../../src/transcription/examples/repository';
import { applyExampleMatches } from '../../src/transcription/examples/applyMatches';
import { exampleOrigin, queryIdentity } from '../../src/transcription/examples/types';
import type { ExampleMatch, ExampleProfile, ExampleSource } from '../../src/transcription/examples/types';
const signal = () => new AbortController().signal;
const source: ExampleSource = {
    key: 'b'.repeat(64),
    songHash: 'a'.repeat(64),
    trackId: 'song',
    kind: 'original',
    role: 'original',
    label: '原曲',
    frames: 22050,
    sampleRate: 22050,
    channels: 1,
};
const profile = (): ExampleProfile => ({
    version: 1,
    id: '12345678-1234-1234-1234-123456789abc',
    songHash: source.songHash,
    sourceKey: source.key,
    durationSeconds: 1,
    label: '声音',
    examples: [{ id: 'positive', polarity: 'positive', kind: 'point', startSeconds: 0.1, endSeconds: 0.1 }],
    threshold: 0.8,
    negativeMargin: 0.04,
    matches: [],
    queryHash: null,
});
function match(p: ExampleProfile, frame: number, start: number, end = start): ExampleMatch {
    const kind = end > start ? 'range' : 'point';
    return {
        id: exampleOrigin(p.sourceKey, p.id, kind, frame),
        anchorFrame: frame,
        kind,
        startSeconds: start,
        endSeconds: end,
        positiveScore: 0.96,
        negativeScore: null,
        selected: true,
    };
}
function index(): AcousticIndex {
    const count = 44;
    return {
        configHash: ACOUSTIC_CONFIG_HASH,
        sourceFrames: 22050,
        sourceSampleRate: 22050,
        durationSeconds: 1,
        frameCount: count,
        rms: new Float32Array(count).fill(0.1),
        onset: new Float32Array(count),
        mfcc: new Float32Array(count * 13),
        chroma: new Float32Array(count * 12),
        bandRms: new Float32Array(count * 3),
        bandOnset: new Float32Array(count * 3),
    };
}
beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
        const req = indexedDB.deleteDatabase('editor-sound-examples');
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
    vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: 0, quota: 1e9 }) } });
});
afterEach(() => vi.unstubAllGlobals());
it('restores checksummed typed DSP indices and profiles without PCM, isolates sources and detects corruption', async () => {
    const repository = new ExampleRepository(),
        data = index(),
        p = profile();
    await repository.publishIndex(source, data, signal(), 1e8);
    await repository.save(p, signal(), 1e8);
    expect((await repository.restoreIndex(source, signal()))!.mfcc).toEqual(data.mfcc);
    expect(await repository.profiles(source.songHash, signal())).toEqual([p]);
    expect(await repository.restoreIndex({ ...source, key: 'c'.repeat(64) }, signal())).toBeNull();
    await expect(repository.restoreIndex({ ...source, frames: 22051 }, signal())).rejects.toThrow('校验');
    const db = await new Promise<IDBDatabase>(resolve => {
        const r = indexedDB.open('editor-sound-examples', 1);
        r.onsuccess = () => resolve(r.result);
    });
    await new Promise<void>(resolve => {
        const tx = db.transaction('indices', 'readwrite'),
            store = tx.objectStore('indices'),
            req = store.getAll();
        req.onsuccess = () => {
            const row = req.result[0];
            row.index.rms[0] = 0.9;
            store.put(row, `${source.key}:${ACOUSTIC_CONFIG_HASH}`);
        };
        tx.oncomplete = () => resolve();
    });
    db.close();
    await expect(repository.restoreIndex(source, signal())).rejects.toThrow('校验');
    await repository.clearIndex(source.key);
    expect(await repository.restoreIndex(source, signal())).toBeNull();
    expect(await repository.profiles(source.songHash, signal())).toHaveLength(1);
    await repository.clearAll();
    expect(await repository.profiles(source.songHash, signal())).toEqual([]);
});
it('does not publish cancelled or over-quota example state', async () => {
    const repository = new ExampleRepository(),
        abort = new AbortController();
    abort.abort();
    await expect(repository.publishIndex(source, index(), abort.signal, 1e8)).rejects.toThrow();
    await expect(repository.save(profile(), signal(), 1)).rejects.toThrow();
    expect(await repository.profiles(source.songHash, signal())).toEqual([]);
});
it('atomically applies reviewed matches, preserves manual content and stable origins across query/manual boundary edits', () => {
    const p = profile(),
        project = createInitialEditorProject({
            track: { contentHash: p.songHash, fileName: 'a.wav', durationSeconds: 1 },
        });
    project.lanes.push({
        id: 'manual',
        name: 'manual',
        eventKind: 'point',
        innerClasses: [{ id: 'class', label: '手工' }],
        events: [{ id: 'manual-positive', innerClassId: 'class', atSeconds: 0.1 }],
    });
    p.examples[0]!.markerId = 'manual-positive';
    p.matches = [match(p, 3, 0.1), match(p, 10, 0.3), match(p, 12, 0.36), match(p, 20, 0.5, 0.7)];
    p.queryHash = queryIdentity(p);
    const original = JSON.stringify(project),
        first = applyExampleMatches(project, p);
    expect(first.added).toBe(3);
    expect(first.skipped).toBe(1);
    expect(JSON.stringify(project)).toBe(original);
    expect(first.project.tempoMap).toEqual(project.tempoMap);
    expect(first.project.lanes[0]).toEqual(project.lanes[0]);
    const range = first.project.lanes.find(lane => lane.eventKind === 'range')!;
    if (range.eventKind === 'range') range.events[0]!.startSeconds = 0.52;
    expect(applyExampleMatches(first.project, p).added).toBe(0);
    p.examples.push({ id: 'more', polarity: 'positive', kind: 'point', startSeconds: 0.2, endSeconds: 0.2 });
    expect(() => applyExampleMatches(first.project, p)).toThrow('重新检索');
    p.queryHash = queryIdentity(p);
    expect(applyExampleMatches(first.project, p).added).toBe(0);
    p.matches.push(match(p, 21, 0.53, 0.73));
    expect(applyExampleMatches(first.project, p).added).toBe(0);
});
it('fails the whole apply for conflicting reviewed ranges or wrong-song results', () => {
    const p = profile(),
        project = createInitialEditorProject({
            track: { contentHash: p.songHash, fileName: 'a.wav', durationSeconds: 1 },
        });
    p.matches = [match(p, 10, 0.2, 0.6), match(p, 14, 0.3, 0.8)];
    p.queryHash = queryIdentity(p);
    const original = JSON.stringify(project);
    expect(() => applyExampleMatches(project, p)).toThrow('冲突');
    expect(JSON.stringify(project)).toBe(original);
    expect(() =>
        applyExampleMatches({ ...project, track: { ...project.track, contentHash: 'f'.repeat(64) } }, p),
    ).toThrow('不属于');
});
