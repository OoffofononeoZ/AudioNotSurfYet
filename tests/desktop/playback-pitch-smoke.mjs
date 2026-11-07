import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen } from './dialog-fixture.mjs';
import {
    installPlaybackPitchProbe,
    verifyPlaybackPitchControls,
    verifyEditorPitchScrubbing,
    writePitchFixture,
} from '../support/playback-pitch-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('playback-pitch');
const output = path.join(root, 'artifacts/desktop/playback-pitch', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'pitch.wav');
await writePitchFixture(audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    limitations: [
        'Only the OS audio chooser result is substituted; frequency measurements use the packaged renderer and its real AudioContext.',
    ],
};
let app, page;
const errors = [];
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    assert(page.url().startsWith('app://audiosurf/'));
    await installPlaybackPitchProbe(page);
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    result.frequencies = await verifyPlaybackPitchControls(page);
    await page.getByTestId('playback-speed').click();
    await page.screenshot({ path: path.join(output, 'pitch-switch.png') });
    await page.keyboard.press('Escape');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    result.scrubbing = await verifyEditorPitchScrubbing(page);
    assert.deepEqual(errors, []);
    result.status = 'passed';
    result.versions = await app.evaluate(() => process.versions);
} catch (error) {
    result.status = 'failed';
    result.error = error.stack ?? String(error);
    process.exitCode = 1;
    console.error(error);
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
    if (app) await app.close();
    await cleanupNativeTree(runtime);
    result.errors = errors;
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
}
console.log(JSON.stringify({ status: result.status, output }));
