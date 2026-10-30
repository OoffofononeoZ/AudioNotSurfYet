import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, expect } from '@playwright/test';
import { createNativeRun, copyNativeTree, cleanupNativeTree } from '../../scripts/lib/desktop-native-runtime.mjs';
import { verifiedFtProfile, databaseRows } from './processing-support.mjs';
import { installDialogFixture } from './dialog-fixture.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const flag = process.argv.indexOf('--profile-from');
assert(flag !== -1, 'Pass --profile-from with the prior cold FT result');
const ft = await verifiedFtProfile(root, process.argv[flag + 1]);
const native = await createNativeRun('task-shutdown');
const output = path.join(root, 'artifacts/desktop/task-shutdown', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
assert.equal(await fs.realpath(native.profile), path.join(native.directory, 'profile'));
await fs.rmdir(native.profile); // Only the new, empty directory; the original verified profile remains untouched.
await copyNativeTree(ft.profile, native.profile);
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = {
    status: 'running',
    nativeDirectory: native.directory,
    profileFrom: ft.sourceResult,
    checks: {},
    sessions: [],
    workerEvents: [],
    blockedRequests: [],
};
const errors = [];
let app, page, processHandle, journal;
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    processHandle = app.process();
    await installDialogFixture(app);
    await app.context().route(/^https?:\/\//, route => {
        result.blockedRequests.push(route.request().url().split('?')[0]);
        return route.abort('internetdisconnected');
    });
    await app.context().setOffline(true);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        const text = message.text();
        if (text.startsWith('DESKTOP_TASK:')) {
            const event = { session: result.sessions.length, ...JSON.parse(text.slice(13)) };
            result.workerEvents.push(event);
            if (event.kind === 'request-close') void requestClose().catch(error => console.error(String(error)));
        }
    });
    journal = path.join(output, `session-${result.sessions.length}.json`);
    await app.evaluate(({ BrowserWindow, dialog }, file) => {
        const fs = process.getBuiltinModule('node:fs');
        const owner = BrowserWindow.getAllWindows()[0];
        const state = { dialogs: [], phases: [], closed: false };
        const save = () => {
            fs.writeFileSync(file + '.next', JSON.stringify(state, null, 4) + '\n', 'utf8');
            fs.renameSync(file + '.next', file);
        };
        globalThis.__taskCloseAnswers = [];
        dialog.showMessageBox = async (_owner, options) => {
            const answer = globalThis.__taskCloseAnswers.shift();
            if (!answer || answer.title !== options.title)
                throw Error(`Unexpected task shutdown dialog: ${options.title}`);
            state.dialogs.push({ title: options.title, message: options.message, response: answer.response });
            save();
            return { response: answer.response, checkboxChecked: false };
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
        save();
    }, journal);
    await page.waitForSelector('#main-layout');
    result.versions ??= await app.evaluate(() => process.versions);
    await page.evaluate(() => {
        const Original = window.Worker;
        let completedInference = false,
            closeRequested = false;
        window.Worker = new Proxy(Original, {
            construct(target, args) {
                const worker = Reflect.construct(target, args);
                if (String(args[0]).includes('separation.worker')) {
                    const log = event => console.log('DESKTOP_TASK:' + JSON.stringify(event));
                    const terminate = worker.terminate;
                    worker.terminate = function () {
                        log({ kind: 'terminate' });
                        return terminate.call(this);
                    };
                    worker.addEventListener('message', event => {
                        const message = event.data;
                        if (message?.type !== 'progress') return;
                        log({
                            kind: 'progress',
                            phase: message.phase,
                            directory: message.job.directory,
                            completedUnits: message.completedUnits,
                        });
                        if (message.phase === 'stitch') completedInference = true;
                        if (message.phase === 'inference' && completedInference && !closeRequested) {
                            closeRequested = true;
                            log({ kind: 'request-close', phase: message.phase, directory: message.job.directory });
                        }
                    });
                }
                return worker;
            },
        });
    });
}
const answer = (response, title = '退出 AudioNotSurfYet') =>
    app.evaluate((_electron, value) => globalThis.__taskCloseAnswers.push(value), { title, response });
const readJournal = async () => JSON.parse(await fs.readFile(journal, 'utf8'));
const requestClose = () => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
async function closed() {
    await expect.poll(async () => (await readJournal()).closed, { timeout: 60000 }).toBe(true);
    await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
    assert.equal(processHandle.exitCode, 0);
    result.sessions.push(await readJournal());
    app = undefined;
}
async function editor() {
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
}
async function separation() {
    await page.getByTestId('editor-separation-tab').click();
    const entry = page.getByTestId('editor-separation-continue');
    if (await entry.isVisible()) await entry.click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
}
async function artifacts(directory) {
    return page.evaluate(async name => {
        try {
            const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(name);
            const names = [];
            for await (const name of root.keys()) names.push(name);
            return names.sort();
        } catch (error) {
            if (error.name === 'NotFoundError') return [];
            throw error;
        }
    }, directory);
}
const records = async () =>
    (await databaseRows(page, 'processing-p1', 2, 'editor-results'))
        .map(record => ({
            directory: record.result.source.directory,
            metadataHash: record.metadataHash,
            files: record.files,
        }))
        .sort((a, b) => a.directory.localeCompare(b.directory));
async function readyFiles() {
    return page.evaluate(async () => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-export');
        const files = [];
        for await (const [name, handle] of dir.entries()) {
            const file = await handle.getFile();
            const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
            files.push({
                name,
                bytes: file.size,
                sha256: Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join(''),
            });
        }
        return files;
    });
}

console.log(`Desktop task shutdown: ${output}`);
try {
    await launch();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await editor();
    await page.getByTestId('tempo-bpm-0').fill('145');
    await page.getByTestId('tempo-bpm-0').blur();
    await separation();
    const priorRecords = await records(),
        priorArtifacts = await artifacts('processing-p1');
    assert(priorRecords.length > 0);
    await answer(1);
    await page.getByTestId('editor-separate-start').click();
    await closed();
    const progress = result.workerEvents.filter(event => event.session === 0);
    assert(
        progress.some(event => event.kind === 'progress' && event.phase === 'stitch'),
        'No completed real inference observed before closing',
    );
    const trigger = progress.find(event => event.kind === 'request-close');
    assert(trigger, 'Inference close was not triggered');
    assert(
        progress.some(event => event.kind === 'terminate'),
        'Separation Worker termination was not observed',
    );
    assert.deepEqual(result.sessions[0].phases, ['inspect', 'prepare', 'dispose']);
    result.checks.realFtInferenceConfirmedClose = 'passed';

    await launch();
    await editor();
    await separation();
    assert.deepEqual(await records(), priorRecords);
    assert.deepEqual(await artifacts('processing-p1'), priorArtifacts);
    assert(!(await artifacts('processing-p1')).includes(trigger.directory));
    result.checks.cancelledFtArtifactsRemovedAndPriorResultsRetained = 'passed';
    await page.getByTestId('editor-marking-tab').click();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('145');
    await page.getByTestId('header-visualizer-link').click();
    const leaveEditor = page.getByRole('button', { name: '仍然离开', exact: true });
    if (await leaveEditor.isVisible()) await leaveEditor.click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 120000 });
    result.ready = await readyFiles();
    assert.equal(result.ready.length, 1);
    assert(result.ready[0].bytes > 0);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.screenshot({ path: path.join(output, 'ready-before-close.png') });
    await answer(0);
    await requestClose();
    await expect.poll(async () => (await readJournal()).dialogs.length).toBe(1);
    assert.deepEqual(await readyFiles(), result.ready);
    await expect(page.locator('[data-export-status=ready]')).toBeVisible();
    result.checks.rejectedCloseKeepsReadyVideo = 'passed';

    await page.evaluate(() => {
        const original = IDBObjectStore.prototype.put;
        window.__restoreSessionWrites = () => {
            IDBObjectStore.prototype.put = original;
        };
        IDBObjectStore.prototype.put = function (...args) {
            if (this.transaction.db.name === 'audionotsurfyet-session')
                throw new DOMException('Controlled session write failure', 'QuotaExceededError');
            return original.apply(this, args);
        };
    });
    await answer(1);
    await answer(0, '未能退出');
    await requestClose();
    await expect.poll(async () => (await readJournal()).dialogs.length, { timeout: 30000 }).toBe(3);
    await expect(page.getByRole('dialog', { name: '正在退出' })).toHaveCount(0);
    await expect(page.locator('[data-export-status=ready]')).toBeVisible();
    assert.deepEqual(await readyFiles(), result.ready);
    assert.deepEqual((await readJournal()).phases.slice(-3), ['inspect', 'prepare', 'resume']);
    result.checks.failedSessionPersistenceKeepsExactReadyVideo = 'passed';
    await page.evaluate(() => window.__restoreSessionWrites());
    await answer(1);
    await requestClose();
    await closed();
    assert.deepEqual(result.sessions[1].phases.slice(-3), ['inspect', 'prepare', 'dispose']);
    result.checks.confirmedCloseDiscardsReadyVideo = 'passed';

    await launch();
    assert.deepEqual(await artifacts('visualizer-export'), []);
    await editor();
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('145');
    assert.deepEqual(await records(), priorRecords);
    result.checks.readyTempGoneAndDraftRestoredAfterRestart = 'passed';
    await answer(1);
    await requestClose();
    await closed();
    assert.deepEqual(result.blockedRequests, []);
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
        try {
            await answer(1);
            await app.close();
        } catch (error) {
            result.cleanupError = String(error);
            result.status = 'failed';
        }
    }
    result.pageErrors = errors;
    result.limitations = [
        'Explicit verified model profile copy; not a new cold download',
        'Native confirmation answers substituted',
        'Controlled short input and ready-file lifecycle only; no new media or recognition quality acceptance',
    ];
    if (result.status === 'passed') {
        try {
            await cleanupNativeTree(runtime);
        } catch (error) {
            result.status = 'failed';
            result.cleanupError = String(error);
        }
    }
    await write(path.join(output, 'result.json'), result);
    console.log(JSON.stringify({ status: result.status, output, checks: result.checks }));
}
process.exit(result.status === 'passed' ? 0 : 1);
