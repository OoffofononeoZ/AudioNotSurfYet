import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { assetsAvailable, resourceRows } from './visualizer-assets.mjs';
export async function installDirectoryPickerStub(page: Page) {
    await page.addInitScript(() => {
        (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker =
            async () => {
                if (sessionStorage.getItem('resource-picker-cancel') === 'true')
                    throw new DOMException('Cancelled', 'AbortError');
                const root = await navigator.storage.getDirectory();
                const parent = await root.getDirectoryHandle('visualizer-library-fixture');
                return parent.getDirectoryHandle('assets');
            };
    });
}
/** Real OPFS handles exercise IndexedDB structured cloning; this does not test OS picker permission UI. */
export async function prepareResourceDirectory(page: Page, persist = true) {
    if (!assetsAvailable) throw Error('Missing external assets; configure VISUALIZER_ASSETS_DIR.');
    const files = resourceRows().flatMap(({ dir, info }) =>
        ['resource-info.json', info.previewPath, info.packagePath, info.sourceEntry].map(path => ({
            path: (info.kind === 'preset' ? 'presets' : 'elements') + '/' + info.resource.id + '/' + path,
            text: readFileSync(join(dir, path), 'utf8'),
        })),
    );
    await page.evaluate(
        async ({ files, persist }) => {
            const root = await navigator.storage.getDirectory(),
                parent = await root.getDirectoryHandle('visualizer-library-fixture', { create: true }),
                assets = await parent.getDirectoryHandle('assets', { create: true });
            for (const file of files) {
                const parts = file.path.split('/');
                let dir = assets;
                for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
                const handle = await dir.getFileHandle(parts[parts.length - 1]!, { create: true }),
                    writer = await handle.createWritable();
                await writer.write(file.text);
                await writer.close();
            }
            if (persist)
                await new Promise<void>((resolve, reject) => {
                    const open = indexedDB.open('audionotsurfyet-resource-directory', 1);
                    open.onupgradeneeded = () => open.result.createObjectStore('directory');
                    open.onerror = () => reject(open.error);
                    open.onsuccess = () => {
                        const db = open.result,
                            tx = db.transaction('directory', 'readwrite');
                        tx.objectStore('directory').put(assets, 'assets');
                        tx.oncomplete = () => {
                            db.close();
                            resolve();
                        };
                        tx.onabort = () => {
                            db.close();
                            reject(tx.error);
                        };
                    };
                });
        },
        { files, persist },
    );
}
