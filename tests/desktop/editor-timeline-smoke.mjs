import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, expect } from '@playwright/test';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen } from './dialog-fixture.mjs';
import {
    verifyTimelineAlignment,
    verifyIndependentTimeline,
    verifyTimelineLock,
    verifyOffscreenMarkerBlocks,
} from '../support/editor-timeline-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('editor-timeline');
const output = path.join(root, 'artifacts/desktop/editor-timeline', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'tempo.wav');
await copyVerifiedBytes(path.join(root, 'artifacts/fixtures/editor-e2-tempo-100-v1.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    limitations: [
        'Only OS chooser responses are substituted; the packaged Electron application, IPC and playback remain real.',
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
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForSelector('#main-layout');
    assert(page.url().startsWith('app://audiosurf/'));
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('editor-timeline').focus();
    await page.keyboard.press('Home');
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton', { name: '辅助 BPM', exact: true });
    await bpm.fill('120');
    await bpm.press('Enter');
    await page.getByTestId('toggle-editor-timing').click();
    const resize = async (width, height) =>
        app.evaluate(
            ({ BrowserWindow }, size) => {
                const window = BrowserWindow.getAllWindows()[0];
                window.setContentSize(size.width, size.height);
                window.show();
            },
            { width, height },
        );
    await verifyTimelineAlignment(page, resize);
    for (let i = 0; i < 10; i++) {
        await page.getByTestId('add-marker-lane').click();
        await expect(page.getByTestId('add-point-lane')).toBeFocused();
        await page.keyboard.press('Enter');
    }
    await verifyTimelineAlignment(page, resize, name => page.screenshot({ path: path.join(output, `${name}.png`) }));
    await verifyIndependentTimeline(page);
    await page.getByTestId('lock-editor-timeline').click();
    await verifyTimelineAlignment(page, resize, name =>
        page.screenshot({ path: path.join(output, `locked-${name}.png`) }),
    );
    await page.getByTestId('lock-editor-timeline').click();
    await verifyTimelineLock(page, name => page.screenshot({ path: path.join(output, `${name}.png`) }));
    await page.getByTestId('lock-editor-timeline').click();
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('lock-editor-timeline')).toHaveAttribute('aria-pressed', 'false');
    await verifyOffscreenMarkerBlocks(page);
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
