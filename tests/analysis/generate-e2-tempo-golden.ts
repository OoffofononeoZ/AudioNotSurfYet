import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    buildE2TempoGolden,
    createE2Tempo100Wav,
} from '../support/e2-tempo-fixture.ts';

const REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..',
);
export const E2_TEMPO_GOLDEN_PATH = path.join(
    REPOSITORY_ROOT,
    'tests/analysis/golden/editor-e2-tempo.v1.json',
);
export const E2_TEMPO_WAV_PATH = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/editor-e2-tempo-100-v1.wav',
);

async function main(): Promise<void> {
    const serialized = `${JSON.stringify(buildE2TempoGolden(), null, 2)}\n`;
    if (process.argv.includes('--write')) {
        await mkdir(path.dirname(E2_TEMPO_GOLDEN_PATH), { recursive: true });
        await writeFile(E2_TEMPO_GOLDEN_PATH, serialized, 'utf8');
    } else {
        const existing = await readFile(E2_TEMPO_GOLDEN_PATH, 'utf8');
        if (existing !== serialized) {
            console.error('E2 tempo golden differs. Review before updating.');
            process.exitCode = 1;
            return;
        }
    }
    await mkdir(path.dirname(E2_TEMPO_WAV_PATH), { recursive: true });
    await writeFile(E2_TEMPO_WAV_PATH, createE2Tempo100Wav());
    console.log('E2 tempo golden matches; runtime 100 BPM WAV is ready.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
