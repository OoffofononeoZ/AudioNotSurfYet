import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';
import { expectAnalyzerMasonry } from '../support/analyzer-masonry';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'tests/fixtures/audio/format-master.wav',
);

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

test('removes the learning header and packs 21 stable cards at every viewport', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/analyzer');

    await expect(page.getByText('Analyzer learning workspace · M10'))
        .toHaveCount(0);
    await expect(page.getByRole('heading', {
        name: '用四张联动卡读懂声音特征',
    })).toHaveCount(0);
    await expect(page.getByText(/RMS 看响度变化/)).toHaveCount(0);

    const toolbar = page.locator('.timeline-toolbar');
    const status = toolbar.locator('.status-row');
    await expect(status).toHaveAttribute('aria-live', 'polite');
    await expect(status).toContainText('0/4 张展开卡');
    await expect(status).toContainText('展开卡片开始分析');
    await expect(toolbar.locator('.viewport-summary')).toContainText('共享视口');

    const geometries: Record<number, number> = {};
    for (const width of [390, 1_024, 1_280, 1_920]) {
        geometries[width] = (await expectAnalyzerMasonry(page, width)).columns;
    }
    expect(geometries).toEqual({
        390: 1,
        1024: 1,
        1280: 2,
        1920: 2,
    });

    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    await page.locator('[data-feature-id="rms"]')
        .getByRole('button', { name: '展开分析' })
        .click();
    await expect(status).toContainText('1/4 张展开卡');
    await expectAnalyzerMasonry(page, 1_280);
    await page.locator('[data-feature-id="rms"]')
        .getByRole('button', { name: '收起分析' })
        .click();
    await expect(status).toContainText('0/4 张展开卡');
    await expectAnalyzerMasonry(page, 1_280);

    await expectAnalyzerMasonry(page, 1_280, 720);
    await page.locator('.analyzer-content').evaluate((element) => {
        element.scrollTop = 360;
    });
    await expect.poll(async () => page.locator('.analyzer-content').evaluate(
        (element) => element.scrollTop,
    )).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('#main-header');
        const sticky = document.querySelector<HTMLElement>('.timeline-toolbar');
        if (!header || !sticky) return Number.POSITIVE_INFINITY;
        return Math.abs(
            sticky.getBoundingClientRect().top
            - header.getBoundingClientRect().bottom
            - 8,
        );
    })).toBeLessThanOrEqual(1);
    expect(issues).toEqual([]);
});

test('reflows measured structured cards without remounting details or canvases', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.setViewportSize({ width: 1_280, height: 900 });
    await page.goto('/analyzer');

    for (const featureId of [
        'rms', 'amplitudeSpectrum', 'loudness', 'complexSpectrum',
    ]) {
        await page.locator(`[data-feature-id="${featureId}"]`)
            .getByRole('button', { name: '展开分析' })
            .click();
    }
    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    await chooseFiles(page, [WAV_FIXTURE]);
    await expect(page.locator(
        '[data-feature-id="complexSpectrum"] .plot-message',
    )).toHaveCount(0, { timeout: 45_000 });
    await expectAnalyzerMasonry(page, 1_280);

    const complexCard = page.locator('[data-feature-id="complexSpectrum"]');
    const details = complexCard.locator('details');
    const summary = details.locator('summary');
    const beforeHeight = await complexCard.evaluate((element) =>
        element.getBoundingClientRect().height);
    await details.evaluate((element) => {
        (
            window as typeof window & { __m12DetailsIdentity?: Element }
        ).__m12DetailsIdentity = element;
    });
    await summary.focus();
    await summary.click();
    await expect(details).toHaveAttribute('open', '');
    await expect.poll(async () => details.evaluate((element) => ({
        sameNode: (
            window as typeof window & { __m12DetailsIdentity?: Element }
        ).__m12DetailsIdentity === element,
        open: (element as HTMLDetailsElement).open,
        focused: document.activeElement === element.querySelector('summary'),
        height: element.closest<HTMLElement>('[data-feature-id]')
            ?.getBoundingClientRect().height ?? 0,
    }))).toMatchObject({
        sameNode: true,
        open: true,
        focused: true,
    });
    await expect.poll(async () => complexCard.evaluate((element) =>
        element.getBoundingClientRect().height)).toBeGreaterThan(beforeHeight);
    await expectAnalyzerMasonry(page, 1_280);
    await expect(details).toHaveAttribute('open', '');
    await expect(page.locator('[data-feature-id] .plot canvas')).toHaveCount(8);

    await page.getByRole('button', { name: '放大时间轴' }).click();
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    const plot = complexCard.locator('.plot');
    await plot.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-current-time',
        /^(?!0(?:\.0+)?$).+/,
    );
    expect(issues).toEqual([]);
});

test('keeps renderer failures packed and releases masonry observers over route cycles', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const NativeResizeObserver = window.ResizeObserver;
        const nativeRequestAnimationFrame = window.requestAnimationFrame
            .bind(window);
        const nativeCancelAnimationFrame = window.cancelAnimationFrame
            .bind(window);
        const activeRafs = new Set<number>();
        let masonryObservers = 0;
        let cardObservers = 0;

        window.ResizeObserver = class extends NativeResizeObserver {
            private tracksMasonry = false;
            private tracksCard = false;
            private released = false;

            observe(target: Element, options?: ResizeObserverOptions) {
                if (
                    !this.tracksMasonry
                    && target.matches(
                        '[data-testid="analyzer-masonry"], .masonry-item',
                    )
                ) {
                    this.tracksMasonry = true;
                    masonryObservers += 1;
                }
                if (!this.tracksCard && target.matches('.plot')) {
                    this.tracksCard = true;
                    cardObservers += 1;
                }
                super.observe(target, options);
            }

            disconnect() {
                if (!this.released) {
                    if (this.tracksMasonry) masonryObservers -= 1;
                    if (this.tracksCard) cardObservers -= 1;
                    this.released = true;
                }
                super.disconnect();
            }
        };
        window.requestAnimationFrame = (callback: FrameRequestCallback) => {
            let requestId = 0;
            requestId = nativeRequestAnimationFrame((time) => {
                activeRafs.delete(requestId);
                callback(time);
            });
            activeRafs.add(requestId);
            return requestId;
        };
        window.cancelAnimationFrame = (requestId: number) => {
            activeRafs.delete(requestId);
            nativeCancelAnimationFrame(requestId);
        };
        Object.defineProperty(window, '__m12ResourceStats', {
            value: () => ({
                masonryObservers,
                cardObservers,
                rafLive: activeRafs.size,
            }),
        });

        const nativeGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function getContext(
            this: HTMLCanvasElement,
            contextId: string,
            ...args: unknown[]
        ) {
            if (
                contextId === '2d'
                && this.closest('[data-feature-id="complexSpectrum"]')
            ) {
                return null;
            }
            return nativeGetContext.call(
                this,
                contextId,
                ...args,
            ) as RenderingContext | null;
        } as typeof HTMLCanvasElement.prototype.getContext;
    });

    await page.goto('/analyzer');
    await page.locator('[data-feature-id="complexSpectrum"]')
        .getByRole('button', { name: '展开分析' })
        .click();
    await expect(page.locator(
        '[data-feature-id="complexSpectrum"] .plot-error',
    )).toBeVisible();
    await expectAnalyzerMasonry(page, 1_280);
    await expect.poll(async () => page.evaluate(() => (
        window as typeof window & {
            __m12ResourceStats(): {
                masonryObservers: number;
                cardObservers: number;
                rafLive: number;
            };
        }
    ).__m12ResourceStats().masonryObservers)).toBe(2);
    await expect.poll(async () => page.evaluate(() => (
        window as typeof window & {
            __m12ResourceStats(): { cardObservers: number };
        }
    ).__m12ResourceStats().cardObservers)).toBe(1);

    for (let cycle = 0; cycle < 10; cycle += 1) {
        await page.getByRole('link', { name: 'AUDIOSURF' }).click();
        await expect(page).toHaveURL(/\/$/);
        await expect.poll(async () => page.evaluate(() => (
            window as typeof window & {
                __m12ResourceStats(): {
                    masonryObservers: number;
                    cardObservers: number;
                };
            }
        ).__m12ResourceStats())).toMatchObject({
            masonryObservers: 0,
            cardObservers: 0,
        });
        await page.getByRole('link', { name: 'Analyzer' }).click();
        await expect(page).toHaveURL(/\/analyzer$/);
        await expect(page.getByTestId('analyzer-masonry')).toHaveClass(
            /is-ready/,
        );
    }
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    const resources = await page.evaluate(() => (
        window as typeof window & {
            __m12ResourceStats(): {
                masonryObservers: number;
                cardObservers: number;
                rafLive: number;
            };
        }
    ).__m12ResourceStats());
    expect(resources.masonryObservers).toBe(0);
    expect(resources.cardObservers).toBe(0);
    expect(resources.rafLive).toBeLessThanOrEqual(4);
    expect(issues).toEqual([]);
});
