import { type Page } from '@playwright/test';

export async function openEditorWorkspace(page: Page, workspace: 'marking' | 'separation' | 'transcription') {
    await page.getByTestId(`editor-${workspace}-tab`).click();
    const entry = page.getByTestId(`editor-${workspace}-continue`);
    if (await entry.isVisible()) await entry.click();
}
