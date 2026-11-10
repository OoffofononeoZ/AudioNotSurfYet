// Note decoding adapted from Spotify Basic Pitch v0.4.0 (Apache-2.0).
// Copyright 2022 Spotify AB. See licenses/BasicPitch-LICENSE.txt.
// This adapter uses explicit source-window times and returns notes, never MIDI.
import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import { TRANSCRIPTION_CONFIG } from './modelManifest';
import type { PitchDecodeOptions } from './analysisOptions';

export interface PitchActivations {
    frames: Float32Array;
    onsets: Float32Array;
    times: Float64Array;
}
export interface PitchNote {
    startSeconds: number;
    endSeconds: number;
    pitch: number;
    strength: number;
    onsetStrength: number;
}
const WIDTH = 88;

// Activations only ever change to zero. A heap ordered by their original values
// reproduces the global argmax without rescanning a full song for every note.
class EnergyHeap {
    private readonly indices: Int32Array;
    private length: number;
    private readonly values: Float32Array;
    constructor(values: Float32Array, threshold: number) {
        this.values = values;
        let count = 0;
        for (const value of values) if (value > threshold) count++;
        this.indices = new Int32Array(count);
        this.length = count;
        for (let index = 0, at = 0; index < values.length; index++)
            if (values[index]! > threshold) this.indices[at++] = index;
        for (let parent = Math.floor(count / 2) - 1; parent >= 0; parent--) this.sink(parent);
    }
    private greater(a: number, b: number): boolean {
        return this.values[a]! > this.values[b]! || (this.values[a] === this.values[b] && a < b);
    }
    private sink(parent: number): void {
        while (parent * 2 + 1 < this.length) {
            let child = parent * 2 + 1;
            if (child + 1 < this.length && this.greater(this.indices[child + 1]!, this.indices[child]!)) child++;
            if (!this.greater(this.indices[child]!, this.indices[parent]!)) break;
            const previous = this.indices[parent]!;
            this.indices[parent] = this.indices[child]!;
            this.indices[child] = previous;
            parent = child;
        }
    }
    pop(): number | undefined {
        if (!this.length) return undefined;
        const index = this.indices[0]!;
        this.length--;
        if (this.length) {
            this.indices[0] = this.indices[this.length]!;
            this.sink(0);
        }
        return index;
    }
}

export function decodePitchNotes(
    activation: PitchActivations,
    signal: AbortSignal,
    options?: PitchDecodeOptions,
): PitchNote[] {
    const { frames, onsets, times } = activation;
    const count = frames.length / WIDTH;
    if (
        !Number.isSafeInteger(count) ||
        count <= 0 ||
        onsets.length !== frames.length ||
        times.length !== count + 1 ||
        frames.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
        onsets.some(value => !Number.isFinite(value) || value < 0 || value > 1) ||
        times.some((time, index) => !Number.isFinite(time) || time < 0 || (index > 0 && time <= times[index - 1]!))
    ) {
        throw new ProcessingError('result-invalid', 'Invalid Basic Pitch activations or absolute frame times.');
    }
    checkCancelled(signal);
    const config = options ?? { ...TRANSCRIPTION_CONFIG.pitch, gapFrames: 11, neighbourRadius: 1 };
    if (
        ![config.onsetThreshold, config.frameThreshold].every(
            value => Number.isFinite(value) && value >= 0 && value <= 1,
        ) ||
        !Number.isSafeInteger(config.minimumFrames) ||
        config.minimumFrames < 1 ||
        !Number.isSafeInteger(config.gapFrames) ||
        config.gapFrames < 1 ||
        config.gapFrames > 16 ||
        ![0, 1].includes(config.neighbourRadius)
    )
        throw new ProcessingError('invalid-request', 'Invalid note decoding options.');
    const inferred = new Float32Array(onsets);
    let maxOnset = 0,
        maxDifference = 0;
    for (let index = 0; index < frames.length; index++) {
        maxOnset = Math.max(maxOnset, onsets[index]!);
        if (index >= WIDTH * 2)
            maxDifference = Math.max(
                maxDifference,
                Math.min(frames[index]! - frames[index - WIDTH]!, frames[index]! - frames[index - WIDTH * 2]!),
            );
    }
    if (maxDifference > 0) {
        for (let index = WIDTH * 2; index < frames.length; index++) {
            const difference = Math.max(
                0,
                Math.min(frames[index]! - frames[index - WIDTH]!, frames[index]! - frames[index - WIDTH * 2]!),
            );
            inferred[index] = Math.max(onsets[index]!, (difference * maxOnset) / maxDifference);
        }
    }
    const remaining = new Float32Array(frames);
    const notes: PitchNote[] = [];
    const clear = (time: number, pitch: number) => {
        for (
            let neighbour = Math.max(0, pitch - config.neighbourRadius);
            neighbour <= Math.min(WIDTH - 1, pitch + config.neighbourRadius);
            neighbour++
        )
            remaining[time * WIDTH + neighbour] = 0;
    };
    const append = (start: number, end: number, pitch: number) => {
        if (end - start < config.minimumFrames) return;
        let sum = 0;
        for (let time = start; time < end; time++) sum += frames[time * WIDTH + pitch]!;
        notes.push({
            startSeconds: times[start]!,
            endSeconds: times[end]!,
            pitch: pitch + 21,
            strength: sum / (end - start),
            onsetStrength: onsets[start * WIDTH + pitch]!,
        });
    };
    for (let start = count - 1; start >= 0; start--) {
        if ((start & 255) === 0) checkCancelled(signal);
        for (let pitch = WIDTH - 1; pitch >= 0; pitch--) {
            const index = start * WIDTH + pitch;
            if (
                inferred[index]! < config.onsetThreshold ||
                (start > 0 && inferred[index]! <= inferred[index - WIDTH]!) ||
                (start < count - 1 && inferred[index]! < inferred[index + WIDTH]!)
            )
                continue;
            let end = start + 1,
                below = 0;
            while (end < count && below < config.gapFrames) {
                below = remaining[end * WIDTH + pitch]! < config.frameThreshold ? below + 1 : 0;
                end++;
            }
            end -= below;
            if (end - start < config.minimumFrames) continue;
            for (let time = start; time < end; time++) clear(time, pitch);
            append(start, end, pitch);
        }
    }
    const heap = new EnergyHeap(frames, config.frameThreshold);
    let index: number | undefined,
        visited = 0;
    while ((index = heap.pop()) !== undefined) {
        if ((visited++ & 1023) === 0) checkCancelled(signal);
        if (remaining[index]! <= config.frameThreshold) continue;
        const middle = Math.floor(index / WIDTH),
            pitch = index % WIDTH;
        remaining[index] = 0;
        let at = middle + 1,
            below = 0;
        while (at < count && below < config.gapFrames) {
            below = remaining[at * WIDTH + pitch]! < config.frameThreshold ? below + 1 : 0;
            clear(at, pitch);
            at++;
        }
        const end = at - below;
        at = middle - 1;
        below = 0;
        while (at >= 0 && below < config.gapFrames) {
            below = remaining[at * WIDTH + pitch]! < config.frameThreshold ? below + 1 : 0;
            clear(at, pitch);
            at--;
        }
        const start = at + 1 + below;
        append(start, end, pitch);
    }
    return notes.sort((a, b) => a.startSeconds - b.startSeconds || a.pitch - b.pitch);
}
