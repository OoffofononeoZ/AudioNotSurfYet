import { acousticEvidence, acousticFrameSeconds, ACOUSTIC_CONFIG } from './acousticIndex';
import type { AcousticIndex, AcousticEvidence } from './acousticIndex';

export interface AcousticActivity {
    startSeconds: number;
    endSeconds: number;
}
export interface CandidateAcoustics extends AcousticEvidence {
    salience: number;
    activity: AcousticActivity[];
}

/** Envelope hysteresis is independent of the UI's point/range threshold. */
export function candidateAcoustics(index: AcousticIndex, start: number, end: number): CandidateAcoustics {
    end = Math.min(index.durationSeconds, end);
    const evidence = acousticEvidence(index, start, end);
    const { sampleRate, hopSize, frameSize } = ACOUSTIC_CONFIG;
    const at = (seconds: number) =>
        Math.max(0, Math.min(index.frameCount - 1, Math.floor((seconds * sampleRate) / hopSize)));
    const local = Array.from(
        index.rms.subarray(at(Math.max(0, start - 2)), at(Math.min(index.durationSeconds, end + 2)) + 1),
    ).sort((a, b) => a - b);
    const localPeak = local[Math.min(local.length - 1, Math.floor(local.length * 0.9))] ?? 0;
    const salience = Math.min(1, evidence.rms / Math.max(1e-5, localPeak));
    const activity: AcousticActivity[] = [];
    const first = Math.max(0, at(start) - 1),
        last = at(end);
    let peak = 0;
    for (let frame = first; frame <= last; frame++) peak = Math.max(peak, index.rms[frame]!);
    const open = Math.max(1e-5, peak * 0.25),
        close = Math.max(5e-6, peak * 0.12);
    let opened = -1,
        below = 0;
    const finish = (frame: number) => {
        const from = Math.max(start, acousticFrameSeconds(opened) - frameSize / (2 * sampleRate));
        const to = Math.min(end, acousticFrameSeconds(frame) + frameSize / (2 * sampleRate));
        if (to > from) activity.push({ startSeconds: from, endSeconds: to });
        opened = -1;
    };
    for (let frame = first; frame <= last; frame++) {
        if (opened < 0 && index.rms[frame]! >= open) opened = frame;
        if (opened < 0) continue;
        below = index.rms[frame]! < close ? below + 1 : 0;
        if (below >= 2) {
            finish(frame - below);
            below = 0;
        }
    }
    if (opened >= 0) finish(last - below);
    return { ...evidence, salience, activity };
}

export function validCandidateAcoustics(value: CandidateAcoustics, duration: number): boolean {
    return (
        !!value &&
        [value.rms, value.localContrast, value.onset, value.onsetSeconds, value.salience].every(Number.isFinite) &&
        value.rms >= 0 &&
        value.localContrast >= 0 &&
        value.localContrast <= 100 &&
        value.onset >= 0 &&
        value.onset <= 1 &&
        value.salience >= 0 &&
        value.salience <= 1 &&
        value.onsetSeconds >= 0 &&
        value.onsetSeconds <= duration &&
        Array.isArray(value.mfcc) &&
        value.mfcc.length === 13 &&
        value.mfcc.every(Number.isFinite) &&
        Array.isArray(value.chroma) &&
        value.chroma.length === 12 &&
        value.chroma.every(Number.isFinite) &&
        Array.isArray(value.activity) &&
        value.activity.every(
            (range, i, all) =>
                range &&
                Number.isFinite(range.startSeconds) &&
                Number.isFinite(range.endSeconds) &&
                range.startSeconds >= 0 &&
                range.endSeconds > range.startSeconds &&
                range.endSeconds <= duration &&
                (!i || range.startSeconds >= all[i - 1]!.endSeconds),
        )
    );
}
