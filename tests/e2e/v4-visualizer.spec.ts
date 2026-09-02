import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    savedPickerEntries,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(ROOT, 'tests/fixtures/audio/visualizer-v4-cube-swarm-v1.wav');

const browserIssues = (page: Page): string[] => {
    const issues: string[] = [];
    page.on('console', (message) => {
        if (['error', 'warning', 'warn'].includes(message.type())) {
            issues.push(`console.${message.type()}: ${message.text()}`);
        }
    });
    page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
    return issues;
};

const source = (page: Page, parameterId: string) =>
    page.getByTestId(`binding-source-${parameterId}`);
const feature = (page: Page, parameterId: string) =>
    page.getByTestId(`analysis-feature-${parameterId}`);

const openV4 = async (page: Page) => {
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    const toggle = page.getByTestId('visualizer-playback-toggle');
    if (await toggle.textContent() === '暂停') await toggle.click();
    await expect(toggle).toHaveText('播放');
    await page.getByRole('button', { name: /立方体群/ }).click();
    await expect(page.getByText('Visualizer · 立方体群', { exact: true })).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready');
    await expect(page.getByTestId('active-analysis-features')).toContainText('2/4');
    await expect(page.getByTestId('resolved-centerSpectrum'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(page.getByTestId('resolved-riseSpeed'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
};

const seekTo = async (page: Page, seconds: number) => {
    await page.getByTestId('visualizer-seek').evaluate((element, value) => {
        const input = element as HTMLInputElement;
        input.value = String(value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }, seconds);
    await expect(page.getByTestId('visualizer-preview-canvas'))
        .toHaveAttribute('data-frame-time', seconds.toFixed(6));
};

const changeNumberAndMeasure = async (
    page: Page,
    parameterId: string,
    value: number,
    observedSelector = '[data-testid="visualizer-preview-frame"]',
): Promise<number> => page.evaluate(({ parameterId: id, value: nextValue, observedSelector: selector }) => {
    const input = document.querySelector(
        `[data-parameter-id="${id}"] input[type="number"]`,
    ) as HTMLInputElement | null;
    const observed = document.querySelector(selector);
    if (!input || !observed) throw new Error(`Missing V4 metric target for ${id}`);
    return new Promise<number>((resolve, reject) => {
        const startedAt = performance.now();
        const timeout = window.setTimeout(() => {
            observer.disconnect();
            reject(new Error(`Timed out waiting for ${id} render feedback`));
        }, 1_000);
        const observer = new MutationObserver(() => {
            window.clearTimeout(timeout);
            observer.disconnect();
            resolve(performance.now() - startedAt);
        });
        observer.observe(observed, { attributes: true, childList: true, subtree: true });
        input.value = String(nextValue);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}, { parameterId, value, observedSelector });

const currentVisualizerProject = async (page: Page) => {
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBeGreaterThan(0);
    const saved = (await savedPickerEntries(page)).at(-1)!;
    return JSON.parse(Buffer.from(saved.base64, 'base64').toString('utf8')) as {
        track: {
            contentHash: string;
            fileName: string;
            durationSeconds: number;
            sampleRate: number;
        };
    };
};

const editorProjectFor = (track: Awaited<ReturnType<typeof currentVisualizerProject>>['track']) => ({
    format: 'audiosurf-editor',
    schemaVersion: 1,
    projectId: 'visualizer-v4-editor-project',
    createdAt: '2026-09-03T00:00:00.000Z',
    updatedAt: '2026-09-03T00:00:00.000Z',
    track,
    tempoMap: [{
        id: 'tempo-v4',
        startSeconds: 0,
        mode: 'metered',
        bpm: 120,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    }],
    lanes: [
        {
            id: 'drum-lane',
            name: 'drum',
            eventKind: 'point',
            innerClasses: [{ id: 'kick-class', label: 'kick' }],
            events: [0.02, 1, 2.5, 4, 5.98].map((atSeconds, index) => ({
                id: `kick-${index}`,
                innerClassId: 'kick-class',
                atSeconds,
            })),
        },
        {
            id: 'tone-lane',
            name: 'main tone',
            eventKind: 'range',
            innerClasses: [{ id: 'tone-class', label: 'main' }],
            events: [[0.5, 2], [2, 4], [4, 5.5]].map(([startSeconds, endSeconds], index) => ({
                id: `tone-${index}`,
                innerClassId: 'tone-class',
                startSeconds,
                endSeconds,
            })),
        },
    ],
    workspace: {
        viewport: { startSeconds: 0, endSeconds: track.durationSeconds, zoom: 1 },
        overlay: { featureId: null, topRatio: 0.1, heightRatio: 0.35 },
    },
});

const saveEditorDraft = async (page: Page, project: ReturnType<typeof editorProjectFor>) => {
    await page.evaluate(async (value) => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('audionotsurfyet-editor', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('draft', 'readwrite');
            transaction.objectStore('draft').put({
                key: 'latest',
                envelope: {
                    schemaVersion: 1,
                    savedAt: '2026-09-03T00:00:00.000Z',
                    project: value,
                },
            });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error);
        });
        database.close();
    }, project);
};

test('binds Cube Swarm inputs and preserves deterministic seek through context recovery', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = browserIssues(page);
    await openV4(page);
    const frame = page.getByTestId('visualizer-preview-frame');
    const canvas = page.getByTestId('visualizer-preview-canvas');

    await expect(source(page, 'centerSpectrum')).toHaveValue('analysis');
    await expect(feature(page, 'centerSpectrum')).toHaveValue('amplitudeSpectrum');
    await expect(source(page, 'riseSpeed')).toHaveValue('analysis');
    await expect(feature(page, 'riseSpeed')).toHaveValue('energy');
    await expect(source(page, 'coreScale')).toHaveValue('constant');
    await expect(source(page, 'orbitSpeed')).toHaveValue('constant');
    await expect(page.getByTestId('resolved-orbitSpeed')).toHaveText('0.30000');

    await seekTo(page, 1.5);
    const lowEnergyRise = Number(await page.getByTestId('resolved-riseSpeed').textContent());
    await seekTo(page, 3);
    const highEnergyRise = Number(await page.getByTestId('resolved-riseSpeed').textContent());
    expect(highEnergyRise).toBeGreaterThan(lowEnergyRise);

    const feedbackMs = await changeNumberAndMeasure(page, 'coreScale', 1.5);
    expect(feedbackMs).toBeLessThanOrEqual(50);
    const settingsFeedbackMs = await changeNumberAndMeasure(
        page,
        'cubeCount',
        64,
        '[data-testid="resolved-cubeCount"]',
    );
    expect(settingsFeedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({
        metric: 'v4-feedback-ms',
        visual: feedbackMs,
        settings: settingsFeedbackMs,
        lowEnergyRise,
        highEnergyRise,
    }));

    const visualizer = await currentVisualizerProject(page);
    await saveEditorDraft(page, editorProjectFor(visualizer.track));
    await page.getByTestId('reload-editor-draft').click();
    await expect(page.getByTestId('visualizer-binding-inspector'))
        .toHaveAttribute('data-editor-lane-count', '2');
    await source(page, 'coreScale').selectOption('editor-event');
    await page.getByTestId('editor-lane-coreScale').selectOption('drum-lane');
    await page.getByTestId('editor-class-coreScale').selectOption('kick-class');
    await seekTo(page, 0.5);
    const offDrumValue = Number(await page.getByTestId('resolved-coreScale').textContent());
    expect(offDrumValue).toBeGreaterThanOrEqual(1);
    await seekTo(page, 1.05);
    await expect.poll(async () => Number(
        await page.getByTestId('resolved-coreScale').textContent(),
    )).toBeGreaterThan(offDrumValue);
    await expect(source(page, 'riseSpeed')).toHaveValue('analysis');
    await expect(feature(page, 'riseSpeed')).toHaveValue('energy');

    await source(page, 'orbitSpeed').selectOption('analysis');
    await feature(page, 'orbitSpeed').selectOption('rms');
    await expect(page.getByTestId('active-analysis-features')).toContainText('3/4');
    await expect(page.getByTestId('resolved-orbitSpeed'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });

    await seekTo(page, 2.5);
    const canonicalTimeHash = await frame.getAttribute('data-frame-state-hash');
    expect(canonicalTimeHash).toMatch(/^[0-9a-f]{8}$/);
    await seekTo(page, 0.75);
    await seekTo(page, 2.5);
    await expect(frame).toHaveAttribute('data-frame-state-hash', canonicalTimeHash!);
    await expect(page.getByText('草稿已保存', { exact: true })).toBeVisible({ timeout: 10_000 });

    const hostId = await canvas.getAttribute('data-renderer-host-id');
    await canvas.evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
        const extension = context?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context is unavailable.');
        (window as typeof window & { __v4ContextExtension?: WEBGL_lose_context })
            .__v4ContextExtension = extension;
        extension.loseContext();
    });
    await expect(frame).toHaveAttribute('data-scene-status', 'recovering');
    await expect(page.getByText('正在恢复 WebGL 场景', { exact: true })).toBeVisible();
    await expect(page.getByTestId('visualizer-playback-toggle')).toHaveText('播放');
    await page.evaluate(() => {
        (window as typeof window & { __v4ContextExtension?: WEBGL_lose_context })
            .__v4ContextExtension?.restoreContext();
    });
    await expect(frame).toHaveAttribute('data-scene-status', 'ready', { timeout: 20_000 });
    await expect(canvas).toHaveAttribute('data-frame-time', '2.500000');
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);

    const contextMetrics = await page.evaluate(() => ({
        ...window.__VISUALIZER_DIAGNOSTICS__,
    }));
    expect(contextMetrics.activeHosts).toBe(1);
    expect(contextMetrics.activeRenderers).toBe(1);
    expect(contextMetrics.contextLosses).toBeGreaterThanOrEqual(1);
    expect(contextMetrics.contextRestores).toBeGreaterThanOrEqual(1);
    console.log(JSON.stringify({ metric: 'v4-context-recovery', ...contextMetrics }));

    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Visualizer · 立方体群', { exact: true })).toBeVisible();
    await expect(page.getByTestId('active-analysis-features')).toContainText('3/4');
    await expect(page.getByTestId('resolved-centerSpectrum'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await seekTo(page, 2.5);
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-frame-state-hash', canonicalTimeHash!, { timeout: 10_000 });
    await expect(source(page, 'coreScale')).toHaveValue('editor-event');
    await expect(source(page, 'orbitSpeed')).toHaveValue('analysis');
    expect(issues.filter((issue) => !issue.includes('CONTEXT_LOST_WEBGL'))).toEqual([]);
});

test('keeps one renderer resource set through 20 template switches and responsive retry', async ({ page }) => {
    test.setTimeout(180_000);
    const issues = browserIssues(page);
    await openV4(page);
    const frame = page.getByTestId('visualizer-preview-frame');
    const canvas = page.getByTestId('visualizer-preview-canvas');
    const hostId = await canvas.getAttribute('data-renderer-host-id');

    for (let cycle = 0; cycle < 20; cycle += 1) {
        await page.getByRole('button', { name: /正交线条/ }).click();
        await expect(frame).toHaveAttribute('data-scene-status', 'ready');
        await page.getByRole('button', { name: /立方体群/ }).click();
        await expect(frame).toHaveAttribute('data-scene-status', 'ready');
        await expect(canvas).toHaveCount(1);
    }
    const resources = await page.evaluate(() => ({
        canvases: document.querySelectorAll('[data-testid="visualizer-preview-canvas"]').length,
        ...window.__VISUALIZER_DIAGNOSTICS__,
    }));
    expect(resources.canvases).toBe(1);
    expect(resources.activeHosts).toBe(1);
    expect(resources.activeRenderers).toBe(1);
    expect(resources.activeVisualAnimationFrames).toBeLessThanOrEqual(1);
    expect((resources.scenesCreated ?? 0) - (resources.scenesDisposed ?? 0)).toBe(1);
    expect(resources.maxFrameDurationMs).toBeLessThanOrEqual(50);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);
    console.log(JSON.stringify({ metric: 'v4-template-resources', cycles: 20, ...resources }));

    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(async () => canvas.evaluate((element) => {
            const target = element as HTMLCanvasElement;
            const rect = target.getBoundingClientRect();
            return target.width === Math.round(
                rect.width * Math.min(window.devicePixelRatio || 1, 2),
            );
        })).toBe(true);
        const geometry = await canvas.evaluate((element) => {
            const target = element as HTMLCanvasElement;
            const rect = target.getBoundingClientRect();
            return {
                ratio: rect.width / rect.height,
                dpr: Number(target.dataset.renderDpr),
            };
        });
        expect(geometry.ratio).toBeCloseTo(16 / 9, 2);
        expect(geometry.dpr).toBeLessThanOrEqual(2);
    }

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole('button', { name: '工程设置' }).click();
    await source(page, 'centerSpectrum').focus();
    await expect(source(page, 'centerSpectrum')).toBeFocused();
    await page.keyboard.press('Escape');

    await canvas.evaluate((element) => {
        element.dispatchEvent(new Event('visualizer-scene-error-test'));
    });
    await expect(frame).toHaveAttribute('data-scene-status', 'error');
    await expect(page.getByRole('alert')).toContainText('场景错误恢复测试');
    await page.getByTestId('retry-visualizer-scene').click();
    await expect(frame).toHaveAttribute('data-scene-status', 'ready');
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);
    expect(issues).toEqual([]);
});
