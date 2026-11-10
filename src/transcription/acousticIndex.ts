import { createAnalysisConfig } from '../analysis/config';
import { extractM10Frame, vectorMeydaValue } from '../analysis/meydaAdapter';
import type { PcmReader } from '../processing/dsp';
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { hashBytes } from '../processing/sha256';
import { MonoResampler } from './monoResampler';
import type { TranscriptionProgress } from './modelSession';

export const ACOUSTIC_CONFIG = {
    version: 'same-song-mfcc-chroma-v1',
    sampleRate: 22050,
    frameSize: 1024,
    hopSize: 512,
    mfccWidth: 13,
    chromaWidth: 12,
    batchFrames: 128,
} as const;
export const ACOUSTIC_CONFIG_HASH = hashBytes(new TextEncoder().encode(JSON.stringify(ACOUSTIC_CONFIG)));

/** Compact DSP index, owned by the processing Worker; no PCM or model confidence. */
export interface AcousticIndex {
    configHash: string;
    sourceFrames: number;
    sourceSampleRate: number;
    durationSeconds: number;
    frameCount: number;
    rms: Float32Array;
    onset: Float32Array;
    mfcc: Float32Array;
    chroma: Float32Array;
}
export interface AcousticEvidence {
    rms: number;
    localContrast: number;
    onset: number;
    onsetSeconds: number;
    mfcc: number[];
    chroma: number[];
}

export async function buildAcousticIndex(
    source: PcmReader,
    signal: AbortSignal,
    progress: TranscriptionProgress,
): Promise<AcousticIndex> {
    checkCancelled(signal);
    if (!Number.isSafeInteger(source.frames) || source.frames <= 0)
        throw new ProcessingError('invalid-request', 'Invalid acoustic index input.');
    const config = ACOUSTIC_CONFIG;
    const resampler = new MonoResampler(source.sampleRate, config.sampleRate);
    const samples = Math.ceil((source.frames * config.sampleRate) / source.sampleRate);
    const frameCount = Math.ceil(samples / config.hopSize);
    let index: AcousticIndex;
    try {
        index = {
            configHash: ACOUSTIC_CONFIG_HASH,
            sourceFrames: source.frames,
            sourceSampleRate: source.sampleRate,
            durationSeconds: source.frames / source.sampleRate,
            frameCount,
            rms: new Float32Array(frameCount),
            onset: new Float32Array(frameCount),
            mfcc: new Float32Array(frameCount * config.mfccWidth),
            chroma: new Float32Array(frameCount * config.chromaWidth),
        };
    } catch {
        throw new ProcessingError('memory-unavailable', 'Not enough memory for acoustic descriptors.');
    }
    const analysis = await createAnalysisConfig(config.sampleRate);
    let previous = new Array<number>(config.frameSize / 2).fill(0);
    for (let start = 0; start < frameCount; start += config.batchFrames) {
        checkCancelled(signal);
        const count = Math.min(config.batchFrames, frameCount - start);
        const pcm = await resampler.segment(
            source,
            start * config.hopSize,
            (count - 1) * config.hopSize + config.frameSize,
            signal,
        );
        for (let offset = 0; offset < count; offset++) {
            checkCancelled(signal);
            const frame = pcm.subarray(offset * config.hopSize, offset * config.hopSize + config.frameSize);
            const position = start + offset;
            let energy = 0;
            for (const sample of frame) energy += sample * sample;
            const rms = Math.sqrt(energy / config.frameSize);
            index.rms[position] = rms;
            if (rms < 1e-7) {
                previous.fill(0);
                continue;
            }
            const { values } = extractM10Frame(['mfcc', 'chroma', 'amplitudeSpectrum'], frame, analysis);
            const spectrum = vectorMeydaValue(values, 'amplitudeSpectrum', config.frameSize / 2);
            let increase = 0,
                mass = 0;
            for (let bin = 0; bin < spectrum.length; bin++) {
                increase += Math.max(0, spectrum[bin]! - previous[bin]!);
                mass += spectrum[bin]! + previous[bin]!;
            }
            index.onset[position] = increase / Math.max(1e-12, mass);
            index.mfcc.set(vectorMeydaValue(values, 'mfcc', config.mfccWidth), position * config.mfccWidth);
            index.chroma.set(vectorMeydaValue(values, 'chroma', config.chromaWidth), position * config.chromaWidth);
            previous = spectrum;
        }
        progress('acoustic-index', start + count, frameCount);
        // Let cancellation and source-change commands reach this Worker.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
    }
    checkCancelled(signal);
    return index;
}

export function acousticFrameSeconds(frame: number): number {
    return (frame * ACOUSTIC_CONFIG.hopSize + ACOUSTIC_CONFIG.frameSize / 2) / ACOUSTIC_CONFIG.sampleRate;
}

/** Evidence stays separate from model activation/velocity and never denotes accuracy. */
export function acousticEvidence(index: AcousticIndex, startSeconds: number, endSeconds: number): AcousticEvidence {
    if (
        !Number.isFinite(startSeconds) ||
        !Number.isFinite(endSeconds) ||
        startSeconds < 0 ||
        endSeconds < startSeconds ||
        endSeconds > index.durationSeconds
    )
        throw new ProcessingError('invalid-request', 'Invalid acoustic evidence interval.');
    const config = ACOUSTIC_CONFIG;
    const frameAt = (seconds: number) =>
        Math.max(
            0,
            Math.min(
                index.frameCount - 1,
                Math.round((seconds * config.sampleRate - config.frameSize / 2) / config.hopSize),
            ),
        );
    const first = frameAt(startSeconds),
        last = frameAt(Math.min(index.durationSeconds, Math.max(endSeconds, startSeconds + 0.1)));
    const background = Array.from(
        index.rms.subarray(
            frameAt(Math.max(0, startSeconds - 1)),
            frameAt(Math.min(index.durationSeconds, endSeconds + 1)) + 1,
        ),
    ).sort((a, b) => a - b);
    const floor = background[Math.floor(background.length / 2)] ?? 0;
    let peak = 0,
        energy = 0;
    const mfcc = new Array<number>(config.mfccWidth).fill(0),
        chroma = new Array<number>(config.chromaWidth).fill(0);
    for (let frame = first; frame <= last; frame++) {
        const rms = index.rms[frame]!;
        peak = Math.max(peak, rms);
        energy += rms * rms;
        for (let column = 0; column < config.mfccWidth; column++)
            mfcc[column] = mfcc[column]! + index.mfcc[frame * config.mfccWidth + column]!;
        for (let column = 0; column < config.chromaWidth; column++)
            chroma[column] = chroma[column]! + index.chroma[frame * config.chromaWidth + column]!;
    }
    let onsetFrame = first;
    for (
        let frame = frameAt(Math.max(0, startSeconds - 0.07));
        frame <= frameAt(Math.min(index.durationSeconds, startSeconds + 0.07));
        frame++
    )
        if (index.onset[frame]! > index.onset[onsetFrame]!) onsetFrame = frame;
    const count = last - first + 1;
    return {
        rms: Math.sqrt(energy / count),
        localContrast: Math.min(100, peak / Math.max(1e-5, floor)),
        onset: index.onset[onsetFrame]!,
        onsetSeconds: Math.min(index.durationSeconds, acousticFrameSeconds(onsetFrame)),
        mfcc: mfcc.map(value => value / count),
        chroma: chroma.map(value => value / count),
    };
}

export function validAcousticIndex(index: AcousticIndex): boolean {
    const c = ACOUSTIC_CONFIG;
    return (
        !!index &&
        index.configHash === ACOUSTIC_CONFIG_HASH &&
        Number.isSafeInteger(index.sourceFrames) &&
        index.sourceFrames > 0 &&
        Number.isSafeInteger(index.sourceSampleRate) &&
        index.sourceSampleRate >= 8000 &&
        index.sourceSampleRate <= 192000 &&
        Number.isFinite(index.durationSeconds) &&
        index.durationSeconds > 0 &&
        Number.isSafeInteger(index.frameCount) &&
        index.frameCount > 0 &&
        index.durationSeconds === index.sourceFrames / index.sourceSampleRate &&
        index.frameCount ===
            Math.ceil(Math.ceil((index.sourceFrames * c.sampleRate) / index.sourceSampleRate) / c.hopSize) &&
        (
            [
                ['rms', 1],
                ['onset', 1],
                ['mfcc', c.mfccWidth],
                ['chroma', c.chromaWidth],
            ] as const
        ).every(
            ([key, width]) =>
                index[key] instanceof Float32Array &&
                index[key].length === index.frameCount * width &&
                index[key].every(Number.isFinite),
        ) &&
        index.rms.every(value => value >= 0) &&
        index.onset.every(value => value >= 0 && value <= 1)
    );
}
