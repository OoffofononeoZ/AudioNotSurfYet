import '../setup-visualizer-resources';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { chromium, expect, test, type Page, type BrowserContext } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { getVisualizerExportPreset } from '../../src/visualizer/exportPresets';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';
import { createOutputSyncWav, OUTPUT_SYNC_EVENTS, OUTPUT_SYNC_FLASH_SECONDS } from '../support/visualizer-output-sync';

const root = 'artifacts/visualizer-composition/output';
const fixture = path.resolve('tests/fixtures/audio/visualizer-v5-avsync-v1.wav');
async function exported(page: Page): Promise<VisualizerProjectV5> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function open(page: Page, audio = fixture) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
}
async function importProject(page: Page, project: VisualizerProjectV5) {
    await queuePickerData(page, [{ name: 'output.json', mimeType: 'application/json', text: JSON.stringify(project) }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
}

test('output settings preserve imported profiles and independently select all four offline profiles', async ({
    page,
}) => {
    await open(page);
    const resolution = page.getByRole('combobox', { name: '输出分辨率', exact: true });
    const fps = page.getByRole('combobox', { name: '输出帧率', exact: true });
    await expect(fps.locator('option[value="60"]')).not.toHaveAttribute('disabled', '');
    const project = await exported(page);
    project.output = { aspectRatio: '16:9', resolution: '1080p', frameRate: 30 };
    await importProject(page, project);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(resolution).toHaveValue('1080p');
    await expect(fps).toHaveValue('30');
    expect((await exported(page)).output).toEqual(project.output);
    for (const r of ['720p', '1080p'])
        for (const f of ['30', '60']) {
            await resolution.selectOption(r);
            await fps.selectOption(f);
            expect((await exported(page)).output).toEqual({ aspectRatio: '16:9', resolution: r, frameRate: Number(f) });
        }
    await resolution.selectOption('720p');
    await expect(fps).toHaveValue('60');
});

test('unsupported offline encoding fails before taking playback or render ownership', async ({ page }) => {
    await page.route('**/src/visualizer/exportPresets.ts*', async route => {
        const response = await route.fetch(),
            source = await response.text();
        await route.fulfill({
            response,
            body: source.replace(
                /(export async function probeVisualizerExport[^\{]+\{)/,
                '$1 return {available:false,codec:null,reason:"Controlled unsupported encoder"};',
            ),
        });
    });
    await open(page);
    const before = await page.locator('#music-bar-container').getAttribute('data-current-time');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=error]')).toBeVisible();
    await expect(page.locator('.viz-status-lines')).toContainText('Controlled unsupported encoder');
    await expect(page.getByTestId('visualizer-preview-canvas')).not.toHaveAttribute('data-export-active', 'true');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-export-locked', 'false');
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', before!);
});

async function installProbe(context: BrowserContext) {
    await context.addInitScript(() => {
        const state = {
            videoConfigs: [] as unknown[],
            audioConfigs: [] as unknown[],
            audio: null as AudioContext | null,
        };
        (window as any).__offlineOutputProbe = state;
        const OriginalContext = window.AudioContext;
        window.AudioContext = new Proxy(OriginalContext, {
            construct(target, args) {
                state.audio = Reflect.construct(target, args);
                return state.audio!;
            },
        });
        const Video = window.VideoEncoder,
            Audio = window.AudioEncoder;
        window.VideoEncoder = class extends Video {
            configure(config: VideoEncoderConfig) {
                state.videoConfigs.push(config);
                super.configure(config);
            }
        };
        window.AudioEncoder = class extends Audio {
            configure(config: AudioEncoderConfig) {
                state.audioConfigs.push(config);
                super.configure(config);
            }
        };
        window.MediaRecorder = new Proxy(window.MediaRecorder, {
            construct() {
                throw Error('Offline export used MediaRecorder');
            },
        });
        HTMLCanvasElement.prototype.captureStream = () => {
            throw Error('Offline export used captureStream');
        };
    });
}

for (const resolution of ['720p', '1080p'] as const)
    for (const frameRate of [30, 60] as const) {
        test(`${resolution}${frameRate} exports cold, repeat and music with fixed media time`, async ({}, info) => {
            test.skip(!process.env.VISUALIZER_OUTPUT_MATRIX, 'Enable the explicit real-media matrix.');
            test.setTimeout(240000);
            const browser = await chromium.launch({
                channel: info.project.name === 'edge' ? 'msedge' : 'chrome',
                headless: true,
            });
            const preset = getVisualizerExportPreset(resolution, frameRate);
            await mkdir(root, { recursive: true });
            const syncFile = path.resolve(root, 'timeline-sync.wav');
            await writeFile(syncFile, createOutputSyncWav());
            let context: BrowserContext | null = null;
            try {
                context = await browser.newContext();
                await installProbe(context);
                let page = await context.newPage();
                await open(page, syncFile);
                let project = await exported(page);
                project.seed = 1234567;
                project.output = { aspectRatio: '16:9', resolution, frameRate };
                const background = elementRegistry.create('solid', project.track.durationSeconds, 0);
                background.bindings.find(b => b.parameterId === 'color')!.source = {
                    kind: 'constant',
                    value: '#000000',
                };
                const flashes = OUTPUT_SYNC_EVENTS.map((time, index) => {
                    const flash = elementRegistry.create('solid', project.track.durationSeconds, index + 1);
                    flash.bindings.find(b => b.parameterId === 'color')!.source = {
                        kind: 'constant',
                        value: '#ffffff',
                    };
                    flash.timing = { kind: 'manual', startSeconds: time, endSeconds: time + OUTPUT_SYNC_FLASH_SECONDS };
                    return flash;
                });
                Object.assign(project, appendStandaloneElements(project, [background, ...flashes]));
                await importProject(page, project);
                for (const scenario of ['cold', 'repeat', 'music'] as const) {
                    if (scenario === 'music') {
                        await context.close();
                        context = await browser.newContext();
                        await installProbe(context);
                        page = await context.newPage();
                        await open(page, process.env.VISUALIZER_MUSIC_FILE ?? fixture);
                        await page.getByTestId('add-visualizer-element').click();
                        await page.getByRole('button', { name: '预设', exact: true }).click();
                        await page.locator('[data-preset-id="geometric-0.6"]').click();
                        project = await exported(page);
                        project.seed = 1234567;
                        project.output = { aspectRatio: '16:9', resolution, frameRate };
                        await importProject(page, project);
                        await page.getByRole('tab', { name: '状态', exact: true }).click();
                        await expect(page.locator('.viz-status-lines')).toContainText('已就绪');
                    }
                    await page.getByRole('slider', { name: '音量', exact: true }).press('Home');
                    await page.evaluate(async () => {
                        await (window as any).__offlineOutputProbe.audio?.suspend();
                    });
                    if (scenario === 'repeat' && resolution === '720p' && frameRate === 60) {
                        const cdp = await context.newCDPSession(page);
                        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                    }
                    const position = await page.locator('#music-bar-container').getAttribute('data-current-time');
                    const canvas = page.getByTestId('visualizer-preview-canvas');
                    await page.getByTestId('visualizer-preview-frame').hover();
                    await page.getByTestId('start-visualizer-export').click();
                    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 180000 });
                    await expect(canvas).not.toHaveAttribute('data-export-active', 'true');
                    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-export-locked', 'false');
                    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-current-time', position!);
                    const probe = await page.evaluate(() => {
                        const p = (window as any).__offlineOutputProbe;
                        return {
                            videoConfigs: p.videoConfigs,
                            audioConfigs: p.audioConfigs,
                            diagnostics: window.__VISUALIZER_DIAGNOSTICS__,
                        };
                    });
                    expect(probe.diagnostics?.activeExportJobs).toBe(0);
                    expect(probe.diagnostics?.exportFramesDone).toBe(
                        Math.ceil(project.track.durationSeconds * frameRate),
                    );
                    expect(probe.videoConfigs.at(-1)).toMatchObject({
                        width: preset.width,
                        height: preset.height,
                        bitrate: preset.videoBitsPerSecond,
                        latencyMode: 'quality',
                    });
                    expect(probe.audioConfigs.at(-1)).toMatchObject({
                        sampleRate: 48000,
                        numberOfChannels: 2,
                        bitrate: 192000,
                    });
                    await page.getByTestId('save-visualizer-export').click();
                    await expect(page.locator('[data-export-status=idle]')).toBeVisible();
                    const saved = (await savedPickerEntries(page)).filter(e => e.name.endsWith('.webm')).at(-1)!;
                    const kind = scenario === 'music' ? 'music' : 'sync';
                    const file = `${root}/${process.env.VISUALIZER_OUTPUT_RUN ?? 'offline'}-${info.project.name}-${resolution}${frameRate}-${kind}${scenario === 'repeat' ? '-repeat1' : ''}.webm`;
                    await writeFile(file, Buffer.from(saved.base64, 'base64'));
                    await writeFile(
                        file + '.capture.json',
                        JSON.stringify(
                            {
                                mode: 'offline',
                                browser: info.project.name,
                                browserVersion: browser.version(),
                                kind,
                                scenario,
                                sourceDurationSeconds: project.track.durationSeconds,
                                preset,
                                probe,
                                ...(kind === 'sync'
                                    ? {
                                          syncEventsSeconds: OUTPUT_SYNC_EVENTS,
                                          syncFlashSeconds: OUTPUT_SYNC_FLASH_SECONDS,
                                      }
                                    : {}),
                            },
                            null,
                            2,
                        ),
                    );
                }
            } finally {
                await context?.close();
                await browser.close();
            }
        });
    }
