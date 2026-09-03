import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
    chooseFiles,
    installFilePickerStub,
    queuePickerData,
    savedPickerEntries,
} from '../support/file-picker';
import {
    installV6ResourceProbe,
    readV6ResourceProbe,
} from '../support/v6-resource-probe';

const ROOT = path.resolve(import.meta.dirname, '../..');
const AUDIO_ROOT = path.join(ROOT, 'tests/fixtures/audio');
const FORMAT_FIXTURES = ['mp3', 'wav', 'flac'].map((extension) =>
    path.join(AUDIO_ROOT, `format-master.${extension}`));
const mediaArtifactRoot = () => process.env.VISUALIZER_V6_ARTIFACT_DIR
    ?? path.join(ROOT, 'artifacts/evals/V6-latest-media');

interface SavedEntry {
    name: string;
    mimeType: string;
    base64: string;
}

interface ProjectShape {
    format: 'audiosurf-visualizer';
    schemaVersion: 1;
    projectId: string;
    createdAt: string;
    updatedAt: string;
    track: {
        contentHash: string;
        fileName: string;
        title?: string;
        artist?: string;
        durationSeconds: number;
        sampleRate?: number;
    };
    output: { aspectRatio: '16:9'; resolution: '720p' | '1080p'; frameRate: 30 | 60 };
    scene: {
        templateId: 'orthogonal-lines' | 'cube-swarm';
        templateVersion: 1;
        seed: number;
        bindings: Array<Record<string, unknown> & { parameterId: string }>;
    };
    editorSnapshot?: { capturedAt: string; project: Record<string, unknown> };
}

interface AnalysisBridge {
    cancel(): void;
    getState(): { state: string; progress: number; activeFeatureIds?: string[] };
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
    (window as typeof window & {
        __audioNotSurfYetSavedPickerEntries?: SavedEntry[];
    }).__audioNotSurfYetSavedPickerEntries = [];
});

const takeSavedEntry = async (page: Page, suffix: string): Promise<SavedEntry> => {
    const value = await page.evaluate((expectedSuffix) => {
        const target = window as typeof window & {
            __audioNotSurfYetSavedPickerEntries?: SavedEntry[];
        };
        const entries = target.__audioNotSurfYetSavedPickerEntries ?? [];
        const index = entries.findLastIndex((entry) => entry.name.endsWith(expectedSuffix));
        return index < 0 ? null : entries.splice(index, 1)[0] ?? null;
    }, suffix);
    if (!value) throw new Error(`No saved picker entry ending in ${suffix}.`);
    return value;
};

const exportProject = async (page: Page): Promise<ProjectShape> => {
    await clearSavedEntries(page);
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const saved = await takeSavedEntry(page, '.audiosurf-visualizer.json');
    return JSON.parse(Buffer.from(saved.base64, 'base64').toString('utf8')) as ProjectShape;
};

const importProject = async (page: Page, project: ProjectShape): Promise<void> => {
    await queuePickerData(page, [{
        name: 'v6.audiosurf-visualizer.json',
        mimeType: 'application/json',
        text: `${JSON.stringify(project, null, 2)}\n`,
    }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
};

const replaceBindings = (
    project: ProjectShape,
    replacements: Array<Record<string, unknown> & { parameterId: string }>,
) => {
    const byId = new Map(replacements.map((entry) => [entry.parameterId, entry]));
    project.scene.bindings = project.scene.bindings.map((entry) =>
        structuredClone(byId.get(entry.parameterId) ?? entry));
};

const numericTransform = (
    inputMax: number,
    outputMin: number,
    outputMax: number,
    releaseSeconds = 0,
) => ({
    inputMin: 0,
    inputMax,
    outputMin,
    outputMax,
    clamp: true,
    invert: false,
    attackSeconds: 0,
    releaseSeconds,
});

const cubeBindings = () => [
    {
        parameterId: 'centerSpectrum',
        source: {
            kind: 'analysis',
            featureId: 'complexSpectrum',
            component: 'magnitude',
            projection: { kind: 'full' },
        },
    },
    {
        parameterId: 'coreScale',
        source: {
            kind: 'analysis',
            featureId: 'buffer',
            component: 'default',
            projection: { kind: 'max' },
        },
        transform: numericTransform(1, 0.5, 2.5),
    },
    {
        parameterId: 'riseSpeed',
        source: {
            kind: 'analysis',
            featureId: 'loudness',
            component: 'total',
            projection: { kind: 'scalar' },
        },
        transform: numericTransform(64, 0.25, 3),
    },
    {
        parameterId: 'orbitSpeed',
        source: {
            kind: 'analysis',
            featureId: 'amplitudeSpectrum',
            component: 'default',
            projection: { kind: 'peak' },
        },
        transform: numericTransform(128, 0, 2),
    },
];

const orthogonalAnalysisBindings = () => [
    {
        parameterId: 'horizontalIntensity',
        source: {
            kind: 'analysis',
            featureId: 'loudness',
            component: 'total',
            projection: { kind: 'scalar' },
        },
        transform: numericTransform(64, 0, 1),
    },
    {
        parameterId: 'verticalIntensity',
        source: {
            kind: 'analysis',
            featureId: 'complexSpectrum',
            component: 'magnitude',
            projection: { kind: 'mean' },
        },
        transform: numericTransform(128, 0, 1),
    },
];

const editorProjectFor = (track: ProjectShape['track']) => ({
    format: 'audiosurf-editor',
    schemaVersion: 1,
    projectId: '00000000-0000-4000-8000-000000000608',
    createdAt: '2026-09-03T06:00:00.000Z',
    updatedAt: '2026-09-03T06:00:00.000Z',
    track,
    tempoMap: [{
        id: 'tempo-v6',
        startSeconds: 0,
        mode: 'metered',
        bpm: 120,
        bpmSource: 'user',
        meter: { numerator: 4, denominator: 4 },
    }],
    lanes: [
        {
            id: 'v6-drum-point',
            name: 'V6 drum point',
            eventKind: 'point',
            innerClasses: [{ id: 'hit', label: 'hit' }],
            events: [{ id: 'hit-1', innerClassId: 'hit', atSeconds: 1.5 }],
        },
        {
            id: 'v6-tone-range',
            name: 'V6 tone range',
            eventKind: 'range',
            innerClasses: [{ id: 'bed', label: 'bed' }],
            events: [{
                id: 'bed-1',
                innerClassId: 'bed',
                startSeconds: 0.5,
                endSeconds: Math.min(3.5, track.durationSeconds),
            }],
        },
    ],
    workspace: {
        viewport: { startSeconds: 0, endSeconds: track.durationSeconds, zoom: 1 },
        overlay: { featureId: null, topRatio: 0.08, heightRatio: 0.28 },
    },
});

const configureCube = async (page: Page): Promise<ProjectShape> => {
    const cubeButton = page.getByRole('button', { name: /立方体群/ });
    if (await cubeButton.getAttribute('aria-pressed') !== 'true') await cubeButton.click();
    const project = await exportProject(page);
    replaceBindings(project, cubeBindings());
    project.output = { aspectRatio: '16:9', resolution: '720p', frameRate: 30 };
    await importProject(page, project);
    await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
    return project;
};

const configureOrthogonalEditor = async (page: Page): Promise<ProjectShape> => {
    const button = page.getByRole('button', { name: /正交线条/ });
    if (await button.getAttribute('aria-pressed') !== 'true') await button.click();
    const project = await exportProject(page);
    const editor = editorProjectFor(project.track);
    project.editorSnapshot = {
        capturedAt: '2026-09-03T06:00:00.000Z',
        project: editor,
    };
    replaceBindings(project, [
        {
            parameterId: 'horizontalIntensity',
            source: {
                kind: 'editor-event',
                laneId: 'v6-drum-point',
                innerClassId: 'hit',
            },
            transform: numericTransform(1, 0, 1, 0.12),
        },
        {
            parameterId: 'verticalIntensity',
            source: {
                kind: 'editor-event',
                laneId: 'v6-tone-range',
                innerClassId: 'bed',
            },
            transform: numericTransform(1, 0, 1),
        },
    ]);
    project.output = { aspectRatio: '16:9', resolution: '720p', frameRate: 30 };
    await importProject(page, project);
    await expect(page.getByTestId('visualizer-binding-inspector'))
        .toHaveAttribute('data-editor-lane-count', '2');
    return project;
};

const waitForAnalysisReady = async (page: Page, parameterId: string): Promise<void> => {
    await expect(page.getByTestId(`resolved-${parameterId}`))
        .toHaveAttribute('data-state', 'ready', { timeout: 90_000 });
};

const waitForCubeReady = async (page: Page): Promise<void> => {
    for (const parameterId of [
        'centerSpectrum',
        'coreScale',
        'riseSpeed',
        'orbitSpeed',
    ]) await waitForAnalysisReady(page, parameterId);
};

const enterVisualizer = async (page: Page): Promise<void> => {
    await page.getByTestId('header-visualizer-link').click();
    const conflict = page.getByTestId('visualizer-draft-conflict');
    await expect.poll(async () =>
        await page.getByTestId('visualizer-ready').isVisible()
        || await conflict.isVisible(), { timeout: 30_000 }).toBe(true);
    if (await conflict.isVisible()) {
        await page.getByTestId('overwrite-visualizer-conflict').click();
    }
    await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready');
};

const leaveEditorForHome = async (page: Page): Promise<void> => {
    await page.getByRole('link', { name: 'AUDIOSURF' }).click();
    const confirm = page.getByRole('button', { name: '仍然离开' });
    await expect.poll(async () => /\/$/.test(page.url()) || await confirm.isVisible())
        .toBe(true);
    if (await confirm.isVisible()) await confirm.click();
    await expect(page).toHaveURL(/\/$/);
};

const recordDefault = async (
    page: Page,
    browserName: string,
    formatName: string,
    template: string,
) => {
    const sourceDurationSeconds = Number(
        await page.getByTestId('visualizer-seek').getAttribute('max'),
    );
    await clearSavedEntries(page);
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-status',
        'recording',
        { timeout: 15_000 },
    );
    await expect(page.getByTestId('visualizer-seek')).toBeDisabled();
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-status',
        'ready',
        { timeout: 45_000 },
    );
    await page.getByTestId('save-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'idle');
    const saved = await takeSavedEntry(page, '.webm');
    const directory = path.join(mediaArtifactRoot(), browserName);
    await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${formatName}-${saved.name}`);
    await writeFile(file, Buffer.from(saved.base64, 'base64'));
    return {
        browser: browserName,
        format: formatName,
        template,
        preset: '720p30',
        status: 'saved',
        suggestedName: saved.name,
        sourceDurationSeconds,
        file,
    };
};

const writeMatrix = async (
    browserName: string,
    matrix: Array<Record<string, unknown>>,
    resources: Record<string, unknown>,
) => {
    const directory = path.join(mediaArtifactRoot(), browserName);
    await mkdir(directory, { recursive: true });
    await writeFile(
        path.join(directory, 'v6-capability-matrix.json'),
        `${JSON.stringify({ browser: browserName, matrix, resources }, null, 2)}\n`,
        'utf8',
    );
};

test('completes MP3/WAV/FLAC creation, six-file media matrix and 20 resource cycles', async ({ page }, testInfo) => {
    test.setTimeout(720_000);
    const issues = browserIssues(page);
    const browserName = testInfo.project.name;
    await installV6ResourceProbe(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await chooseFiles(page, FORMAT_FIXTURES);
    const musicBar = page.locator('#music-bar-container');
    await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', { timeout: 30_000 });
    await page.getByTestId('volume-control').press('Home');
    await expect(musicBar).toHaveAttribute('data-volume', '0');

    const matrix: Array<Record<string, unknown>> = [];
    for (let index = 0; index < FORMAT_FIXTURES.length; index += 1) {
        const formatName = path.extname(FORMAT_FIXTURES[index]!).slice(1);
        await expect(page.locator('#music-info-container')).toContainText(`format-master.${formatName}`);
        await enterVisualizer(page);
        const toggle = page.getByTestId('visualizer-playback-toggle');
        if (await toggle.textContent() === '暂停') await toggle.click();

        if (formatName === 'wav') {
            const project = await configureOrthogonalEditor(page);
            const before = structuredClone(project);
            const wrongEditor = editorProjectFor({
                ...project.track,
                contentHash: 'f'.repeat(64),
            });
            await queuePickerData(page, [{
                name: 'wrong-song.audiosurf-editor.json',
                mimeType: 'application/json',
                text: `${JSON.stringify(wrongEditor, null, 2)}\n`,
            }]);
            await page.getByTestId('import-editor-json').click();
            await expect(page.getByRole('alert')).toContainText('another track');
            const after = await exportProject(page);
            expect(after.scene.bindings).toEqual(before.scene.bindings);
            matrix.push(await recordDefault(page, browserName, formatName, 'orthogonal-lines'));
        } else {
            const cube = await configureCube(page);
            await waitForCubeReady(page);
            if (formatName === 'flac') {
                await page.getByRole('button', { name: /正交线条/ }).click();
                const orthogonal = await exportProject(page);
                replaceBindings(orthogonal, orthogonalAnalysisBindings());
                await importProject(page, orthogonal);
                await expect(page.getByTestId('active-analysis-features')).toContainText('2/4');
                await waitForAnalysisReady(page, 'horizontalIntensity');
                await page.getByRole('button', { name: /立方体群/ }).click();
                await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
                const restored = await exportProject(page);
                expect(restored.scene.bindings).toEqual(cube.scene.bindings);
                await page.getByRole('button', { name: /正交线条/ }).click();
                await expect(page.getByTestId('active-analysis-features')).toContainText('2/4');
                await waitForAnalysisReady(page, 'horizontalIntensity');
                await page.reload();
                await expect(page.getByTestId('visualizer-ready')).toBeVisible({ timeout: 30_000 });
                await expect(page.getByTestId('visualizer-playback-toggle')).toHaveText('播放');
                await expect.poll(async () => Number(
                    await page.getByTestId('visualizer-seek').inputValue(),
                )).toBeLessThanOrEqual(0.01);
                await waitForAnalysisReady(page, 'horizontalIntensity');
                matrix.push(await recordDefault(
                    page,
                    browserName,
                    formatName,
                    'orthogonal-lines',
                ));
                await importProject(page, cube);
                await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
                await waitForCubeReady(page);
            } else {
                matrix.push(await recordDefault(
                    page,
                    browserName,
                    formatName,
                    'cube-swarm',
                ));
            }
        }

        if (index < FORMAT_FIXTURES.length - 1) {
            await page.getByRole('link', { name: 'AUDIOSURF' }).click();
            await expect(musicBar).toBeVisible();
            await page.getByTestId('next-track').click();
            await expect(musicBar).toHaveAttribute('data-playback-state', 'playing', {
                timeout: 30_000,
            });
        }
    }

    const baseline = await readV6ResourceProbe(page);
    let routeBaseline = baseline;
    const canvas = page.getByTestId('visualizer-preview-canvas');
    const hostId = await canvas.getAttribute('data-renderer-host-id');
    for (let cycle = 0; cycle < 20; cycle += 1) {
        await page.getByRole('button', { name: /正交线条/ }).click();
        await expect(page.getByTestId('active-analysis-features')).toContainText(/[02]\/4/);
        await page.getByRole('button', { name: /立方体群/ }).click();
        await expect(page.getByTestId('active-analysis-features')).toContainText('4/4');
        await waitForCubeReady(page);
        await page.getByTestId('start-visualizer-recording').click();
        await expect(page.locator('.recording-bar')).toHaveAttribute(
            'data-recording-status',
            'recording',
            { timeout: 15_000 },
        );
        await page.getByTestId('cancel-visualizer-recording').click();
        await expect(page.locator('.recording-bar')).toHaveAttribute('data-recording-status', 'idle');
        if ((cycle + 1) % 5 === 0) {
            await canvas.evaluate((element) => {
                const context = (element as HTMLCanvasElement).getContext('webgl2')
                    ?? (element as HTMLCanvasElement).getContext('webgl');
                const extension = context?.getExtension('WEBGL_lose_context');
                if (!extension) throw new Error('WEBGL_lose_context unavailable.');
                (window as typeof window & { __v6Context?: WEBGL_lose_context })
                    .__v6Context = extension;
                extension.loseContext();
            });
            await expect(page.getByTestId('visualizer-preview-frame'))
                .toHaveAttribute('data-scene-status', 'recovering');
            await page.evaluate(() => (
                window as typeof window & { __v6Context?: WEBGL_lose_context }
            ).__v6Context?.restoreContext());
            await expect(page.getByTestId('visualizer-preview-frame'))
                .toHaveAttribute('data-scene-status', 'ready', { timeout: 20_000 });
        }
        await page.getByRole('link', { name: 'Analyzer' }).click();
        await expect(page).toHaveURL(/\/analyzer$/);
        await page.getByTestId('header-editor-link').click();
        await expect(page).toHaveURL(/\/editor\//);
        await leaveEditorForHome(page);
        await enterVisualizer(page);
        if (cycle === 4) routeBaseline = await readV6ResourceProbe(page);
    }
    await expect(page.getByTestId('visualizer-preview-canvas')).toHaveCount(1);
    const finalResources = await readV6ResourceProbe(page);
    expect(finalResources.liveAudioContexts).toBeLessThanOrEqual(Math.max(1, routeBaseline.liveAudioContexts));
    expect(finalResources.liveWorkers).toBeLessThanOrEqual(Math.max(1, routeBaseline.liveWorkers));
    expect(finalResources.visualizerCanvases).toBe(1);
    expect(finalResources.visualizerHosts).toBe(1);
    expect(finalResources.visualizerRenderers).toBe(1);
    expect(finalResources.visualizerRafs).toBeLessThanOrEqual(1);
    expect(finalResources.recordingResources).toBe(0);
    expect(finalResources.liveObservers).toBeLessThanOrEqual(routeBaseline.liveObservers + 1);
    expect(finalResources.liveListeners).toBeLessThanOrEqual(routeBaseline.liveListeners + 1);
    expect(finalResources.liveBlobUrls).toBeLessThanOrEqual(routeBaseline.liveBlobUrls);
    expect(await page.getByTestId('visualizer-preview-canvas')
        .getAttribute('data-renderer-host-id')).not.toBe(hostId);

    await writeMatrix(browserName, matrix, {
        initialBaseline: baseline,
        routeBaseline,
        final: finalResources,
        cycles: 20,
    });
    console.log(JSON.stringify({
        metric: 'v6-format-media-resource-matrix',
        browser: browserName,
        matrix,
        initialBaseline: baseline,
        routeBaseline,
        finalResources,
        cycles: 20,
    }));
    expect(issues.filter((issue) => !issue.includes('CONTEXT_LOST_WEBGL'))).toEqual([]);
});

test('keeps the 15-minute four-feature project responsive, synchronized and failure-safe', async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const issues = browserIssues(page);
    const browserName = testInfo.project.name;
    await installV6ResourceProbe(page);
    await installFilePickerStub(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(async () => {
        const sampleRate = 48_000;
        const durationSeconds = 900;
        const dataBytes = sampleRate * durationSeconds * 2;
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        const text = (offset: number, value: string) => {
            for (let index = 0; index < value.length; index += 1) {
                view.setUint8(offset + index, value.charCodeAt(index));
            }
        };
        text(0, 'RIFF');
        view.setUint32(4, 36 + dataBytes, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        text(36, 'data');
        view.setUint32(40, dataBytes, true);
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(`v6-stress-${crypto.randomUUID()}`, {
            create: true,
        });
        const handle = await directory.getFileHandle('visualizer-v6-15-minute.wav', {
            create: true,
        });
        const writable = await handle.createWritable();
        await writable.write(header);
        const chunk = new Uint8Array(sampleRate * 2 * 5);
        for (let seconds = 0; seconds < durationSeconds; seconds += 5) {
            await writable.write(chunk);
        }
        await writable.close();
        (window as typeof window & {
            __audioNotSurfYetPickerQueue: FileSystemFileHandle[][];
        }).__audioNotSurfYetPickerQueue.push([handle]);
    });
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute(
        'data-playback-state',
        'playing',
        { timeout: 90_000 },
    );
    await enterVisualizer(page);
    await page.evaluate(() => {
        const target = window as typeof window & {
            __v6LongTasks?: number[];
            __v6LongTaskObserver?: PerformanceObserver;
        };
        target.__v6LongTasks = [];
        const observer = new PerformanceObserver((list) => {
            target.__v6LongTasks?.push(...list.getEntries().map((entry) => entry.duration));
        });
        observer.observe({ entryTypes: ['longtask'] });
        target.__v6LongTaskObserver = observer;
    });
    await configureCube(page);
    await page.waitForFunction(() => {
        const bridge = (window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: AnalysisBridge;
        }).__AUDIO_NOT_SURF_YET_M6__;
        const state = bridge?.getState();
        return Boolean(state && ['analyzing', 'ready'].includes(state.state));
    }, undefined, { timeout: 90_000 });

    const preflightMs = await page.evaluate(async () => {
        const bar = document.querySelector<HTMLElement>('.recording-bar')!;
        const button = document.querySelector<HTMLButtonElement>(
            '[data-testid="start-visualizer-recording"]',
        )!;
        const started = performance.now();
        button.click();
        while (
            bar.dataset.recordingStatus !== 'error'
            && performance.now() - started < 1000
        ) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return performance.now() - started;
    });
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-error-code',
        'analysis-not-ready',
    );
    expect(preflightMs).toBeLessThanOrEqual(100);
    await page.getByTestId('reset-visualizer-recording-error').click();

    const feedbackDurations = await page.evaluate(async () => {
        const durations: number[] = [];
        const measure = async (action: () => void, predicate: () => boolean) => {
            const started = performance.now();
            action();
            while (!predicate() && performance.now() - started < 1000) {
                await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            }
            durations.push(performance.now() - started);
        };
        const active = document.querySelector<HTMLElement>(
            '[data-testid="active-analysis-features"]',
        )!;
        const buttons = [...document.querySelectorAll<HTMLButtonElement>('.template-button')];
        await measure(() => buttons.find((entry) => entry.textContent?.includes('正交线条'))!.click(),
            () => active.textContent?.includes('0/4') === true);
        await measure(() => buttons.find((entry) => entry.textContent?.includes('立方体群'))!.click(),
            () => active.textContent?.includes('4/4') === true);
        const toggle = document.querySelector<HTMLButtonElement>(
            '[data-testid="visualizer-playback-toggle"]',
        )!;
        const before = toggle.textContent;
        await measure(() => toggle.click(), () => toggle.textContent !== before);
        toggle.click();
        const frameRate = document.querySelector<HTMLSelectElement>(
            '[data-testid="visualizer-frame-rate"]',
        )!;
        await measure(() => {
            frameRate.value = '60';
            frameRate.dispatchEvent(new Event('change', { bubbles: true }));
        }, () => frameRate.value === '60');
        frameRate.value = '30';
        frameRate.dispatchEvent(new Event('change', { bubbles: true }));
        return durations;
    });
    expect(feedbackDurations.every((value) => value <= 100)).toBe(true);

    await page.waitForTimeout(250);
    const timing = await page.evaluate(() => {
        const diagnostics = window.__VISUALIZER_DIAGNOSTICS__!;
        const canvas = document.querySelector<HTMLCanvasElement>(
            '[data-testid="visualizer-preview-canvas"]',
        )!;
        const transport = document.querySelector<HTMLInputElement>(
            '[data-testid="visualizer-seek"]',
        )!;
        return {
            songTimeSeconds: diagnostics.lastSongTimeSeconds,
            canvasTimeSeconds: Number(canvas.dataset.frameTime),
            transportTimeSeconds: Number(transport.value),
            maxFrameDurationMs: diagnostics.maxFrameDurationMs,
            lastFrameAtMs: diagnostics.lastFrameAtMs,
        };
    });
    expect(Math.abs(timing.songTimeSeconds - timing.canvasTimeSeconds)).toBeLessThanOrEqual(0.000001);
    expect(Math.abs(timing.songTimeSeconds - timing.transportTimeSeconds)).toBeLessThanOrEqual(0.05);
    expect(timing.maxFrameDurationMs).toBeLessThan(50);

    await page.waitForFunction(() => {
        const bridge = (window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__?: AnalysisBridge;
        }).__AUDIO_NOT_SURF_YET_M6__;
        const state = bridge?.getState();
        return Boolean(state && (state.progress > 0 || state.state === 'ready'));
    }, undefined, { timeout: 90_000 });
    const progressSamples = await page.evaluate(async () => {
        const bridge = (window as typeof window & {
            __AUDIO_NOT_SURF_YET_M6__: AnalysisBridge;
        }).__AUDIO_NOT_SURF_YET_M6__;
        const samples: number[] = [];
        for (let index = 0; index < 20; index += 1) {
            samples.push(bridge.getState().progress);
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        bridge.cancel();
        return samples;
    });
    expect(progressSamples).toEqual([...progressSamples].sort((left, right) => left - right));
    const longTasks = await page.evaluate(() => {
        const target = window as typeof window & {
            __v6LongTasks?: number[];
            __v6LongTaskObserver?: PerformanceObserver;
        };
        target.__v6LongTaskObserver?.disconnect();
        return target.__v6LongTasks ?? [];
    });
    expect(longTasks.filter((duration) => duration >= 50)).toEqual([]);

    await queuePickerData(page, [{
        name: 'broken.audiosurf-visualizer.json',
        mimeType: 'application/json',
        text: '{"format":"broken"}\n',
    }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: /正交线条/ }).click();
    await page.evaluate(() => {
        const target = MediaRecorder as typeof MediaRecorder & { __v6Native?: typeof MediaRecorder.isTypeSupported };
        target.__v6Native = target.isTypeSupported;
        target.isTypeSupported = () => false;
    });
    await page.getByTestId('start-visualizer-recording').click();
    await expect(page.locator('.recording-bar')).toHaveAttribute(
        'data-recording-error-code',
        'mime-unavailable',
    );
    await page.getByTestId('reset-visualizer-recording-error').click();
    await page.evaluate(() => {
        const target = MediaRecorder as typeof MediaRecorder & { __v6Native?: typeof MediaRecorder.isTypeSupported };
        if (target.__v6Native) target.isTypeSupported = target.__v6Native;
    });

    for (const width of [1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(async () => page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            canvases: document.querySelectorAll('[data-testid="visualizer-preview-canvas"]').length,
        }))).toEqual({ overflow: 0, canvases: 1 });
    }
    await page.evaluate(() => {
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            value: 2,
        });
    });
    await page.setViewportSize({ width: 1279, height: 900 });
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByTestId('visualizer-preview-canvas'))
        .toHaveAttribute('data-render-dpr', '2');
    const start = page.getByTestId('start-visualizer-recording');
    await start.focus();
    await expect(start).toBeFocused();

    const canvas = page.getByTestId('visualizer-preview-canvas');
    await canvas.evaluate((element) => {
        const context = (element as HTMLCanvasElement).getContext('webgl2')
            ?? (element as HTMLCanvasElement).getContext('webgl');
        const extension = context?.getExtension('WEBGL_lose_context');
        if (!extension) throw new Error('WEBGL_lose_context unavailable.');
        (window as typeof window & { __v6StressContext?: WEBGL_lose_context })
            .__v6StressContext = extension;
        extension.loseContext();
    });
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'recovering');
    await page.evaluate(() => (
        window as typeof window & { __v6StressContext?: WEBGL_lose_context }
    ).__v6StressContext?.restoreContext());
    await expect(page.getByTestId('visualizer-preview-frame'))
        .toHaveAttribute('data-scene-status', 'ready', { timeout: 20_000 });

    const finalResources = await readV6ResourceProbe(page);
    expect(finalResources.recordingResources).toBe(0);
    console.log(JSON.stringify({
        metric: 'v6-stress-performance-failure',
        browser: browserName,
        stress: { sampleRate: 48_000, channels: 1, durationSeconds: 900, chunkSeconds: 5 },
        preflightMs,
        feedbackDurations,
        progressSamples,
        timing,
        longTasks,
        finalResources,
        failures: ['analysis-not-ready', 'bad-json', 'mime-unavailable', 'context-loss'],
        reducedMotion: true,
        viewports: [1024, 1280, 1920],
        dpr: [1, 2],
    }));
    expect(issues.filter((issue) => !issue.includes('CONTEXT_LOST_WEBGL'))).toEqual([]);
});
