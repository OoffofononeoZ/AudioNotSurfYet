import { describe, expect, test } from 'vitest';
import { resolveEditorUnavailableRecovery, type EditorUnavailableRecoveryInput } from '../../src/editor/routeRecovery';
import { EDITOR_WAVEFORM_VERTICAL_PADDING_PX, editorWaveformVerticalGeometry } from '../../src/editor/timeline';
import type { TrackRecord } from '../../src/types/audio';

const track = (id: string, restoreState: TrackRecord['restoreState'] = 'available'): TrackRecord => ({
    id,
    name: `${id}.wav`,
    mimeType: 'audio/wav',
    byteSize: 1024,
    lastModified: 1,
    durationSeconds: 12,
    metadata: { title: `Title ${id}` },
    trackHash: id.repeat(64).slice(0, 64),
    restoreState,
});

const recoveryInput = (patch: Partial<EditorUnavailableRecoveryInput> = {}): EditorUnavailableRecoveryInput => ({
    routeTrackId: 'a',
    queue: [track('a'), track('b')],
    currentTrackId: 'a',
    playback: {
        trackId: 'a',
        state: 'paused',
        currentTimeSeconds: 0,
        durationSeconds: 12,
        volume: 1,

        playbackRate: 1,
    },
    persistenceState: 'ready',
    ...patch,
});

describe('Editor E8 usability contracts', () => {
    test.each([
        [88, 44, 38, 6, 82],
        [72, 36, 30, 6, 66],
    ])('centers the waveform inside a %ipx stage', (height, centerY, amplitude, minimumY, maximumY) => {
        const geometry = editorWaveformVerticalGeometry(height);
        expect(geometry).toEqual({
            centerY,
            amplitude,
            padding: EDITOR_WAVEFORM_VERTICAL_PADDING_PX,
        });
        expect(geometry.centerY - geometry.amplitude).toBe(minimumY);
        expect(geometry.centerY + geometry.amplitude).toBe(maximumY);
    });

    test('never returns a negative amplitude for invalid or tiny stages', () => {
        expect(editorWaveformVerticalGeometry(0).amplitude).toBe(0);
        expect(editorWaveformVerticalGeometry(8).amplitude).toBe(0);
        expect(editorWaveformVerticalGeometry(Number.NaN).centerY).toBe(0);
    });

    test('retries only an exact route target that can be acquired safely', () => {
        const paused = resolveEditorUnavailableRecovery(recoveryInput());
        expect(paused).toMatchObject({ kind: 'retry-route', trackId: 'a' });
        const playing = resolveEditorUnavailableRecovery(
            recoveryInput({
                playback: {
                    ...recoveryInput().playback,
                    state: 'playing',
                },
            }),
        );
        const ended = resolveEditorUnavailableRecovery(
            recoveryInput({
                playback: {
                    ...recoveryInput().playback,
                    state: 'ended',
                },
            }),
        );
        expect(playing.kind).toBe('retry-route');
        expect(ended.kind).toBe('retry-route');
        if (paused.kind === 'retry-route' && playing.kind === 'retry-route' && ended.kind === 'retry-route') {
            expect(playing.signature).toBe(paused.signature);
            expect(ended.signature).toBe(paused.signature);
        }
        expect(
            resolveEditorUnavailableRecovery(
                recoveryInput({
                    currentTrackId: 'b',
                    playback: {
                        ...recoveryInput().playback,
                        trackId: 'b',
                    },
                }),
            ),
        ).toMatchObject({ kind: 'retry-route', trackId: 'a' });
        expect(
            resolveEditorUnavailableRecovery(
                recoveryInput({
                    persistenceState: 'restoring',
                }),
            ),
        ).toEqual({ kind: 'none' });
        expect(
            resolveEditorUnavailableRecovery(
                recoveryInput({
                    queue: [track('a', 'decode-error')],
                    playback: {
                        ...recoveryInput().playback,
                        state: 'error',
                    },
                }),
            ),
        ).toEqual({ kind: 'none' });
    });

    test('offers a different playable current song without silently switching', () => {
        expect(
            resolveEditorUnavailableRecovery(
                recoveryInput({
                    routeTrackId: 'missing',
                    currentTrackId: 'b',
                    playback: {
                        ...recoveryInput().playback,
                        trackId: 'b',
                        state: 'ended',
                    },
                }),
            ),
        ).toEqual({
            kind: 'offer-current',
            trackId: 'b',
            title: 'Title b',
        });
        expect(
            resolveEditorUnavailableRecovery(
                recoveryInput({
                    routeTrackId: 'missing',
                    currentTrackId: 'b',
                    playback: {
                        ...recoveryInput().playback,
                        trackId: 'b',
                        state: 'loading',
                    },
                }),
            ),
        ).toEqual({ kind: 'none' });
    });
});
