import { describe, expect, test, vi } from 'vitest';
import { MarkerRulerScrubber } from '../../src/editor/markerRulerScrubber';
import type { PlaybackSnapshot } from '../../src/types/audio';

function harness() {
    let snapshot: PlaybackSnapshot = {
        trackId: 'song',
        state: 'paused',
        currentTimeSeconds: 3,
        durationSeconds: 12,
        volume: 1,
        playbackRate: 1,
    };
    let available = true,
        frameId = 0;
    const frames = new Map<number, () => void>(),
        changed = vi.fn();
    const seek = vi.fn(async (seconds: number) => {
        snapshot = { ...snapshot, currentTimeSeconds: seconds };
    });
    const scrubber = new MarkerRulerScrubber({
        available: () => available,
        playback: () => snapshot,
        seek,
        changed,
        requestFrame: callback => {
            frames.set(++frameId, callback);
            return frameId;
        },
        cancelFrame: id => {
            frames.delete(id);
        },
    });
    return {
        scrubber,
        seek,
        changed,
        frames,
        patch(value: Partial<PlaybackSnapshot>) {
            snapshot = { ...snapshot, ...value };
        },
        unavailable() {
            available = false;
            scrubber.reconcile();
        },
        frame() {
            const pending = [...frames.values()];
            frames.clear();
            pending.forEach(callback => callback());
        },
        snapshot: () => snapshot,
    };
}
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

describe('marker ruler continuous scrubbing', () => {
    test('press does not seek; movement is continuous, left advances and natural playback time is preserved', async () => {
        const h = harness();
        expect(h.scrubber.begin(100, 10, 100)).toBe(true);
        expect(h.seek).not.toHaveBeenCalled();
        h.scrubber.move(87.654);
        expect(h.seek).not.toHaveBeenCalled();
        h.frame();
        await settle();
        expect(h.snapshot().currentTimeSeconds).toBe(4.2346);
        h.patch({ state: 'playing', playbackRate: 2, currentTimeSeconds: 5 });
        h.scrubber.reconcile();
        expect(h.scrubber.hasGesture).toBe(false);
        h.scrubber.begin(100, 10, 100);
        h.patch({ currentTimeSeconds: 6 });
        h.scrubber.move(110);
        h.scrubber.end(110);
        await settle();
        expect(h.snapshot()).toMatchObject({ currentTimeSeconds: 5, state: 'playing', playbackRate: 2 });
        expect(h.scrubber.hasGesture).toBe(false);
        h.scrubber.begin(100, 10, 100);
        h.scrubber.end(100);
        expect(h.scrubber.hasGesture).toBe(false);
    });

    test('keeps one in-flight seek and accumulates only one pending displacement, including mouseup', async () => {
        const h = harness();
        let finish!: () => void;
        h.seek.mockImplementationOnce(
            seconds =>
                new Promise(resolve => {
                    finish = () => {
                        h.patch({ currentTimeSeconds: seconds });
                        resolve();
                    };
                }),
        );
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(90);
        h.frame();
        h.scrubber.move(80);
        h.scrubber.move(70);
        h.scrubber.end(60);
        expect(h.seek).toHaveBeenCalledTimes(1);
        expect(h.frames.size).toBe(0);
        finish();
        await settle();
        expect(h.seek.mock.calls.map(([time]) => time)).toEqual([4, 7]);
        expect(h.snapshot().currentTimeSeconds).toBe(7);
        expect(h.scrubber.hasGesture).toBe(false);
    });

    test('cancel discards queued work, preserves applied seeks and does not dispatch against a new source', async () => {
        const h = harness();
        let finish!: () => void;
        h.seek.mockImplementationOnce(
            seconds =>
                new Promise(resolve => {
                    finish = () => {
                        h.patch({ currentTimeSeconds: seconds });
                        resolve();
                    };
                }),
        );
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(90);
        h.frame();
        h.scrubber.move(80);
        h.scrubber.cancel();
        finish();
        await settle();
        expect(h.seek).toHaveBeenCalledTimes(1);
        expect(h.snapshot().currentTimeSeconds).toBe(4);
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(50);
        h.patch({ trackId: 'new-song' });
        h.frame();
        expect(h.seek).toHaveBeenCalledTimes(1);
        expect(h.scrubber.hasGesture).toBe(false);
    });

    test('ignores its own synchronous seek notification, cancels external changes and clamps song endpoints', async () => {
        const h = harness();
        h.seek.mockImplementation(async seconds => {
            h.scrubber.discontinuity();
            h.patch({ currentTimeSeconds: seconds });
        });
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(-1000);
        h.frame();
        await settle();
        expect(h.snapshot().currentTimeSeconds).toBe(12);
        expect(h.scrubber.hasGesture).toBe(true);
        h.scrubber.move(1000);
        h.scrubber.end(1000);
        await settle();
        expect(h.snapshot().currentTimeSeconds).toBe(0);
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(90);
        h.scrubber.discontinuity();
        expect(h.frames.size).toBe(0);
        expect(h.scrubber.hasGesture).toBe(false);
        h.scrubber.begin(100, 10, 100);
        h.unavailable();
        expect(h.scrubber.hasGesture).toBe(false);
        expect(h.scrubber.begin(100, 10, 100)).toBe(false);
    });

    test('rejects invalid geometry and clears a failed request without sending queued edits', async () => {
        const h = harness();
        expect(h.scrubber.begin(0, 10, 0)).toBe(false);
        expect(h.scrubber.begin(NaN, 10, 100)).toBe(false);
        h.seek.mockRejectedValueOnce(Error('read failed'));
        h.scrubber.begin(100, 10, 100);
        h.scrubber.move(90);
        h.frame();
        h.scrubber.end(80);
        await settle();
        expect(h.seek).toHaveBeenCalledTimes(1);
        expect(h.scrubber.hasGesture).toBe(false);
        expect(h.frames.size).toBe(0);
    });
});
