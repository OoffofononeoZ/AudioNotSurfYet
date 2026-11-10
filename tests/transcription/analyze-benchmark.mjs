import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assessEvents } from './qualityMetrics.ts';

const args = process.argv.slice(2);
const value = flag => args[args.indexOf(flag) + 1];
for (const flag of ['--report', '--reference', '--source', '--stem']) {
    if (args.indexOf(flag) < 0 || !value(flag)) throw Error(`Missing ${flag}`);
}
const reportPath = path.resolve(value('--report'));
const workspace = await fs.realpath(process.cwd());
const parent = await fs.realpath(path.dirname(reportPath));
const relative = path.relative(workspace, parent);
if (relative.startsWith('..') || path.isAbsolute(relative))
    throw Error('Write reports only within the current workspace.');
const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
const reference = JSON.parse(await fs.readFile(value('--reference'), 'utf8'));
const sourceHash = createHash('sha256')
    .update(await fs.readFile(value('--source')))
    .digest('hex');
if (sourceHash !== reference.track.contentHash) throw Error('Audio and manual reference do not match.');
const stemHash = createHash('sha256')
    .update(await fs.readFile(value('--stem')))
    .digest('hex');
const provenance = JSON.parse(await fs.readFile(`${value('--stem')}.json`, 'utf8'));
if (stemHash !== report.stemHash || provenance.sourceHash !== sourceHash)
    throw Error('Frozen FT input provenance does not match.');
const result = report.answer?.result;
if (!result?.hits || !Array.isArray(reference.lanes) || reference.lanes.length < 3)
    throw Error('Unexpected benchmark or reference shape.');
const expected = reference.lanes
    .slice(0, 2)
    .flatMap(lane =>
        lane.events.map(event => ({
            category: 'selected-onset',
            startSeconds: event.atSeconds,
        })),
    )
    .sort((a, b) => a.startSeconds - b.startSeconds);
const observed = result.hits.map(hit => ({ category: 'selected-onset', startSeconds: hit.startSeconds }));
const tolerance = 60 / 135 / 8;
const calibration = expected.filter(event => event.startSeconds < 120);
const fit = assessEvents(calibration, observed, 0.1);
const errors = fit.matches.map(match => match.startErrorSeconds).sort((a, b) => a - b);
const offset = errors.length ? errors[Math.floor(errors.length / 2)] : 0;
const summary = (events, shift, window, startSeconds = 0) => {
    const assessed = assessEvents(
        events,
        observed
            .filter(event => event.startSeconds >= startSeconds)
            .map(event => ({ ...event, startSeconds: event.startSeconds - shift })),
        window,
    );
    return {
        referenceCount: assessed.expectedCount,
        observedCount: assessed.observedCount,
        matched: assessed.matchedCount,
        recall: assessed.matchedCount / Math.max(1, assessed.expectedCount),
        missed: assessed.missed,
        meanAbsoluteMs:
            assessed.matches.reduce((sum, match) => sum + Math.abs(match.startErrorSeconds) * 1000, 0) /
            Math.max(1, assessed.matchedCount),
        matches: assessed.matches,
        unreviewedObservedCount: assessed.extraCount,
    };
};
const output = {
    kind: 'timing-only-positive-reference',
    sourceHash,
    referenceHash: createHash('sha256')
        .update(await fs.readFile(value('--reference')))
        .digest('hex'),
    warning: 'Unmarked sounds are not negatives. This report does not establish class accuracy or precision.',
    calibrationRange: [0, 120],
    fixedOffsetSeconds: offset,
    toleranceSeconds: tolerance,
    raw: summary(expected, 0, tolerance),
    calibrated: summary(expected, offset, tolerance),
    heldOutRaw: summary(
        expected.filter(event => event.startSeconds >= 120),
        0,
        tolerance,
        120,
    ),
    heldOutCalibrated: summary(
        expected.filter(event => event.startSeconds >= 120),
        offset,
        tolerance,
        120,
    ),
    sensitivity: [0.025, 0.05, 0.1].map(window => ({ windowSeconds: window, ...summary(expected, 0, window) })),
    rangeExamples: reference.lanes[2].events,
    totalMs: result.totalMs,
    incomplete: result.incomplete,
};
const destination = reportPath.replace(/\.json$/, '') + '.timing.json';
await fs.writeFile(destination, JSON.stringify(output, null, 2), 'utf8');
console.log(
    JSON.stringify({
        output: destination,
        recall: output.raw.recall,
        heldOutRecall: output.heldOutRaw.recall,
        fixedOffsetSeconds: offset,
        totalMs: result.totalMs,
    }),
);
