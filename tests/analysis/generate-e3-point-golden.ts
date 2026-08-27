import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildE3PointGolden,
    createE3PointWav,
    createE3RangeCompatibilityProject,
} from '../support/e3-point-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const E3_POINT_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/editor-e3-points.v1.json',
);
export const E3_POINT_WAV_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e3-points-v1.wav',
);
export const E3_RANGE_PROJECT_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e3-range-compat-v1.audiosurf-editor.json',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildE3PointGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(E3_POINT_GOLDEN_PATH), { recursive: true });
        await writeFile(E3_POINT_GOLDEN_PATH, serialized, 'utf8');
    } else {
        const existing = await readFile(E3_POINT_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            console.error('E3 point golden differs. Review before updating.');
            process.exitCode = 1;
            return;
        }
    }
    await mkdir(path.dirname(E3_POINT_WAV_PATH), { recursive: true });
    await writeFile(E3_POINT_WAV_PATH, createE3PointWav());
    await writeFile(
        E3_RANGE_PROJECT_PATH,
        createE3RangeCompatibilityProject(),
        'utf8',
    );
    console.log('E3 point golden matches; runtime point WAV is ready.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
