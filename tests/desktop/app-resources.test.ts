import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppResourceError, isAppUrl, isDevelopmentUrl, resolveRendererResource } from '../../electron/appResources';

const roots: string[] = [];
afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
});

async function fixture() {
    const root = await mkdtemp(path.join(os.tmpdir(), 'audiosurf-desktop-resources-'));
    roots.push(root);
    await mkdir(path.join(root, 'assets'));
    await writeFile(path.join(root, 'index.html'), '<p>application</p>', 'utf8');
    await writeFile(path.join(root, 'assets/main.js'), 'export {};', 'utf8');
    return root;
}

describe('desktop bundled resource boundary', () => {
    it('resolves known history routes while preserving real asset misses', async () => {
        const root = await fixture();
        for (const route of ['/', '/analyzer', '/editor/song', '/visualizer/song', '/display/style']) {
            expect(await resolveRendererResource(root, `app://audiosurf${route}`)).toBe(path.join(root, 'index.html'));
        }
        expect(await resolveRendererResource(root, 'app://audiosurf/assets/main.js?v=1')).toBe(
            path.join(root, 'assets/main.js'),
        );
        for (const route of ['/assets/missing.js', '/processing-runtime/missing.wasm', '/unknown']) {
            await expect(resolveRendererResource(root, `app://audiosurf${route}`)).rejects.toMatchObject({
                status: 404,
            });
        }
    });

    it('rejects foreign hosts, credentials, methods, path separators and malformed escapes', async () => {
        const root = await fixture();
        for (const url of [
            'file:///etc/passwd',
            'app://foreign/',
            'app://user:secret@audiosurf/',
            'app://audiosurf:123/',
            'app://audiosurf/%5c..%5csecret',
            'app://audiosurf/%00',
            'app://audiosurf/%2e%2e%2fsecret',
        ])
            await expect(resolveRendererResource(root, url)).rejects.toBeInstanceOf(AppResourceError);
        await expect(resolveRendererResource(root, 'app://audiosurf/%GG')).rejects.toMatchObject({ status: 400 });
        await expect(resolveRendererResource(root, 'app://audiosurf/', 'POST')).rejects.toMatchObject({ status: 403 });
        expect(isAppUrl('app://audiosurf/')).toBe(true);
        expect(isAppUrl('app://audiosurf.evil/')).toBe(false);
        expect(isDevelopmentUrl('http://127.0.0.1:5174/editor', 'http://127.0.0.1:5174')).toBe(true);
        expect(isDevelopmentUrl('http://127.0.0.1:5174.evil/', 'http://127.0.0.1:5174')).toBe(false);
    });
});
