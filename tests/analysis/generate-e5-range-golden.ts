import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildE5RangeGolden,
    createE5RangeProject,
    createE5RangeWav,
} from '../support/e5-range-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const E5_RANGE_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/editor-e5-ranges.v1.json',
);
export const E5_RANGE_WAV_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e5-ranges-v1.wav',
);
export const E5_RANGE_PROJECT_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e5-ranges-v1.audiosurf-editor.json',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildE5RangeGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(E5_RANGE_GOLDEN_PATH), { recursive: true });
        await writeFile(E5_RANGE_GOLDEN_PATH, serialized, 'utf8');
    } else {
        const existing = await readFile(E5_RANGE_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            console.error('E5 range golden differs. Review before updating.');
            process.exitCode = 1;
            return;
        }
    }
    await mkdir(path.dirname(E5_RANGE_WAV_PATH), { recursive: true });
    await writeFile(E5_RANGE_WAV_PATH, createE5RangeWav());
    await writeFile(E5_RANGE_PROJECT_PATH, createE5RangeProject(), 'utf8');
    console.log('E5 range golden matches; runtime WAV and project are ready.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
