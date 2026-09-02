import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerData,
    savedPickerEntries,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(ROOT, 'tests/fixtures/audio/format-master.wav');

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

const openV2 = async (page: Page) => {
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
};

const source = (page: Page, parameterId: string) =>
    page.getByTestId(`binding-source-${parameterId}`);
const feature = (page: Page, parameterId: string) =>
    page.getByTestId(`analysis-feature-${parameterId}`);

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
    projectId: 'visualizer-v2-editor-project',
    createdAt: '2026-09-02T10:00:00.000Z',
    updatedAt: '2026-09-02T10:00:00.000Z',
    track,
    tempoMap: [{
        id: 'tempo-v2',
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
            events: [{ id: 'kick-event', innerClassId: 'kick-class', atSeconds: 1 }],
        },
        {
            id: 'tone-lane',
            name: 'main tone',
            eventKind: 'range',
            innerClasses: [{ id: 'tone-class', label: 'main' }],
            events: [{
                id: 'tone-event',
                innerClassId: 'tone-class',
                startSeconds: 0.5,
                endSeconds: 1.5,
            }],
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
                    savedAt: '2026-09-02T10:00:00.000Z',
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

test('plans four analysis features, deduplicates shared references and restores bindings', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = browserIssues(page);
    await openV2(page);
    await page.getByRole('button', { name: /立方体群/ }).click();
    await expect(page.getByTestId('active-analysis-features')).toContainText('2/4');
    await expect(source(page, 'centerSpectrum')).toHaveValue('analysis');
    await expect(source(page, 'riseSpeed')).toHaveValue('analysis');
    await expect(source(page, 'coreScale')).toHaveValue('constant');
    await expect(source(page, 'orbitSpeed')).toHaveValue('constant');

    await page.evaluate(() => {
        const target = document.querySelector('[data-testid="active-analysis-features"]');
        const state = { start: performance.now(), value: null as number | null };
        (window as typeof window & { __v2Feedback?: typeof state }).__v2Feedback = state;
        const observer = new MutationObserver(() => {
            if (target?.textContent?.includes('3/4')) {
                state.value = performance.now() - state.start;
                observer.disconnect();
            }
        });
        if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
    });
    await source(page, 'coreScale').selectOption('analysis');
    await expect(page.getByTestId('active-analysis-features')).toContainText('3/4');
    const feedbackMs = await page.evaluate(() => (
        window as typeof window & { __v2Feedback?: { value: number | null } }
    ).__v2Feedback?.value ?? Number.POSITIVE_INFINITY);
    expect(feedbackMs).toBeLessThanOrEqual(100);
    console.log(JSON.stringify({ metric: 'v2-binding-feedback-ms', value: feedbackMs }));

    await source(page, 'orbitSpeed').selectOption('analysis');
    await feature(page, 'orbitSpeed').selectOption('zcr');
    await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
    await expect(page.getByTestId('resolved-centerSpectrum')).toContainText('[512]', {
        timeout: 30_000,
    });
    await expect(page.getByTestId('resolved-coreScale')).toHaveAttribute('data-state', 'ready');

    const seek = page.getByTestId('visualizer-seek');
    await seek.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const beforeReload = await page.getByTestId('resolved-coreScale').textContent();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await expect(source(page, 'coreScale')).toHaveValue('analysis');
    await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
    await expect(page.getByText('分析：已就绪', { exact: true })).toBeVisible({ timeout: 60_000 });
    await seek.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.getByTestId('resolved-coreScale')).toHaveText(beforeReload ?? '');
    expect(issues).toEqual([]);
});

test('loads same-song Editor point/range data and keeps wrong-song import atomic', async ({ page }) => {
    test.setTimeout(120_000);
    const issues = browserIssues(page);
    await openV2(page);
    const visualizer = await currentVisualizerProject(page);
    const editor = editorProjectFor(visualizer.track);
    await saveEditorDraft(page, editor);
    await page.getByTestId('reload-editor-draft').click();
    await expect(page.getByText('同歌草稿', { exact: false })).toBeVisible();
    await expect(page.getByTestId('visualizer-binding-inspector'))
        .toHaveAttribute('data-editor-lane-count', '2');

    await source(page, 'horizontalIntensity').selectOption('editor-event');
    await page.getByTestId('editor-lane-horizontalIntensity').selectOption('drum-lane');
    await page.getByTestId('editor-class-horizontalIntensity').selectOption('kick-class');
    const seek = page.getByTestId('visualizer-seek');
    await seek.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1.05';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect.poll(async () => Number(
        await page.getByTestId('resolved-horizontalIntensity').textContent(),
    )).toBeGreaterThan(0);

    await source(page, 'verticalIntensity').selectOption('editor-event');
    await page.getByTestId('editor-lane-verticalIntensity').selectOption('tone-lane');
    await seek.evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1.5';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(page.getByTestId('resolved-verticalIntensity')).toHaveText('0.00000');

    const wrongEditor = editorProjectFor({ ...visualizer.track, contentHash: 'f'.repeat(64) });
    await queuePickerData(page, [{
        name: 'wrong-song.audiosurf-editor.json',
        mimeType: 'application/json',
        text: `${JSON.stringify(wrongEditor, null, 2)}\n`,
    }]);
    await page.getByTestId('import-editor-json').click();
    await expect(page.getByRole('alert')).toContainText('another track');
    await expect(source(page, 'horizontalIntensity')).toHaveValue('editor-event');
    expect(issues).toEqual([]);
});

test('keeps the V2 inspector reachable in the 1024 drawer with keyboard focus', async ({ page }) => {
    test.setTimeout(90_000);
    const issues = browserIssues(page);
    await openV2(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.getByRole('button', { name: '工程设置' }).click();
    await expect(page.getByTestId('visualizer-binding-inspector')).toBeVisible();
    await source(page, 'horizontalIntensity').focus();
    await expect(source(page, 'horizontalIntensity')).toBeFocused();
    await source(page, 'horizontalIntensity').selectOption('analysis');
    await expect(source(page, 'horizontalIntensity')).toHaveValue('analysis');
    await page.keyboard.press('Escape');
    expect(issues).toEqual([]);
});
