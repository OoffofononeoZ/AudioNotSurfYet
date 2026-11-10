import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exampleSearchWav } from '../transcription/exampleFixtures';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { openEditorWorkspace } from '../support/editor-workspaces';
import type { ExampleProfile } from '../../src/transcription/examples/types';
import { addMarkerLane, clickMarkerTime, markerSurface } from '../support/editor-marking';

async function profiles(page: Page): Promise<ExampleProfile[]> {
    return page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open('editor-sound-examples', 1);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
        });
        try {
            return await new Promise<ExampleProfile[]>((resolve, reject) => {
                const r = db.transaction('profiles').objectStore('profiles').getAll();
                r.onsuccess = () => resolve(r.result.map(row => row.profile));
                r.onerror = () => reject(r.error);
            });
        } finally {
            db.close();
        }
    });
}
async function project(page: Page) {
    return page.evaluate(async () => {
        const url = '/src/editor/editorDraftRepository.ts',
            { EditorDraftRepository } = await import(url),
            repository = new EditorDraftRepository();
        try {
            return (await repository.restore()).project;
        } finally {
            repository.close();
        }
    });
}
test('same-song examples use real DSP without separation, persist, review, edit, apply and cancel safely', async ({
    page,
}, info) => {
    test.setTimeout(180000);
    const directory = path.resolve(
        'artifacts/evals/editor-transcription/examples',
        `${info.project.name}-${Date.now()}`,
    );
    await fs.mkdir(directory, { recursive: true });
    const input = path.join(directory, 'cc0-examples.wav');
    await fs.writeFile(input, exampleSearchWav());
    const errors: string[] = [],
        modelRequests: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
        if (/huggingface|basic-pitch/.test(request.url())) modelRequests.push(request.url());
    });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [input]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await openEditorWorkspace(page, 'transcription');
    const panel = page.getByTestId('editor-sound-examples');
    await expect(panel).toHaveAttribute('data-state', 'idle');
    await expect(panel.getByLabel('示例检索来源')).toHaveValue(
        (await panel.getByLabel('示例检索来源').locator('option').first().getAttribute('value')) as string,
    );
    await expect(panel.getByLabel('示例检索来源').locator('option')).toHaveCount(1);
    await panel.getByLabel('声音示例类型').selectOption('range');
    await panel.getByLabel('声音示例起点').fill('0.5');
    await panel.getByLabel('声音示例终点').fill('1.62');
    await panel.getByTestId('sound-example-add').click();
    await panel.getByLabel('示例相似度门限').fill('0.85');
    await panel.getByLabel('示例相似度门限').press('Tab');
    await panel.getByTestId('sound-example-search').click();
    await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    await expect.poll(async () => (await profiles(page))[0]?.matches.length).toBeGreaterThan(1);
    const first = (await profiles(page))[0]!;
    expect(first.threshold).toBe(0.85);
    await fs.writeFile(path.join(directory, 'first-profile.json'), JSON.stringify(first, null, 2), 'utf8');
    expect(first.matches.every(m => !m.selected)).toBe(true);
    expect(first.matches.some(m => Math.abs(m.startSeconds - 4) < 0.12)).toBe(true);
    expect(first.matches.some(m => Math.abs(m.startSeconds - 8) < 0.12)).toBe(true);
    const row = panel.getByTestId('sound-example-match').first();
    await row.getByLabel('修正检索候选起点').fill(String(first.matches[0]!.startSeconds + 0.01));
    await row.getByLabel('修正检索候选起点').press('Tab');
    await row.getByLabel('勾选检索候选').check();
    await row.getByRole('button', { name: '试听', exact: true }).click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await panel.getByTestId('sound-example-apply').click();
    await expect
        .poll(async () =>
            (await project(page)).lanes.reduce(
                (sum: number, lane: { events: unknown[] }) => sum + lane.events.length,
                0,
            ),
        )
        .toBe(1);
    await panel.getByTestId('sound-example-apply').click();
    expect((await project(page)).lanes.flatMap((lane: { events: unknown[] }) => lane.events)).toHaveLength(1);
    await expect(panel).toContainText('示例已保存到本机');
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await openEditorWorkspace(page, 'transcription');
    await expect(panel.getByTestId('sound-example-match')).toHaveCount(first.matches.length);
    await expect(panel.getByTestId('sound-example-match').first().getByLabel('勾选检索候选')).toBeChecked();
    await panel.getByTestId('sound-example-search').click();
    await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    await expect(panel).toContainText('复用已校验索引');
    await expect
        .poll(async () => (await profiles(page))[0]?.matches.map(m => m.id))
        .toEqual(first.matches.map(m => m.id));
    await panel.getByLabel('声音示例类型').selectOption('range');
    await panel.getByLabel('声音示例作用').selectOption('negative');
    await panel.getByLabel('声音示例起点').fill('6');
    await panel.getByLabel('声音示例终点').fill('7.12');
    await panel.getByTestId('sound-example-add').click();
    await panel.getByTestId('sound-example-search').click();
    await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: 60000 });
    const negative = (await profiles(page))[0]!;
    expect(negative.examples).toHaveLength(2);
    expect(negative.matches.some(m => Math.abs(m.startSeconds - 4) < 0.12)).toBe(true);
    expect(negative.matches.some(m => Math.abs(m.startSeconds - 6) < 0.2)).toBe(false);
    await panel.getByRole('button', { name: '清理当前索引', exact: true }).click();
    await panel.getByTestId('sound-example-search').click();
    await panel.getByTestId('sound-example-cancel').click();
    await expect(panel).toHaveAttribute('data-state', 'cancelled');
    await expect.poll(() => page.workers().filter(worker => worker.url().includes('example.worker')).length).toBe(0);
    expect((await project(page)).lanes.flatMap((lane: { events: unknown[] }) => lane.events)).toHaveLength(1);
    await openEditorWorkspace(page, 'marking');
    await page.getByTestId('tempo-bpm-0').fill('120');
    await page.getByTestId('tempo-bpm-0').press('Enter');
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 0.5);
    await page.getByTestId('marker-use-sound-example').click();
    await expect(panel.getByLabel('声音示例类型')).toHaveValue('point');
    await expect(panel.getByLabel('声音示例起点')).toHaveValue('0.5');
    await panel.getByLabel('声音示例作用').selectOption('positive');
    await panel.getByTestId('sound-example-add').click();
    await expect.poll(async () => (await profiles(page))[0]?.examples.some(e => !!e.markerId)).toBe(true);
    expect(modelRequests).toEqual([]);
    expect(errors).toEqual([]);
    await fs.writeFile(path.join(directory, 'negative-profile.json'), JSON.stringify(negative, null, 2), 'utf8');
    await page.screenshot({ path: path.join(directory, 'examples-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: path.join(directory, 'examples-390.png'), fullPage: true });
});
