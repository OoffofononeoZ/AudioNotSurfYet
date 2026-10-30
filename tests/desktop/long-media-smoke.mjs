import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { resourceRows } from '../support/visualizer-assets.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';
import { createLongWav, LONG_EVENTS, LONG_SECONDS, LONG_FLASH_SECONDS } from './long-media-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('media-long');
const runId = path.basename(native.directory);
const output = path.join(root, 'artifacts/desktop/media-long', runId);
const mediaRoot = path.join(root, 'artifacts/visualizer-composition/output');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(mediaRoot, { recursive: true });
console.log(`Desktop long media: ${output}`);
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const fixture = path.join(output, 'fixture.mjs');
await build({
    entryPoints: [path.join(root, 'tests/desktop/media-fixture.ts')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
});
const { createSyncProject, getVisualizerExportPreset } = await import(pathToFileURL(fixture));
const audio = path.join(native.directory, 'desktop-long.wav');
await createLongWav(audio);
const resources = resourceRows()
    .filter(row => ['solid', 'wireform'].includes(row.info.resource.id))
    .map(row => row.pack);
assert.equal(resources.length, 2);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = { status: 'running', nativeDirectory: native.directory, samples: [], checks: {} };
const errors = [];
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
let app, page;
async function opfsFiles() {
    return page.evaluate(async () => {
        const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-export');
        const files = [];
        for await (const name of directory.keys()) files.push(name);
        return files;
    });
}
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
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForSelector('#main-layout');
    await page.evaluate(() => {
        const Original = window.OfflineAudioContext;
        window.__longContexts = { created: 0, live: 0 };
        window.OfflineAudioContext = new Proxy(Original, {
            construct(target, args) {
                const context = Reflect.construct(target, args);
                window.__longContexts.created++;
                window.__longContexts.live++;
                context.addEventListener('complete', () => window.__longContexts.live--, { once: true });
                return context;
            },
        });
        HTMLCanvasElement.prototype.captureStream = () => {
            throw Error('Long export used captureStream');
        };
        window.MediaRecorder = new Proxy(window.MediaRecorder, {
            construct() {
                throw Error('Long export used MediaRecorder');
            },
        });
    });
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 60000,
    });
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    const baseFile = path.join(native.directory, 'base.json');
    await queueSave(app, baseFile);
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('export-project-file').click();
    await expect
        .poll(() =>
            fs
                .stat(baseFile)
                .then(s => s.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    const base = JSON.parse(await fs.readFile(baseFile, 'utf8'));
    assert.equal(base.track.durationSeconds, LONG_SECONDS);
    const project = createSyncProject(
        base,
        { algorithms: resources.flatMap(r => r.algorithms), elements: resources.flatMap(r => r.elements), presets: [] },
        { events: LONG_EVENTS, nativeMotion: true },
    );
    project.output = { aspectRatio: '16:9', resolution: '1080p', frameRate: 60, audioVideoOffsetMs: 0 };
    const input = path.join(native.directory, 'long.json');
    await write(input, project);
    await queueOpen(app, [input]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator(`[data-root-item-id="${project.items[0].id}"]`)).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    const position = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.getByTestId('visualizer-preview-frame').hover();
    const started = Date.now();
    await page.getByTestId('start-visualizer-export').click();
    for (;;) {
        const before = Date.now();
        const snapshot = await page.evaluate(() => ({
            status: document.querySelector('[data-export-status]')?.getAttribute('data-export-status'),
            progress: document.querySelector('[aria-label="视频导出进度"]')?.getAttribute('aria-valuenow'),
            heapBytes: performance.memory?.usedJSHeapSize ?? null,
            contexts: window.__longContexts,
            error: document.querySelector('.viz-status-lines')?.textContent,
        }));
        const metrics = await app.evaluate(({ app }) =>
            app.getAppMetrics().map(({ pid, type, memory }) => ({ pid, type, memory })),
        );
        result.samples.push({ elapsedMs: Date.now() - started, responseMs: Date.now() - before, ...snapshot, metrics });
        assert.notEqual(snapshot.status, 'error', snapshot.error);
        if (snapshot.status === 'ready') break;
        assert(Date.now() - started < 1200000, 'Long export exceeded runner timeout');
        if (result.samples.length % 10 === 0)
            console.log(`Long export: ${snapshot.status} ${snapshot.progress ?? '?'}%`);
        await page.waitForTimeout(2000);
    }
    result.exportMs = Date.now() - started;
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', position);
    const file = path.join(mediaRoot, `${runId}-electron-1080p60-sync.webm`);
    await queueSave(app, file);
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
    assert.deepEqual(await opfsFiles(), []);
    result.checks.longNativeSave = 'passed';
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect
        .poll(
            async () =>
                Number(await page.getByRole('progressbar', { name: '视频导出进度' }).getAttribute('aria-valuenow')),
            { timeout: 30000 },
        )
        .toBeGreaterThan(0.2);
    const cancelAt = Date.now();
    await page.getByTestId('cancel-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible();
    result.cancelMs = Date.now() - cancelAt;
    await expect.poll(() => page.evaluate(() => window.__longContexts.live)).toBe(0);
    assert.deepEqual(await opfsFiles(), []);
    result.checks.cancelAndTempCleanup = 'passed';
    await write(file + '.capture.json', {
        mode: 'offline',
        browser: 'electron',
        browserVersion: result.versions.electron,
        kind: 'sync',
        scenario: 'long',
        sourceDurationSeconds: LONG_SECONDS,
        audioVideoOffsetMs: 0,
        syncEventsSeconds: LONG_EVENTS,
        syncFlashSeconds: LONG_FLASH_SECONDS,
        preset: getVisualizerExportPreset('1080p', 60),
    });
    await write(path.join(output, 'capture.json'), result);
    const verified = spawnSync(
        process.execPath,
        ['tests/scripts/verify-visualizer-output.mjs', runId, '--files-only'],
        { cwd: root, encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 600000 },
    );
    await fs.writeFile(path.join(output, 'media-verification.log'), verified.stdout + verified.stderr, 'utf8');
    assert.equal(verified.status, 0, verified.stdout + verified.stderr);
    result.checks.mediaOracle = 'passed';
    result.measurement = path.join(mediaRoot, `${runId}-strict-offline-sync-v4-measurement.json`);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.screenshot({ path: path.join(output, 'long-export.png') });
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    console.error(result.error);
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => '');
} finally {
    try {
        await app?.close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
    }
    result.pageErrors = errors;
    result.limitations = [
        'Native save chooser value substituted',
        'Controlled native spectrum plus flashes; not arbitrary complex scenes',
        '2s requested app metrics sampling; observed values are not memory or responsiveness guarantees',
    ];
    await write(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(result.status === 'passed' ? 0 : 1);
