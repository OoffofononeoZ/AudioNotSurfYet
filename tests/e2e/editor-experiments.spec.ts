import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

test('experimental workspaces confirm separately, cancel with focus and reset on a new page session', async ({ page }, info) => {
    const issues: string[] = [];
    page.on('pageerror', error => issues.push(error.message));
    page.on('console', message => { if (['error', 'warning', 'warn'].includes(message.type())) issues.push(message.text()); });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await expect(page.getByTestId('editor-toolbar').locator('.editor-exp-badge')).toHaveText(['exp', 'exp']);
    await expect(page.getByTestId('editor-separation-tab')).toHaveAccessibleName('音轨分离（实验性）');

    await page.getByTestId('editor-marking-tab').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('editor-separation-notice')).toBeVisible();
    await expect(page.getByTestId('editor-separation')).toBeHidden();
    await page.getByTestId('editor-separation-notice').getByTestId('editor-experiment-cancel').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('editor-marking-tab')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('editor-separation-notice')).toBeVisible();
    await page.getByTestId('editor-separation-continue').click();
    await expect(page.locator('#editor-separation-panel')).toBeFocused();
    await expect(page.getByTestId('editor-separation')).toBeVisible();
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-state', 'idle');
    await page.getByTestId('editor-separation').evaluate(element => element.setAttribute('data-retained-node', 'yes'));

    await page.getByTestId('editor-separation-tab').focus();
    await page.keyboard.press('End');
    await expect(page.getByTestId('editor-transcription-notice')).toBeVisible();
    await expect(page.getByTestId('editor-transcription')).toBeHidden();
    for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(page.getByTestId('editor-transcription-continue')).toBeInViewport();
        await page.screenshot({ path: info.outputPath(`experimental-notice-${width}.png`) });
    }
    await page.getByTestId('editor-transcription-continue').click();
    await expect(page.locator('#editor-transcription-panel')).toBeFocused();
    await expect(page.getByTestId('transcription-start')).toBeDisabled();
    await expect(page.getByRole('group', { name: '自动标记分析输入' }).getByRole('checkbox')).toHaveCount(5);
    await page.getByRole('button', { name: '清理辅助音频与候选缓存', exact: true }).click();
    const confirmation = page.getByRole('group', { name: '确认清理自动标记缓存' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: '取消', exact: true }).click();
    await expect(confirmation).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

    await page.getByTestId('editor-separation-tab').click();
    await expect(page.getByTestId('editor-separation-notice')).toHaveCount(0);
    await expect(page.getByTestId('editor-separation')).toHaveAttribute('data-retained-node', 'yes');
    await page.getByTestId('editor-transcription-tab').click();
    await expect(page.getByTestId('editor-transcription-notice')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('editor-transcription-tab').click();
    await expect(page.getByTestId('editor-transcription-notice')).toBeVisible();
    expect(issues).toEqual([]);
});
