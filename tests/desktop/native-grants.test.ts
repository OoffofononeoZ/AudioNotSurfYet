import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NativeReadGrants } from '../../electron/files/nativeGrants';
import { nativeResult } from '../../electron/files/nativeErrors';
import { resolveNativeRead } from '../../electron/files/nativeReadRequest';

const base = path.resolve('test-results/desktop-files');
let root: string, store: string;
beforeEach(async () => {
    await mkdir(base, { recursive: true });
    root = await mkdtemp(path.join(base, 'native-grants-'));
    store = path.join(root, 'profile/grants.json');
});
afterEach(async () => {
    expect(path.dirname(root)).toBe(base);
    expect(path.basename(root)).toMatch(/^native-grants-/);
    await rm(root, { recursive: true, force: true });
});

describe('native read grants', () => {
    it('keeps one-shot project selections out of persistent grants and releases them independently', async () => {
        const selected = path.join(root, 'project.json');
        await writeFile(selected, '{}', 'utf8');
        const grants = new NativeReadGrants(store);
        const persistent = await grants.selectFile(selected),
            transient = await grants.selectTransientFile(selected);
        expect(transient.grantId).not.toBe(persistent.grantId);
        expect((await grants.describe(transient.grantId)).size).toBe(2);
        expect(JSON.parse(await readFile(store, 'utf8')).grants).toHaveLength(1);
        grants.releaseTransientFile(persistent.grantId);
        expect(await grants.permission(persistent.grantId)).toBe('granted');
        grants.releaseTransientFile(transient.grantId);
        expect(await grants.permission(transient.grantId)).toBe('denied');
        const later = await grants.selectTransientFile(selected);
        expect(await new NativeReadGrants(store).permission(later.grantId)).toBe('denied');
        grants.clearTransientFiles();
        expect(await grants.permission(later.grantId)).toBe('denied');
    });
    it('persists only user-selected files, reuses references, serializes concurrent grants and revokes without deleting files', async () => {
        const first = path.join(root, '本地 音频.wav'),
            second = path.join(root, 'second.mp3');
        await writeFile(first, 'wave', 'utf8');
        await writeFile(second, 'mp3', 'utf8');
        const grants = new NativeReadGrants(store);
        const [a, b] = await Promise.all([grants.selectFile(first), grants.selectFile(second)]);
        expect(a).toEqual({ kind: 'file', platform: 'electron', grantId: expect.any(String), name: '本地 音频.wav' });
        expect(await grants.selectFile(first)).toEqual(a);
        const restored = new NativeReadGrants(store);
        expect(await restored.permission(a.grantId)).toBe('granted');
        expect((await restored.describe(b.grantId)).mimeType).toBe('audio/mpeg');
        expect((await restored.describe(a.grantId)).size).toBe(4);
        await restored.revoke(a.grantId);
        expect(await restored.permission(a.grantId)).toBe('denied');
        await expect(restored.resolveFile(a.grantId)).rejects.toMatchObject({ code: 'permission-denied' });
        expect(await readFile(first, 'utf8')).toBe('wave');
        expect(await new NativeReadGrants(store).permission(b.grantId)).toBe('granted');
    });

    it('distinguishes changed content, missing source and absent authorization', async () => {
        const selected = path.join(root, 'song.wav');
        await writeFile(selected, 'old', 'utf8');
        const grants = new NativeReadGrants(store),
            ref = await grants.selectFile(selected);
        const old = await grants.describe(ref.grantId);
        await writeFile(selected, 'new content', 'utf8');
        expect((await grants.describe(ref.grantId)).revision).not.toBe(old.revision);
        await unlink(selected);
        expect(await grants.permission(ref.grantId)).toBe('granted');
        await expect(grants.describe(ref.grantId)).rejects.toMatchObject({ code: 'file-missing' });
        await expect(grants.describe(randomUUID())).rejects.toMatchObject({ code: 'permission-denied' });
    });

    it('keeps resource children scoped to their directory without creating persistent child grants', async () => {
        const library = path.join(root, 'assets');
        await mkdir(path.join(library, 'elements/a'), { recursive: true });
        await writeFile(path.join(library, 'elements/a/resource.json'), '{}', 'utf8');
        const grants = new NativeReadGrants(store),
            directory = await grants.selectDirectory(library);
        expect(await grants.list(directory.grantId, 'elements')).toEqual([{ name: 'a', kind: 'directory' }]);
        const file = await grants.directoryFile(directory.grantId, 'elements/a/resource.json');
        expect(file.reference.grantId).toBe(directory.grantId);
        expect(file.reference.relativePath).toBe('elements/a/resource.json');
        expect(JSON.parse(await readFile(store, 'utf8')).grants).toHaveLength(1);
        for (const relative of ['../secret', '/outside', 'elements/../secret', 'elements\\secret', 'elements/%2e%2e']) {
            await expect(grants.directoryFile(directory.grantId, relative)).rejects.toMatchObject({
                code: 'invalid-request',
            });
        }
        await grants.revoke(directory.grantId);
        await expect(grants.directoryFile(directory.grantId, 'elements/a/resource.json')).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('rejects directory junctions escaping the selected resource root', async () => {
        const library = path.join(root, 'library'),
            neighbor = path.join(root, 'private');
        await mkdir(library);
        await mkdir(neighbor);
        await writeFile(path.join(neighbor, 'secret.json'), 'secret', 'utf8');
        await symlink(neighbor, path.join(library, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
        const grants = new NativeReadGrants(store),
            directory = await grants.selectDirectory(library);
        await expect(grants.list(directory.grantId, '')).rejects.toMatchObject({ code: 'permission-denied' });
        await expect(grants.directoryFile(directory.grantId, 'escape/secret.json')).rejects.toMatchObject({
            code: 'permission-denied',
        });
    });

    it('preserves malformed saved authorization and returns sanitized typed IPC errors', async () => {
        await mkdir(path.dirname(store), { recursive: true });
        await writeFile(store, '{broken', 'utf8');
        const result = await nativeResult(() => new NativeReadGrants(store).permission(randomUUID()));
        expect(result).toMatchObject({ ok: false, error: { code: 'store-invalid' } });
        expect(JSON.stringify(result)).not.toContain(root);
        expect(await readFile(store, 'utf8')).toBe('{broken');
        const denied = await nativeResult(async () => {
            throw Object.assign(Error(`denied ${root}`), { code: 'EACCES' });
        });
        expect(denied).toMatchObject({ ok: false, error: { code: 'permission-denied' } });
        expect(JSON.stringify(denied)).not.toContain(root);
    });

    it('serves only initiated own-origin reads, including directory children, and never trusts referrer', async () => {
        const file = path.join(root, 'song.wav');
        await writeFile(file, 'wave', 'utf8');
        const grants = new NativeReadGrants(store),
            ref = await grants.selectFile(file);
        const url = (await grants.describe(ref.grantId)).readUrl;
        expect(
            await resolveNativeRead(
                { url, method: 'GET', initiatorOrigin: 'app://audiosurf' },
                grants,
                'app://audiosurf',
            ),
        ).toBe(file);
        for (const initiatorOrigin of [undefined, 'null', 'https://untrusted.example']) {
            await expect(
                resolveNativeRead({ url, method: 'GET', initiatorOrigin }, grants, 'app://audiosurf'),
            ).rejects.toMatchObject({ code: 'permission-denied' });
        }
        await expect(
            resolveNativeRead({ url, method: 'POST', initiatorOrigin: 'app://audiosurf' }, grants, 'app://audiosurf'),
        ).rejects.toMatchObject({ code: 'permission-denied' });
        await expect(
            resolveNativeRead(
                { url: url + '?unexpected=1', method: 'GET', initiatorOrigin: 'app://audiosurf' },
                grants,
                'app://audiosurf',
            ),
        ).rejects.toMatchObject({ code: 'invalid-request' });
        const directory = await grants.selectDirectory(root);
        const child = await grants.directoryFile(directory.grantId, 'song.wav');
        expect(
            await resolveNativeRead(
                { url: child.readUrl, method: 'GET', initiatorOrigin: 'app://audiosurf' },
                grants,
                'app://audiosurf',
            ),
        ).toBe(file);
    });
});
