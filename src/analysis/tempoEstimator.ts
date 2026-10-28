import { yieldAnalysisTask } from './taskScheduler';
import { analysisFrameCount, createAnalysisFrame } from './frames';
import { extractM10Frame, vectorMeydaValue } from './meydaAdapter';
import type { AnalysisConfig } from './types';

export const TEMPO_MIN_BPM = 20;
export const TEMPO_MAX_BPM = 300;
export const TEMPO_RELIABLE_CONFIDENCE = 0.65;
export const TEMPO_CANDIDATE_ADVANTAGE = 0.08;

export interface TempoEstimation {
    state: 'reliable' | 'low-confidence';
    bpm?: number;
    confidence: number;
    candidateAdvantage: number;
    candidateBpm?: number;
}

export interface TempoEstimatorHooks {
    isCancelled?: () => boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const normalizedAutocorrelation = (values: ArrayLike<number>, lag: number): number => {
    if (!Number.isInteger(lag) || lag <= 0 || lag >= values.length) return 0;
    let numerator = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let index = lag; index < values.length; index += 1) {
        const left = values[index] ?? 0;
        const right = values[index - lag] ?? 0;
        numerator += left * right;
        leftEnergy += left * left;
        rightEnergy += right * right;
    }
    const denominator = Math.sqrt(leftEnergy * rightEnergy);
    return denominator > 0 ? clamp01(numerator / denominator) : 0;
};

function* chooseTempoCandidateSteps(
    onsetEnvelope: ArrayLike<number>,
    sampleRate: number,
    hopSize: number,
    preferredLag?: number,
): Generator<void, TempoEstimation> {
    const envelopeRate = sampleRate / hopSize;
    const minimumLag = Math.max(1, Math.ceil((envelopeRate * 60) / TEMPO_MAX_BPM));
    const maximumLag = Math.min(onsetEnvelope.length - 1, Math.floor((envelopeRate * 60) / TEMPO_MIN_BPM));
    if (maximumLag < minimumLag || onsetEnvelope.length < 8) {
        return {
            state: 'low-confidence',
            confidence: 0,
            candidateAdvantage: 0,
        };
    }
    const scores = new Float64Array(maximumLag + 1);
    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
        const overlap = (onsetEnvelope.length - lag) / onsetEnvelope.length;
        const preferredBonus =
            preferredLag && preferredLag > 0
                ? 0.2 * Math.max(0, 1 - Math.abs(lag - preferredLag) / preferredLag / 0.08)
                : 0;
        yield;
        scores[lag] = clamp01(
            normalizedAutocorrelation(onsetEnvelope, lag) * Math.sqrt(Math.max(0, overlap)) + preferredBonus,
        );
    }
    const candidates: Array<{ lag: number; score: number }> = [];
    for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
        const score = scores[lag] ?? 0;
        if (
            score >= (scores[lag - 1] ?? Number.NEGATIVE_INFINITY) &&
            score >= (scores[lag + 1] ?? Number.NEGATIVE_INFINITY)
        ) {
            candidates.push({ lag, score });
        }
    }
    candidates.sort((left, right) => right.score - left.score || left.lag - right.lag);
    const best = candidates[0];
    if (!best) {
        return {
            state: 'low-confidence',
            confidence: 0,
            candidateAdvantage: 0,
        };
    }
    const confidence = clamp01(best.score);
    const isHarmonicEquivalent = (lag: number): boolean => {
        const ratio = lag / best.lag;
        return [0.25, 0.5, 1, 2, 3, 4].some(harmonic => Math.abs(ratio - harmonic) <= 0.04 * harmonic);
    };
    const distinctRunnerUp = candidates.find(
        candidate => candidate.lag !== best.lag && !isHarmonicEquivalent(candidate.lag),
    );
    const candidateAdvantage = clamp01(confidence - (distinctRunnerUp?.score ?? 0));
    const bpm = (60 * envelopeRate) / best.lag;
    if (
        confidence >= TEMPO_RELIABLE_CONFIDENCE &&
        candidateAdvantage >= TEMPO_CANDIDATE_ADVANTAGE &&
        Number.isFinite(bpm) &&
        bpm >= TEMPO_MIN_BPM &&
        bpm <= TEMPO_MAX_BPM
    ) {
        return {
            state: 'reliable',
            bpm,
            candidateBpm: bpm,
            confidence,
            candidateAdvantage,
        };
    }
    return {
        state: 'low-confidence',
        candidateBpm: bpm,
        confidence,
        candidateAdvantage,
    };
}

function* estimateTempoSteps(
    pcm: Float32Array,
    config: AnalysisConfig,
    hooks: TempoEstimatorHooks = {},
): Generator<void, TempoEstimation> {
    const totalFrames = analysisFrameCount(pcm.length, config.frameSize, config.hopSize);
    const onset = new Float64Array(totalFrames);
    let previous: number[] | null = null;
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex += 1) {
        if (hooks.isCancelled?.()) {
            return { state: 'low-confidence', confidence: 0, candidateAdvantage: 0 };
        }
        yield;
        const frame = createAnalysisFrame(pcm, frameIndex, config);
        const extraction = extractM10Frame(['amplitudeSpectrum'], frame, config);
        const spectrum = vectorMeydaValue(extraction.values, 'amplitudeSpectrum', config.frameSize / 2);
        if (previous) {
            let flux = 0;
            for (let bin = 0; bin < spectrum.length; bin += 1) {
                flux += Math.max(0, (spectrum[bin] ?? 0) - (previous[bin] ?? 0));
            }
            onset[frameIndex] = flux;
        }
        previous = spectrum;
    }
    const mean = onset.reduce((sum, value) => sum + value, 0) / onset.length;
    for (let index = 0; index < onset.length; index += 1) {
        onset[index] = Math.max(0, (onset[index] ?? 0) - mean);
    }
    const oversample = 4;
    const peakThreshold = Math.max(...onset) * 0.25;
    const minimumPeakDistance = Math.max(1, Math.floor(((config.sampleRate / config.hopSize) * 60) / TEMPO_MAX_BPM));
    const peaks: number[] = [];
    for (let index = 1; index < onset.length - 1; index += 1) {
        if (
            (onset[index] ?? 0) < peakThreshold ||
            (onset[index] ?? 0) < (onset[index - 1] ?? 0) ||
            (onset[index] ?? 0) < (onset[index + 1] ?? 0) ||
            index - (peaks[peaks.length - 1] ?? -minimumPeakDistance) < minimumPeakDistance
        )
            continue;
        peaks.push(index);
    }
    const intervals = peaks.slice(1).map((peak, index) => peak - peaks[index]!);
    intervals.sort((left, right) => left - right);
    const medianInterval = intervals.length >= 2 ? intervals[Math.floor(intervals.length / 2)]! : null;
    const deviations =
        medianInterval === null
            ? []
            : intervals.map(interval => Math.abs(interval - medianInterval)).sort((left, right) => left - right);
    const medianDeviation =
        deviations.length > 0 ? deviations[Math.floor(deviations.length / 2)]! : Number.POSITIVE_INFINITY;
    const preferredLag =
        medianInterval !== null && medianDeviation / Math.max(1, medianInterval) <= 0.08
            ? medianInterval * oversample
            : undefined;
    const interpolated = new Float64Array(Math.max(1, (onset.length - 1) * oversample + 1));
    for (let index = 0; index < interpolated.length; index += 1) {
        const source = index / oversample;
        const left = Math.floor(source);
        const ratio = source - left;
        interpolated[index] =
            (onset[left] ?? 0) * (1 - ratio) + (onset[Math.min(onset.length - 1, left + 1)] ?? 0) * ratio;
    }
    return yield* chooseTempoCandidateSteps(interpolated, config.sampleRate, config.hopSize / oversample, preferredLag);
}

function finishSteps(steps: Generator<void, TempoEstimation>): TempoEstimation {
    let step = steps.next();
    while (!step.done) step = steps.next();
    return step.value;
}
export const chooseTempoCandidate = (
    values: ArrayLike<number>,
    sampleRate: number,
    hopSize: number,
    preferredLag?: number,
): TempoEstimation => finishSteps(chooseTempoCandidateSteps(values, sampleRate, hopSize, preferredLag));
export const estimateTempo = (
    pcm: Float32Array,
    config: AnalysisConfig,
    hooks: TempoEstimatorHooks = {},
): TempoEstimation => finishSteps(estimateTempoSteps(pcm, config, hooks));
export async function estimateTempoAsync(
    pcm: Float32Array,
    config: AnalysisConfig,
    hooks: TempoEstimatorHooks & { yieldControl?: () => Promise<void> } = {},
): Promise<TempoEstimation> {
    const steps = estimateTempoSteps(pcm, config, hooks);
    let step = steps.next(),
        started = performance.now(),
        count = 0;
    while (!step.done) {
        if (hooks.isCancelled?.()) return { state: 'low-confidence', confidence: 0, candidateAdvantage: 0 };
        if (++count >= 32 || performance.now() - started >= 8) {
            await (hooks.yieldControl ?? yieldAnalysisTask)();
            count = 0;
            started = performance.now();
        }
        step = steps.next();
    }
    return step.value;
}
