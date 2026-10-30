import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { hashFile } from '../../scripts/lib/desktop-native-runtime.mjs';

/** Only explicit, test-owned FT profiles with verified cold-download WAVs. */
export async function verifiedFtProfile(root, resultFile) {
    const sourceResult = await fs.realpath(path.resolve(root, resultFile));
    const resultRoot = await fs.realpath(path.join(root, 'artifacts/desktop/ft'));
    const relative = path.relative(resultRoot, sourceResult);
    assert(/^ft-[a-f0-9-]{36}[\\/]result\.json$/.test(relative), 'Only prior FT test results may supply a profile');
    const previous = JSON.parse(await fs.readFile(sourceResult, 'utf8'));
    assert.equal(previous.checks.realDownloadFourModelsAndWavs, 'passed');
    const nativeDirectory = path.join(
        await fs.realpath(process.env.LOCALAPPDATA),
        'AudioNotSurfYet-LocalRuntime',
        path.dirname(relative),
    );
    assert.equal(await fs.realpath(previous.nativeDirectory), nativeDirectory);
    assert.equal(previous.exports.length, 4);
    assert.equal(previous.restoredExports.length, 4);
    for (const file of [...previous.exports, ...previous.restoredExports]) {
        assert.equal(path.dirname(await fs.realpath(file.file)), nativeDirectory);
        assert.equal(await hashFile(file.file), file.sha256, 'Prior FT WAV changed');
    }
    return { sourceResult, nativeDirectory, profile: await fs.realpath(path.join(nativeDirectory, 'profile')) };
}

export async function databaseRows(page, database, version, store, keys = false) {
    return page.evaluate(
        async ({ database, version, store, keys }) => {
            const db = await new Promise((resolve, reject) => {
                const request = indexedDB.open(database, version);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            try {
                return await new Promise((resolve, reject) => {
                    const objectStore = db.transaction(store).objectStore(store);
                    const request = keys ? objectStore.getAllKeys() : objectStore.getAll();
                    request.onsuccess = () => resolve(request.result);
                    request.onerror = () => reject(request.error);
                });
            } finally {
                db.close();
            }
        },
        { database, version, store, keys },
    );
}
