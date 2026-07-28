import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    GENERATOR_VERSION,
    createDualTone,
    createImpulse,
    createSilence,
    createSine,
    sha256Float32,
} from '../support/audio-fixtures.ts';
import {
    ANALYSIS_CONFIG,
    extractFirstSlice,
} from '../support/meyda-golden.ts';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/first-slice.v1.json',
);

export function buildGolden() {
    const cases = [
        { id: 'silence-frame', frame: createSilence(ANALYSIS_CONFIG.frameSize) },
        { id: 'sine-440-frame', frame: createSine(440, ANALYSIS_CONFIG.frameSize, 0.5) },
        {
            id: 'dual-c4-e4-frame',
            frame: createDualTone(
                261.625565,
                329.627557,
                ANALYSIS_CONFIG.frameSize,
                0.25,
            ),
        },
        {
            id: 'impulse-hop-boundary-frame',
            frame: createImpulse(ANALYSIS_CONFIG.frameSize, ANALYSIS_CONFIG.hopSize),
        },
    ];

    return {
        schemaVersion: 1,
        generatedAt: '2026-07-28',
        generatorVersion: GENERATOR_VERSION,
        meydaVersion: '5.6.3',
        analysisConfig: ANALYSIS_CONFIG,
        cases: cases.map(({ id, frame }) => ({
            id,
            fixtureHash: sha256Float32(frame),
            expected: extractFirstSlice(frame),
        })),
    };
}

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(GOLDEN_PATH), { recursive: true });
        await writeFile(GOLDEN_PATH, serialized, 'utf8');
        console.log(`Updated ${path.relative(REPOSITORY_ROOT, GOLDEN_PATH)}.`);
        return;
    }

    const existing = await readFile(GOLDEN_PATH, 'utf8');
    if (existing !== serialized) {
        console.error('Golden data differs. Review the numeric diff before running fixtures:golden:update.');
        process.exitCode = 1;
        return;
    }
    console.log('Golden data matches the locked generator and Meyda configuration.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
