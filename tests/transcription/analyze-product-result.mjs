import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import { build } from 'esbuild';
import { assessEvents } from './qualityMetrics.ts';

const value = flag => process.argv[process.argv.indexOf(flag) + 1];
for (const flag of ['--report', '--reference']) if (!process.argv.includes(flag)) throw Error(`Missing ${flag}`);
const reportFile = path.resolve(value('--report')),
    directory = path.dirname(reportFile),
    relative = path.relative(await fs.realpath(process.cwd()), directory);
if (!relative || relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Write review artifacts only within the workspace.');
const suffix = process.argv.includes('--suffix') ? value('--suffix') : '';
if (suffix && !/^[a-z0-9-]+$/.test(suffix)) throw Error('Invalid output suffix.');
const outputName = suffix ? `positive-reference-timing-${suffix}.json` : 'positive-reference-timing.json',
    projectName = suffix
        ? `black-hole-default-review-${suffix}.audiosurf-editor.json`
        : 'black-hole-default-review.audiosurf-editor.json';
const report = JSON.parse(await fs.readFile(reportFile, 'utf8')),
    record = JSON.parse(await fs.readFile(path.join(directory, 'cached-record.json'), 'utf8')),
    manual = JSON.parse(await fs.readFile(value('--reference'), 'utf8')),
    sha = value => createHash('sha256').update(value).digest('hex');
if (manual.track.contentHash !== report.sourceHash || record.bundle.result.identity.contentHash !== report.sourceHash)
    throw Error('Wrong song/reference.');
const bundleFile = path.join(directory, `review-analysis-${randomUUID()}.mjs`);
await build({
    stdin: {
        contents:
            "export {deriveCandidateReview} from './src/transcription/candidateReview.ts'; export {applySoundMarkers} from './src/transcription/applySoundMarkers.ts';",
        resolveDir: process.cwd(),
        loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundleFile,
});
const api = await import(pathToFileURL(bundleFile));
const expected = manual.lanes
        .slice(0, 2)
        .flatMap(lane => lane.events.map(event => ({ category: 'selected-onset', startSeconds: event.atSeconds })))
        .sort((a, b) => a.startSeconds - b.startSeconds),
    tolerance = 60 / 135 / 8;
function assess(observed) {
    const input = observed.map(event => ({ category: 'selected-onset', startSeconds: event.startSeconds })),
        fit = assessEvents(
            expected.filter(e => e.startSeconds < 120),
            input,
            0.1,
        ),
        errors = fit.matches.map(m => m.startErrorSeconds).sort((a, b) => a - b),
        offset = errors.length ? errors[Math.floor(errors.length / 2)] : 0;
    const summary = (reference, delta, from = 0) => {
        const outcome = assessEvents(
            reference,
            input.filter(e => e.startSeconds >= from).map(e => ({ ...e, startSeconds: e.startSeconds - delta })),
            tolerance,
        );
        return {
            referenceCount: outcome.expectedCount,
            observedCount: outcome.observedCount,
            matched: outcome.matchedCount,
            recall: outcome.matchedCount / Math.max(1, outcome.expectedCount),
            unreviewedObservedCount: outcome.extraCount,
            meanAbsoluteMs:
                outcome.matches.reduce((sum, m) => sum + Math.abs(m.startErrorSeconds) * 1000, 0) /
                Math.max(1, outcome.matchedCount),
            matches: outcome.matches,
            missed: outcome.missed,
        };
    };
    return {
        fixedOffsetSeconds: offset,
        raw: summary(expected, 0),
        calibrated: summary(expected, offset),
        heldOutRaw: summary(
            expected.filter(e => e.startSeconds >= 120),
            0,
            120,
        ),
        heldOutCalibrated: summary(
            expected.filter(e => e.startSeconds >= 120),
            offset,
            120,
        ),
    };
}
const result = record.bundle.result,
    raw = assess(result.candidates.filter(c => c.kind === 'drum' && !c.deleted)),
    presets = {};
let defaultReview;
for (const sensitivity of ['conservative', 'balanced', 'sensitive']) {
    const review = api.deriveCandidateReview(
        result,
        { ...record.review, sensitivity, view: 'timbres' },
        record.thresholds,
    );
    presets[sensitivity] = {
        markerCount: review.markers.length,
        retainedRaw: review.selectedIds.length,
        timing: assess(review.markers),
    };
    if (sensitivity === 'conservative') defaultReview = review;
}
let projectError = null;
try {
    await fs.writeFile(
        path.join(directory, projectName),
        JSON.stringify(api.applySoundMarkers(manual, result, defaultReview), null, 2),
        'utf8',
    );
} catch (error) {
    projectError = String(error);
}
const output = {
    sourceHash: report.sourceHash,
    referenceHash: sha(await fs.readFile(value('--reference'))),
    raw,
    presets,
    toleranceSeconds: tolerance,
    calibrationRange: [0, 120],
    incomplete: result.incompleteDrumRanges,
    projectError,
    note: 'Positive manual onsets only. Other candidates remain unreviewed; these numbers do not prove precision, drum class accuracy or hearing acceptance.',
    productElapsedMs: report.elapsedMs,
    stemHash: report.stemHash,
};
await fs.writeFile(path.join(directory, outputName), JSON.stringify(output, null, 2), 'utf8');
console.log(
    JSON.stringify(
        {
            output: path.join(directory, outputName),
            rawRecall: raw.raw.recall,
            presets: Object.fromEntries(
                Object.entries(presets).map(([name, p]) => [
                    name,
                    { markers: p.markerCount, recall: p.timing.raw.recall, heldOutRecall: p.timing.heldOutRaw.recall },
                ]),
            ),
            projectError,
        },
        null,
        2,
    ),
);
