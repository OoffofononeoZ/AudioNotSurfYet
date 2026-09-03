import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    savedPickerEntries,
} from '../support/file-picker';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_FILE = path.join(ROOT, 'tests/fixtures/audio/visualizer-v5-avsync-v1.wav');
const mediaArtifactRoot = () => process.env.VISUALIZER_V5_ARTIFACT_DIR
    ?? path.join(ROOT, 'artifacts/evals/V5-latest-media');

interface SavedEntry {
    name: string;
    mimeType: string;
    base64: string;
}

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

const clearSavedEntries = (page: Page) => page.evaluate(() => {
    const target = window as typeof window & {
        __audioNotSurfYetSavedPickerEntries?: SavedEntry[];
    };
    target.__audioNotSurfYetSavedPickerEntries = [];
});

const takeSavedWebM = async (page: Page): Promise<SavedEntry> => {
    const entry = await page.evaluate(() => {
        const target = window as typeof window & {
            __audioNotSurfYetSavedPickerEntries?: SavedEntry[];
        };
        const entries = target.__audioNotSurfYetSavedPickerEntries ?? [];
        const index = entries.findLastIndex((candidate) => candidate.name.endsWith('.webm'));
        if (index < 0) return null;
        return entries.splice(index, 1)[0] ?? null;
    });
    if (!entry) throw new Error('Native save gateway did not write a WebM fixture.');
    return entry;
};

const writeMediaArtifact = async (
    browserName: string,
    entry: SavedEntry,
): Promise<string> => {
    const directory = path.join(mediaArtifactRoot(), browserName);
    await mkdir(directory, { recursive: true });
    const output = path.join(directory, entry.name);
    await writeFile(output, Buffer.from(entry.base64, 'base64'));
    return output;
};

const writeCapabilityMatrix = async (
    browserName: string,
    matrix: Array<Record<string, unknown>>,
): Promise<void> => {
    const directory = path.join(mediaArtifactRoot(), browserName);
    await mkdir(directory, { recursive: true });
    await writeFile(
        path.join(directory, 'capability-matrix.json'),
        `${JSON.stringify({ browser: browserName, matrix }, null, 2)}\n`,
        'utf8',
    );
};

const currentProject = async (page: Page) => {
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBeGreaterThan(0);
    const saved = (await savedPickerEntries(page)).at(-1)!;
    return JSON.parse(Buffer.from(saved.base64, 'base64').toString('utf8')) as {
        track: {
            contentHash: string;
            fileName: string;
            title?: string;
            artist?: string;
            durationSeconds: number;
            sampleRate: number;
        };
    };
};

const saveV5EditorDraft = async (
    page: Page,
    track: Awaited<ReturnType<typeof currentProject>>['track'],
) => page.evaluate(async (trackIdentity) => {
    const project = {
        format: 'audiosurf-editor',
        schemaVersion: 1,
        projectId: '00000000-0000-4000-8000-000000000505',
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
        track: trackIdentity,
        tempoMap: [{
            id: 'tempo-v5',
            startSeconds: 0,
            mode: 'metered',
            bpm: 120,
            bpmSource: 'user',
            meter: { numerator: 4, denominator: 4 },
        }],
        lanes: [
            {
                id: 'v5-sync-flash',
                name: '中心亮闪',
                eventKind: 'point',
                innerClasses: [{ id: 'burst', label: 'Hann burst' }],
                events: [{ id: 'burst-1', innerClassId: 'burst', atSeconds: 1.5 }],
            },
            {
                id: 'v5-tone-bed',
                name: '低电平音调床',
                eventKind: 'range',
                innerClasses: [{ id: 'bed', label: '220 Hz bed' }],
                events: [{
                    id: 'bed-1',
                    innerClassId: 'bed',
                    startSeconds: 0,
                    endSeconds: 3,
                }],
            },
        ],
        workspace: {
            viewport: { startSeconds: 0, endSeconds: 3, zoom: 1 },
            overlay: { featureId: null, topRatio: 0.08, heightRatio: 0.28 },
        },
    };
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
                project,
            },
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
    });
    database.close();
}, track);

const waitForRecordingOutcome = async (page: Page) => {
    const bar = page.locator('.recording-bar');
    await expect.poll(async () => bar.getAttribute('data-recording-status'), {
        timeout: 30_000,
    }).toMatch(/ready|error/);
    return {
        status: await bar.getAttribute('data-recording-status'),
        code: await bar.getAttribute('data-recording-error-code'),
    };
};

const recordAndSave = async (
    page: Page,
    browserName: string,
): Promise<{ status: 'saved'; file: string } | { status: 'unavailable'; code: string }> => {
    await page.getByTestId('start-visualizer-recording').click();
    const outcome = await waitForRecordingOutcome(page);
    if (outcome.status === 'error') {
        expect(outcome.code).toBe('preset-unavailable');
        await page.getByTestId('reset-visualizer-recording-error').click();
        return { status: 'unavailable', code: outcome.code! };
    }
    await page.getByTestId('save-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'idle');
    const entry = await takeSavedWebM(page);
    return { status: 'saved', file: await writeMediaArtifact(browserName, entry) };
};

test('records deterministic WebM, locks commands, cleans failures, and reports the preset matrix', async ({ page }, testInfo) => {
    test.setTimeout(360_000);
    const issues = browserIssues(page);
    const browserName = testInfo.project.name;
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [AUDIO_FILE]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 20_000 },
    );
    await page.getByTestId('volume-control').press('Home');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-volume', '0');
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready');
    const runtimeNonce = await page.evaluate(() => {
        const nonce = crypto.randomUUID();
        (window as typeof window & { __v5RuntimeNonce?: string }).__v5RuntimeNonce = nonce;
        return nonce;
    });
    const toggle = page.getByTestId('visualizer-playback-toggle');
    if (await toggle.textContent() === '暂停') await toggle.click();

    const visualizer = await currentProject(page);
    await saveV5EditorDraft(page, visualizer.track);
    await clearSavedEntries(page);
    await page.getByTestId('reload-editor-draft').click();
    await expect(page.getByTestId('visualizer-binding-inspector'))
        .toHaveAttribute('data-editor-lane-count', '2');
    for (const parameterId of ['horizontalIntensity', 'verticalIntensity']) {
        await page.getByTestId(`binding-source-${parameterId}`).selectOption('editor-event');
        await page.getByTestId(`editor-lane-${parameterId}`).selectOption('v5-sync-flash');
        await page.getByTestId(`editor-class-${parameterId}`).selectOption('burst');
    }

    const canvas = page.getByTestId('visualizer-preview-canvas');
    const hostId = await canvas.getAttribute('data-renderer-host-id');

    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(async () => page.evaluate(() => ({
            canvases: document.querySelectorAll('[data-testid="visualizer-preview-canvas"]').length,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
        }))).toEqual({ canvases: 1, overflow: 0 });
        const box = await canvas.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.width / box!.height).toBeCloseTo(16 / 9, 1);
    }
    await page.setViewportSize({ width: 1280, height: 900 });

    // Active recordings stay on the route until the in-app decision is explicit.
    const startButton = page.getByTestId('start-visualizer-recording');
    await startButton.focus();
    await expect(startButton).toBeFocused();
    await startButton.press('Enter');
    await expect.poll(async () => page.locator('.recording-bar').getAttribute(
        'data-recording-status',
    ), { timeout: 10_000 }).not.toBe('preparing');
    const startDiagnostics = await page.evaluate(() => ({
        status: document.querySelector('.recording-bar')?.getAttribute('data-recording-status'),
        stage: window.__VISUALIZER_DIAGNOSTICS__?.recordingStage,
        recorderState: window.__VISUALIZER_DIAGNOSTICS__?.lastRecorderState,
        error: window.__VISUALIZER_DIAGNOSTICS__?.lastRecordingError,
    }));
    console.log(JSON.stringify({ metric: 'v5-start-diagnostics', ...startDiagnostics }));
    expect(startDiagnostics).toMatchObject({ status: 'recording' });
    await expect(page.getByTestId('visualizer-seek')).toBeDisabled();
    await expect(page.getByTestId('visualizer-resolution')).toBeDisabled();
    await expect(page.getByTestId('visualizer-frame-rate')).toBeDisabled();
    await expect(page.getByTestId('import-visualizer-project')).toBeDisabled();
    await expect(page.getByTestId('reload-editor-draft')).toBeDisabled();
    await expect(page.getByTestId('binding-source-horizontalIntensity')).toBeDisabled();
    await expect(page.getByRole('button', { name: /立方体群/ })).toBeDisabled();
    await expect(canvas).toHaveAttribute('data-capture-active', 'true');
    await expect(canvas).toHaveAttribute('data-render-dpr', '1');
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(page.getByTestId('leave-cancel-recording')).toBeVisible();
    await page.getByTestId('leave-stay').click();
    await expect(page).toHaveURL(/\/visualizer\//);

    // Context loss aborts without a half file and the same host restores preview.
    await canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext('webgl2')
            ?? (element as HTMLCanvasElement).getContext('webgl');
        const extension = context?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context is unavailable.');
        (window as typeof window & { __v5ContextExtension?: WEBGL_lose_context })
            .__v5ContextExtension = extension;
        extension.loseContext();
    });
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-error-code',
        'context-lost',
    );
    await page.evaluate(() => {
        (window as typeof window & { __v5ContextExtension?: WEBGL_lose_context })
            .__v5ContextExtension?.restoreContext();
    });
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready', { timeout: 20_000 });
    await page.getByTestId('reset-visualizer-recording-error').click();
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);

    // A renderer fatal error follows the same cleanup boundary and is retryable.
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-status',
        'recording',
        { timeout: 10_000 },
    );
    await canvas.evaluate((element) => {
        element.dispatchEvent(new Event('visualizer-scene-error-test'));
    });
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-error-code',
        'renderer-unavailable',
    );
    await page.getByTestId('retry-visualizer-scene').click();
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready');
    await page.getByTestId('reset-visualizer-recording-error').click();

    // Orthogonal 720p30 is the A/V sync artifact; failed save keeps the Blob ready.
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-status',
        'recording',
        { timeout: 10_000 },
    );
    await expect(canvas).toHaveJSProperty('width', 1280);
    await expect(canvas).toHaveJSProperty('height', 720);
    await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'ready', {
        timeout: 30_000,
    });
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    await expect(page.getByTestId('leave-save-recording')).toBeVisible();
    await page.getByTestId('leave-stay').click();

    await page.evaluate(() => {
        const target = window as typeof window & {
            showSaveFilePicker?: (options?: { suggestedName?: string }) => Promise<FileSystemFileHandle>;
        };
        const original = target.showSaveFilePicker!;
        let failed = false;
        target.showSaveFilePicker = async (options) => {
            if (!failed) {
                failed = true;
                throw new Error('V5 save retry fixture failure');
            }
            return original(options);
        };
    });
    await page.getByTestId('save-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'ready');
    await expect(page.getByRole('alert')).toContainText('V5 save retry fixture failure');
    await page.getByTestId('save-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'idle');
    const syncEntry = await takeSavedWebM(page);
    const syncFile = await writeMediaArtifact(browserName, syncEntry);

    // Cube uses exactly the default Spectrum + Energy analysis set for real dynamic capture.
    await page.getByRole('button', { name: /立方体群/ }).click();
    await expect(page.getByTestId('active-analysis-features')).toContainText('2/4');
    await expect(page.getByTestId('resolved-centerSpectrum'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    await expect(page.getByTestId('resolved-riseSpeed'))
        .toHaveAttribute('data-state', 'ready', { timeout: 60_000 });

    const matrix: Array<Record<string, unknown>> = [{
        browser: browserName,
        template: 'orthogonal-lines',
        preset: '720p30',
        status: 'saved',
        file: syncFile,
    }];
    for (const preset of [
        { resolution: '720p', frameRate: 30 },
        { resolution: '720p', frameRate: 60 },
        { resolution: '1080p', frameRate: 30 },
        { resolution: '1080p', frameRate: 60 },
    ] as const) {
        await page.getByTestId('visualizer-resolution').selectOption(preset.resolution);
        await page.getByTestId('visualizer-frame-rate').selectOption(String(preset.frameRate));
        const result = await recordAndSave(page, browserName);
        matrix.push({
            browser: browserName,
            template: 'cube-swarm',
            preset: `${preset.resolution}${preset.frameRate}`,
            ...result,
        });
    }

    const diagnostics = await page.evaluate(() => ({ ...window.__VISUALIZER_DIAGNOSTICS__ }));
    expect(diagnostics.activeHosts).toBe(1);
    expect(diagnostics.activeRenderers).toBe(1);
    expect(diagnostics.activeVisualAnimationFrames).toBeLessThanOrEqual(1);
    expect(diagnostics.activeRecordingTaps).toBe(0);
    expect(diagnostics.activeMediaRecorders).toBe(0);
    expect(diagnostics.activeCaptureStreams).toBe(0);
    expect(diagnostics.activeAudioTracks).toBe(0);
    expect(diagnostics.activeVideoTracks).toBe(0);
    expect(diagnostics.readyRecordingBlobs).toBe(0);
    expect(diagnostics.contextLosses).toBe(1);
    expect(diagnostics.contextRestores).toBe(1);
    expect(diagnostics.recordingStarts).toBe(4);
    expect(diagnostics.recordingFinalizes).toBe(2);
    expect(diagnostics.recordingAborts).toBe(2);
    expect(await page.evaluate(() => (
        window as typeof window & { __v5RuntimeNonce?: string }
    ).__v5RuntimeNonce)).toBe(runtimeNonce);
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(hostId);
    await writeCapabilityMatrix(browserName, matrix);
    console.log(JSON.stringify({ metric: 'v5-browser-capability-matrix', matrix, diagnostics }));
    expect(issues.filter((issue) => !issue.includes('CONTEXT_LOST_WEBGL'))).toEqual([]);
});
