import { describe, expect, test, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { VisualizerResourceLibrary } from '../../src/visualizer/resourceLibrary';
import { ElementRegistry } from '../../src/visualizer/elementRegistry';
import {
    validateResourceInfo,
    resourcePath,
    type ResourceDirectoryHandle,
    type DirectoryCandidate,
} from '../../src/visualizer/resourceDirectory';
import { IndexedDbResourceDirectoryRepository } from '../../src/visualizer/resourceDirectoryRepository';
import { DEFAULT_RESOURCE_PREVIEW } from '../../src/visualizer/resourcePreview';
const info = {
    schemaVersion: 1 as const,
    resource: { id: 'sample', version: 1, hash: 'a'.repeat(64) },
    kind: 'visual' as const,
    title: 'Sample',
    description: 'Sample resource',
    creator: 'default',
    createdAt: '2026-10-20T00:00:00.000Z',
    previewPath: 'preview.svg',
    sourceEntry: 'source/resource.json',
    packagePath: 'resource-package.json',
    dependencies: [],
    order: 0,
};
const candidate = (): DirectoryCandidate => ({
    resources: { algorithms: [], elements: [], presets: [] },
    entries: [{ info: structuredClone(info), preview: new Blob(['<svg/>']) }],
});
function handle(name = 'assets', permission: PermissionState = 'granted') {
    return {
        name,
        kind: 'directory',
        queryPermission: vi.fn(async () => permission),
        requestPermission: vi.fn(async () => permission),
    } as unknown as ResourceDirectoryHandle;
}
function setup() {
    const repository = {
        read: vi.fn(async (): Promise<ResourceDirectoryHandle | null> => null),
        save: vi.fn(async (_h: ResourceDirectoryHandle) => {}),
    };
    const registry = new ElementRegistry(),
        read = vi.fn(async () => candidate()),
        validate = vi.fn(async () => {}),
        createUrl = vi.fn(() => `blob:${crypto.randomUUID()}`),
        revokeUrl = vi.fn();
    const picker = vi.fn(async () => handle());
    const library = new VisualizerResourceLibrary({
        repository,
        registry,
        read,
        validate,
        createUrl,
        revokeUrl,
        picker,
    });
    return { library, repository, registry, read, validate, createUrl, revokeUrl, picker };
}
describe('external library task and permission ownership', () => {
    test('missing covers use the player cover without creating or revoking a static URL', async () => {
        const s = setup();
        s.read.mockResolvedValueOnce({ ...candidate(), entries: [{ info, preview: null }] });
        await s.library.choose();
        expect(s.library.snapshot()).toMatchObject({
            status: 'ready',
            entries: [{ previewUrl: DEFAULT_RESOURCE_PREVIEW }],
        });
        expect(s.createUrl).not.toHaveBeenCalled();
        await s.library.reload();
        expect(s.revokeUrl).not.toHaveBeenCalled();
        s.library.dispose();
        expect(s.revokeUrl).toHaveBeenCalledTimes(1);
        expect(s.revokeUrl).not.toHaveBeenCalledWith(DEFAULT_RESOURCE_PREVIEW);
    });
    test('first entry stays unselected, picker cancellation preserves the current usable library', async () => {
        const s = setup();
        await s.library.restore();
        expect(s.library.snapshot()).toMatchObject({ status: 'idle', entries: [] });
        expect(s.library.snapshot().folderName).toBeUndefined();
        await s.library.choose();
        const before = s.library.snapshot();
        s.picker.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
        await s.library.choose();
        expect(s.library.snapshot()).toEqual(before);
        expect(s.revokeUrl).not.toHaveBeenCalled();
        s.library.dispose();
    });
    test('restore queries only, explicit recover handles denied and granted read permissions', async () => {
        const s = setup(),
            dir = handle('assets', 'prompt');
        s.repository.read.mockResolvedValue(dir);
        await s.library.restore();
        expect(dir.requestPermission).not.toHaveBeenCalled();
        expect(s.read).not.toHaveBeenCalled();
        expect(s.library.snapshot()).toMatchObject({ status: 'permission', canRestore: true });
        vi.mocked(dir.requestPermission).mockResolvedValueOnce('denied');
        await s.library.recover();
        expect(s.library.snapshot().status).toBe('permission');
        vi.mocked(dir.requestPermission).mockResolvedValue('granted');
        vi.mocked(dir.queryPermission).mockResolvedValue('granted');
        await s.library.recover();
        expect(s.library.snapshot().status).toBe('ready');
        expect(dir.requestPermission).toHaveBeenLastCalledWith({ mode: 'read' });
        s.library.dispose();
    });
    test('valid saved handle automatically restores without a picker or permission request', async () => {
        const s = setup(),
            dir = handle();
        s.repository.read.mockResolvedValue(dir);
        await s.library.restore();
        expect(s.library.snapshot().status).toBe('ready');
        expect(s.picker).not.toHaveBeenCalled();
        expect(dir.requestPermission).not.toHaveBeenCalled();
        s.library.dispose();
    });
    test('permission revoked during file reads exposes recovery without losing current previews', async () => {
        const s = setup();
        await s.library.choose();
        const entries = s.library.snapshot().entries;
        s.read.mockRejectedValueOnce(new DOMException('revoked', 'NotAllowedError'));
        await s.library.reload();
        expect(s.library.snapshot()).toMatchObject({ status: 'permission', canRestore: true, entries });
        expect(s.revokeUrl).not.toHaveBeenCalled();
        await s.library.recover();
        expect(s.library.snapshot().status).toBe('ready');
        s.library.dispose();
    });
    test('handle persistence failure leaves current resources usable and warns about next visit', async () => {
        const s = setup();
        s.repository.save.mockRejectedValue(Error('quota'));
        await s.library.choose();
        expect(s.library.snapshot()).toMatchObject({ status: 'ready', folderName: 'assets' });
        expect(s.library.snapshot().message).toContain('无法记住');
        s.library.dispose();
    });
    test('corrupt or missing dependencies and initialization failure never replace current resources', async () => {
        const s = setup();
        await s.library.choose();
        const entries = s.library.snapshot().entries;
        s.read.mockRejectedValueOnce(Error('Missing dependency'));
        await s.library.reload();
        expect(s.library.snapshot()).toMatchObject({ status: 'error', entries });
        expect(s.revokeUrl).not.toHaveBeenCalled();
        s.validate.mockRejectedValueOnce(Error('invalid algorithm'));
        await s.library.reload();
        expect(s.library.snapshot().entries).toEqual(entries);
        expect(s.createUrl).toHaveBeenCalledTimes(1);
        await s.library.reload();
        expect(s.library.snapshot().status).toBe('ready');
        expect(s.revokeUrl).toHaveBeenCalledWith(entries[0]!.previewUrl);
        s.library.dispose();
        expect(s.revokeUrl).toHaveBeenCalledTimes(2);
    });
    test('a late directory cannot overwrite a newer selection or persist its handle', async () => {
        const s = setup();
        let resolve!: (value: DirectoryCandidate) => void;
        let started!: () => void;
        const running = new Promise<void>(yes => (started = yes));
        s.picker.mockResolvedValueOnce(handle('old')).mockResolvedValueOnce(handle('new'));
        s.read.mockImplementationOnce(async () => {
            started();
            return new Promise<DirectoryCandidate>(yes => (resolve = yes));
        });
        const old = s.library.choose();
        await running;
        await s.library.choose();
        const latest = s.library.snapshot();
        resolve(candidate());
        await old;
        expect(s.library.snapshot()).toEqual(latest);
        expect(latest.folderName).toBe('new');
        expect(s.repository.save).toHaveBeenCalledTimes(1);
        expect(s.createUrl).toHaveBeenCalledTimes(1);
        s.library.dispose();
    });
    test('disposal invalidates in-flight initialization and releases no uncreated URLs', async () => {
        const s = setup();
        let resolve!: () => void;
        let started!: () => void;
        const running = new Promise<void>(yes => (started = yes));
        s.validate.mockImplementationOnce(async () => {
            started();
            await new Promise<void>(yes => (resolve = yes));
        });
        const pending = s.library.choose();
        await running;
        s.library.dispose();
        resolve();
        await pending;
        expect(s.library.snapshot().entries).toEqual([]);
        expect(s.createUrl).not.toHaveBeenCalled();
        expect(s.repository.save).not.toHaveBeenCalled();
    });
    test('directory switch revokes old preview URLs after publishing the new ones', async () => {
        const s = setup();
        await s.library.choose();
        const first = s.library.snapshot().entries[0]!.previewUrl;
        s.picker.mockResolvedValue(handle('replacement'));
        await s.library.choose();
        expect(s.library.snapshot().folderName).toBe('replacement');
        expect(s.revokeUrl).toHaveBeenCalledWith(first);
        s.library.dispose();
    });
});
test('resource info rejects path escapes, duplicate dependencies and invalid identity/time/order', () => {
    expect(validateResourceInfo(info)).toEqual(info);
    const { previewPath: _preview, ...withoutCover } = info;
    expect(validateResourceInfo(withoutCover)).toEqual(withoutCover);
    expect(validateResourceInfo({ ...info, previewPath: 'images/cover.webp' }).previewPath).toBe('images/cover.webp');
    for (const path of ['../x', '/absolute', 'a/../x', 'C:/x', 'a\\b', 'x%2fy', 'a//b', './x', 'https://x', 'a?b'])
        expect(() => resourcePath(path)).toThrow();
    for (const bad of [
        { createdAt: 'yesterday' },
        { order: -1 },
        { schemaVersion: 2 },
        { extra: true },
        { previewPath: '../cover.png' },
        { previewPath: '' },
        { resource: { ...info.resource, hash: 'bad' } },
        { dependencies: [info.resource, info.resource] },
    ])
        expect(() => validateResourceInfo({ ...info, ...bad })).toThrow();
});
test('independent IndexedDB stores a handle record without any resource payload', async () => {
    const factory = new IDBFactory(),
        repo = new IndexedDbResourceDirectoryRepository(factory);
    expect(await repo.read()).toBeNull();
    const value = { kind: 'directory', name: 'assets' } as ResourceDirectoryHandle;
    await repo.save(value);
    expect(await new IndexedDbResourceDirectoryRepository(factory).read()).toEqual(value);
    expect(factory.databases && (await factory.databases()).map(d => d.name)).toEqual([
        'audionotsurfyet-resource-directory',
    ]);
});
