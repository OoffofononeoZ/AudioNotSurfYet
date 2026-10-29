import { afterEach, expect, test, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { IDBFactory } from 'fake-indexeddb';
import { NativeReadGrants } from '../../electron/files/nativeGrants';
import { nativeResult } from '../../electron/files/nativeErrors';
import { DesktopDirectoryFiles } from '../../src/platform/desktopDirectoryFiles';
import { BrowserDirectoryFiles } from '../../src/platform/webDirectoryFiles';
import type { DesktopFileBridge, NativeDirectoryReference } from '../../src/platform/fileContracts';
import { VisualizerResourceLibrary } from '../../src/visualizer/resourceLibrary';
import { IndexedDbResourceDirectoryRepository } from '../../src/visualizer/resourceDirectoryRepository';
import { ElementRegistry } from '../../src/visualizer/elementRegistry';

const base = path.resolve('test-results/desktop-directory-ports');
let temporary: string | undefined;
afterEach(async () => {
    vi.unstubAllGlobals();
    if (temporary) {
        expect(path.dirname(temporary)).toBe(base);
        expect(path.basename(temporary)).toMatch(/^directory-/);
        await rm(temporary, { recursive: true, force: true });
        temporary = undefined;
    }
});

async function nativeSetup() {
    await mkdir(base, { recursive: true });
    temporary = await mkdtemp(path.join(base, 'directory-'));
    const root = path.join(temporary, '本地资源库');
    await mkdir(path.join(root, 'elements'), { recursive: true });
    await mkdir(path.join(root, 'presets'));
    await writeFile(path.join(root, 'elements/notes.json'), '{"local":true}', 'utf8');
    const store = path.join(temporary, 'profile/grants.json');
    let grants = new NativeReadGrants(store);
    const reference = await grants.selectDirectory(root);
    const bridge = {
        chooseProject: vi.fn(),
        releaseProject: vi.fn(),
        chooseAudio: vi.fn(),
        describeFile: vi.fn(),
        chooseResourceDirectory: vi.fn(async () => ({ ok: true as const, value: reference })),
        filePermission: (id: string) => nativeResult(() => grants.permission(id)),
        listDirectory: (id: string, relative: string) => nativeResult(() => grants.list(id, relative)),
        describeDirectoryFile: (id: string, relative: string) => nativeResult(() => grants.directoryFile(id, relative)),
    } satisfies DesktopFileBridge;
    const fetchFile = vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const file = await grants.resolveDirectoryFile(url.pathname.split('/').pop()!, url.searchParams.get('path')!);
        return new Response(new Uint8Array(await readFile(file)));
    });
    const access = new DesktopDirectoryFiles(bridge, fetchFile as typeof fetch);
    return {
        root,
        reference,
        access,
        bridge,
        fetchFile,
        grants,
        restart: () => {
            grants = new NativeReadGrants(store);
        },
    };
}

test('reads a selected native directory after process restart using only its persisted opaque reference', async () => {
    const s = await nativeSetup();
    const repository = new IndexedDbResourceDirectoryRepository(new IDBFactory());
    await repository.save(s.reference);
    s.restart();
    const restored = (await repository.read()) as NativeDirectoryReference;
    expect(restored).toEqual(s.reference);
    expect(JSON.stringify(restored)).not.toContain(s.root);
    expect(await s.access.list(restored, 'elements', new AbortController().signal)).toEqual([
        { name: 'notes.json', kind: 'file' },
    ]);
    const file = await s.access.read(restored, 'elements/notes.json', new AbortController().signal);
    expect(file.name).toBe('notes.json');
    expect(file.type).toBe('application/json');
    expect(JSON.parse(await file.text())).toEqual({ local: true });
    expect(s.bridge.chooseResourceDirectory).not.toHaveBeenCalled();
    expect(s.fetchFile).toHaveBeenCalledTimes(1);
});

test('shared library restores a plain native reference and preserves its usable catalog on missing or revoked access', async () => {
    const s = await nativeSetup();
    await unlink(path.join(s.root, 'elements/notes.json'));
    const repository = new IndexedDbResourceDirectoryRepository(new IDBFactory());
    const registry = new ElementRegistry(),
        validate = vi.fn(async () => {});
    const library = new VisualizerResourceLibrary({ files: s.access, repository, registry, validate });
    await library.choose();
    expect(library.snapshot()).toMatchObject({ status: 'ready', folderName: s.reference.name });
    expect(await repository.read()).toEqual(s.reference);
    library.dispose();
    s.restart();
    const restored = new VisualizerResourceLibrary({ files: s.access, repository, registry, validate });
    await restored.restore();
    expect(restored.snapshot().status).toBe('ready');
    expect(s.bridge.chooseResourceDirectory).toHaveBeenCalledTimes(1);
    await rmdir(path.join(s.root, 'presets'));
    await restored.reload();
    expect(restored.snapshot()).toMatchObject({ status: 'error', folderName: s.reference.name, entries: [] });
    const currentGrants = new NativeReadGrants(path.join(temporary!, 'profile/grants.json'));
    await currentGrants.revoke(s.reference.grantId);
    s.restart();
    await restored.reload();
    expect(restored.snapshot()).toMatchObject({ status: 'permission', canRestore: true });
    expect(validate).toHaveBeenCalledTimes(2);
    restored.dispose();
});

test('rejects traversal before host calls and discards a directory listing completed after cancellation', async () => {
    const s = await nativeSetup();
    const list = vi.spyOn(s.bridge, 'listDirectory');
    for (const relative of ['../outside', '/absolute', 'a\\b', 'x%2fy'])
        await expect(s.access.list(s.reference, relative, new AbortController().signal)).rejects.toMatchObject({
            name: 'DataError',
        });
    expect(list).not.toHaveBeenCalled();
    const task = new AbortController();
    list.mockImplementationOnce(async () => {
        task.abort();
        return { ok: true, value: [] };
    });
    await expect(s.access.list(s.reference, '', task.signal)).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
        s.access.read({ kind: 'directory', name: 'foreign' }, 'notes.json', new AbortController().signal),
    ).rejects.toMatchObject({ name: 'NotAllowedError' });
});

test('web selection retains its original handle and uses read-only browser permission requests', async () => {
    const reference = {
        kind: 'directory' as const,
        name: 'assets',
        queryPermission: vi.fn(async () => 'prompt' as const),
        requestPermission: vi.fn(async () => 'granted' as const),
    };
    const picker = vi.fn(async () => reference);
    vi.stubGlobal('window', { showDirectoryPicker: picker });
    const access = new BrowserDirectoryFiles();
    expect(await access.chooseResourceDirectory()).toBe(reference);
    expect(await access.queryPermission(reference)).toBe('prompt');
    expect(await access.requestPermission(reference)).toBe('granted');
    expect(picker).toHaveBeenCalledWith({ id: 'visualizer-assets', mode: 'read' });
    expect(reference.requestPermission).toHaveBeenCalledWith({ mode: 'read' });
});
