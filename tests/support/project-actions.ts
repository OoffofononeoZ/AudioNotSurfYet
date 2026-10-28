import type { Page } from '@playwright/test';

async function choose(page: Page, opener: string, option: string) {
    await page.getByTestId(opener).click();
    await page.getByTestId(option).click();
}
export const chooseVisualizerProjectExport = (page: Page) =>
    choose(page, 'export-visualizer-project', 'export-project-file');
export const chooseEditorProjectImport = (page: Page) => choose(page, 'import-editor-project', 'import-project-file');
export const openRealtimeStyleExport = (page: Page) =>
    choose(page, 'export-visualizer-project', 'realtime-style-actions');
export const openOsuImport = (page: Page) => choose(page, 'import-editor-project', 'import-osu-beatmap');
