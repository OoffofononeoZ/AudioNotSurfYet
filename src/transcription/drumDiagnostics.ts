import { hashBytes } from '../processing/sha256';
import type { IncompleteDrumRange } from './drumTranscription';

export interface RawDrumEvent {
    timeSeconds: number;
    customPitch: number;
    velocity: number;
}

export interface DrumWindowDiagnostic {
    inputStartSeconds: number;
    featureHash: string;
    tokens: number[];
    tokenCount: number;
    termination: 'eos' | 'limit' | 'repeated-event';
    events: RawDrumEvent[];
    retainedCount: number;
    ignoredCount: number;
    malformedCount: number;
    preprocessMs: number;
    encodeMs: number;
    decodeMs: number;
    totalMs: number;
}

/** Retain model vocabulary evidence, including classes not currently applied. */
export function rawDrumEvents(tokens: readonly number[], offsetSeconds: number): RawDrumEvent[] {
    const events: RawDrumEvent[] = [];
    for (let i = 0; i + 2 < tokens.length && tokens[i] !== 3; i++) {
        const time = tokens[i]!,
            pitch = tokens[i + 1]!,
            velocity = tokens[i + 2]!;
        if (
            [time, pitch, velocity].every(Number.isInteger) &&
            time >= 4 &&
            time < 300 &&
            pitch >= 300 &&
            pitch < 400 &&
            velocity >= 400 &&
            velocity <= 527
        ) {
            events.push({
                timeSeconds: offsetSeconds + (time - 4) / 100,
                customPitch: pitch - 300,
                velocity: velocity - 400,
            });
        }
    }
    return events;
}

export function drumFeatureHash(features: Float32Array): string {
    return hashBytes(new Uint8Array(features.buffer, features.byteOffset, features.byteLength));
}

export function validDrumDiagnostics(value: unknown): value is DrumWindowDiagnostic[] {
    if (!Array.isArray(value)) return false;
    return value.every(window => {
        if (
            !window ||
            !Number.isFinite(window.inputStartSeconds) ||
            !/^[a-f0-9]{64}$/.test(window.featureHash) ||
            !Array.isArray(window.tokens) ||
            window.tokens.length < 2 ||
            window.tokens.length > 512 ||
            window.tokens[0] !== 2 ||
            window.tokenCount !== window.tokens.length ||
            window.tokens.some((token: number) => !Number.isInteger(token) || token < 0 || token >= 1400) ||
            !['eos', 'limit', 'repeated-event'].includes(window.termination) ||
            (window.termination === 'eos') !== (window.tokens.at(-1) === 3) ||
            !Array.isArray(window.events)
        )
            return false;
        const numbers = [
            'retainedCount',
            'ignoredCount',
            'malformedCount',
            'preprocessMs',
            'encodeMs',
            'decodeMs',
            'totalMs',
        ];
        if (numbers.some(key => !Number.isFinite(window[key]) || window[key] < 0)) return false;
        return JSON.stringify(window.events) === JSON.stringify(rawDrumEvents(window.tokens, window.inputStartSeconds));
    });
}

/** A local report contains identities and model events, never PCM or paths. */
export function transcriptionDiagnosticReport(result: {
    id: string;
    identity: unknown;
    timings: Record<string, number>;
    drumDiagnostics?: DrumWindowDiagnostic[];
    truncatedDrumSegments: number[];
    incompleteDrumRanges?: IncompleteDrumRange[];
    drumAdapter?: unknown;
}) {
    return {
        format: 'audiosurf-transcription-diagnostics',
        version: 1,
        resultId: result.id,
        identity: result.identity,
        timings: result.timings,
        windows: result.drumDiagnostics ?? [],
        incompleteStarts: result.truncatedDrumSegments,
        incompleteRanges: result.incompleteDrumRanges ?? [],
        adapter: result.drumAdapter ?? null,
    };
}
