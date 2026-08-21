import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildM8ScalarGolden } from '../support/m8-scalar-fixture.ts';
import { encodeMonoWav } from '../support/m7-learning-fixture.ts';
import { createM8ScalarPcm } from '../support/m8-scalar-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const M8_SCALAR_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/m8-scalars.v1.json',
);
export const M8_SCALAR_AUDIO_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m8-scalars-v1.wav',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildM8ScalarGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(M8_SCALAR_GOLDEN_PATH), { recursive: true });
        await writeFile(M8_SCALAR_GOLDEN_PATH, serialized, 'utf8');
        console.log(
            `Updated ${path.relative(REPOSITORY_ROOT, M8_SCALAR_GOLDEN_PATH)}.`,
        );
    } else {
        const existing = await readFile(M8_SCALAR_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            throw new Error(
                'M8 scalar golden differs. Review the numeric diff before updating.',
            );
        }
        console.log('M8 scalar golden matches the locked generator.');
    }
    await mkdir(path.dirname(M8_SCALAR_AUDIO_PATH), { recursive: true });
    await writeFile(M8_SCALAR_AUDIO_PATH, encodeMonoWav(createM8ScalarPcm()));
    console.log(`Generated ${path.relative(REPOSITORY_ROOT, M8_SCALAR_AUDIO_PATH)}.`);
}

if (
    process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    await main();
}
