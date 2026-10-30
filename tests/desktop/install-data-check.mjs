import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { _electron, expect } from '@playwright/test';
import { installDialogFixture, queueSave } from './dialog-fixture.mjs';
import { databaseRows } from './processing-support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const write = (file, value) => fs.writeFile(file, JSON.stringify(value, null, 4) + '\n', 'utf8');
/** Real installed EXE and isolated retained profile, with only OS save answers substituted. */
export async function checkInstalledData({ executable, profile, output, version, temp, infer = false, baseline }) {
    const fixture = path.join(output, 'model-fixture.mjs');
    await build({
        entryPoints: [path.join(root, 'tests/desktop/processing-fixture.ts')],
        outfile: fixture,
        bundle: true,
        platform: 'node',
        format: 'esm',
    });
    const { FT_MODELS, TRANSCRIPTION_MODELS } = await import(pathToFileURL(fixture));
    const models = [...FT_MODELS, ...TRANSCRIPTION_MODELS].map(model => ({
        id: model.id ?? model.role,
        bytes: model.bytes,
        sha256: model.sha256,
    }));
    assert.equal(models.length, 8);
    const env = { ...process.env, AUDIOSURF_DESKTOP_TEST_PROFILE: profile, TEMP: temp, TMP: temp };
    delete env.ELECTRON_RUN_AS_NODE;
    const result = { status: 'running', version, blockedRequests: [], pageErrors: [], checks: {} };
    let app, page;
    async function workspace(name) {
        await page.getByTestId(`editor-${name}-tab`).click();
        const entry = page.getByTestId(`editor-${name}-continue`);
        if (await entry.isVisible()) await entry.click();
    }
    async function exported(label) {
        const file = path.join(output, `${version}-${label}-editor.json`);
        await queueSave(app, file);
        await page.getByTestId('export-editor-project').click();
        await expect
            .poll(() =>
                fs
                    .stat(file)
                    .then(stat => stat.size)
                    .catch(() => 0),
            )
            .toBeGreaterThan(0);
        const project = JSON.parse(await fs.readFile(file, 'utf8'));
        assert.equal(project.schemaVersion, 2);
        return project;
    }
    async function complete(testId, button, phaseName) {
        await page.getByTestId(button).click();
        await expect(page.getByTestId(testId)).toHaveAttribute('data-state', 'running');
        let previous;
        await expect
            .poll(
                async () => {
                    const state = await page.getByTestId(testId).getAttribute('data-state');
                    const phase = await page
                        .getByTestId(testId)
                        .locator('strong')
                        .first()
                        .textContent({ timeout: 500 })
                        .catch(() => '');
                    const key = `${state}:${phase}`;
                    if (key !== previous) {
                        console.log(`Installed ${version} ${phaseName}: ${key}`);
                        previous = key;
                    }
                    return state;
                },
                { timeout: 900000, intervals: [1000, 2000, 3000] },
            )
            .toMatch(/^(ready|partial|error|cancelled)$/);
        await expect(page.getByTestId(testId)).toHaveAttribute('data-state', 'ready');
        await expect
            .poll(
                () => page.workers().filter(worker => /(?:separation|transcription)\.worker/.test(worker.url())).length,
            )
            .toBe(0);
    }
    try {
        app = await _electron.launch({
            executablePath: executable,
            args: [`--user-data-dir=${profile}`],
            cwd: root,
            env,
            timeout: 30000,
        });
        await installDialogFixture(app);
        await app.context().route(/^https?:\/\//, route => {
            result.blockedRequests.push(route.request().url().split('?')[0]);
            return route.abort('internetdisconnected');
        });
        await app.context().setOffline(true);
        page = await app.firstWindow();
        page.on('pageerror', error => result.pageErrors.push(error.message));
        await page.waitForSelector('#main-layout');
        result.identity = await app.evaluate(({ app, BrowserWindow }) => {
            const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
            return {
                version: app.getVersion(),
                executable: process.execPath,
                userData: app.getPath('userData'),
                sandbox: preferences.sandbox,
                contextIsolation: preferences.contextIsolation,
                nodeIntegration: preferences.nodeIntegration,
            };
        });
        assert.equal(result.identity.version, version);
        assert.equal(result.identity.executable, executable);
        assert.equal(result.identity.userData, profile);
        assert.equal(result.identity.sandbox, true);
        assert.equal(result.identity.contextIsolation, true);
        assert.equal(result.identity.nodeIntegration, false);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
        await page.getByTestId('header-editor-link').click();
        await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 60000 });
        const project = await exported('before');
        assert(
            project.lanes.length > 1 && project.lanes[0].events.length > 0,
            'Verified manual and applied lanes did not restore',
        );
        await workspace('separation');
        await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
        await workspace('transcription');
        await expect(page.getByTestId('editor-transcription')).toHaveAttribute('data-state', 'ready', {
            timeout: 60000,
        });
        const ft = await databaseRows(page, 'processing-p1', 2, 'editor-results');
        const transcription = await databaseRows(page, 'editor-transcriptions', 1, 'results');
        assert(ft.length > 0 && transcription.length > 0);
        result.modelDigests = [];
        for (const model of models) {
            const checked = await page.evaluate(async model => {
                const db = await new Promise((resolve, reject) => {
                    const opening = indexedDB.open('processing-p1', 2);
                    opening.onsuccess = () => resolve(opening.result);
                    opening.onerror = () => reject(opening.error);
                });
                try {
                    const blob = await new Promise((resolve, reject) => {
                        const read = db.transaction('models').objectStore('models').get(model.sha256);
                        read.onsuccess = () => resolve(read.result);
                        read.onerror = () => reject(read.error);
                    });
                    if (!(blob instanceof Blob)) throw Error('Cached model missing');
                    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
                    return {
                        id: model.id,
                        bytes: blob.size,
                        sha256: Array.from(hash, value => value.toString(16).padStart(2, '0')).join(''),
                    };
                } finally {
                    db.close();
                }
            }, model);
            assert.deepEqual(checked, model);
            result.modelDigests.push(checked);
            console.log(`Installed ${version}: cached model ${model.id} verified`);
        }
        const manifests = [
            ...ft.map(record => ({ directory: record.result.source.directory, files: record.files })),
            ...transcription.map(record => ({ directory: record.bundle.result.id, files: record.files })),
        ].sort((a, b) => a.directory.localeCompare(b.directory));
        result.fileDigests = await page.evaluate(async manifests => {
            const processing = await (await navigator.storage.getDirectory()).getDirectoryHandle('processing-p1');
            const files = [];
            for (const record of manifests) {
                const directory = await processing.getDirectoryHandle(record.directory);
                for (const expected of record.files) {
                    const file = await (await directory.getFileHandle(expected.name)).getFile();
                    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
                    const sha256 = Array.from(hash, value => value.toString(16).padStart(2, '0')).join('');
                    if (file.size !== expected.bytes || sha256 !== expected.sha256)
                        throw Error('Stored audio file digest mismatch');
                    files.push({ directory: record.directory, name: expected.name, bytes: file.size, sha256 });
                }
            }
            return files;
        }, manifests);
        const snapshot = { project, ft, transcription, models: result.modelDigests, files: result.fileDigests };
        await write(path.join(output, `${version}-domain-snapshot.json`), snapshot);
        if (baseline) assert.deepEqual(snapshot, baseline, 'Installed upgrade changed retained domain data');
        result.checks.retainedProjectModelsCandidatesAndAudio = 'passed';
        if (infer) {
            await workspace('separation');
            await complete('editor-separation', 'editor-separate-start', 'FT');
            await workspace('transcription');
            await complete('editor-transcription', 'transcription-start', 'transcription');
            const latest = (await databaseRows(page, 'editor-transcriptions', 1, 'results')).sort(
                (a, b) => b.createdAt - a.createdAt,
            )[0];
            assert.deepEqual([...latest.bundle.result.completedRoles].sort(), [
                'bass',
                'drums',
                'guitar',
                'piano',
                'vocals',
            ]);
            assert.deepEqual(latest.bundle.result.failures, []);
            assert(latest.bundle.result.candidates.length > 0);
            assert.deepEqual(
                await exported('after-inference'),
                project,
                'Inference changed the user project without applying candidates',
            );
            result.checks.offlineFtAndFiveRoleInference = 'passed';
        }
        await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
        await page.evaluate(async () => {
            await document.fonts.ready;
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        await page.screenshot({ path: path.join(output, `${version}-retained-data.png`) });
        assert.deepEqual(result.blockedRequests, []);
        assert.deepEqual(result.pageErrors, []);
        result.status = 'passed';
        return { snapshot, summary: result };
    } catch (error) {
        result.status = 'failed';
        result.error = String(error);
        result.stack = error.stack;
        result.body = await page
            ?.locator('body')
            .innerText({ timeout: 5000 })
            .catch(() => '');
        throw error;
    } finally {
        try {
            await app?.close();
        } catch (error) {
            result.status = 'failed';
            result.cleanupError = String(error);
            throw error;
        } finally {
            await write(path.join(output, `${version}-data-check.json`), result);
        }
    }
}
