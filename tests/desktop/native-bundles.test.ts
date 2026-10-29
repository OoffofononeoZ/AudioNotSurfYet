import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { NativeBundles } from '../../electron/files/nativeBundles';
import { SAVE_CHUNK_BYTES } from '../../src/platform/transferContracts';
import type { BundleEntry } from '../../src/platform/bundleContracts';

const base = path.resolve('test-results/native-bundles');
let root: string,
    bundles: NativeBundles,
    cleanupFailure = false;
const names = ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json'];
const manifest = (size = 3): BundleEntry[] => names.map(name => ({ name, size }));
const name = 'audiosurf-00000000-0000-4000-8000-000000000001';
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'bundle-'));
    bundles = new NativeBundles();
    cleanupFailure = false;
});
afterEach(async () => {
    const error = await bundles.dispose().catch(error => error);
    if (cleanupFailure) expect(error).toMatchObject({ code: 'cleanup-failed' });
    else expect(error).toBeUndefined();
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^bundle-/);
    await rm(root, { recursive: true, force: true });
});
async function fill(id: string, entries: BundleEntry[]) {
    for (const entry of entries) {
        await bundles.beginFile(id);
        if (entry.size) await bundles.writeFile(id, new Uint8Array(entry.size).fill(65));
        await bundles.closeFile(id);
    }
}

test('publishes a complete new directory and leaves existing user files intact', async () => {
    await writeFile(path.join(root, 'existing.txt'), 'keep', 'utf8');
    const entries = manifest(),
        ref = await bundles.begin(root, name, 'wallpaper', entries);
    expect(JSON.stringify(ref)).not.toContain(root);
    expect(await readdir(root)).not.toContain(name);
    await fill(ref.bundleId, entries);
    expect(await readdir(root)).not.toContain(name);
    await bundles.commit(ref.bundleId);
    expect((await readdir(path.join(root, name))).sort()).toEqual([...names].sort());
    expect(await readFile(path.join(root, name, 'project.json'), 'utf8')).toBe('AAA');
    expect(await readFile(path.join(root, 'existing.txt'), 'utf8')).toBe('keep');
    expect((await readdir(root)).some(file => file.startsWith('.audiosurf-'))).toBe(false);
});
test('refuses existing targets, malformed manifests and traversal before creating anything', async () => {
    await mkdir(path.join(root, name));
    await writeFile(path.join(root, name, 'keep.txt'), 'existing', 'utf8');
    await expect(bundles.begin(root, name, 'wallpaper', manifest())).rejects.toMatchObject({ code: 'file-changed' });
    for (const entries of [
        [{ name: '../outside', size: 1 }],
        manifest().map((entry, index) => (index === 0 ? { name: 'C:/outside', size: 1 } : entry)),
        manifest().map(entry => ({ ...entry, size: -1 })),
    ])
        await expect(
            bundles.begin(root, 'audiosurf-00000000-0000-4000-8000-000000000002', 'wallpaper', entries),
        ).rejects.toMatchObject({ code: 'invalid-request' });
    expect(await readdir(root)).toEqual([name]);
    expect(await readFile(path.join(root, name, 'keep.txt'), 'utf8')).toBe('existing');
});
test('cancels an in-flight chunk and removes only the new transaction', async () => {
    const ref = await bundles.begin(root, name, 'wallpaper', manifest(SAVE_CHUNK_BYTES));
    await bundles.beginFile(ref.bundleId);
    const writing = bundles.writeFile(ref.bundleId, new Uint8Array(SAVE_CHUNK_BYTES)).then(
        () => null,
        error => error,
    );
    await bundles.abortAll();
    expect(await writing).toMatchObject({ code: 'invalid-request' });
    expect(await readdir(root)).toEqual([]);
});
test('rejects incomplete output and cleans its staged files', async () => {
    const ref = await bundles.begin(root, name, 'wallpaper', manifest());
    await bundles.beginFile(ref.bundleId);
    await bundles.writeFile(ref.bundleId, new Uint8Array([1]));
    await expect(bundles.closeFile(ref.bundleId)).rejects.toMatchObject({ code: 'invalid-request' });
    expect(await readdir(root)).toEqual([]);
});
test('preserves another directory that appears while the bundle is being written', async () => {
    const ref = await bundles.begin(root, name, 'wallpaper', manifest());
    await fill(ref.bundleId, manifest());
    await mkdir(path.join(root, name));
    await writeFile(path.join(root, name, 'keep.txt'), 'outside change', 'utf8');
    await expect(bundles.commit(ref.bundleId)).rejects.toMatchObject({ code: 'file-changed' });
    expect(await readdir(root)).toEqual([name]);
    expect(await readFile(path.join(root, name, 'keep.txt'), 'utf8')).toBe('outside change');
});
test('adds only one new preset and never modifies existing element dependencies', async () => {
    await mkdir(path.join(root, 'elements'));
    await writeFile(path.join(root, 'elements/keep.json'), 'dependency', 'utf8');
    const parent = path.join(root, 'presets');
    await mkdir(parent);
    const entries = [
        { name: 'source/resource.json', size: 2 },
        { name: 'resource-package.json', size: 2 },
        { name: 'preview.webp', size: 2 },
        { name: 'resource-info.json', size: 2 },
    ];
    const ref = await bundles.begin(parent, 'user-preset-00000000-0000-4000-8000-000000000001', 'preset', entries);
    await fill(ref.bundleId, entries);
    await bundles.commit(ref.bundleId);
    expect(await readFile(path.join(root, 'elements/keep.json'), 'utf8')).toBe('dependency');
    expect(await readFile(path.join(parent, ref.folderName, 'source/resource.json'), 'utf8')).toBe('AA');
});
test('does not delete external additions or follow directory junctions during cleanup', async () => {
    const ref = await bundles.begin(root, name, 'wallpaper', manifest());
    await fill(ref.bundleId, manifest());
    const staged = path.join(root, `.audiosurf-bundle-${ref.bundleId}.tmp`);
    const neighbor = path.join(root, 'neighbor');
    await mkdir(neighbor);
    await writeFile(path.join(neighbor, 'keep.txt'), 'external', 'utf8');
    await symlink(neighbor, path.join(staged, 'foreign'), process.platform === 'win32' ? 'junction' : 'dir');
    cleanupFailure = true;
    await expect(bundles.commit(ref.bundleId)).rejects.toMatchObject({ code: 'cleanup-failed' });
    expect(await readFile(path.join(neighbor, 'keep.txt'), 'utf8')).toBe('external');
    expect(await readdir(staged)).toEqual(['foreign']);
});
