import { readdir, realpath, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { BundleEntry } from '../../src/platform/bundleContracts';
import {
    bundleEntries,
    bundleIdentity,
    hashBundleFile,
    plainBundleIdentity,
    sameBundleFile,
    sameBundleObject,
    validBundleIdentity,
    type BundleIdentity,
    type BundleKind,
} from './bundlePaths';
import { NativeJournalStore } from './nativeJournalStore';
import { NativeFileError } from './nativeErrors';

interface OwnedFile {
    name: string;
    identity: BundleIdentity;
    sha256: string;
}
interface Entry {
    temporary: string;
    parent: BundleIdentity;
    root: BundleIdentity;
    source?: BundleIdentity;
    kind: BundleKind;
    entries: BundleEntry[];
    files: OwnedFile[];
    cleaning: boolean;
}
export interface BundleCheckpoint {
    temporary: string;
    parentIdentity: BundleIdentity;
    identity: BundleIdentity;
    sourceIdentity?: BundleIdentity;
    entries: BundleEntry[];
    files: Map<string, BundleIdentity>;
    hashes: Map<string, string>;
}
function validEntry(entry: Entry) {
    try {
        if (
            !entry ||
            typeof entry.temporary !== 'string' ||
            !path.isAbsolute(entry.temporary) ||
            path.resolve(entry.temporary) !== entry.temporary ||
            !/^\.audiosurf-bundle-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.tmp$/.test(
                path.basename(entry.temporary),
            ) ||
            !validBundleIdentity(entry.parent) ||
            !validBundleIdentity(entry.root) ||
            typeof entry.cleaning !== 'boolean' ||
            !['preset', 'wallpaper'].includes(entry.kind) ||
            (entry.kind === 'preset' ? !validBundleIdentity(entry.source!) : entry.source !== undefined)
        )
            return false;
        const names = new Set(bundleEntries(entry.kind, entry.entries).map(file => file.name));
        return (
            Array.isArray(entry.files) &&
            new Set(entry.files.map(file => file.name)).size === entry.files.length &&
            entry.files.every(
                file =>
                    names.has(file.name) &&
                    validBundleIdentity(file.identity) &&
                    typeof file.sha256 === 'string' &&
                    /^[a-f0-9]{64}$/.test(file.sha256),
            )
        );
    } catch {
        return false;
    }
}
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
async function identityOrNull(file: string) {
    try {
        return await bundleIdentity(file);
    } catch (error) {
        if (missing(error)) return null;
        throw error;
    }
}
async function checkParent(entry: Entry) {
    const parent = path.dirname(entry.temporary);
    if ((await realpath(parent)) !== parent || !sameBundleObject(await bundleIdentity(parent), entry.parent))
        throw Error('Bundle parent changed');
}
async function checkRoot(entry: Entry) {
    await checkParent(entry);
    if ((await realpath(entry.temporary)) !== entry.temporary) throw Error('Bundle root redirected');
    const root = await bundleIdentity(entry.temporary);
    if (!root.isDirectory() || !sameBundleObject(root, entry.root)) throw Error('Bundle root changed');
    const source = entry.source ? await identityOrNull(path.join(entry.temporary, 'source')) : null;
    if (entry.source && (source ? !source.isDirectory() || !sameBundleObject(source, entry.source) : !entry.cleaning))
        throw Error('Bundle source changed');
    return source;
}

/** Only the recorded root and its declared, verified files may be removed; no recursive deletion. */
export class NativeBundleJournal {
    private readonly store: NativeJournalStore<Entry>;
    constructor(directory: string) {
        this.store = new NativeJournalStore(directory, validEntry);
    }
    async checkpoint(bundle: BundleCheckpoint) {
        this.store.requireAvailable();
        const entry: Entry = {
            temporary: bundle.temporary,
            parent: plainBundleIdentity(bundle.parentIdentity),
            root: plainBundleIdentity(bundle.identity),
            ...(bundle.sourceIdentity ? { source: plainBundleIdentity(bundle.sourceIdentity) } : {}),
            kind: bundle.sourceIdentity ? 'preset' : 'wallpaper',
            entries: bundle.entries.map(file => ({ ...file })),
            files: [...bundle.files].map(([name, identity]) => ({
                name,
                identity: plainBundleIdentity(identity),
                sha256: bundle.hashes.get(name)!,
            })),
            cleaning: false,
        };
        if (!validEntry(entry)) throw new NativeFileError('invalid-request');
        await checkRoot(entry);
        for (const file of entry.files)
            if (!sameBundleFile(await bundleIdentity(path.join(entry.temporary, file.name)), file.identity))
                throw new NativeFileError('file-changed');
        await this.store.put(entry);
    }
    async forget(temporary: string) {
        await this.store.remove(temporary);
    }
    private async clean(entry: Entry) {
        const source = await checkRoot(entry);
        const expectedRoot = new Set(entry.files.map(file => file.name.split('/')[0]!));
        if (entry.source) expectedRoot.add('source');
        const actualRoot = await readdir(entry.temporary);
        if (
            actualRoot.some(name => !expectedRoot.has(name)) ||
            (!entry.cleaning && actualRoot.length !== expectedRoot.size)
        )
            throw Error('Unexpected bundle contents');
        if (source) {
            const expectedSource = entry.files
                .filter(file => file.name.startsWith('source/'))
                .map(file => file.name.slice(7));
            const actualSource = await readdir(path.join(entry.temporary, 'source'));
            if (
                actualSource.some(name => !expectedSource.includes(name)) ||
                (!entry.cleaning && actualSource.length !== expectedSource.length)
            )
                throw Error('Unexpected bundle source contents');
        }
        // Verify every remaining file before removing any. Missing files are allowed only after durable cleanup intent.
        for (const file of entry.files) {
            const target = path.join(entry.temporary, file.name),
                actual = await identityOrNull(target);
            if (!actual && entry.cleaning) continue;
            if (
                !actual?.isFile() ||
                !sameBundleFile(actual, file.identity) ||
                (await hashBundleFile(target)) !== file.sha256 ||
                !sameBundleFile(await bundleIdentity(target), file.identity)
            )
                throw Error('Bundle file changed');
        }
        const cleaning = { ...entry, cleaning: true };
        if (!entry.cleaning) await this.store.put(cleaning);
        for (const file of [...entry.files].reverse()) {
            await checkRoot(cleaning);
            const target = path.join(entry.temporary, file.name),
                actual = await identityOrNull(target);
            if (!actual) continue;
            if (!sameBundleFile(actual, file.identity)) throw Error('Bundle file changed during cleanup');
            await unlink(target);
        }
        if (entry.source && (await identityOrNull(path.join(entry.temporary, 'source')))) {
            await checkRoot(cleaning);
            await rmdir(path.join(entry.temporary, 'source'));
        }
        await checkRoot(cleaning);
        await rmdir(entry.temporary);
    }
    async recover() {
        const loaded = await this.store.load();
        const removed: string[] = [],
            retained: string[] = [];
        if (!loaded.available) return { removed, retained, storeInvalid: true };
        for (const entry of this.store.entries) {
            try {
                await checkParent(entry);
                if (await identityOrNull(entry.temporary)) {
                    await this.clean(entry);
                    removed.push(entry.temporary);
                }
                await this.forget(entry.temporary);
            } catch {
                retained.push(entry.temporary);
            }
        }
        return { removed, retained, storeInvalid: loaded.damaged };
    }
}
