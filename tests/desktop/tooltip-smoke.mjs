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
import { runTooltipScenario } from '../support/tooltip-scenario.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('tooltip');
const output = path.join(root, 'artifacts/desktop/tooltip', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const library = path.join(native.directory, 'assets');
await copyResourceLibrary(library);
const audio = path.join(native.directory, 'tooltip.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/format-master.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    limitations: [
        'Native file chooser values are substituted; actual packaged Electron UI and shared codec are exercised.',
        'Window minimum size is relaxed only in this isolated test to exercise the shared 390px layout.',
    ],
};
const errors = [];
let app,
    page,
    sequence = 0,
    last;
console.log(`Desktop tooltip: ${output}`);
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
    const resizeViewport = async (width, height) =>
        app.evaluate(
            ({ BrowserWindow }, size) => {
                const window = BrowserWindow.getAllWindows()[0];
                window.setMinimumSize(0, 0);
                window.setContentSize(size.width, size.height);
                window.show();
            },
            { width, height },
        );
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
    for (const id of ['point-line-horizontal', 'fade', 'circular-background', 'black-hole-lyrics']) {
        await page.getByTestId('add-visualizer-element').click();
        await page.getByRole('button', { name: '元素', exact: true }).click();
        await page.locator(`[data-element-type="${id}"]`).click();
    }
    result.checks = await runTooltipScenario(page, {
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
            last = JSON.parse(await fs.readFile(file, 'utf8'));
            return last;
        },
        async lastProject() {
            return last;
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
    });
    result.versions = await app.evaluate(() => process.versions);
    assert(result.checks.persisted);
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
