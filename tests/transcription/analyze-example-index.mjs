import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { build } from 'esbuild';

const flag = process.argv.indexOf('--index');
if (flag < 0) throw Error('Pass --index <exported index.json>. Outputs remain beside that explicit local artifact.');
const manifestPath = path.resolve(process.argv[flag + 1]),
    directory = path.dirname(manifestPath);
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')),
    report = JSON.parse(await fs.readFile(path.join(directory, 'report.json'), 'utf8')),
    sha = value => createHash('sha256').update(value).digest('hex');
if (manifest.sourceHash !== report.sourceHash) throw Error('Different song identity.');
const index = { ...manifest.metadata };
for (const field of manifest.arrays) {
    if (!/^(rms|onset|mfcc|chroma|bandRms|bandOnset)\.f32$/.test(field.file)) throw Error('Unexpected array file.');
    const bytes = await fs.readFile(path.join(directory, field.file));
    if (bytes.length !== field.bytes || sha(bytes) !== field.sha256 || bytes.length % 4)
        throw Error('DSP bytes changed.');
    index[field.name] = new Float32Array(Uint8Array.from(bytes).buffer);
}
const source = await fs.readFile('src/transcription/examples/matcher.ts', 'utf8'),
    moduleFile = path.join(directory, `analysis-${randomUUID()}.mjs`);
// Read-only instrumentation: expose existing helpers in this private analysis bundle.
// It does not edit production source or count as a product-quality run.
await build({
    stdin: {
        contents: `${source}\nexport {descriptors, summarize, sequence, similarity, validAcousticIndex};`,
        resolveDir: path.resolve('src/transcription/examples'),
        sourcefile: 'instrumented-example-matcher.ts',
        loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: moduleFile,
});
const api = await import(pathToFileURL(moduleFile));
if (!api.validAcousticIndex(index)) throw Error('Invalid acoustic index.');
const data = api.descriptors(index),
    signal = new AbortController().signal,
    frameAt = seconds => Math.max(0, Math.min(index.frameCount - 1, Math.round((seconds * 22050 - 512) / 512)));
const queries = [];
for (const original of report.queries) {
    if (!original.holdout) continue;
    const example = original.example,
        target = original.holdout,
        first = frameAt(example.startSeconds),
        last = frameAt(example.endSeconds) + 1,
        truthFirst = frameAt(target.startSeconds),
        truthLast = frameAt(target.endSeconds) + 1,
        summary = api.summarize(data, first, last),
        seq = api.sequence(data, first, last);
    const pairs = [];
    for (const ratio of [0.5, 0.6, 0.8, 1, 1.2, 1.5, 1.75, 2, (truthLast - truthFirst) / (last - first)]) {
        const end = Math.min(index.frameCount, truthFirst + Math.round((last - first) * ratio)),
            coarse = api.similarity(summary, api.summarize(data, truthFirst, end)),
            dtw = api.boundedDtw(seq, api.sequence(data, truthFirst, end), signal);
        pairs.push({ ratio, coarse, dtw, score: 0.2 * coarse + 0.8 * dtw });
    }
    const relaxed = await api.searchSoundExamples(
        index,
        { ...original.profile, threshold: 0.5, matches: [], queryHash: null },
        signal,
    );
    const partialPairs = [];
    for (const fraction of [0.5, 2 / 3, 0.8])
        for (const position of [0, 0.5, 1]) {
            const low = first + Math.round((last - first) * (1 - fraction) * position),
                high = Math.min(last, low + Math.round((last - first) * fraction)),
                coarse = api.similarity(api.summarize(data, low, high), api.summarize(data, truthFirst, truthLast)),
                dtw = api.boundedDtw(api.sequence(data, low, high), api.sequence(data, truthFirst, truthLast), signal);
            partialPairs.push({
                fraction,
                position,
                coarse,
                dtw,
                score: 0.2 * coarse + 0.8 * dtw - 0.04 * (1 - fraction),
            });
        }
    const overlaps = relaxed.matches
        .map(match => ({
            match,
            overlap: Math.max(
                0,
                Math.min(match.endSeconds, target.endSeconds) - Math.max(match.startSeconds, target.startSeconds),
            ),
        }))
        .filter(item => item.overlap > 0)
        .sort((a, b) => b.overlap - a.overlap);
    queries.push({
        example,
        target,
        pairs,
        partialPairs,
        diagnosticRelaxedThreshold: 0.5,
        candidateCount: relaxed.matches.length,
        overlaps,
        matches: relaxed.matches,
        note: 'Diagnostic only. The initial fixed-threshold holdout miss remains recorded; this is not new acceptance.',
    });
}
const output = path.join(directory, `diagnostic-${Date.now()}.json`);
await fs.writeFile(
    output,
    JSON.stringify(
        { sourceHash: manifest.sourceHash, matcherSourceHash: sha(source), config: api.EXAMPLE_SEARCH_CONFIG, queries },
        null,
        2,
    ),
    'utf8',
);
console.log(
    JSON.stringify(
        {
            output,
            queries: queries.map(q => ({
                example: q.example.startSeconds,
                partialPairs: q.partialPairs,
                candidateCount: q.candidateCount,
                overlaps: q.overlaps.length,
            })),
        },
        null,
        2,
    ),
);
