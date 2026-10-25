import type { DecodedAudioCopyPort } from '../analysis/pcm';
import type { DecodedAudioDescriptor } from '../types/audio';
import type { ExportArtifact } from './exportArtifact';
import type { ExportVideoCodec, VisualizerExportPreset } from './exportTypes';
import { checkExportCancelled } from './exportTypes';
import { exportAudioChunk, assertExportAudio } from './offlineExportAudio';
import { exportTimeline } from './offlineExportTimeline';

export interface OfflineExportOptions {
    source: DecodedAudioCopyPort;
    descriptor: DecodedAudioDescriptor;
    preset: VisualizerExportPreset;
    audioVideoOffsetMs: number;
    codec: ExportVideoCodec;
    canvas: HTMLCanvasElement;
    artifact: ExportArtifact;
    signal: AbortSignal;
    prepareFrame(timeSeconds: number, signal: AbortSignal): Promise<void>;
    renderFrame(timeSeconds: number): void | Promise<void>;
    onProgress(done: number, total: number): void;
    onFinalizing(): void;
    yieldControl?: () => Promise<void>;
}

/** Render/capture stays in one task; only explicit sample indices advance media time. */
export async function runOfflineExport(options: OfflineExportOptions): Promise<File> {
    const { source, descriptor, preset, codec, canvas, artifact, signal } = options;
    const { Output, WebMOutputFormat, StreamTarget, CanvasSource, AudioSampleSource, AudioSample, Quality } =
        await import('mediabunny');
    checkExportCancelled(signal);
    const timeline = exportTimeline(descriptor, preset.frameRate, options.audioVideoOffsetMs);
    const output = new Output({
        format: new WebMOutputFormat({ appendOnly: false }),
        target: new StreamTarget(artifact.writable, { chunked: true, chunkSize: 1024 * 1024 }),
    });
    const video = new CanvasSource(canvas, {
        codec,
        quality: new Quality({ bitrate: preset.videoBitsPerSecond }),
        latencyMode: 'quality',
        hardwareAcceleration: 'no-preference',
        keyFrameInterval: 2,
    });
    const audio = new AudioSampleSource({
        codec: 'opus',
        quality: new Quality({ bitrate: preset.audioBitsPerSecond }),
        transform: { sampleRate: 48000, numberOfChannels: 2 },
    });
    output.addVideoTrack(video, { frameRate: preset.frameRate });
    output.addAudioTrack(audio);
    const cancellation = new AbortController();
    const abort = () => {
        cancellation.abort(signal.reason);
        void output.cancel().catch(() => undefined);
    };
    signal.addEventListener('abort', abort, { once: true });
    const check = () => {
        checkExportCancelled(signal);
        checkExportCancelled(cancellation.signal);
        assertExportAudio(source, descriptor);
    };
    const yieldControl = options.yieldControl ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
    let frameIndex = 0,
        sampleStart = 0;
    try {
        check();
        await output.start();
        options.onProgress(0, timeline.totalFrames);
        for (let second = 0; second < Math.ceil(timeline.durationSeconds); second++) {
            check();
            const frameEnd = Math.min(timeline.totalFrames, (second + 1) * preset.frameRate);
            const sampleEnd = Math.min(timeline.totalAudioSamples, Math.round((second + 1) * descriptor.sampleRate));
            const work = [
                (async () => {
                    while (frameIndex < frameEnd) {
                        check();
                        const frame = timeline.frame(frameIndex);
                        await options.prepareFrame(frame.timeSeconds, cancellation.signal);
                        check();
                        await options.renderFrame(frame.timeSeconds);
                        check();
                        // add() snapshots synchronously, before any await/yield can clear WebGL's drawing buffer.
                        await video.add(frame.timestampUs / 1e6, frame.durationUs / 1e6);
                        check();
                        frameIndex++;
                        options.onProgress(frameIndex, timeline.totalFrames);
                        await yieldControl();
                    }
                })(),
                (async () => {
                    if (sampleStart === sampleEnd) return;
                    const sample = new AudioSample(
                        exportAudioChunk(
                            source,
                            descriptor,
                            sampleStart,
                            sampleEnd - sampleStart,
                            timeline.audioStartSample,
                            timeline.totalAudioSamples,
                        ),
                    );
                    try {
                        await audio.add(sample);
                        check();
                        sampleStart = sampleEnd;
                    } finally {
                        sample.close();
                    }
                })(),
            ];
            try {
                await Promise.all(work);
            } catch (error) {
                cancellation.abort(error);
                await output.cancel().catch(() => undefined);
                await Promise.allSettled(work);
                throw error;
            }
        }
        check();
        video.close();
        audio.close();
        options.onFinalizing();
        await output.finalize();
        check();
        return await artifact.file();
    } catch (error) {
        cancellation.abort(error);
        await output.cancel().catch(() => undefined);
        throw error;
    } finally {
        signal.removeEventListener('abort', abort);
    }
}
