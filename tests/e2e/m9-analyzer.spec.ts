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

const headerStyle = (page: Page) => page.locator('#main-header').evaluate(
    (element) => {
        const style = getComputedStyle(element);
        return {
            backgroundColor: style.backgroundColor,
            backdropFilter: style.backdropFilter,
            webkitBackdropFilter: style.getPropertyValue(
                '-webkit-backdrop-filter',
            ),
            height: element.getBoundingClientRect().height,
        };
    },
);

test('keeps home transparent and blurs every non-home header across routes', async ({ page }) => {
    const issues = captureBrowserIssues(page);
    await page.goto('/?source=m9#home');
    await expect.poll(async () => (await headerStyle(page)).backgroundColor)
        .toBe('rgba(0, 0, 0, 0)');
    expect((await headerStyle(page)).backdropFilter).toBe('none');

    for (const route of ['/analyzer', '/comingsoon', '/testlands']) {
        await page.goto(route);
        const style = await headerStyle(page);
        expect(style.backgroundColor).toBe('rgba(2, 4, 3, 0.72)');
        expect(
            style.backdropFilter === 'blur(18px)'
            || style.webkitBackdropFilter === 'blur(18px)',
        ).toBe(true);
        expect(style.height).toBe(64);
    }

    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect.poll(async () => (await headerStyle(page)).backdropFilter)
        .toBe('none');
    expect(issues).toEqual([]);
});

test('renders Power Spectrum, MFCC and Buffer as four persistent unique cards', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/analyzer');

    await page.locator('.empty-slot')
        .getByRole('button', { name: /Power Spectrum/ })
        .click();
    await page.locator('[data-feature-id="rms"] select')
        .selectOption('mfcc');
    await page.locator('[data-feature-id="chroma"] select')
        .selectOption('buffer');

    const expectedFeatures = [
        'amplitudeSpectrum',
        'powerSpectrum',
        'mfcc',
        'buffer',
    ];
    for (const featureId of expectedFeatures) {
        await expect(page.locator(`[data-feature-id="${featureId}"]`))
            .toHaveCount(1);
    }
    await expect(page.locator('[data-feature-id]')).toHaveCount(4);

    const select = page.locator('[data-feature-id="powerSpectrum"] select');
    await expect(select.locator('option')).toHaveCount(21);
    await expect(select.locator('option[value="loudness"]')).toHaveCount(1);
    await expect(select.locator('option[value="complexSpectrum"]'))
        .toHaveCount(1);
    await expect(select.locator('option[value="mfcc"]')).toBeDisabled();
    await expect(select.locator('option[value="buffer"]')).toBeDisabled();

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
    await expect(page.locator('[data-feature-id]')).toHaveCount(4);
    for (const featureId of expectedFeatures) {
        await expect(page.locator(`[data-feature-id="${featureId}"]`))
            .toHaveCount(1);
    }
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    expect(await page.locator('.timeline-toolbar').innerText())
        .toContain(viewportBeforeReload.match(/\d+:\d+\.\d+\s*–\s*\d+:\d+\.\d+/)?.[0]);

    const geometries: Record<number, number> = {};
    for (const width of [390, 1_024, 1_280, 1_920]) {
        geometries[width] = (await expectAnalyzerMasonry(page, width)).columns;
    }
    expect(geometries).toEqual({ 390: 1, 1024: 1, 1280: 2, 1920: 2 });

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
