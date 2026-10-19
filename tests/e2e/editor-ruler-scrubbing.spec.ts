import { expect, test } from '@playwright/test';
import {
    prepareMarkerEditor,
    seekMarkerEditor,
    addMarkerLane,
    markerSurface,
    clickMarkerTime,
} from '../support/editor-marking';
import { openEditorWorkspace } from '../support/editor-workspaces';

test('ruler drag moves the time band continuously, freezes zoom and keeps the fixed playhead and markers', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await clickMarkerTime(markerSurface(page, 'point'), 4);
    const ruler = page.getByTestId('marker-ruler-time'),
        bar = page.locator('#music-bar-container');
    for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.locator('.app-content').evaluate(async element => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        await seekMarkerEditor(page, 4);
        const rect = (await ruler.boundingBox())!,
            x = rect.x + rect.width * 0.65,
            y = rect.y + 10;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await expect(bar).toHaveAttribute('data-current-time', '4');
        await page.mouse.move(x - rect.width * 0.1234, y, { steps: 5 });
        await expect.poll(async () => Number(await ruler.getAttribute('data-cursor-seconds'))).toBeGreaterThan(5.2);
        expect(Number(await ruler.getAttribute('data-cursor-seconds'))).toBeCloseTo(5.234, 1);
        const span = await page.getByTestId('marker-span').textContent();
        await page.mouse.wheel(0, -100);
        await expect(page.getByTestId('marker-span')).toHaveText(span!);
        expect(
            await ruler.evaluate(element => {
                const rect = element.getBoundingClientRect(),
                    line = element.querySelector('b')!.getBoundingClientRect();
                return Math.abs(line.x - rect.x - rect.width * 0.15);
            }),
        ).toBeLessThanOrEqual(1);
        await page.mouse.move(x - rect.width * 0.0734, y, { steps: 3 });
        await page.mouse.up();
        await expect(ruler).toHaveAttribute('data-dragging', 'false');
        expect(Number(await ruler.getAttribute('data-cursor-seconds'))).toBeCloseTo(4.734, 1);
        await expect(bar).toHaveAttribute('data-playback-state', 'paused');
        await expect(page.locator('.marker-point')).toHaveAttribute('data-time-seconds', '4');
        expect(await page.evaluate(() => getSelection()?.toString())).toBe('');
    }
    await seekMarkerEditor(page, 0);
    const rect = (await ruler.boundingBox())!,
        y = rect.y + 10;
    await page.mouse.move(rect.x + rect.width * 0.5, y);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.7, y);
    await page.mouse.up();
    await expect(ruler).toHaveAttribute('data-cursor-seconds', '0');
    await seekMarkerEditor(page, 11);
    await page.mouse.move(rect.x + rect.width * 0.6, y);
    await page.mouse.down();
    await page.mouse.move(rect.x + rect.width * 0.3, y);
    await page.mouse.up();
    await expect(ruler).toHaveAttribute('data-cursor-seconds', '12');
    expect(errors).toEqual([]);
});

test('playing ruler scrubs preserve rate and cancel on Escape, blur and workspace changes', async ({ page }) => {
    await prepareMarkerEditor(page);
    await seekMarkerEditor(page, 2);
    const ruler = page.getByTestId('marker-ruler-time'),
        bar = page.locator('#music-bar-container');
    await page.getByTestId('playback-speed').click();
    await page.getByRole('slider', { name: '播放速度', exact: true }).fill('2');
    await page.keyboard.press('Escape');
    await page.getByTestId('toggle-playback').click();
    const rect = (await ruler.boundingBox())!,
        x = rect.x + rect.width * 0.65,
        y = rect.y + 10;
    const before = Number(await ruler.getAttribute('data-cursor-seconds'));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - rect.width * 0.1, y);
    await page.mouse.up();
    await expect
        .poll(async () => Number(await ruler.getAttribute('data-cursor-seconds')))
        .toBeGreaterThan(before + 0.9);
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await expect(bar).toHaveAttribute('data-playback-rate', '2');
    await page.getByTestId('toggle-playback').click();
    for (const action of ['escape', 'blur', 'workspace']) {
        await seekMarkerEditor(page, 4);
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 10, y);
        await expect(ruler).toHaveAttribute('data-dragging', 'true');
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        if (action === 'workspace')
            await page.getByTestId('editor-separation-tab').evaluate(element => (element as HTMLButtonElement).click());
        await page.mouse.up();
        if (action === 'workspace') await page.getByTestId('editor-marking-tab').click();
        await expect(ruler).toHaveAttribute('data-dragging', 'false');
        const stopped = await ruler.getAttribute('data-cursor-seconds');
        await page.mouse.move(x - 40, y);
        await expect(ruler).toHaveAttribute('data-cursor-seconds', stopped!);
    }
});

test('Editor ordinary text and teleported menus are not selectable, while fields and other routes retain selection', async ({
    page,
}) => {
    await prepareMarkerEditor(page);
    await addMarkerLane(page, 'point');
    await expect(page.locator('body')).toHaveClass(/editor-text-selection-disabled/);
    await expect(page.locator('.marker-toolbar h2')).toHaveCSS('user-select', 'none');
    const name = page.locator('[data-testid^="point-lane-name-"]');
    await name.fill('可编辑名称');
    await name.press('Home');
    await name.press('Shift+End');
    await expect(name).toHaveCSS('user-select', 'text');
    expect(
        await name.evaluate(element => {
            const input = element as HTMLInputElement;
            return input.value.slice(input.selectionStart!, input.selectionEnd!);
        }),
    ).toBe('可编辑名称');
    await name.press('Enter');
    await page.getByTestId('add-marker-lane').click();
    await expect(page.getByRole('menuitem', { name: '点标记', exact: true })).toHaveCSS('user-select', 'none');
    await page.keyboard.press('Escape');
    for (const workspace of ['separation', 'transcription', 'marking'] as const) {
        await openEditorWorkspace(page, workspace);
        await expect(page.locator('body')).toHaveClass(/editor-text-selection-disabled/);
    }
    await page.getByRole('link', { name: 'Analyzer', exact: true }).click();
    await expect(page.getByTestId('editor-leave-dialog')).toBeVisible();
    await page.getByTestId('editor-leave-confirm').click();
    await expect(page).toHaveURL(/analyzer$/);
    await expect(page.locator('body')).not.toHaveClass(/editor-text-selection-disabled/);
    const value = await page.evaluate(() => {
        const text = document.createElement('p');
        text.textContent = 'selection probe';
        document.body.append(text);
        const value = getComputedStyle(text).userSelect;
        text.remove();
        return value;
    });
    expect(value).not.toBe('none');
});

test('real chunked FT and auxiliary audition scrubs keep playing at the selected rate', async ({ page }) => {
    await page.goto('/tests/transcription/index.html');
    const snapshots = await page.evaluate(async () => {
        const engineUrl = '/src/audio/audioEngine.ts',
            scrubberUrl = '/src/editor/markerRulerScrubber.ts';
        const { AudioEngine } = await import(engineUrl),
            { MarkerRulerScrubber } = await import(scrubberUrl);
        const engine = new AudioEngine();
        await engine.load({
            trackId: 'scrub-native',
            encodedAudio: await (await fetch('/artifacts/fixtures/editor-e2-tempo-100-v1.wav')).arrayBuffer(),
        });
        const frames = Math.round(engine.getSnapshot().durationSeconds * 8000),
            snapshots = [];
        const scrubber = new MarkerRulerScrubber({
            available: () => true,
            playback: () => engine.getSnapshot(),
            seek: (time: number) => engine.seek(time),
            requestFrame: (callback: () => void) => requestAnimationFrame(callback),
            cancelFrame: (id: number) => cancelAnimationFrame(id),
            changed: () => {},
        });
        try {
            for (const [kind, rate] of [
                ['ft', 2],
                ['auxiliary', 0.5],
            ] as const) {
                engine.pause();
                await engine.setPlaybackRate(rate);
                await engine.seek(2);
                await engine.setAuditionSource(
                    {
                        kind,
                        trackId: 'scrub-native',
                        resultId: kind,
                        label: kind,
                        sampleRate: 8000,
                        frames,
                        roles: ['drums'],
                        mutedRoles: [],
                        async read(_role: string, _channel: number, _start: number, count: number) {
                            await new Promise(resolve => setTimeout(resolve, 10));
                            return new Float32Array(count).fill(0.1);
                        },
                        async close() {},
                    },
                    { play: true },
                );
                scrubber.begin(100, 10, 100);
                scrubber.move(90);
                await new Promise(resolve => setTimeout(resolve, 20));
                scrubber.move(85);
                scrubber.end(80);
                const deadline = performance.now() + 5000;
                while (scrubber.hasGesture && performance.now() < deadline)
                    await new Promise(resolve => setTimeout(resolve, 20));
                if (scrubber.hasGesture) throw Error('scrub did not finish');
                snapshots.push(engine.getSnapshot());
            }
        } finally {
            scrubber.cancel();
            await engine.dispose();
        }
        return snapshots;
    });
    for (const [index, rate] of [2, 0.5].entries()) {
        expect(snapshots[index]).toMatchObject({ state: 'playing', playbackRate: rate });
        expect(snapshots[index]!.currentTimeSeconds).toBeGreaterThanOrEqual(3.99);
        expect(snapshots[index]!.currentTimeSeconds).toBeLessThan(4.5);
    }
});
