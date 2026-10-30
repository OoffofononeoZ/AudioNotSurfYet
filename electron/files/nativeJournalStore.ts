import { createHash } from 'node:crypto';
import { mkdir, open, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { bundleIdentity, sameBundleObject } from './bundlePaths';
import { NativeFileError } from './nativeErrors';

interface Snapshot<T> {
    version: 1;
    sequence: number;
    entries: T[];
}
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** Durable same-version snapshots. The other slot survives an interrupted metadata write. */
export class NativeJournalStore<T extends { temporary: string }> {
    private readonly directory: string;
    private readonly validEntry: (entry: T) => boolean;
    private records = new Map<string, T>();
    private sequence = 0;
    private loaded = false;
    private chain: Promise<void> = Promise.resolve();
    constructor(directory: string, validEntry: (entry: T) => boolean) {
        this.directory = directory;
        this.validEntry = validEntry;
    }
    private parse(input: string): Snapshot<T> {
        const wrapper = JSON.parse(input);
        if (typeof wrapper.payload !== 'string' || digest(wrapper.payload) !== wrapper.sha256)
            throw Error('Invalid journal checksum');
        const value = JSON.parse(wrapper.payload) as Snapshot<T>;
        if (
            value.version !== 1 ||
            !Number.isSafeInteger(value.sequence) ||
            value.sequence < 1 ||
            !Array.isArray(value.entries) ||
            !value.entries.every(entry => this.validEntry(entry)) ||
            new Set(value.entries.map(entry => entry.temporary)).size !== value.entries.length
        )
            throw Error('Invalid journal snapshot');
        return value;
    }
    get entries(): T[] {
        return [...this.records.values()];
    }
    requireAvailable() {
        if (!this.loaded) throw new NativeFileError('store-invalid');
    }
    async load() {
        if (this.loaded) throw Error('Journal already loaded');
        try {
            if (
                (await realpath(this.directory)) !== this.directory ||
                !(await bundleIdentity(this.directory)).isDirectory()
            )
                return { available: false, damaged: true };
        } catch (error) {
            if (!missing(error)) return { available: false, damaged: true };
            this.loaded = true;
            return { available: true, damaged: false };
        }
        const snapshots: Snapshot<T>[] = [];
        let damaged = false;
        for (const slot of [0, 1]) {
            try {
                const file = path.join(this.directory, `${slot}.json`);
                if (!(await bundleIdentity(file)).isFile()) throw Error('Invalid journal object');
                snapshots.push(this.parse(await readFile(file, 'utf8')));
            } catch (error) {
                if (!missing(error)) damaged = true;
            }
        }
        const latest = snapshots.sort((a, b) => b.sequence - a.sequence)[0];
        if (damaged && !latest) return { available: false, damaged: true };
        this.loaded = true;
        this.sequence = latest?.sequence ?? 0;
        this.records = new Map((latest?.entries ?? []).map(entry => [entry.temporary, entry]));
        return { available: true, damaged };
    }
    async put(entry: T) {
        this.requireAvailable();
        if (!this.validEntry(entry)) throw new NativeFileError('invalid-request');
        await this.change(() => this.records.set(entry.temporary, entry));
    }
    async remove(temporary: string) {
        this.requireAvailable();
        await this.change(() => this.records.delete(temporary));
    }
    private change(update: () => unknown): Promise<void> {
        const work = this.chain.then(async () => {
            update();
            await mkdir(this.directory, { recursive: true });
            if ((await realpath(this.directory)) !== this.directory) throw new NativeFileError('store-invalid');
            const snapshot: Snapshot<T> = { version: 1, sequence: ++this.sequence, entries: this.entries };
            const payload = JSON.stringify(snapshot),
                bytes = JSON.stringify({ payload, sha256: digest(payload) }) + '\n';
            const slot = path.join(this.directory, `${snapshot.sequence % 2}.json`);
            let previous;
            try {
                previous = await bundleIdentity(slot);
            } catch (error) {
                if (!missing(error)) throw error;
            }
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
