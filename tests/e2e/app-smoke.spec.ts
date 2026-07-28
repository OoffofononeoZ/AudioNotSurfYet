import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');

function captureBrowserIssues(page: Page): string[] {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => {
        issues.push(`pageerror: ${error.message}`);
    });
    return issues;
}

test('loads the current shell and keeps empty playback controls stable', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/');

    await expect(page.locator('#main-layout')).toBeVisible();
    await expect(page.locator('#music-bar')).toBeVisible();
    await expect(page.locator('#progress-bar-container')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator('#music-info-container')).toContainText('unknown file');

    const transportControls = page.locator('#music-bar > section').nth(1).locator('svg');
    await transportControls.nth(0).click();
    await transportControls.nth(1).click();
    await transportControls.nth(2).click();
    await expect(page.locator('#progress-bar-container')).toHaveAttribute('aria-disabled', 'true');
    expect(issues).toEqual([]);
});

test('provides real IndexedDB and Web Worker transfer behavior', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/');

    const databaseValue = await page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('m3-browser-harness', 1);
            request.onupgradeneeded = () => request.result.createObjectStore('records');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        const transaction = database.transaction('records', 'readwrite');
        transaction.objectStore('records').put('browser-real', 'state');
        await new Promise<void>((resolve) => {
            transaction.oncomplete = () => resolve();
        });
        const read = database.transaction('records', 'readonly').objectStore('records').get('state');
        const value = await new Promise<string>((resolve, reject) => {
            read.onsuccess = () => resolve(read.result as string);
            read.onerror = () => reject(read.error);
        });
        database.close();
        indexedDB.deleteDatabase('m3-browser-harness');
        return value;
    });
    expect(databaseValue).toBe('browser-real');

    const workerResult = await page.evaluate(async () => {
        const source = `
            self.onmessage = (event) => {
                const values = new Uint8Array(event.data);
                self.postMessage(values.reduce((sum, value) => sum + value, 0));
            };
        `;
        const workerUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        const worker = new Worker(workerUrl);
        const buffer = Uint8Array.from([2, 4, 6]).buffer;
        const result = new Promise<number>((resolve, reject) => {
            worker.onmessage = (event: MessageEvent<number>) => resolve(event.data);
            worker.onerror = (event: ErrorEvent) => reject(new Error(event.message));
        });
        worker.postMessage(buffer, [buffer]);
        const detachedBytes = buffer.byteLength;
        const sum = await result;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        return { detachedBytes, sum };
    });
    expect(workerResult).toEqual({ detachedBytes: 0, sum: 12 });
    expect(issues).toEqual([]);
});

for (const extension of ['wav', 'mp3', 'flac']) {
    test(`loads and starts the committed ${extension.toUpperCase()} fixture`, async ({ page }) => {
        const issues = captureBrowserIssues(page);
        await page.goto('/');

        const addButton = page.locator('svg').filter({
            has: page.locator('use[href="/icons.svg#add-music"]'),
        }).first();
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            addButton.click(),
        ]);
        const fixturePath = path.join(
            REPOSITORY_ROOT,
            `tests/fixtures/audio/format-master.${extension}`,
        );
        await chooser.setFiles(fixturePath);

        await expect(page.locator('#music-info-container')).toContainText(
            `format-master.${extension}`,
        );
        await expect(page.locator('#progress-bar-container')).toHaveAttribute(
            'aria-disabled',
            'false',
            { timeout: 20_000 },
        );
        expect(issues).toEqual([]);
    });
}
