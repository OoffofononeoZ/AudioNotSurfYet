import { describe, expect, it } from 'vitest';
import {
    drumFeatureHash,
    rawDrumEvents,
    transcriptionDiagnosticReport,
    validDrumDiagnostics,
} from '../../src/transcription/drumDiagnostics';

describe('drum diagnostic evidence', () => {
    it('keeps discarded drum classes and simultaneous hits without accepting malformed triplets', () => {
        const events = rawDrumEvents([2, 14, 336, 500, 14, 346, 490, 15, 338, 999, 3, 20, 336, 500], 87.04);
        expect(events).toEqual([
            { timeSeconds: 87.14, customPitch: 36, velocity: 100 },
            { timeSeconds: 87.14, customPitch: 46, velocity: 90 },
        ]);
    });
    it('hashes only the actual feature view', () => {
        const memory = new Float32Array([999, 1, 2, 999]);
        expect(drumFeatureHash(memory.subarray(1, 3))).toBe(drumFeatureHash(new Float32Array([1, 2])));
        expect(drumFeatureHash(memory)).not.toBe(drumFeatureHash(memory.subarray(1, 3)));
    });
    it('exports model evidence without adding audio or a filesystem reference', () => {
        const report = transcriptionDiagnosticReport({
            id: 'test',
            identity: { contentHash: 'abc' },
            timings: { drumsMs: 30 },
            truncatedDrumSegments: [87.04],
        });
        expect(report.format).toBe('audiosurf-transcription-diagnostics');
        expect(report.windows).toEqual([]);
        expect(report.incompleteStarts).toEqual([87.04]);
        expect(Object.keys(report)).not.toContain('pcm');
    });
    it('rejects corrupt diagnostic sequences and events', () => {
        const window = {
            inputStartSeconds: 0,
            featureHash: 'a'.repeat(64),
            tokens: [2, 14, 336, 500, 3],
            tokenCount: 5,
            termination: 'eos',
            events: rawDrumEvents([2, 14, 336, 500, 3], 0),
            retainedCount: 1,
            ignoredCount: 0,
            malformedCount: 0,
            preprocessMs: 1,
            encodeMs: 2,
            decodeMs: 3,
            totalMs: 6,
        };
        expect(validDrumDiagnostics([window])).toBe(true);
        expect(validDrumDiagnostics([{ ...window, termination: 'limit' }])).toBe(false);
        expect(validDrumDiagnostics([{ ...window, events: [] }])).toBe(false);
        expect(validDrumDiagnostics([{ ...window, tokens: [2, Infinity, 3] }])).toBe(false);
        expect(validDrumDiagnostics([{ ...window, decodeMs: -1 }])).toBe(false);
    });
});
