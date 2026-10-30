import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { assetsRoot } from '../support/visualizer-assets.mjs';
import { installDialogFixture, queueOpen } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('model-network');
const output = path.join(root, 'artifacts/desktop/model-network', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const fixture = path.join(output, 'fixture.mjs');
await build({
    entryPoints: [path.join(root, 'tests/desktop/processing-fixture.ts')],
    outfile: fixture,
    bundle: true,
    platform: 'node',
    format: 'esm',
});
const { FT_MODELS, TRANSCRIPTION_MODELS } = await import(pathToFileURL(fixture));
const models = [...FT_MODELS, ...TRANSCRIPTION_MODELS].map(model => ({ id: model.id ?? model.role, url: model.url }));
const basicPitch = models.find(model => model.id === 'basic-pitch');
const denied = [
    { id: 'other-revision', url: basicPitch.url.replace('9991303bba609a3b93089d13ec80d1d495083596', '0'.repeat(40)) },
    { id: 'other-file', url: basicPitch.url.replace('/nmp.onnx', '/other.onnx') },
];
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
let app;
const result = { status: 'running', nativeDirectory: native.directory, models: [], console: [] };
console.log(`Desktop model network: ${output}`);
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    const page = await app.firstWindow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    page.on('console', message => {
        if (message.type() === 'error') result.console.push(message.text());
    });
    await page.waitForSelector('#main-layout');
    const probeWorker = model =>
        new Promise((resolve, reject) => {
            const source = `onmessage = async ({data}) => {
                        const controller = new AbortController();
                        const timeout = setTimeout(() => controller.abort(), 15000);
                        const violations = [];
                        addEventListener('securitypolicyviolation', event => violations.push({
                            directive: event.effectiveDirective, blockedURI: event.blockedURI
                        }));
                        try {
                            const response = await fetch(data.url, {
                                headers: {Range: 'bytes=0-1023'}, signal: controller.signal
                            });
                            const reader = response.body?.getReader();
                            const first = await reader?.read();
                            await reader?.cancel();
                            const target = new URL(response.url);
                            postMessage({
                                accepted: response.ok, status: response.status,
                                finalUrl: target.origin + target.pathname,
                                sampledBytes: first?.value?.length ?? 0, node: typeof require
                            });
                        } catch (error) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                            postMessage({accepted: false, error: String(error), violations, node: typeof require});
                        } finally {
                            clearTimeout(timeout);
                            controller.abort();
                        }
                    }`;
            const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
            const worker = new Worker(url);
            const timeout = setTimeout(() => {
                worker.terminate();
                URL.revokeObjectURL(url);
                reject(Error('Network probe worker did not respond'));
            }, 20000);
            worker.onmessage = ({ data }) => {
                clearTimeout(timeout);
                worker.terminate();
                URL.revokeObjectURL(url);
                resolve(data);
            };
            worker.onerror = event => {
                clearTimeout(timeout);
                worker.terminate();
                URL.revokeObjectURL(url);
                reject(Error(event.message));
            };
            worker.postMessage(model);
        });
    for (const model of models) {
        const measured = await page.evaluate(probeWorker, model);
        result.models.push({ ...model, ...measured });
        console.log(`${model.id}: ${JSON.stringify(measured)}`);
    }
    assert(result.models.every(model => model.accepted && model.sampledBytes > 0 && model.node === 'undefined'));
    result.deniedPaths = [];
    for (const model of denied) {
        const measured = await page.evaluate(probeWorker, model);
        assert.equal(measured.accepted, false);
        assert(measured.violations.some(event => event.directive === 'connect-src'));
        result.deniedPaths.push({ ...model, ...measured });
    }
    await queueOpen(app, [path.join(root, 'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav')]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app, [assetsRoot]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await expect(page.locator('[data-resource-id="solid"]')).toBeVisible({ timeout: 30000 });
    await page.locator('[data-resource-id="solid"]').click();
    await expect(page.locator('[data-element-id]').first()).toBeVisible();
    const iframe = page.locator('iframe[sandbox="allow-scripts"]');
    await expect(iframe).toHaveCount(1);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const frame = await (await iframe.elementHandle()).contentFrame();
    assert(frame, 'Production algorithm iframe missing');
    result.algorithmScope = await frame.evaluate(() => {
        let parentReadable = false;
        try {
            parentReadable = Boolean(parent.document);
        } catch {
            /* Opaque origin must deny access. */
        }
        return { parentReadable, node: typeof require, bridge: typeof window.audiosurfDesktop };
    });
    assert.deepEqual(result.algorithmScope, { parentReadable: false, node: 'undefined', bridge: 'undefined' });
    result.algorithmNetwork = await frame.evaluate(probeWorker, basicPitch);
    assert.equal(result.algorithmNetwork.accepted, false);
    assert(result.algorithmNetwork.violations.some(event => event.directive === 'connect-src'));
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
} finally {
    try {
        await app?.close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
    }
    result.limitations = ['Range samples from real pinned URLs; not complete model hash or inference evidence'];
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify({ status: result.status, output }));
}
process.exit(result.status === 'passed' ? 0 : 1);
