import type { PlaybackSnapshot } from '../types/audio';
import { normalizeEditorSeconds } from './projectCodec';

interface ScrubGesture {
    trackId: string;
    playbackRate: number;
    secondsPerPixel: number;
    lastX: number;
    held: boolean;
}

interface ScrubberOptions {
    available(): boolean;
    playback(): PlaybackSnapshot;
    seek(seconds: number): Promise<void>;
    requestFrame(callback: () => void): number;
    cancelFrame(id: number): void;
    changed(held: boolean): void;
}

/** Input scheduling only; the shared audio engine remains the sole playback clock. */
export class MarkerRulerScrubber {
    private gesture: ScrubGesture | null = null;
    private queued: { gesture: ScrubGesture; seconds: number } | null = null;
    private inFlight: Promise<void> | null = null;
    private frame: number | null = null;
    private dispatching = false;

    private readonly options: ScrubberOptions;
    constructor(options: ScrubberOptions) {
        this.options = options;
    }

    get hasGesture() {
        return this.gesture !== null;
    }

    private valid(gesture: ScrubGesture): boolean {
        const snapshot = this.options.playback();
        return (
            this.options.available() &&
            snapshot.trackId === gesture.trackId &&
            snapshot.playbackRate === gesture.playbackRate &&
            snapshot.durationSeconds > 0 &&
            ['paused', 'playing', 'buffering', 'ended'].includes(snapshot.state)
        );
    }

    begin(x: number, span: number, width: number): boolean {
        this.cancel();
        const snapshot = this.options.playback();
        if (
            !snapshot.trackId ||
            !Number.isFinite(x) ||
            !Number.isFinite(span) ||
            span <= 0 ||
            !Number.isFinite(width) ||
            width <= 0
        )
            return false;
        const gesture: ScrubGesture = {
            trackId: snapshot.trackId,
            playbackRate: snapshot.playbackRate,
            secondsPerPixel: span / width,
            lastX: x,
            held: true,
        };
        if (!this.valid(gesture)) return false;
        this.gesture = gesture;
        this.options.changed(true);
        return true;
    }

    move(x: number): void {
        const gesture = this.gesture;
        if (!gesture?.held || !Number.isFinite(x)) return;
        if (!this.valid(gesture)) {
            this.cancel();
            return;
        }
        const seconds = (gesture.lastX - x) * gesture.secondsPerPixel;
        gesture.lastX = x;
        if (!seconds) return;
        if (this.queued) this.queued.seconds += seconds;
        else this.queued = { gesture, seconds };
        if (this.frame === null && !this.inFlight)
            this.frame = this.options.requestFrame(() => {
                this.frame = null;
                this.drain();
            });
    }

    end(x: number): void {
        const gesture = this.gesture;
        if (!gesture?.held) return;
        this.move(x);
        if (this.gesture !== gesture) return;
        gesture.held = false;
        this.options.changed(false);
        this.cancelFrame();
        this.drain();
    }

    reconcile(): void {
        if (this.gesture && !this.valid(this.gesture)) this.cancel();
    }

    discontinuity(): void {
        if (!this.dispatching) this.cancel();
    }

    cancel(): void {
        this.gesture = null;
        this.queued = null;
        this.cancelFrame();
        this.options.changed(false);
    }

    private cancelFrame(): void {
        if (this.frame !== null) this.options.cancelFrame(this.frame);
        this.frame = null;
    }

    private drain(): void {
        if (this.inFlight) return;
        const queued = this.queued,
            gesture = this.gesture;
        if (!gesture) return;
        if (!this.valid(gesture)) {
            this.cancel();
            return;
        }
        if (!queued) {
            if (!gesture.held) this.gesture = null;
            return;
        }
        this.queued = null;
        const snapshot = this.options.playback();
        const target = normalizeEditorSeconds(
            Math.max(0, Math.min(snapshot.durationSeconds, snapshot.currentTimeSeconds + queued.seconds)),
        );
        if (target === snapshot.currentTimeSeconds) {
            this.drain();
            return;
        }
        this.dispatching = true;
        let request: Promise<void>;
        try {
            request = this.options.seek(target);
        } catch {
            this.cancel();
            return;
        } finally {
            this.dispatching = false;
        }
        const work = request
            .catch(() => {
                if (this.gesture === queued.gesture) this.cancel();
            })
            .finally(() => {
                if (this.inFlight !== work) return;
                this.inFlight = null;
                this.drain();
            });
        this.inFlight = work;
    }
}
