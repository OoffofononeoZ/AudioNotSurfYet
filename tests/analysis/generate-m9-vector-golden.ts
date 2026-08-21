import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeMonoWav } from '../support/m7-learning-fixture.ts';
import {
    buildM9VectorGolden,
    createM9VectorPcm,
} from '../support/m9-vector-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const M9_VECTOR_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/m9-vectors.v1.json',
);
export const M9_VECTOR_AUDIO_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m9-vectors-v1.wav',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildM9VectorGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(M9_VECTOR_GOLDEN_PATH), { recursive: true });
        await writeFile(M9_VECTOR_GOLDEN_PATH, serialized, 'utf8');
        console.log(
            `Updated ${path.relative(REPOSITORY_ROOT, M9_VECTOR_GOLDEN_PATH)}.`,
        );
    } else {
        const existing = await readFile(M9_VECTOR_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            throw new Error(
                'M9 vector golden differs. Review the numeric diff before updating.',
            );
        }
        console.log('M9 vector golden matches the locked generator.');
    }
    await mkdir(path.dirname(M9_VECTOR_AUDIO_PATH), { recursive: true });
    await writeFile(M9_VECTOR_AUDIO_PATH, encodeMonoWav(createM9VectorPcm()));
    console.log(`Generated ${path.relative(REPOSITORY_ROOT, M9_VECTOR_AUDIO_PATH)}.`);
}

if (
    process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    await main();
}
