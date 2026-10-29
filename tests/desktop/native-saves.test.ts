import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NativeSaves } from '../../electron/files/nativeSaves';
import { SAVE_CHUNK_BYTES } from '../../src/platform/transferContracts';

const base = path.resolve('test-results/native-saves');
let root: string, saves: NativeSaves;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'save-'));
    saves = new NativeSaves();
});
afterEach(async () => {
    await saves.dispose();
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^save-/);
    await rm(root, { recursive: true, force: true });
});
const bytes = (text: string) => new TextEncoder().encode(text);

test('keeps the selected file intact until complete publication and returns only an opaque save reference', async () => {
    const target = path.join(root, '工程.audiosurf-editor.json');
    await writeFile(target, 'old project', 'utf8');
    const reference = await saves.begin(target, 6);
    expect(JSON.stringify(reference)).not.toContain(root);
    await saves.write(reference.saveId, bytes('new'));
    expect(await readFile(target, 'utf8')).toBe('old project');
    await saves.write(reference.saveId, bytes('123'));
    expect(await readFile(target, 'utf8')).toBe('old project');
    await saves.commit(reference.saveId);
    expect(await readFile(target, 'utf8')).toBe('new123');
    expect(await readdir(root)).toEqual([path.basename(target)]);
    await expect(saves.commit(reference.saveId)).rejects.toMatchObject({ code: 'invalid-request' });
});

test('cancel and disposal remove only owned temporary files and preserve existing user files', async () => {
    const target = path.join(root, 'existing.webm');
    await writeFile(target, 'keep me', 'utf8');
    const first = await saves.begin(target, 100);
    const second = await saves.begin(path.join(root, 'new.wav'), 100);
    await saves.write(first.saveId, bytes('partial'));
    await saves.write(second.saveId, bytes('partial'));
    await saves.abort(first.saveId);
    await saves.abort(first.saveId);
    await saves.dispose();
    expect(await readFile(target, 'utf8')).toBe('keep me');
    expect(await readdir(root)).toEqual(['existing.webm']);
    await expect(saves.begin(path.join(root, 'later.json'), 0)).rejects.toMatchObject({ code: 'invalid-request' });
});

test('rejects incomplete, oversized, malformed and concurrent writes without publishing partial bytes', async () => {
    const target = path.join(root, 'output.webm');
    const reference = await saves.begin(target, SAVE_CHUNK_BYTES);
    for (const input of [new Uint8Array(), new Uint8Array(SAVE_CHUNK_BYTES + 1), 'bytes'])
        await expect(saves.write(reference.saveId, input)).rejects.toMatchObject({ code: 'invalid-request' });
    await expect(saves.commit(reference.saveId)).rejects.toMatchObject({ code: 'invalid-request' });
    const writing = saves.write(reference.saveId, new Uint8Array(SAVE_CHUNK_BYTES));
    await expect(saves.write(reference.saveId, bytes('extra'))).rejects.toMatchObject({ code: 'invalid-request' });
    await writing;
    await saves.commit(reference.saveId);
    expect((await readFile(target)).byteLength).toBe(SAVE_CHUNK_BYTES);
    await expect(saves.abort('../path')).rejects.toMatchObject({ code: 'invalid-request' });
});

test('external changes to the target during save are preserved instead of overwritten', async () => {
    const target = path.join(root, 'project.json');
    await writeFile(target, 'original', 'utf8');
    const reference = await saves.begin(target, 3);
    await saves.write(reference.saveId, bytes('new'));
    await writeFile(target, 'external edit', 'utf8');
    await expect(saves.commit(reference.saveId)).rejects.toMatchObject({ code: 'file-changed' });
    expect(await readFile(target, 'utf8')).toBe('external edit');
    expect(await readdir(root)).toEqual(['project.json']);
});

test('newly appearing files and links never acquire overwrite permission from an older selection', async () => {
    const target = path.join(root, 'output.json');
    const reference = await saves.begin(target, 3);
    await saves.write(reference.saveId, bytes('new'));
    await writeFile(target, 'created elsewhere', 'utf8');
    await expect(saves.commit(reference.saveId)).rejects.toMatchObject({ code: 'file-changed' });
    const directory = path.join(root, 'protected');
    await mkdir(directory);
    const link = path.join(root, 'alias');
    await symlink(directory, link, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(saves.begin(link, 3)).rejects.toMatchObject({ code: 'permission-denied' });
    expect(await readFile(target, 'utf8')).toBe('created elsewhere');
});

test('missing temporary output fails safely and aborting an in-flight write cannot publish it', async () => {
    const target = path.join(root, 'result.webm');
    await writeFile(target, 'valid old output', 'utf8');
    const missing = await saves.begin(target, 3);
    await saves.write(missing.saveId, bytes('new'));
    await unlink(path.join(root, `.audiosurf-${missing.saveId}.tmp`));
    await expect(saves.commit(missing.saveId)).rejects.toMatchObject({ code: 'permission-denied' });
    const current = await saves.begin(target, SAVE_CHUNK_BYTES);
    const writing = saves.write(current.saveId, new Uint8Array(SAVE_CHUNK_BYTES)).then(
        () => 'written',
        error => error.code,
    );
    await saves.abortAll();
    expect(await writing).toBe('invalid-request');
    expect(await readFile(target, 'utf8')).toBe('valid old output');
    expect(await readdir(root)).toEqual(['result.webm']);
});
