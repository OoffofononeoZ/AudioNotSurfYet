import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import path from 'node:path';
import { FEATURE_IDS } from '../../src/analysis/types';
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

const readOrder = (page: Page) => page.locator(
    '[data-testid="analyzer-masonry"] > .masonry-item',
).evaluateAll((elements) => elements.map((element) =>
    (element as HTMLElement).dataset.slot));

const handle = (page: Page, featureId: string) =>
    page.getByTestId(`reorder-handle-${featureId}`);

const card = (page: Page, featureId: string) =>
    page.locator(`[data-feature-id="${featureId}"]`);

const expand = async (page: Page, featureId: string) => {
    await card(page, featureId)
        .getByRole('button', { name: '展开分析' })
        .click();
};

test('offers persistent keyboard and click alternatives with reset', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await expect(page.locator('.analysis-card')).toHaveCount(FEATURE_IDS.length);
    await expect(page.locator('.reorder-handle')).toHaveCount(
        FEATURE_IDS.length,
    );
    expect(await page.locator('.masonry-item').evaluateAll((items) =>
        items.map((item) => Number(
            (item as HTMLElement).dataset.orderIndex,
        )))).toEqual(FEATURE_IDS.map((_, index) => index));
    await expect(handle(page, 'rms')).toHaveAttribute(
        'aria-label',
        /当前位置 1\/21/,
    );
    expect(await handle(page, 'rms').evaluate((element) =>
        getComputedStyle(element).touchAction)).toBe('none');

    await handle(page, 'rms').focus();
    await page.keyboard.press('Enter');
    const menu = page.getByTestId('reorder-menu-rms');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: '上移' })).toBeDisabled();
    await menu.getByRole('menuitem', { name: '下移' }).click();
    await expect(menu).toBeVisible();
    await expect(handle(page, 'rms')).toBeFocused();
    await expect.poll(() => readOrder(page)).toEqual([
        'zcr', 'rms', ...FEATURE_IDS.slice(2),
    ]);

    await page.keyboard.press('Alt+End');
    const customOrder = [...FEATURE_IDS.slice(1), FEATURE_IDS[0]];
    await expect.poll(() => readOrder(page)).toEqual(customOrder);
    await expect(handle(page, 'rms')).toBeFocused();
    await expect(page.getByTestId('reorder-announcement'))
        .toContainText('第 21 项，共 21 项');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(handle(page, 'rms')).toBeFocused();
    await expect(page.getByTestId('reset-feature-order')).toBeEnabled();

    await chooseFiles(page, [WAV_FIXTURE]);
    await expect.poll(() => readOrder(page)).toEqual(customOrder);
    await page.reload();
    await expect.poll(() => readOrder(page)).toEqual(customOrder);
    await expectAnalyzerMasonry(page, 1_280, 900, customOrder);

    await page.getByTestId('reset-feature-order').click();
    await expect.poll(() => readOrder(page)).toEqual([...FEATURE_IDS]);
    await expect(page.getByTestId('reset-feature-order')).toBeDisabled();
    await expect(page.getByTestId('reorder-announcement'))
        .toContainText('已恢复默认特征顺序');
    console.log(JSON.stringify({
        metric: 'm14-keyboard-persistence',
        handleCount: FEATURE_IDS.length,
        persistedFirst: customOrder[0],
        persistedLast: customOrder.at(-1),
        resetCount: FEATURE_IDS.length,
    }));
    expect(issues).toEqual([]);
});

test('uses a six-pixel pointer threshold, insertion markers, auto-scroll, and cancellation', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await page.setViewportSize({ width: 1_536, height: 720 });
    await page.goto('/analyzer');
    await expectAnalyzerMasonry(page, 1_536, 720);

    const rmsHandleBox = await handle(page, 'rms').boundingBox();
    if (!rmsHandleBox) throw new Error('RMS reorder handle is missing.');
    const startX = rmsHandleBox.x + rmsHandleBox.width / 2;
    const startY = rmsHandleBox.y + rmsHandleBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 3, startY + 3);
    await page.mouse.up();
    await expect.poll(() => readOrder(page)).toEqual([...FEATURE_IDS]);
    await expect(page.getByTestId('reorder-menu-rms')).toBeVisible();
    await page.keyboard.press('Escape');

    const targetBox = await page.getByTestId(
        'analyzer-card-amplitudeSpectrum',
    ).boundingBox();
    if (!targetBox) throw new Error('Pointer drop target is missing.');
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(
        targetBox.x + targetBox.width / 2,
        targetBox.y + targetBox.height * 0.8,
        { steps: 8 },
    );
    await expect(page.getByTestId('reorder-drag-ghost')).toBeVisible();
    await expect(page.getByTestId('analyzer-card-amplitudeSpectrum'))
        .toHaveClass(/is-drop-after/);
    await page.mouse.up();
    const crossColumnOrder = [
        'zcr',
        'energy',
        'amplitudeSpectrum',
        'rms',
        ...FEATURE_IDS.slice(4),
    ];
    await expect.poll(() => readOrder(page)).toEqual(crossColumnOrder);
    await expectAnalyzerMasonry(page, 1_536, 720, crossColumnOrder);

    const zcrBox = await handle(page, 'zcr').boundingBox();
    if (!zcrBox) throw new Error('ZCR reorder handle is missing.');
    await page.mouse.move(
        zcrBox.x + zcrBox.width / 2,
        zcrBox.y + zcrBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(zcrBox.x + 10, 715, { steps: 8 });
    await expect.poll(async () => page.locator('.analyzer-content').evaluate(
        (element) => element.scrollTop,
    )).toBeGreaterThan(300);
    await expect.poll(async () => {
        const box = await page.getByTestId('analyzer-card-buffer')
            .boundingBox();
        return box ? box.y + box.height / 2 : Number.POSITIVE_INFINITY;
    }, { timeout: 20_000 }).toBeLessThan(680);
    const bufferBox = await page.getByTestId('analyzer-card-buffer')
        .boundingBox();
    if (!bufferBox) throw new Error('Auto-scroll did not reveal Buffer.');
    await page.mouse.move(
        bufferBox.x + bufferBox.width / 2,
        bufferBox.y + bufferBox.height * 0.8,
        { steps: 8 },
    );
    await expect(page.getByTestId('analyzer-card-buffer'))
        .toHaveClass(/is-drop-after/);
    await page.mouse.up();
    const autoScrolledOrder = [
        ...crossColumnOrder.slice(1),
        'zcr',
    ];
    await expect.poll(() => readOrder(page)).toEqual(autoScrolledOrder);

    await page.locator('.analyzer-content').evaluate((element) => {
        element.scrollTop = 0;
    });
    await expectAnalyzerMasonry(page, 1_536, 720, autoScrolledOrder);
    await handle(page, 'energy').scrollIntoViewIfNeeded();
    const energyBox = await handle(page, 'energy').boundingBox();
    if (!energyBox) throw new Error('Energy reorder handle is missing.');
    const energyX = energyBox.x + energyBox.width / 2;
    const energyY = energyBox.y + energyBox.height / 2;
    await page.mouse.move(energyX, energyY);
    await page.mouse.down();
    await page.mouse.move(energyX + 120, energyY + 80, { steps: 6 });
    await expect(page.getByTestId('reorder-drag-ghost')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('reorder-drag-ghost')).toHaveCount(0);
    await page.mouse.up();
    await expect(page.getByTestId('reorder-menu-energy')).toHaveCount(0);
    await expect.poll(() => readOrder(page)).toEqual(autoScrolledOrder);

    await page.mouse.move(
        energyX,
        energyY,
    );
    await page.mouse.down();
    await page.mouse.move(8, 8, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => readOrder(page)).toEqual(autoScrolledOrder);
    await page.reload();
    await expect.poll(() => readOrder(page)).toEqual(autoScrolledOrder);
    await expect(page.getByTestId('reorder-drag-ghost')).toHaveCount(0);
    console.log(JSON.stringify({
        metric: 'm14-pointer-reorder',
        thresholdPixels: 6,
        autoScrollTop: await page.locator('.analyzer-content').evaluate(
            (element) => element.scrollTop,
        ),
        cancelledOrderPreserved: true,
    }));
    expect(issues).toEqual([]);
});

test('preserves expanded resources and FIFO age without restarting analysis', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        let workers = 0;
        let analyzeRequests = 0;
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, argumentsList) {
                workers += 1;
                const worker = Reflect.construct(Target, argumentsList) as Worker;
                const nativePostMessage = worker.postMessage.bind(worker);
                worker.postMessage = ((message: unknown, transfer?: Transferable[]) => {
                    if (
                        message
                        && typeof message === 'object'
                        && 'kind' in message
                        && message.kind === 'analyze'
                    ) analyzeRequests += 1;
                    nativePostMessage(message, transfer ?? []);
                }) as Worker['postMessage'];
                return worker;
            },
        });
        Object.defineProperty(window, '__m14WorkerStats', {
            value: () => ({ workers, analyzeRequests }),
        });
    });
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    for (const featureId of [
        'rms', 'amplitudeSpectrum', 'loudness', 'complexSpectrum',
    ]) {
        await expand(page, featureId);
    }
    await chooseFiles(page, [WAV_FIXTURE]);
    await expect(card(page, 'complexSpectrum').locator('.plot-message'))
        .toHaveCount(0, { timeout: 45_000 });
    const details = card(page, 'complexSpectrum').locator('details');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await page.locator('.analysis-card canvas').evaluateAll((canvases) => {
        (window as typeof window & { __m14CanvasNodes?: Element[] })
            .__m14CanvasNodes = canvases;
    });
    const statsBefore = await page.evaluate(() => (
        window as typeof window & {
            __m14WorkerStats(): { workers: number; analyzeRequests: number };
        }
    ).__m14WorkerStats());

    await handle(page, 'complexSpectrum').focus();
    await page.keyboard.press('Alt+Home');
    await expect.poll(() => readOrder(page)).toEqual([
        'complexSpectrum',
        ...FEATURE_IDS.filter((featureId) => featureId !== 'complexSpectrum'),
    ]);
    await expect(handle(page, 'complexSpectrum')).toBeFocused();
    await expect(details).toHaveAttribute('open', '');
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);
    expect(await page.locator('.analysis-card canvas').evaluateAll(
        (canvases) => canvases.every((canvas) => (
            window as typeof window & { __m14CanvasNodes?: Element[] }
        ).__m14CanvasNodes?.includes(canvas)),
    )).toBe(true);
    const statsAfterSort = await page.evaluate(() => (
        window as typeof window & {
            __m14WorkerStats(): { workers: number; analyzeRequests: number };
        }
    ).__m14WorkerStats());
    expect(statsAfterSort).toEqual(statsBefore);

    await expand(page, 'chroma');
    await expect(card(page, 'rms').locator(
        '.toggle-card[aria-expanded="false"]',
    ))
        .toHaveCount(1);
    await expect(card(page, 'amplitudeSpectrum').locator(
        '.toggle-card[aria-expanded="true"]',
    )).toHaveCount(1);
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    console.log(JSON.stringify({
        metric: 'm14-resource-fifo-isolation',
        workersBefore: statsBefore.workers,
        analyzeRequestsBefore: statsBefore.analyzeRequests,
        analyzeRequestsAfterSort: statsAfterSort.analyzeRequests,
        canvasCount: 8,
        detailsPreserved: true,
        fifoOldestEvicted: 'rms',
    }));
    expect(issues).toEqual([]);
});
