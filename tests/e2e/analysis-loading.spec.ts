import { expect, test } from '@playwright/test';
import { installFilePickerStub } from '../support/file-picker';

test('the BPM waveform appears independently and zoom detail interrupts background BPM', async ({ page }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
        const events: Array<{ kind: string; at: number; featureIds?: string[] }> = [];
        Reflect.set(window, '__analysisLoading', events);
        const NativeWorker = window.Worker,
            post = Worker.prototype.postMessage;
        Worker.prototype.postMessage = function (message, options?: StructuredSerializeOptions | Transferable[]) {
            if (['prepare-source', 'analyze', 'window-series'].includes(message?.kind))
                events.push({ kind: message.kind, at: performance.now(), featureIds: message.featureIds });
            return Reflect.apply(post, this, [message, options]);
        };
        window.Worker = new Proxy(NativeWorker, {
            construct(Target, args) {
                const worker = Reflect.construct(Target, args) as Worker;
                worker.addEventListener('message', ({ data }) => {
                    if (
                        ['result', 'tempo-started', 'tempo-estimate-result', 'window-series-result'].includes(
                            data?.kind,
                        )
                    )
                        events.push({ kind: data.kind, at: performance.now() });
                });
                return worker;
            },
        });
    });
    await installFilePickerStub(page);
    await page.goto('/');
    await page.evaluate(async () => {
        const rate = 48000,
            length = rate * 180,
            bytes = new ArrayBuffer(44 + length * 2),
            view = new DataView(bytes);
        const text = (at: number, value: string) => {
            for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i));
        };
        text(0, 'RIFF');
        view.setUint32(4, bytes.byteLength - 8, true);
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
        view.setUint32(40, length * 2, true);
        for (let i = 0; i < length; i++)
            view.setInt16(
                44 + i * 2,
                Math.round(
                    (0.2 * Math.sin(i * 0.0576) +
                        0.5 * Math.sin(i * 0.01) * Math.exp((-(i % (rate * 0.6)) / rate) * 30)) *
                        32767,
                ),
                true,
            );
        const root = await navigator.storage.getDirectory(),
            handle = await root.getFileHandle('analysis-loading-180s.wav', { create: true }),
            writer = await handle.createWritable();
        await writer.write(bytes);
        await writer.close();
        Reflect.get(window, '__audioNotSurfYetPickerQueue').push([handle]);
    });
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('toggle-playback').click();
    const started = await page.evaluate(() => performance.now());
    await page.getByTestId('header-editor-link').click();
    await expect(page.getByTestId('editor-buffer-state')).toHaveText('波形已就绪');
    const waveReady = await page.evaluate(() => performance.now());
    await page.waitForFunction(() =>
        Reflect.get(window, '__analysisLoading').some((e: { kind: string }) => e.kind === 'tempo-started'),
    );
    await page.evaluate(async () => {
        const stage = document.querySelector('[data-testid="editor-timeline"]')!;
        for (let i = 0; i < 5; i++) {
            stage.dispatchEvent(
                new KeyboardEvent('keydown', {
                    bubbles: true,
                    cancelable: true,
                    key: '+',
                }),
            );
            await new Promise<void>(resolve => setTimeout(resolve, 0));
        }
    });
    await page.waitForFunction(() =>
        Reflect.get(window, '__analysisLoading').some((e: { kind: string }) => e.kind === 'window-series-result'),
    );
    // A manual choice while the estimator is running must survive its late result.
    await page.getByTestId('toggle-editor-timing').click();
    const bpm = page.getByRole('spinbutton', { name: '辅助 BPM', exact: true });
    await bpm.fill('120');
    await bpm.press('Enter');
    await page.waitForFunction(() =>
        Reflect.get(window, '__analysisLoading').some((e: { kind: string }) => e.kind === 'tempo-estimate-result'),
    );
    const events = await page.evaluate(
        () => Reflect.get(window, '__analysisLoading') as Array<{ kind: string; at: number }>,
    );
    const detail = events.find(e => e.kind === 'window-series-result')!,
        tempo = events.find(e => e.kind === 'tempo-estimate-result')!;
    expect(detail.at).toBeLessThan(tempo.at);
    expect(waveReady).toBeLessThan(tempo.at);
    expect(events.filter(e => e.kind === 'prepare-source')).toHaveLength(1);
    await expect(page.getByTestId('tempo-bpm-0')).toHaveValue('120');
    console.log(
        JSON.stringify({
            metric: 'editor-bpm-waveform-loading',
            waveReadyMs: waveReady - started,
            detailMs: detail.at - started,
            tempoMs: tempo.at - started,
        }),
    );
});
