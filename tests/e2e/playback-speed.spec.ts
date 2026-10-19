import { expect, test } from '@playwright/test';
import { prepareMarkerEditor } from '../support/editor-marking';

test('global rate controls keep source time, persist across routes/refresh and fit every MusicBar style', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    const bar = page.locator('#music-bar-container'),
        trigger = page.getByTestId('playback-speed');
    await trigger.click();
    const slider = page.getByRole('slider', { name: '播放速度', exact: true });
    await slider.press('Home');
    await expect(bar).toHaveAttribute('data-playback-rate', '0.1');
    await slider.press('End');
    await expect(bar).toHaveAttribute('data-playback-rate', '2');
    await page.keyboard.press('Escape');
    await page.getByTestId('toggle-playback').click();
    const measure = async () =>
        page.evaluate(async () => {
            const bar = document.getElementById('music-bar-container')!;
            const start = Number(bar.dataset.currentTime),
                wall = performance.now();
            await new Promise(resolve => setTimeout(resolve, 700));
            return (Number(bar.dataset.currentTime) - start) / ((performance.now() - wall) / 1000);
        });
    expect(await measure()).toBeGreaterThan(1.8);
    await trigger.click();
    await slider.fill('0.5');
    await expect(bar).toHaveAttribute('data-playback-rate', '0.5');
    await page.keyboard.press('Escape');
    const slow = await measure();
    expect(slow).toBeGreaterThan(0.4);
    expect(slow).toBeLessThan(0.6);
    await page.getByTestId('toggle-playback').click();
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    if (await page.getByTestId('editor-leave-dialog').isVisible())
        await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/analyzer$/);
    await expect(bar).toHaveAttribute('data-playback-rate', '0.5');
    await page.reload();
    await expect(bar).toHaveAttribute('data-playback-rate', '0.5');
    await expect(bar).toHaveAttribute('data-playback-state', 'paused');
    for (const width of [390, 1024, 1280, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (let style = 0; style < 3; style++) {
            await expect(trigger).toBeVisible();
            const bounds = await trigger.boundingBox();
            expect(bounds!.x).toBeGreaterThanOrEqual(0);
            expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
            await trigger.click();
            await expect(slider).toBeVisible();
            const panel = await page.locator('.speed-panel').boundingBox();
            expect(panel!.x).toBeGreaterThanOrEqual(0);
            expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
            expect(
                await slider.evaluate(element => {
                    const rect = element.getBoundingClientRect();
                    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                    return hit === element;
                }),
            ).toBe(true);
            await page.screenshot({ path: `artifacts/editor-marking/playback-speed-${width}-${style}.png` });
            await page.keyboard.press('Escape');
            await page.getByTestId('change-musicbar-style').click();
            await expect(page.getByTestId('change-musicbar-style')).toBeEnabled();
        }
    }
    await trigger.click();
    await page.getByTestId('reset-playback-speed').click();
    await expect(trigger).toHaveText('1.0×');
    await expect(bar).toHaveAttribute('data-playback-rate', '1');
    expect(errors).toEqual([]);
});

test('native FT and auxiliary nodes follow rate and preserve source position across switches', async ({ page }) => {
    await page.goto('/tests/transcription/index.html');
    const result = await page.evaluate(async () => {
        const moduleUrl = '/src/audio/audioEngine.ts';
        const { AudioEngine } = await import(moduleUrl);
        const engine = new AudioEngine();
        const encoded = await (await fetch('/artifacts/fixtures/editor-e2-tempo-100-v1.wav')).arrayBuffer();
        await engine.load({ trackId: 'rate-native', encodedAudio: encoded });
        const descriptor = engine.getDecodedAudioDescriptor()!;
        await engine.setPlaybackRate(2);
        let closed = 0;
        const source = (kind: 'ft' | 'auxiliary') => ({
            kind,
            resultId: `rate-${kind}`,
            trackId: 'rate-native',
            label: kind,
            sampleRate: 8000,
            frames: Math.round(descriptor.durationSeconds * 8000),
            roles: ['drums'],
            mutedRoles: [],
            async read(_role: string, _channel: number, start: number, count: number) {
                return Float32Array.from(
                    { length: count },
                    (_, i) => Math.sin((2 * Math.PI * 220 * (start + i)) / 8000) * 0.1,
                );
            },
            async close() {
                closed++;
            },
        });
        await engine.setAuditionSource(source('ft'), { play: true });
        const begin = engine.getSnapshot();
        await new Promise(resolve => setTimeout(resolve, 650));
        const fast = engine.getSnapshot();
        await engine.setPlaybackRate(0.5);
        const changed = engine.getSnapshot();
        await new Promise(resolve => setTimeout(resolve, 650));
        const slow = engine.getSnapshot();
        engine.pause();
        await engine.setAuditionSource(source('auxiliary'));
        const aux = engine.getSnapshot();
        await engine.setAuditionSource(null);
        const original = engine.getSnapshot();
        await engine.dispose();
        return { begin, fast, changed, slow, aux, original, closed };
    });
    expect(result.fast.currentTimeSeconds - result.begin.currentTimeSeconds).toBeGreaterThan(1.1);
    expect(result.changed.currentTimeSeconds).toBeCloseTo(result.fast.currentTimeSeconds, 1);
    expect(result.slow.currentTimeSeconds - result.changed.currentTimeSeconds).toBeGreaterThan(0.25);
    expect(result.slow.currentTimeSeconds - result.changed.currentTimeSeconds).toBeLessThan(0.4);
    expect(result.aux).toMatchObject({ state: 'paused', playbackRate: 0.5, audition: { kind: 'auxiliary' } });
    expect(result.original).toMatchObject({ state: 'paused', playbackRate: 0.5, audition: { kind: 'original' } });
    expect(result.original.currentTimeSeconds).toBeCloseTo(result.aux.currentTimeSeconds, 3);
    expect(result.closed).toBe(2);
});
