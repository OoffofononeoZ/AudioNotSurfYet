import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { installDialogFixture, queueOpen, queueSave } from './dialog-fixture.mjs';
import { databaseRows } from './processing-support.mjs';
import { createLongWav } from './long-media-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('lifecycle');
const output = path.join(root, 'artifacts/desktop/lifecycle', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const executable = path.join(runtime.root, 'AudioNotSurfYet.exe');
const audio = path.join(native.directory, 'long.wav');
await createLongWav(audio);
const exports = path.join(native.directory, 'exports');
await fs.mkdir(exports);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const args = [`--user-data-dir=${native.profile}`];
const result = { status: 'running', nativeDirectory: native.directory, checks: {}, sessions: [] };
const errors = [];
let app, page, journal, processHandle;

async function launch() {
    app = await _electron.launch({ executablePath: executable, args, cwd: root, env, timeout: 30000 });
    processHandle = app.process();
    page = await app.firstWindow();
    await installDialogFixture(app);
    journal = path.join(output, `session-${result.sessions.length}.json`);
    await app.evaluate(({ app, BrowserWindow, dialog }, journal) => {
        const fs = process.getBuiltinModule('node:fs');
        const owner = BrowserWindow.getAllWindows()[0];
        const state = { dialogs: [], phases: [], secondInstances: 0, closed: false };
        const save = () => {
            fs.writeFileSync(journal + '.next', JSON.stringify(state, null, 4) + '\n', 'utf8');
            fs.renameSync(journal + '.next', journal);
        };
        globalThis.__lifecycleAnswers = [];
        dialog.showMessageBox = async (_owner, options) => {
            const next = globalThis.__lifecycleAnswers.shift();
            if (!next || next.title !== options.title) throw Error(`Unexpected lifecycle dialog: ${options.title}`);
            state.dialogs.push({ title: options.title, message: options.message, response: next.response });
            save();
            return { response: next.response, checkboxChecked: false };
        };
        const send = owner.webContents.send;
        owner.webContents.send = function (channel, ...args) {
            if (channel === 'audiosurf:lifecycle:request') {
                state.phases.push(args[0].phase);
                save();
            }
            return send.call(this, channel, ...args);
        };
        app.on('second-instance', () => {
            state.secondInstances++;
            save();
        });
        owner.once('closed', () => {
            state.closed = true;
            save();
        });
        owner.show();
        save();
    }, journal);
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    result.versions ??= await app.evaluate(() => process.versions);
}
const answer = (response, title = '退出 AudioNotSurfYet') =>
    app.evaluate((_electron, next) => globalThis.__lifecycleAnswers.push(next), { title, response });
const requestClose = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
const readJournal = async () => JSON.parse(await fs.readFile(journal, 'utf8'));
async function closed() {
    await expect.poll(async () => (await readJournal()).closed, { timeout: 30000 }).toBe(true);
    await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
    assert.equal(processHandle.exitCode, 0);
    result.sessions.push(await readJournal());
    app = undefined;
}
async function editor(bpm) {
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    if (bpm) {
        await page.getByTestId('tempo-bpm-0').fill(String(bpm));
        await page.getByTestId('tempo-bpm-0').blur();
    }
}
const draft = () => databaseRows(page, 'audionotsurfyet-editor', 1, 'draft');

console.log(`Desktop lifecycle: ${output}`);
try {
    await launch();
    await queueOpen(app, [audio]);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 60000,
    });
    const before = Number(await page.locator('#music-bar-container').getAttribute('data-current-time'));
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()))
        .toBe(true);
    await page.waitForTimeout(1800);
    const after = Number(await page.locator('#music-bar-container').getAttribute('data-current-time'));
    assert(after > before + 1, 'Playback clock stopped while minimized');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    result.minimizedPlayback = { before, after };
    result.checks.minimizedPlayback = 'passed';

    const second = spawn(executable, args, { cwd: root, env, windowsHide: true, stdio: 'ignore' });
    let secondError;
    second.on('error', error => {
        secondError = String(error);
    });
    await expect.poll(() => second.exitCode, { timeout: 30000 }).not.toBe(null);
    assert.equal(secondError, undefined);
    assert.equal(second.exitCode, 0);
    await expect.poll(async () => (await readJournal()).secondInstances).toBe(1);
    await expect
        .poll(() =>
            app.evaluate(({ BrowserWindow }) => {
                const windows = BrowserWindow.getAllWindows();
                return {
                    count: windows.length,
                    minimized: windows[0].isMinimized(),
                    visible: windows[0].isVisible(),
                    focused: windows[0].isFocused(),
                };
            }),
        )
        .toEqual({ count: 1, minimized: false, visible: true, focused: true });
    result.checks.secondInstanceRestoreAndFocus = 'passed';
    await page.getByTestId('toggle-playback').click();
    await editor(127.5);

    await answer(0);
    await requestClose();
    await expect.poll(async () => (await readJournal()).dialogs.length).toBe(1);
    assert.deepEqual((await readJournal()).phases, ['inspect']);
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('127.5');
    await page.getByTestId('tempo-bpm-0').fill('129');
    await page.getByTestId('tempo-bpm-0').blur();
    result.checks.rejectedCloseRemainsEditable = 'passed';

    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        window.__restoreDraftWrites = () => {
            IDBObjectStore.prototype.put = original;
        };
        IDBObjectStore.prototype.put = function (...args) {
            if (this.transaction.db.name === 'audionotsurfyet-editor')
                throw new DOMException('Controlled draft write failure', 'QuotaExceededError');
            return original.apply(this, args);
        };
    });
    await page.getByTestId('tempo-bpm-0').fill('142');
    await page.getByTestId('tempo-bpm-0').blur();
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'not-persisted');
    await answer(1);
    await answer(0, '未能退出');
    await requestClose();
    await expect.poll(async () => (await readJournal()).dialogs.length).toBe(3);
    await expect(page.getByRole('dialog', { name: '正在退出' })).toHaveCount(0);
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('142');
    await page.evaluate(() => window.__restoreDraftWrites());
    await page.getByTestId('tempo-bpm-0').fill('143');
    await page.getByTestId('tempo-bpm-0').blur();
    await expect.poll(async () => (await draft())[0].envelope.project.tempoMap[0].bpm).toBe(143);
    result.checks.failedDraftCloseResumesAndRetries = 'passed';

    result.savedBounds = await app.evaluate(({ BrowserWindow, screen }) => {
        const area = screen.getPrimaryDisplay().workArea;
        const bounds = { x: area.x + 20, y: area.y + 20, width: 1100, height: 700 };
        BrowserWindow.getAllWindows()[0].setBounds(bounds);
        return BrowserWindow.getAllWindows()[0].getBounds();
    });
    await page.screenshot({ path: path.join(output, 'draft-before-close.png') });
    await answer(1);
    await requestClose();
    await closed();
    assert.deepEqual(result.sessions[0].phases.slice(-3), ['inspect', 'prepare', 'dispose']);
    result.checks.dirtyDraftAcknowledgedClose = 'passed';

    await launch();
    assert.deepEqual(
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds()),
        result.savedBounds,
    );
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await editor();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('143');
    result.checks.draftAndNormalBoundsRestart = 'passed';

    const exported = path.join(native.directory, 'editor.json');
    await queueSave(app, exported);
    await page.getByTestId('export-editor-project').click();
    await expect
        .poll(() =>
            fs
                .stat(exported)
                .then(s => s.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].maximize());
    await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()))
        .toBe(true);

    const target = path.join(exports, 'unfinished.webm');
    await queueSave(app, target);
    const pending = await page.evaluate(async () => {
        const save = await window.audiosurfDesktop.saves.beginSave('video', 'unfinished.webm', 2048);
        if (!save.ok || !save.value) throw Error('Native save did not start');
        const written = await window.audiosurfDesktop.saves.writeSave(save.value.saveId, new Uint8Array(1024).fill(7));
        if (!written.ok) throw Error('Native save did not write');
        return save.value;
    });
    const files = await fs.readdir(exports);
    assert.equal(files.length, 1);
    assert.match(files[0], /^\.audiosurf-[a-f0-9-]{36}\.tmp$/);
    result.pendingSave = { ...pending, bytes: (await fs.stat(path.join(exports, files[0]))).size };
    await answer(1);
    await requestClose();
    await closed();
    assert.deepEqual(result.sessions[1].phases, ['inspect', 'prepare', 'dispose']);
    assert.equal(result.sessions[1].dialogs.length, 1, 'Native pending save did not require explicit confirmation');
    assert.deepEqual(await fs.readdir(exports), []);
    result.checks.pendingNativeSaveCloseCleanup = 'passed';

    await launch();
    await expect
        .poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMaximized()))
        .toBe(true);
    assert.deepEqual(
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getNormalBounds()),
        result.savedBounds,
    );
    result.checks.maximizedRestartKeepsNormalBounds = 'passed';
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].unmaximize());
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=exporting]')).toBeVisible({ timeout: 30000 });
    await answer(1);
    await requestClose();
    await closed();
    assert.deepEqual(result.sessions[2].phases, ['inspect', 'prepare', 'dispose']);
    result.checks.activeExportClose = 'passed';

    await launch();
    const leftovers = await page.evaluate(async () => {
        const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-export');
        const files = [];
        for await (const name of directory.keys()) files.push(name);
        return files;
    });
    assert.deepEqual(leftovers, []);
    await editor();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('143');
    await answer(1);
    await requestClose();
    await closed();
    result.checks.exportTempAndDraftAfterRestart = 'passed';
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    result.stack = error.stack;
    result.body = await page
        ?.locator('body')
        .innerText({ timeout: 5000 })
        .catch(() => '');
    console.error(result.error);
} finally {
    if (app) {
        await answer(1).catch(() => {});
        await app.close().catch(() => {});
    }
    result.pageErrors = errors;
    result.limitations = [
        'OS picker and confirmation results substituted',
        'Single local display at its current scaling; display removal is covered by placement logic tests only',
        'Controlled active offline export; not FT inference shutdown or crash recovery',
    ];
    if (result.status === 'passed') {
        try {
            await cleanupNativeTree(runtime);
        } catch (error) {
            result.status = 'failed';
            result.cleanupError = String(error);
        }
    }
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(result.status === 'passed' ? 0 : 1);
