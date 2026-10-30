import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('ft');
const output = path.join(root, 'artifacts/desktop/ft', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
let profile = native.profile;
let profileFrom;
const profileFlag = process.argv.indexOf('--profile-from');
if (profileFlag !== -1) {
    profileFrom = await fs.realpath(path.resolve(process.argv[profileFlag + 1]));
    const resultRoot = await fs.realpath(path.join(root, 'artifacts/desktop/ft'));
    const relative = path.relative(resultRoot, profileFrom);
    assert(/^ft-[a-f0-9-]{36}[\\/]result\.json$/.test(relative), 'Only prior FT test results may supply a profile');
    const previous = JSON.parse(await fs.readFile(profileFrom, 'utf8'));
    assert.equal(previous.checks.realDownloadFourModelsAndWavs, 'passed');
    const expected = path.join(
        await fs.realpath(process.env.LOCALAPPDATA),
        'AudioNotSurfYet-LocalRuntime',
        path.dirname(relative),
    );
    assert.equal(await fs.realpath(previous.nativeDirectory), expected);
    assert.equal(previous.exports.length, 4);
    assert.equal(previous.restoredExports.length, 4);
    for (const file of [...previous.exports, ...previous.restoredExports]) {
        assert.equal(path.dirname(await fs.realpath(file.file)), expected);
        assert.equal(await hashFile(file.file), file.sha256, 'Prior FT WAV changed');
    }
    profile = await fs.realpath(path.join(expected, 'profile'));
}
const fixture = path.join(output, 'fixture.mjs');
await build({
    entryPoints: [path.join(root, 'tests/desktop/processing-fixture.ts')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'esm',
});
const { FT_MODELS } = await import(pathToFileURL(fixture));
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'desktop-ft-source.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    profile,
    ...(profileFrom ? { profileFrom } : {}),
    checks: {},
    network: [],
    blockedRequests: [],
    logs: [],
    phases: [],
};
const errors = [];
let app, page;
let offline = false;
const record = (file, data) => fs.writeFile(file, JSON.stringify(data, null, 4) + '\n', 'utf8');

async function launch(blockNetwork = false) {
    offline = blockNetwork;
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    if (blockNetwork) {
        await app.context().route(/^https?:\/\//, route => {
            result.blockedRequests.push(route.request().url().split('?')[0]);
            return route.abort('internetdisconnected');
        });
        await app.context().setOffline(true);
    }
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (['warning', 'error'].includes(message.type()) && result.logs.length < 500) result.logs.push(message.text());
    });
    page.on('request', request => {
        if (/^https?:/.test(request.url())) result.network.push({ offline, url: request.url().split('?')[0] });
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForSelector('#main-layout');
}
async function close() {
    await app?.close();
    app = undefined;
}
async function separation() {
    await page.getByTestId('editor-separation-tab').click();
    const entry = page.getByTestId('editor-separation-continue');
    if (await entry.isVisible()) await entry.click();
}
async function records() {
    return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('processing-p1', 2);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            const get = store =>
                new Promise((resolve, reject) => {
                    const request = db.transaction(store).objectStore(store).getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            const keys = await new Promise((resolve, reject) => {
                const request = db.transaction('models').objectStore('models').getAllKeys();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            return { results: await get('editor-results'), modelKeys: keys };
        } finally {
            db.close();
        }
    });
}
async function waitReady() {
    let previous;
    await expect
        .poll(
            async () => {
                const status = await page.getByTestId('editor-separation').getAttribute('data-state');
                const phase = await page
                    .locator('.processing-heading strong')
                    .textContent({ timeout: 1000 })
                    .catch(() => '');
                const key = `${offline ? 'offline' : 'online'}:${status}:${phase}`;
                if (key !== previous) {
                    console.log(key);
                    result.phases.push(key);
                    previous = key;
                }
                return status;
            },
            { timeout: 600000, intervals: [1000, 2000, 3000] },
        )
        .toMatch(/^(ready|error|cancelled)$/);
    assert.equal(
        await page.getByTestId('editor-separation').getAttribute('data-state'),
        'ready',
        (await page.getByTestId('editor-separation-message').allTextContents()).join(' '),
    );
    await expect.poll(() => page.workers().filter(worker => worker.url().includes('separation.worker')).length).toBe(0);
    const state = await records();
    assert(state.results.length >= 1);
    const record = state.results.sort((a, b) => b.createdAt - a.createdAt)[0];
    assert.equal(record.result.provenance.backend, 'webgpu');
    assert.deepEqual(
        record.result.provenance.models,
        FT_MODELS.map(({ role, row, revision, sha256 }) => ({ role, row, revision, sha256 })),
    );
    for (const model of FT_MODELS) assert(state.modelKeys.includes(model.sha256), `Missing model ${model.role}`);
    return record;
}
async function saveWavs(current, prefix) {
    const frames = Math.round(current.result.source.descriptor.durationSeconds * 44100);
    const saved = [];
    for (const model of FT_MODELS) {
        const file = path.join(native.directory, `${prefix}-${model.role}.wav`);
        await queueSave(app, file);
        await page.getByTestId(`editor-export-${model.role}`).click();
        await expect
            .poll(() =>
                fs
                    .stat(file)
                    .then(stat => stat.size)
                    .catch(() => 0),
            )
            .toBe(44 + frames * 8);
        const bytes = await fs.readFile(file);
        assert.equal(bytes.subarray(0, 4).toString('ascii'), 'RIFF');
        assert.equal(bytes.readUInt16LE(20), 3);
        assert.equal(bytes.readUInt16LE(22), 2);
        assert.equal(bytes.readUInt32LE(24), 44100);
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        assert.equal(sha256, current.files.find(entry => entry.name === `${model.role}.wav`).sha256);
        let nonzero = 0;
        for (let at = 44; at < bytes.length; at += 4) {
            const sample = bytes.readFloatLE(at);
            assert(Number.isFinite(sample));
            if (sample !== 0) nonzero++;
        }
        assert(nonzero > 0);
        saved.push({ file, frames, sha256, nonzero });
    }
    return saved;
}

console.log(`Desktop FT: ${output}`);
try {
    await launch(Boolean(profileFrom));
    result.versions = await app.evaluate(() => process.versions);
    if (!profileFrom) {
        await queueOpen(app, [audio]);
        await page.getByTestId('import-audio').click();
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
        await page.getByTestId('toggle-playback').click();
    }
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await separation();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', profileFrom ? 'ready' : 'idle', {
        timeout: 60000,
    });
    await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    const first = await waitReady();
    await record(path.join(output, 'online-result.json'), first);
    result.exports = await saveWavs(first, 'online');
    result.checks[profileFrom ? 'cachedFourModelsAndWavs' : 'realDownloadFourModelsAndWavs'] = 'passed';
    await close();

    await launch(true);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await separation();
    await expect(page.getByTestId('editor-separation-saved')).toHaveText('已恢复本地结果', { timeout: 60000 });
    assert.equal(
        (await records()).results.sort((a, b) => b.createdAt - a.createdAt)[0].result.source.directory,
        first.result.source.directory,
    );
    result.restoredExports = await saveWavs(first, 'restored');
    result.checks.offlineRestartAndExactWavs = 'passed';
    await page.getByTestId('editor-stem-play').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', 'ft');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('editor-stem-play').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('editor-audition-original').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', 'original');
    result.checks.offlineStemAudition = 'passed';
    await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    await expect.poll(() => page.workers().filter(worker => worker.url().includes('separation.worker')).length).toBe(1);
    await page.getByTestId('editor-separate-cancel').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'cancelled', { timeout: 30000 });
    await expect.poll(() => page.workers().filter(worker => worker.url().includes('separation.worker')).length).toBe(0);
    assert.equal(
        (await records()).results.sort((a, b) => b.createdAt - a.createdAt)[0].result.source.directory,
        first.result.source.directory,
    );
    result.checks.cancelRetainsPreviousResultAndReleasesWorker = 'passed';
    await page.getByTestId('editor-separate-start').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    const second = await waitReady();
    assert.notEqual(second.result.source.directory, first.result.source.directory);
    await record(path.join(output, 'offline-result.json'), second);
    assert.equal(result.blockedRequests.length, 0, 'Offline cached inference attempted a remote request');
    result.checks.offlineFourModelInference = 'passed';
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.screenshot({ path: path.join(output, 'ft-result.png') });
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
        await close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
    }
    result.pageErrors = errors;
    result.limitations = [
        'OS chooser values substituted',
        'Controlled six-second input; not new perceptual quality acceptance or full P1 evidence',
    ];
    await record(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(result.status === 'passed' ? 0 : 1);
