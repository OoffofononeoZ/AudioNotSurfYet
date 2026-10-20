import { inject, type InjectionKey } from 'vue';
import type { AudioEngine } from '../audio/audioEngine';
import type { AudioSessionService } from '../audio/audioSessionService';
import type { RealtimeAudioLease } from '../audio/realtimeAudioTap';
import type { AnalysisCoordinator } from '../analysis/analysisCoordinator';
import type { RealtimeAnalysisLease } from '../analysis/realtimeTypes';
import type { FeatureId } from '../analysis/types';
import type { PlaybackSnapshot } from '../types/audio';
import type { RealtimeStyleV1 } from './realtimeStyle';
import type { NativeInputFeature } from './nativeAudioAnalysis';
import type { RealtimeSurface } from './realtimeSurface';

export interface RealtimeBrowserDependencies {
    engine: AudioEngine;
    audio: AudioSessionService;
    analysis: AnalysisCoordinator;
}
export const realtimeBrowserKey: InjectionKey<RealtimeBrowserDependencies> = Symbol('realtime-browser');
export function useRealtimeBrowserDependencies() {
    const dependencies = inject(realtimeBrowserKey);
    if (!dependencies) throw Error('实时音频服务未初始化。');
    return dependencies;
}
export class RealtimeBrowserSession {
    private releasePlayback: () => void;
    private audioLease: RealtimeAudioLease | null = null;
    private analysisLease: RealtimeAnalysisLease | null = null;
    private generation = 0;
    private disposed = false;
    private previous: PlaybackSnapshot | null = null;
    private failed = false;
    private dependencies: RealtimeBrowserDependencies;
    private surface: RealtimeSurface;
    private style: RealtimeStyleV1;
    private onError: (message: string) => void;
    constructor(
        dependencies: RealtimeBrowserDependencies,
        surface: RealtimeSurface,
        style: RealtimeStyleV1,
        onError: (message: string) => void,
    ) {
        this.dependencies = dependencies;
        this.surface = surface;
        this.style = style;
        this.onError = onError;
        this.releasePlayback = dependencies.audio.subscribePlayback(playback => this.playback(playback));
        document.addEventListener('visibilitychange', this.visibility);
    }
    private readonly visibility = () => {
        this.stop();
        this.surface.setPaused(document.hidden);
        if (!document.hidden && this.previous) void this.start(this.previous);
    };
    private playback(value: PlaybackSnapshot) {
        const old = this.previous;
        this.previous = value;
        const discontinuity =
            !old ||
            old.trackId !== value.trackId ||
            old.state !== value.state ||
            old.playbackRate !== value.playbackRate ||
            value.currentTimeSeconds < old.currentTimeSeconds ||
            Math.abs(value.currentTimeSeconds - old.currentTimeSeconds) > 0.5;
        if (discontinuity) {
            this.failed = false;
            this.stop();
            void this.start(value);
        }
    }
    private stop() {
        ++this.generation;
        this.audioLease?.release();
        this.audioLease = null;
        this.analysisLease?.release();
        this.analysisLease = null;
        this.surface.resetInput();
    }
    private async start(playback: PlaybackSnapshot) {
        if (this.disposed || this.failed || document.hidden || playback.state !== 'playing') return;
        const generation = this.generation;
        const ids = [
            ...new Set(
                this.style.elements.flatMap(e =>
                    e.bindings.flatMap(b => (b.source.kind === 'analysis' ? [b.source.featureId] : [])),
                ),
            ),
        ] as FeatureId[];
        const native = [
            ...new Set(
                this.style.elements.flatMap(e =>
                    e.bindings.flatMap(b => (b.source.kind === 'native' ? [b.source.featureId] : [])),
                ),
            ),
        ] as NativeInputFeature[];
        if (!ids.length && !native.length) return;
        const current = () => !this.disposed && generation === this.generation;
        const fail = (message: string) => {
            if (current()) {
                this.failed = true;
                this.stop();
                this.onError(message);
            }
        };
        let port: MessagePort | undefined;
        try {
            if (ids.length) {
                const channel = new MessageChannel();
                port = channel.port1;
                this.analysisLease = this.dependencies.analysis.acquireRealtime(
                    channel.port2,
                    this.dependencies.engine.getRealtimeSampleRate(),
                    ids,
                    frame => {
                        if (current()) this.surface.setFeatures(frame.values);
                    },
                    fail,
                );
            }
            const lease = await this.dependencies.engine.acquireRealtimeInput({
                analysisPort: port,
                nativeFeatures: native,
                onError: fail,
            });
            if (!current()) {
                lease.release();
                return;
            }
            this.audioLease = lease;
            this.surface.readNative = () => lease.readNative();
        } catch (error) {
            port?.close();
            fail((error as Error).message);
        }
    }
    retry() {
        this.failed = false;
        this.onError('');
        this.stop();
        this.surface.retry();
        if (this.previous) void this.start(this.previous);
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.stop();
        this.releasePlayback();
        document.removeEventListener('visibilitychange', this.visibility);
    }
}
