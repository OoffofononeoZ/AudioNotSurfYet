import { checkCancelled, ProcessingError } from '../processing/modelManifest';
import type { NoteCandidate } from './candidateTypes';

export const LEAD_PATH_CONFIG = {
    version: 'other-lead-continuity-v1',
    hopSeconds: 0.02,
    beamSize: 12,
    silenceScore: 0.45,
    switchCost: 0.06,
    pitchCost: 0.02,
    minimumScore: 0.64,
    minimumMargin: 0.06,
    minimumCoverage: 0.6,
} as const;
export interface LeadEvidence {
    coverage: number;
    reliableFraction: number;
    margin: number;
}
export interface LeadPathResult {
    leadIds: string[];
    otherIds: string[];
    evidence: Record<string, LeadEvidence>;
    frameCount: number;
    prunedFrames: number;
}

function emission(note: NoteCandidate): number {
    const e = note.acoustics;
    if (note.deleted || !e || e.rms < 3e-5) return 0;
    const peak = Math.max(1e-7, ...e.chroma),
        affinity = e.chroma[note.pitch % 12]! / peak;
    return 0.45 * note.strength + 0.35 * e.salience + 0.2 * affinity;
}

/** Candidate role path, not an instrument/preset classifier. Ambiguous notes remain other. */
export async function selectLeadPath(
    notes: readonly NoteCandidate[],
    durationSeconds: number,
    signal: AbortSignal,
    progress: (done: number, total: number) => void = () => {},
): Promise<LeadPathResult> {
    checkCancelled(signal);
    if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        new Set(notes.map(note => note.id)).size !== notes.length ||
        notes.some(
            note =>
                !Number.isFinite(note.startSeconds) ||
                !Number.isFinite(note.endSeconds) ||
                note.startSeconds < 0 ||
                note.endSeconds <= note.startSeconds ||
                note.endSeconds > durationSeconds,
        )
    )
        throw new ProcessingError('invalid-request', 'Invalid lead path input.');
    const c = LEAD_PATH_CONFIG,
        count = Math.ceil(durationSeconds / c.hopSeconds),
        width = c.beamSize + 1;
    let ids: Int32Array, parents: Int16Array;
    try {
        ids = new Int32Array(count * width).fill(-1);
        parents = new Int16Array(count * width);
    } catch {
        throw new ProcessingError('memory-unavailable', 'Not enough memory for the lead candidate path.');
    }
    const emissions = notes.map(emission),
        ordered = notes
            .map((_, i) => i)
            .sort(
                (a, b) => notes[a]!.startSeconds - notes[b]!.startSeconds || notes[a]!.id.localeCompare(notes[b]!.id),
            );
    const activeCounts = new Uint32Array(notes.length),
        chosenCounts = new Uint32Array(notes.length),
        reliableCounts = new Uint32Array(notes.length),
        margins = new Float64Array(notes.length);
    let cursor = 0,
        active: number[] = [],
        previousIds = [-1],
        previousScores = [0],
        lastBest = 0,
        prunedFrames = 0;
    const transition = (from: number, to: number) => {
        if (from === to) return 0;
        if (to < 0) return 0.03;
        if (from < 0) return 0.04;
        return c.switchCost + c.pitchCost * Math.min(12, Math.abs(notes[from]!.pitch - notes[to]!.pitch));
    };
    for (let frame = 0; frame < count; frame++) {
        checkCancelled(signal);
        const time = Math.min(durationSeconds, (frame + 0.5) * c.hopSeconds);
        while (cursor < ordered.length && notes[ordered[cursor]!]!.startSeconds <= time)
            active.push(ordered[cursor++]!);
        active = active.filter(index => notes[index]!.endSeconds > time);
        const eligible = active.filter(
            index =>
                emissions[index]! > 0 &&
                notes[index]!.acoustics!.activity.some(range => range.startSeconds <= time && range.endSeconds > time),
        );
        for (const index of eligible) activeCounts[index] = activeCounts[index]! + 1;
        eligible.sort((a, b) => emissions[b]! - emissions[a]! || notes[a]!.id.localeCompare(notes[b]!.id));
        if (eligible.length > c.beamSize) prunedFrames++;
        const currentIds = [-1, ...eligible.slice(0, c.beamSize)],
            scores: number[] = [];
        let best = 0;
        for (let slot = 0; slot < currentIds.length; slot++) {
            const index = currentIds[slot]!;
            let score = -Infinity,
                parent = 0;
            for (let old = 0; old < previousIds.length; old++) {
                const candidate = previousScores[old]! - transition(previousIds[old]!, index);
                if (candidate > score) {
                    score = candidate;
                    parent = old;
                }
            }
            scores.push(score + (index < 0 ? c.silenceScore : emissions[index]!));
            ids[frame * width + slot] = index;
            parents[frame * width + slot] = parent;
            if (scores[slot]! > scores[best]!) best = slot;
        }
        previousIds = currentIds;
        previousScores = scores;
        lastBest = best;
        if ((frame & 63) === 63) {
            progress(frame + 1, count);
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
    }
    for (let frame = count - 1, slot = lastBest; frame >= 0; frame--) {
        if ((frame & 255) === 0) checkCancelled(signal);
        const index = ids[frame * width + slot]!;
        if (index >= 0) {
            chosenCounts[index] = chosenCounts[index]! + 1;
            let alternative: number = c.silenceScore;
            for (let other = 0; other < width; other++) {
                const otherId = ids[frame * width + other]!;
                if (otherId >= 0 && otherId !== index) alternative = Math.max(alternative, emissions[otherId]!);
            }
            const margin = emissions[index]! - alternative;
            margins[index] = margins[index]! + Math.max(0, margin);
            if (emissions[index]! >= c.minimumScore && margin >= c.minimumMargin)
                reliableCounts[index] = reliableCounts[index]! + 1;
        }
        slot = parents[frame * width + slot]!;
    }
    const evidence: Record<string, LeadEvidence> = {},
        leadIds: string[] = [],
        otherIds: string[] = [];
    notes.forEach((note, index) => {
        const coverage = chosenCounts[index]! / Math.max(1, activeCounts[index]!),
            reliableFraction = reliableCounts[index]! / Math.max(1, chosenCounts[index]!);
        evidence[note.id] = { coverage, reliableFraction, margin: margins[index]! / Math.max(1, chosenCounts[index]!) };
        if (coverage >= c.minimumCoverage && reliableFraction >= c.minimumCoverage) leadIds.push(note.id);
        else otherIds.push(note.id);
    });
    checkCancelled(signal);
    progress(count, count);
    return { leadIds, otherIds, evidence, frameCount: count, prunedFrames };
}
