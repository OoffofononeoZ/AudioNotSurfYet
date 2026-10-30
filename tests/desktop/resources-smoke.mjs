import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, expect } from '@playwright/test';
import { resourceRows } from '../support/visualizer-assets.mjs';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave, queueConfirmation } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('resources');
const output = path.join(root, 'artifacts/desktop/resources', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const library = path.join(native.directory, 'assets');
const originalFiles = [];
const rows = resourceRows();
for (const row of rows) {
    const sourceRoot = await fs.realpath(row.dir);
    const destination = path.join(library, row.info.kind === 'preset' ? 'presets' : 'elements', row.info.resource.id);
    const images = (await fs.readdir(row.dir, { withFileTypes: true }))
        .filter(entry => entry.isFile() && /\.(png|jpe?g|webp|svg)$/i.test(entry.name))
        .map(entry => entry.name);
    const files = new Set(['resource-info.json', row.info.packagePath, row.info.sourceEntry, ...images]);
    if (row.info.previewPath && (await fs.stat(path.join(row.dir, row.info.previewPath)).catch(() => null)))
        files.add(row.info.previewPath);
    for (const relative of files) {
        const source = await fs.realpath(path.join(row.dir, relative));
        const inside = path.relative(sourceRoot, source);
        assert(inside && !inside.startsWith('..') && !path.isAbsolute(inside), 'Resource input escaped its package');
        const target = path.join(destination, relative);
        assert(!path.relative(destination, target).startsWith('..'), 'Resource destination escaped its package');
        await fs.mkdir(path.dirname(target), { recursive: true });
        const sha256 = await copyVerifiedBytes(source, target);
        originalFiles.push({ path: target, sha256 });
    }
}
const presetRoot = path.join(library, 'presets');
const originalPresets = new Set(await fs.readdir(presetRoot));
const wallpaperRoot = path.join(native.directory, 'wallpapers');
await fs.mkdir(wallpaperRoot);
const audio = path.join(native.directory, 'visualizer-v5-avsync-v1.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), audio);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    checks: {},
    limitations: ['OS chooser/confirmation results are substituted; no native directory UI claim'],
};
const errors = [];
const consoleErrors = [];
let app,
    page,
    sequence = 0;

async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installDialogFixture(app);
    page = await app.firstWindow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    await page.waitForSelector('#main-layout');
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
const newPresets = async () => (await fs.readdir(presetRoot)).filter(name => !originalPresets.has(name));

console.log(`Desktop resources: ${output}`);
try {
    await launch();
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await queueOpen(app);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(0);
    await queueOpen(app, [library]);
    await page.getByRole('button', { name: '加载资源库', exact: true }).click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(
        rows.filter(row => row.info.kind !== 'preset').length,
        { timeout: 30000 },
    );
    await expect
        .poll(() =>
            page
                .locator('[data-resource-id] img')
                .evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)),
        )
        .toBe(true);
    result.checks.nativeDirectoryCatalog = 'passed';
    await page.locator('[data-resource-id="radial-spectrum"]').click();
    await page.getByRole('combobox', { name: '频谱输入分析特征', exact: true }).selectOption('wallpaperEngineSpectrum');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const before = await exported();
    await page.getByTestId('export-visualizer-preset').click();
    const presetDialog = page.getByRole('dialog', { name: '导出预设', exact: true });
    await presetDialog.getByLabel('预设名称', { exact: true }).fill('Electron IO fixture');
    await queueConfirmation(app, '保存预设', 1);
    await page.getByTestId('save-visualizer-preset').click();
    await expect.poll(() => app.evaluate(() => globalThis.__desktopFileDialogs.confirm.length)).toBe(0);
    assert.equal((await newPresets()).length, 0);
    await queueConfirmation(app, '保存预设', 0);
    await page.getByTestId('save-visualizer-preset').click();
    await expect(presetDialog.getByRole('status')).toContainText('请刷新资源商城后添加');
    assert.equal((await newPresets()).length, 1);
    const preset = path.join(presetRoot, (await newPresets())[0]);
    assert((await fs.readdir(preset)).includes('resource-package.json'));
    await presetDialog.getByRole('button', { name: '关闭导出预设' }).click();
    assert.deepEqual(await exported(), before);
    result.checks.nativePresetSaveAndCancel = 'passed';
    console.log('Directory catalog and transactional preset export passed');

    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '重新加载', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await expect(page.locator('[data-preset-id]').filter({ hasText: 'Electron IO fixture' })).toHaveCount(1);
    await page.getByRole('dialog', { name: '资源商城', exact: true }).getByRole('button', { name: /关闭/ }).click();
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('realtime-style-actions').click();
    await page.getByTestId('prepare-wallpaper-export').click();
    await expect(page.getByTestId('save-wallpaper-directory')).toBeVisible();
    await queueOpen(app, [wallpaperRoot]);
    await page.getByTestId('save-wallpaper-directory').click();
    await expect(page.getByRole('status').filter({ hasText: '已导出' })).toBeVisible();
    const wallpapers = await fs.readdir(wallpaperRoot);
    assert.equal(wallpapers.length, 1);
    const wallpaper = path.join(wallpaperRoot, wallpapers[0]);
    assert.deepEqual(
        (await fs.readdir(wallpaper)).sort(),
        ['THIRD_PARTY_LICENSES.txt', 'index.html', 'project.json', 'runtime.js', 'style-data.js'].sort(),
    );
    result.wallpaper = wallpaper;
    result.checks.nativeWallpaperBundle = 'passed';
    await page.keyboard.press('Escape');
    await page.screenshot({ path: path.join(output, 'resource-exports.png') });
    await close();
    await launch();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.locator('[data-resource-id]')).toHaveCount(
        rows.filter(row => row.info.kind !== 'preset').length,
        { timeout: 30000 },
    );
    result.checks.directoryRestart = 'passed';
    for (const file of originalFiles)
        assert.equal(await hashFile(file.path), file.sha256, 'Existing library content changed');
    result.checks.originalLibraryUnchanged = 'passed';
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    process.exitCode = 1;
    result.alerts = await page
        ?.getByRole('alert')
        .allTextContents()
        .catch(() => []);
} finally {
    try {
        await close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.cleanupError = String(error);
        result.status = 'failed';
        process.exitCode = 1;
    }
    result.pageErrors = errors;
    result.consoleErrors = consoleErrors;
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify(result, null, 2));
}
process.exit(process.exitCode ?? 0);
