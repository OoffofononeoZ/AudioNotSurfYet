import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { bundleIdentity, sameBundleFile, sameBundleObject, type BundleIdentity } from './bundlePaths';
import { NativeFileError } from './nativeErrors';

interface Entry {
    temporary: string;
    parent: BundleIdentity;
    file: BundleIdentity;
    sha256: string;
}
interface Snapshot {
    version: 1;
    sequence: number;
    entries: Entry[];
}
const fields = ['dev', 'ino', 'birthtimeMs', 'size', 'mtimeMs', 'ctimeMs'] as const;
const plainIdentity = (value: BundleIdentity): BundleIdentity =>
    Object.fromEntries(fields.map(key => [key, value[key]])) as unknown as BundleIdentity;
const isIdentity = (value: BundleIdentity) =>
    !!value && fields.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]) && value[key] >= 0);
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
function parse(input: string): Snapshot {
    const wrapper = JSON.parse(input);
    if (typeof wrapper.payload !== 'string' || digest(wrapper.payload) !== wrapper.sha256)
        throw Error('Invalid journal checksum');
    const value = JSON.parse(wrapper.payload) as Snapshot;
    if (
        value.version !== 1 ||
        !Number.isSafeInteger(value.sequence) ||
        value.sequence < 1 ||
        !Array.isArray(value.entries) ||
        new Set(value.entries.map(entry => entry.temporary)).size !== value.entries.length ||
        !value.entries.every(
            entry =>
                typeof entry.temporary === 'string' &&
                path.isAbsolute(entry.temporary) &&
                path.resolve(entry.temporary) === entry.temporary &&
                /^\.audiosurf-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.tmp$/.test(path.basename(entry.temporary)) &&
                isIdentity(entry.parent) &&
                isIdentity(entry.file) &&
                /^[a-f0-9]{64}$/.test(entry.sha256),
        )
    )
        throw Error('Invalid journal snapshot');
    return value;
}
async function hash(file: string) {
    const value = createHash('sha256');
    for await (const chunk of createReadStream(file)) value.update(chunk);
    return value.digest('hex');
}
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** Main-process-only records of acknowledged, app-owned partial saves; never scans output directories. */
export class NativeSaveJournal {
    private readonly directory: string;
    private entries = new Map<string, Entry>();
    private sequence = 0;
    private loaded = false;
    private chain: Promise<void> = Promise.resolve();
    constructor(directory: string) {
        this.directory = directory;
    }

    async recover() {
        if (this.loaded) throw Error('Journal already loaded');
        try {
            if (
                (await realpath(this.directory)) !== this.directory ||
                !(await bundleIdentity(this.directory)).isDirectory()
            )
                return { removed: [], retained: [], storeInvalid: true };
        } catch (error) {
            if (!missing(error)) return { removed: [], retained: [], storeInvalid: true };
            this.loaded = true;
            return { removed: [], retained: [], storeInvalid: false };
        }
        const snapshots: Snapshot[] = [];
        let damaged = false;
        for (const slot of [0, 1]) {
            const file = path.join(this.directory, `${slot}.json`);
            try {
                if (!(await bundleIdentity(file)).isFile()) throw Error('Invalid journal object');
                snapshots.push(parse(await readFile(file, 'utf8')));
            } catch (error) {
                if (!missing(error)) damaged = true;
            }
        }
        const latest = snapshots.sort((a, b) => b.sequence - a.sequence)[0];
        if (damaged && !latest) return { removed: [], retained: [], storeInvalid: true };
        this.loaded = true;
        this.sequence = latest?.sequence ?? 0;
        this.entries = new Map((latest?.entries ?? []).map(entry => [entry.temporary, entry]));
        const removed: string[] = [],
            retained: string[] = [];
        for (const entry of [...this.entries.values()]) {
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
                        (await hash(entry.temporary)) !== entry.sha256
                    )
                        throw Error('Partial file changed');
                    // Recheck after the streaming read. Never follows links or removes a published target.
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
        return { removed, retained, storeInvalid: damaged };
    }

    async checkpoint(
        temporary: string,
        parentIdentity: BundleIdentity,
        fileIdentity: BundleIdentity,
        size: number,
        sha256: string,
    ) {
        if (!this.loaded) throw new NativeFileError('store-invalid');
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
        const entry: Entry = { temporary, parent: plainIdentity(parentIdentity), file: plainIdentity(actual), sha256 };
        // Validate the same schema used after restart before persisting a path.
        const snapshot: Snapshot = { version: 1, sequence: 1, entries: [entry] };
        const payload = JSON.stringify(snapshot);
        parse(JSON.stringify({ payload, sha256: digest(payload) }));
        await this.change(() => this.entries.set(temporary, entry));
    }
    async forget(temporary: string) {
        if (!this.loaded) throw new NativeFileError('store-invalid');
        await this.change(() => this.entries.delete(temporary));
    }
    private change(update: () => unknown): Promise<void> {
        const work = this.chain.then(async () => {
            update();
            await mkdir(this.directory, { recursive: true });
            if ((await realpath(this.directory)) !== this.directory) throw new NativeFileError('store-invalid');
            const snapshot: Snapshot = { version: 1, sequence: ++this.sequence, entries: [...this.entries.values()] };
            const payload = JSON.stringify(snapshot);
            const bytes = JSON.stringify({ payload, sha256: digest(payload) }) + '\n';
            const slot = path.join(this.directory, `${snapshot.sequence % 2}.json`);
            let previous;
            try {
                previous = await bundleIdentity(slot);
            } catch (error) {
                if (!missing(error)) throw error;
            }
            // Two fixed slots avoid introducing untracked metadata temp files. Keep the other durable snapshot intact.
            const handle = await open(slot, previous ? 'r+' : 'wx', 0o600);
            try {
                const actual = await handle.stat();
                if (!actual.isFile() || (previous && !sameBundleObject(actual, previous)))
                    throw new NativeFileError('store-invalid');
                await handle.truncate(0);
                await handle.writeFile(bytes, 'utf8');
                await handle.sync();
            } finally {
                await handle.close();
            }
        });
        this.chain = work.catch(() => {});
        return work;
    }
}
