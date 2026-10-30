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

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('files');
const output = path.join(root, 'artifacts/desktop/files', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const inputs = path.join(native.directory, 'inputs');
const exports = path.join(native.directory, 'exports');
await fs.mkdir(inputs);
await fs.mkdir(exports);
const fixturePaths = [];
for (const extension of ['wav', 'mp3', 'flac']) {
    const file = path.join(inputs, `format-master.${extension}`);
    await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio', path.basename(file)), file);
    fixturePaths.push(file);
}
const env = { ...process.env, TEMP: native.temp, TMP: native.temp, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    checks: {},
    limitations: ['OS dialogs are replaced; this is not native picker or confirmation UI evidence'],
};
const pageErrors = [];
const consoleErrors = [];
const fileResponses = [];
let app;
let page;

async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30_000,
    });
    await app.evaluate(({ dialog }) => {
        globalThis.__desktopFileDialogs = { open: [], save: [], calls: [] };
        dialog.showOpenDialog = async (_owner, options) => {
            const state = globalThis.__desktopFileDialogs;
            state.calls.push({ kind: 'open', title: options.title });
            const next = state.open.shift();
            if (!next) throw Error('Unexpected open dialog in desktop file integration');
            return next;
        };
        dialog.showSaveDialog = async (_owner, options) => {
            const state = globalThis.__desktopFileDialogs;
            state.calls.push({ kind: 'save', title: options.title });
            const next = state.save.shift();
            if (!next) throw Error('Unexpected save dialog in desktop file integration');
            return next;
        };
        dialog.showMessageBox = async (_owner, options) => {
            if (options.title !== '退出 AudioNotSurfYet') throw Error(`Unexpected confirmation: ${options.title}`);
            globalThis.__desktopFileDialogs.calls.push({ kind: 'confirmation', title: options.title });
            return { response: 1, checkboxChecked: false };
        };
    });
    page = await app.firstWindow();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', response => {
        if (response.url().includes('/native-files/')) fileResponses.push({ status: response.status() });
    });
    await page.waitForSelector('#main-layout');
}

async function chooseFiles(paths) {
    await app.evaluate((_electron, files) => {
        globalThis.__desktopFileDialogs.open.push({ canceled: false, filePaths: files });
    }, paths);
}

async function close() {
    if (app) {
        const calls = await app.evaluate(() => globalThis.__desktopFileDialogs.calls);
        (result.sessions ??= []).push(calls);
    }
    await app?.close();
    app = undefined;
}

async function queueSave(filePath) {
    await app.evaluate((_electron, target) => {
        globalThis.__desktopFileDialogs.save.push(target ? { canceled: false, filePath: target } : { canceled: true });
    }, filePath);
}

async function fileReady(file) {
    await expect
        .poll(async () =>
            fs
                .stat(file)
                .then(stat => stat.size)
                .catch(() => 0),
        )
        .toBeGreaterThan(0);
}

async function queueVisible() {
    if (!(await page.getByTestId('queue-count').isVisible())) await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('3');
}

async function currentBlobPresent() {
    return page.evaluate(async () => {
        const database = await new Promise((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-session', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        try {
            const stores = Array.from(database.objectStoreNames);
            const key = stores.find(name => name === 'current-blob');
            if (!key) throw Error(`Current Blob store not found: ${stores.join(',')}`);
            return await new Promise((resolve, reject) => {
                const request = database.transaction(key, 'readonly').objectStore(key).get('current');
                request.onsuccess = () => resolve((request.result?.blob?.size ?? 0) > 0);
                request.onerror = () => reject(request.error);
            });
        } finally {
            database.close();
        }
    });
}

console.log(`Desktop file integration: ${output}`);
try {
    await launch();
    await chooseFiles(fixturePaths);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('3');
    result.checks.import = 'passed';

    const trackIds = await page
        .getByTestId('queue-item')
        .evaluateAll(elements => elements.map(element => element.getAttribute('data-track-id')));
    assert.equal(new Set(trackIds).size, 3);
    await page.getByTestId('toggle-queue').click();
    for (const index of [1, 2]) {
        await page.getByTestId('next-track').click();
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', trackIds[index]);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
        await page.getByTestId('toggle-playback').click();
    }
    for (const index of [1, 0]) {
        await page.getByTestId('previous-track').click();
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', trackIds[index]);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    }
    await page.getByTestId('toggle-playback').click();
    result.checks.wavMp3FlacPlayback = 'passed';

    await chooseFiles([fixturePaths[0]]);
    const readUrl = await page.evaluate(async () => {
        const files = window.audiosurfDesktop.files;
        const chosen = await files.chooseAudio(false);
        if (!chosen.ok || chosen.value.length !== 1) throw Error('Native permission probe selection failed');
        const descriptor = await files.describeFile(chosen.value[0].grantId);
        if (!descriptor.ok) throw Error(descriptor.error.message);
        return descriptor.value.readUrl;
    });
    const untrustedRead = await app.evaluate(async ({ BrowserWindow }, url) => {
        // Main-process fetch is privileged. Exercise a real untrusted renderer,
        // even giving it an existing opaque grant URL from the allowed window.
        const owner = BrowserWindow.getAllWindows()[0];
        const outsider = new BrowserWindow({
            show: false,
            webPreferences: {
                session: owner.webContents.session,
                sandbox: true,
                nodeIntegration: false,
                contextIsolation: true,
            },
        });
        try {
            await outsider.loadURL('data:text/html,<title>Controlled origin probe</title>');
            return await outsider.webContents.executeJavaScript(`(async () => {
                const context = { origin: location.origin, node: typeof require };
                try {
                    const response = await fetch(${JSON.stringify(url)}, {
                        headers: { Origin: 'app://audiosurf', Referer: 'app://audiosurf/' }
                    });
                    return { ...context, readable: response.ok, status: response.status };
                } catch { return { ...context, readable: false }; }
            })()`);
        } finally {
            outsider.destroy();
        }
    }, readUrl);
    assert.equal(untrustedRead.origin, 'null');
    assert.equal(untrustedRead.node, 'undefined');
    assert.equal(untrustedRead.readable, false);
    result.untrustedRead = untrustedRead;
    const denied = await page.evaluate(async () => ({
        unknown: await window.audiosurfDesktop.files.describeFile(crypto.randomUUID()),
        purpose: await window.audiosurfDesktop.files.chooseFiles('not-a-purpose', false),
    }));
    assert.equal(denied.unknown.ok, false);
    assert.equal(denied.unknown.error.code, 'permission-denied');
    assert.equal(denied.purpose.ok, false);
    assert.equal(denied.purpose.error.code, 'invalid-request');
    result.checks.nativePermissionBoundary = 'passed';

    const currentTrackId = await page.locator('#music-bar-container').getAttribute('data-current-track-id');
    assert(currentTrackId);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await queueSave(null);
    await page.getByTestId('export-editor-project').click();
    await expect.poll(() => app.evaluate(() => globalThis.__desktopFileDialogs.save.length)).toBe(0);
    const editorFile = path.join(exports, '编辑 工程.audiosurf-editor.json');
    await queueSave(editorFile);
    await page.getByTestId('export-editor-project').click();
    await fileReady(editorFile);
    const editorProject = JSON.parse(await fs.readFile(editorFile, 'utf8'));
    assert.equal(editorProject.format, 'audiosurf-editor');
    assert.equal(editorProject.schemaVersion, 2);
    assert.equal(editorProject.lanes.length, 1);
    assert.equal(editorProject.lanes[0].eventKind, 'point');
    result.checks.editorNativeSave = 'passed';
    console.log('Actual Editor JSON save and picker cancellation passed');

    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByRole('tab', { name: 'Editor 数据', exact: true }).click();
    await page.getByRole('button', { name: '移除', exact: true }).click();
    await chooseFiles([editorFile]);
    await page.getByRole('button', { name: '导入 Editor JSON', exact: true }).click();
    await expect(page.getByText(/已载入同歌快照/)).toBeVisible();
    const visualizerFile = path.join(exports, 'composition.audiosurf-visualizer.json');
    await queueSave(visualizerFile);
    await page.getByTestId('export-visualizer-project').click();
    await page.getByTestId('export-project-file').click();
    await fileReady(visualizerFile);
    const composition = JSON.parse(await fs.readFile(visualizerFile, 'utf8'));
    assert.deepEqual(composition.editorSnapshot.project, editorProject);
    result.checks.projectTransfer = 'passed';

    await chooseFiles([editorFile]);
    const transient = await page.evaluate(async () => {
        const files = window.audiosurfDesktop.files;
        const chosen = await files.chooseFiles('editor-project', false);
        if (!chosen.ok || chosen.value.length !== 1) throw Error('Transient grant selection failed');
        const id = chosen.value[0].grantId;
        const before = await files.describeFile(id);
        const release = await files.releaseInput(id);
        const after = await files.describeFile(id);
        return { before: before.ok, release: release.ok, after };
    });
    assert.equal(transient.before, true);
    assert.equal(transient.release, true);
    assert.equal(transient.after.ok, false);
    assert.equal(transient.after.error.code, 'permission-denied');
    result.checks.transientInputRelease = 'passed';

    const streamFile = path.join(exports, 'stream.webm');
    await queueSave(streamFile);
    const streamed = await page.evaluate(async () => {
        const bridge = window.audiosurfDesktop.saves;
        const size = 2 * 1024 * 1024 + 37;
        const begun = await bridge.beginSave('video', 'stream.webm', size);
        if (!begun.ok || !begun.value) throw Error('Streaming save could not begin');
        for (let cursor = 0; cursor < size; cursor += 1024 * 1024) {
            const written = await bridge.writeSave(
                begun.value.saveId,
                new Uint8Array(Math.min(size - cursor, 1024 * 1024)).fill(81),
            );
            if (!written.ok) throw Error(written.error.message);
        }
        return bridge.commitSave(begun.value.saveId);
    });
    assert.equal(streamed.ok, true);
    assert.deepEqual(await fs.readFile(streamFile), Buffer.alloc(2 * 1024 * 1024 + 37, 81));
    result.checks.chunkedNativeSave = 'passed';

    const protectedFile = path.join(exports, 'protected.webm');
    await fs.writeFile(protectedFile, 'existing user output', { flag: 'wx', encoding: 'utf8' });
    const protectedHash = await hashFile(protectedFile);
    await queueSave(protectedFile);
    const aborted = await page.evaluate(async () => {
        const bridge = window.audiosurfDesktop.saves;
        const begun = await bridge.beginSave('video', 'protected.webm', 5);
        if (!begun.ok || !begun.value) throw Error('Abort save could not begin');
        const written = await bridge.writeSave(begun.value.saveId, Uint8Array.of(1, 2));
        if (!written.ok) throw Error(written.error.message);
        return bridge.abortSave(begun.value.saveId);
    });
    assert.equal(aborted.ok, true);
    assert.equal(await hashFile(protectedFile), protectedHash);
    assert(!(await fs.readdir(exports)).some(name => name.startsWith('.audiosurf-')));
    result.checks.abortPreservesDestination = 'passed';
    assert.equal(await currentBlobPresent(), true);
    await page.screenshot({ path: path.join(output, 'project-transfer.png') });
    await close();

    console.log('Restarting the actual application with the same native grants and IndexedDB');
    await launch();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', currentTrackId);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', '0');
    await queueVisible();
    await expect(page.getByTestId('track-restore-state')).toHaveCount(0);
    assert.equal(await currentBlobPresent(), true);
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.locator('[data-testid^="marker-surface-"]')).toHaveCount(1);
    result.checks.editorDraftRestart = 'passed';
    result.checks.nativeRestart = 'passed';
    await close();

    const changed = Buffer.from(await fs.readFile(fixturePaths[0]));
    changed[44] ^= 1;
    await fs.writeFile(fixturePaths[0], changed);
    await launch();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'empty');
    await queueVisible();
    await expect(page.locator('[data-restore-state="content-changed"]')).toHaveCount(1);
    result.checks.changedSourceRejectsCachedBlob = 'passed';
    await close();

    await fs.copyFile(path.join(root, 'tests/fixtures/audio/format-master.wav'), fixturePaths[0]);
    await launch();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    result.checks.originalSourceRestored = 'passed';
    await close();

    assert.equal(await fs.realpath(inputs), inputs);
    assert.equal(await fs.realpath(fixturePaths[0]), fixturePaths[0]);
    const moved = path.join(inputs, 'moved.wav');
    await fs.rename(fixturePaths[0], moved);
    await launch();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'empty');
    await queueVisible();
    await expect(page.locator('[data-restore-state="file-missing"]')).toHaveCount(1);
    result.checks.missingSourceRejectsCachedBlob = 'passed';
    assert.deepEqual(pageErrors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    if (page && !page.isClosed()) {
        result.alerts = await page
            .getByRole('alert')
            .allTextContents()
            .catch(() => []);
        result.playback = await page
            .locator('#music-bar-container')
            .evaluate(element =>
                Object.fromEntries(
                    Array.from(element.attributes)
                        .filter(attribute => attribute.name.startsWith('data-'))
                        .map(attribute => [attribute.name, attribute.value]),
                ),
            )
            .catch(() => null);
    }
    process.exitCode = 1;
} finally {
    try {
        result.dialogCalls = await app?.evaluate(() => globalThis.__desktopFileDialogs.calls);
        await close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.cleanupError = String(error);
        result.status = 'failed';
        process.exitCode = 1;
    }
    Object.assign(result, { pageErrors, consoleErrors, fileResponses });
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify(result, null, 2));
}
process.exit(process.exitCode ?? 0);
