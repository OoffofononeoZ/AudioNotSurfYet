import { expect, test, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';

async function probe(page: Page) {
    return page.evaluate(
        () =>
            (window as any).__editingProbe as {
                initializes: number;
                history: number;
                frames: number;
                states: Record<string, number[]>;
            },
    );
}

test('later-song property editing keeps history warm and renders the latest values while paused and playing', async ({
    page,
}) => {
    test.setTimeout(120000);
    const directory = path.resolve('artifacts/visualizer-parameter-history');
    await mkdir(directory, { recursive: true });
    const wav = Buffer.alloc(44 + 180 * 8000 * 2);
    wav.write('RIFF');
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(16000, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(wav.length - 44, 40);
    const audio = path.join(directory, 'long-editing.wav');
    await writeFile(audio, wav);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts';
        const { IsolatedAlgorithmRuntime } = await import(runtimePath);
        const stats = { initializes: 0, history: 0, frames: 0, states: {} as Record<string, number[]> };
        (window as any).__editingProbe = stats;
        const original = IsolatedAlgorithmRuntime.prototype.prepareFrames;
        const initialize = IsolatedAlgorithmRuntime.prototype.initialize;
        IsolatedAlgorithmRuntime.prototype.initialize = function (...args: any[]) {
            stats.initializes++;
            return initialize.apply(this, args);
        };
        IsolatedAlgorithmRuntime.prototype.prepareFrames = async function (frames: any, history: any, ...rest: any[]) {
            const packets = await original.call(
                this,
                frames,
                (...args: any[]) => {
                    stats.history++;
                    return history(...args);
                },
                ...rest,
            );
            stats.frames++;
            for (const [id, packet] of packets) stats.states[id] = packet.state;
            return packets;
        };
    });
    await chooseFiles(page, [audio]);
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    await page.getByTestId('header-visualizer-link').click();
    for (const id of ['solid', 'spectral-strings', 'circular-particles']) {
        await page.getByTestId('add-visualizer-element').click();
        await page.locator(`[data-element-type="${id}"]`).click();
    }
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(1);
    const project: VisualizerProjectV5 = JSON.parse(
        Buffer.from((await savedPickerEntries(page))[0]!.base64, 'base64').toString('utf8'),
    );
    for (const e of project.elements) {
        if (e.seed !== undefined) e.seed = 123;
        // Keep the constant-signal fixture's string motion above floating-point underflow at 120s.
        if (e.resource.id === 'spectral-strings')
            e.bindings.find(b => b.parameterId === 'decay')!.source = { kind: 'constant', value: 5 };
        for (const b of e.bindings)
            if (b.parameterId === 'spectrum')
                b.source = {
                    kind: 'constant',
                    value: Array.from({ length: 128 }, (_, i) => 0.05 + 0.1 * Math.sin(i) ** 2),
                };
    }
    await queuePickerData(page, [
        { name: 'editing.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    const canvas = page.getByTestId('visualizer-preview-canvas');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    const seek = async (time: number) => {
        await page.getByTestId('visualizer-preview-frame').hover();
        await page.getByTestId('visualizer-fullscreen-toggle').click();
        const slider = page.getByTestId('visualizer-seek');
        await slider.fill(String(time));
        await slider.dispatchEvent('input');
        await expect(canvas).toHaveAttribute('data-frame-time', time.toFixed(6));
        await page.getByTestId('visualizer-fullscreen-toggle').click();
    };
    const select = async (id: string) => {
        const element = project.elements.find(e => e.resource.id === id)!;
        await page.locator(`[data-element-id="${element.id}"] .viz-element-select`).click();
    };
    const edit = async (value: string) => {
        const before = await canvas.getAttribute('data-binding-revision');
        const field = page.getByRole('spinbutton', { name: '透明度', exact: true });
        await field.fill(value);
        await field.press('Enter');
        await expect.poll(() => canvas.getAttribute('data-binding-revision')).not.toBe(before);
    };
    for (const time of [0, 60, 120]) {
        await seek(time);
        const baseline = await probe(page);
        for (const id of ['solid', 'spectral-strings', 'circular-particles']) {
            await select(id);
            await edit(String(0.4 + time / 1000));
            const after = await probe(page);
            expect(after.history).toBe(baseline.history);
            expect(after.initializes).toBe(baseline.initializes);
            expect(after.states).toEqual(baseline.states);
        }
    }
    const baseline = await probe(page);
    const field = page.getByRole('spinbutton', { name: '透明度', exact: true });
    for (let i = 0; i < 12; i++) await field.press('ArrowDown');
    await expect(field).toHaveValue('0');
    await edit('.6');
    expect((await probe(page)).history).toBe(baseline.history);
    await page.getByTestId('toggle-playback').click();
    await edit('.7');
    await page.getByTestId('toggle-playback').click();
    expect((await probe(page)).initializes).toBe(baseline.initializes);
    await canvas.screenshot({ path: path.join(directory, `${test.info().project.name}.png`) });
    expect(errors).toEqual([]);
});

test('superseded history and marker queries reject one frame without disposing the sandbox', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts';
        const identityPath = '/src/visualizer/resourceIdentity.ts';
        const stalePath = '/src/visualizer/framePreparation.ts';
        const { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } = await import(runtimePath);
        const { resourceHash } = await import(identityPath);
        const { FrameSupersededError } = await import(stalePath);
        const algorithm = {
            id: 'superseded-input',
            version: 1,
            apiVersion: 2,
            contract: {
                kind: 'visual',
                parameters: [{ id: 'value', valueKind: 'number', allowedSourceKinds: ['constant'] }],
                historyParameters: ['value'],
                sharedParameters: [],
                markerInputs: [{ id: 'points', eventKind: 'point', selectionModes: ['collection'] }],
            },
            source: `export function create(){ return { async prepareFrame(frame,input){
                if(frame.time===1) await input.history({parameterId:'value',startTick:0,endTick:1});
                if(frame.time===2) await input.markers({inputId:'points',startSeconds:0,endSeconds:1});
                return {passes:[]};
            }};}`,
            programs: { draw: { geometry: 'quad', vertex: 'void main(){}', fragment: 'void main(){}', uniforms: {} } },
        };
        const runtime = new IsolatedAlgorithmRuntime();
        try {
            await runtime.initialize([{ id: 'instance', algorithm: { ...algorithm, hash: resourceHash(algorithm) } }]);
            const iframe = document.querySelector('iframe[sandbox]');
            let rejected = 0;
            for (const time of [1, 2, 0]) {
                try {
                    await runtime.prepareFrames(
                        [
                            {
                                id: 'instance',
                                frame: {
                                    time,
                                    seed: 1,
                                    revision: '1',
                                    width: 1,
                                    height: 1,
                                    range: null,
                                    parameters: { value: { value: 1 } },
                                },
                            },
                        ],
                        async () => {
                            throw new FrameSupersededError();
                        },
                        undefined,
                        async () => {
                            throw new FrameSupersededError();
                        },
                    );
                } catch {
                    rejected++;
                }
            }
            return {
                rejected,
                same: document.querySelector('iframe[sandbox]') === iframe,
                tasks: algorithmRuntimeDiagnostics.activeTasks,
            };
        } finally {
            runtime.dispose();
        }
    });
    expect(result).toEqual({ rejected: 2, same: true, tasks: 0 });
});
