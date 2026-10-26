import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { VisualizerSessionController } from '../../src/visualizer/visualizerSessionController';
import { CompositionDraftWriter } from '../../src/visualizer/compositionDraftWriter';
import type {
    CompositionDraftRepositoryPort,
    RestoredComposition,
} from '../../src/visualizer/compositionDraftRepository';
import type { AudioSessionService } from '../../src/audio/audioSessionService';
import type { VisualizerFileGateway } from '../../src/visualizer/fileIO';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { EditorDraftRepositoryPort } from '../../src/editor/editorDraftRepository';
import { markerFixture } from './marker-input-fixture';

const track = { contentHash: 'a'.repeat(64), fileName: 'first.wav', durationSeconds: 10, sampleRate: 48000 };
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};

function harness(
    restored: RestoredComposition = null,
    editorRepository?: EditorDraftRepositoryPort,
    audioReady?: Promise<unknown>,
) {
    const store = useAudioSessionStore();
    for (const [id, hash] of [
        ['first', 'a'],
        ['second', 'b'],
    ])
        store.queue.push({
            id: id!,
            name: `${id}.wav`,
            trackHash: hash!.repeat(64),
            mimeType: 'audio/wav',
            byteSize: 1,
            lastModified: 1,
            metadata: {},
            restoreState: 'available',
        });
    const release = vi.fn();
    const audioSession = {
        acquireRoutePlayback: vi.fn(async ({ trackId }: { trackId: string }) => {
            store.currentTrackId = trackId;
            return { release };
        }),
        getDecodedTrackDescriptor: () => ({ durationSeconds: 10, sampleRate: 48000 }),
    } as unknown as AudioSessionService;
    const repository: CompositionDraftRepositoryPort = {
        restore: vi.fn(async () => restored),
        replace: vi.fn(async draft => {
            restored = { kind: 'current', draft };
        }),
        close: vi.fn(),
    };
    const fileGateway: VisualizerFileGateway = {
        open: vi.fn(async () => null),
        save: vi.fn(async () => 'saved' as const),
    };
    const controller = new VisualizerSessionController({
        validateAlgorithms: async () => {},
        audioSession,
        store,
        repository,
        fileGateway,
        editorRepository,
        audioReady,
    });
    return { controller, repository, fileGateway, release, audioSession };
}

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => vi.restoreAllMocks());

test('output edits preserve sync compensation through persistence and reopening', async () => {
    const h = harness();
    await h.controller.enter('first');
    h.controller.updateOutput('720p', 30, -120);
    h.controller.updateOutput('1080p', 60);
    await h.controller.flush();
    expect(vi.mocked(h.repository.replace).mock.lastCall![0].project.output).toEqual({
        aspectRatio: '16:9',
        resolution: '1080p',
        frameRate: 60,
        audioVideoOffsetMs: -120,
    });
    await h.controller.leave();
    await h.controller.enter('first');
    expect(h.controller.readProject()!.output.audioVideoOffsetMs).toBe(-120);
    await h.controller.dispose();
});

test('automatic seeds survive edits and persistence but reroll on clear, accepted import and reopening', async () => {
    const project = appendStandaloneElements(createComposition(track), [elementRegistry.create('starfield', 10, 0)]);
    const id = project.elements[0]!.id;
    let next = 100;
    const random = vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => {
        (array as Uint32Array)[0] = next++;
        return array;
    });
    const h = harness({ kind: 'current', draft: { schemaVersion: 6, savedAt: project.updatedAt, project } });
    await h.controller.enter('first');
    expect(h.controller.readRenderSeeds().get(id)).toBe(100);
    h.controller.updateOutput('1080p', 30);
    await h.controller.flush();
    expect(h.controller.readRenderSeeds().get(id)).toBe(100);
    expect(vi.mocked(h.repository.replace).mock.lastCall![0].project.elements[0]!.seed).toBeNull();
    await h.controller.exportProject();
    expect(
        JSON.parse(new TextDecoder().decode(vi.mocked(h.fileGateway.save).mock.lastCall![2])).elements[0].seed,
    ).toBeNull();
    expect(h.controller.readRenderSeeds().get(id)).toBe(100);
    h.controller.updateElement(id, { seed: 0 });
    expect(h.controller.readRenderSeeds().get(id)).toBe(0);
    h.controller.updateElement(id, { seed: null });
    expect(h.controller.readRenderSeeds().get(id)).toBe(101);
    vi.mocked(h.fileGateway.open).mockResolvedValue({
        name: 'cancel.json',
        bytes: new TextEncoder().encode('{}').buffer,
    });
    await expect(h.controller.importProject()).rejects.toThrow();
    expect(h.controller.readRenderSeeds().get(id)).toBe(101);
    vi.mocked(h.fileGateway.open).mockResolvedValue(null);
    expect(await h.controller.importProject()).toBe('cancelled');
    expect(h.controller.readRenderSeeds().get(id)).toBe(101);
    vi.mocked(h.fileGateway.open).mockResolvedValue({
        name: 'auto.json',
        bytes: new TextEncoder().encode(JSON.stringify(h.controller.readProject())).buffer,
    });
    expect(await h.controller.importProject()).toBe('imported');
    expect(h.controller.readRenderSeeds().get(id)).toBe(102);
    await h.controller.leave();
    await h.controller.enter('first');
    expect(h.controller.readRenderSeeds().get(id)).toBe(103);
    expect(h.controller.readProject()!.elements[0]!.seed).toBeNull();
    expect(random).toHaveBeenCalledTimes(4);
    await h.controller.dispose();
});

test('stale or invalid automatic-seed imports never reroll an active session', async () => {
    const h = harness();
    await h.controller.enter('first');
    const id = h.controller.addElement('starfield')!;
    const seed = h.controller.readRenderSeeds().get(id);
    const pending = deferred<Awaited<ReturnType<VisualizerFileGateway['open']>>>();
    vi.mocked(h.fileGateway.open).mockReturnValueOnce(pending.promise);
    const oldProject = structuredClone(h.controller.readProject()!);
    const importing = h.controller.importProject();
    vi.mocked(h.fileGateway.open).mockResolvedValueOnce(null);
    await h.controller.importProject();
    pending.resolve({ name: 'late.json', bytes: new TextEncoder().encode(JSON.stringify(oldProject)).buffer });
    expect(await importing).toBe('cancelled');
    expect(h.controller.readRenderSeeds().get(id)).toBe(seed);
    expect(() => h.controller.updateElement(id, { seed: 1.5 })).toThrow();
    expect(h.controller.readRenderSeeds().get(id)).toBe(seed);
    await h.controller.dispose();
});

test('migrated drafts are saved once after activation and stay untouched on a different song', async () => {
    const project = appendStandaloneElements(createComposition(track), [elementRegistry.create('starfield', 10, 0)]);
    project.elements[0]!.seed = 17;
    const h = harness({
        kind: 'current',
        draft: { schemaVersion: 6, savedAt: project.updatedAt, project },
        needsSave: true,
    });
    await h.controller.enter('second');
    expect(h.controller.getSnapshot().state).toBe('draft-conflict');
    await h.controller.flush();
    expect(h.repository.replace).not.toHaveBeenCalled();
    await h.controller.enter('first');
    expect(h.controller.getSnapshot().state).toBe('ready');
    expect(h.controller.readRenderSeeds().get(project.elements[0]!.id)).toBe(17);
    await h.controller.flush();
    expect(h.repository.replace).toHaveBeenCalledOnce();
    expect(vi.mocked(h.repository.replace).mock.lastCall![0].project).toEqual(project);
    await h.controller.enter('first');
    await h.controller.flush();
    expect(h.repository.replace).toHaveBeenCalledOnce();
    await h.controller.dispose();
});

test('marker references reject an incompatible Editor refresh atomically and protect even disabled elements', async () => {
    const fixture = markerFixture(),
        project = fixture.project;
    project.track = track;
    const editor = createInitialEditorProject({ track });
    editor.lanes = project.editorSnapshot!.project.lanes;
    project.editorSnapshot = { capturedAt: editor.updatedAt, project: editor };
    project.elements[0]!.timing = { kind: 'manual', startSeconds: 0, endSeconds: 10 };
    project.elements[0]!.enabled = false;
    const editorRepository: EditorDraftRepositoryPort = {
        restore: vi.fn(async () => null),
        replace: vi.fn(),
        close: vi.fn(),
        clear: vi.fn(),
        getLeaveWarningEnabled: async () => true,
        setLeaveWarningEnabled: vi.fn(),
        getOverlayVisibility: async () => null,
        setOverlayVisibility: vi.fn(),
    };
    const h = harness(
        { kind: 'current', draft: { schemaVersion: 6, savedAt: project.updatedAt, project } },
        editorRepository,
    );
    await h.controller.enter('first');
    expect(h.controller.getSnapshot().state).toBe('ready');
    const before = h.controller.readProject();
    expect(() => h.controller.removeEditorSnapshot()).toThrow(/仍被元素引用/);
    const broken = structuredClone(editor);
    broken.lanes = broken.lanes.filter(l => l.id !== fixture.pointLane);
    vi.mocked(editorRepository.restore).mockResolvedValue({
        schemaVersion: 2,
        savedAt: editor.updatedAt,
        project: broken,
    });
    await expect(h.controller.reloadEditorDraft()).rejects.toThrow(/轨道缺失/);
    expect(h.controller.readProject()).toBe(before);
    h.controller.updateElement(project.elements[0]!.id, {
        markerBindings: { points: { kind: 'unbound' }, ranges: { kind: 'unbound' } },
    });
    h.controller.removeEditorSnapshot();
    expect(h.controller.readProject()!.editorSnapshot).toBeUndefined();
    await h.controller.dispose();
});

test('waits for audio restoration and invalidates entry when leaving during that wait', async () => {
    const ready = deferred<void>(),
        h = harness(null, undefined, ready.promise);
    const entry = h.controller.enter('first');
    await Promise.resolve();
    await Promise.resolve();
    expect(h.audioSession.acquireRoutePlayback).not.toHaveBeenCalled();
    await h.controller.leave();
    ready.resolve();
    await entry;
    expect(h.audioSession.acquireRoutePlayback).not.toHaveBeenCalled();
    expect(h.controller.getSnapshot().state).toBe('empty');
    await h.controller.enter('first');
    expect(h.controller.getSnapshot().state).toBe('ready');
    await h.controller.dispose();
});

test('adds a preset atomically, retains existing elements and persists the expanded composition', async () => {
    const h = harness();
    await h.controller.enter('first');
    const existing = h.controller.addElement('solid');
    const notifications = vi.fn();
    const unsubscribe = h.controller.subscribe(notifications);
    notifications.mockClear();
    const added = h.controller.addPreset('geometric-0.6');
    expect(h.controller.readProject()?.items.find(i => i.id === added)?.kind).toBe('preset');
    const addedIds = h.controller
        .readProject()!
        .elements.slice(1)
        .map(e => e.id);
    expect(h.controller.readProject()?.elements[0]?.id).toBe(existing);
    expect(h.controller.getSnapshot().bindingRuntime.activeFeatureIds).toEqual([]);
    expect(notifications.mock.calls.filter(([s]) => s.project.elements.length === 12).length).toBeGreaterThan(0);
    await h.controller.flush();
    await h.controller.enter('first');
    expect(h.controller.readProject()?.elements.map(e => e.id)).toEqual([existing, ...addedIds]);
    unsubscribe();
    await h.controller.dispose();
});

test('starts empty, restores the same song, and protects the single draft on a different song', async () => {
    const h = harness();
    await h.controller.enter('first');
    expect(h.controller.readProject()?.elements).toEqual([]);
    h.controller.addElement('solid');
    await h.controller.flush();
    const saved = h.controller.readProject();
    await h.controller.enter('first');
    expect(h.controller.readProject()).toEqual(saved);
    expect(h.controller.getSnapshot().restoredFromDraft).toBe(true);
    await h.controller.enter('second');
    expect(h.controller.getSnapshot().state).toBe('draft-conflict');
    expect(h.controller.readProject()).toBeNull();
    await h.controller.exportConflictingDraft();
    expect(h.fileGateway.save).toHaveBeenCalled();
    await h.controller.overwriteConflictingDraft();
    expect(h.controller.readProject()?.track.contentHash).toBe('b'.repeat(64));
    expect(h.controller.readProject()?.elements).toEqual([]);
    await h.controller.dispose();
    expect(h.repository.close).toHaveBeenCalledOnce();
});

test('exports invalid V5 draft bytes without writing or replacing them', async () => {
    const raw = { schemaVersion: 6, project: { arbitrary: 'invalid bytes' } };
    const h = harness({ kind: 'unsupported', raw });
    await h.controller.enter('first');
    expect(h.controller.getSnapshot().state).toBe('unsupported-draft');
    await h.controller.exportConflictingDraft();
    const bytes = vi.mocked(h.fileGateway.save).mock.calls[0]![2];
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(raw);
    await h.controller.leave();
    expect(h.repository.replace).not.toHaveBeenCalled();
    await h.controller.dispose();
});

test('invalid imports leave the active and durable project intact', async () => {
    const h = harness();
    await h.controller.enter('first');
    h.controller.addElement('solid');
    await h.controller.flush();
    const before = h.controller.getSnapshot().project;
    const count = vi.mocked(h.repository.replace).mock.calls.length;
    vi.mocked(h.fileGateway.open).mockResolvedValue({
        name: 'old.json',
        bytes: new TextEncoder().encode('{"schemaVersion":1}').buffer,
    });
    await expect(h.controller.importProject()).rejects.toThrow();
    expect(h.controller.readProject()).toEqual(before);
    expect(vi.mocked(h.repository.replace).mock.calls).toHaveLength(count);
    await h.controller.dispose();
});

test('Editor refresh is atomic and only the latest request can replace its snapshot', async () => {
    const editorRepository: EditorDraftRepositoryPort = {
        restore: vi.fn(async () => null),
        replace: vi.fn(),
        close: vi.fn(),
        clear: vi.fn(),
        getLeaveWarningEnabled: async () => true,
        setLeaveWarningEnabled: vi.fn(),
        getOverlayVisibility: async () => null,
        setOverlayVisibility: vi.fn(),
    };
    const h = harness(null, editorRepository);
    await h.controller.enter('first');
    const editor = createInitialEditorProject({ track });
    const old = deferred<Awaited<ReturnType<EditorDraftRepositoryPort['restore']>>>();
    vi.mocked(editorRepository.restore).mockReturnValueOnce(old.promise);
    const first = h.controller.reloadEditorDraft();
    const current = { schemaVersion: 2 as const, savedAt: new Date().toISOString(), project: editor };
    vi.mocked(editorRepository.restore).mockResolvedValueOnce(current);
    await h.controller.reloadEditorDraft();
    const before = h.controller.getSnapshot().project;
    old.resolve({ ...current, project: createInitialEditorProject({ track }) });
    await first;
    expect(h.controller.readProject()).toEqual(before);
    const wrongSong = structuredClone(current);
    wrongSong.project.track.contentHash = 'c'.repeat(64);
    vi.mocked(editorRepository.restore).mockResolvedValueOnce(wrongSong);
    await expect(h.controller.reloadEditorDraft()).rejects.toThrow();
    expect(h.controller.readProject()).toEqual(before);
    await h.controller.dispose();
});

test('only the latest entry can publish, and leaving invalidates a pending restore', async () => {
    const h = harness();
    const oldRestore = deferred<RestoredComposition>();
    vi.mocked(h.repository.restore).mockReturnValueOnce(oldRestore.promise);
    const oldEntry = h.controller.enter('first');
    await vi.waitFor(() => expect(h.repository.restore).toHaveBeenCalledOnce());
    await h.controller.enter('second');
    oldRestore.resolve(null);
    await oldEntry;
    expect(h.controller.readProject()?.track.contentHash).toBe('b'.repeat(64));
    const pending = deferred<RestoredComposition>();
    vi.mocked(h.repository.restore).mockReturnValueOnce(pending.promise);
    const entry = h.controller.enter('first');
    await vi.waitFor(() => expect(h.repository.restore).toHaveBeenCalledTimes(3));
    await h.controller.leave();
    pending.resolve(null);
    await entry;
    expect(h.controller.getSnapshot().state).toBe('empty');
    expect(h.controller.hasActivePlaybackLease()).toBe(false);
    await h.controller.dispose();
});

test('a failed save blocks changing songs and retries the latest project', async () => {
    const h = harness();
    await h.controller.enter('first');
    vi.mocked(h.repository.replace).mockRejectedValue(new Error('quota'));
    h.controller.addElement('solid');
    expect(await h.controller.flush()).toBe(false);
    expect(h.controller.getSnapshot().state).toBe('not-persisted');
    await expect(h.controller.enter('second')).rejects.toThrow(/重试保存/);
    expect(h.controller.readProject()?.track.contentHash).toBe(track.contentHash);
    h.controller.addElement('blur');
    vi.mocked(h.repository.replace).mockResolvedValue();
    expect(await h.controller.flush()).toBe(true);
    expect(vi.mocked(h.repository.replace).mock.lastCall?.[0].project.elements).toHaveLength(2);
    await h.controller.dispose();
});

test('concurrent flush callers all await the latest queued write, with no overlapping transaction', async () => {
    const first = deferred<void>(),
        last = deferred<void>();
    const replace = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(last.promise);
    const writer = new CompositionDraftWriter({ restore: async () => null, replace, close() {} }, vi.fn());
    writer.queue(createComposition(track));
    const a = writer.flush();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
    const latest = createComposition(track);
    latest.output.resolution = '1080p';
    writer.queue(latest);
    const b = writer.flush();
    expect(a).toBe(b);
    first.resolve();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledTimes(2));
    expect(writer.hasPending()).toBe(true);
    expect(replace.mock.lastCall?.[0].project.output.resolution).toBe('1080p');
    last.resolve();
    expect(await Promise.all([a, b])).toEqual([true, true]);
    expect(writer.hasPending()).toBe(false);
});

test('a failed write retains a newer pending revision for retry', async () => {
    const pending = deferred<void>();
    const replace = vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(undefined);
    const writer = new CompositionDraftWriter({ restore: async () => null, replace, close() {} }, vi.fn());
    writer.queue(createComposition(track));
    const flush = writer.flush();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledOnce());
    const latest = createComposition(track);
    latest.output.frameRate = 60;
    writer.queue(latest);
    pending.reject(new Error('disk full'));
    expect(await flush).toBe(false);
    expect(writer.hasPending()).toBe(true);
    expect(await writer.flush()).toBe(true);
    expect(replace.mock.lastCall?.[0].project.output.frameRate).toBe(60);
});
