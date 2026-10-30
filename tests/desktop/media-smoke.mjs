import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import { resourceRows, assetsRoot } from '../support/visualizer-assets.mjs';
import {
    createOutputSyncWav,
    OUTPUT_SYNC_EVENTS,
    OUTPUT_SYNC_FLASH_SECONDS,
} from '../support/visualizer-output-sync.ts';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('media');
const runId = path.basename(native.directory);
const output = path.join(root, 'artifacts/desktop/media', runId);
const mediaRoot = path.join(root, 'artifacts/visualizer-composition/output');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(mediaRoot, { recursive: true });
await build({
    entryPoints: [path.join(root, 'tests/desktop/media-fixture.ts')],
    outfile: path.join(output, 'fixture.mjs'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
});
const { createSyncProject, getVisualizerExportPreset } = await import(pathToFileURL(path.join(output, 'fixture.mjs')));
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const syncAudio = path.join(native.directory, 'desktop-sync.wav');
await fs.writeFile(syncAudio, createOutputSyncWav(), { flag: 'wx' });
const musicAudio = path.join(native.directory, 'desktop-music.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), musicAudio);
const solid = resourceRows().find(row => row.info.resource.id === 'solid').pack;
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    runId,
    exports: [],
    limitations: ['OS file/directory chooser values are substituted', 'Not a long-duration or model inference test'],
};
const errors = [];
let app, page;
let sequence = 0;
const record = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 4) + '\n', 'utf8');
async function projectExport() {
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
}
async function projectImport(project) {
    const file = path.join(native.directory, `input-${sequence++}.json`);
    await record(file, project);
    await queueOpen(app, [file]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`[data-root-item-id="${project.items[0].id}"]`)).toBeVisible();
    await page.getByRole('tab', { name: '输出', exact: true }).click();
    await expect(page.getByRole('combobox', { name: '输出分辨率', exact: true })).toHaveValue(
        project.output.resolution,
    );
    await expect(page.getByRole('combobox', { name: '输出帧率', exact: true })).toHaveValue(
        String(project.output.frameRate),
    );
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function selectAudio(file) {
    await page.getByTestId('sidebar-home-link').click();
    await queueOpen(app, [file]);
    await page.getByTestId('import-audio').click();
    if (result.exports.length > 0) await page.getByTestId('next-track').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    if (result.exports.length > 0) await page.getByRole('button', { name: '覆盖草稿', exact: true }).click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
}
async function render(project, kind, scenario) {
    const preset = getVisualizerExportPreset(project.output.resolution, project.output.frameRate);
    const file = path.join(
        mediaRoot,
        `${runId}-electron-${preset.resolution}${preset.frameRate}-${kind}-${scenario}.webm`,
    );
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    const before = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.getByTestId('visualizer-preview-frame').hover();
    const start = performance.now();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 180000 });
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', before);
    await expect(page.getByTestId('visualizer-preview-canvas')).not.toHaveAttribute('data-export-active', 'true');
    // Cancel the real save transfer once: ready OPFS output must stay retryable.
    if (result.exports.length === 0) {
        await queueSave(app);
        await page.getByTestId('save-visualizer-export').click();
        await expect.poll(() => app.evaluate(() => globalThis.__desktopFileDialogs.save.length)).toBe(0);
        await expect(page.locator('[data-export-status=ready]')).toBeVisible();
    }
    await queueSave(app, file);
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
    assert((await fs.stat(file)).size > 0);
    const capture = {
        mode: 'offline',
        browser: 'electron',
        browserVersion: result.versions.electron,
        kind,
        scenario,
        sourceDurationSeconds: project.track.durationSeconds,
        audioVideoOffsetMs: project.output.audioVideoOffsetMs,
        preset,
        ...(kind === 'sync'
            ? { syncEventsSeconds: OUTPUT_SYNC_EVENTS, syncFlashSeconds: OUTPUT_SYNC_FLASH_SECONDS }
            : {}),
    };
    await record(file + '.capture.json', capture);
    result.exports.push({ file, elapsedMs: Math.round(performance.now() - start), ...capture });
    console.log(`Saved ${preset.resolution}${preset.frameRate} ${kind}/${scenario}`);
}

console.log(`Desktop media: ${output}`);
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    result.versions = await app.evaluate(() => process.versions);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForSelector('#main-layout');
    // A test guard rejects any accidental use of the removed real-time recording path.
    await page.evaluate(() => {
        HTMLCanvasElement.prototype.captureStream = () => {
            throw Error('Offline export used captureStream');
        };
        window.MediaRecorder = new Proxy(window.MediaRecorder, {
            construct() {
                throw Error('Offline export used MediaRecorder');
            },
        });
    });
    await selectAudio(syncAudio);
    const base = await projectExport();
    const syncProject = createSyncProject(base, {
        algorithms: solid.algorithms,
        elements: solid.elements,
        presets: solid.presets,
    });
    for (const resolution of ['720p', '1080p'])
        for (const frameRate of [30, 60]) {
            syncProject.output = { aspectRatio: '16:9', resolution, frameRate, audioVideoOffsetMs: 0 };
            await projectImport(syncProject);
            await render(syncProject, 'sync', 'cold');
            await render(syncProject, 'sync', 'repeat');
        }
    await selectAudio(musicAudio);
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app, [assetsRoot]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await expect(page.locator('[data-resource-id="solid"]')).toBeVisible({ timeout: 30000 });
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    const musicProject = await projectExport();
    for (const resolution of ['720p', '1080p'])
        for (const frameRate of [30, 60]) {
            musicProject.output = { aspectRatio: '16:9', resolution, frameRate, audioVideoOffsetMs: 0 };
            await projectImport(musicProject);
            await render(musicProject, 'music', 'music');
        }
    const verified = spawnSync(
        process.execPath,
        ['tests/scripts/verify-visualizer-output.mjs', runId, '--files-only'],
        {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
            timeout: 240000,
        },
    );
    await fs.writeFile(path.join(output, 'media-verification.log'), verified.stdout + verified.stderr, 'utf8');
    assert.equal(verified.status, 0, verified.stdout + verified.stderr);
    result.measurement = path.join(mediaRoot, `${runId}-strict-offline-sync-v4-measurement.json`);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.screenshot({ path: path.join(output, 'media-exports.png') });
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    process.exitCode = 1;
    console.error(result.error);
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => '');
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
    result.alerts = await page
        ?.getByRole('alert')
        .allTextContents()
        .catch(() => []);
} finally {
    try {
        await app?.close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
        process.exitCode = 1;
    }
    result.pageErrors = errors;
    await record(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, exports: result.exports.length }));
}
process.exit(process.exitCode ?? 0);
