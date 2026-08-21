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
import { createM8ScalarPcm } from '../support/m8-scalar-fixture';

const REPOSITORY_ROOT = path.resolve(import.meta.dirname, '../..');
const M8_WAV_FIXTURE = path.join(
    REPOSITORY_ROOT,
    'artifacts/fixtures/m8-scalars-v1.wav',
);

test.beforeAll(async () => {
    await mkdir(path.dirname(M8_WAV_FIXTURE), { recursive: true });
    await writeFile(M8_WAV_FIXTURE, encodeMonoWav(createM8ScalarPcm()));
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

const exactScalar = async (page: Page, featureId: string): Promise<number> => {
    const text = await page.locator(`[data-feature-id="${featureId}"] .facts`)
        .locator('div', { has: page.locator('dt', { hasText: '精确值' }) })
        .locator('dd')
        .innerText();
    const value = Number.parseFloat(text);
    if (!Number.isFinite(value)) throw new Error(`Missing ${featureId} value.`);
    return value;
};

test('adds a fourth scalar card and restores it under the cumulative feature set', async ({ page }) => {
    test.setTimeout(60_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/analyzer');

    await expect(page.locator('[data-feature-id]')).toHaveCount(3);
    await page.locator('.empty-slot')
        .getByRole('button', { name: /Energy/ })
        .click();
    await expect(page.locator('[data-feature-id="energy"]')).toHaveCount(1);
    await expect(page.locator('[data-feature-id]')).toHaveCount(4);
    await expect(page.locator('.empty-slot')).toHaveCount(0);

    const energySelect = page.locator('[data-feature-id="energy"] select');
    await expect(energySelect.locator('option[value="rms"]')).toBeDisabled();
    await expect(energySelect.locator('option[value="powerSpectrum"]'))
        .toHaveCount(1);
    await expect(energySelect.locator('option[value="loudness"]'))
        .toHaveCount(0);
    await expect(energySelect.locator('option')).toHaveCount(19);

    await chooseFiles(page, [M8_WAV_FIXTURE]);
    await expect(page.locator('[data-feature-id="energy"] .plot-message'))
        .toHaveCount(0, { timeout: 30_000 });
    await page.getByTestId('toggle-playback').click();
    const energyPlot = page.locator('[data-feature-id="energy"] .plot');
    await energyPlot.focus();
    await page.keyboard.press('Home');
    await expect.poll(() => exactScalar(page, 'energy')).toBe(0);
    const silenceEnergy = await exactScalar(page, 'energy');

    await energySelect.selectOption('spectralFlux');
    await expect(page.locator('[data-feature-id="spectralFlux"]'))
        .toHaveCount(1);
    await expect(page.locator('[data-feature-id="spectralFlux"] .plot-message'))
        .toHaveCount(0, { timeout: 30_000 });
    const fluxPlot = page.locator('[data-feature-id="spectralFlux"] .plot');
    await fluxPlot.click({ position: { x: 288, y: 120 } });
    await expect.poll(() => exactScalar(page, 'spectralFlux'))
        .toBeGreaterThan(0);
    const transientFlux = await exactScalar(page, 'spectralFlux');

    await page.getByRole('button', { name: '放大时间轴' }).click();
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');
    await page.reload();
    await expect(page.locator('[data-feature-id]')).toHaveCount(4);
    await expect(page.locator('[data-feature-id="spectralFlux"]'))
        .toHaveCount(1);
    await expect(page.locator('.timeline-toolbar')).toContainText('2.0×');

    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        const columnCount = await page.locator('.card-grid').evaluate(
            (element) => getComputedStyle(element).gridTemplateColumns
                .split(' ').length,
        );
        expect(columnCount).toBe(width === 1024 ? 1 : 2);
    }
    console.log(JSON.stringify({
        metric: 'm8-four-card-learning',
        activeCards: 4,
        availableFeatures: 16,
        silenceEnergy,
        transientFlux,
        viewportRestored: '2.0x',
        widths: [390, 1024, 1280, 1920],
    }));
    expect(issues).toEqual([]);
});

test('renders all M8 scalar cards with finite exact values', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = captureBrowserIssues(page);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await chooseFiles(page, [M8_WAV_FIXTURE]);
    await expect(page.locator('[data-feature-id="rms"] .plot-message'))
        .toHaveCount(0, { timeout: 30_000 });
    await page.getByTestId('toggle-playback').click();

    const replacement = page.locator('[data-feature-id="rms"] select');
    const featureIds = [
        'zcr',
        'spectralCentroid',
        'spectralFlatness',
        'spectralSlope',
        'spectralRolloff',
        'spectralSpread',
        'spectralSkewness',
        'spectralKurtosis',
        'spectralCrest',
        'perceptualSpread',
        'perceptualSharpness',
    ];
    let currentFeature = 'rms';
    for (const featureId of featureIds) {
        await page.locator(`[data-feature-id="${currentFeature}"] select`)
            .selectOption(featureId);
        await expect(page.locator(`[data-feature-id="${featureId}"] .plot-message`))
            .toHaveCount(0, { timeout: 30_000 });
        await page.locator(`[data-feature-id="${featureId}"] .plot`).focus();
        await page.keyboard.press('End');
        await expect.poll(() => exactScalar(page, featureId))
            .toEqual(expect.any(Number));
        currentFeature = featureId;
    }
    await expect(replacement).toHaveCount(0);
    expect(issues).toEqual([]);
});
