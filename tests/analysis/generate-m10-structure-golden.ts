import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeMonoWav } from '../support/m7-learning-fixture.ts';
import {
    buildM10StructureGolden,
    createM10StructurePcm,
} from '../support/m10-structure-fixture.ts';
import {
    collectMeydaToleranceMismatches,
    describeMeydaToleranceMismatches,
} from '../support/tolerance.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const M10_STRUCTURE_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/m10-structures.v1.json',
);
export const M10_STRUCTURE_AUDIO_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m10-structures-v1.wav',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildM10StructureGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(M10_STRUCTURE_GOLDEN_PATH), { recursive: true });
        await writeFile(M10_STRUCTURE_GOLDEN_PATH, serialized, 'utf8');
        console.log(
            `Updated ${path.relative(REPOSITORY_ROOT, M10_STRUCTURE_GOLDEN_PATH)}.`,
        );
    } else {
        const existing = JSON.parse(
            await readFile(M10_STRUCTURE_GOLDEN_PATH, 'utf8'),
        ) as unknown;
        const mismatches = collectMeydaToleranceMismatches(
            buildM10StructureGolden(),
            existing,
        );
        if (mismatches.length > 0) {
            throw new Error(
                'M10 structure golden differs beyond the fixed Meyda tolerance. '
                + 'Review the numeric diff before updating.\n'
                + describeMeydaToleranceMismatches(mismatches),
            );
        }
        console.log(
            'M10 structure golden matches the locked generator within the fixed Meyda tolerance.',
        );
    }
    await mkdir(path.dirname(M10_STRUCTURE_AUDIO_PATH), { recursive: true });
    await writeFile(
        M10_STRUCTURE_AUDIO_PATH,
        encodeMonoWav(createM10StructurePcm()),
    );
    console.log(
        `Generated ${path.relative(REPOSITORY_ROOT, M10_STRUCTURE_AUDIO_PATH)}.`,
    );
}

if (
    process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    await main();
}
