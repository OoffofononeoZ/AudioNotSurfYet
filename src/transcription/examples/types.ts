import type { DecodedAudioDescriptor } from '../../types/audio';
import type { AcousticIndex } from '../acousticIndex';
import { hashBytes } from '../../processing/sha256';
import { ProcessingError } from '../../processing/modelManifest';
import { EXAMPLE_SEARCH_CONFIG } from './config';

export interface ExampleSource {
    key: string;
    songHash: string;
    trackId: string;
    kind: 'original' | 'ft' | 'auxiliary';
    label: string;
    role: string;
    frames: number;
    sampleRate: number;
    channels: number;
    descriptor?: DecodedAudioDescriptor;
    directory?: string;
    resultId?: string;
    left?: string;
    right?: string;
}
export interface SoundExample {
    id: string;
    polarity: 'positive' | 'negative';
    kind: 'point' | 'range';
    startSeconds: number;
    endSeconds: number;
    markerId?: string;
}
export interface ExampleMatch {
    id: string;
    anchorFrame: number;
    kind: 'point' | 'range';
    startSeconds: number;
    endSeconds: number;
    positiveScore: number;
    negativeScore: number | null;
    selected: boolean;
}
export interface ExampleProfile {
    version: 1;
    id: string;
    songHash: string;
    sourceKey: string;
    label: string;
    durationSeconds: number;
    examples: SoundExample[];
    threshold: number;
    negativeMargin: number;
    matches: ExampleMatch[];
    queryHash: string | null;
    lastSelectedAt?: number;
}
export interface ExampleSearchResult {
    matches: ExampleMatch[];
    coarseCandidates: number;
    refinedCandidates: number;
    indexRestored: boolean;
    elapsedMs: number;
}
export const exampleHash = (value: unknown): string => hashBytes(new TextEncoder().encode(JSON.stringify(value)));
export const exampleOrigin = (sourceKey: string, groupId: string, kind: string, anchorFrame: number): string =>
    `example-${exampleHash([sourceKey, groupId, kind, anchorFrame])}`;
export function queryIdentity(profile: ExampleProfile): string {
    return exampleHash([
        EXAMPLE_SEARCH_CONFIG,
        profile.sourceKey,
        profile.examples,
        profile.threshold,
        profile.negativeMargin,
    ]);
}
export function validateExampleProfile(profile: ExampleProfile): void {
    const validTime = (start: number, end: number, kind: string) =>
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start >= 0 &&
        end <= profile.durationSeconds &&
        (kind === 'point' ? start === end && start < profile.durationSeconds : kind === 'range' && end > start);
    if (
        !profile ||
        profile.version !== 1 ||
        !/^[a-f0-9-]{36}$/.test(profile.id) ||
        !/^[a-f0-9]{64}$/.test(profile.songHash) ||
        !/^[a-f0-9]{64}$/.test(profile.sourceKey) ||
        !profile.label.trim() ||
        profile.label.length > 120 ||
        !Number.isFinite(profile.durationSeconds) ||
        profile.durationSeconds <= 0 ||
        !Number.isFinite(profile.threshold) ||
        profile.threshold < 0.5 ||
        profile.threshold > 1 ||
        !Number.isFinite(profile.negativeMargin) ||
        profile.negativeMargin < 0 ||
        profile.negativeMargin > 1 ||
        !Array.isArray(profile.examples) ||
        !Array.isArray(profile.matches) ||
        new Set(profile.examples.map(e => e.id)).size !== profile.examples.length ||
        new Set(profile.matches.map(e => e.id)).size !== profile.matches.length ||
        profile.examples.some(
            e =>
                !e.id ||
                !['positive', 'negative'].includes(e.polarity) ||
                !validTime(e.startSeconds, e.endSeconds, e.kind),
        ) ||
        profile.matches.some(
            m =>
                !Number.isSafeInteger(m.anchorFrame) ||
                m.anchorFrame < 0 ||
                m.id !== exampleOrigin(profile.sourceKey, profile.id, m.kind, m.anchorFrame) ||
                !validTime(m.startSeconds, m.endSeconds, m.kind) ||
                typeof m.selected !== 'boolean' ||
                ![m.positiveScore, ...(m.negativeScore === null ? [] : [m.negativeScore])].every(
                    n => Number.isFinite(n) && n >= 0 && n <= 1,
                ),
        ) ||
        (profile.lastSelectedAt !== undefined &&
            (!Number.isFinite(profile.lastSelectedAt) || profile.lastSelectedAt < 0)) ||
        (profile.queryHash !== null && !/^[a-f0-9]{64}$/.test(profile.queryHash))
    )
        throw new ProcessingError('result-invalid', '声音示例或检索候选无效。');
}
export const indexArrays = (index: AcousticIndex): Float32Array[] => [
    index.rms,
    index.onset,
    index.mfcc,
    index.chroma,
    index.bandRms,
    index.bandOnset,
];
