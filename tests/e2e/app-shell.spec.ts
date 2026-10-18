import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const TAGGED_AUDIO = path.join(ROOT, 'artifacts/fixtures/home-details.mp3');
const LONG_AUDIO = path.join(ROOT, 'artifacts/fixtures/home-long-title.mp3');
const LONG_TITLE = '一首名称很长的歌曲，用来确认完整歌曲信息能够换行显示，而不会挤压导航和播放器。'.repeat(3);

const syncSafe = (value: number) => Buffer.from([
    (value >> 21) & 127, (value >> 14) & 127, (value >> 7) & 127, value & 127,
]);
const frame = (id: string, payload: Buffer) => Buffer.concat([
    Buffer.from(id), syncSafe(payload.length), Buffer.alloc(2), payload,
]);
test.beforeAll(async () => {
    // ID3v2.4 tags exercise the production parser and its artwork URL lifecycle.
    const audio = await readFile(path.join(ROOT, 'tests/fixtures/audio/format-master.mp3'));
    const artwork = await readFile(path.join(ROOT, 'public/default_cover.png'));
    const makeTaggedAudio = (title: string) => {
        const tags = Buffer.concat([
            frame('TIT2', Buffer.concat([Buffer.from([3]), Buffer.from(title)])),
            frame('TPE1', Buffer.concat([Buffer.from([3]), Buffer.from('测试艺人')])),
            frame('TALB', Buffer.concat([Buffer.from([3]), Buffer.from('测试专辑')])),
            frame('APIC', Buffer.concat([Buffer.from([0]), Buffer.from('image/png\0'), Buffer.from([3, 0]), artwork])),
        ]);
        return Buffer.concat([Buffer.from('ID3'), Buffer.from([4, 0, 0]), syncSafe(tags.length), tags, audio]);
    };
    await mkdir(path.dirname(TAGGED_AUDIO), { recursive: true });
    await writeFile(TAGGED_AUDIO, makeTaggedAudio('测试歌曲'));
    await writeFile(LONG_AUDIO, makeTaggedAudio(LONG_TITLE));
});

const captureIssues = (page: Page) => {
    const issues: string[] = [];
    page.on('pageerror', error => issues.push(error.message));
    page.on('console', message => {
        if (['error', 'warning', 'warn'].includes(message.type())) issues.push(message.text());
    });
    return issues;
};
const sidebarWidth = (page: Page) => page.locator('#app-sidebar').evaluate(element => element.getBoundingClientRect().width);

test('keeps icon-only settings at the top right and rectangular playback above the sidebar', async ({ page }) => {
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    const settings = page.getByTestId('app-settings');
    await expect(settings).toHaveAccessibleName('设置');
    await expect(settings).toHaveText('');
    expect(await settings.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { top: rect.top, right: innerWidth - rect.right };
    })).toEqual({ top: 12, right: 12 });
    await settings.click();
    await expect(settings).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('change-musicbar-style').click();
    await page.getByTestId('change-musicbar-style').click();
    await expect(page.locator('#progress-bar-container')).not.toHaveClass(/progress-bar-hidden/);
    for (const collapsed of [false, true, false]) {
        if (await page.locator('#app-sidebar').getAttribute('data-collapsed') !== String(collapsed)) {
            await page.getByTestId('sidebar-toggle').click();
        }
        await expect.poll(() => page.locator('#music-bar').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, width: rect.width };
        })).toEqual({ left: 0, width: 1280 });
        expect(await page.locator('#music-bar').evaluate(element => {
            const rect = element.getBoundingClientRect();
            return Boolean(document.elementFromPoint(16, rect.top + rect.height / 2)?.closest('#music-bar'));
        })).toBe(true);
    }
    expect(issues).toEqual([]);
});

test('persists desktop collapse while transport keeps its viewport width', async ({ page }) => {
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect.poll(() => sidebarWidth(page)).toBe(216);
    await expect(page.getByTestId('sidebar-home-link')).toHaveAttribute('aria-current', 'page');
    await page.getByTestId('sidebar-toggle').click();
    await expect.poll(() => sidebarWidth(page)).toBe(64);
    await expect.poll(() => page.locator('.home-rays').evaluate(element =>
        parseFloat((element.querySelector('canvas') as HTMLCanvasElement).style.width) === element.clientWidth,
    )).toBe(true);
    await expect(page.getByRole('link', { name: 'Analyzer', exact: true })).toHaveAttribute('title', 'Analyzer');
    await page.reload();
    await expect.poll(() => sidebarWidth(page)).toBe(64);
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Analyzer', exact: true })).toHaveAttribute('aria-current', 'page');
    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const collapsed of [true, false]) {
            if (await page.locator('#app-sidebar').getAttribute('data-collapsed') !== String(collapsed)) {
                await page.getByTestId('sidebar-toggle').click();
            }
            await expect.poll(() => sidebarWidth(page)).toBe(collapsed ? 64 : 216);
            const geometry = await page.evaluate(() => {
                const sidebar = document.querySelector('#app-sidebar')!.getBoundingClientRect();
                const content = document.querySelector('.app-content')!.getBoundingClientRect();
                const player = document.querySelector('#music-bar')!.getBoundingClientRect();
                return { contentLeft: content.left, sidebarRight: sidebar.right,
                    playerInside: player.left >= 0 && player.right <= innerWidth,
                    playerLeft: player.left, playerWidth: player.width,
                    overflow: document.documentElement.scrollWidth - innerWidth };
            });
            expect(geometry.contentLeft).toBe(geometry.sidebarRight);
            expect(geometry.playerInside).toBe(true);
            expect(geometry.playerLeft).toBe(32);
            expect(geometry.playerWidth).toBe(width - 64);
            expect(geometry.overflow).toBe(0);
        }
    }
    expect(issues).toEqual([]);
});

test('hides narrow navigation and restores focus after dismissal without changing desktop preference', async ({ page }) => {
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const opener = page.getByTestId('sidebar-open');
    const sidebar = page.locator('#app-sidebar');
    await expect(sidebar).not.toBeVisible();
    expect(await page.locator('.app-content').evaluate(element => element.getBoundingClientRect().left)).toBe(0);
    await opener.click();
    await expect(sidebar).toBeVisible();
    expect(await sidebar.evaluate(element => element.matches(':modal'))).toBe(false);
    await expect(page.getByTestId('sidebar-toggle')).toBeFocused();
    const playback = page.getByTestId('toggle-playback');
    expect(await playback.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return Boolean(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
            ?.closest('#music-bar-container'));
    })).toBe(true);
    await playback.focus();
    await expect(playback).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(sidebar).not.toBeVisible();
    await expect(opener).toBeFocused();
    await opener.click();
    await page.mouse.click(370, 250);
    await expect(sidebar).not.toBeVisible();
    await opener.click();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(page).toHaveURL(/\/analyzer$/);
    await expect(sidebar).not.toBeVisible();
    await page.reload();
    await expect(sidebar).not.toBeVisible();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect.poll(() => sidebarWidth(page)).toBe(216);
    expect(issues).toEqual([]);
});

test('shows live metadata and embedded artwork through import, replacement and paused recovery', async ({ page }) => {
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    const title = page.getByTestId('home-song-title');
    const cover = page.getByTestId('home-song-cover');
    await expect(title).toHaveText('未选择歌曲');
    await expect(page.getByRole('button', { name: '详情', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '待完善', exact: true })).toBeDisabled();
    await chooseFiles(page, [TAGGED_AUDIO]);
    await expect(title).toHaveText('测试歌曲');
    await expect(page.locator('.song-metadata')).toContainText('测试艺人');
    await expect(page.locator('.song-metadata')).toContainText('测试专辑');
    await expect(cover).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => cover.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const oldArtwork = await cover.getAttribute('src');
    await chooseFiles(page, [path.join(ROOT, 'tests/fixtures/audio/format-master.wav')]);
    await expect(title).toHaveText('测试歌曲');
    await page.getByTestId('next-track').click();
    await expect(title).toHaveText('format-master.wav');
    await expect(page.locator('.song-metadata')).toHaveText('未知艺术家');
    await expect(cover).toHaveAttribute('src', '/default_cover.png');
    await page.getByTestId('previous-track').click();
    await expect(title).toHaveText('测试歌曲');
    await expect(cover).toHaveAttribute('src', oldArtwork!);
    await page.reload();
    await expect(title).toHaveText('测试歌曲');
    await expect(cover).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('clear-queue').click();
    await expect(title).toHaveText('未选择歌曲');
    await expect(cover).toHaveAttribute('src', '/default_cover.png');
    expect(issues).toEqual([]);
});

test('retains the open narrow menu when Editor navigation is cancelled', async ({ page }) => {
    const issues = captureIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [path.join(ROOT, 'tests/fixtures/audio/format-master.wav')]);
    await page.getByTestId('sidebar-open').click();
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('add-marker-lane').click(); await page.getByTestId('add-point-lane').click();
    await page.getByTestId('sidebar-open').click();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(page.getByTestId('editor-leave-dialog')).toBeVisible();
    await page.getByTestId('editor-leave-stay').click();
    await expect(page).toHaveURL(/\/editor\//);
    await expect(page.locator('#app-sidebar')).toBeVisible();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/\/analyzer$/);
    await expect(page.locator('#app-sidebar')).not.toBeVisible();
    expect(issues).toEqual([]);
});

test('wraps long titles, survives an artwork error and retains usable playback across all styles', async ({ page }) => {
    const issues = captureIssues(page);
    await installFilePickerStub(page);
    await page.goto('/');
    const cover = page.getByTestId('home-song-cover');
    await cover.evaluate(element => {
        (window as typeof window & { __oldArtwork?: Element }).__oldArtwork = element;
    });
    await chooseFiles(page, [LONG_AUDIO]);
    await expect(page.getByTestId('home-song-title')).toHaveText(LONG_TITLE);
    await expect(cover).toHaveAttribute('src', /^blob:/);
    await cover.dispatchEvent('error');
    await expect(cover).toHaveAttribute('src', '/default_cover.png');
    await page.evaluate(() => {
        (window as typeof window & { __oldArtwork?: Element }).__oldArtwork?.dispatchEvent(new Event('error'));
    });
    await expect(cover).toHaveAttribute('src', '/default_cover.png');
    for (const width of [390, 1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of [0, 1, 2]) {
            await expect(page.locator('#music-bar-container')).toHaveClass(new RegExp(`bg-style-${mode}`));
            await expect.poll(async () => page.evaluate(() => {
                const sidebarInset = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-sidebar-inset'));
                const player = document.querySelector('#music-bar')!.getBoundingClientRect();
                const title = document.querySelector('[data-testid="home-song-title"]')!.getBoundingClientRect();
                const progress = document.querySelector('[data-testid="playback-progress"]')!.getBoundingClientRect();
                return player.left >= -1 && player.right <= innerWidth + 1
                    && progress.left >= -1 && progress.right <= innerWidth + 1
                    && title.left >= sidebarInset - 1 && title.right <= innerWidth + 1
                    && document.documentElement.scrollWidth <= innerWidth;
            })).toBe(true);
            await expect(page.getByTestId('import-audio')).toBeVisible();
            await page.getByTestId('change-musicbar-style').click();
            await expect(page.locator('#progress-bar-container')).not.toHaveClass(/progress-bar-hidden/);
        }
    }
    expect(issues).toEqual([]);
});

test('uses uniform MusicBar action icons and keeps queue keyboard navigation local', async ({ page }) => {
    const issues = captureIssues(page);
    await installFilePickerStub(page); await page.goto('/');
    for (const width of [390, 1024, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const style of [0, 1, 2]) {
            await expect(page.locator('#music-bar-container')).toHaveClass(new RegExp(`bg-style-${style}`));
            const geometry = await page.locator('.musicbar-action').evaluateAll(buttons => buttons.map(button => {
                const box = button.getBoundingClientRect(), icon = button.querySelector('svg')!;
                const glyph = icon.getBoundingClientRect();
                return { width: box.width, height: box.height, iconWidth: glyph.width, iconHeight: glyph.height,
                    stroke: icon.getAttribute('stroke-width'), inside: box.left >= 0 && box.right <= innerWidth };
            }));
            expect(geometry).toHaveLength(6);
            expect(new Set(geometry.map(item => `${item.width}:${item.height}:${item.iconWidth}:${item.iconHeight}:${item.stroke}`)).size).toBe(1);
            expect(geometry.every(item => item.inside)).toBe(true);
            await page.getByTestId('change-musicbar-style').click();
            await expect(page.locator('#progress-bar-container')).not.toHaveClass(/progress-bar-hidden/);
        }
    }
    await page.screenshot({ path: 'artifacts/visualizer-composition/musicbar-icons.png' });
    const mode = page.getByTestId('playback-mode');
    const icons = [];
    for (const label of ['顺序播放', '单曲循环', '列表循环', '随机播放']) {
        await expect(mode).toHaveAttribute('aria-label', label);
        icons.push(await mode.locator('svg').innerHTML()); await mode.click();
    }
    expect(new Set(icons).size).toBe(4);
    const volume = page.getByTestId('volume-control');
    await volume.focus(); await page.keyboard.press('Home');
    await expect(volume).toHaveAttribute('aria-valuenow', '0');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-volume', '0');
    await page.keyboard.press('ArrowUp'); await expect(volume).toHaveAttribute('aria-valuenow', '5');
    await page.keyboard.press('End'); await expect(volume).toHaveAttribute('aria-valuenow', '100');
    expect(await page.getByTestId('change-musicbar-style').locator('svg').innerHTML()).not.toBe(icons[2]);
    await chooseFiles(page, [path.join(ROOT, 'tests/fixtures/audio/format-master.wav'), path.join(ROOT, 'tests/fixtures/audio/format-master.mp3')]);
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('toggle-queue')).toHaveAttribute('aria-expanded', 'true');
    const rows = page.getByTestId('queue-item');
    await rows.first().focus(); await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    const id = await rows.nth(1).getAttribute('data-track-id');
    await page.keyboard.press('Enter');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-track-id', id!);
    expect(issues).toEqual([]);
});
