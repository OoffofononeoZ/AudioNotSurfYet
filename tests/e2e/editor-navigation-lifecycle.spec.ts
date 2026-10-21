import { expect, test, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { addMarkerLane } from '../support/editor-marking';

async function open(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(
        page,
        ['format-master.wav', 'format-master.mp3'].map(name => path.resolve('tests/fixtures/audio', name)),
    );
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
}

test('tabs and cancelled selection retain a running task; confirmed selection releases it', async ({ page }) => {
    const requests: Route[] = [];
    await page.route('https://huggingface.co/StemSplitio/**', route => {
        requests.push(route);
    });
    await open(page);
    const original = await page.locator('#music-bar-container').getAttribute('data-current-track-id');
    await page.getByTestId('editor-separation-tab').click();
    await page.getByRole('button', { name: '了解，继续', exact: true }).click();
    await page.getByTestId('editor-separate-start').click();
    await expect.poll(() => requests.length).toBe(1);
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    for (const name of ['transcription', 'marking', 'separation']) await page.getByTestId(`editor-${name}-tab`).click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    expect(requests.length).toBe(1);
    await page.getByTestId('toggle-queue').click();
    const target = page.getByTestId('queue-item').nth(1);
    await target.click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'running');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', original!);
    await target.click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.locator('#music-bar-container')).not.toHaveAttribute('data-current-track-id', original!);
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'idle');
    for (const request of requests) await request.fulfill({ status: 503, body: 'late old response' }).catch(() => {});
    await expect(page.getByTestId('editor-stem-results')).toHaveCount(0);
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'idle');
});

test('deleting the final current song enters empty state and preserves its Editor draft', async ({ page }) => {
    await open(page);
    await addMarkerLane(page, 'point');
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    await page.getByTestId('toggle-queue').click();
    await expect(page.locator('.music-list-container')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    const items = page.getByTestId('queue-item');
    await items.nth(1).hover();
    await items.nth(1).getByTestId('delete-track').click();
    await expect(items).toHaveCount(1);
    await expect(page.getByTestId('editor-track-change-dialog')).not.toBeVisible();
    await items.first().hover();
    await items.first().getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-cancel').click();
    await expect(items).toHaveCount(1);
    await items.first().hover();
    await items.first().getByTestId('delete-track').click();
    await page.getByTestId('editor-track-change-confirm').click();
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    const laneCount = await page.evaluate(async () => {
        const url = '/src/editor/editorDraftRepository.ts';
        const { EditorDraftRepository } = await import(url);
        const repository = new EditorDraftRepository();
        try {
            return (await repository.restore())?.project.lanes.length;
        } finally {
            repository.close();
        }
    });
    expect(laneCount).toBe(1);
});
