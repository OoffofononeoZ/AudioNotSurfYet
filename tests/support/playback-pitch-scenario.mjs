import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from '@playwright/test';

export async function writePitchFixture(file) {
    const rate = 48000,
        frames = rate * 30;
    const wav = Buffer.alloc(44 + frames * 4);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(wav.length - 8, 4);
    wav.write('WAVEfmt ', 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(2, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 4, 28);
    wav.writeUInt16LE(4, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(frames * 4, 40);
    for (let i = 0; i < frames; i++) {
        const value = Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 8000);
        wav.writeInt16LE(value, 44 + i * 4);
        wav.writeInt16LE(value, 46 + i * 4);
    }
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, wav);
}

export async function installPlaybackPitchProbe(page) {
    const install = () => {
        if (globalThis.__playbackPitchProbeInstalled) return;
        globalThis.__playbackPitchProbeInstalled = true;
        globalThis.__pitchTransport = { worklets: 0, sources: [], processors: [] };
        const Worklet = AudioWorkletNode;
        globalThis.AudioWorkletNode = new Proxy(Worklet, {
            construct(target, args) {
                const node = Reflect.construct(target, args);
                if (args[1] === 'signalsmith-stretch') {
                    globalThis.__pitchTransport.worklets++;
                    const entry = { active: true, disposalId: null };
                    globalThis.__pitchTransport.processors.push(entry);
                    const post = node.port.postMessage.bind(node.port);
                    node.port.postMessage = (...args) => {
                        if (args[0][1] === 'dispose') entry.disposalId = args[0][0];
                        return post(...args);
                    };
                    node.port.addEventListener('message', event => {
                        if (event.data[0] === entry.disposalId) entry.active = false;
                    });
                }
                return node;
            },
        });
        const createSource = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const source = createSource.call(this);
            const entry = { active: false, node: source };
            globalThis.__pitchTransport.sources.push(entry);
            const start = source.start.bind(source),
                stop = source.stop.bind(source);
            source.start = (...args) => {
                entry.active = true;
                return start(...args);
            };
            source.stop = (...args) => {
                entry.active = false;
                return stop(...args);
            };
            source.addEventListener('ended', () => {
                entry.active = false;
            });
            return source;
        };
        const create = AudioContext.prototype.createAnalyser;
        AudioContext.prototype.createAnalyser = function () {
            const node = create.call(this);
            globalThis.__playbackPitchProbe ??= { node, context: this };
            return node;
        };
    };
    await page.addInitScript(install);
    await page.evaluate(install);
}

export async function readPlaybackPitch(page) {
    return page.evaluate(() => {
        const { node, context } = globalThis.__playbackPitchProbe;
        node.fftSize = 32768;
        const spectrum = new Float32Array(node.frequencyBinCount);
        node.getFloatFrequencyData(spectrum);
        let peak = 0;
        for (let i = 1; i < spectrum.length; i++) if (spectrum[i] > spectrum[peak]) peak = i;
        return { frequency: (peak * context.sampleRate) / node.fftSize, decibels: spectrum[peak] };
    });
}

export async function verifyEditorPitchScrubbing(page) {
    const bar = page.locator('#music-bar-container');
    await page.getByTestId('playback-speed').click();
    const slider = page.getByRole('slider', { name: '播放速度', exact: true });
    await page.getByRole('switch', { name: '变速时变调' }).uncheck();
    await slider.fill('0.5');
    await page.keyboard.press('Escape');
    await page.getByTestId('toggle-playback').click();
    await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(0.1);
    const ruler = page.getByTestId('marker-ruler-time'),
        rect = await ruler.boundingBox();
    const before = await page.evaluate(() => globalThis.__pitchTransport.worklets);
    await page.evaluate(() => {
        const { node } = globalThis.__playbackPitchProbe;
        node.fftSize = 1024;
        const values = new Float32Array(1024);
        const samples = [];
        const timer = setInterval(() => {
            node.getFloatTimeDomainData(values);
            samples.push(Math.sqrt(values.reduce((sum, value) => sum + value * value, 0) / values.length));
        }, 16);
        globalThis.__scrubSignal = { samples, timer };
    });
    await page.mouse.move(rect.x + rect.width * 0.65, rect.y + 10);
    await page.mouse.down();
    for (let i = 1; i <= 30; i++) await page.mouse.move(rect.x + rect.width * (0.65 - i * 0.005), rect.y + 10);
    await page.mouse.up();
    const samples = await page.evaluate(() => {
        clearInterval(globalThis.__scrubSignal.timer);
        return globalThis.__scrubSignal.samples;
    });
    expect(samples.length).toBeGreaterThan(5);
    expect(samples.filter(value => value < 0.0001)).toHaveLength(0);
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('playback-speed').click();
    await page.getByTestId('reset-playback-speed').click();
    await expect(bar).toHaveAttribute('data-playback-rate', '1');
    await page.keyboard.press('Escape');
    const start = Number(await bar.getAttribute('data-current-time'));
    await expect.poll(async () => Number(await bar.getAttribute('data-current-time'))).toBeGreaterThan(start + 0.15);
    const measured = await page.evaluate(async () => {
        // The displayed snapshot is published on RAF; sample at that same boundary.
        await new Promise(resolve => requestAnimationFrame(resolve));
        const bar = document.getElementById('music-bar-container');
        const start = Number(bar.dataset.currentTime),
            wall = performance.now();
        const context = globalThis.__playbackPitchProbe.context,
            contextStart = context.currentTime;
        await new Promise(resolve => setTimeout(resolve, 700));
        await new Promise(resolve => requestAnimationFrame(resolve));
        return {
            rate: (Number(bar.dataset.currentTime) - start) / ((performance.now() - wall) / 1000),
            contextRate: (context.currentTime - contextStart) / ((performance.now() - wall) / 1000),
            worklets: globalThis.__pitchTransport.worklets,
            activeWorklets: globalThis.__pitchTransport.processors.filter(processor => processor.active).length,
            activeRates: globalThis.__pitchTransport.sources
                .filter(source => source.active)
                .map(source => source.node.playbackRate.value),
        };
    });
    console.log('Editor pitch scrubbing clocks', measured);
    expect(measured.activeRates).toEqual([1]);
    expect(measured.activeWorklets).toBe(0);
    expect(measured.rate).toBeGreaterThan(0.9);
    expect(measured.rate).toBeLessThan(1.1);
    expect(measured.worklets).toBe(before);
    await expect.poll(async () => Math.abs((await readPlaybackPitch(page)).frequency - 440)).toBeLessThan(5);
    return measured;
}

/** Uses the actual shared playback graph. Only selection of the controlled sine fixture is supplied by the caller. */
export async function verifyPlaybackPitchControls(page) {
    const bar = page.locator('#music-bar-container');
    const trigger = page.getByTestId('playback-speed');
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await trigger.click();
    const slider = page.getByRole('slider', { name: '播放速度', exact: true });
    const toggle = page.getByRole('switch', { name: '变速时变调' });
    await expect(toggle).not.toBeChecked();
    const results = [];
    const verify = async (rate, changesPitch) => {
        const expected = changesPitch ? 440 * rate : 440;
        await expect
            .poll(async () => Math.abs((await readPlaybackPitch(page)).frequency - expected), { timeout: 8000 })
            .toBeLessThan(5);
        await expect(bar).toHaveAttribute('data-playback-state', 'playing');
        results.push({ rate, changesPitch, ...(await readPlaybackPitch(page)) });
    };
    for (const rate of [0.1, 0.5, 1, 2]) {
        await slider.fill(String(rate));
        await verify(rate, false);
        await toggle.check();
        await verify(rate, true);
        await toggle.uncheck();
        await verify(rate, false);
    }
    // Space belongs to the native input, and must not toggle global playback.
    await toggle.focus();
    await page.keyboard.press('Space');
    await expect(toggle).toBeChecked();
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await page.getByTestId('reset-playback-speed').click();
    await expect(trigger).toHaveText('1.0×');
    await expect(toggle).toBeChecked();
    await slider.fill('0.5');
    await page.reload();
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    await expect(bar).toHaveAttribute('data-playback-changes-pitch', 'true');
    await trigger.click();
    await expect(toggle).toBeChecked();
    await page.keyboard.press('Escape');
    return results;
}
