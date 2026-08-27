import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildE4OverlayGolden,
    createE4OverlayProject,
    createE4OverlayWav,
} from '../support/e4-overlay-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const E4_OVERLAY_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/editor-e4-overlay.v1.json',
);
export const E4_OVERLAY_WAV_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e4-overlay-v1.wav',
);
export const E4_OVERLAY_PROJECT_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e4-overlay-v1.audiosurf-editor.json',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildE4OverlayGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(E4_OVERLAY_GOLDEN_PATH), { recursive: true });
        await writeFile(E4_OVERLAY_GOLDEN_PATH, serialized, 'utf8');
    } else {
        const existing = await readFile(E4_OVERLAY_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            console.error('E4 overlay golden differs. Review before updating.');
            process.exitCode = 1;
            return;
        }
    }
    await mkdir(path.dirname(E4_OVERLAY_WAV_PATH), { recursive: true });
    await writeFile(E4_OVERLAY_WAV_PATH, createE4OverlayWav());
    await writeFile(E4_OVERLAY_PROJECT_PATH, createE4OverlayProject(), 'utf8');
    console.log('E4 overlay golden matches; runtime WAV and project are ready.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
