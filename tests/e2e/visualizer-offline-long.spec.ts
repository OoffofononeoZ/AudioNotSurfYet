import { chooseVisualizerProjectExport } from '../support/project-actions';
import '../setup-visualizer-resources';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { expect, test } from '@playwright/test';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import type { VisualizerProjectV6 } from '../../src/visualizer/compositionTypes';
import { startSystemSampler } from '../processing/systemSampler';

const root = 'artifacts/visualizer-composition/output';
const events = [0.15, 1.5, 450, 898.5];
let stopSampler: Awaited<ReturnType<typeof startSystemSampler>> | null = null;
test.afterEach(async ({}, info) => {
    if (!stopSampler) return;
    const sample = await stopSampler();
    stopSampler = null;
    await writeFile(`${root}/offline-long-${info.project.name}-system.json`, JSON.stringify(sample, null, 2));
});

test('fifteen-minute offline native input stays responsive, exports fully and cancels cleanly', async ({
    page,
    browser,
}, info) => {
    test.skip(!process.env.VISUALIZER_EXPORT_LONG, 'Enable the explicit fifteen-minute media check.');
    test.setTimeout(1200000);
    await mkdir(root, { recursive: true });
    const file = `${root}/offline-long-${info.project.name}-1080p60-sync.webm`;
    await writeFile(file, new Uint8Array());
    await page.exposeFunction('__saveOfflineChunk', async (base64: string) =>
        appendFile(file, Buffer.from(base64, 'base64')),
    );
    await page.addInitScript(() => {
        const NativeOffline = window.OfflineAudioContext;
        const probe = { created: 0, live: 0 };
        (window as any).__longOfflineContexts = probe;
        window.OfflineAudioContext = new Proxy(NativeOffline, {
            construct(target, args) {
                const context = Reflect.construct(target, args) as OfflineAudioContext;
                probe.created++;
                probe.live++;
                context.addEventListener('complete', () => probe.live--, { once: true });
                return context;
            },
        });
        HTMLCanvasElement.prototype.captureStream = () => {
            throw Error('Offline long used captureStream');
        };
        window.MediaRecorder = new Proxy(window.MediaRecorder, {
            construct() {
                throw Error('Offline long used MediaRecorder');
            },
        });
    });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    // Reuse the bounded five-second OPFS fixture pattern from the existing E6 fifteen-minute scenario.
    await page.evaluate(async events => {
        const rate = 48000,
            count = rate * 900,
            header = new ArrayBuffer(44),
            view = new DataView(header);
        const text = (at: number, value: string) => {
            for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
        };
        text(0, 'RIFF');
        view.setUint32(4, 36 + count * 2, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, rate, true);
        view.setUint32(28, rate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        text(36, 'data');
        view.setUint32(40, count * 2, true);
        const directory = await (
            await navigator.storage.getDirectory()
        ).getDirectoryHandle('offline-long-source', { create: true });
        const handle = await directory.getFileHandle('offline-long-sync.wav', { create: true }),
            writable = await handle.createWritable();
        await writable.write(header);
        for (let start = 0; start < count; start += rate * 5) {
            const data = new Int16Array(Math.min(rate * 5, count - start));
            for (let i = 0; i < data.length; i++) {
                const position = start + i;
                let value = 0.02 * Math.sin((2 * Math.PI * 220 * position) / rate);
                for (const event of events) {
                    const offset = position - Math.round(event * rate);
                    if (offset >= 0 && offset < rate * 0.05)
                        value +=
                            0.8 *
                            (0.5 - 0.5 * Math.cos((2 * Math.PI * offset) / (rate * 0.05 - 1))) *
                            Math.sin((2 * Math.PI * 1200 * position) / rate);
                }
                data[i] = Math.round(value * 32767);
            }
            await writable.write(data);
        }
        await writable.close();
        (window as any).__audioNotSurfYetPickerQueue.push([handle]);
    }, events);
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 60000,
    });
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await chooseVisualizerProjectExport(page);
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const project = JSON.parse(
        Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString(),
    ) as VisualizerProjectV6;
    for (const e of project.elements) if (e.seed !== undefined) e.seed = 1234567;
    project.output = { aspectRatio: '16:9', resolution: '1080p', frameRate: 60, audioVideoOffsetMs: 0 };
    const background = elementRegistry.create('solid', 900, 0);
    background.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#000000' };
    const motion = elementRegistry.create('wireform', 900, 1);
    for (const binding of motion.bindings) {
        if (binding.parameterId === 'spectrum') binding.source = { kind: 'native', featureId: 'frequency' };
        if (binding.parameterId === 'x' || binding.parameterId === 'y')
            binding.source = { kind: 'constant', value: 0.15 };
        if (binding.parameterId === 'size') binding.source = { kind: 'constant', value: 0.03 };
    }
    const flashes = events.map((time, index) => {
        const flash = elementRegistry.create('solid', 900, index + 2);
        flash.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#ffffff' };
        flash.timing = { kind: 'manual', startSeconds: time, endSeconds: time + 0.05 };
        return flash;
    });
    Object.assign(project, appendStandaloneElements(project, [background, motion, ...flashes]));
    await queuePickerData(page, [
        { name: 'long-output.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
    const samples: unknown[] = [],
        startedAt = Date.now();
    stopSampler = await startSystemSampler();
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    while ((await page.locator('[data-export-status=ready]').count()) === 0) {
        const before = Date.now();
        const sample = await page.evaluate(() => ({
            diagnostics: window.__VISUALIZER_DIAGNOSTICS__,
            heapBytes: (performance as any).memory?.usedJSHeapSize ?? null,
            nativeContexts: (window as any).__longOfflineContexts,
            status: document.querySelector('[data-export-status]')?.getAttribute('data-export-status'),
            error: document.querySelector('.viz-status-lines')?.textContent,
        }));
        expect(sample.status, sample.error ?? '').not.toBe('error');
        samples.push({ elapsedMs: Date.now() - startedAt, responseMs: Date.now() - before, ...sample });
        if (samples.length % 10 === 0)
            console.log(`${info.project.name}: ${sample.diagnostics?.exportFramesDone}/54000 offline frames`);
        await page.waitForTimeout(2000);
    }
    const exportMs = Date.now() - startedAt;
    const diagnostics = await page.evaluate(() => window.__VISUALIZER_DIAGNOSTICS__!);
    expect(diagnostics.exportFramesDone).toBe(54000);
    expect(diagnostics.activeExportJobs).toBe(0);
    // Stream the ready disk File to the test process while save still owns it; no whole-file base64 allocation.
    await page.evaluate(() => {
        (window as any).showSaveFilePicker = async () => ({
            createWritable: async () => ({
                async write(file: Blob) {
                    for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
                        const bytes = new Uint8Array(await file.slice(offset, offset + 1024 * 1024).arrayBuffer());
                        let binary = '';
                        for (let i = 0; i < bytes.length; i += 8192)
                            binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
                        await (window as any).__saveOfflineChunk(btoa(binary));
                    }
                },
                async close() {},
                async abort() {},
            }),
        });
    });
    await page.getByTestId('save-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible({ timeout: 120000 });
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect
        .poll(() => page.evaluate(() => window.__VISUALIZER_DIAGNOSTICS__?.exportFramesDone ?? 0))
        .toBeGreaterThan(120);
    const cancelAt = Date.now();
    await page.getByTestId('cancel-visualizer-export').click();
    await expect(page.locator('[data-export-status=idle]')).toBeVisible();
    const cancelMs = Date.now() - cancelAt;
    await expect.poll(() => page.evaluate(() => (window as any).__longOfflineContexts.live)).toBe(0);
    const remainingFiles = await page.evaluate(async () => {
        const directory = await (await navigator.storage.getDirectory()).getDirectoryHandle('visualizer-export'),
            names = [];
        for await (const name of (directory as any).keys()) names.push(name);
        return names;
    });
    expect(remainingFiles).toEqual([]);
    expect(errors).toEqual([]);
    await writeFile(
        file + '.capture.json',
        JSON.stringify(
            {
                mode: 'offline',
                browser: info.project.name,
                browserVersion: browser.version(),
                kind: 'sync',
                scenario: 'long',
                sourceDurationSeconds: 900,
                syncEventsSeconds: events,
                syncFlashSeconds: 0.05,
                preset: {
                    resolution: '1080p',
                    frameRate: 60,
                    width: 1920,
                    height: 1080,
                    videoBitsPerSecond: 16000000,
                    audioBitsPerSecond: 192000,
                },
                exportMs,
                cancelMs,
                diagnostics,
                samples,
                remainingFiles,
            },
            null,
            2,
        ),
    );
});
