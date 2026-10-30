import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron, expect } from '@playwright/test';
import {
    createNativeRun,
    copyNativeTree,
    cleanupNativeTree,
    hashFile,
} from '../../scripts/lib/desktop-native-runtime.mjs';
import { queueSave } from './dialog-fixture.mjs';
import { installRecoveryDialogs, terminateRecoveryApp } from './recovery-support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('save-recovery');
const output = path.join(root, 'artifacts/desktop/save-recovery', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const exports = path.join(native.directory, 'exports');
await fs.mkdir(exports);
const target = path.join(exports, 'existing.webm');
await fs.writeFile(target, 'Existing valid output', 'utf8');
const originalHash = await hashFile(target);
const untracked = path.join(exports, '.audiosurf-63ae0062-d925-4e28-8cef-68132ad49537.tmp');
await fs.writeFile(untracked, 'untracked user bytes', 'utf8');
const untrackedHash = await hashFile(untracked);
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = { status: 'running', nativeDirectory: native.directory, checks: {}, exits: [], warnings: [] };
const errors = [];
let app, page, processHandle;
async function launch() {
    app = await _electron.launch({
        executablePath: path.join(runtime.root, 'AudioNotSurfYet.exe'),
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    processHandle = app.process();
    await installRecoveryDialogs(app);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    result.versions ??= await app.evaluate(() => process.versions);
}
async function stop(hard = true) {
    result.warnings.push(...(await app.evaluate(() => globalThis.__recoveryWarnings)));
    if (hard) result.exits.push(await terminateRecoveryApp(app, path.join(runtime.root, 'AudioNotSurfYet.exe')));
    else {
        await app.close();
        await expect.poll(() => processHandle.exitCode ?? processHandle.signalCode, { timeout: 30000 }).not.toBe(null);
        result.exits.push({ hard, code: processHandle.exitCode, signal: processHandle.signalCode });
    }
    app = undefined;
}
async function begin(file, size, bytes) {
    await queueSave(app, file);
    const reference = await page.evaluate(
        async ({ size, bytes }) => {
            const saves = window.audiosurfDesktop.saves;
            const reference = await saves.beginSave('video', 'fixture.webm', size);
            if (!reference.ok || !reference.value) throw Error('Save did not start');
            const written = await saves.writeSave(reference.value.saveId, new Uint8Array(bytes).fill(37));
            if (!written.ok) throw Error(written.error.message);
            return reference.value;
        },
        { size, bytes },
    );
    const temporary = path.join(exports, `.audiosurf-${reference.saveId}.tmp`);
    assert.equal((await fs.stat(temporary)).size, bytes);
    return { reference, temporary };
}
async function verifyPreserved() {
    assert.equal(await hashFile(target), originalHash);
    assert.equal(await hashFile(untracked), untrackedHash);
}

console.log(`Desktop save recovery: ${output}`);
try {
    await launch();
    const first = await begin(target, 2 * 1024 * 1024, 1024 * 1024);
    result.partial = {
        file: first.temporary,
        bytes: (await fs.stat(first.temporary)).size,
        sha256: await hashFile(first.temporary),
    };
    await stop();
    assert.equal(
        (await fs.stat(first.temporary)).size,
        1024 * 1024,
        'The hard kill unexpectedly performed normal cleanup',
    );
    await verifyPreserved();
    await launch();
    await assert.rejects(fs.stat(first.temporary), { code: 'ENOENT' });
    await verifyPreserved();
    result.checks.hardKillThenOwnedPartialRecovery = 'passed';
    result.checks.originalTargetAndUntrackedPreserved = 'passed';

    const published = path.join(exports, 'published.webm');
    const complete = await begin(published, 1024 * 1024, 1024 * 1024);
    const committed = await page.evaluate(
        id => window.audiosurfDesktop.saves.commitSave(id),
        complete.reference.saveId,
    );
    assert.equal(committed.ok, true);
    const publishedHash = await hashFile(published);
    await stop();
    await launch();
    assert.equal(await hashFile(published), publishedHash);
    await verifyPreserved();
    result.checks.publishedOutputSurvivesCrash = 'passed';

    const changed = await begin(path.join(exports, 'not-published.webm'), 100, 20);
    await stop();
    await fs.writeFile(changed.temporary, 'Externally modified!', 'utf8');
    const changedHash = await hashFile(changed.temporary);
    await launch();
    assert.equal(await hashFile(changed.temporary), changedHash);
    assert.equal(await hashFile(published), publishedHash);
    await verifyPreserved();
    result.checks.changedPartialRetainedAfterRestart = 'passed';
    result.retained = { file: changed.temporary, sha256: changedHash };
    await stop(false);
    assert.equal(result.exits.at(-1).code, 0);
    assert.deepEqual(errors, []);
    result.status = 'passed';
} catch (error) {
    result.status = 'failed';
    result.error = String(error);
    result.stack = error.stack;
    console.error(result.error);
} finally {
    if (app) {
        try {
            await app.close();
        } catch (error) {
            result.status = 'failed';
            result.cleanupError = String(error);
        }
    }
    result.pageErrors = errors;
    result.limitations = [
        'Native save selection and warning responses are substituted',
        'Tests process termination, not power-loss durability',
        'Directory bundle crash recovery is not covered',
        'Mid-write changes are conservatively retained; no output-directory scanning',
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
