import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { verifiedFtProfile, databaseRows } from './processing-support.mjs';
import { installDialogFixture, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const flag = process.argv.indexOf('--profile-from');
assert(flag !== -1, 'Pass --profile-from with a prior cold FT result');
const ft = await verifiedFtProfile(root, process.argv[flag + 1]);
const native = await createNativeRun('transcription');
const output = path.join(root, 'artifacts/desktop/transcription', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
console.log(`Desktop transcription: ${output}`);
assert.equal(await fs.realpath(native.profile), path.join(native.directory, 'profile'));
await fs.rmdir(native.profile); // Only the empty directory just created by createNativeRun.
const profileCopy = await copyNativeTree(ft.profile, native.profile);
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const fixture = path.join(output, 'fixture.mjs');
await build({
    entryPoints: [path.join(root, 'tests/desktop/processing-fixture.ts')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'esm',
});
const { TRANSCRIPTION_MODELS } = await import(pathToFileURL(fixture));
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
await write(path.join(output, 'profile-copy.json'), profileCopy);
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    profileFrom: ft.sourceResult,
    checks: {},
    requests: [],
    blockedRequests: [],
    phases: [],
    logs: [],
};
const errors = [];
let app, page;
let profile = native.profile;
let offline = false;
let sequence = 0;

async function launch(disconnected = false) {
    offline = disconnected;
    const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: profile, TEMP: native.temp, TMP: native.temp };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    if (disconnected) {
        await app.context().route(/^https?:\/\//, route => {
            result.blockedRequests.push(route.request().url().split('?')[0]);
            return route.abort('internetdisconnected');
        });
        await app.context().setOffline(true);
    }
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (/^https?:/.test(request.url())) result.requests.push({ offline, url: request.url().split('?')[0] });
    });
    page.on('console', message => {
        if (['warning', 'error'].includes(message.type()) && result.logs.length < 500) result.logs.push(message.text());
    });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForSelector('#main-layout');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 30000 });
}
async function close() {
    await app?.close();
    app = undefined;
}
async function workspace(name) {
    await page.getByTestId(`editor-${name}-tab`).click();
    const entry = page.getByTestId(`editor-${name}-continue`);
    if (await entry.isVisible()) await entry.click();
}
const rows = () => databaseRows(page, 'editor-transcriptions', 1, 'results');
const latest = async () => (await rows()).sort((a, b) => b.createdAt - a.createdAt)[0];
async function exported() {
    const file = path.join(native.directory, `editor-${sequence++}.json`);
    await queueSave(app, file);
    await page.getByTestId('export-editor-project').click();
    await expect
        .poll(() =>
            fs
                .stat(file)
                .then(stat => stat.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    const project = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.equal(project.schemaVersion, 2);
    return project;
}
async function infer() {
    await page.getByTestId('transcription-start').click();
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'running');
    let previous;
    await expect
        .poll(
            async () => {
                const status = await page.getByTestId('editor-transcription').getAttribute('data-state');
                const phase = await page
                    .getByTestId('transcription-progress')
                    .locator('strong')
                    .textContent({ timeout: 500 })
                    .catch(() => '');
                const key = `${offline ? 'offline' : 'online'}:${status}:${phase}`;
                if (key !== previous) {
                    console.log(key);
                    result.phases.push(key);
                    previous = key;
                }
                return status;
            },
            { timeout: 900000, intervals: [1000, 2000, 3000] },
        )
        .toMatch(/^(ready|partial|error|cancelled)$/);
    assert.equal(
        await page.getByTestId('editor-transcription').getAttribute('data-state'),
        'ready',
        (await page.getByTestId('transcription-message').allTextContents()).join(' '),
    );
    await expect
        .poll(() => page.workers().filter(worker => worker.url().includes('transcription.worker')).length)
        .toBe(0);
    const record = await latest();
    assert.deepEqual([...record.bundle.result.completedRoles].sort(), ['bass', 'drums', 'guitar', 'piano', 'vocals']);
    assert.deepEqual(record.bundle.result.failures, []);
    assert(record.bundle.result.candidates.length > 0);
    assert.deepEqual(
        record.bundle.auxiliary.stems.map(stem => stem.role),
        ['guitar', 'piano'],
    );
    return record;
}
async function auxiliaryFiles(record) {
    const files = [];
    for (const stem of record.bundle.auxiliary.stems) {
        const actual = await page.evaluate(
            async ({ directory, name }) => {
                const root = await navigator.storage.getDirectory();
                const job = await (await root.getDirectoryHandle('processing-p1')).getDirectoryHandle(directory);
                const file = await (await job.getFileHandle(name)).getFile();
                const bytes = await file.arrayBuffer();
                const view = new DataView(bytes);
                let nonzero = 0;
                for (let at = 44; at < bytes.byteLength; at += 4) {
                    const sample = view.getFloat32(at, true);
                    if (!Number.isFinite(sample)) throw Error('Nonfinite auxiliary WAV');
                    if (sample !== 0) nonzero++;
                }
                const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
                return {
                    bytes: bytes.byteLength,
                    format: view.getUint16(20, true),
                    channels: view.getUint16(22, true),
                    rate: view.getUint32(24, true),
                    nonzero,
                    sha256: Array.from(hash, value => value.toString(16).padStart(2, '0')).join(''),
                };
            },
            { directory: record.bundle.auxiliary.directory, name: stem.wav },
        );
        assert.equal(actual.bytes, 44 + stem.frames * 8);
        assert.equal(actual.format, 3);
        assert.equal(actual.channels, 2);
        assert.equal(actual.rate, 44100);
        assert(actual.nonzero > 0);
        assert.equal(actual.sha256, record.files.find(file => file.name === stem.wav).sha256);
        files.push({ role: stem.role, ...actual });
    }
    return files;
}

try {
    await launch();
    await workspace('separation');
    await expect(page.getByTestId('editor-separation-saved')).toHaveText('已恢复本地结果', { timeout: 60000 });
    await workspace('marking');
    await page.getByTestId('tempo-bpm-0').fill('120');
    await page.getByTestId('tempo-bpm-0').press('Enter');
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    const bounds = await surface.boundingBox();
    await surface.click({ position: { x: bounds.width * 0.2, y: bounds.height / 2 } });
    await expect(page.locator('[data-testid^="point-marker-"]')).toHaveCount(1);
    const before = await exported();
    await workspace('transcription');
    await expect(page.getByTestId('transcription-start')).toBeEnabled();
    const initialKeys = await databaseRows(page, 'processing-p1', 2, 'models', true);
    assert(
        TRANSCRIPTION_MODELS.every(model => !initialKeys.includes(model.sha256)),
        'Transcription cold-download case was already cached',
    );
    const first = await infer();
    await write(path.join(output, 'online-candidates.json'), first);
    result.auxiliary = await auxiliaryFiles(first);
    const keys = await databaseRows(page, 'processing-p1', 2, 'models', true);
    assert(TRANSCRIPTION_MODELS.every(model => keys.includes(model.sha256)));
    result.checks.realModelsAndFiveRoles = 'passed';
    await page.getByTestId('transcription-listen-piano').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', 'auxiliary');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    const position = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.getByRole('button', { name: '返回原曲', exact: true }).filter({ visible: true }).click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', 'original');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', position);
    result.checks.auxiliaryAudition = 'passed';
    for (const instrument of ['低音', '人声', '钢琴', '吉他', '未知乐器']) {
        const input = page.getByRole('spinbutton', { name: `${instrument}长短分界毫秒` });
        await input.fill('10000');
        await input.blur();
    }
    const correction = page.getByRole('combobox', { name: '修正候选乐器' }).first();
    if (await correction.count()) await correction.selectOption('unknown');
    await page.getByRole('button', { name: '删除候选', exact: true }).first().click();
    await page.getByRole('checkbox', { name: '显示已删除' }).check();
    await page.getByRole('button', { name: '恢复候选', exact: true }).first().click();
    await page.getByTestId('transcription-apply').click();
    await expect(page.getByTestId('transcription-apply')).toHaveText('本结果已应用');
    await expect(page.getByTestId('transcription-apply')).toBeDisabled();
    const applied = await exported();
    assert(applied.lanes.length > before.lanes.length);
    assert.deepEqual(applied.tempoMap, before.tempoMap);
    assert.deepEqual(applied.lanes[0], before.lanes[0]);
    await write(path.join(output, 'applied-project-v2.json'), applied);
    result.checks.correctAndApplyPreservesManualWork = 'passed';
    await close();
    await launch(true);
    await workspace('transcription');
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    await expect(page.getByTestId('transcription-apply')).toBeDisabled();
    assert.equal((await latest()).bundle.result.id, first.bundle.result.id);
    assert.deepEqual((await exported()).lanes, applied.lanes);
    result.checks.offlineRestorationAndAppliedIdentity = 'passed';
    await page.getByTestId('transcription-start').click();
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'running');
    await page.getByTestId('transcription-cancel').click();
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'cancelled', {
        timeout: 30000,
    });
    await expect
        .poll(() => page.workers().filter(worker => worker.url().includes('transcription.worker')).length)
        .toBe(0);
    assert.equal((await latest()).bundle.result.id, first.bundle.result.id);
    result.checks.cancelReleasesWorkerAndRetainsResult = 'passed';
    const second = await infer();
    assert.notEqual(second.bundle.result.id, first.bundle.result.id);
    await write(path.join(output, 'offline-candidates.json'), second);
    assert.deepEqual((await exported()).lanes, applied.lanes);
    assert.equal(result.blockedRequests.length, 0);
    result.checks.offlineFiveRoleInference = 'passed';
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.screenshot({ path: path.join(output, 'transcription-result.png') });
    await close();
    profile = path.join(native.directory, 'corruption-profile');
    await copyNativeTree(native.profile, profile);
    await launch(true);
    await workspace('transcription');
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    for (const instrument of ['低音', '人声', '钢琴', '吉他'])
        await page.getByRole('checkbox', { name: new RegExp(`^${instrument} Basic Pitch`) }).uncheck();
    await page.evaluate(
        async hash => {
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open('processing-p1', 2);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            try {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction('models', 'readwrite');
                    tx.oncomplete = resolve;
                    tx.onerror = () => reject(tx.error);
                    tx.objectStore('models').put(new Blob(['damaged']), hash);
                });
            } finally {
                db.close();
            }
        },
        TRANSCRIPTION_MODELS.find(model => model.id === 'adt-encoder').sha256,
    );
    await page.getByTestId('transcription-start').click();
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'error', { timeout: 30000 });
    await expect(page.getByTestId('transcription-message')).toContainText('Model size mismatch');
    assert.equal((await latest()).bundle.result.id, second.bundle.result.id);
    await page.getByTestId('transcription-listen-guitar').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-audition-source', 'auxiliary');
    await page.getByRole('button', { name: '清理辅助音频与候选缓存', exact: true }).click();
    await page.getByTestId('transcription-confirm-clear').click();
    await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'idle', { timeout: 30000 });
    assert.deepEqual(await rows(), []);
    assert.deepEqual((await exported()).lanes, applied.lanes);
    result.checks.corruptionFailureAndExplicitClearPreserveProject = 'passed';
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
    result.profile = native.profile;
    result.limitations = [
        'OS save chooser values substituted',
        'Six-second fixture; no new recognition quality acceptance or long-input claim',
    ];
    await write(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(result.status === 'passed' ? 0 : 1);
