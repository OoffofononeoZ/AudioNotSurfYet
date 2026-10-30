import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import {
    lstat,
    mkdir,
    mkdtemp,
    readFile,
    readdir,
    realpath,
    rename,
    rm,
    rmdir,
    symlink,
    unlink,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { NativeBundleJournal, type BundleCheckpoint } from '../../electron/files/nativeBundleJournal';
import { NativeSaveJournal } from '../../electron/files/nativeSaveJournal';
import { NativeBundles } from '../../electron/files/nativeBundles';
import type { BundleKind } from '../../electron/files/bundlePaths';

const base = path.resolve('test-results/native-bundle-journal');
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
const manifest = (kind: BundleKind) =>
    (kind === 'preset'
        ? ['source/resource.json', 'resource-package.json', 'preview.png', 'resource-info.json']
        : ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json']
    ).map(name => ({ name, size: 3 }));
let root: string, storage: string, outputs: string, journal: NativeBundleJournal, fileJournal: NativeSaveJournal;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'case-'));
    outputs = path.join(root, 'outputs');
    storage = path.join(root, 'journal');
    await mkdir(outputs);
    journal = new NativeBundleJournal(storage);
    fileJournal = new NativeSaveJournal(path.join(root, 'files'));
    await journal.recover();
    await fileJournal.recover();
});
afterEach(async () => {
    vi.restoreAllMocks();
    expect(path.dirname(await realpath(root))).toBe(await realpath(base));
    expect(path.basename(root)).toMatch(/^case-/);
    await rm(root, { recursive: true, force: true });
});
async function partial(kind: BundleKind = 'preset'): Promise<BundleCheckpoint> {
    const temporary = path.join(outputs, `.audiosurf-bundle-${randomUUID()}.tmp`);
    await mkdir(temporary);
    let sourceIdentity;
    if (kind === 'preset') {
        await mkdir(path.join(temporary, 'source'));
        sourceIdentity = await lstat(path.join(temporary, 'source'));
    }
    const entry: BundleCheckpoint = {
        temporary,
        parentIdentity: await lstat(outputs),
        identity: await lstat(temporary),
        sourceIdentity,
        entries: manifest(kind),
        files: new Map(),
        hashes: new Map(),
    };
    for (const file of entry.entries.slice(0, 2)) {
        await writeFile(path.join(temporary, file.name), 'abc', 'utf8');
        entry.files.set(file.name, await lstat(path.join(temporary, file.name)));
        entry.hashes.set(file.name, hash('abc'));
    }
    await journal.checkpoint(entry);
    return entry;
}
const recover = () => new NativeBundleJournal(storage).recover();
async function rewriteLatest(edit: (entry: any) => void) {
    const slots = await Promise.all(
        (await readdir(storage)).map(async name => ({
            name,
            wrapper: JSON.parse(await readFile(path.join(storage, name), 'utf8')),
        })),
    );
    const latest = slots.sort(
        (a, b) => JSON.parse(b.wrapper.payload).sequence - JSON.parse(a.wrapper.payload).sequence,
    )[0]!;
    const snapshot = JSON.parse(latest.wrapper.payload);
    edit(snapshot.entries[0]);
    const payload = JSON.stringify(snapshot);
    await writeFile(path.join(storage, latest.name), JSON.stringify({ payload, sha256: hash(payload) }), 'utf8');
}

for (const kind of ['preset', 'wallpaper'] as const)
    test(`restart cleans exactly the recorded partial ${kind} tree`, async () => {
        const entry = await partial(kind);
        const untracked = path.join(outputs, `.audiosurf-bundle-${randomUUID()}.tmp`);
        await mkdir(untracked);
        await writeFile(path.join(untracked, 'user.txt'), 'keep', 'utf8');
        expect(await recover()).toEqual({ removed: [entry.temporary], retained: [], storeInvalid: false });
        expect(await readdir(outputs)).toEqual([path.basename(untracked)]);
        expect(await readFile(path.join(untracked, 'user.txt'), 'utf8')).toBe('keep');
    });

test('active partial files recover first, then completed bundle files and the owned root', async () => {
    const entry = await partial();
    const pending = path.join(entry.temporary, `.audiosurf-${randomUUID()}.tmp`);
    await writeFile(pending, 'part', 'utf8');
    await fileJournal.checkpoint(pending, await lstat(entry.temporary), await lstat(pending), 4, hash('part'));
    expect(await new NativeSaveJournal(path.join(root, 'files')).recover()).toMatchObject({
        removed: [pending],
        retained: [],
    });
    expect(await recover()).toEqual({ removed: [entry.temporary], retained: [], storeInvalid: false });
});

for (const addition of ['foreign.txt', 'source/foreign.txt'])
    test(`external addition ${addition} retains the entire tree`, async () => {
        const entry = await partial();
        await writeFile(path.join(entry.temporary, addition), 'external', 'utf8');
        expect(await recover()).toEqual({ removed: [], retained: [entry.temporary], storeInvalid: false });
        for (const file of entry.files.keys())
            expect(await readFile(path.join(entry.temporary, file), 'utf8')).toBe('abc');
        expect(await readFile(path.join(entry.temporary, addition), 'utf8')).toBe('external');
    });

test('changed or missing completed files cannot authorize deleting the other owned files', async () => {
    const edited = await partial();
    await writeFile(path.join(edited.temporary, 'resource-package.json'), 'new', 'utf8');
    const absent = await partial();
    await unlink(path.join(absent.temporary, 'resource-package.json'));
    expect(await recover()).toEqual({
        removed: [],
        retained: [edited.temporary, absent.temporary],
        storeInvalid: false,
    });
    expect(await readFile(path.join(edited.temporary, 'source/resource.json'), 'utf8')).toBe('abc');
    expect(await readFile(path.join(absent.temporary, 'source/resource.json'), 'utf8')).toBe('abc');
});

test('a changed digest retains the tree even when the file identity and stat fields match', async () => {
    const entry = await partial();
    await rewriteLatest(record => {
        record.files[0].sha256 = '0'.repeat(64);
    });
    expect(await recover()).toEqual({ removed: [], retained: [entry.temporary], storeInvalid: false });
    expect(await readFile(path.join(entry.temporary, 'source/resource.json'), 'utf8')).toBe('abc');
});

test('source junction replacement never grants deletion in its target', async () => {
    const entry = await partial();
    const source = path.join(entry.temporary, 'source'),
        external = path.join(root, 'external');
    await rename(source, external);
    await symlink(external, source, process.platform === 'win32' ? 'junction' : 'dir');
    expect(await recover()).toEqual({ removed: [], retained: [entry.temporary], storeInvalid: false });
    expect(await readFile(path.join(external, 'resource.json'), 'utf8')).toBe('abc');
});

test('replacing the recorded root with a junction preserves both trees', async () => {
    const entry = await partial();
    const external = path.join(root, 'external-tree');
    await rename(entry.temporary, external);
    await symlink(external, entry.temporary, process.platform === 'win32' ? 'junction' : 'dir');
    expect(await recover()).toEqual({ removed: [], retained: [entry.temporary], storeInvalid: false });
    expect(await readFile(path.join(external, 'source/resource.json'), 'utf8')).toBe('abc');
});

test('a replaced parent cannot redirect recovery into its new target', async () => {
    const entry = await partial();
    const original = path.join(root, 'original-outputs');
    await rename(outputs, original);
    await symlink(original, outputs, process.platform === 'win32' ? 'junction' : 'dir');
    expect(await recover()).toEqual({ removed: [], retained: [entry.temporary], storeInvalid: false });
    expect(await readFile(path.join(original, path.basename(entry.temporary), 'source/resource.json'), 'utf8')).toBe(
        'abc',
    );
});

test('a durable cleanup intent permits restart after an owned file and source directory were already removed', async () => {
    const entry = await partial();
    await rewriteLatest(record => {
        record.cleaning = true;
    });
    await unlink(path.join(entry.temporary, 'source/resource.json'));
    await rmdir(path.join(entry.temporary, 'source'));
    expect(await recover()).toEqual({ removed: [entry.temporary], retained: [], storeInvalid: false });
    expect(await readdir(outputs)).toEqual([]);
});

test('publication only drops the missing temporary record and preserves the renamed directory', async () => {
    const entry = await partial();
    const target = path.join(outputs, 'published');
    await rename(entry.temporary, target);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
    expect(await readFile(path.join(target, 'source/resource.json'), 'utf8')).toBe('abc');
});

test('real managers publish or cancel without leaving directory or child-file records', async () => {
    const bundles = new NativeBundles(journal, fileJournal);
    const entries = manifest('wallpaper');
    const complete = await bundles.begin(outputs, `audiosurf-${randomUUID()}`, 'wallpaper', entries);
    for (const _entry of entries) {
        await bundles.beginFile(complete.bundleId);
        await bundles.writeFile(complete.bundleId, new TextEncoder().encode('abc'));
        await bundles.closeFile(complete.bundleId);
    }
    await bundles.commit(complete.bundleId);
    const cancelled = await bundles.begin(outputs, `audiosurf-${randomUUID()}`, 'wallpaper', entries);
    await bundles.beginFile(cancelled.bundleId);
    await bundles.writeFile(cancelled.bundleId, new TextEncoder().encode('ab'));
    await bundles.abort(cancelled.bundleId);
    await bundles.dispose();
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
    expect(await new NativeSaveJournal(path.join(root, 'files')).recover()).toMatchObject({
        removed: [],
        retained: [],
    });
    expect(await readdir(outputs)).toEqual([complete.folderName]);
});

test('a failed close-file checkpoint cleans the newly published child and retains no final target', async () => {
    const bundles = new NativeBundles(journal, fileJournal);
    const bundle = await bundles.begin(outputs, `audiosurf-${randomUUID()}`, 'wallpaper', manifest('wallpaper'));
    await bundles.beginFile(bundle.bundleId);
    await bundles.writeFile(bundle.bundleId, new TextEncoder().encode('abc'));
    vi.spyOn(journal, 'checkpoint').mockRejectedValueOnce(new Error('Controlled checkpoint failure'));
    await expect(bundles.closeFile(bundle.bundleId)).rejects.toThrow('Controlled checkpoint failure');
    await bundles.dispose();
    expect(await readdir(outputs)).toEqual([]);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});

test('cancellation waits for initial directory checkpoint and does not leave a late record', async () => {
    const original = journal.checkpoint.bind(journal);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    const checkpoint = new Promise<void>(resolve => {
        entered = resolve;
    });
    vi.spyOn(journal, 'checkpoint').mockImplementationOnce(async entry => {
        entered();
        await held;
        await original(entry);
    });
    const bundles = new NativeBundles(journal, fileJournal);
    const beginning = bundles.begin(outputs, `audiosurf-${randomUUID()}`, 'wallpaper', manifest('wallpaper'));
    const rejected = expect(beginning).rejects.toMatchObject({ code: 'invalid-request' });
    await checkpoint;
    const cancellation = bundles.abortAll();
    release();
    await rejected;
    await cancellation;
    await bundles.dispose();
    expect(await readdir(outputs)).toEqual([]);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});

test('invalid manifests in a damaged snapshot preserve all existing output objects', async () => {
    const entry = await partial();
    await rewriteLatest(record => {
        record.entries[0].name = '../outside.json';
    });
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: true });
    expect(await readFile(path.join(entry.temporary, 'source/resource.json'), 'utf8')).toBe('abc');
});
