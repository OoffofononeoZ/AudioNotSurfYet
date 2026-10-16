import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerFiles,
    savedPickerEntries,
} from '../support/file-picker';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_DIRECTORY = path.join(REPOSITORY_ROOT, 'tests/fixtures/audio');
const AUDIO_FILES = [
    path.join(AUDIO_DIRECTORY, 'format-master.wav'),
    path.join(AUDIO_DIRECTORY, 'format-master.mp3'),
];

const captureBrowserIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    return issues;
};

test('opens the current track from Header and preserves the E1 draft on refresh', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, AUDIO_FILES);

    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });
    const trackId = await musicBar.getAttribute('data-current-track-id');
    expect(trackId).toBeTruthy();

    await page.getByTestId('header-editor-link').click();
    await expect(page).toHaveURL(new RegExp(`/editor/${trackId}$`));
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('playback-mode')).toHaveAttribute('aria-label', /单曲循环/);
    await expect(musicBar).toBeVisible();

    const playbackToggle = page.getByTestId('toggle-playback');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveAttribute('aria-label', '播放');
    await playbackToggle.click();
    await expect(playbackToggle).toHaveAttribute('aria-label', '暂停');

    await page.getByTestId('export-editor-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length)
        .toBe(1);
    const exported = (await savedPickerEntries(page))[0]!;
    expect(exported.name).toBe('format-master.audiosurf-editor.json');
    const exportedProject = JSON.parse(
        Buffer.from(exported.base64, 'base64').toString('utf8'),
    ) as { format: string; schemaVersion: number; track: { contentHash: string } };
    expect(exportedProject).toMatchObject({
        format: 'audiosurf-editor',
        schemaVersion: 1,
        track: { contentHash: expect.stringMatching(/^[a-f\d]{64}$/) },
    });

    await page.reload();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('editor-save-state')).toBeVisible();
    await expect(page.getByTestId('toggle-playback')).toHaveAttribute('aria-label', '播放');
    await expect(page.getByTestId('playback-progress')).toHaveAttribute('aria-valuetext', /0:00/);
    await expect(musicBar).toBeVisible();
    expect(issues).toEqual([]);
});

test('uses the playlist “去编辑” entry and protects a different-song draft', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, AUDIO_FILES);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20_000,
    });
    const firstTrackId = await musicBar.getAttribute('data-current-track-id');

    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-state="saved"]')).toBeVisible();
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(musicBar).toBeVisible();

    await page.getByTestId('toggle-queue').click();
    await expect(page.locator('.music-list-container')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    const items = page.getByTestId('queue-item');
    await expect(items).toHaveCount(2);
    await items.nth(1).hover();
    const editButton = items.nth(1).getByTestId('edit-track');
    await editButton.hover();
    await expect(page.getByRole('tooltip')).toContainText('去编辑');
    const secondTrackId = await items.nth(1).getAttribute('data-track-id');
    await editButton.click();

    await expect(page).toHaveURL(new RegExp(`/editor/${secondTrackId}$`));
    await expect(page.getByTestId('editor-draft-conflict')).toBeVisible({
        timeout: 20_000,
    });
    await expect(musicBar).toBeVisible();
    await page.getByTestId('cancel-editor-entry').click();
    await expect(page).toHaveURL(new RegExp(`/editor/${firstTrackId}$`));
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await expect(page.getByTestId('editor-save-state')).toBeVisible();
    expect(issues).toEqual([]);
});

test('keeps invalid project import atomic and exposes recovery for an invalid route', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILES[0]!]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible({ timeout: 20_000 });
    const title = await page.locator('#music-info-container').textContent();

    const invalidPath = path.join(
        REPOSITORY_ROOT,
        'docs/quality/editor/golden-examples.md',
    );
    await queuePickerFiles(page, [invalidPath]);
    await page.getByTestId('import-editor-project').click();
    await expect(page.locator('.el-message--error')).toBeVisible();
    await expect(page.locator('#music-info-container')).toHaveText(title ?? '');

    await page.goto('/editor/missing-track');
    await expect(page.getByTestId('editor-unavailable')).toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});

test('shows the empty Editor route without hiding recovery playback controls', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/editor');
    await expect(page.getByTestId('editor-empty')).toBeVisible();
    await expect(page.locator('#music-bar-container')).toBeVisible();
    expect(issues).toEqual([]);
});
