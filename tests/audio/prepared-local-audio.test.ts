import { createPinia, setActivePinia } from 'pinia';
import { expect, test, vi } from 'vitest';
import { AudioSessionService, type AudioEnginePort } from '../../src/audio/audioSessionService';
import { useAudioSessionStore } from '../../src/stores/audioSessionStore';
import type { PlaybackSnapshot } from '../../src/types/audio';
import type { SessionRepositoryPort } from '../../src/persistence/sessionRepository';

function harness(hashFile: (file: Blob) => Promise<string> = async () => 'a'.repeat(64)) {
    setActivePinia(createPinia());
    const store = useAudioSessionStore();
    let snapshot: PlaybackSnapshot = {
        trackId: null,
        state: 'empty',
        currentTimeSeconds: 0,
        durationSeconds: 0,
        playbackRate: 1,
        volume: 1,
    };
    let listener = (_: PlaybackSnapshot) => {};
    const tokens = new Set<symbol>();
    const engine: AudioEnginePort = {
        load: async () => 'loaded',
        play: async () => {},
        pause: () => {},
        seek: async () => {},
        setVolume: () => {},
        setPlaybackRate: async () => {},
        setAuditionSource: async () => {},
        setAuditionMuted: () => {},
        getTimeDomainFloatData: () => null,
        getSnapshot: () => snapshot,
        getDecodedAudioDescriptor: () =>
            snapshot.trackId
                ? {
                      trackId: snapshot.trackId,
                      revision: 1,
                      durationSeconds: 4,
                      sampleRate: 48000,
                      length: 192000,
                      channelCount: 1,
                  }
                : null,
        capturePlaybackCheckpoint: () => null,
        restorePlaybackCheckpoint: async () => {},
        copyDecodedChannelRange: () => null,
        subscribe: next => {
            listener = next;
            next(snapshot);
            return () => {};
        },
        unload: () => {},
        dispose: async () => {},
        prepareEncodedAudio: vi.fn(async () => {
            const token = Symbol();
            tokens.add(token);
            return { token, durationSeconds: 4, sampleRate: 48000, length: 192000, channelCount: 1 };
        }),
        hasPreparedAudio: token => tokens.has(token),
        discardPreparedAudio: token => {
            tokens.delete(token);
        },
        commitPreparedAudio: (token, trackId) => {
            if (!tokens.delete(token)) throw Error('expired');
            snapshot = { ...snapshot, trackId, state: 'paused', durationSeconds: 4 };
            listener(snapshot);
        },
    };
    const repository: SessionRepositoryPort = {
        restore: async () => null,
        saveQueue: vi.fn(async () => {}),
        replaceCurrent: vi.fn(async () => {}),
        replaceCurrentAnalysisCache: async () => 'stored',
        removeTrack: async () => {},
        clear: async () => {},
    };
    const audio = new AudioSessionService(store, {
        engine,
        repository,
        parseMetadata: async () => ({ common: { title: 'Source' }, format: { duration: 999 } }),
        hashFile,
        requestFrame: () => 1,
        cancelFrame: () => {},
    });
    return { store, engine, repository, audio, tokens };
}

test('preparation is private until commit, uses decoded duration and reuses a matching current track', async () => {
    const h = harness(),
        input = { file: new File([new Uint8Array([1])], 'audio.wav') };
    const prepared = await h.audio.prepareLocalAudio(input);
    expect(prepared.descriptor.durationSeconds).toBe(4);
    expect(prepared.track.durationSeconds).toBe(4);
    expect(h.store.queue).toHaveLength(0);
    expect(h.store.currentTrackId).toBeNull();
    expect(h.repository.replaceCurrent).not.toHaveBeenCalled();
    const id = h.audio.commitPreparedLocalAudio(prepared.token);
    expect(h.store.currentTrackId).toBe(id);
    expect(h.store.queue).toHaveLength(1);
    expect(h.store.playback.state).toBe('paused');
    expect(h.repository.replaceCurrent).toHaveBeenCalledOnce();
    const same = await h.audio.prepareLocalAudio(input);
    expect(same.track.id).toBe(id);
    expect(h.engine.prepareEncodedAudio).toHaveBeenCalledOnce();
    h.audio.commitPreparedLocalAudio(same.token);
    expect(h.store.queue).toHaveLength(1);
    await h.audio.dispose();
});

test('discarded and disposed preparations cannot publish tracks or persisted sessions', async () => {
    const h = harness(),
        input = { file: new File([new Uint8Array([1])], 'audio.wav') };
    const prepared = await h.audio.prepareLocalAudio(input);
    h.audio.discardPreparedLocalAudio(prepared.token);
    expect(h.tokens.size).toBe(0);
    expect(() => h.audio.commitPreparedLocalAudio(prepared.token)).toThrow();
    const pending = await h.audio.prepareLocalAudio(input);
    await h.audio.dispose();
    expect(h.tokens.size).toBe(0);
    expect(() => h.audio.commitPreparedLocalAudio(pending.token)).toThrow();
    expect(h.repository.replaceCurrent).not.toHaveBeenCalled();
    const abort = new AbortController();
    abort.abort();
    await expect(h.audio.prepareLocalAudio(input, abort.signal)).rejects.toMatchObject({ name: 'AbortError' });
});

test('disposal while hashing prevents a late decode and session write', async () => {
    let finishHash!: (hash: string) => void;
    const h = harness(
        () =>
            new Promise(resolve => {
                finishHash = resolve;
            }),
    );
    const preparing = h.audio.prepareLocalAudio({ file: new File([new Uint8Array([1])], 'audio.wav') });
    const rejected = expect(preparing).rejects.toMatchObject({ name: 'AbortError' });
    await h.audio.dispose();
    finishHash('a'.repeat(64));
    await rejected;
    expect(h.engine.prepareEncodedAudio).not.toHaveBeenCalled();
    expect(h.repository.replaceCurrent).not.toHaveBeenCalled();
    expect(h.store.queue).toHaveLength(0);
});
