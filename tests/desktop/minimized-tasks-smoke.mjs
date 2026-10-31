import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { verifiedFtProfile, databaseRows } from './processing-support.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const flag = process.argv.indexOf('--profile-from');
assert(flag !== -1, 'Pass --profile-from with the prior cold FT result');
const ft = await verifiedFtProfile(root, process.argv[flag + 1]);
const native = await createNativeRun('minimized-tasks');
const runId = path.basename(native.directory);
const output = path.join(root, 'artifacts/desktop/minimized-tasks', runId);
const mediaRoot = path.join(root, 'artifacts/visualizer-composition/output');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(mediaRoot, { recursive: true });
// Remove only this newly created empty directory, then copy the verified source without modifying it.
assert.equal(await fs.realpath(native.profile), path.join(native.directory, 'profile'));
await fs.rmdir(native.profile);
await copyNativeTree(ft.profile, native.profile);
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    profileFrom: ft.sourceResult,
    checks: {},
    workerEvents: [],
    samples: [],
    blockedRequests: [],
    limitations: ['OS chooser answers are substituted', 'Empty video scene verifies task lifecycle, not scene quality'],
};
const errors = [];
let app, page;
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
const windowState = () =>
    app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        return { minimized: window.isMinimized(), backgroundThrottling: window.webContents.getBackgroundThrottling() };
    });
async function minimize() {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    await expect.poll(async () => (await windowState()).minimized).toBe(true);
}
async function restore() {
    await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.restore();
        window.show();
    });
    await expect.poll(async () => (await windowState()).minimized).toBe(false);
}
async function finishMinimized(kind, selector, attribute, active, timeout) {
    const started = Date.now();
    await minimize();
    assert.equal(await page.locator(selector).getAttribute(attribute), active, `${kind} finished before minimizing`);
    await expect
        .poll(
            async () => {
                const window = await windowState();
                assert.equal(window.minimized, true, `${kind} window restored before completion`);
                const status = await page.locator(selector).getAttribute(attribute);
                result.samples.push({ kind, elapsedMs: Date.now() - started, status, ...window });
                assert.notEqual(status, 'error');
                return status;
            },
            { timeout, intervals: [500, 1000] },
        )
        .toBe('ready');
    result[`${kind}MinimizedMs`] = Date.now() - started;
    assert.equal((await windowState()).minimized, true);
    await restore();
}

console.log(`Desktop minimized tasks: ${output}`);
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    await app.context().route(/^https?:\/\//, route => {
        result.blockedRequests.push(route.request().url());
        return route.abort('internetdisconnected');
    });
    await app.context().setOffline(true);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('console', message => {
        if (message.text().startsWith('MINIMIZED_FT:')) result.workerEvents.push(JSON.parse(message.text().slice(13)));
    });
    await page.waitForSelector('#main-layout');
    await page.setViewportSize({ width: 1440, height: 900 });
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    result.versions = await app.evaluate(() => process.versions);
    await page.evaluate(() => {
        window.Worker = new Proxy(window.Worker, {
            construct(target, args) {
                const worker = Reflect.construct(target, args);
                if (String(args[0]).includes('separation.worker'))
                    worker.addEventListener('message', ({ data }) => {
                        if (data?.type === 'progress')
                            console.log(
                                'MINIMIZED_FT:' +
                                    JSON.stringify({
                                        phase: data.phase,
                                        directory: data.job.directory,
                                        at: Date.now(),
                                    }),
                            );
                    });
                return worker;
            },
        });
    });
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('editor-separation-tab').click();
    const entry = page.getByTestId('editor-separation-continue');
    if (await entry.isVisible()) await entry.click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    const old = await databaseRows(page, 'processing-p1', 2, 'editor-results');
    const previousDirectories = old.map(record => record.result.source.directory);
    await page.getByTestId('editor-separate-start').click();
    await expect
        .poll(() => result.workerEvents.some(event => event.phase === 'inference'), { timeout: 120000 })
        .toBe(true);
    await finishMinimized('ft', '[data-testid="editor-separation"]', 'data-state', 'running', 600000);
    const records = await databaseRows(page, 'processing-p1', 2, 'editor-results');
    const fresh = records.filter(record => !previousDirectories.includes(record.result.source.directory));
    assert.equal(fresh.length, 1, 'No unique completed inference record');
    assert.equal(fresh[0].result.provenance.backend, 'webgpu');
    result.ft = fresh[0];
    const files = await page.evaluate(async directory => {
        const root = await (await navigator.storage.getDirectory()).getDirectoryHandle('processing-p1');
        const job = await root.getDirectoryHandle(directory);
        const files = [];
        for (const role of ['drums', 'bass', 'other', 'vocals']) {
            const file = await (await job.getFileHandle(`${role}.wav`)).getFile();
            const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
            files.push({
                name: file.name,
                bytes: file.size,
                sha256: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''),
            });
        }
        return files;
    }, fresh[0].result.source.directory);
    for (const file of files) {
        const expected = fresh[0].files.find(entry => entry.name === file.name);
        assert(expected);
        assert.equal(file.bytes, expected.bytes);
        assert.equal(file.sha256, expected.sha256);
    }
    result.ftWavs = files;
    await expect.poll(() => page.workers().filter(worker => worker.url().includes('separation.worker')).length).toBe(0);
    result.checks.minimizedRealFourModelFtCompletes = 'passed';
    console.log(`FT completed while minimized for ${result.ftMinimizedMs}ms`);

    const audio = path.join(native.directory, 'minimized-export.wav');
    const generated = spawnSync(
        'ffmpeg',
        [
            '-v',
            'error',
            '-stream_loop',
            '-1',
            '-i',
            path.join(root, 'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav'),
            '-t',
            '30',
            '-c:a',
            'pcm_s16le',
            audio,
        ],
        { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(generated.status, 0, generated.stderr);
    await page.getByTestId('sidebar-home-link').click();
    const leave = page.getByRole('button', { name: '仍然离开', exact: true });
    if (await leave.isVisible()) await leave.click();
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    const imported = page.getByTestId('queue-item').filter({ hasText: 'minimized-export.wav' });
    await expect(page.getByTestId('queue-count')).toHaveText('2');
    await page.getByTestId('toggle-queue').click();
    await expect(imported).toBeVisible();
    await imported.click();
    await page.getByTestId('toggle-queue').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-duration', '30');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    const overwrite = page.getByRole('button', { name: '覆盖草稿', exact: true });
    if (await overwrite.isVisible()) await overwrite.click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByRole('tab', { name: '输出', exact: true }).click();
    const resolution = page.getByRole('combobox', { name: '输出分辨率', exact: true });
    const frameRate = page.getByRole('combobox', { name: '输出帧率', exact: true });
    await expect(resolution.locator('option[value="1080p"]')).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await resolution.selectOption('1080p');
    await expect(resolution).toHaveValue('1080p');
    await expect(frameRate.locator('option[value="60"]')).not.toHaveAttribute('disabled', '', { timeout: 30000 });
    await frameRate.selectOption('60');
    await expect(frameRate).toHaveValue('60');
    const configuration = path.join(native.directory, 'export-configuration.json');
    await queueSave(app, configuration);
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('export-project-file').click();
    await expect
        .poll(() =>
            fs
                .stat(configuration)
                .then(file => file.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    const configured = JSON.parse(await fs.readFile(configuration, 'utf8'));
    assert.deepEqual(configured.output, {
        aspectRatio: '16:9',
        resolution: '1080p',
        frameRate: 60,
        audioVideoOffsetMs: 0,
    });
    assert.equal(configured.track.durationSeconds, 30);
    result.configuration = { file: configuration, output: configured.output, track: configured.track };
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status]')).toHaveAttribute('data-export-status', 'exporting', {
        timeout: 30000,
    });
    await finishMinimized('webm', '[data-export-status]', 'data-export-status', 'exporting', 180000);
    console.log(`WebM completed while minimized for ${result.webmMinimizedMs}ms`);
    const file = path.join(mediaRoot, `${runId}-electron-1080p60-music.webm`);
    await queueSave(app, file);
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status]')).toHaveAttribute('data-export-status', 'idle', {
        timeout: 120000,
    });
    result.webm = { file, bytes: (await fs.stat(file)).size };
    await write(file + '.capture.json', {
        mode: 'offline',
        browser: 'electron',
        browserVersion: result.versions.electron,
        kind: 'music',
        scenario: 'minimized-empty-scene',
        sourceDurationSeconds: 30,
        audioVideoOffsetMs: 0,
        preset: { resolution: '1080p', width: 1920, height: 1080, frameRate: 60 },
    });
    const verified = spawnSync(
        process.execPath,
        ['tests/scripts/verify-visualizer-output.mjs', runId, '--files-only'],
        {
            cwd: root,
            encoding: 'utf8',
            maxBuffer: 1024 * 1024,
            timeout: 180000,
        },
    );
    await fs.writeFile(path.join(output, 'media-verification.log'), verified.stdout + verified.stderr, 'utf8');
    assert.equal(verified.status, 0, verified.stdout + verified.stderr);
    result.measurement = path.join(mediaRoot, `${runId}-strict-offline-sync-v4-measurement.json`);
    result.checks.minimizedWebmCompletesAndFullDecode = 'passed';
    assert.deepEqual(errors, []);
    assert.deepEqual(result.blockedRequests, []);
    await page.screenshot({ path: path.join(output, 'completed.png') });
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    console.error(result.error);
    process.exitCode = 1;
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => '');
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
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
    await write(path.join(output, 'result.json'), result);
    console.log(`Desktop minimized tasks result: ${result.status}`);
}
