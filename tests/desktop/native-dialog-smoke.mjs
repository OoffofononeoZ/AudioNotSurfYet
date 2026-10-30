import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { _electron, expect } from '@playwright/test';
import {
    createNativeRun,
    copyNativeTree,
    copyVerifiedBytes,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';

const root = process.cwd();
const native = await createNativeRun('manual-files');
const output = path.join(root, 'artifacts/desktop/manual-files', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const source = path.join(native.directory, 'format-master.wav');
const destination = path.join(native.directory, 'manual-editor.json');
await copyVerifiedBytes(path.join(root, 'tests/fixtures/audio/format-master.wav'), source);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = { status: 'waiting-for-user', nativeDirectory: native.directory, source, destination, checks: {} };
await fs.writeFile(path.join(output, 'ready.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
console.log('MANUAL_DIALOG_SESSION ' + output);
let app,
    page,
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
try {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await app.evaluate(
        ({ dialog }, { source, destination }) => {
            // Keep the real Windows dialogs and their results. Only prefill and
            // constrain this manual check to its own controlled input/output.
            globalThis.__manualDialogs = { openStarted: 0, openCompleted: 0, saveStarted: 0, saveCompleted: 0 };
            const open = dialog.showOpenDialog.bind(dialog),
                save = dialog.showSaveDialog.bind(dialog);
            const normalize = value => value.replaceAll('/', '\\').toLowerCase();
            dialog.showOpenDialog = async (owner, options) => {
                globalThis.__manualDialogs.openStarted++;
                const answer = await open(owner, { ...options, defaultPath: source, properties: ['openFile'] });
                if (
                    !answer.canceled &&
                    (answer.filePaths.length !== 1 || normalize(answer.filePaths[0]) !== normalize(source))
                )
                    throw Error('Manual check accepts only the specified controlled fixture');
                globalThis.__manualDialogs.openCompleted++;
                return answer;
            };
            dialog.showSaveDialog = async (owner, options) => {
                globalThis.__manualDialogs.saveStarted++;
                const answer = await save(owner, { ...options, defaultPath: destination });
                if (!answer.canceled && normalize(answer.filePath) !== normalize(destination))
                    throw Error('Manual check saves only to its new controlled destination');
                globalThis.__manualDialogs.saveCompleted++;
                return answer;
            };
        },
        { source, destination },
    );
    page = await app.firstWindow();
    await page.waitForSelector('#main-layout');
    await app.evaluate(({ BrowserWindow }) => {
        const window = BrowserWindow.getAllWindows()[0];
        window.setSize(1200, 800);
        window.show();
        window.focus();
    });
    await page.getByTestId('import-audio').click();
    console.log('WAITING: click Open in the real native audio chooser; controlled fixture is prefilled.');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 1800000,
    });
    await page.getByTestId('toggle-playback').click();
    result.checks.realNativeAudioChooser = 'passed';
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('add-marker-lane').click();
    await page.getByTestId('add-point-lane').click();
    await page.getByTestId('export-editor-project').click();
    console.log('WAITING: click Save in the real native save chooser; new controlled destination is prefilled.');
    await expect
        .poll(
            () =>
                fs
                    .stat(destination)
                    .then(value => value.size)
                    .catch(() => 0),
            { timeout: 1800000 },
        )
        .toBeGreaterThan(0);
    const project = JSON.parse(await fs.readFile(destination, 'utf8'));
    assert.equal(project.format, 'audiosurf-editor');
    assert.equal(project.schemaVersion, 2);
    assert.equal(project.lanes.length, 1);
    assert.equal(project.track.contentHash, await hashFile(source));
    result.checks.sourceIdentity = 'passed';
    const dialogs = await app.evaluate(() => globalThis.__manualDialogs);
    assert.deepEqual(dialogs, { openStarted: 1, openCompleted: 1, saveStarted: 1, saveCompleted: 1 });
    result.checks.realNativeSaveChooser = 'passed';
    result.dialogs = dialogs;
    await page.screenshot({ path: path.join(output, 'saved-project.png') });
    result.status = 'passed';
} catch (error) {
    result.status = aborting ? 'deferred' : 'failed';
    result.error = String(error);
    if (!aborting) process.exitCode = 1;
} finally {
    clearInterval(control);
    try {
        if (app?.process().exitCode === null) await app.close();
        if (result.status === 'passed') await cleanupNativeTree(runtime);
    } catch (error) {
        result.cleanupError = String(error);
        result.status = 'failed';
        process.exitCode = 1;
    }
    await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 4) + '\n', 'utf8');
    console.log(JSON.stringify(result, null, 2));
}
