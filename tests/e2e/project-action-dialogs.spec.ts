import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, savedPickerEntries } from '../support/file-picker';
const audio = path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav');
test.use({ viewport: { width: 1280, height: 900 } });
async function countPickers(page: Page) {
    await page.evaluate(() => {
        const host = window as any;
        host.actionPickers = { open: 0, save: 0, active: false };
        for (const [key, method] of [
            ['open', 'showOpenFilePicker'],
            ['save', 'showSaveFilePicker'],
        ]) {
            const original = host[method!];
            host[method!] = (...args: unknown[]) => {
                host.actionPickers[key!]++;
                host.actionPickers.active = navigator.userActivation.isActive;
                return original(...args);
            };
        }
    });
}
const pickers = (page: Page) => page.evaluate(() => (window as any).actionPickers);

test('Visualizer export chooses a type before file access and preserves the save gesture', async ({ page }, info) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await countPickers(page);
    const trigger = page.getByTestId('export-visualizer-project');
    await expect(page.locator('.viz-toolbar').getByTestId('realtime-style-actions')).toHaveCount(0);
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: '导出', exact: true });
    await expect(dialog).toBeVisible();
    expect(await pickers(page)).toMatchObject({ open: 0, save: 0 });
    await dialog.screenshot({
        path: `artifacts/visualizer-composition/action-dialogs/export-${info.project.name}.png`,
    });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByTestId('export-project-file').click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    expect(await pickers(page)).toMatchObject({ save: 1, active: true });
    await trigger.click();
    await page.getByTestId('realtime-style-actions').click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('dialog', { name: '实时样式', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
});

test('Editor without a song keeps osu available and project import explains its prerequisite', async ({
    page,
}, info) => {
    await installFilePickerStub(page);
    await page.goto('/editor');
    await countPickers(page);
    const trigger = page.getByTestId('import-editor-project');
    await expect(trigger).toBeEnabled();
    await expect(page.getByTestId('editor-toolbar').getByTestId('import-osu-beatmap')).toHaveCount(0);
    await trigger.click();
    await expect(page.getByTestId('import-project-file')).toBeDisabled();
    await expect(page.getByTestId('import-project-file')).toContainText('请先选择歌曲');
    await page
        .getByRole('dialog', { name: '导入', exact: true })
        .screenshot({ path: `artifacts/visualizer-composition/action-dialogs/import-empty-${info.project.name}.png` });
    await page.getByTestId('import-osu-beatmap').click();
    await expect(page.getByTestId('osu-import-dialog')).toBeVisible();
    expect(await pickers(page)).toMatchObject({ open: 0, save: 0 });
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
});

test('Editor project option opens the picker once and cancellation returns to the workspace', async ({ page }) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await countPickers(page);
    await page.getByTestId('import-editor-project').click();
    expect(await pickers(page)).toMatchObject({ open: 0, save: 0 });
    await page.getByTestId('import-project-file').click();
    await expect(page.getByRole('dialog', { name: '导入', exact: true })).toBeHidden();
    expect(await pickers(page)).toMatchObject({ open: 1, active: true });
    await expect(page.getByTestId('editor-ready')).toBeVisible();
});
