import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { getVisualizerRecordingPreset, isReliableVisualizerRecordingPreset } from '../../src/visualizer/recordingPresets';
import type { VisualizerProjectV3 } from '../../src/visualizer/compositionTypes';
import { createOutputSyncWav, OUTPUT_SYNC_EVENTS, OUTPUT_SYNC_FLASH_SECONDS } from '../support/visualizer-output-sync';

const root = 'artifacts/visualizer-composition/output';
async function exported(page: Page): Promise<VisualizerProjectV3> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}

test('output availability preserves imported settings and rejects unsupported profiles before capture', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page); await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    const resolution = page.getByRole('combobox', { name: '输出分辨率', exact: true });
    const fps = page.getByRole('combobox', { name: '输出帧率', exact: true });
    await expect(resolution.locator('option[value="1080p"]')).toHaveAttribute('disabled', '');
    await expect(fps.locator('option[value="60"]')).toHaveAttribute('disabled', '');
    const project = await exported(page); project.output = { aspectRatio: '16:9', resolution: '1080p', frameRate: 60 };
    await queuePickerData(page, [{ name: 'unsupported-output.json', mimeType: 'application/json', text: JSON.stringify(project) }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(resolution).toHaveValue('1080p'); await expect(fps).toHaveValue('60');
    await expect(page.getByRole('status')).toContainText('该档位尚未通过录制稳定性验证');
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(resolution).toHaveValue('1080p'); await expect(fps).toHaveValue('60');
    expect((await exported(page)).output).toEqual(project.output);
    const position = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.getByTestId('visualizer-preview-frame').hover(); await page.getByTestId('start-visualizer-recording').click();
    await expect(page.locator('[data-recording-status=error]')).toBeVisible();
    await expect(page.locator('.viz-status-lines')).toContainText('该档位尚未通过录制稳定性验证');
    await expect(page.getByTestId('visualizer-preview-canvas')).not.toHaveAttribute('data-capture-active', 'true');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-recording-locked', 'false');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', position!);
    await page.getByRole('button', { name: '清除错误', exact: true }).click(); await page.getByRole('tab', { name: '输出', exact: true }).click();
    await resolution.selectOption('720p'); await fps.selectOption('30');
    await expect(page.getByRole('status')).toHaveCount(0);
    expect((await exported(page)).output).toEqual({ aspectRatio: '16:9', resolution: '720p', frameRate: 30 });
});

for (const resolution of ['720p', '1080p'] as const) for (const frameRate of [30, 60] as const) {
    const preset = getVisualizerRecordingPreset(resolution, frameRate);
    for (const kind of ['sync', 'music'] as const) test(`${resolution}${frameRate} records ${kind} at the requested quality`, async ({ page, browser }, info) => {
        test.skip(!process.env.VISUALIZER_RECORDING_TRIAL && !isReliableVisualizerRecordingPreset(preset), 'Preset is excluded by the shared measured availability table.');
        test.skip(kind === 'music' && !process.env.VISUALIZER_MUSIC_FILE, 'Set VISUALIZER_MUSIC_FILE to a short local music file.');
        test.setTimeout(90000);
        const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
        await page.setViewportSize({ width: 1920, height: 1080 });
        await installFilePickerStub(page);
        if (process.env.VISUALIZER_RECORDING_TRIAL) {
            // Candidate measurements bypass only the static availability gate,
            // in this test's localhost response. Production code stays gated.
            await page.route('**/src/visualizer/recordingPresets.ts*', async route => {
                const response = await route.fetch(), source = await response.text();
                expect(source).toMatch(/available:\s*false/);
                await route.fulfill({ response, body: source.replace(/available:\s*false/g, 'available: true') });
            });
        }
        await page.addInitScript(() => {
            const capture = HTMLCanvasElement.prototype.captureStream;
            const state = { requestedFps: 0, captureStart: 0, frames: [] as number[], clockSamples: [] as { wall: number; audio: number; song: number; outputAudio: number; outputWall: number }[], longTasks: [] as { start: number; duration: number }[], tracks: [] as MediaStreamTrack[], options: {} as MediaRecorderOptions };
            let audioContext: AudioContext | null = null, lastClockSample = 0;
            window.AudioContext = new Proxy(window.AudioContext, { construct(target, args) { audioContext = Reflect.construct(target, args); return audioContext!; } });
            new PerformanceObserver(list => { for (const e of list.getEntries()) state.longTasks.push({ start: e.startTime, duration: e.duration }); }).observe({ type: 'longtask', buffered: true });
            const raf = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => raf.call(window, time => {
                if (state.captureStart && state.frames.at(-1) !== time) state.frames.push(time);
                callback(time);
                if (state.captureStart && audioContext && time - lastClockSample >= 200) {
                    const output = audioContext.getOutputTimestamp();
                    state.clockSamples.push({ wall: performance.now(), audio: audioContext.currentTime, song: window.__VISUALIZER_DIAGNOSTICS__?.lastSongTimeSeconds ?? 0,
                        outputAudio: output.contextTime ?? 0, outputWall: output.performanceTime ?? 0 });
                    lastClockSample = time;
                }
            });
            (window as unknown as { __outputProbe: typeof state }).__outputProbe = state;
            HTMLCanvasElement.prototype.captureStream = function (fps) {
                const stream = capture.call(this, fps); state.captureStart = performance.now(); state.requestedFps = fps ?? 0; state.tracks = stream.getTracks(); return stream;
            };
            const Recorder = window.MediaRecorder;
            window.MediaRecorder = new Proxy(Recorder, { construct(target, args) {
                state.options = args[1]; return Reflect.construct(target, args);
            } });
        });
        await page.goto('/');
        await mkdir(root, { recursive: true });
        const syncAudio = path.resolve(root, 'timeline-sync.wav');
        if (kind === 'sync') await writeFile(syncAudio, createOutputSyncWav());
        const audio = kind === 'sync' ? syncAudio : process.env.VISUALIZER_MUSIC_FILE!;
        await chooseFiles(page, [audio]);
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
        await page.getByTestId('toggle-playback').click();
        const volume = page.getByRole('slider', { name: '音量', exact: true });
        await volume.press('Home');
        await expect(page.locator('#music-bar-container')).toHaveAttribute('data-volume', '0');
        await page.getByTestId('header-visualizer-link').click();
        await expect(page.getByTestId('visualizer-ready')).toBeVisible();
        if (kind === 'music') {
            await page.getByTestId('add-visualizer-element').click(); await page.getByRole('button', { name: '预设', exact: true }).click();
            await page.locator('[data-preset-id="geometric-0.6"]').click();
        }
        const project = await exported(page);
        expect(project.track.durationSeconds).toBeLessThanOrEqual(kind === 'sync' ? 12 : 8);
        project.output = { aspectRatio: '16:9', resolution, frameRate };
        if (kind === 'sync') {
            const background = elementRegistry.create('solid', project.track.durationSeconds, 0);
            background.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#000000' };
            // Continuous motion around four independent center sync events.
            const motion = elementRegistry.create('wireform', project.track.durationSeconds, 1);
            for (const binding of motion.bindings) {
                if (binding.parameterId === 'spectrum') binding.source = { kind: 'constant', value: [] };
                if (binding.parameterId === 'x' || binding.parameterId === 'y') binding.source = { kind: 'constant', value: .15 };
                if (binding.parameterId === 'size') binding.source = { kind: 'constant', value: .03 };
            }
            const flashes = OUTPUT_SYNC_EVENTS.map((time, index) => {
                const flash = elementRegistry.create('solid', project.track.durationSeconds, index + 2);
                flash.bindings.find(b => b.parameterId === 'color')!.source = { kind: 'constant', value: '#ffffff' };
                flash.timing = { kind: 'manual', startSeconds: time, endSeconds: time + OUTPUT_SYNC_FLASH_SECONDS };
                return flash;
            });
            project.elements = [background, motion, ...flashes];
        }
        await queuePickerData(page, [{ name: 'output.json', mimeType: 'application/json', text: JSON.stringify(project) }]);
        await page.getByTestId('import-visualizer-project').click();
        await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
        if (kind === 'music') {
            await page.getByRole('tab', { name: '状态', exact: true }).click();
            await expect(page.locator('.viz-status-lines')).toContainText('已就绪');
        }
        const canvas = page.getByTestId('visualizer-preview-canvas');
        await canvas.screenshot({ path: `${root}/preview-${info.project.name}-${resolution}${frameRate}-${kind}.png` });
        await page.getByTestId('visualizer-preview-frame').hover(); await page.getByTestId('start-visualizer-recording').click();
        await expect(canvas).toHaveAttribute('data-capture-active', 'true');
        await expect(canvas).toHaveAttribute('width', String(preset.width)); await expect(canvas).toHaveAttribute('height', String(preset.height));
        await expect(canvas).toHaveAttribute('data-render-dpr', '1');
        await expect(page.getByTestId('add-visualizer-element')).toBeDisabled();
        await expect(page.locator('[data-recording-status=ready]')).toBeVisible({ timeout: 30000 });
        await expect(canvas).not.toHaveAttribute('data-capture-active', 'true');
        await expect(page.getByTestId('add-visualizer-element')).toBeEnabled();
        const probe = await page.evaluate(() => {
            const p = (window as unknown as { __outputProbe: { requestedFps: number; captureStart: number; frames: number[]; clockSamples: unknown[]; longTasks: { start: number; duration: number }[]; tracks: MediaStreamTrack[]; options: MediaRecorderOptions } }).__outputProbe;
            return { requestedFps: p.requestedFps, captureStart: p.captureStart, frames: p.frames, clockSamples: p.clockSamples, longTasks: p.longTasks, tracks: p.tracks.map(t => ({ state: t.readyState, settings: t.getSettings() })), options: p.options };
        });
        expect(probe.requestedFps).toBe(frameRate); expect(probe.tracks.every(t => t.state === 'ended')).toBe(true);
        expect(probe.options.videoBitsPerSecond).toBe(preset.videoBitsPerSecond); expect(probe.options.audioBitsPerSecond).toBe(192000);
        await page.getByTestId('save-visualizer-recording').click();
        await expect.poll(async () => (await savedPickerEntries(page)).some(e => e.name.endsWith('.webm'))).toBe(true);
        const saved = (await savedPickerEntries(page)).find(e => e.name.endsWith('.webm'))!;
        await mkdir(root, { recursive: true });
        const file = `${root}/${process.env.VISUALIZER_OUTPUT_RUN ?? 'current'}-${info.project.name}-${resolution}${frameRate}-${kind}${info.repeatEachIndex ? '-repeat'+info.repeatEachIndex : ''}.webm`;
        await writeFile(file, Buffer.from(saved.base64, 'base64'));
        await writeFile(`${file}.capture.json`, JSON.stringify({ browser: info.project.name, browserVersion: browser.version(), candidateTrial: !!process.env.VISUALIZER_RECORDING_TRIAL, kind, sourceDurationSeconds: project.track.durationSeconds,
            ...(kind === 'sync' ? { syncEventsSeconds: OUTPUT_SYNC_EVENTS, syncFlashSeconds: OUTPUT_SYNC_FLASH_SECONDS } : {}), preset, probe }, null, 2) + '\n');
        expect(errors).toEqual([]);
    });
}
