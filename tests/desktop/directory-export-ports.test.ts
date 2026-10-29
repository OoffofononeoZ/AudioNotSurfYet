import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NativeBundles } from '../../electron/files/nativeBundles';
import { nativeResult } from '../../electron/files/nativeErrors';
import { DesktopDirectoryExports } from '../../src/platform/desktopDirectoryExports';
import { SAVE_CHUNK_BYTES } from '../../src/platform/transferContracts';
import type { DesktopBundleBridge, DirectoryExportFile } from '../../src/platform/bundleContracts';
const base = path.resolve('test-results/directory-export-ports'),
    folderName = 'audiosurf-00000000-0000-4000-8000-000000000001';
let root: string, bundles: NativeBundles;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'port-'));
    bundles = new NativeBundles();
});
afterEach(async () => {
    await bundles.dispose();
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^port-/);
    await rm(root, { recursive: true, force: true });
});
const files = (): DirectoryExportFile[] =>
    ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json'].map(name => ({
        name,
        content: `${name} 内容`,
    }));
function bridge() {
    return {
        beginPreset: vi.fn<DesktopBundleBridge['beginPreset']>(async (_id, name, entries) =>
            nativeResult(() => bundles.begin(root, name, 'preset', entries)),
        ),
        beginWallpaper: vi.fn<DesktopBundleBridge['beginWallpaper']>(async entries =>
            nativeResult(() => bundles.begin(root, folderName, 'wallpaper', entries)),
        ),
        beginFile: vi.fn(async (id: string) => nativeResult(() => bundles.beginFile(id))),
        writeFile: vi.fn(async (id: string, chunk: Uint8Array) => nativeResult(() => bundles.writeFile(id, chunk))),
        closeFile: vi.fn(async (id: string) => nativeResult(() => bundles.closeFile(id))),
        commit: vi.fn(async (id: string) => nativeResult(() => bundles.commit(id))),
        abort: vi.fn(async (id: string) => nativeResult(() => bundles.abort(id))),
    } satisfies DesktopBundleBridge;
}
test('writes UTF-8 content and large files with bounded chunks, then publishes all five files together', async () => {
    const host = bridge(),
        access = new DesktopDirectoryExports(host),
        input = files();
    const blob = new Blob([new Uint8Array(SAVE_CHUNK_BYTES + 7).fill(65)]);
    vi.spyOn(blob, 'arrayBuffer').mockRejectedValue(Error('whole-file read forbidden'));
    input[2]!.content = blob;
    const observed: number[] = [];
    let active = 0,
        maximum = 0;
    host.writeFile.mockImplementation(async (id, chunk) => {
        observed.push(chunk.length);
        maximum = Math.max(maximum, ++active);
        expect(await readdir(root)).not.toContain(folderName);
        const result = await nativeResult(() => bundles.writeFile(id, chunk));
        --active;
        return result;
    });
    expect(await access.saveWallpaper(input)).toEqual({ status: 'saved', folderName });
    expect(maximum).toBe(1);
    expect(Math.max(...observed)).toBe(SAVE_CHUNK_BYTES);
    expect(await readFile(path.join(root, folderName, 'index.html'), 'utf8')).toBe('index.html 内容');
    expect((await readFile(path.join(root, folderName, 'runtime.js'))).length).toBe(SAVE_CHUNK_BYTES + 7);
    expect(host.beginWallpaper.mock.calls[0]![0].at(-1)?.name).toBe('project.json');
});
test('native cancellation or a mid-write abort leaves existing output untouched', async () => {
    await writeFile(path.join(root, 'keep.txt'), 'keep', 'utf8');
    const host = bridge(),
        access = new DesktopDirectoryExports(host),
        signal = new AbortController();
    host.beginWallpaper.mockResolvedValueOnce({ ok: true, value: null });
    expect(await access.saveWallpaper(files())).toEqual({ status: 'cancelled' });
    expect(host.beginFile).not.toHaveBeenCalled();
    host.writeFile.mockImplementationOnce(async (id, chunk) => {
        const result = await nativeResult(() => bundles.writeFile(id, chunk));
        signal.abort();
        return result;
    });
    expect(await access.saveWallpaper(files(), signal.signal)).toEqual({ status: 'cancelled' });
    expect(host.commit).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual(['keep.txt']);
});
test('preset exports keep the precise relative filenames and require an opaque directory reference', async () => {
    const host = bridge(),
        access = new DesktopDirectoryExports(host),
        signal = new AbortController().signal;
    const input = [
        { name: 'source/resource.json', content: '{}' },
        { name: 'resource-package.json', content: '{}' },
        { name: 'preview.png', content: new Blob(['png']) },
        { name: 'resource-info.json', content: '{}' },
    ];
    await expect(
        access.savePreset({ kind: 'directory', name: 'foreign' }, 'user-preset-123', input, signal),
    ).rejects.toMatchObject({ name: 'NotAllowedError' });
    const reference = {
        kind: 'directory' as const,
        name: 'library',
        platform: 'electron' as const,
        grantId: 'opaque-root',
    };
    expect(await access.savePreset(reference, 'user-preset-123', input, signal)).toBe('saved');
    expect(host.beginPreset).toHaveBeenCalledWith('opaque-root', 'user-preset-123', expect.any(Array));
    expect(await readFile(path.join(root, 'user-preset-123/source/resource.json'), 'utf8')).toBe('{}');
});
