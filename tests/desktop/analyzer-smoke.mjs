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

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('analyzer');
const output = path.join(root, 'artifacts/desktop/analyzer', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'analysis.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/format-master.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const features = ['rms', 'amplitudeSpectrum', 'chroma'];
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    checks: {},
    limitations: [
        'OS chooser/confirmation responses are substituted',
        'Short controlled input and three representative feature shapes; no new numeric or performance canonical claim',
    ],
};
const errors = [],
    consoleErrors = [],
    requests = [];
let app, page;
async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
    });
    await installDialogFixture(app);
    result.versions ??= await app.evaluate(() => process.versions);
    page = await app.firstWindow();
    await page.waitForSelector('#main-layout');
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.route(/^https?:/, route => {
        requests.push(route.request().url());
        return route.abort();
    });
    // Observe the real production Worker messages without changing their values or ownership.
    await page.addInitScript(() => {
        const state = { sent: [], results: [], cursors: [], errors: [], live: 0 };
        window.__desktopAnalysis = state;
        window.Worker = new Proxy(window.Worker, {
            construct(Target, args) {
                const worker = Reflect.construct(Target, args);
                state.live++;
                const post = worker.postMessage.bind(worker),
                    terminate = worker.terminate.bind(worker);
                let stopped = false;
                worker.postMessage = function (message, ...rest) {
                    if (['analyze', 'prepare-source'].includes(message?.kind))
                        state.sent.push({ kind: message.kind, featureIds: message.featureIds, config: message.config });
                    return post(message, ...rest);
                };
                worker.terminate = () => {
                    if (!stopped) {
                        stopped = true;
                        state.live--;
                    }
                    return terminate();
                };
                worker.addEventListener('message', ({ data }) => {
                    if (data?.kind === 'result')
                        state.results.push(
                            data.series.map(({ featureId, sampleCount, dimensions }) => ({
                                featureId,
                                sampleCount,
                                dimensions,
                            })),
                        );
                    if (data?.kind === 'cursor-value-result') {
                        state.cursors.push(data);
                        if (state.cursors.length > 150) state.cursors.shift();
                    }
                    if (data?.kind === 'error') state.errors.push(data);
                });
                return worker;
            },
        });
    });
    await page.reload();
    await page.waitForSelector('#main-layout');
    await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setContentSize(1440, 900);
        window.show();
    });
}
async function close() {
    await app?.close();
    app = undefined;
}
async function cache() {
    return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const open = indexedDB.open('audionotsurfyet-session', 1);
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
        });
        let value;
        try {
            value = await new Promise((resolve, reject) => {
                const tx = db.transaction('current-analysis-cache', 'readonly'),
                    request = tx.objectStore('current-analysis-cache').get('current');
                tx.oncomplete = () => resolve(request.result);
                tx.onerror = tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
        if (!value) return null;
        const payloads = await Promise.all(
            value.payloads.map(async ({ payload, ...metadata }) => ({
                ...metadata,
                bytes: payload.byteLength,
                sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', payload))]
                    .map(v => v.toString(16).padStart(2, '0'))
                    .join(''),
            })),
        );
        return { ...value, payloads };
    });
}
async function ready() {
    await expect(page.locator('[data-feature-id]')).toHaveCount(22);
    for (const feature of features)
        await expect(page.locator(`[data-feature-id="${feature}"] .plot-message`)).toHaveCount(0, { timeout: 30000 });
    await expect(page.locator('[data-feature-id] .plot canvas')).toHaveCount(6);
}
async function screenshot(name) {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    await page.screenshot({ path: path.join(output, name) });
}
console.log(`Desktop Analyzer: ${output}`);
try {
    await launch();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(page.locator('[data-feature-id]')).toHaveCount(22);
    await expect(page.locator('[data-feature-id] canvas')).toHaveCount(0);
    for (const feature of features)
        await page
            .locator(`[data-feature-id="${feature}"]`)
            .getByRole('button', { name: '展开分析', exact: true })
            .click();
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await ready();
    await expect.poll(async () => (await cache())?.manifest.featureIds.sort()).toEqual([...features].sort());
    const before = await cache();
    assert(before.payloads.every(payload => payload.bytes > 0 && /^[a-f0-9]{64}$/.test(payload.sha256)));
    const plotted = await page.locator('[data-feature-id] .plot canvas').evaluateAll(canvases =>
        canvases.map(canvas => {
            const box = canvas.getBoundingClientRect();
            return {
                width: canvas.width,
                height: canvas.height,
                cssWidth: box.width,
                cssHeight: box.height,
                dpr: devicePixelRatio,
            };
        }),
    );
    assert(
        plotted.every(
            p =>
                p.cssWidth > 0 &&
                p.cssHeight > 0 &&
                Math.abs(p.width - p.cssWidth * p.dpr) <= 1 &&
                Math.abs(p.height - p.cssHeight * p.dpr) <= 1,
        ),
    );
    result.canvasGeometry = plotted;
    result.checks.collapsedCatalogAndRealAnalysisCache = 'passed';
    const plot = page.locator('[data-feature-id="rms"] .plot');
    const box = await plot.boundingBox();
    const start = Number(await plot.getAttribute('data-start'));
    const end = Number(await plot.getAttribute('data-end'));
    await plot.click({ position: { x: ((1.5 - start) / (end - start)) * box.width, y: box.height / 2 } });
    await expect
        .poll(async () => Number(await page.locator('#music-bar-container').getAttribute('data-current-time')))
        .toBeCloseTo(1.5, 1);
    await expect
        .poll(() =>
            page.evaluate(
                ids =>
                    ids.every(
                        id =>
                            window.__desktopAnalysis.cursors.filter(c => c.featureId === id).at(-1)?.frameStartSeconds >
                            1.4,
                    ),
                features,
            ),
        )
        .toBe(true);
    const state = await page.evaluate(() => window.__desktopAnalysis);
    for (const id of features) {
        const value = state.cursors.filter(c => c.featureId === id).at(-1).value;
        if (id === 'rms') assert(Number.isFinite(value) && value >= 0 && value <= 1);
        else {
            assert.equal(value.length, id === 'chroma' ? 12 : 512);
            assert(value.every(Number.isFinite));
            assert(value.some(v => v > 0));
        }
    }
    assert(features.every(id => state.results.flat().some(s => s.featureId === id && s.sampleCount > 0)));
    assert.deepEqual(state.errors, []);
    result.worker = state;
    result.checks.realWorkerAndExactCursorShapes = 'passed';
    const zoom = Number(await plot.getAttribute('data-zoom'));
    await plot.hover({ position: { x: 100, y: 60 } });
    await page.mouse.wheel(0, -120);
    await expect.poll(() => plot.getAttribute('data-zoom').then(Number)).toBeGreaterThan(zoom);
    const zooms = await page
        .locator('[data-feature-id] .plot')
        .evaluateAll(plots => plots.map(p => Number(p.dataset.zoom)));
    assert.equal(new Set(zooms).size, 1);
    await screenshot('analyzer.png');
    await close();
    await launch();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await ready();
    assert.deepEqual(await cache(), before);
    const restored = await page.evaluate(() => window.__desktopAnalysis);
    result.restoredWorker = restored;
    console.log(
        JSON.stringify({
            restoredResults: restored.results,
            restoredRequests: restored.sent.map(r => ({ kind: r.kind, featureIds: r.featureIds })),
        }),
    );
    // A zero-feature batch initializes retained PCM for exact cursors; cached display features are not recomputed.
    assert(
        restored.results.every(batch => batch.length === 0),
        'Restored cached plots recomputed display features',
    );
    assert(
        restored.sent.filter(request => request.kind === 'analyze').every(request => request.featureIds.length === 0),
    );
    assert.deepEqual(restored.errors, []);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    result.checks.zoomAndRestartedCachePayloads = 'passed';
    await screenshot('analyzer-restarted.png');
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(requests, []);
    result.cache = before;
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    process.exitCode = 1;
    console.error(result.error);
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 3000 })
        .catch(() => '');
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
    try {
        await close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
        process.exitCode = 1;
    }
    Object.assign(result, { pageErrors: errors, consoleErrors, blockedRequests: requests });
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(process.exitCode ?? 0);
