import { ACOUSTIC_CONFIG, acousticFrameSeconds, validAcousticIndex } from '../acousticIndex';
import type { AcousticIndex } from '../acousticIndex';
import { checkCancelled, ProcessingError } from '../../processing/modelManifest';
import { exampleOrigin, validateExampleProfile } from './types';
import type { ExampleMatch, ExampleProfile, SoundExample } from './types';
import { EXAMPLE_SEARCH_CONFIG } from './config';
export { EXAMPLE_SEARCH_CONFIG } from './config';
const hop = ACOUSTIC_CONFIG.hopSize / ACOUSTIC_CONFIG.sampleRate;
const width = EXAMPLE_SEARCH_CONFIG.descriptorWidth;
const frameAt = (index: AcousticIndex, seconds: number) =>
    Math.max(
        0,
        Math.min(
            index.frameCount - 1,
            Math.round(
                (seconds * ACOUSTIC_CONFIG.sampleRate - ACOUSTIC_CONFIG.frameSize / 2) / ACOUSTIC_CONFIG.hopSize,
            ),
        ),
    );
const similarity = (a: ArrayLike<number>, b: ArrayLike<number>) => {
    let dot = 0,
        aa = 0,
        bb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i]! * b[i]!;
        aa += a[i]! ** 2;
        bb += b[i]! ** 2;
    }
    return aa > 1e-12 && bb > 1e-12 ? Math.max(0, Math.min(1, (dot / Math.sqrt(aa * bb) + 1) / 2)) : 0;
};

/** Coefficient zero is omitted: gain alone must not identify a timbre. */
interface DescriptorTable {
    sums: Float64Array;
    squares: Float64Array;
}
function descriptors(index: AcousticIndex): DescriptorTable {
    const data = new Float32Array(index.frameCount * width),
        mean = new Float64Array(width),
        scale = new Float64Array(width);
    let active = 0;
    for (let frame = 0; frame < index.frameCount; frame++) {
        if (index.rms[frame]! < 1e-5) continue;
        active++;
        for (let c = 0; c < width; c++) {
            const value = index.mfcc[frame * ACOUSTIC_CONFIG.mfccWidth + c + 1]!;
            mean[c] = mean[c]! + value;
            scale[c] = scale[c]! + value * value;
        }
    }
    for (let c = 0; c < width; c++) {
        mean[c] = mean[c]! / Math.max(1, active);
        scale[c] = Math.sqrt(Math.max(1, scale[c]! / Math.max(1, active) - mean[c]! ** 2));
    }
    for (let frame = 0; frame < index.frameCount; frame++) {
        if (index.rms[frame]! < 1e-5) continue;
        let norm = 0;
        for (let c = 0; c < width; c++) {
            const value = index.mfcc[frame * ACOUSTIC_CONFIG.mfccWidth + c + 1]! / scale[c]!;
            data[frame * width + c] = value;
            norm += value * value;
        }
        if (norm > 1e-12)
            for (let c = 0; c < width; c++) data[frame * width + c] = data[frame * width + c]! / Math.sqrt(norm);
    }
    const sums = new Float64Array((index.frameCount + 1) * width),
        squares = new Float64Array(sums.length);
    for (let frame = 0; frame < index.frameCount; frame++)
        for (let c = 0; c < width; c++) {
            const offset = frame * width + c,
                next = offset + width,
                value = data[offset]!;
            sums[next] = sums[offset]! + value;
            squares[next] = squares[offset]! + value * value;
        }
    return { sums, squares };
}
function summarize(data: DescriptorTable, first: number, last: number): Float32Array {
    const output = new Float32Array(width * 2),
        count = Math.max(1, last - first);
    for (let c = 0; c < width; c++) {
        output[c] = (data.sums[last * width + c]! - data.sums[first * width + c]!) / count;
        output[c + width] =
            0.3 *
            Math.sqrt(
                Math.max(
                    0,
                    (data.squares[last * width + c]! - data.squares[first * width + c]!) / count - output[c]! ** 2,
                ),
            );
    }
    return output;
}
function sequence(data: DescriptorTable, first: number, last: number): Float32Array {
    const count = Math.min(EXAMPLE_SEARCH_CONFIG.maximumSequenceFrames, last - first),
        output = new Float32Array(count * width);
    for (let i = 0; i < count; i++) {
        const low = first + Math.floor((i * (last - first)) / count),
            high = first + Math.floor(((i + 1) * (last - first)) / count);
        for (let c = 0; c < width; c++)
            output[i * width + c] = (data.sums[high * width + c]! - data.sums[low * width + c]!) / (high - low);
    }
    return output;
}
/** Two rolling rows; the alignment band bounds work, independent of song length. */
export function boundedDtw(a: Float32Array, b: Float32Array, signal: AbortSignal): number {
    const n = a.length / width,
        m = b.length / width;
    if (!n || !m) return 0;
    let previous = new Float64Array(m + 1).fill(Infinity),
        previousSteps = new Uint16Array(m + 1);
    previous[0] = 0;
    for (let i = 1; i <= n; i++) {
        checkCancelled(signal);
        const row = new Float64Array(m + 1).fill(Infinity),
            steps = new Uint16Array(m + 1),
            band = Math.max(2, Math.ceil(m * EXAMPLE_SEARCH_CONFIG.dtwBand));
        for (
            let j = Math.max(1, Math.floor((i * m) / n) - band);
            j <= Math.min(m, Math.ceil((i * m) / n) + band);
            j++
        ) {
            let cost = previous[j - 1]!,
                length = previousSteps[j - 1]!;
            if (previous[j]! < cost) {
                cost = previous[j]!;
                length = previousSteps[j]!;
            }
            if (row[j - 1]! < cost) {
                cost = row[j - 1]!;
                length = steps[j - 1]!;
            }
            let distance = 0;
            for (let c = 0; c < width; c++) distance += (a[(i - 1) * width + c]! - b[(j - 1) * width + c]!) ** 2;
            row[j] = cost + Math.min(2, distance / 2);
            steps[j] = length + 1;
        }
        previous = row;
        previousSteps = steps;
    }
    return Math.exp((-2 * previous[m]!) / Math.max(1, previousSteps[m]!));
}
function attack(index: AcousticIndex, frame: number): number {
    return Math.max(index.onset[frame]!, ...index.bandOnset.subarray(frame * 3, frame * 3 + 3));
}
function peaks(index: AcousticIndex): number[] {
    const result: number[] = [];
    for (let frame = 0; frame < index.frameCount; frame++) {
        if (
            index.rms[frame]! < 1e-5 ||
            attack(index, frame) < 0.08 ||
            (frame > 0 && attack(index, frame) < attack(index, frame - 1)) ||
            (frame + 1 < index.frameCount && attack(index, frame) <= attack(index, frame + 1))
        )
            continue;
        const last = result[result.length - 1];
        if (last !== undefined && frame - last < 2) {
            if (attack(index, frame) > attack(index, last)) result[result.length - 1] = frame;
        } else result.push(frame);
    }
    return result;
}
interface Template {
    example: SoundExample;
    first: number;
    last: number;
    summary: Float32Array;
    sequence: Float32Array;
}
export async function searchSoundExamples(
    index: AcousticIndex,
    profile: ExampleProfile,
    signal: AbortSignal,
    progress: (phase: string, done: number, total: number) => void = () => {},
) {
    checkCancelled(signal);
    validateExampleProfile(profile);
    if (
        !validAcousticIndex(index) ||
        Math.abs(index.durationSeconds - profile.durationSeconds) > 1 / index.sourceSampleRate + 1e-6
    )
        throw new ProcessingError('source-identity-mismatch', '声音索引与当前歌曲不匹配。');
    const positive = profile.examples.filter(e => e.polarity === 'positive');
    if (!positive.length) throw new ProcessingError('invalid-request', '至少添加一个正例。');
    const data = descriptors(index),
        attacks = peaks(index);
    const templates: Template[] = profile.examples.map(example => {
        let first = frameAt(index, example.startSeconds);
        if (example.kind === 'point') {
            const nearby = attacks.filter(
                frame => Math.abs(acousticFrameSeconds(frame) - example.startSeconds) <= 0.07,
            );
            if (nearby.length) first = nearby.sort((a, b) => attack(index, b) - attack(index, a))[0]!;
        }
        const last = Math.max(
            first + 1,
            Math.min(
                index.frameCount,
                example.kind === 'point'
                    ? first + Math.ceil(EXAMPLE_SEARCH_CONFIG.pointContextSeconds / hop)
                    : frameAt(index, example.endSeconds) + 1,
            ),
        );
        if (!index.rms.subarray(first, last).some(value => value >= 1e-5))
            throw new ProcessingError('invalid-request', '声音示例位于静音区，请调整边界或检索来源。');
        return { example, first, last, summary: summarize(data, first, last), sequence: sequence(data, first, last) };
    });
    const found: ExampleMatch[] = [];
    let coarseCandidates = 0,
        refinedCandidates = 0,
        work = 0;
    for (const kind of ['point', 'range'] as const) {
        const positives = templates.filter(t => t.example.polarity === 'positive' && t.example.kind === kind),
            negatives = templates.filter(t => t.example.polarity === 'negative' && t.example.kind === kind);
        if (!positives.length) continue;
        const anchors =
            kind === 'point'
                ? attacks
                : [
                      ...new Set([
                          ...attacks,
                          ...Array.from({ length: Math.ceil(index.frameCount / 4) }, (_, i) => i * 4),
                      ]),
                  ].sort((a, b) => a - b);
        for (let at = 0; at < anchors.length; at++) {
            const first = anchors[at]!;
            if (index.rms[first]! < 1e-5) continue;
            let best = 0,
                negative = 0,
                bestLast = first;
            for (const template of positives) {
                for (const ratio of kind === 'point' ? [1] : EXAMPLE_SEARCH_CONFIG.durationRatios) {
                    const last = first + Math.round((template.last - template.first) * ratio);
                    if (last > index.frameCount || last <= first) continue;
                    const summary = summarize(data, first, last),
                        coarse = similarity(template.summary, summary);
                    coarseCandidates++;
                    if (coarse < EXAMPLE_SEARCH_CONFIG.coarseFloor) continue;
                    refinedCandidates++;
                    const seq = sequence(data, first, last);
                    const score =
                        kind === 'point'
                            ? 0.35 * coarse + 0.65 * boundedDtw(template.sequence, seq, signal)
                            : 0.2 * coarse + 0.8 * boundedDtw(template.sequence, seq, signal);
                    if (score <= best) continue;
                    best = score;
                    bestLast = last;
                    negative = 0;
                    for (const neg of negatives) {
                        const end = kind === 'point' ? Math.min(index.frameCount, first + neg.last - neg.first) : last;
                        const negCoarse = similarity(neg.summary, summarize(data, first, end));
                        negative = Math.max(
                            negative,
                            0.2 * negCoarse + 0.8 * boundedDtw(neg.sequence, sequence(data, first, end), signal),
                        );
                    }
                }
            }
            if (best >= profile.threshold && (!negatives.length || best - negative >= profile.negativeMargin)) {
                const startSeconds = Math.min(profile.durationSeconds - 1e-6, acousticFrameSeconds(first)),
                    endSeconds =
                        kind === 'point'
                            ? startSeconds
                            : Math.min(profile.durationSeconds, acousticFrameSeconds(bestLast));
                if (endSeconds >= startSeconds)
                    found.push({
                        id: exampleOrigin(profile.sourceKey, profile.id, kind, first),
                        anchorFrame: first,
                        kind,
                        startSeconds,
                        endSeconds,
                        positiveScore: best,
                        negativeScore: negatives.length ? negative : null,
                        selected: false,
                    });
            }
            if (++work % 32 === 0) {
                progress(kind === 'point' ? '相似起音' : '乐句对齐', at + 1, anchors.length);
                await new Promise<void>(resolve => setTimeout(resolve, 0));
                checkCancelled(signal);
            }
        }
    }
    // Nearby range alignments describe one occurrence. Independent point attacks remain distinct.
    const selected: ExampleMatch[] = [];
    for (const match of found.sort((a, b) => b.positiveScore - a.positiveScore || a.anchorFrame - b.anchorFrame)) {
        if (
            match.kind === 'range' &&
            selected.some(
                old =>
                    old.kind === 'range' &&
                    Math.min(match.endSeconds, old.endSeconds) - Math.max(match.startSeconds, old.startSeconds) >
                        0.5 * Math.min(match.endSeconds - match.startSeconds, old.endSeconds - old.startSeconds),
            )
        )
            continue;
        selected.push(match);
    }
    checkCancelled(signal);
    return {
        matches: selected.sort((a, b) => a.startSeconds - b.startSeconds || a.kind.localeCompare(b.kind)),
        coarseCandidates,
        refinedCandidates,
    };
}
