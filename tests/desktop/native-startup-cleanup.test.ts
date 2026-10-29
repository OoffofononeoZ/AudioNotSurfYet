import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { NativeSaves } from '../../electron/files/nativeSaves';
import { NativeBundles } from '../../electron/files/nativeBundles';

vi.mock('node:fs/promises', async importOriginal => {
    const original = await importOriginal<typeof import('node:fs/promises')>();
    return { ...original, realpath: vi.fn(original.realpath), mkdir: vi.fn(original.mkdir) };
});
const actual = await vi.importActual<typeof fs>('node:fs/promises');
const base = path.resolve('test-results/native-startup-cleanup');
let root: string,
    saves: NativeSaves,
    bundles: NativeBundles,
    releasePending = () => {};
beforeEach(async () => {
    await actual.mkdir(base, { recursive: true });
    root = await actual.mkdtemp(path.join(base, 'startup-'));
    saves = new NativeSaves();
    bundles = new NativeBundles();
});
afterEach(async () => {
    releasePending();
    vi.mocked(fs.realpath).mockImplementation(actual.realpath);
    vi.mocked(fs.mkdir).mockImplementation(actual.mkdir);
    await Promise.all([saves.dispose(), bundles.dispose()]);
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^startup-/);
    await actual.rm(root, { recursive: true, force: true });
});
function hold() {
    let enter!: () => void, release!: () => void;
    const entered = new Promise<void>(resolve => {
        enter = resolve;
    });
    const ready = new Promise<void>(resolve => {
        release = resolve;
    });
    releasePending = release;
    return {
        entered,
        release,
        wait: () => {
            enter();
            return ready;
        },
    };
}
const entries = [
    { name: 'source/resource.json', size: 0 },
    { name: 'resource-package.json', size: 0 },
    { name: 'preview.png', size: 0 },
    { name: 'resource-info.json', size: 0 },
];

test('file disposal waits for a begin that has not registered its temporary file yet', async () => {
    const gate = hold();
    vi.mocked(fs.realpath).mockImplementationOnce(async (...args: Parameters<typeof fs.realpath>) => {
        await gate.wait();
        return actual.realpath(...args);
    });
    const failure = expect(saves.begin(path.join(root, 'output.json'), 0)).rejects.toMatchObject({
        code: 'invalid-request',
    });
    await gate.entered;
    let stopped = false;
    const cleanup = saves.dispose().then(() => {
        stopped = true;
    });
    await actual.readdir(root);
    expect(stopped).toBe(false);
    gate.release();
    await Promise.all([failure, cleanup]);
    expect(await actual.readdir(root)).toEqual([]);
});

test('directory disposal waits for source initialization before removing the owned staging directory', async () => {
    const gate = hold();
    vi.mocked(fs.mkdir).mockImplementation(async (...args: Parameters<typeof fs.mkdir>) => {
        if (path.basename(String(args[0])) === 'source') await gate.wait();
        return actual.mkdir(...args);
    });
    const failure = expect(bundles.begin(root, 'user-preset-1234', 'preset', entries)).rejects.toMatchObject({
        code: 'invalid-request',
    });
    await gate.entered;
    const cleanup = bundles.dispose();
    await Promise.resolve();
    expect(await actual.readdir(root)).toHaveLength(1);
    gate.release();
    await Promise.all([failure, cleanup]);
    expect(await actual.readdir(root)).toEqual([]);
});

test.each(['file', 'directory'] as const)(
    'navigation cleanup of a pending %s begin preserves the next generation',
    async kind => {
        const gate = hold();
        vi.mocked(fs.realpath).mockImplementationOnce(async (...args: Parameters<typeof fs.realpath>) => {
            await gate.wait();
            return actual.realpath(...args);
        });
        const begin = (name: string) =>
            kind === 'file' ? saves.begin(path.join(root, name), 0) : bundles.begin(root, name, 'preset', entries);
        const manager = kind === 'file' ? saves : bundles;
        const failure = expect(begin('user-preset-1111')).rejects.toMatchObject({ code: 'invalid-request' });
        await gate.entered;
        let stopped = false;
        const cleanup = manager.abortAll().then(() => {
            stopped = true;
        });
        const fresh = await begin('user-preset-2222');
        expect(stopped).toBe(false);
        gate.release();
        await Promise.all([failure, cleanup]);
        if ('saveId' in fresh) await saves.commit(fresh.saveId);
        else {
            for (const _entry of entries) {
                await bundles.beginFile(fresh.bundleId);
                await bundles.closeFile(fresh.bundleId);
            }
            await bundles.commit(fresh.bundleId);
        }
        expect(await actual.readdir(root)).toEqual(['user-preset-2222']);
    },
);
