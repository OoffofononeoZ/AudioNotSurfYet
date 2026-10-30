import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { ClosePhase, CloseReply } from '../../src/platform/lifecycleContracts';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { openEditorWorkspace } from '../support/editor-workspaces';

// Browser-hosted real shared runtime; native dialogs/IPC and Electron window destruction require separate verification.
async function openEditor(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/tests/support/shutdown-host.html');
    await expect.poll(() => page.evaluate(() => !!(window as any).__shutdownHost?.ready)).toBe(true);
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('tempo-bpm-0').fill('127.5');
    await page.getByTestId('tempo-bpm-0').blur();
}
const request = (page: Page, phase: ClosePhase): Promise<CloseReply> =>
    page.evaluate(phase => (window as any).__shutdownHost.request(phase), phase);
const draftBpm = (page: Page) =>
    page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const opening = indexedDB.open('audionotsurfyet-editor');
            opening.onsuccess = () => resolve(opening.result);
            opening.onerror = () => reject(opening.error);
        });
        try {
            return await new Promise<number>((resolve, reject) => {
                const read = database.transaction('draft').objectStore('draft').get('latest');
                read.onsuccess = () => resolve(read.result.envelope.project.tempoMap[0].bpm);
                read.onerror = () => reject(read.error);
            });
        } finally {
            database.close();
        }
    });

test('desktop preparation saves the live draft, can resume editing and disposes the real app before acknowledging', async ({
    page,
}, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    expect(await request(page, 'inspect')).toMatchObject({ ok: true, summary: { unsaved: true } });
    expect(await request(page, 'prepare')).toEqual({ ok: true });
    await expect(page.getByRole('dialog', { name: '正在退出' })).toBeVisible();
    expect(await page.locator('#app').evaluate(element => (element as HTMLElement).inert)).toBe(true);
    await page.keyboard.press('Space');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page
        .getByRole('dialog', { name: '正在退出' })
        .screenshot({ path: `artifacts/desktop/shutdown-${info.project.name}.png` });
    expect(await draftBpm(page)).toBe(127.5);
    expect(await request(page, 'resume')).toEqual({ ok: true });
    await expect(page.getByRole('dialog', { name: '正在退出' })).toHaveCount(0);
    await page.getByTestId('tempo-bpm-0').fill('135');
    await page.getByTestId('tempo-bpm-0').blur();
    expect(await request(page, 'prepare')).toEqual({ ok: true });
    expect(await draftBpm(page)).toBe(135);
    expect(await request(page, 'dispose')).toEqual({ ok: true });
    await expect(page.locator('#main-layout')).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: '正在退出' })).toHaveCount(0);
    expect(await draftBpm(page)).toBe(135);
    expect(errors).toEqual([]);
});

test('failed draft persistence keeps the live project editable and a later close can retry', async ({ page }) => {
    await openEditor(page);
    await page.evaluate(() => (window as any).__shutdownHost.failWrites(true));
    await page.getByTestId('tempo-bpm-0').fill('142');
    await page.getByTestId('tempo-bpm-0').blur();
    expect(await request(page, 'prepare')).toMatchObject({ ok: false, message: expect.stringContaining('尚未保存') });
    await expect(page.locator('#main-layout')).toBeAttached();
    expect(await request(page, 'resume')).toEqual({ ok: true });
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('142');
    await page.evaluate(() => (window as any).__shutdownHost.failWrites(false));
    await page.getByTestId('tempo-bpm-0').fill('143');
    await page.getByTestId('tempo-bpm-0').blur();
    expect(await request(page, 'prepare')).toEqual({ ok: true });
    expect(await draftBpm(page)).toBe(143);
    expect(await request(page, 'dispose')).toEqual({ ok: true });
});

test('closing during an FT model download cancels the real task before runtime disposal completes', async ({
    page,
}) => {
    let release!: () => void;
    const held = new Promise<void>(resolve => {
        release = resolve;
    });
    await page.route('https://huggingface.co/StemSplitio/**', async route => {
        await held;
        await route
            .fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'offline' })
            .catch(() => {});
    });
    try {
        await openEditor(page);
        await openEditorWorkspace(page, 'separation');
        await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'idle');
        await page.getByTestId('editor-separate-start').click();
        await expect(page.locator('.processing-heading')).toContainText('下载模型', { timeout: 30000 });
        expect(await request(page, 'inspect')).toMatchObject({ ok: true, summary: { tasks: true } });
        expect(await request(page, 'prepare')).toEqual({ ok: true });
        expect(await request(page, 'dispose')).toEqual({ ok: true });
        await expect(page.locator('#main-layout')).toHaveCount(0);
        expect(await draftBpm(page)).toBe(127.5);
    } finally {
        release();
    }
});
