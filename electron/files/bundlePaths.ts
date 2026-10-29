import { lstat, realpath, unlink, rmdir } from 'node:fs/promises';
import path from 'node:path';
import type { BundleEntry } from '../../src/platform/bundleContracts';
import { NativeFileError } from './nativeErrors';

export type BundleKind = 'preset' | 'wallpaper';
export interface BundleIdentity {
    dev: number;
    ino: number;
    birthtimeMs: number;
    size: number;
    mtimeMs: number;
    ctimeMs: number;
}
export async function bundleIdentity(file: string) {
    const info = await lstat(file);
    if (info.isSymbolicLink()) throw new NativeFileError('permission-denied');
    return info;
}
export function sameBundleObject(a: BundleIdentity, b: BundleIdentity) {
    return a.dev === b.dev && a.ino === b.ino && a.birthtimeMs === b.birthtimeMs;
}
export function sameBundleFile(a: BundleIdentity, b: BundleIdentity) {
    return sameBundleObject(a, b) && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}
export async function absent(file: string) {
    try {
        await lstat(file);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw error;
    }
    throw new NativeFileError('file-changed');
}
export function bundleEntries(kind: BundleKind, input: unknown): BundleEntry[] {
    if (!Array.isArray(input) || input.length !== (kind === 'preset' ? 4 : 5))
        throw new NativeFileError('invalid-request');
    const entries: BundleEntry[] = input.map(entry => {
        if (
            !entry ||
            typeof entry.name !== 'string' ||
            typeof entry.size !== 'number' ||
            !Number.isSafeInteger(entry.size) ||
            entry.size < 0
        )
            throw new NativeFileError('invalid-request');
        return { name: entry.name, size: entry.size };
    });
    const names = entries.map(entry => entry.name),
        unique = new Set(names);
    if (unique.size !== entries.length) throw new NativeFileError('invalid-request');
    const required =
        kind === 'preset'
            ? ['source/resource.json', 'resource-package.json', 'resource-info.json']
            : ['index.html', 'style-data.js', 'runtime.js', 'THIRD_PARTY_LICENSES.txt', 'project.json'];
    if (required.some(name => !unique.has(name)) || names[names.length - 1] !== required[required.length - 1])
        throw new NativeFileError('invalid-request');
    if (kind === 'preset' && !names.some(name => /^preview\.(?:png|jpe?g|webp)$/.test(name)))
        throw new NativeFileError('invalid-request');
    return entries;
}
/** Never follows a replaced root and never recursively deletes external additions. */
export async function cleanBundle(
    root: string,
    identity: BundleIdentity,
    ownedFiles: Map<string, BundleIdentity>,
    sourceIdentity?: BundleIdentity,
) {
    try {
        if ((await realpath(root)) !== root || !sameBundleObject(await bundleIdentity(root), identity))
            throw new NativeFileError('cleanup-failed');
        if (sourceIdentity && !sameBundleObject(await bundleIdentity(path.join(root, 'source')), sourceIdentity))
            throw new NativeFileError('cleanup-failed');
        for (const [name, expected] of [...ownedFiles].reverse()) {
            const target = path.join(root, name);
            if (!sameBundleFile(await bundleIdentity(target), expected)) throw new NativeFileError('cleanup-failed');
            await unlink(target);
            ownedFiles.delete(name);
        }
        if (sourceIdentity) {
            const source = path.join(root, 'source');
            if (!sameBundleObject(await bundleIdentity(source), sourceIdentity))
                throw new NativeFileError('cleanup-failed');
            await rmdir(source);
        }
        await rmdir(root);
    } catch {
        throw new NativeFileError('cleanup-failed');
    }
}
