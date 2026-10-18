import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

async function openEditor(page: Page) {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.resolve('tests/fixtures/audio/format-master.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton', { name: '辅助 BPM', exact: true });
    await bpm.fill('120'); await bpm.press('Enter');
}

test('beat rail, compact timing, explicit Tap and independent full-song waveform', async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await openEditor(page);
    await expect(page.getByTestId('toggle-editor-timing')).toHaveAttribute('aria-expanded', 'true');
    const panel = page.getByTestId('editor-timing-panel');
    const geometry = await panel.evaluate(element => ({ height: element.getBoundingClientRect().height, parent: document.querySelector('#editor-marking-panel')!.getBoundingClientRect().height }));
    expect(geometry.height).toBeLessThanOrEqual(Math.min(280, geometry.parent * .35) + 1);
    for (const id of ['editor-reveal-playback', 'add-tempo-boundary']) {
        const bounds = await page.getByTestId(id).boundingBox();
        expect(bounds?.width).toBe(30); expect(bounds?.height).toBe(30);
    }
    await page.evaluate(() => {
        const original = performance.now.bind(performance); let time = 10000;
        performance.now = () => time;
        try { for (let i = 0; i < 8; i++) { time += 500; document.querySelector<HTMLButtonElement>('[data-testid="timing-tap"]')!.click(); } }
        finally { performance.now = original; }
    });
    await expect(page.getByTestId('timing-tap-preview')).toHaveText('120 BPM');
    await page.getByTestId('timing-apply-tap').click();
    await page.getByTestId('toggle-editor-timing').click();
    await expect(panel).toHaveCount(0);
    const state = page.getByTestId('editor-viewport-state'), full = await state.textContent();
    const waveform = page.getByTestId('editor-timeline');
    await waveform.hover(); await page.mouse.wheel(0, -500);
    await expect(state).not.toHaveText(full!);
    await waveform.click({ button: 'right', position: { x: 30, y: 40 } });
    await page.getByRole('menuitem', { name: '重置为全曲' }).click();
    await expect(state).toHaveText(full!);
    await page.reload(); await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(state).toHaveText(full!);
    await expect(page.getByTestId('toggle-editor-timing')).toHaveAttribute('aria-expanded', 'false');
    expect(errors).toEqual([]);
});
