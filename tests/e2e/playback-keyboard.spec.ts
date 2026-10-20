import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { createOutputSyncWav } from '../support/visualizer-output-sync';

const player = (page: Page) => page.locator('#music-bar-container');
const browserErrors = new WeakMap<Page, string[]>();

async function focusPage(page: Page) {
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
}

async function loadTracks(page: Page, info: TestInfo) {
    const audio = info.outputPath('keyboard.wav');
    await writeFile(audio, createOutputSyncWav());
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio, path.resolve('tests/fixtures/audio/format-master.mp3')]);
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
}

async function toggleTwice(page: Page) {
    await page.keyboard.press('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await page.keyboard.press('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
}

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    const errors: string[] = [];
    browserErrors.set(page, errors);
    page.on('pageerror', error => errors.push(error.message));
});

test.afterEach(async ({ page }) => {
    expect(browserErrors.get(page)).toEqual([]);
});

test('empty queue consumes Space without scrolling or activating the focused button', async ({ page }) => {
    await page.goto('/');
    const queue = page.getByTestId('toggle-queue');
    await queue.focus();
    await page.keyboard.press('Space');
    await expect(queue).toHaveAttribute('aria-expanded', 'false');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'empty');
    await expect(player(page)).toHaveAttribute('data-current-track-id', '');

    await page.evaluate(() => {
        const spacer = document.createElement('div');
        spacer.style.height = '300vh';
        document.body.append(spacer);
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 200);
    });
    await focusPage(page);
    const before = await page.evaluate(() => window.scrollY);
    expect(before).toBeGreaterThan(0);
    await page.keyboard.press('Space');
    const after = await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return window.scrollY;
    });
    expect(after).toBe(before);
});

test('one binding follows routes, Editor controls and Visualizer fullscreen', async ({ page }, info) => {
    await loadTracks(page, info);
    await focusPage(page);
    await toggleTwice(page);
    for (const name of ['TestLands', 'Analyzer', 'AUDIOSURF']) {
        await page.getByRole('link', { name, exact: true }).click();
        await focusPage(page);
        await toggleTwice(page);
    }

    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('visualizer-preview-canvas').click();
    await toggleTwice(page);
    const fullscreen = page.getByTestId('visualizer-fullscreen-toggle');
    await fullscreen.click();
    await expect(page.getByTestId('visualizer-ready')).toHaveClass(/is-fullscreen/);
    await toggleTwice(page);
    await expect(fullscreen).toHaveAttribute('aria-label', '退出全屏播放');
    await fullscreen.press('Enter');
    await expect(page.getByTestId('visualizer-ready')).not.toHaveClass(/is-fullscreen/);

    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-ready')).toBeVisible();
    await page.getByTestId('editor-timeline').focus();
    await toggleTwice(page);
    await page.getByTestId('toggle-editor-timing').click();
    const tap = page.getByTestId('timing-tap');
    await tap.focus();
    await toggleTwice(page);
    await expect(tap).toContainText('Tap');
    await tap.press('Enter');
    await expect(tap).toContainText('1 次');
});

test('focused native and custom buttons use Space for playback and Enter for their own action', async ({
    page,
}, info) => {
    await loadTracks(page, info);
    const originalTrack = await player(page).getAttribute('data-current-track-id');
    const queue = page.getByTestId('toggle-queue');
    await queue.focus();
    await toggleTwice(page);
    await expect(queue).toHaveAttribute('aria-expanded', 'false');
    await queue.press('Enter');
    await expect(queue).toHaveAttribute('aria-expanded', 'true');
    const second = page.getByTestId('queue-item').nth(1);
    await second.focus();
    await toggleTwice(page);
    await expect(player(page)).toHaveAttribute('data-current-track-id', originalTrack!);
    await queue.press('Enter');
    await page.getByTestId('next-track').focus();
    await toggleTwice(page);
    await expect(player(page)).toHaveAttribute('data-current-track-id', originalTrack!);
    await page.getByTestId('toggle-playback').focus();
    await toggleTwice(page);
    await page.getByTestId('next-track').press('Enter');
    await expect(player(page)).not.toHaveAttribute('data-current-track-id', originalTrack!);
});

test('native inputs, editable descendants and custom editing roles keep their Space events', async ({ page }, info) => {
    await loadTracks(page, info);
    await page.evaluate(() => {
        const form = document.createElement('section');
        form.id = 'keyboard-input-fixture';
        form.innerHTML = `
            <input aria-label="test text" value="a">
            <input aria-label="test number" type="number" value="1">
            <input aria-label="test checkbox" type="checkbox">
            <input aria-label="test range" type="range">
            <textarea aria-label="test multiline">a</textarea>
            <select aria-label="test select"><option>a</option><option>b</option></select>
            <div contenteditable="true" aria-label="test editable"><span tabindex="0">a</span></div>
            <div role="textbox" tabindex="0" aria-label="test textbox"></div>
            <div role="searchbox" tabindex="0" aria-label="test searchbox"></div>
            <div role="combobox" tabindex="0" aria-label="test combobox"></div>
            <div role="spinbutton" tabindex="0" aria-label="test spinbutton"></div>`;
        form.addEventListener('keydown', event => {
            if (event.code === 'Space') (event.target as HTMLElement).dataset.receivedSpace = 'true';
        });
        document.body.append(form);
    });
    const targets = page.locator('#keyboard-input-fixture').locator('input,textarea,select,[tabindex="0"]');
    for (const target of await targets.all()) {
        await target.focus();
        await target.press('Space');
        await expect(target).toHaveAttribute('data-received-space', 'true');
        await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
        if ((await target.getAttribute('aria-label')) === 'test select') await page.keyboard.press('Escape');
    }
    await expect(page.getByLabel('test checkbox', { exact: true })).toBeChecked();
    await expect(page.getByLabel('test multiline', { exact: true })).toHaveValue(/ /);
    await page.locator('#keyboard-input-fixture').evaluate(element => element.remove());
    await focusPage(page);
    await toggleTwice(page);
});

test('held Space toggles once, consumes keyup and recovers after window blur', async ({ page }, info) => {
    await loadTracks(page, info);
    await page.getByTestId('toggle-queue').focus();
    await page.keyboard.down('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await page.keyboard.up('Space');
    await expect(page.getByTestId('toggle-queue')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');

    await page.keyboard.down('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'playing');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.keyboard.up('Space');
    await focusPage(page);
    await page.keyboard.press('Space');
    await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
});

test('modified Space and composition do not invoke the global playback shortcut', async ({ page }, info) => {
    await loadTracks(page, info);
    await focusPage(page);
    for (const modifier of ['Shift', 'Control', 'Alt', 'Meta']) {
        await page.keyboard.press(`${modifier}+Space`);
        await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
    }
    const prevented = await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', {
            key: ' ',
            code: 'Space',
            isComposing: true,
            bubbles: true,
            cancelable: true,
        });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
    });
    expect(prevented).toBe(false);
    await expect(player(page)).toHaveAttribute('data-playback-state', 'paused');
    await toggleTwice(page);
});
