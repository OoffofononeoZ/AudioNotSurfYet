import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { _electron, expect } from '@playwright/test';
import { assetsRoot, resourceRows } from '../support/visualizer-assets.mjs';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('scene');
const runId = path.basename(native.directory);
const output = path.join(root, 'artifacts/desktop/scene', runId);
const mediaRoot = path.join(root, 'artifacts/visualizer-composition/output');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(mediaRoot, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'scene-audio.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), audio);
const sourceFiles = [];
for (const row of resourceRows().filter(row =>
    ['shared-camera-demo', 'shared-camera-cube'].includes(row.info.resource.id),
)) {
    for (const relative of ['resource-info.json', row.info.packagePath, row.info.sourceEntry]) {
        const file = path.join(row.dir, relative);
        sourceFiles.push({ file, sha256: await hashFile(file) });
    }
}
assert.equal(sourceFiles.length, 6);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    runId,
    nativeDirectory: native.directory,
    checks: {},
    limitations: [
        'OS file and directory chooser values are substituted; no native picker UI claim',
        'One existing shared-camera example; no arbitrary scene, GPU performance or visual quality claim',
    ],
};
const pageErrors = [],
    consoleErrors = [],
    blockedRequests = [];
let app,
    page,
    sequence = 0;
const record = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
async function painted() {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}
async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    result.versions ??= await app.evaluate(() => process.versions);
    page = await app.firstWindow();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.route(/^https?:/, route => {
        blockedRequests.push(route.request().url());
        return route.abort();
    });
    await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setContentSize(1440, 900);
        window.show();
    });
    await page.waitForSelector('#main-layout');
    assert(page.url().startsWith('app://audiosurf/'));
    await painted();
}
async function close() {
    await app?.close();
    app = undefined;
}
async function exported() {
    const file = path.join(native.directory, `project-${sequence++}.json`);
    await queueSave(app, file);
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('export-project-file').click();
    await expect
        .poll(() =>
            fs
                .stat(file)
                .then(value => value.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    return JSON.parse(await fs.readFile(file, 'utf8'));
}
async function styles() {
    return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-realtime-styles');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('styles', 'readonly');
                const request = tx.objectStore('styles').getAll();
                tx.oncomplete = () => resolve(request.result);
                tx.onabort = tx.onerror = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    });
}
async function realtimeReady() {
    await expect(page.locator('[data-realtime-state]')).toHaveAttribute('data-realtime-state', 'ready');
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveAttribute('data-webgl-context-state', 'ready');
    await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveCount(1);
    await painted();
}
async function realtimeActions() {
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('realtime-style-actions').click();
}
async function elementsPanel() {
    if (!(await page.getByTestId('visualizer-elements-panel').isVisible()))
        await page.getByRole('button', { name: '元素列表', exact: true }).click();
    const collapsed = page.getByTestId('visualizer-elements-panel').locator('.viz-row-expand[aria-expanded="false"]');
    while (await collapsed.count()) await collapsed.first().click();
}
function command(executable, args, binary = false) {
    const value = spawnSync(executable, args, {
        cwd: root,
        encoding: binary ? null : 'utf8',
        maxBuffer: 128 * 1024 * 1024,
        timeout: 120000,
    });
    assert.equal(value.status, 0, String(value.stderr || value.error));
    return value.stdout;
}

console.log(`Desktop scene: ${output}`);
try {
    await launch();
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await elementsPanel();
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app, [assetsRoot]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="shared-camera-demo"]').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const original = await exported();
    assert.equal(original.schemaVersion, 6);
    assert.equal(original.elements.length, 2);
    const scene = original.items[0].scenes3d[0];
    assert.deepEqual(
        scene.children,
        original.elements.map(element => element.id),
    );
    assert.equal(scene.camera.animation.durationSeconds, 10);
    const row = page.locator(`[data-scene-instance-id="${scene.id}"]`);
    await elementsPanel();
    await row.locator('.viz-element-select').click();
    await page.getByRole('spinbutton', { name: '镜头轨迹时长', exact: true }).fill('12');
    await page.getByRole('spinbutton', { name: '镜头轨迹时长', exact: true }).press('Tab');
    await page.getByRole('spinbutton', { name: '关键帧 2 位置 X', exact: true }).fill('-2');
    await page.getByRole('spinbutton', { name: '关键帧 2 位置 X', exact: true }).press('Tab');
    await elementsPanel();
    await page.locator(`[data-element-id="${original.elements[0].id}"] .viz-element-select`).click();
    await page.getByRole('spinbutton', { name: '三维位置 X', exact: true }).fill('-0.9');
    await page.getByRole('spinbutton', { name: '三维位置 X', exact: true }).press('Tab');
    const edited = await exported();
    assert.equal(edited.items[0].scenes3d[0].camera.animation.durationSeconds, 12);
    assert.equal(edited.items[0].scenes3d[0].camera.animation.keyframes[1].position[0], -2);
    assert.equal(edited.elements[0].transform3d.position[0], -0.9);
    await record(path.join(output, 'edited-project.json'), edited);
    result.checks.sceneImportAndEditing = 'passed';
    await close();
    await launch();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    assert.deepEqual(await exported(), edited);
    result.checks.sceneDraftRestart = 'passed';
    await elementsPanel();
    await page.locator(`[data-scene-instance-id="${scene.id}"] .viz-element-select`).click();
    await painted();
    await page.screenshot({ path: path.join(output, 'scene-editor.png') });
    if (await page.getByRole('button', { name: '关闭元素属性', exact: true }).isVisible())
        await page.getByRole('button', { name: '关闭元素属性', exact: true }).click();
    console.log('3D camera/transforms and actual restart passed');

    await page.getByRole('tab', { name: '输出', exact: true }).click();
    await page.getByRole('combobox', { name: '输出分辨率', exact: true }).selectOption('720p');
    await page.getByRole('combobox', { name: '输出帧率', exact: true }).selectOption('30');
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 120000 });
    const video = path.join(mediaRoot, `${runId}-electron-720p30-scene.webm`);
    await queueSave(app, video);
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
    await record(video + '.capture.json', {
        mode: 'offline',
        browser: 'electron',
        browserVersion: result.versions.electron,
        kind: 'music',
        scenario: 'shared-camera',
        sourceDurationSeconds: edited.track.durationSeconds,
        audioVideoOffsetMs: 0,
        preset: { resolution: '720p', frameRate: 30, width: 1280, height: 720 },
    });
    const measurementLog = command(process.execPath, [
        'tests/scripts/verify-visualizer-output.mjs',
        runId,
        '--files-only',
    ]);
    await fs.writeFile(path.join(output, 'media-verification.log'), measurementLog, 'utf8');
    const pixels = command(
        'ffmpeg',
        [
            '-v',
            'error',
            '-i',
            video,
            '-map',
            '0:v:0',
            '-vf',
            'scale=96:54,format=rgb24',
            '-fps_mode',
            'passthrough',
            '-f',
            'rawvideo',
            '-pix_fmt',
            'rgb24',
            'pipe:1',
        ],
        true,
    );
    const frameBytes = 96 * 54 * 3;
    assert.equal(pixels.length % frameBytes, 0);
    const frames = [];
    for (let offset = 0; offset < pixels.length; offset += frameBytes) {
        const frame = pixels.subarray(offset, offset + frameBytes);
        let cyan = 0,
            orange = 0;
        for (let i = 0; i < frame.length; i += 3) {
            const [r, g, b] = frame.subarray(i, i + 3);
            if (g > 70 && b > 90 && b > r * 1.3) cyan++;
            if (r > 90 && g > 35 && r > b * 1.5) orange++;
        }
        frames.push({ cyan, orange, sha256: createHash('sha256').update(frame).digest('hex') });
    }
    assert(
        frames.every(frame => frame.cyan > 3 && frame.orange > 3),
        'Both cubes must appear in each decoded frame',
    );
    assert(
        new Set(frames.map(frame => frame.sha256)).size > frames.length / 2,
        'Moving-camera video is unexpectedly static',
    );
    result.video = {
        file: video,
        bytes: (await fs.stat(video)).size,
        sha256: await hashFile(video),
        frames: frames.length,
    };
    await record(path.join(output, 'decoded-scene-colors.json'), frames);
    command('ffmpeg', ['-v', 'error', '-ss', '1', '-i', video, '-frames:v', '1', path.join(output, 'scene-frame.png')]);
    result.checks.sceneVideoDecodeAndTimeline = 'passed';
    console.log('Real 3D WebM full decode, timeline and moving colored geometry passed');

    await realtimeActions();
    await page.getByTestId('apply-home-style').click();
    await expect(page).toHaveURL('app://audiosurf/');
    await realtimeReady();
    const homeStyles = await styles();
    assert.equal(homeStyles.length, 1);
    assert.deepEqual(homeStyles[0].scenes3d[0].camera, edited.items[0].scenes3d[0].camera);
    assert.deepEqual(
        homeStyles[0].elements.map(e => e.transform3d),
        edited.elements.map(e => e.transform3d),
    );
    await close();
    await launch();
    await realtimeReady();
    assert.deepEqual(await styles(), homeStyles);
    for (let i = 0; i < 3; i++) {
        await page.getByRole('button', { name: '详情', exact: true }).click();
        await expect(page.getByTestId('realtime-visualizer-canvas')).toHaveCount(0);
        await page.getByRole('button', { name: '可视化', exact: true }).click();
        await realtimeReady();
    }
    await page.screenshot({ path: path.join(output, 'scene-home.png') });
    result.checks.homeStyleRestartAndModes = 'passed';
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await realtimeActions();
    await page.getByTestId('create-display-page').click();
    const link = page.getByRole('link', { name: '打开展示页', exact: true });
    await expect(link).toHaveAttribute('href', /^\/display\/[0-9a-f-]+$/);
    await expect(page.getByRole('textbox', { name: '本地展示地址' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '复制展示地址' })).toHaveCount(0);
    const displayPath = await link.getAttribute('href');
    result.displayPath = displayPath;
    const savedStyles = await styles();
    assert.equal(savedStyles.length, 2);
    await record(path.join(output, 'realtime-styles.json'), savedStyles);
    await link.click();
    await expect(page).toHaveURL(`app://audiosurf${displayPath}`);
    await expect(page.getByTestId('visualizer-display')).toBeVisible();
    await realtimeReady();
    const geometry = await page.getByTestId('realtime-visualizer-canvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, viewport: [innerWidth, innerHeight] };
    });
    assert.deepEqual([geometry.x, geometry.y, geometry.width, geometry.height], [0, 0, ...geometry.viewport]);
    result.displayGeometry = geometry;
    await page.getByRole('button', { name: '全屏', exact: true }).click();
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
    await page.screenshot({ path: path.join(output, 'scene-display-fullscreen.png') });
    await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    result.checks.applicationDisplayAndFullscreen = 'passed';
    await close();
    await launch();
    await page.goto(`app://audiosurf${displayPath}`);
    await realtimeReady();
    assert.deepEqual(await styles(), savedStyles);
    await page.screenshot({ path: path.join(output, 'scene-display-restarted.png') });
    await page.goto('app://audiosurf/display/missing');
    await expect(page.getByRole('alert')).toContainText('不存在');
    await page.getByRole('link', { name: '返回首页', exact: true }).click();
    await realtimeReady();
    result.checks.displayRestartAndMissingRecovery = 'passed';
    for (const file of sourceFiles) assert.equal(await hashFile(file.file), file.sha256);
    assert.deepEqual(blockedRequests, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
    result.checks.offlineAndOriginalResources = 'passed';
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
    Object.assign(result, { pageErrors, consoleErrors, blockedRequests });
    await record(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(process.exitCode ?? 0);
