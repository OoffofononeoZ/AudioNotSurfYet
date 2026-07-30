import {
    mkdir,
    readFile,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildM7LearningGolden } from '../support/m7-learning-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const M7_LEARNING_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/m7-learning.v1.json',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildM7LearningGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(M7_LEARNING_GOLDEN_PATH), {
            recursive: true,
        });
        await writeFile(M7_LEARNING_GOLDEN_PATH, serialized, 'utf8');
        console.log(
            `Updated ${path.relative(REPOSITORY_ROOT, M7_LEARNING_GOLDEN_PATH)}.`,
        );
        return;
    }
    const existing = await readFile(M7_LEARNING_GOLDEN_PATH, 'utf8');
    if (existing !== serialized) {
        console.error(
            'M7 learning golden differs. Review the numeric diff before updating.',
        );
        process.exitCode = 1;
        return;
    }
    console.log('M7 learning golden matches the locked generator.');
}

if (
    process.argv[1]
    && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    await main();
}
