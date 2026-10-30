import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NativeSaveJournal } from '../../electron/files/nativeSaveJournal';
import { NativeSaves } from '../../electron/files/nativeSaves';

const base = path.resolve('test-results/native-save-journal');
let root: string, storage: string, outputs: string, journal: NativeSaveJournal;
const hash = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex');
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'case-'));
    storage = path.join(root, 'journal');
    outputs = path.join(root, 'outputs');
    await mkdir(outputs);
    journal = new NativeSaveJournal(storage);
    expect(await journal.recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});
afterEach(async () => {
    expect(path.dirname(await realpath(root))).toBe(await realpath(base));
    expect(path.basename(root)).toMatch(/^case-/);
    await rm(root, { recursive: true, force: true });
});
async function partial(text = 'partial') {
    const file = path.join(outputs, `.audiosurf-${randomUUID()}.tmp`);
    await writeFile(file, text, 'utf8');
    await journal.checkpoint(file, await lstat(outputs), await lstat(file), Buffer.byteLength(text), hash(text));
    return file;
}
const recover = () => new NativeSaveJournal(storage).recover();
async function rewriteSlot(slot: number, edit: (snapshot: any) => void) {
    const file = path.join(storage, `${slot}.json`);
    const wrapper = JSON.parse(await readFile(file, 'utf8'));
    const snapshot = JSON.parse(wrapper.payload);
    edit(snapshot);
    const payload = JSON.stringify(snapshot);
    await writeFile(file, JSON.stringify({ payload, sha256: hash(payload) }), 'utf8');
}

test('restart removes exactly a recorded unchanged partial and preserves target and untracked lookalikes', async () => {
    const target = path.join(outputs, 'existing.webm');
    const untracked = path.join(outputs, `.audiosurf-${randomUUID()}.tmp`);
    await writeFile(target, 'existing valid output', 'utf8');
    await writeFile(untracked, 'not recorded', 'utf8');
    const file = await partial();
    expect(await recover()).toEqual({ removed: [file], retained: [], storeInvalid: false });
    expect((await readdir(outputs)).sort()).toEqual([path.basename(untracked), path.basename(target)].sort());
    expect(await readFile(target, 'utf8')).toBe('existing valid output');
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});

test('normal manager commit and abort leave no pending journal records', async () => {
    const saves = new NativeSaves(journal);
    const target = path.join(outputs, 'saved.json');
    const committed = await saves.begin(target, 3);
    await saves.write(committed.saveId, new TextEncoder().encode('new'));
    await saves.commit(committed.saveId);
    const aborted = await saves.begin(path.join(outputs, 'cancelled.webm'), 100);
    await saves.write(aborted.saveId, new TextEncoder().encode('part'));
    await saves.abort(aborted.saveId);
    await saves.dispose();
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
    expect(await readdir(outputs)).toEqual(['saved.json']);
    expect(await readFile(target, 'utf8')).toBe('new');
});

test('changed bytes, replaced file objects and unrecorded final writes are retained', async () => {
    const edited = await partial('old');
    await writeFile(edited, 'new', 'utf8');
    const replaced = await partial();
    await rename(replaced, path.join(outputs, 'moved-by-user'));
    await writeFile(replaced, 'replacement', 'utf8');
    const inFlight = await partial('first');
    await writeFile(inFlight, 'first-unacknowledged-tail', 'utf8');
    expect(await recover()).toEqual({ removed: [], retained: [edited, replaced, inFlight], storeInvalid: false });
    expect(await readFile(edited, 'utf8')).toBe('new');
    expect(await readFile(replaced, 'utf8')).toBe('replacement');
    expect(await readFile(inFlight, 'utf8')).toBe('first-unacknowledged-tail');
});

test('a missing partial after publication only clears its record and never inspects or deletes the target', async () => {
    const file = await partial();
    const target = path.join(outputs, 'published.webm');
    await rename(file, target);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
    expect(await readFile(target, 'utf8')).toBe('partial');
});

test('replaced parent junctions cannot redirect restart deletion into another directory', async () => {
    const file = await partial();
    const original = path.join(root, 'original');
    const external = path.join(root, 'external');
    await rename(outputs, original);
    await mkdir(external);
    await writeFile(path.join(external, path.basename(file)), 'keep redirected file', 'utf8');
    await symlink(external, outputs, process.platform === 'win32' ? 'junction' : 'dir');
    expect(await recover()).toEqual({ removed: [], retained: [file], storeInvalid: false });
    expect(await readFile(path.join(external, path.basename(file)), 'utf8')).toBe('keep redirected file');
    expect(await readFile(path.join(original, path.basename(file)), 'utf8')).toBe('partial');
});

test('one interrupted metadata slot uses the older snapshot and retains a newer unmatched partial', async () => {
    const file = await partial('old');
    const original = await lstat(file);
    await writeFile(file, 'newer write', 'utf8');
    await journal.checkpoint(file, await lstat(outputs), original, 11, hash('newer write'));
    await writeFile(path.join(storage, '0.json'), '{partial', 'utf8');
    expect(await recover()).toEqual({ removed: [], retained: [file], storeInvalid: true });
    expect(await readFile(file, 'utf8')).toBe('newer write');
});

test('unsupported journal schemas cannot authorize output deletion or new saves', async () => {
    const file = await partial();
    await rewriteSlot(1, snapshot => {
        snapshot.version = 2;
    });
    const broken = new NativeSaveJournal(storage);
    expect(await broken.recover()).toEqual({ removed: [], retained: [], storeInvalid: true });
    const saves = new NativeSaves(broken);
    await expect(saves.begin(path.join(outputs, 'new.webm'), 20)).rejects.toMatchObject({ code: 'store-invalid' });
    await saves.dispose();
    expect(await readdir(outputs)).toEqual([path.basename(file)]);
});

test('a checksum mismatch disables recovery without deleting its recorded partial', async () => {
    const file = await partial();
    const slot = path.join(storage, '1.json');
    const wrapper = JSON.parse(await readFile(slot, 'utf8'));
    wrapper.sha256 = '0'.repeat(64);
    await writeFile(slot, JSON.stringify(wrapper), 'utf8');
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: true });
    expect(await readFile(file, 'utf8')).toBe('partial');
});

test('a junction replacing the journal directory cannot supply deletion authority', async () => {
    const file = await partial();
    const relocated = path.join(root, 'relocated-journal');
    await rename(storage, relocated);
    await symlink(relocated, storage, process.platform === 'win32' ? 'junction' : 'dir');
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: true });
    expect(await readFile(file, 'utf8')).toBe('partial');
});

test('a content digest mismatch retains a file even when all recorded stat fields still match', async () => {
    const file = await partial();
    await rewriteSlot(1, snapshot => {
        snapshot.entries[0].sha256 = '0'.repeat(64);
    });
    expect(await recover()).toEqual({ removed: [], retained: [file], storeInvalid: false });
    expect(await readFile(file, 'utf8')).toBe('partial');
});

test('concurrent checkpoint requests remain serialized and both acknowledged files recover', async () => {
    const files = await Promise.all([partial('first'), partial('second')]);
    const recovered = await recover();
    expect(recovered.removed.sort()).toEqual(files.sort());
    expect(recovered.retained).toEqual([]);
    expect(await readdir(outputs)).toEqual([]);
});

test('cancellation during initial checkpoint waits and leaves no resurrected record', async () => {
    const original = journal.checkpoint.bind(journal);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    const checkpoint = new Promise<void>(resolve => {
        entered = resolve;
    });
    vi.spyOn(journal, 'checkpoint').mockImplementationOnce(async (...args) => {
        entered();
        await held;
        await original(...args);
    });
    const saves = new NativeSaves(journal);
    const beginning = saves.begin(path.join(outputs, 'cancelled.webm'), 10);
    const rejected = expect(beginning).rejects.toThrow();
    await checkpoint;
    const cancellation = saves.abortAll();
    release();
    await rejected;
    await cancellation;
    await saves.dispose();
    expect(await readdir(outputs)).toEqual([]);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});

test('cancellation waits for an in-flight write checkpoint before deleting its temporary', async () => {
    const saves = new NativeSaves(journal);
    const save = await saves.begin(path.join(outputs, 'cancelled.webm'), 10);
    const original = journal.checkpoint.bind(journal);
    let release!: () => void, entered!: () => void;
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    const checkpoint = new Promise<void>(resolve => {
        entered = resolve;
    });
    vi.spyOn(journal, 'checkpoint').mockImplementationOnce(async (...args) => {
        await original(...args);
        entered();
        await held;
    });
    const writing = saves.write(save.saveId, new TextEncoder().encode('part'));
    const rejected = expect(writing).rejects.toMatchObject({ code: 'invalid-request' });
    await checkpoint;
    const cancellation = saves.abortAll();
    expect(await readdir(outputs)).toHaveLength(1);
    release();
    await rejected;
    await cancellation;
    await saves.dispose();
    expect(await readdir(outputs)).toEqual([]);
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});

test('a failed durable checkpoint rejects the write and preserves an existing valid target', async () => {
    const target = path.join(outputs, 'existing.webm');
    await writeFile(target, 'valid output', 'utf8');
    const saves = new NativeSaves(journal);
    const save = await saves.begin(target, 100);
    vi.spyOn(journal, 'checkpoint').mockRejectedValueOnce(new Error('Controlled journal write failure'));
    await expect(saves.write(save.saveId, new TextEncoder().encode('part'))).rejects.toMatchObject({
        code: 'io-error',
    });
    await saves.dispose();
    expect(await readdir(outputs)).toEqual(['existing.webm']);
    expect(await readFile(target, 'utf8')).toBe('valid output');
    expect(await recover()).toEqual({ removed: [], retained: [], storeInvalid: false });
});
