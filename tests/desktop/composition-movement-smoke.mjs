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
import { copyResourceLibrary } from './resource-library-fixture.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';
import { runCompositionMovement, writeMovementCapture } from '../support/composition-movement-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('composition-movement');
const output = path.join(root, 'artifacts/desktop/composition-movement', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const library = path.join(native.directory, 'assets');
await copyResourceLibrary(library);
const audio = path.join(native.directory, 'layers.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    limitations: [
        'Native chooser responses are substituted; tests exercise actual packaged Electron UI and shared movement logic.',
    ],
};
const errors = [];
let app,
    page,
    sequence = 0;
console.log(`Desktop composition movement: ${output}`);
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
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    const resizeViewport = async (width, height) => {
        await app.evaluate(
            ({ BrowserWindow }, size) => {
                const window = BrowserWindow.getAllWindows()[0];
                window.setContentSize(size.width, size.height);
                window.show();
            },
            { width, height },
        );
    };
    await resizeViewport(1920, 1080);
    await page.waitForSelector('#main-layout');
    assert(page.url().startsWith('app://audiosurf/'));
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app, [library]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    result.checks = await runCompositionMovement(page, {
        resizeViewport,
        async readProject() {
            const file = path.join(native.directory, `project-${sequence++}.json`);
            await queueSave(app, file);
            await page.getByTestId('export-visualizer-project').click();
            await page.getByTestId('export-project-file').click();
            await expect
                .poll(() =>
                    fs
                        .stat(file)
                        .then(s => s.size)
                        .catch(() => 0),
                )
                .toBeGreaterThan(0);
            return JSON.parse(await fs.readFile(file, 'utf8'));
        },
        async importProject(p) {
            const file = path.join(native.directory, `import-${sequence++}.json`);
            await fs.writeFile(file, JSON.stringify(p), 'utf8');
            await queueOpen(app, [file]);
            await page.getByTestId('import-visualizer-project').click();
            await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
            await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
        },
        async screenshot(name) {
            await page.screenshot({ path: path.join(output, `${name}.png`) });
        },
        async saveVideo() {
            const file = path.join(native.directory, 'layers.webm');
            await queueSave(app, file);
            await page.getByTestId('save-visualizer-export').click();
            await expect(page.locator('[data-export-status=idle]')).toBeVisible();
            await expect
                .poll(() =>
                    fs
                        .stat(file)
                        .then(s => s.size)
                        .catch(() => 0),
                )
                .toBeGreaterThan(1000);
            return file;
        },
    });
    result.versions = await app.evaluate(() => process.versions);
    const video = path.join(root, 'artifacts/visualizer-composition/output/composition-movement-electron.webm');
    await fs.mkdir(path.dirname(video), { recursive: true });
    await copyVerifiedBytes(path.join(native.directory, 'layers.webm'), video);
    await writeMovementCapture(video, result.checks, 'electron', result.versions.electron);
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = error.stack ?? String(error);
    console.error(error);
    process.exitCode = 1;
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
    result.errors = errors;
    if (app) await app.close();
    await cleanupNativeTree(runtime);
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
}
console.log(JSON.stringify({ status: result.status, output }));
