import { expect, it, vi } from 'vitest';
import { EditorExampleService } from '../../src/transcription/examples/service';
import { ExampleRepository } from '../../src/transcription/examples/repository';
import type { ExampleProfile, ExampleSearchResult } from '../../src/transcription/examples/types';
import { EditorProcessingGate } from '../../src/processing/editorProcessingGate';
import type { EditorSeparationService } from '../../src/processing/editorSeparationService';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import type { EditorSessionSnapshot } from '../../src/editor/types';

function setup() {
    let descriptor = {
            trackId: 'song',
            revision: 1,
            sampleRate: 44100,
            length: 441000,
            channelCount: 2,
            durationSeconds: 10,
        },
        snapshot = {
            state: 'ready',
            activeTrackId: 'song',
            project: createInitialEditorProject({
                track: {
                    contentHash: 'a'.repeat(64),
                    fileName: 'song.wav',
                    durationSeconds: 10,
                },
            }),
        } as EditorSessionSnapshot;
    const listeners = new Set<(snapshot: EditorSessionSnapshot) => void>(),
        saved = new Map<string, ExampleProfile>(),
        repository = new ExampleRepository();
    vi.spyOn(repository, 'profiles').mockImplementation(async hash =>
        [...saved.values()].filter(p => p.songHash === hash),
    );
    vi.spyOn(repository, 'save').mockImplementation(async profile => {
        saved.set(profile.id, structuredClone(profile));
    });
    const gate = new EditorProcessingGate(),
        verifyCurrentResult = vi.fn(),
        controller = { search: vi.fn(), cancel: vi.fn() },
        editor = {
            getSnapshot: () => snapshot,
            updateProject: vi.fn(),
            subscribe: (fn: (snapshot: EditorSessionSnapshot) => void) => {
                listeners.add(fn);
                fn(snapshot);
                return () => {
                    listeners.delete(fn);
                };
            },
        },
        transport = {
            setAuditionSource: vi.fn(async () => {}),
            setAuditionMuted: vi.fn(),
            subscribePlayback: vi.fn(() => () => {}),
            play: vi.fn(async () => {}),
            pause: vi.fn(),
        },
        separation = {
            getSnapshot: () => ({ status: 'idle', result: null, cacheLimit: 1e9 }),
            subscribe: (fn: () => void) => {
                fn();
                return () => {};
            },
            verifyCurrentResult,
        } as unknown as EditorSeparationService,
        service = new EditorExampleService({
            decoded: { getDecodedAudioDescriptor: () => descriptor, copyDecodedChannelRange: () => null },
            transport,
            editor,
            separation,
            gate,
            repository,
            controller,
            getBundle: () => null,
            verifyAuxiliary: vi.fn(),
            seek: vi.fn(async () => {}),
        });
    return {
        service,
        gate,
        controller,
        repository,
        saved,
        verifyCurrentResult,
        editor,
        revise: (newSong: boolean) => {
            descriptor = { ...descriptor, revision: descriptor.revision + 1 };
            if (newSong)
                snapshot = {
                    ...snapshot,
                    project: {
                        ...snapshot.project!,
                        track: { ...snapshot.project!.track, contentHash: 'c'.repeat(64) },
                    },
                };
            listeners.forEach(fn => fn(snapshot));
        },
    };
}
const result = (): ExampleSearchResult => ({
    matches: [],
    coarseCandidates: 1,
    refinedCandidates: 1,
    indexRestored: false,
    elapsedMs: 1,
});
it('works on original audio before FT, persists groups/examples and restores them for the same song after decode revision changes', async () => {
    const f = setup();
    await vi.waitFor(() => expect(f.service.getSnapshot().profile).not.toBeNull());
    expect(f.service.getSnapshot().sources.map(s => s.kind)).toEqual(['original']);
    f.service.addExample({ polarity: 'positive', kind: 'range', startSeconds: 1, endSeconds: 2 });
    f.service.editSettings({ label: '明显声音', threshold: 0.9 });
    expect(await f.service.flushEdits()).toBe(true);
    f.service.createGroup('第二声音组');
    f.service.addExample({ polarity: 'positive', kind: 'point', startSeconds: 3, endSeconds: 3 });
    await f.service.flushEdits();
    const before = f.service.getSnapshot().profile!;
    f.revise(false);
    await vi.waitFor(() => expect(f.service.getSnapshot().profile?.id).toBe(before.id));
    expect(f.service.getSnapshot().profile).toEqual(before);
    f.controller.search.mockResolvedValue(result());
    await f.service.search();
    expect(f.verifyCurrentResult).not.toHaveBeenCalled();
    expect(f.gate.current).toBeNull();
    await f.service.dispose();
});
it('cancels source changes, releases the shared slot and never publishes the old song result', async () => {
    const f = setup();
    await vi.waitFor(() => expect(f.service.getSnapshot().profile).not.toBeNull());
    f.service.addExample({ polarity: 'positive', kind: 'point', startSeconds: 1, endSeconds: 1 });
    await f.service.flushEdits();
    let resolve!: (result: ExampleSearchResult) => void;
    f.controller.search.mockImplementation(
        () =>
            new Promise(yes => {
                resolve = yes;
            }),
    );
    const operation = f.service.search();
    await vi.waitFor(() => expect(f.controller.search).toHaveBeenCalled());
    expect(f.gate.current).toBe('transcription');
    expect(() => f.gate.acquire('separation')).toThrow();
    f.revise(true);
    resolve(result());
    await operation;
    await vi.waitFor(() => expect(f.service.getSnapshot().profile?.songHash).toBe('c'.repeat(64)));
    expect(f.service.getSnapshot().profile?.queryHash).toBeNull();
    expect(f.gate.current).toBeNull();
    expect(f.editor.updateProject).not.toHaveBeenCalled();
    await f.service.dispose();
});
it('retains editable examples after quota failure and retries persistence without model execution', async () => {
    const f = setup();
    await vi.waitFor(() => expect(f.service.getSnapshot().profile).not.toBeNull());
    vi.mocked(f.repository.save).mockRejectedValueOnce(Error('quota'));
    f.service.addExample({ polarity: 'positive', kind: 'point', startSeconds: 1, endSeconds: 1 });
    await vi.waitFor(() => expect(f.service.getSnapshot().persistence).toBe('not-persisted'));
    expect(f.service.getSnapshot().profile?.examples).toHaveLength(1);
    expect(await f.service.flushEdits()).toBe(true);
    expect(f.controller.search).not.toHaveBeenCalled();
    await f.service.dispose();
});
