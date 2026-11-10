import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import {
    createNativeRun,
    copyNativeTree,
    cleanupNativeTree,
    copyVerifiedBytes,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { verifiedTranscriptionProfile, verifiedProductProfile, databaseRows } from './processing-support.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';
import { exerciseRealRangeExamples } from '../support/real-range-example-flow.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)),
    value = flag => process.argv[process.argv.indexOf(flag) + 1];
assert(
    process.argv.includes('--audio') &&
        process.argv.includes('--profile-from') !== process.argv.includes('--product-profile-from'),
    'Pass --audio and exactly one verified --profile-from or --product-profile-from',
);
const warm = process.argv.includes('--product-profile-from'),
    faultOnly = process.argv.includes('--gpu-failure-only'),
    previous = warm
        ? await verifiedProductProfile(root, value('--product-profile-from'))
        : await verifiedTranscriptionProfile(root, value('--profile-from')),
    native = await createNativeRun('transcription-product'),
    output = path.join(root, 'artifacts/desktop/transcription-product', path.basename(native.directory));
assert(
    !faultOnly || (warm && process.argv.includes('--gpu-failure-check')),
    'Failure-only requires a verified warm profile and --gpu-failure-check.',
);
await fs.mkdir(output, { recursive: true });
await fs.rmdir(native.profile); // Empty, newly created test-owned profile only.
await copyNativeTree(previous.profile, native.profile);
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, `input${path.extname(value('--audio'))}`),
    sourceHash = await copyVerifiedBytes(value('--audio'), audio),
    fixture = path.join(output, 'fixture.mjs');
if (warm) assert.equal(sourceHash, previous.sourceHash);
await build({
    entryPoints: [path.join(root, 'tests/desktop/processing-fixture.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: fixture,
});
const { startSystemSampler } = await import(pathToFileURL(fixture));
const write = (name, data) => fs.writeFile(path.join(output, name), JSON.stringify(data, null, 2), 'utf8');
const report = {
    status: 'running',
    sourceHash,
    profileFrom: previous.sourceResult,
    nativeDirectory: native.directory,
    runtimeSourceAsarHash: await hashFile(
        path.join(root, 'artifacts/desktop/packages/win-unpacked/resources/app.asar'),
    ),
    runtimeAsarHash: await hashFile(path.join(runtime.root, 'resources/app.asar')),
    errors: [],
    gpuRejections: [],
    blockedRequests: [],
    phases: [],
};
assert.equal(report.runtimeSourceAsarHash, report.runtimeAsarHash);
let app, page, stopSampler;
console.log(`Desktop product benchmark: ${output}`);
async function workspace(name) {
    await page.getByTestId(`editor-${name}-tab`).click();
    const entry = page.getByTestId(`editor-${name}-continue`);
    if (await entry.isVisible()) await entry.click();
}
async function terminal(kind, timeout) {
    let previous = '';
    const id = kind === 'ft' ? 'editor-separation' : 'editor-transcription',
        progressId = kind === 'ft' ? 'editor-separation-progress' : 'transcription-progress';
    await expect
        .poll(
            async () => {
                const state = await page.getByTestId(id).getAttribute('data-state'),
                    phase = (await page.getByTestId(progressId).locator('strong').allTextContents()).join(' '),
                    key = `${state}:${phase}`;
                if (key !== previous) {
                    previous = key;
                    console.log(`${kind} ${key}`);
                    report.phases.push({ kind, state, phase });
                }
                await write(`${kind}-checkpoint.json`, { at: Date.now(), state, phase });
                return state;
            },
            { timeout, intervals: [1000] },
        )
        .toMatch(/^(ready|partial|error|cancelled)$/);
    return page.getByTestId(id).getAttribute('data-state');
}
try {
    const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
    delete env.ELECTRON_RUN_AS_NODE;
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    report.runtimeVersions = await app.evaluate(({ app }) => ({
        app: app.getVersion(),
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
    }));
    await installDialogFixture(app);
    await app.context().route(/^https?:\/\//, route => {
        report.blockedRequests.push(route.request().url());
        return route.abort('internetdisconnected');
    });
    await app.context().setOffline(true);
    page = await app.firstWindow();
    page.on('pageerror', error => report.errors.push({ name: error.name, message: error.message, stack: error.stack }));
    page.on('console', message => {
        const prefix = 'GPU_FAILURE_PROBE:';
        if (message.text().startsWith(prefix))
            report.gpuRejections.push(JSON.parse(message.text().slice(prefix.length)));
    });
    await page.waitForSelector('#main-layout');
    const home = new URL(page.url());
    home.hash = '';
    await page.goto(home.href);
    await page.waitForSelector('#main-layout');
    // Reimporting creates a new trackId, which correctly cannot restore old FT.
    // Warm runs select the existing, hash-verified test song from the copied queue.
    if (!warm) {
        await queueOpen(app, [audio]);
        await page.getByTestId('import-audio').click();
    }
    const imported = page.getByTestId('queue-item').filter({ hasText: path.basename(audio) });
    await expect(imported).toBeVisible({ timeout: 30000 });
    await imported.press('Enter');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 60000,
    });
    if (warm)
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', previous.trackId);
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-editor-link').click();
    await page
        .locator('[data-testid="editor-ready"],[data-testid="editor-draft-conflict"]')
        .first()
        .waitFor({ state: 'visible', timeout: 60000 });
    if (await page.getByTestId('editor-draft-conflict').isVisible()) {
        await expect(page.getByTestId('editor-draft-conflict')).toContainText('desktop-ft-source.wav');
        await page.getByTestId('overwrite-conflicting-draft').click();
    }
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 60000 });
    await workspace('separation');
    await expect(page.getByTestId('editor-separate-start')).toBeEnabled({ timeout: 60000 });
    const ftStarted = Date.now();
    if (warm)
        await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'ready', { timeout: 120000 });
    else await page.getByTestId('editor-separate-start').click();
    assert.equal(
        warm ? await page.getByTestId('editor-separation').getAttribute('data-state') : await terminal('ft', 3000000),
        'ready',
        (await page.getByTestId('editor-separation-message').allTextContents()).join(' '),
    );
    report.ftPreparationMs = Date.now() - ftStarted;
    report.reusedVerifiedProductFt = warm;
    await workspace('transcription');
    await expect(page.getByTestId('transcription-start')).toBeEnabled({ timeout: 60000 });
    for (const instrument of ['低音', '人声', '钢琴', '吉他', '其他音色'])
        await page.getByRole('checkbox', { name: new RegExp(`^${instrument} Basic Pitch`) }).uncheck();
    const priorResultIds = (await databaseRows(page, 'editor-transcriptions', 1, 'results')).map(
        row => row.bundle.result.id,
    );
    let record;
    report.performanceMeasured = !faultOnly;
    if (!faultOnly) {
        stopSampler = await startSystemSampler({ processNames: ['AudioNotSurfYet'] });
        const started = await page.evaluate(() => performance.now());
        await page.getByTestId('transcription-start').click();
        const status = await terminal('drums', 1200000);
        report.elapsedMs = (await page.evaluate(() => performance.now())) - started;
        report.memory = await stopSampler();
        stopSampler = null;
        report.targetMs = 600000;
        report.targetMet = report.elapsedMs <= report.targetMs;
        assert.match(
            status,
            /^(ready|partial)$/,
            (await page.getByTestId('transcription-message').allTextContents()).join(' '),
        );
        record = (await databaseRows(page, 'editor-transcriptions', 1, 'results'))
            .filter(row => row.bundle.result.identity.contentHash === sourceHash)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
        assert(record);
        assert(!priorResultIds.includes(record.bundle.result.id), 'The timed interval must run a fresh inference job.');
        report.freshInferenceJob = true;
        assert.deepEqual(record.bundle.result.completedRoles, ['drums']);
        assert.equal(record.bundle.result.identity.drumBackend, 'webgpu');
        await write('cached-record.json', record);
        // Save the already verified FT WAV after the timed/memory interval.
        await workspace('separation');
        const wav = path.join(native.directory, 'ft-drums.wav');
        await queueSave(app, wav);
        await page.getByTestId('editor-export-drums').click();
        await expect
            .poll(
                () =>
                    fs
                        .stat(wav)
                        .then(s => s.size)
                        .catch(() => 0),
                { timeout: 60000 },
            )
            .toBeGreaterThan(44);
        report.stemHash = await hashFile(wav);
        await copyVerifiedBytes(wav, path.join(output, 'ft-drums.wav'));
    } else {
        record = (await databaseRows(page, 'editor-transcriptions', 1, 'results'))
            .filter(row => row.bundle.result.identity.contentHash === sourceHash)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
        assert(record, 'Retain an existing verified normal result for the failure regression.');
    }
    if (process.argv.includes('--reference')) {
        await workspace('transcription');
        report.rangeExamples = await exerciseRealRangeExamples(page, value('--reference'), output, sourceHash);
    }
    if (process.argv.includes('--gpu-failure-check')) {
        await workspace('transcription');
        const savedIds = (await databaseRows(page, 'editor-transcriptions', 1, 'results'))
            .map(row => row.bundle.result.id)
            .sort();
        await page.getByTestId('transcription-start').click();
        await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'running');
        await expect(page.getByTestId('transcription-progress').locator('strong')).toHaveText('解码鼓击打', {
            timeout: 120000,
        });
        const workers = page.workers().filter(worker => /transcription\.worker-/.test(worker.url()));
        assert.equal(workers.length, 1, 'Destroy only the owned transcription worker device.');
        report.deviceLoss = { targetWorker: workers[0].url(), attempted: true };
        try {
            report.deviceLoss.injection = await workers[0].evaluate(async () => {
                const runtimeUrl = new URL('/processing-runtime/ort.all.min.mjs', location.origin).href;
                const ort = await import(runtimeUrl),
                    device = await ort.env.webgpu.device;
                if (!device) throw Error('The owned drum device is not initialized.');
                let lossReason = 'pending';
                void device.lost.then(info => {
                    lossReason = info.reason;
                });
                globalThis.addEventListener('unhandledrejection', event =>
                    console.info(
                        'GPU_FAILURE_PROBE:' +
                            JSON.stringify({
                                kind: 'unhandledrejection',
                                name: event.reason?.name,
                                message: event.reason?.message,
                                prevented: event.defaultPrevented,
                                lossReason,
                            }),
                    ),
                );
                globalThis.addEventListener('error', event =>
                    console.info(
                        'GPU_FAILURE_PROBE:' +
                            JSON.stringify({
                                kind: 'error',
                                name: event.error?.name,
                                message: event.message,
                                prevented: event.defaultPrevented,
                                lossReason,
                            }),
                    ),
                );
                device.destroy();
                return { destroyed: true };
            });
        } catch (error) {
            // The controller can terminate the worker before CDP returns; the
            // exact product error and unchanged saved results below remain required.
            report.deviceLoss.injectionObservation = String(error);
        }
        assert.equal(await terminal('device-loss', 120000), 'error');
        await expect(page.getByTestId('transcription-message')).toContainText('GPU 设备已丢失');
        assert.deepEqual(
            (await databaseRows(page, 'editor-transcriptions', 1, 'results')).map(row => row.bundle.result.id).sort(),
            savedIds,
        );
        await expect
            .poll(() => page.workers().filter(worker => /transcription\.worker-/.test(worker.url())).length, {
                timeout: 10000,
            })
            .toBe(0);
        report.deviceLoss = {
            ...report.deviceLoss,
            status: 'passed',
            retainedResultId: record.bundle.result.id,
            noNewSavedResult: true,
            workerTerminated: true,
        };
    }
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.blockedRequests, []);
    report.status = 'passed';
} catch (error) {
    report.status = 'failed';
    report.error = String(error);
    console.error(report.error);
    report.body = await page
        ?.locator('body')
        .innerText({ timeout: 3000 })
        .catch(() => '');
} finally {
    if (stopSampler) report.memory = await stopSampler();
    await app?.close();
    if (report.status === 'passed') await cleanupNativeTree(runtime);
    report.timedScope = faultOnly
        ? 'No performance interval; only a fresh inference/device-loss regression against an existing verified result.'
        : 'Cached models and current FT verification, setup, PCM, inference/retry, DSP/review and committed result; FT preparation/download/export excluded.';
    report.limitations = [
        'Test-owned native profile and verified ASAR copy',
        'OS chooser values supplied by fixture',
        'Aggregate observed memory includes other instances; not allocation guarantees',
    ];
    await write('report.json', report);
    console.log(
        JSON.stringify({ status: report.status, output, elapsedMs: report.elapsedMs, targetMet: report.targetMet }),
    );
}
process.exit(report.status === 'passed' ? 0 : 1);
