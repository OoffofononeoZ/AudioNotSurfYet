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

const card = (page: Page, featureId: string) =>
    page.locator(`[data-feature-id="${featureId}"]`);

const expand = async (page: Page, featureId: string) => {
    await card(page, featureId)
        .getByRole('button', { name: '展开分析' })
        .click();
};

const expandedFeatureIds = (page: Page) => page.locator(
    '.analysis-card:has([aria-expanded="true"])',
).evaluateAll((elements) => elements.map((element) =>
    (element as HTMLElement).dataset.featureId));

test('keeps all 21 cards stable and applies an atomic four-item FIFO', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/analyzer');

    const cards = page.locator('.analysis-card');
    await expect(cards).toHaveCount(FEATURE_IDS.length);
    expect(await cards.evaluateAll((elements) => elements.map((element) =>
        (element as HTMLElement).dataset.featureId))).toEqual([...FEATURE_IDS]);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(0);
    await expect(page.locator('.analysis-card select')).toHaveCount(0);
    await expect(cards.getByRole('button', { name: '移除' })).toHaveCount(0);
    await expect(page.locator('.timeline-toolbar')).toContainText(
        '0/4 张展开卡',
    );
    await expect(page.locator('.timeline-toolbar')).toContainText(
        '展开卡片开始分析',
    );

    for (const featureId of FEATURE_IDS.slice(0, 4)) {
        await expand(page, featureId);
    }
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);

    const fifth = FEATURE_IDS[4];
    const fifthButton = card(page, fifth).locator('button.toggle-card');
    await fifthButton.click();
    await expect(fifthButton).toBeFocused();
    await expect(card(page, FEATURE_IDS[0]).locator(
        '.toggle-card[aria-expanded="false"]',
    ))
        .toHaveCount(1);
    await expect(card(page, fifth).locator(
        '.toggle-card[aria-expanded="true"]',
    ))
        .toHaveCount(1);
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);

    await card(page, FEATURE_IDS[1])
        .getByRole('button', { name: '收起分析' })
        .click();
    await expand(page, FEATURE_IDS[0]);
    expect(await expandedFeatureIds(page)).toEqual([
        FEATURE_IDS[0],
        FEATURE_IDS[2],
        FEATURE_IDS[3],
        FEATURE_IDS[4],
    ]);

    await page.evaluate((featureIds) => {
        for (const featureId of featureIds) {
            document.querySelector<HTMLButtonElement>(
                `[data-feature-id="${featureId}"] button.toggle-card`,
            )?.click();
        }
    }, FEATURE_IDS.slice(5, 15));
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);

    for (const width of [390, 1_024, 1_280, 1_920]) {
        const geometry = await expectAnalyzerMasonry(page, width);
        expect(geometry.columns).toBe(width >= 1_280 ? 2 : 1);
    }
    console.log(JSON.stringify({
        metric: 'm13-fifo-geometry',
        cardCount: FEATURE_IDS.length,
        expandedCount: 4,
        canvasCount: 8,
        rapidToggleCount: 10,
    }));
    expect(issues).toEqual([]);
});

test('starts analysis only after expansion, restores FIFO, and resets details', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = captureBrowserIssues(page);
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        let workers = 0;
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, argumentsList) {
                workers += 1;
                return Reflect.construct(Target, argumentsList) as Worker;
            },
        });
        Object.defineProperty(window, '__m13WorkerCount', {
            value: () => workers,
        });
    });
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await chooseFiles(page, [WAV_FIXTURE]);
    expect(await page.evaluate(() => (
        window as typeof window & { __m13WorkerCount(): number }
    ).__m13WorkerCount())).toBe(0);

    for (const featureId of [
        'rms', 'amplitudeSpectrum', 'loudness', 'complexSpectrum',
    ]) {
        await expand(page, featureId);
    }
    await expect(card(page, 'complexSpectrum').locator('.plot-message'))
        .toHaveCount(0, { timeout: 45_000 });
    const workerCountBeforeReload = await page.evaluate(() => (
        window as typeof window & { __m13WorkerCount(): number }
    ).__m13WorkerCount());
    expect(workerCountBeforeReload).toBe(1);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);

    const details = card(page, 'complexSpectrum').locator('details');
    await details.locator('summary').click();
    await expect(details).toHaveAttribute('open', '');
    await card(page, 'complexSpectrum')
        .getByRole('button', { name: '收起分析' })
        .click();
    await expect(card(page, 'complexSpectrum').locator('details'))
        .toHaveCount(0);
    await expand(page, 'complexSpectrum');
    await expect(card(page, 'complexSpectrum').locator('details'))
        .not.toHaveAttribute('open', '');

    await card(page, 'rms')
        .getByRole('button', { name: '收起分析' })
        .click();
    await expand(page, 'rms');
    await page.waitForTimeout(100);

    const beforeReload = await expandedFeatureIds(page);
    await page.reload();
    await expect(page.locator('.analysis-card')).toHaveCount(FEATURE_IDS.length);
    await expect.poll(() => expandedFeatureIds(page)).toEqual(beforeReload);
    await expect(page.locator('.analysis-card canvas')).toHaveCount(8);
    await expect(card(page, 'complexSpectrum').locator('.plot-message'))
        .toHaveCount(0, { timeout: 45_000 });
    await expect(card(page, 'complexSpectrum').locator('.facts'))
        .not.toContainText('等待精确帧', { timeout: 10_000 });
    const workerCountAfterReload = await page.evaluate(() => (
        window as typeof window & { __m13WorkerCount(): number }
    ).__m13WorkerCount());
    expect(workerCountAfterReload).toBe(1);
    await expand(page, 'chroma');
    await expect(card(page, 'amplitudeSpectrum').locator(
        '.toggle-card[aria-expanded="false"]',
    )).toHaveCount(1);
    await expect(card(page, 'rms').locator(
        '.toggle-card[aria-expanded="true"]',
    ))
        .toHaveCount(1);
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    console.log(JSON.stringify({
        metric: 'm13-lazy-analysis-restore',
        workerCountBeforeReload,
        workerCountAfterReload,
        restoredExpandedCount: beforeReload.length,
        canvasCount: 8,
        restoredFifoOldestEvicted: 'amplitudeSpectrum',
    }));
    expect(issues).toEqual([]);
});
