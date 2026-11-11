import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { THREE_D_FEATURE_IDS } from '../../src/analysis/threeDFeatures';

const fixture = path.resolve(import.meta.dirname, '../fixtures/audio/format-master.wav');
const plot = (page: Page) => page.getByTestId('three-d-plot');
const expand = (page: Page, id: string) =>
    page.locator(`.original-list [data-feature-id="${id}"] .toggle-card`).click();
const ready = async (page: Page) => {
    await expect(plot(page)).toHaveCount(1);
    await expect(plot(page).locator('.three-d-message')).toHaveCount(0, { timeout: 45000 });
    await expect(plot(page)).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
};
async function setup(page: Page) {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await installFilePickerStub(page);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto('/analyzer');
    await chooseFiles(page, [fixture]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 20000,
    });
    await page.getByTestId('toggle-playback').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'paused');
    await page.getByTestId('playback-progress').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', '0');
    await page.locator('[data-source="original-3d"]').click();
    return errors;
}
const viewport = async (page: Page) => ({
    zoom: Number(await plot(page).getAttribute('data-zoom')),
    start: Number(await plot(page).getAttribute('data-start')),
    end: Number(await plot(page).getAttribute('data-end')),
});

test('retains the entire song and seeks outside the time window after panning', async ({ page }, info) => {
    const errors = await setup(page);
    await expand(page, 'amplitudeSpectrum');
    await ready(page);
    const chart = plot(page),
        stage = chart.locator('.three-d-stage');
    const duration = Number(await chart.getAttribute('data-end'));
    await chart.getByRole('button', { name: '切换伪2D图表' }).click();
    await expect(chart).toHaveAttribute('data-view', 'orthographic');
    const box = (await stage.boundingBox())!;
    for (let i = 0; i < 18; i++)
        await stage.dispatchEvent('wheel', {
            deltaY: -120,
            clientX: box.x + box.width * 0.25,
            clientY: box.y + box.height / 2,
            bubbles: true,
            cancelable: true,
        });
    await expect.poll(async () => Number(await chart.getAttribute('data-columns'))).toBeGreaterThan(0);
    await page.waitForTimeout(400);
    await ready(page);
    await expect.poll(async () => Number(await chart.getAttribute('data-detail-step'))).toBeLessThan(0.02);
    const saved = await viewport(page);
    await stage.dispatchEvent('pointerdown', {
        pointerId: 1,
        button: 0,
        clientX: box.x + box.width / 2,
        clientY: box.y + box.height / 2,
    });
    await stage.dispatchEvent('pointermove', {
        pointerId: 1,
        buttons: 1,
        clientX: box.x - box.width,
        clientY: box.y + box.height / 2,
    });
    await stage.dispatchEvent('pointerup', {
        pointerId: 1,
        button: 0,
        clientX: box.x - box.width,
        clientY: box.y + box.height / 2,
    });
    await expect.poll(async () => Number(await chart.getAttribute('data-visible-start'))).toBeGreaterThan(saved.end);
    await ready(page);
    expect(Number(await chart.getAttribute('data-grid-start'))).toBe(0);
    expect(Number(await chart.getAttribute('data-grid-end'))).toBeCloseTo(duration, 5);
    expect(Number(await chart.getAttribute('data-columns'))).toBeLessThanOrEqual(512);
    await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect
        .poll(async () => Number(await page.locator('#music-bar-container').getAttribute('data-current-time')))
        .toBeGreaterThan(saved.end);
    await chart.screenshot({ path: `test-results/3d-full-song-pan-${info.project.name}.png` });
    expect(errors).toEqual([]);
});

test('renders all seven features and replaces the sole active input', async ({ page }, info) => {
    test.setTimeout(150000);
    const errors = await setup(page);
    await expect(page.locator('.analysis-card')).toHaveCount(7);
    await expect(page.locator('.analyzer-status')).toContainText('0/1 项');
    for (const id of THREE_D_FEATURE_IDS) {
        await expand(page, id);
        await ready(page);
        await expect(page.locator('.pinned-panel .analysis-card')).toHaveCount(1);
        await expect(page.locator('.pinned-panel .analysis-card')).toHaveAttribute('data-feature-id', id);
        await expect(page.locator('.analyzer-status')).toContainText('1/1 项');
        const inputs = await page.evaluate(() => (window as any).__AUDIO_NOT_SURF_YET_M6__.getState().activeFeatureIds);
        expect(inputs).toEqual([id]);
        if (id === 'amplitudeSpectrum' || id === 'wallpaperEngineSpectrum')
            await plot(page).screenshot({ path: `test-results/3d-${id}-${info.project.name}.png` });
        if (id === 'complexSpectrum') {
            await plot(page).getByRole('button', { name: '相位', exact: true }).click();
            await ready(page);
            await expect(plot(page).getByRole('button', { name: '相位', exact: true })).toHaveAttribute(
                'aria-pressed',
                'true',
            );
        }
    }
    await page.locator('.pinned-panel .toggle-card').click();
    await expect(plot(page)).toHaveCount(0);
    expect(errors).toEqual([]);
});

test('separates camera zoom from pointer-anchored time zoom and supports fixed orthographic slices', async ({
    page,
}, info) => {
    test.setTimeout(90000);
    const errors = await setup(page);
    await expand(page, 'wallpaperEngineSpectrum');
    await ready(page);
    const chart = plot(page),
        stage = chart.locator('.three-d-stage');
    const initial = await viewport(page);
    await chart.getByRole('button', { name: '放大图表', exact: true }).click();
    await expect(chart).toHaveAttribute('data-camera-zoom', '1.2');
    expect(await viewport(page)).toEqual(initial);
    const before = await stage.screenshot();
    const rect = (await stage.boundingBox())!;
    const seconds = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.mouse.move(rect.x + rect.width * 0.5, rect.y + rect.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.5 + 45, rect.y + rect.height * 0.5 + 12, { steps: 5 });
    await page.mouse.up();
    expect(await page.locator('#music-bar-container').getAttribute('data-current-time')).toBe(seconds);
    expect((await stage.screenshot()).equals(before)).toBe(false);
    const panned = await stage.screenshot();
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(rect.x + rect.width * 0.5 + 95, rect.y + rect.height * 0.5 + 32, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    expect((await stage.screenshot()).equals(panned)).toBe(false);
    await chart.getByRole('button', { name: '切换伪2D图表' }).click();
    await ready(page);
    await expect(chart).toHaveAttribute('data-view', 'orthographic');
    await expect(chart).toHaveAttribute('data-camera-zoom', '1');
    const rail = chart.getByRole('slider', { name: '选择图表分量' });
    await rail.focus();
    await page.keyboard.press('End');
    await expect(rail).toHaveAttribute('aria-valuenow', '127');
    await expect(rail).toHaveAttribute('aria-valuetext', '右 R / 63');
    await page.keyboard.press('ArrowUp');
    await expect(rail).toHaveAttribute('aria-valuenow', '126');
    const rr = (await rail.boundingBox())!;
    await page.mouse.move(rr.x + rr.width - 3, rr.y + rr.height * 0.25);
    await page.mouse.down();
    await page.mouse.move(rr.x + rr.width - 3, rr.y + rr.height * 0.5, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => Number(await rail.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(63);
    await page.mouse.move(10, 10);
    const selected = await rail.getAttribute('aria-valuenow');
    await expect(rail).toHaveAttribute('aria-valuenow', selected!);
    await ready(page);
    const sr = (await stage.boundingBox())!;
    await page.mouse.move(sr.x + sr.width * 0.4, sr.y + sr.height * 0.55);
    await page.mouse.wheel(0, -120);
    await expect(chart).toHaveAttribute('data-zoom', '1.12');
    await expect(chart).toHaveAttribute('data-camera-zoom', '1');
    const changed = await viewport(page);
    const ratio = (changed.start - initial.start) / (initial.end - initial.start - (changed.end - changed.start));
    expect(ratio).toBeGreaterThan(0);
    expect(ratio).toBeLessThan(1);
    await stage.dispatchEvent('wheel', { deltaY: -120, ctrlKey: true, bubbles: true, cancelable: true });
    expect(await viewport(page)).toEqual(changed);
    await stage.focus();
    await page.keyboard.press('ArrowRight');
    await expect
        .poll(async () => Number(await page.locator('#music-bar-container').getAttribute('data-current-time')))
        .toBeGreaterThan(Number(seconds));
    await chart.screenshot({ path: `test-results/3d-slice-${info.project.name}.png` });
    await chart.getByRole('button', { name: '返回3D图表' }).click();
    await ready(page);
    await expect(chart).toHaveAttribute('data-camera-zoom', '1.2');
    expect(await viewport(page)).toEqual(changed);
    expect(errors).toEqual([]);
});

test('keeps 2D queues independent and restores the 3D selection and interval', async ({ page }) => {
    const errors = await setup(page);
    await page.locator('[data-source="original"]').click();
    await expand(page, 'rms');
    await expand(page, 'energy');
    await expect(page.locator('.plot-message')).toHaveCount(0, { timeout: 45000 });
    await page.locator('[data-source="original-3d"]').click();
    await expand(page, 'chroma');
    await ready(page);
    const stage = plot(page).locator('.three-d-stage'),
        rect = (await stage.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.wheel(0, -120);
    await expect(plot(page)).toHaveAttribute('data-zoom', '1.12');
    const interval = await viewport(page);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-persistence-state', 'ready');
    await page.reload();
    await ready(page);
    await expect(page.locator('[data-source="original-3d"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.pinned-panel .analysis-card')).toHaveAttribute('data-feature-id', 'chroma');
    expect(await viewport(page)).toEqual(interval);
    await page.locator('[data-source="original"]').click();
    await expect(page.locator('.pinned-panel .analysis-card')).toHaveCount(2);
    expect(
        await page
            .locator('.pinned-panel .analysis-card')
            .evaluateAll(els => els.map(el => el.getAttribute('data-feature-id'))),
    ).toEqual(['energy', 'rms']);
    await expect(page.locator('.plot').first()).toHaveAttribute('data-zoom', '1.12');
    await page.locator('[data-source="original-3d"]').click();
    await ready(page);
    expect(errors).toEqual([]);
});

test('keeps the last feature after rapid mode switches and a new track', async ({ page }) => {
    const errors = await setup(page);
    await expand(page, 'chroma');
    await ready(page);
    await page.evaluate(() => {
        for (const id of ['amplitudeSpectrum', 'powerSpectrum', 'mfcc'])
            document.querySelector<HTMLButtonElement>(`.original-list [data-feature-id="${id}"] .toggle-card`)!.click();
        document.querySelector<HTMLButtonElement>('[data-source="original"]')!.click();
        document.querySelector<HTMLButtonElement>('[data-source="original-3d"]')!.click();
    });
    await ready(page);
    await expect(page.locator('.pinned-panel .analysis-card')).toHaveAttribute('data-feature-id', 'mfcc');
    const previous = await page.locator('#music-bar-container').getAttribute('data-current-track-id');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/format-master.mp3')]);
    await page.getByTestId('toggle-queue').click();
    await expect(page.getByTestId('queue-count')).toHaveText('2');
    await page.getByTestId('toggle-queue').click();
    await page.getByTestId('next-track').click();
    await expect(page.locator('#music-bar-container')).not.toHaveAttribute('data-current-track-id', previous!);
    await ready(page);
    await expect(page.locator('.pinned-panel .analysis-card')).toHaveAttribute('data-feature-id', 'mfcc');
    expect(await page.evaluate(() => (window as any).__AUDIO_NOT_SURF_YET_M6__.getState().activeFeatureIds)).toEqual([
        'mfcc',
    ]);
    expect(errors).toEqual([]);
});

test('resizes, releases GPU contexts across route cycles and recovers from context loss', async ({ page }, info) => {
    test.setTimeout(150000);
    await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        const contexts: WebGLRenderingContext[] = [];
        (window as any).__threeDContexts = contexts;
        HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
            const result = (original as any).apply(this, args);
            if (
                String(args[0]).startsWith('webgl') &&
                this.closest('.three-d-stage') &&
                result &&
                !contexts.includes(result)
            )
                contexts.push(result);
            return result;
        } as typeof original;
    });
    const errors = await setup(page);
    await expand(page, 'amplitudeSpectrum');
    await ready(page);
    for (const width of [390, 1280, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect
            .poll(async () =>
                plot(page)
                    .locator('canvas')
                    .first()
                    .evaluate(canvas => {
                        const el = canvas as HTMLCanvasElement;
                        return Math.abs(el.width - el.clientWidth * devicePixelRatio);
                    }),
            )
            .toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
        const bounds = await page.evaluate(() => {
            const chart = document.querySelector('.three-d-plot')!.getBoundingClientRect();
            const handle = document.querySelector('.pinned-resize-handle')!.getBoundingClientRect();
            return { bottom: chart.bottom, handleTop: handle.top };
        });
        expect(bounds.bottom).toBeLessThanOrEqual(bounds.handleTop + 1);
        await plot(page).screenshot({ path: `test-results/3d-${width}-${info.project.name}.png` });
    }
    for (let i = 0; i < 10; i++) {
        await page.getByRole('link', { name: '首页', exact: true }).click();
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).__threeDContexts.filter((gl: WebGLRenderingContext) => !gl.isContextLost())
                            .length,
                ),
            )
            .toBe(0);
        await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
        await ready(page);
        await expect
            .poll(() =>
                page.evaluate(
                    () =>
                        (window as any).__threeDContexts.filter((gl: WebGLRenderingContext) => !gl.isContextLost())
                            .length,
                ),
            )
            .toBe(1);
    }
    await page.evaluate(() => {
        const contexts = (window as any).__threeDContexts as WebGLRenderingContext[];
        contexts
            .find(gl => !gl.isContextLost())!
            .getExtension('WEBGL_lose_context')!
            .loseContext();
    });
    await expect(plot(page).getByRole('alert')).toContainText('图形上下文已丢失');
    await plot(page).getByRole('button', { name: '重试图表' }).click();
    await ready(page);
    expect(errors).toEqual([]);
});
