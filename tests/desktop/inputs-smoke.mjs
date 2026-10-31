import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import { _electron, expect } from '@playwright/test';
import { assetsRoot } from '../support/visualizer-assets.mjs';
import { osuFixture } from '../support/osu-fixture.ts';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('inputs');
const runId = path.basename(native.directory);
const output = path.join(root, 'artifacts/desktop/inputs', runId);
const mediaRoot = path.join(root, 'artifacts/visualizer-composition/output');
await fs.mkdir(output, { recursive: true });
await fs.mkdir(mediaRoot, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const inputs = path.join(native.directory, 'inputs');
await fs.mkdir(inputs);
const input = name => path.join(inputs, name);
const sourceAudio = input('original.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/format-master.wav'), sourceAudio);
const map = input('reference.osu'),
    archive = input('reference.osz'),
    brokenArchive = input('broken.osz');
await fs.writeFile(map, osuFixture(), 'utf8');
const archiveAudio = await fs.readFile(sourceAudio);
archiveAudio[archiveAudio.length - 2] ^= 1;
const maps = {
    'test.osu': strToU8(osuFixture()),
    'hard.osu': strToU8(osuFixture().replace('Version: Test', 'Version: Hard')),
};
await fs.writeFile(archive, zipSync({ ...maps, 'audio.wav': archiveAudio }));
await fs.writeFile(brokenArchive, zipSync({ ...maps, 'audio.wav': strToU8('invalid audio') }));
const mediaNames = ['red.png', 'green.jpg', 'blue.webp', 'moving.webm', 'moving.mp4'];
for (const name of mediaNames)
    await copyVerifiedBytes(path.join(root, 'tests/fixtures/visualizer-media', name), input(name));
const lyricText = '[00:00.500]Hello world\n[00:01.125]你好世界\n[00:01.800]Again';
await fs.writeFile(input('synthetic.lrc'), lyricText, 'utf8');
await fs.writeFile(input('bad.lrc'), 'untimed', 'utf8');
await fs.writeFile(input('bad.png'), 'invalid image', 'utf8');
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    runId,
    nativeDirectory: native.directory,
    checks: {},
    exports: [],
    limitations: [
        'OS chooser/confirmation results are substituted; no native picker UI claim',
        'Synthetic osu/media/LRC fixtures; no recognition, arbitrary codec or visual quality acceptance',
    ],
};
const pageErrors = [],
    consoleErrors = [],
    blockedRequests = [];
let app,
    page,
    sequence = 0;
const record = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
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
    await painted();
}
async function close() {
    await app?.close();
    app = undefined;
}
async function exported(kind) {
    const file = path.join(native.directory, `${kind}-${sequence++}.json`);
    await queueSave(app, file);
    await page.getByTestId(`export-${kind}-project`).click();
    if (kind === 'visualizer') await page.getByTestId('export-project-file').click();
    await expect
        .poll(() =>
            fs
                .stat(file)
                .then(value => value.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    return { file, project: JSON.parse(await fs.readFile(file, 'utf8')) };
}
async function editorDraft() {
    return page.evaluate(async () => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-editor');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            return await new Promise((resolve, reject) => {
                const tx = db.transaction('draft', 'readonly'),
                    request = tx.objectStore('draft').get('latest');
                tx.oncomplete = () => resolve(request.result?.envelope.project);
                tx.onerror = tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    });
}
const savedEditor = () => expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
async function openOsu(file) {
    await page.getByTestId('import-editor-project').click();
    await page.getByTestId('import-osu-beatmap').click();
    await queueOpen(app, file ? [file] : []);
    await page.getByTestId('osu-select-source').click();
    if (file) await expect(page.getByTestId('osu-difficulty')).toBeVisible();
}
async function previewOsu() {
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-preview')).toBeVisible();
    await expect(page.getByTestId('osu-apply')).toBeEnabled();
}
async function elementsPanel() {
    if (!(await page.getByTestId('visualizer-elements-panel').isVisible()))
        await page.getByRole('button', { name: '元素列表', exact: true }).click();
}
async function inspector() {
    if (!(await page.getByTestId('visualizer-settings-panel').isVisible()))
        await page.getByRole('button', { name: '元素属性', exact: true }).click();
}
async function addElement(id, loadLibrary = false) {
    await elementsPanel();
    await page.getByTestId('add-visualizer-element').click();
    if (loadLibrary) {
        await queueOpen(app, [assetsRoot]);
        await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    }
    await page.locator(`[data-element-type="${id}"]`).click();
    await inspector();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function chooseInput(section, names = []) {
    await queueOpen(app, names.map(input));
    await expect(section).toBeVisible();
    await section.getByText('选择文件', { exact: true }).click();
    await expect.poll(() => app.evaluate(() => globalThis.__desktopFileDialogs.open.length)).toBe(0);
}
async function mediaUpload(names) {
    const section = page.locator('[data-media-input="background"]');
    const before = await page.getByTestId('visualizer-preview-canvas').getAttribute('data-binding-revision');
    await chooseInput(section, names);
    for (const name of names) await expect(section).toContainText(name);
    await expect
        .poll(() => page.getByTestId('visualizer-preview-canvas').getAttribute('data-binding-revision'))
        .not.toBe(before);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const snapshot = (await exported('visualizer')).project;
    for (const asset of snapshot.mediaAssets) {
        const bytes = await fs.readFile(input(asset.name));
        assert.equal(asset.data, bytes.toString('base64'));
        assert.equal(asset.id, digest(bytes));
    }
    return snapshot;
}
async function seek(time) {
    if (!(await page.getByTestId('visualizer-seek').count())) {
        if (await page.getByRole('button', { name: '关闭元素属性', exact: true }).isVisible())
            await page.getByRole('button', { name: '关闭元素属性', exact: true }).click();
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('visualizer-fullscreen-toggle').click();
    }
    const slider = page.getByTestId('visualizer-seek');
    await slider.fill(String(time));
    await slider.dispatchEvent('input');
    await expect(page.getByTestId('visualizer-preview-canvas')).toHaveAttribute('data-frame-time', time.toFixed(6));
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
async function exitPreview() {
    if (await page.evaluate(() => !!document.fullscreenElement)) await page.keyboard.press('Escape');
    await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
    await inspector();
}
async function pixels() {
    const png = await page.getByTestId('visualizer-preview-canvas').screenshot({
        style: '.viz-video-controls{visibility:hidden!important}',
    });
    return page.evaluate(async base64 => {
        const image = await createImageBitmap(
            new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], { type: 'image/png' }),
        );
        const canvas = new OffscreenCanvas(16, 9),
            context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, 16, 9);
        image.close();
        const all = Array.from(context.getImageData(0, 0, 16, 9).data);
        return { pixel: all.slice((2 * 16 + 3) * 4, (2 * 16 + 3) * 4 + 4), all };
    }, png.toString('base64'));
}
async function videoExport(scenario) {
    await exitPreview();
    await page.getByRole('button', { name: '关闭元素属性', exact: true }).click();
    await page.getByRole('tab', { name: '输出', exact: true }).click();
    await page.getByRole('combobox', { name: '输出分辨率', exact: true }).selectOption('720p');
    await page.getByRole('combobox', { name: '输出帧率', exact: true }).selectOption('30');
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 120000 });
    const file = path.join(mediaRoot, `${runId}-electron-720p30-${scenario}.webm`);
    await queueSave(app, file);
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
    const project = (await exported('visualizer')).project;
    await record(file + '.capture.json', {
        mode: 'offline',
        browser: 'electron',
        browserVersion: result.versions.electron,
        kind: 'music',
        scenario,
        sourceDurationSeconds: project.track.durationSeconds,
        audioVideoOffsetMs: 0,
        preset: { resolution: '720p', frameRate: 30, width: 1280, height: 720 },
    });
    result.exports.push({ file, bytes: (await fs.stat(file)).size, sha256: await hashFile(file) });
}

console.log(`Desktop inputs: ${output}`);
try {
    await launch();
    await queueOpen(app, [sourceAudio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-editor-timing').click();
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).fill('137');
    await page.getByRole('spinbutton', { name: '辅助 BPM', exact: true }).press('Enter');
    await page.getByTestId('toggle-editor-timing').click();
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    const surface = page.locator('[data-testid^="marker-surface-"]').first();
    const bounds = await surface.boundingBox();
    const viewStart = Number(await surface.getAttribute('data-view-start'));
    const viewEnd = Number(await surface.getAttribute('data-view-end'));
    await surface.click({ position: { x: ((1 - viewStart) / (viewEnd - viewStart)) * bounds.width, y: 24 } });
    await expect.poll(async () => (await editorDraft()).lanes[0].events.length).toBe(1);
    await savedEditor();
    const before = await editorDraft();
    assert.equal(before.lanes[0].events.length, 1);
    await openOsu();
    await page.getByTestId('osu-cancel').click();
    assert.deepEqual(await editorDraft(), before);
    await openOsu(map);
    await expect(page.getByTestId('osu-tempo')).not.toBeChecked();
    await page.getByTestId('osu-confirm-current').check();
    for (const id of ['osu-bookmarks', 'osu-breaks', 'osu-kiai']) await page.getByTestId(id).check();
    await previewOsu();
    await expect(page.getByTestId('osu-preview')).toContainText('新增 6 条轨道');
    assert.deepEqual(await editorDraft(), before);
    await page.getByTestId('osu-apply').click();
    await savedEditor();
    const standalone = await editorDraft();
    assert.equal(standalone.lanes.length, 7);
    assert.deepEqual(standalone.lanes[0], before.lanes[0]);
    assert.deepEqual(standalone.tempoMap, before.tempoMap);
    assert.equal(standalone.lanes[2].events[0].startSeconds, 1.1);
    assert.equal(standalone.lanes[2].events[0].endSeconds, 1.6);
    result.checks.standaloneOsuAppendAndCancel = 'passed';
    await openOsu(brokenArchive);
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-import-error')).toBeVisible();
    assert.deepEqual(await editorDraft(), standalone);
    await page.getByTestId('osu-cancel').click();
    await openOsu(archive);
    await page.getByTestId('osu-difficulty').selectOption({ label: 'Hard · 标准' });
    await page.getByLabel('使用当前歌曲', { exact: true }).check();
    await page.getByTestId('osu-build-preview').click();
    await expect(page.getByTestId('osu-import-error')).toContainText('当前歌曲与包内原音频不同');
    await page.getByLabel('使用包内原音频', { exact: true }).check();
    await page.getByTestId('osu-tempo').check();
    await previewOsu();
    assert.deepEqual(await editorDraft(), standalone);
    await page.getByTestId('osu-apply').click();
    await expect(page.getByTestId('editor-track-change-dialog')).toBeVisible();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(page.getByTestId('osu-apply')).toBeEnabled();
    assert.deepEqual(await editorDraft(), standalone);
    await page.getByTestId('osu-apply').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('osu-import-dialog')).toHaveCount(0);
    await savedEditor();
    const imported = await editorDraft();
    assert.equal(imported.lanes.length, 3);
    assert.equal(imported.track.fileName, 'audio.wav');
    assert.equal(imported.track.contentHash, digest(archiveAudio));
    assert.equal(imported.tempoMap[0].beatOriginSeconds, -1);
    assert.equal(imported.tempoMap[0].bpmSource, 'imported');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    const editorExport = await exported('editor');
    assert.deepEqual(editorExport.project, imported);
    await queueOpen(app, [editorExport.file]);
    await page.getByTestId('import-editor-project').click();
    await page.getByTestId('import-project-file').click();
    await expect(page.getByText('工程已导入并写入本地草稿。', { exact: true })).toBeVisible();
    await savedEditor();
    assert.deepEqual((await editorDraft()).lanes, imported.lanes);
    result.checks.archiveAudioProtectionAndEditorJson = 'passed';
    await close();
    await launch();
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    assert.deepEqual((await exported('editor')).project, imported);
    await painted();
    await page.screenshot({ path: path.join(output, 'osu-editor-restarted.png') });
    result.checks.osuProjectAndArchiveAudioRestart = 'passed';
    console.log('osu/osz, audio mismatch/cancel/error, Editor JSON and restart passed');

    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await addElement('circular-background', true);
    for (const [name, channel, minimum] of [
        ['red.png', 0, 200],
        ['green.jpg', 1, 110],
        ['blue.webp', 2, 200],
    ]) {
        await mediaUpload([name]);
        await seek(0.2);
        await expect.poll(async () => (await pixels()).pixel[channel]).toBeGreaterThan(minimum);
        await exitPreview();
    }
    const blue = (await exported('visualizer')).project;
    await chooseInput(page.locator('[data-media-input="background"]'));
    assert.deepEqual((await exported('visualizer')).project.mediaAssets, blue.mediaAssets);
    await chooseInput(page.locator('[data-media-input="background"]'), ['bad.png']);
    await expect(page.locator('[data-media-input="background"] [role=alert]')).toBeVisible();
    assert.deepEqual((await exported('visualizer')).project.mediaAssets, blue.mediaAssets);
    await mediaUpload(['red.png', 'blue.webp']);
    for (const [label, value] of [
        ['轮播间隔', '1'],
        ['轮播淡化', '.2'],
    ]) {
        await page.getByRole('spinbutton', { name: label, exact: true }).fill(value);
        await page.getByRole('spinbutton', { name: label, exact: true }).press('Tab');
    }
    await seek(0.1);
    assert((await pixels()).pixel[0] > 200);
    await seek(0.9);
    const mixed = (await pixels()).pixel;
    assert(mixed[0] > 70 && mixed[2] > 70);
    await seek(1.1);
    assert((await pixels()).pixel[2] > 200);
    await exitPreview();
    result.checks.imageFormatsCancelFailureAndSlideshow = 'passed';
    for (const name of ['moving.webm', 'moving.mp4']) {
        await mediaUpload([name]);
        await seek(0.25);
        const first = (await pixels()).all;
        await seek(0.65);
        assert.notDeepEqual((await pixels()).all, first);
        await seek(0.25);
        assert.deepEqual((await pixels()).all, first);
        await seek(1.45);
        assert.deepEqual((await pixels()).all, first);
        await exitPreview();
    }
    result.checks.webmAndMp4SeekAndLoop = 'passed';
    console.log('Native image/video reads, embedded hashes, slideshow and repeatable seeks passed');
    await addElement('circular-depth-lyrics');
    const lyricSection = page.locator('[data-lyric-input="lyrics"]');
    await chooseInput(lyricSection, ['synthetic.lrc']);
    await expect(page.getByRole('button', { name: '清除歌词', exact: true })).toBeVisible();
    const bound = (await exported('visualizer')).project;
    assert.equal(bound.lyricAssets.length, 1);
    assert.equal(bound.lyricAssets[0].data, Buffer.from(lyricText, 'utf8').toString('base64'));
    assert.equal(bound.lyricAssets[0].id, digest(Buffer.from(lyricText, 'utf8')));
    await chooseInput(lyricSection);
    assert.deepEqual((await exported('visualizer')).project.lyricAssets, bound.lyricAssets);
    await chooseInput(lyricSection, ['bad.lrc']);
    await expect(lyricSection.getByRole('alert')).toContainText('时间戳');
    assert.deepEqual((await exported('visualizer')).project.lyricAssets, bound.lyricAssets);
    await seek(1.125);
    await painted();
    await page.screenshot({ path: path.join(output, 'embedded-media-and-lyrics.png') });
    await exitPreview();
    result.checks.utf8LyricsCancelAndInvalidRetention = 'passed';
    await videoExport('media-lyrics');
    const combined = await exported('visualizer');
    await fs.copyFile(combined.file, path.join(output, 'embedded-project.json'));
    const moved = path.join(native.directory, 'moved-inputs');
    await fs.mkdir(moved);
    for (const name of [...mediaNames, 'synthetic.lrc']) await fs.rename(input(name), path.join(moved, name));
    await close();
    await launch();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    assert.deepEqual((await exported('visualizer')).project, combined.project);
    await queueOpen(app, [combined.file]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false');
    const reimported = (await exported('visualizer')).project;
    assert(Date.parse(reimported.updatedAt) >= Date.parse(combined.project.updatedAt));
    assert.deepEqual({ ...reimported, updatedAt: combined.project.updatedAt }, combined.project);
    await seek(1.125);
    await painted();
    await page.screenshot({ path: path.join(output, 'embedded-restarted.png') });
    result.checks.embeddedJsonAndDraftAfterMovingSources = 'passed';
    await videoExport('restored-media-lyrics');
    const measured = spawnSync(
        process.execPath,
        ['tests/scripts/verify-visualizer-output.mjs', runId, '--files-only'],
        { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024 },
    );
    await fs.writeFile(
        path.join(output, 'media-verification.log'),
        (measured.stdout ?? '') + (measured.stderr ?? ''),
        'utf8',
    );
    assert.equal(measured.status, 0, String(measured.stdout || measured.stderr || measured.error));
    result.checks.embeddedMediaLyricsRealVideo = 'passed';
    assert.equal(
        await hashFile(sourceAudio),
        digest(await fs.readFile(path.join(root, 'tests/fixtures/audio/format-master.wav'))),
    );
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(blockedRequests, []);
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
    console.log(
        JSON.stringify({ status: result.status, output, checks: result.checks, exports: result.exports.length }),
    );
}
process.exit(process.exitCode ?? 0);
