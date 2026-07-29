import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FIXTURES = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio',
);

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

async function mutateSessionDatabase(
    page: Page,
    mutation: 'clear-handles' | 'unknown-schema',
) {
    await page.evaluate(async (operation) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-session', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        if (operation === 'clear-handles') {
            const transaction = database.transaction(
                'handles',
                'readwrite',
            );
            transaction.objectStore('handles').clear();
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } else {
            const read = database
                .transaction('session', 'readonly')
                .objectStore('session')
                .get('latest');
            const value = await new Promise<Record<string, unknown>>(
                (resolve, reject) => {
                    read.onsuccess = () => resolve(
                        read.result as Record<string, unknown>,
                    );
                    read.onerror = () => reject(read.error);
                },
            );
            const transaction = database.transaction(
                'session',
                'readwrite',
            );
            transaction.objectStore('session').put({
                ...value,
                schemaVersion: 99,
            }, 'latest');
            await new Promise<void>((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        }
        database.close();
    }, mutation);
}

test('restores the queue and current Blob paused at zero, then clears the persisted session', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');

    const musicBar = page.locator('#music-bar-container');
    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.wav'),
        path.join(AUDIO_FIXTURES, 'format-master.mp3'),
        path.join(AUDIO_FIXTURES, 'format-master.flac'),
    ]);
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('next-track').click();
    await expect(musicBar).toHaveAttribute(
        'data-persistence-state',
        'ready',
        { timeout: 20_000 },
    );
    const currentTrackId =
        await musicBar.getAttribute('data-current-track-id');
    expect(currentTrackId).toBeTruthy();

    await page.reload();
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        currentTrackId ?? '',
        { timeout: 20_000 },
    );
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await expect(musicBar).toHaveAttribute('data-current-time', '0');
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('3');
    await page.getByTestId('clear-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('0');

    await page.reload();
    await expect(musicBar).toHaveAttribute('data-playback-state', 'empty');
    expect(issues).toEqual([]);
});

test('restores the current Blob even when no queue handles remain', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');

    const musicBar = page.locator('#music-bar-container');
    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.wav'),
        path.join(AUDIO_FIXTURES, 'format-master.mp3'),
    ]);
    await expect(musicBar).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await expect(musicBar).toHaveAttribute(
        'data-persistence-state',
        'ready',
        { timeout: 20_000 },
    );
    const currentTrackId =
        await musicBar.getAttribute('data-current-track-id');
    await mutateSessionDatabase(page, 'clear-handles');

    await page.reload();
    await expect(musicBar).toHaveAttribute(
        'data-current-track-id',
        currentTrackId ?? '',
        { timeout: 20_000 },
    );
    await expect(musicBar).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('track-restore-state')).toContainText(
        '原文件已移动或不可用',
    );
    expect(issues).toEqual([]);
});

test('reports unknown schema and clears it only after the user action', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');

    await chooseFiles(page, [
        path.join(AUDIO_FIXTURES, 'format-master.wav'),
    ]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-persistence-state',
        'ready',
        { timeout: 20_000 },
    );
    await mutateSessionDatabase(page, 'unknown-schema');

    await page.reload();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-persistence-state',
        'unsupported-schema',
    );
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('persistence-message')).toContainText(
        '无法识别的会话版本',
    );
    await page.getByTestId('clear-persisted-session').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-persistence-state',
        'ready',
    );

    await page.reload();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'empty',
    );
    expect(issues).toEqual([]);
});
