import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { _electron, expect } from '@playwright/test';
import { assetsRoot } from '../support/visualizer-assets.mjs';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)),
    native = await createNativeRun('black-hole');
const output = path.join(root, 'artifacts/black-hole-visualizer-v2/desktop', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const audio = path.join(native.directory, 'audio.wav'),
    lrc = path.join(native.directory, 'lyrics.lrc');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), audio);
await fs.writeFile(
    lrc,
    '[00:00.500]Orbit through starlight\n[00:01.125]星河沿着夜色流动\n[00:01.800]Good night',
    'utf8',
);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    exports: [],
    limitations: [
        'OS chooser results substituted; no native picker UI claim',
        'Synthetic short lyrics; no arbitrary scene performance claim',
    ],
};
const errors = [];
let app,
    page,
    sequence = 0;
async function snapshot() {
    const file = path.join(native.directory, 'project-' + sequence++ + '.json');
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
async function load(project) {
    const file = path.join(native.directory, 'import-' + sequence++ + '.json');
    await fs.writeFile(file, JSON.stringify(project), 'utf8');
    await queueOpen(app, [file]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('import-visualizer-project')).toHaveAttribute('aria-busy', 'false', {
        timeout: 30000,
    });
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: ['--user-data-dir=' + native.profile],
        cwd: root,
        env,
        timeout: 30000,
    });
    await app.evaluate(({ BrowserWindow }) => {
        const owner = BrowserWindow.getAllWindows()[0];
        owner.setContentSize(1600, 1000);
        owner.show();
    });
    await installDialogFixture(app);
    page = await app.firstWindow();
    page.on('pageerror', e => errors.push(e.message));
    await page.route(/^https?:/, r => r.abort());
    await page.waitForSelector('#main-layout');
    assert(page.url().startsWith('app://audiosurf/'));
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();

    if (!(await page.getByTestId('visualizer-elements-panel').isVisible()))
        await page.getByRole('button', { name: '元素列表', exact: true }).click();
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app, [assetsRoot]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="black-hole-visualizer-2903479369"]').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    let project = await snapshot();
    assert.equal(project.elements.length, 8);
    let lyric = project.elements.find(e => e.resource.id === 'black-hole-lyrics');
    assert.equal(lyric.enabled, false);
    assert.equal(lyric.lyricBindings.lyrics.kind, 'unbound');
    for (const e of project.elements) {
        if (e.seed !== undefined) e.seed = 123456789;
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum') b.source = { kind: 'constant', value: Array(128).fill(0.25) };
    }
    project.output.resolution = '720p';
    for (const fps of [30, 60]) {
        project.output.frameRate = fps;
        if (fps === 60) {
            lyric.enabled = true;
            await load(project);
            await page.getByTestId('visualizer-preview-frame').hover();
            await page.getByTestId('start-visualizer-export').click();
            await expect(page.locator('[data-export-status=error]')).toBeVisible();
            await expect(page.getByText('黑洞歌词：歌词未配置', { exact: true }).first()).toBeVisible();
            await page.getByRole('button', { name: '清除错误', exact: true }).click();
            const expand = page.getByRole('button', { name: '展开Black Hole Visualizer', exact: true });
            if (await expand.isVisible()) await expand.click();
            await page.getByRole('button', { name: '黑洞歌词', exact: true }).click();
            if (!(await page.getByTestId('visualizer-settings-panel').isVisible()))
                await page.getByRole('button', { name: '元素属性', exact: true }).click();
            const section = page.locator('[data-lyric-input="lyrics"]');
            await queueOpen(app, [lrc]);
            await section.getByText('选择文件', { exact: true }).click();
            await expect(section.getByRole('button', { name: '清除歌词', exact: true })).toBeVisible();
            project = await snapshot();
            lyric = project.elements.find(e => e.resource.id === 'black-hole-lyrics');
            assert.equal(lyric.lyricBindings.lyrics.kind, 'lyrics');
            result.missingLyricsBlocked = true;
            result.nativeLrcBound = true;
        }
        if (fps === 60)
            for (const e of project.elements)
                for (const b of e.bindings)
                    if (b.parameterId === 'inclination') b.source = { kind: 'constant', value: 90 };
        await load(project);
        const restored = await snapshot();
        assert.deepEqual(restored.elements, project.elements);
        assert.deepEqual(restored.resources, project.resources);
        const closeInspector = page.getByRole('button', { name: '关闭元素属性', exact: true });
        if (await closeInspector.isVisible()) await closeInspector.click();
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('start-visualizer-export').click();
        await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 120000 });
        const video = path.join(output, 'black-hole-electron-' + fps + '.webm');
        await queueSave(app, video);
        await page.getByTestId('save-visualizer-export').click();
        await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
        const probe = spawnSync(
            'ffprobe',
            [
                '-v',
                'error',
                '-count_frames',
                '-show_entries',
                'stream=codec_type,r_frame_rate,nb_read_frames',
                '-of',
                'json',
                video,
            ],
            { encoding: 'utf8', windowsHide: true },
        );
        assert.equal(probe.status, 0, probe.stderr);
        const track = JSON.parse(probe.stdout).streams.find(s => s.codec_type === 'video');
        assert.equal(track.r_frame_rate, fps + '/1');
        assert.equal(Number(track.nb_read_frames), fps * 3);
        const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', video, '-f', 'null', '-'], {
            encoding: 'utf8',
            windowsHide: true,
        });
        assert.equal(decoded.status, 0, decoded.stderr);
        result.exports.push({
            fps,
            file: video,
            bytes: (await fs.stat(video)).size,
            sha256: await hashFile(video),
            frames: fps * 3,
            decoded: true,
        });
        await page.screenshot({ path: path.join(output, 'black-hole-' + fps + '.png') });
    }
    result.hiddenLyricsDefault = true;
    result.components = 8;
    result.resources = project.resources.elements.map(e => ({ id: e.id, version: e.version, hash: e.hash }));
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    process.exitCode = 1;
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 3000 })
        .catch(() => '');
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
    await app?.close();
    if (result.status === 'passed') await cleanupNativeTree(runtime);
    result.errors = errors;
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2), 'utf8');
    console.log(JSON.stringify({ status: result.status, output, error: result.error, exports: result.exports.length }));
}
process.exit(process.exitCode ?? 0);
