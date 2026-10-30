import { realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
    bundleIdentity,
    sameBundleFile,
    sameBundleObject,
    plainBundleIdentity,
    validBundleIdentity,
    hashBundleFile,
    type BundleIdentity,
} from './bundlePaths';
import { NativeFileError } from './nativeErrors';
import { NativeJournalStore } from './nativeJournalStore';

interface Entry {
    temporary: string;
    parent: BundleIdentity;
    file: BundleIdentity;
    sha256: string;
}
const validEntry = (entry: Entry) =>
    !!entry &&
    typeof entry.temporary === 'string' &&
    path.isAbsolute(entry.temporary) &&
    path.resolve(entry.temporary) === entry.temporary &&
    /^\.audiosurf-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.tmp$/.test(path.basename(entry.temporary)) &&
    validBundleIdentity(entry.parent) &&
    validBundleIdentity(entry.file) &&
    typeof entry.sha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(entry.sha256);
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** Main-process-only records of acknowledged, app-owned partial saves; never scans output directories. */
export class NativeSaveJournal {
    private readonly store: NativeJournalStore<Entry>;
    constructor(directory: string) {
        this.store = new NativeJournalStore(directory, validEntry);
    }
    async recover() {
        const loaded = await this.store.load();
        const removed: string[] = [],
            retained: string[] = [];
        if (!loaded.available) return { removed, retained, storeInvalid: true };
        for (const entry of this.store.entries) {
            try {
                const parent = path.dirname(entry.temporary);
                if (
                    (await realpath(parent)) !== parent ||
                    !sameBundleObject(await bundleIdentity(parent), entry.parent)
                )
                    throw Error('Parent changed');
                let actual;
                try {
                    actual = await bundleIdentity(entry.temporary);
                } catch (error) {
                    if (!missing(error)) throw error;
                }
                if (actual) {
                    if (
                        !actual.isFile() ||
                        !sameBundleFile(actual, entry.file) ||
                        (await hashBundleFile(entry.temporary)) !== entry.sha256
                    )
                        throw Error('Partial file changed');
                    if (
                        (await realpath(parent)) !== parent ||
                        !sameBundleObject(await bundleIdentity(parent), entry.parent) ||
                        !sameBundleFile(await bundleIdentity(entry.temporary), entry.file)
                    )
                        throw Error('Partial file changed');
                    await unlink(entry.temporary);
                    removed.push(entry.temporary);
                }
                await this.forget(entry.temporary);
            } catch {
                retained.push(entry.temporary);
            }
        }
        return { removed, retained, storeInvalid: loaded.damaged };
    }
    async checkpoint(
        temporary: string,
        parentIdentity: BundleIdentity,
        fileIdentity: BundleIdentity,
        size: number,
        sha256: string,
    ) {
        this.store.requireAvailable();
        const parent = path.dirname(temporary),
            actual = await bundleIdentity(temporary);
        if (
            (await realpath(parent)) !== parent ||
            !sameBundleObject(await bundleIdentity(parent), parentIdentity) ||
            !actual.isFile() ||
            !sameBundleObject(actual, fileIdentity) ||
            actual.size !== size
        )
            throw new NativeFileError('file-changed');
        await this.store.put({
            temporary,
            parent: plainBundleIdentity(parentIdentity),
            file: plainBundleIdentity(actual),
            sha256,
        });
    }
    async forget(temporary: string) {
        await this.store.remove(temporary);
    }
}
