import {
    expect,
    test,
    type Page,
} from '@playwright/test';
import {
    mkdir,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
} from '../support/file-picker';
import { encodeMonoWav } from '../support/m7-learning-fixture';
import { createM9VectorPcm } from '../support/m9-vector-fixture';
import { expectAnalyzerMasonry } from '../support/analyzer-masonry';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const M9_WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m9-vectors-v1.wav',
);

test.beforeAll(async () => {
    await mkdir(path.dirname(M9_WAV_FIXTURE), { recursive: true });
    await writeFile(M9_WAV_FIXTURE, encodeMonoWav(createM9VectorPcm()));
});

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

test('keeps sidebar selection consistent across routes', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/?source=m9#home');
    await expect(page.getByTestId('sidebar-home-link')).toHaveAttribute('aria-current', 'page');
    for (const route of ['/analyzer', '/comingsoon', '/testlands']) {
        await page.goto(route);
        await expect(page.locator('#app-sidebar')).toBeVisible();
        expect(await page.locator('#app-sidebar').evaluate(element => element.getBoundingClientRect().width)).toBe(216);
    }
    await page.getByRole('link', { name: 'AUDIOSURF', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('sidebar-home-link')).toHaveAttribute('aria-current', 'page');
    expect(issues).toEqual([]);
});

test('renders Power Spectrum, MFCC and Buffer as four persistent expanded cards', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/analyzer');

    const expectedFeatures = [
        'amplitudeSpectrum',
        'powerSpectrum',
        'mfcc',
        'buffer',
    ];
    for (const featureId of expectedFeatures) {
        await page.locator(`[data-feature-id="${featureId}"]`)
            .getByRole('button', { name: '展开分析' })
            .click();
    }
    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    await expect(page.locator('.analysis-card [aria-expanded="true"]'))
        .toHaveCount(4);
    await expect(page.locator('[data-feature-id] select')).toHaveCount(0);

    await chooseFiles(page, [M9_WAV_FIXTURE]);
    for (const featureId of expectedFeatures) {
        await expect(page.locator(
            `[data-feature-id="${featureId}"] .plot-message`,
        )).toHaveCount(0, { timeout: 30_000 });
    }

    const spectrumDetails = page.locator(
        '[data-feature-id="powerSpectrum"] details',
    );
    await expect(spectrumDetails.locator('summary')).toContainText('512');
    const mfccDetails = page.locator('[data-feature-id="mfcc"] details');
    await expect(mfccDetails.locator('summary')).toContainText('13');
    const bufferDetails = page.locator('[data-feature-id="buffer"] details');
    await expect(bufferDetails.locator('summary')).toContainText('1024');
    await expect(page.locator('[data-feature-id="buffer"] .facts'))
        .toContainText(/补 0|无补 0/);

    await expect(page.locator('[data-feature-id] .plot canvas')).toHaveCount(8);
    const bufferPlot = page.locator('[data-feature-id="buffer"] .plot');
    await page.getByTestId('toggle-playback').click();
    await bufferPlot.click({ position: { x: 180, y: 120 } });
    const afterClick = Number(await page.locator('#music-bar-container')
        .getAttribute('data-current-time'));
    await bufferPlot.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => Number(
        await page.locator('#music-bar-container')
            .getAttribute('data-current-time'),
    )).toBeGreaterThan(afterClick);

    await page.getByRole('button', { name: '放大时间轴' }).click();
    await page.getByRole('button', { name: '向后平移四分之一视口' }).click();
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    const viewportBeforeReload = await page.locator('.timeline-toolbar')
        .innerText();
    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(21);
    for (const featureId of expectedFeatures) {
        await expect(page.locator(
            `[data-feature-id="${featureId}"] [aria-expanded="true"]`,
        ))
            .toHaveCount(1);
    }
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    expect(await page.locator('.timeline-toolbar').innerText())
        .toContain(viewportBeforeReload.match(/\d+:\d+\.\d+\s*–\s*\d+:\d+\.\d+/)?.[0]);

    const geometries: Record<number, number> = {};
    for (const width of [390, 1_024, 1_280, 1_920]) {
        geometries[width] = (await expectAnalyzerMasonry(page, width)).columns;
    }
    expect(geometries).toEqual({ 390: 1, 1024: 1, 1280: 1, 1920: 2 });

    console.log(JSON.stringify({
        metric: 'm9-vector-learning',
        activeCards: 4,
        availableFeatures: 21,
        exactDimensions: { powerSpectrum: 512, mfcc: 13, buffer: 1024 },
        viewportRestored: '2.0x',
        geometries,
    }));
    expect(issues).toEqual([]);
});
