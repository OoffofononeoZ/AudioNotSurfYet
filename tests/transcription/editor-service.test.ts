import { expect, it, vi } from 'vitest';
import { EditorTranscriptionService } from '../../src/transcription/editorTranscriptionService';
import { evidence } from './review-fixture';
import { defaultReviewSettings } from '../../src/transcription/reviewSettings';
import { EditorProcessingGate } from '../../src/processing/editorProcessingGate';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { ProcessingError } from '../../src/processing/modelManifest';
import type { EditorSessionSnapshot } from '../../src/editor/types';
import type { EditorSeparationService, EditorSeparationSnapshot } from '../../src/processing/editorSeparationService';
import type { TranscriptionBundle } from '../../src/transcription/workerProtocol';
import type { TranscriptionIdentity } from '../../src/transcription/candidateTypes';
import type { TranscriptionRecord, TranscriptionRepositoryPort } from '../../src/transcription/resultRepository';
import type { EditorProjectV2 } from '../../src/editor/types';
vi.mock('../../src/processing/storage', async original => ({
    ...(await original<object>()),
    databaseGet: vi.fn(async () => null),
    databaseDelete: vi.fn(async () => {}),
}));

function setup() {
    let id = 0;
    const project = createInitialEditorProject({
        track: { contentHash: 'a'.repeat(64), fileName: 'song.wav', durationSeconds: 10, sampleRate: 44100 },
        createId: () => `id-${id++}`,
    });
    project.lanes.push({
        id: 'manual',
        name: 'manual',
        eventKind: 'point',
        innerClasses: [{ id: 'class', label: 'manual' }],
        events: [{ id: 'event', innerClassId: 'class', atSeconds: 0.123 }],
    });
    let editorSnapshot = { state: 'ready', activeTrackId: 'song', project } as EditorSessionSnapshot;
    const editorListeners = new Set<(snapshot: EditorSessionSnapshot) => void>();
    const editor = {
        getSnapshot: () => editorSnapshot,
        subscribe: (fn: (snapshot: EditorSessionSnapshot) => void) => {
            editorListeners.add(fn);
            fn(editorSnapshot);
            return () => editorListeners.delete(fn);
        },
        updateProject: vi.fn((next: EditorProjectV2) => {
            editorSnapshot = { ...editorSnapshot, project: next };
            editorListeners.forEach(fn => fn(editorSnapshot));
        }),
    };
    let separationSnapshot = {
        trackId: 'song',
        status: 'ready',
        cacheLimit: 1e9,
        result: {
            source: {
                directory: 'editor-source',
                hash: 'b'.repeat(64),
                descriptor: { trackId: 'song', durationSeconds: 10 },
            },
        },
    } as EditorSeparationSnapshot;
    const separationListeners = new Set<(snapshot: EditorSeparationSnapshot) => void>(),
        consumers = new Set<() => Promise<void>>();
    const separation = {
        getSnapshot: () => separationSnapshot,
        subscribe: (fn: (snapshot: EditorSeparationSnapshot) => void) => {
            separationListeners.add(fn);
            fn(separationSnapshot);
            return () => separationListeners.delete(fn);
        },
        registerSourceConsumer: (fn: () => Promise<void>) => {
            consumers.add(fn);
            return () => consumers.delete(fn);
        },
        verifyCurrentResult: vi.fn(async () => separationSnapshot.result!),
    } as unknown as EditorSeparationService;
    const repository: TranscriptionRepositoryPort = {
        restore: vi.fn(async () => null),
        publish: vi.fn(async () => {}),
        saveEdits: vi.fn(async () => {}),
        discard: vi.fn(async () => {}),
        clearAll: vi.fn(async () => {}),
        clearForSource: vi.fn(async () => {}),
    };
    let resolve!: (bundle: TranscriptionBundle) => void,
        reject!: (error: Error) => void,
        lastIdentity!: TranscriptionIdentity;
    const controller = {
        start: vi.fn((_ft: unknown, identity: TranscriptionIdentity) => {
            lastIdentity = identity;
            return new Promise<TranscriptionBundle>((yes, no) => {
                resolve = yes;
                reject = no;
            });
        }),
        cancel: vi.fn(),
    };
    const transport = {
        setAuditionSource: vi.fn(async () => {}),
        setAuditionMuted: vi.fn(),
        subscribePlayback: vi.fn(() => () => {}),
        play: vi.fn(async () => {}),
        pause: vi.fn(),
    };
    const gate = new EditorProcessingGate(),
        service = new EditorTranscriptionService(transport, editor, separation, gate, { controller, repository });
    const bundle = (): TranscriptionBundle => ({
        auxiliary: null,
        result: {
            version: 2,
            id: 'transcription-00000000-0000-0000-0000-000000000000',
            createdAt: new Date().toISOString(),
            identity: lastIdentity,
            completedRoles: ['bass'],
            failures: [],
            truncatedDrumSegments: [],
            auxiliaryDirectory: null,
            timings: { totalMs: 1 },
            candidates: [
                {
                    id: 'note',
                    kind: 'note',
                    instrument: 'bass',
                    pitch: 48,
                    startSeconds: 1.13,
                    endSeconds: 1.33,
                    strength: 0.8,
                    acoustics: evidence(1.13, 1.33),
                    deleted: false,
                    source: {
                        resultId: 'transcription-00000000-0000-0000-0000-000000000000',
                        inputRole: 'bass',
                        artifactId: 'editor-source',
                        model: 'basic-pitch',
                    },
                },
            ],
        },
    });
    return {
        service,
        editor,
        project,
        repository,
        separation,
        controller,
        gate,
        transport,
        consumers,
        finish: () => resolve(bundle()),
        finishFailed: () => {
            const result = bundle();
            result.result.completedRoles = [];
            result.result.candidates = [];
            result.result.failures = [{ role: 'bass', code: 'model-incompatible', message: 'failed' }];
            resolve(result);
        },
        fail: () => reject(new ProcessingError('job-cancelled', 'cancelled')),
        failWith: (error: Error) => reject(error),
        changeSong: () => {
            separationSnapshot = { ...separationSnapshot, trackId: 'next', result: null };
            separationListeners.forEach(fn => fn(separationSnapshot));
        },
    };
}
async function idle(s: ReturnType<typeof setup>) {
    await vi.waitFor(() => expect(s.service.getSnapshot().status).toBe('idle'));
    s.service.setRoles(['bass']);
}
async function start(s: ReturnType<typeof setup>) {
    const work = s.service.start();
    await vi.waitFor(() => expect(s.controller.start).toHaveBeenCalled());
    return { work };
}
it('restores isolated incomplete drum ranges as partial instead of a complete result', async () => {
    const s = setup();
    await idle(s);
    s.service.setRoles(['bass', 'drums']);
    const { work } = await start(s);
    s.finish();
    await work;
    const bundle = structuredClone(s.service.getSnapshot().bundle!);
    bundle.result.completedRoles.push('drums');
    bundle.result.incompleteDrumRanges = [{ startSeconds: 2, endSeconds: 2.96, reason: 'repeated-event' }];
    bundle.result.truncatedDrumSegments = [2];
    await s.service.dispose();
    vi.mocked(s.repository.restore).mockResolvedValueOnce({
        bundle,
        thresholds: {},
        review: defaultReviewSettings(),
    } as TranscriptionRecord);
    const restored = new EditorTranscriptionService(s.transport, s.editor, s.separation, s.gate, {
        controller: s.controller,
        repository: s.repository,
    });
    await vi.waitFor(() => expect(restored.getSnapshot()).toMatchObject({ status: 'partial', restored: true }));
    expect(restored.getSnapshot().message).toContain('部分鼓区间未完成');
    await restored.dispose();
});
it('defaults to WebGPU and only uses WASM after an explicit user choice', async () => {
    const s = setup();
    await idle(s);
    s.service.setRoles(['drums']);
    expect(s.service.getSnapshot().drumBackend).toBe('webgpu');
    const first = await start(s);
    expect(s.controller.start.mock.calls[0]![1].drumBackend).toBe('webgpu');
    s.failWith(new ProcessingError('model-incompatible', 'GPU unavailable'));
    await first.work;
    expect(s.service.getSnapshot().status).toBe('error');
    expect(s.service.getSnapshot().drumBackend).toBe('webgpu');
    expect(s.controller.start).toHaveBeenCalledTimes(1);
    s.service.setDrumBackend('wasm');
    const next = s.service.start();
    await vi.waitFor(() => expect(s.controller.start).toHaveBeenCalledTimes(2));
    expect(s.controller.start.mock.calls[1]![1].drumBackend).toBe('wasm');
    s.failWith(new ProcessingError('inference-failed', 'Stop explicit slow-mode test'));
    await next;
    expect(s.service.getSnapshot().drumBackend).toBe('wasm');
    await s.service.dispose();
});
it('flushes a failed correction again before shutdown without rerunning inference or discarding candidates', async () => {
    const s = setup();
    await idle(s);
    const { work } = await start(s);
    s.finish();
    await work;
    vi.mocked(s.repository.saveEdits).mockRejectedValueOnce(Error('quota'));
    s.service.correct('note', { instrument: 'unknown' });
    await vi.waitFor(() => expect(s.service.getSnapshot().persistence).toBe('not-persisted'));
    expect(await s.service.flushEdits()).toBe(true);
    expect(s.repository.saveEdits).toHaveBeenCalledTimes(2);
    expect(s.controller.start).toHaveBeenCalledTimes(1);
    expect(s.service.getSnapshot().bundle?.result.candidates[0]?.instrument).toBe('unknown');
    await s.service.dispose();
});
it('changes view, filtering and sound groups without inference and persists the review with edits', async () => {
    const s = setup();
    await idle(s);
    const { work } = await start(s);
    s.finish();
    await work;
    const raw = structuredClone(s.service.getSnapshot().bundle!.result.candidates);
    s.service.setReviewView('notes');
    s.service.setSensitivity('balanced');
    s.service.assignSoundGroup('note', null);
    const group = s.service.getSnapshot().preview!.groups[0]!;
    s.service.renameSoundGroup(group.id, '醒目的声音');
    await s.service.flushEdits();
    const settings = s.service.getSnapshot().review;
    expect(settings.groups[group.id]!.label).toBe('醒目的声音');
    expect(settings.assignments.note).toBe(group.id);
    expect(s.service.getSnapshot().bundle!.result.candidates).toEqual(raw);
    expect(s.controller.start).toHaveBeenCalledTimes(1);
    expect(vi.mocked(s.repository.saveEdits).mock.calls.at(-1)![3]).toEqual(settings);
    await s.service.dispose();
});

it('waits for an already running cache clear before completing disposal', async () => {
    const s = setup();
    await idle(s);
    let finish!: () => void;
    vi.mocked(s.repository.clearAll).mockImplementation(
        () =>
            new Promise<void>(resolve => {
                finish = resolve;
            }),
    );
    const clearing = s.service.clear('results');
    await vi.waitFor(() => expect(s.repository.clearAll).toHaveBeenCalledTimes(1));
    let disposed = false;
    const disposal = s.service.dispose().then(() => {
        disposed = true;
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(disposed).toBe(false);
    finish();
    await Promise.all([clearing, disposal]);
    expect(disposed).toBe(true);
});

it('persists verified candidates, saves correction without inference and atomically applies once', async () => {
    const s = setup();
    await idle(s);
    const { work } = await start(s);
    s.finish();
    await work;
    expect(s.repository.publish).toHaveBeenCalledTimes(1);
    s.service.correct('note', { instrument: 'unknown' });
    s.service.setThreshold('unknown', 100);
    await vi.waitFor(() => expect(s.repository.saveEdits).toHaveBeenCalledTimes(2));
    expect(s.controller.start).toHaveBeenCalledTimes(1);
    s.service.apply();
    expect(s.editor.updateProject).toHaveBeenCalledTimes(1);
    expect(s.editor.getSnapshot().project!.lanes[0]).toEqual(s.project.lanes[0]);
    expect(s.editor.getSnapshot().project!.tempoMap).toEqual(s.project.tempoMap);
    expect(s.service.getSnapshot().applied).toBe(true);
    s.service.apply();
    expect(s.editor.updateProject).toHaveBeenCalledTimes(1);
    await s.service.dispose();
});
it('retains the prior complete result on cancelled rerun and holds the shared processing gate', async () => {
    const s = setup();
    await idle(s);
    let started = await start(s);
    s.finish();
    await started.work;
    const previous = s.service.getSnapshot().bundle;
    const running = s.service.start();
    await vi.waitFor(() => expect(s.controller.start).toHaveBeenCalledTimes(2));
    expect(() => s.gate.acquire('separation')).toThrow();
    s.service.cancel();
    expect(s.service.getSnapshot().status).toBe('cancelling');
    s.fail();
    await running;
    expect(s.service.getSnapshot()).toMatchObject({ status: 'cancelled', bundle: previous });
    const release = s.gate.acquire('separation');
    release();
    await s.service.dispose();
});
it('discards an unpublished late result after song change and waits for it before leaving', async () => {
    const s = setup();
    await idle(s);
    const { work } = await start(s);
    s.changeSong();
    let suspended = false;
    const leave = s.service.suspend().then(() => {
        suspended = true;
    });
    await Promise.resolve();
    expect(suspended).toBe(false);
    s.finish();
    await work;
    await leave;
    expect(s.repository.publish).not.toHaveBeenCalled();
    expect(s.repository.discard).toHaveBeenCalledTimes(1);
    expect(s.service.getSnapshot().bundle).toBeNull();
    await s.service.dispose();
});
it('keeps previous result on indexing failure and cleans its new unpublished artifacts', async () => {
    const s = setup();
    await idle(s);
    vi.mocked(s.repository.publish).mockRejectedValueOnce(new Error('quota'));
    const { work } = await start(s);
    s.finish();
    await work;
    expect(s.service.getSnapshot()).toMatchObject({ status: 'error', bundle: null });
    expect(s.repository.discard).toHaveBeenCalledTimes(1);
    await s.service.dispose();
});
it('keeps the last complete candidates when every selected role fails independently', async () => {
    const s = setup();
    await idle(s);
    const first = await start(s);
    s.finish();
    await first.work;
    const previous = s.service.getSnapshot().bundle;
    const next = s.service.start();
    await vi.waitFor(() => expect(s.controller.start).toHaveBeenCalledTimes(2));
    s.finishFailed();
    await next;
    expect(s.service.getSnapshot()).toMatchObject({ status: 'error', bundle: previous });
    expect(s.repository.publish).toHaveBeenCalledTimes(1);
    expect(s.repository.discard).toHaveBeenCalledTimes(1);
    await s.service.dispose();
});
it('finishes cancellation of cache restoration rather than staying cancelling', async () => {
    const s = setup();
    await idle(s);
    await s.service.dispose();
    let reject!: (error: Error) => void;
    vi.mocked(s.repository.restore).mockImplementation(
        () =>
            new Promise<TranscriptionRecord | null>((_yes, no) => {
                reject = no;
            }),
    );
    const service = new EditorTranscriptionService(
        s.transport,
        s.editor,
        {
            getSnapshot: () => ({
                trackId: 'song',
                status: 'ready',
                result: {
                    source: {
                        directory: 'editor-source',
                        hash: 'b'.repeat(64),
                        descriptor: { trackId: 'song', durationSeconds: 10 },
                    },
                },
            }),
            registerSourceConsumer: () => () => {},
            subscribe: (fn: (snapshot: unknown) => void) => {
                fn({
                    trackId: 'song',
                    status: 'ready',
                    result: {
                        source: {
                            directory: 'editor-source',
                            hash: 'b'.repeat(64),
                            descriptor: { trackId: 'song', durationSeconds: 10 },
                        },
                    },
                });
                return () => {};
            },
        } as unknown as EditorSeparationService,
        s.gate,
        { controller: s.controller, repository: s.repository },
    );
    await vi.waitFor(() => expect(reject).toBeTypeOf('function'));
    service.cancel();
    reject(new ProcessingError('job-cancelled', 'cancelled'));
    await vi.waitFor(() => expect(service.getSnapshot().status).toBe('cancelled'));
    await service.dispose();
});
