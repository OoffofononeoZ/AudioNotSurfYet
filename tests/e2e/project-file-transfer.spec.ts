import { chooseVisualizerProjectExport } from '../support/project-actions';
import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';

test('exports Editor JSON and imports it into Visualizer without changing the filename or data', async ({ page }) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('export-editor-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const saved = (await savedPickerEntries(page))[0]!;
    expect(saved.name).toBe('format-master.audiosurf-editor.json');
    const text = Buffer.from(saved.base64, 'base64').toString('utf8');
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByRole('tab', { name: 'Editor 数据', exact: true }).click();
    await page.getByRole('button', { name: '移除', exact: true }).click();
    await expect(page.getByText('未载入 Editor 数据', { exact: true })).toBeVisible();
    await queuePickerData(page, [{ name: saved.name, mimeType: 'application/json', text }]);
    await page.getByRole('button', { name: '导入 Editor JSON', exact: true }).click();
    await expect(page.getByText(/已载入同歌快照/)).toBeVisible();
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(2);
    const composition = (await savedPickerEntries(page))[1]!;
    expect(composition.name).toBe('format-master.audiosurf-visualizer.json');
    expect(JSON.parse(Buffer.from(composition.base64, 'base64').toString('utf8')).editorSnapshot.project).toEqual(
        JSON.parse(text),
    );
    await expect(page.getByRole('alert')).toHaveCount(0);
});
