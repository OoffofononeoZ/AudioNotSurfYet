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
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { copyResourceLibrary } from './resource-library-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const skipCatalogDialog = process.argv.includes('--skip-catalog-dialog');
const declineOnly = process.argv.includes('--decline-only');
const closeOnly = process.argv.includes('--close-only') || declineOnly;
const native = await createNativeRun('manual-directories');
const output = path.join(root, 'artifacts/desktop/manual-directories', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const library = path.join(native.directory, 'assets'),
    wallpapers = path.join(native.directory, 'wallpapers');
const { rows, presetRoot, originalPresets, originalFiles } = await copyResourceLibrary(library);
await fs.mkdir(wallpapers);
const audio = path.join(native.directory, 'audio.wav');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav'), audio);
const journal = path.join(output, 'native-dialogs.json');
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'waiting-for-user',
    nativeDirectory: native.directory,
    checks: {},
    limitations: [
        'Audio chooser alone is substituted; directory and message-box responses stay native',
        'Controlled copied library/profile only; no actual Wallpaper Engine host claim',
    ],
};
if (skipCatalogDialog)
    result.limitations[0] =
        'Audio and resource catalog chooser are substituted; wallpaper directory and all message-box responses stay native';
if (closeOnly)
    result.limitations[0] =
        'Only exit confirmations are exercised natively; audio chooser is substituted and directory checks are skipped';
if (declineOnly)
    result.limitations[0] =
        'Only the real continue-working response is exercised; after verifying the window remains editable, the test app is forcibly stopped for cleanup, not claimed as a normal accepted exit';
const record = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
const readJournal = () => fs.readFile(journal, 'utf8').then(JSON.parse);
const errors = [];
let app,
    page,
    processHandle,
    aborting = false;
const control = setInterval(() => {
    if (aborting || !app) return;
    void fs
        .access(path.join(output, 'defer'))
        .then(async () => {
            aborting = true;
            await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
        })
        .catch(() => {});
}, 500);
async function nativeAnswer(kind, count, expected) {
    const deadline = Date.now() + 1800000;
    for (;;) {
        if (aborting) throw Error('Manual test was deferred');
        const state = await readJournal();
        if (state.closed && state[kind].length < count) throw Error('Window closed before the expected native answer');
        if (state[kind].length === count) break;
        if (state[kind].length > count) throw Error('Unexpected extra native answer');
        if (Date.now() >= deadline) throw Error('Manual native dialog timed out');
        await new Promise(resolve => setTimeout(resolve, 250));
    }
    const answer = (await readJournal())[kind].at(-1);
    if (answer.canceled || (expected !== undefined && answer.response !== expected)) {
        aborting = true;
        throw Error('Manual operation was cancelled or differed from the requested test step');
    }
    return answer;
}
async function elements() {
    if (!(await page.getByTestId('visualizer-elements-panel').isVisible()))
        await page.getByRole('button', { name: '元素列表', exact: true }).click();
}
async function painted() {
    await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
}
console.log(`Manual native directories: ${output}`);
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    processHandle = app.process();
    await app.evaluate(
        ({ BrowserWindow, dialog }, { library, wallpapers, audio, journal, skipCatalogDialog }) => {
            const fs = process.getBuiltinModule('node:fs');
            const owner = BrowserWindow.getAllWindows()[0];
            const state = { pending: null, opens: [], messages: [], phases: [], closed: false, substitutedAudio: 0 };
            const save = () => {
                fs.writeFileSync(journal + '.next', JSON.stringify(state, null, 4) + '\n', 'utf8');
                fs.renameSync(journal + '.next', journal);
            };
            const normalize = value => value.replaceAll('/', '\\').toLowerCase();
            const open = dialog.showOpenDialog.bind(dialog),
                message = dialog.showMessageBox.bind(dialog);
            dialog.showOpenDialog = async (window, options) => {
                if (!options.properties?.includes('openDirectory')) {
                    if (state.substitutedAudio++) throw Error('Unexpected non-directory dialog');
                    save();
                    return { canceled: false, filePaths: [audio] };
                }
                const target = [library, wallpapers][state.opens.length];
                if (!target) throw Error('Unexpected native directory request');
                if (skipCatalogDialog && state.opens.length === 0) {
                    const answer = { canceled: false, filePaths: [target] };
                    state.opens.push({ title: options.title, ...answer, substituted: true });
                    save();
                    return answer;
                }
                state.pending = { kind: 'directory', title: options.title, target };
                save();
                // The original Windows dialog and its result are retained. Only its initial directory changes.
                const answer = await open(window, { ...options, defaultPath: target });
                state.opens.push({ title: options.title, ...answer });
                state.pending = null;
                save();
                if (
                    !answer.canceled &&
                    (answer.filePaths.length !== 1 || normalize(answer.filePaths[0]) !== normalize(target))
                )
                    throw Error('Manual test accepts only its prefilled controlled directory');
                return answer;
            };
            dialog.showMessageBox = async (window, options) => {
                if (!['保存预设', '退出 AudioNotSurfYet'].includes(options.title))
                    throw Error(`Unexpected message: ${options.title}`);
                state.pending = { kind: 'message', title: options.title, buttons: options.buttons };
                save();
                const answer = await message(window, options);
                state.messages.push({ title: options.title, message: options.message, ...answer });
                state.pending = null;
                save();
                return answer;
            };
            const send = owner.webContents.send;
            owner.webContents.send = function (channel, ...args) {
                if (channel === 'audiosurf:lifecycle:request') {
                    state.phases.push(args[0].phase);
                    save();
                }
                return send.call(this, channel, ...args);
            };
            owner.once('closed', () => {
                state.closed = true;
                save();
            });
            owner.setContentSize(1440, 900);
            owner.show();
            owner.focus();
            save();
        },
        { library, wallpapers, audio, journal, skipCatalogDialog },
    );
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    result.versions = await app.evaluate(() => process.versions);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    if (!closeOnly) {
        await page.getByTestId('header-visualizer-link').click();
        await expect(page.getByTestId('visualizer-ready')).toBeVisible();
        await elements();
        await page.getByTestId('add-visualizer-element').click();
        await page.getByRole('button', { name: '加载资源库', exact: true }).click();
        await record(path.join(output, 'ready.json'), { ...result, library, wallpapers, journal });
        if (!skipCatalogDialog)
            console.log('WAITING: select the prefilled assets directory in the real Windows chooser.');
        await nativeAnswer('opens', 1);
        await expect(page.locator('[data-resource-id]')).toHaveCount(
            rows.filter(row => row.info.kind !== 'preset').length,
            { timeout: 30000 },
        );
        await page.locator('[data-resource-id="radial-spectrum"]').click();
        if (!(await page.getByTestId('visualizer-settings-panel').isVisible()))
            await page.getByRole('button', { name: '元素属性', exact: true }).click();
        const previewCanvas = page.getByTestId('visualizer-preview-canvas');
        const bindingRevision = await previewCanvas.getAttribute('data-binding-revision');
        await page
            .getByRole('combobox', { name: '频谱输入分析特征', exact: true })
            .selectOption('wallpaperEngineSpectrum');
        await expect.poll(() => previewCanvas.getAttribute('data-binding-revision')).not.toBe(bindingRevision);
        await expect(page.locator('[data-analysis-status]')).toHaveAttribute('data-analysis-status', 'ready', {
            timeout: 60000,
        });
        await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
        result.checks[skipCatalogDialog ? 'catalogWithSubstitutedChooser' : 'realDirectoryCatalog'] = 'passed';
        await app.evaluate(({ BrowserWindow }) => {
            const window = BrowserWindow.getAllWindows()[0];
            window.show();
            window.focus();
        });
        await elements();
        await page.getByTestId('export-visualizer-preset').click();
        const presetDialog = page.getByRole('dialog', { name: '导出预设', exact: true });
        await presetDialog.getByLabel('预设名称', { exact: true }).fill('原生目录验收');
        const preparation = setInterval(() => {
            void presetDialog
                .innerText()
                .then(body => record(path.join(output, 'preset-preparation.json'), { body }))
                .catch(() => {});
        }, 1000);
        try {
            await expect(page.getByTestId('save-visualizer-preset')).toBeEnabled({ timeout: 180000 });
        } finally {
            clearInterval(preparation);
        }
        await page.getByTestId('save-visualizer-preset').click();
        console.log('WAITING: click 保存 in the real native preset confirmation.');
        await nativeAnswer('messages', 1, 0);
        await expect(presetDialog.getByRole('status')).toContainText('请刷新资源商城后添加');
        const newPresets = (await fs.readdir(presetRoot)).filter(name => !originalPresets.has(name));
        assert.equal(newPresets.length, 1);
        const pack = JSON.parse(
            await fs.readFile(path.join(presetRoot, newPresets[0], 'resource-package.json'), 'utf8'),
        );
        assert.equal(pack.presets.length, 1);
        result.checks.realNativePresetConfirmation = 'passed';
        await presetDialog.getByRole('button', { name: '关闭导出预设' }).click();
        if (await page.getByRole('button', { name: '关闭元素列表', exact: true }).isVisible())
            await page.getByRole('button', { name: '关闭元素列表', exact: true }).click();
        await page.getByTestId('export-visualizer-project').click();
        await page.getByTestId('realtime-style-actions').click();
        await page.getByTestId('prepare-wallpaper-export').click();
        await expect(page.getByTestId('save-wallpaper-directory')).toBeVisible();
        await page.getByTestId('save-wallpaper-directory').click();
        console.log('WAITING: select the prefilled wallpapers directory in the real Windows chooser.');
        await nativeAnswer('opens', 2);
        await expect(page.getByRole('status').filter({ hasText: '已导出' })).toBeVisible({ timeout: 30000 });
        const folders = await fs.readdir(wallpapers);
        assert.equal(folders.length, 1);
        const wallpaper = path.join(wallpapers, folders[0]);
        assert.deepEqual(
            (await fs.readdir(wallpaper)).sort(),
            ['THIRD_PARTY_LICENSES.txt', 'index.html', 'project.json', 'runtime.js', 'style-data.js'].sort(),
        );
        result.wallpaper = wallpaper;
        result.checks.realWallpaperDirectory = 'passed';
        await page.getByRole('button', { name: '关闭实时样式', exact: true }).click();
        await painted();
        await page.screenshot({ path: path.join(output, 'native-directory-exports.png') });
    }
    // Visualizer's saved draft alone is safe to close; an unexported Editor mutation is the intended warning trigger.
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await painted();
    await page.screenshot({ path: path.join(output, 'unexported-editor.png') });
    await record(path.join(output, 'ready.json'), {
        ...result,
        library,
        wallpapers,
        journal,
        mode: closeOnly ? 'close-only' : 'full',
    });
    const messageOffset = closeOnly ? 0 : 1;
    const close = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await close();
    console.log('WAITING: click 继续工作 in the first real native exit confirmation.');
    await nativeAnswer('messages', messageOffset + 1, 0);
    assert.deepEqual((await readJournal()).phases, ['inspect']);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
    await expect(page.getByTestId('add-marker-lane')).toBeEnabled();
    result.checks.realCloseDeclined = 'passed';
    if (declineOnly) {
        result.dialogs = await readJournal();
        await painted();
        await page.screenshot({ path: path.join(output, 'continue-working.png') });
        await app.evaluate(({ app }) => app.exit(0));
        await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
        result.cleanupExitCode = processHandle.exitCode;
        app = undefined;
    } else {
        await close();
        console.log('WAITING: click 退出 in the second real native exit confirmation.');
        await nativeAnswer('messages', messageOffset + 2, 1);
        await expect.poll(async () => (await readJournal()).closed, { timeout: 30000 }).toBe(true);
        await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
        assert.equal(processHandle.exitCode, 0);
        const state = await readJournal();
        assert.deepEqual(state.phases, ['inspect', 'inspect', 'prepare', 'dispose']);
        assert.equal(state.substitutedAudio, 1);
        assert.equal(state.pending, null);
        result.dialogs = state;
        result.exitCode = processHandle.exitCode;
        app = undefined;
        result.checks.realCloseConfirmedAndCleanExit = 'passed';
    }
    for (const file of originalFiles) assert.equal(await hashFile(file.path), file.sha256);
    assert.deepEqual(errors, []);
    result.checks.originalCopiedLibraryUnchanged = 'passed';
    result.status = 'passed';
} catch (error) {
    result.status = aborting ? 'deferred' : 'failed';
    result.error = String(error);
    if (!aborting) process.exitCode = 1;
    console.error(result.error);
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 3000 })
        .catch(() => '');
    await page?.screenshot({ path: path.join(output, 'failure.png'), timeout: 5000 }).catch(() => {});
} finally {
    clearInterval(control);
    try {
        if (app) await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
        if (processHandle) await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.status = 'failed';
        result.cleanupError = String(error);
        process.exitCode = 1;
    }
    result.pageErrors = errors;
    await record(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(process.exitCode ?? 0);
