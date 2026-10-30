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
import { queueOpen, queueConfirmation } from './dialog-fixture.mjs';
import { installRecoveryDialogs, terminateRecoveryApp } from './recovery-support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const native = await createNativeRun('bundle-recovery');
const output = path.join(root, 'artifacts/desktop/bundle-recovery', path.basename(native.directory));
await fs.mkdir(output, { recursive: true });
const runtime = await copyNativeTree(
    path.join(root, 'artifacts/desktop/packages/win-unpacked'),
    path.join(native.directory, 'runtime'),
);
const executable = path.join(runtime.root, 'AudioNotSurfYet.exe');
const library = path.join(native.directory, 'library'),
    presets = path.join(library, 'presets'),
    wallpapers = path.join(native.directory, 'wallpapers');
await fs.mkdir(presets, { recursive: true });
await fs.mkdir(wallpapers);
const marker = path.join(presets, 'existing-user-file.txt');
await fs.writeFile(marker, 'Existing user bytes', 'utf8');
const markerHash = await hashFile(marker);
const untracked = path.join(wallpapers, '.audiosurf-bundle-6fbd6adf-c76b-40bf-ade9-4bc4b51caa75.tmp');
await fs.mkdir(untracked);
await fs.writeFile(path.join(untracked, 'user.txt'), 'Not tracked', 'utf8');
const untrackedHash = await hashFile(path.join(untracked, 'user.txt'));
const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: native.profile, TEMP: native.temp, TMP: native.temp };
delete env.ELECTRON_RUN_AS_NODE;
const result = { status: 'running', nativeDirectory: native.directory, checks: {}, exits: [], warnings: [] };
const errors = [];
let app, page;
async function launch() {
    app = await _electron.launch({
        executablePath: executable,
        args: [`--user-data-dir=${native.profile}`],
        cwd: root,
        env,
        timeout: 30000,
    });
    await installRecoveryDialogs(app);
    page = await app.firstWindow();
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('#main-layout');
    result.versions ??= await app.evaluate(() => process.versions);
}
async function stop(hard = true) {
    result.warnings.push(...(await app.evaluate(() => globalThis.__recoveryWarnings)));
    if (hard) result.exits.push(await terminateRecoveryApp(app, executable));
    else {
        const processHandle = app.process();
        await app.close();
        await expect.poll(() => processHandle.exitCode, { timeout: 30000 }).not.toBe(null);
        assert.equal(processHandle.exitCode, 0);
        result.exits.push({ hard: false, code: processHandle.exitCode });
    }
    app = undefined;
}
async function begin(kind) {
    const names =
        kind === 'preset'
            ? ['resource-package.json', 'source/resource.json', 'preview.png', 'resource-info.json']
            : ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json'];
    const entries = names.map(name => ({ name, size: 16384 }));
    let grantId;
    if (kind === 'preset') {
        await queueOpen(app, [library]);
        const granted = await page.evaluate(() => window.audiosurfDesktop.files.chooseResourceDirectory());
        assert(granted.ok && granted.value);
        grantId = granted.value.grantId;
        await queueConfirmation(app, '保存预设', 0);
    } else await queueOpen(app, [wallpapers]);
    const begun = await page.evaluate(
        async ({ kind, entries, grantId }) => {
            const bundles = window.audiosurfDesktop.bundles;
            return kind === 'preset'
                ? bundles.beginPreset(grantId, 'user-preset-' + crypto.randomUUID(), entries)
                : bundles.beginWallpaper(entries);
        },
        { kind, entries, grantId },
    );
    assert(begun.ok && begun.value, JSON.stringify(begun));
    return {
        ...begun.value,
        entries,
        parent: kind === 'preset' ? presets : wallpapers,
        temporary: path.join(kind === 'preset' ? presets : wallpapers, `.audiosurf-bundle-${begun.value.bundleId}.tmp`),
    };
}
async function file(bundle, close = true) {
    const responses = await page.evaluate(
        async ({ id, close }) => {
            const bridge = window.audiosurfDesktop.bundles;
            const results = [await bridge.beginFile(id)];
            if (!results[0].ok) return results;
            results.push(await bridge.writeFile(id, new Uint8Array(close ? 16384 : 8192).fill(29)));
            if (close && results.at(-1).ok) results.push(await bridge.closeFile(id));
            return results;
        },
        { id: bundle.bundleId, close },
    );
    for (const response of responses) assert(response.ok, JSON.stringify(response));
}
async function preserved() {
    assert.equal(await hashFile(marker), markerHash);
    assert.equal(await hashFile(path.join(untracked, 'user.txt')), untrackedHash);
}
async function pending(bundle, complete) {
    for (let i = 0; i < complete; i++) await file(bundle);
    await file(bundle, false);
    const parent = path.dirname(path.join(bundle.temporary, bundle.entries[complete].name));
    const files = (await fs.readdir(parent)).filter(name => /^\.audiosurf-[a-f0-9-]{36}\.tmp$/.test(name));
    assert.equal(files.length, 1);
    return path.join(parent, files[0]);
}

console.log(`Desktop bundle recovery: ${output}`);
try {
    for (const kind of ['wallpaper', 'preset']) {
        await launch();
        const bundle = await begin(kind);
        const partial = await pending(bundle, kind === 'preset' ? 1 : 2);
        await stop();
        assert.equal((await fs.stat(partial)).size, 8192);
        assert((await fs.stat(bundle.temporary)).isDirectory());
        await launch();
        await assert.rejects(fs.stat(bundle.temporary), { code: 'ENOENT' });
        await preserved();
        result.checks[`${kind}ChildAndTreeRecovery`] = 'passed';
        await stop(false);
    }
    await launch();
    const complete = await begin('wallpaper');
    for (const _entry of complete.entries) await file(complete);
    const committed = await page.evaluate(id => window.audiosurfDesktop.bundles.commit(id), complete.bundleId);
    assert(committed.ok, JSON.stringify(committed));
    const published = path.join(wallpapers, complete.folderName);
    const publishedHashes = await Promise.all(
        complete.entries.map(async entry => ({
            name: entry.name,
            hash: await hashFile(path.join(published, entry.name)),
        })),
    );
    await stop();
    await launch();
    for (const entry of publishedHashes) assert.equal(await hashFile(path.join(published, entry.name)), entry.hash);
    result.checks.publishedFiveFileDirectoryPreserved = 'passed';

    const added = await begin('preset');
    const pendingAdded = await pending(added, 1);
    const ownedFile = path.join(added.temporary, added.entries[0].name),
        ownedHash = await hashFile(ownedFile);
    await stop();
    const foreign = path.join(added.temporary, 'foreign-user-file.txt');
    await fs.writeFile(foreign, 'External addition', 'utf8');
    const foreignHash = await hashFile(foreign);
    await launch();
    assert.equal(await hashFile(foreign), foreignHash);
    assert.equal(await hashFile(ownedFile), ownedHash);
    await assert.rejects(fs.stat(pendingAdded), { code: 'ENOENT' });
    result.checks.externalAdditionRetainsDirectory = 'passed';

    const changed = await begin('wallpaper');
    const pendingChanged = await pending(changed, 2);
    const untouched = path.join(changed.temporary, changed.entries[1].name),
        untouchedHash = await hashFile(untouched);
    await stop();
    const changedFile = path.join(changed.temporary, changed.entries[0].name);
    await fs.writeFile(changedFile, new Uint8Array(16384).fill(47));
    const changedHash = await hashFile(changedFile);
    await launch();
    assert.equal(await hashFile(changedFile), changedHash);
    assert.equal(await hashFile(untouched), untouchedHash);
    await assert.rejects(fs.stat(pendingChanged), { code: 'ENOENT' });
    await preserved();
    for (const entry of publishedHashes) assert.equal(await hashFile(path.join(published, entry.name)), entry.hash);
    result.checks.changedCompletedFileRetainsDirectory = 'passed';
    const warnings = await app.evaluate(() => globalThis.__recoveryWarnings);
    assert(warnings.some(warning => warning.detail.includes(changed.temporary)));
    result.checks.retentionWarningCalled = 'passed';
    result.preserved = {
        markerHash,
        untrackedHash,
        published,
        publishedHashes,
        foreign,
        foreignHash,
        changedFile,
        changedHash,
    };
    await stop(false);
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
        'Chooser, preset confirmation and warning responses substituted',
        'Controlled transport file contents; not wallpaper rendering or resource semantic validation',
        'Process-tree termination only; no power-loss guarantee or unacknowledged-write recovery claim',
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
