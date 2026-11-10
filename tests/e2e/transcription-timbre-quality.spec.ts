import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assessEvents } from '../transcription/qualityMetrics';
import type { TranscriptionResult } from '../../src/transcription/candidateTypes';
import type { CandidateReview } from '../../src/transcription/candidateReview';
import type { KnownNote, KnownDrum } from '../transcription/qualityFixtures';
import type { AuxiliaryResult } from '../../src/transcription/auxiliarySeparation';

test('timbre review: real fixed models on controlled positive, mixed and no-target sections', async ({
    page,
}, info) => {
    test.setTimeout(900000);
    const directory = path.resolve(
        'artifacts/evals/editor-transcription/timbre-quality',
        `${info.project.name}-${Date.now()}`,
    );
    await fs.mkdir(directory, { recursive: true });
    const sources = [
        'src/transcription/pipeline.ts',
        'src/transcription/pitchNotes.ts',
        'src/transcription/analysisOptions.ts',
        'src/transcription/acousticIndex.ts',
        'src/transcription/candidateAcoustics.ts',
        'src/transcription/candidateReview.ts',
        'src/transcription/drumBatchModel.ts',
        'tests/transcription/timbre-quality.worker.ts',
        'tests/transcription/qualityFixtures.ts',
    ];
    const sourceHashes = await Promise.all(
        sources.map(async file => ({
            file,
            sha256: createHash('sha256')
                .update(await fs.readFile(file))
                .digest('hex'),
        })),
    );
    const issues: string[] = [];
    page.on('pageerror', error => issues.push(error.message));
    await page.goto('/tests/transcription/index.html');
    const reuseInput = process.env.TRANSCRIPTION_REVIEW_INPUT;
    const answer = reuseInput
        ? JSON.parse(await fs.readFile(reuseInput, 'utf8'))
        : await page.evaluate(
              () =>
                  new Promise<any>((resolve, reject) => {
                      const worker = new Worker('/tests/transcription/timbre-quality.worker.ts', { type: 'module' });
                      worker.onmessage = event => {
                          if (event.data.type === 'progress') {
                              document.querySelector('#status')!.textContent = JSON.stringify(event.data);
                              return;
                          }
                          worker.terminate();
                          resolve(event.data);
                      };
                      worker.onerror = error => {
                          worker.terminate();
                          reject(Error(error.message));
                      };
                      worker.postMessage({});
                  }),
          );
    if (reuseInput) {
        const reviews = await page.evaluate(
            async ({ notes, drums }) => {
                const reviewUrl = '/src/transcription/candidateReview.ts',
                    settingsUrl = '/src/transcription/reviewSettings.ts',
                    configUrl = '/src/transcription/analysisOptions.ts',
                    validationUrl = '/src/transcription/candidates.ts';
                const { deriveCandidateReview } = await import(reviewUrl),
                    { defaultReviewSettings } = await import(settingsUrl),
                    { ANALYSIS_CONFIG_HASH } = await import(configUrl),
                    { validateCandidates } = await import(validationUrl);
                if (
                    notes.identity.analysisConfigHash !== ANALYSIS_CONFIG_HASH ||
                    drums.identity.analysisConfigHash !== ANALYSIS_CONFIG_HASH
                )
                    throw Error('Raw inference identity changed; rerun the models.');
                validateCandidates(notes);
                validateCandidates(drums);
                const reviewed = (result: TranscriptionResult) =>
                    Object.fromEntries(
                        ['conservative', 'balanced', 'sensitive'].map(sensitivity => [
                            sensitivity,
                            deriveCandidateReview(result, { ...defaultReviewSettings(), sensitivity }, {}),
                        ]),
                    );
                return { noteReviews: reviewed(notes), drumReviews: reviewed(drums) };
            },
            { notes: answer.result.notes, drums: answer.result.drums },
        );
        Object.assign(answer.result, reviews);
    }
    await fs.writeFile(path.join(directory, 'raw-result.json'), JSON.stringify(answer, null, 2), 'utf8');
    expect(answer.type, JSON.stringify(answer)).toBe('result');
    const result = answer.result as {
        knownNotes: KnownNote[];
        expectedDrums: KnownDrum[];
        sourceHash: string;
        drumHash: string;
        notes: TranscriptionResult;
        drums: TranscriptionResult;
        noteReviews: Record<string, CandidateReview>;
        drumReviews: Record<string, CandidateReview>;
        auxiliary: AuxiliaryResult;
    };
    const expected = result.knownNotes.map(note => ({ category: note.instrument, startSeconds: note.startSeconds }));
    const summarize = (review: CandidateReview) =>
        assessEvents(
            expected,
            review.markers.map(marker => ({ category: marker.instrument, startSeconds: marker.startSeconds })),
        );
    const report = {
        kind: 'controlled-sound-onset-review',
        qualityAccepted: false,
        associationSeconds: 0.12,
        warning:
            'Synthetic sound-onset counts do not establish hearing acceptance on real music. Unmarked real-song sounds remain unreviewed.',
        raw: assessEvents(
            expected,
            result.notes.candidates.map(candidate => ({
                category: candidate.instrument,
                startSeconds: candidate.startSeconds,
            })),
        ),
        presets: Object.fromEntries(
            Object.entries(result.noteReviews).map(([name, review]) => [name, summarize(review)]),
        ),
        heldOutStartSeconds: 5,
        heldOut: assessEvents(
            expected.filter(event => event.startSeconds >= 5),
            result.noteReviews
                .conservative!.markers.filter(marker => marker.startSeconds >= 5)
                .map(marker => ({ category: marker.instrument, startSeconds: marker.startSeconds })),
        ),
        drums: assessEvents(
            result.expectedDrums.map(hit => ({ category: hit.drum, startSeconds: hit.startSeconds })),
            result.drums.candidates
                .filter(candidate => candidate.kind === 'drum')
                .map(hit => ({ category: hit.drum, startSeconds: hit.startSeconds })),
        ),
        drumPresets: Object.fromEntries(
            Object.entries(result.drumReviews).map(([name, review]) => [
                name,
                assessEvents(
                    result.expectedDrums.map(hit => ({ category: hit.drum, startSeconds: hit.startSeconds })),
                    review.markers.map(marker => {
                        const raw = result.drums.candidates.find(candidate => candidate.id === marker.rawIds[0])!;
                        return {
                            category: raw.kind === 'drum' ? raw.drum : 'invalid',
                            startSeconds: marker.startSeconds,
                        };
                    }),
                ),
            ]),
        ),
        noTargetMarkers: result.noteReviews.conservative!.markers.filter(marker => marker.startSeconds >= 11.4),
        issues,
    };
    await fs.writeFile(path.join(directory, 'quality-report.json'), JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(
        path.join(directory, 'identity.json'),
        JSON.stringify(
            {
                sourceHashes,
                reusedRawHash: reuseInput
                    ? createHash('sha256')
                          .update(await fs.readFile(reuseInput))
                          .digest('hex')
                    : null,
                userAgent: await page.evaluate(() => navigator.userAgent),
                recordedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
        'utf8',
    );
    for (const stem of result.auxiliary.stems) {
        if (reuseInput) {
            await fs.copyFile(path.join(path.dirname(reuseInput), stem.wav), path.join(directory, stem.wav));
            continue;
        }
        const base64 = await page.evaluate(
            async ({ directory, name }) => {
                const root = await navigator.storage.getDirectory();
                const job = await (await root.getDirectoryHandle('processing-p1')).getDirectoryHandle(directory);
                const file = await (await job.getFileHandle(name)).getFile();
                const buffer: ArrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(buffer);
                let binary = '';
                for (let start = 0; start < bytes.length; start += 32768)
                    binary += String.fromCharCode(...bytes.subarray(start, start + 32768));
                return btoa(binary);
            },
            { directory: result.auxiliary.directory, name: stem.wav },
        );
        await fs.writeFile(path.join(directory, stem.wav), Buffer.from(base64, 'base64'));
    }
    const baselineDirectory = process.env.TRANSCRIPTION_QUALITY_BASELINE;
    if (baselineDirectory) {
        const old = JSON.parse(await fs.readFile(path.join(baselineDirectory, 'raw-result.json'), 'utf8')).result;
        expect(old.sourceHash).toBe(result.sourceHash);
        expect(old.drumHash).toBe(result.drumHash);
        for (const role of ['piano', 'guitar'])
            expect(
                createHash('sha256')
                    .update(await fs.readFile(path.join(directory, `${role}.wav`)))
                    .digest('hex'),
            ).toBe(
                createHash('sha256')
                    .update(await fs.readFile(path.join(baselineDirectory, `${role}.wav`)))
                    .digest('hex'),
            );
        const observed = ['piano', 'guitar'].flatMap(role =>
            old.notes[role].notes.map((note: { startSeconds: number }) => ({
                category: role,
                startSeconds: note.startSeconds,
            })),
        );
        await fs.writeFile(
            path.join(directory, 'paired-baseline.json'),
            JSON.stringify(
                {
                    baselineDirectory,
                    identicalInputAndAuxiliary: true,
                    baseline: assessEvents(expected, observed),
                    current: report.presets.conservative,
                    qualityAccepted: false,
                },
                null,
                2,
            ),
            'utf8',
        );
    }
    console.log(`Timbre quality report: ${directory}`);
    expect(result.noteReviews.conservative!.markers.length).toBeGreaterThan(0);
    expect(result.notes.candidates.every(candidate => candidate.acoustics)).toBe(true);
    expect(issues).toEqual([]);
});
