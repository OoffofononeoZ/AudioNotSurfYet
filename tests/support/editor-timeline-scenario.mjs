import { expect } from '@playwright/test';

export async function verifyTimelineAlignment(page, resize, screenshot) {
    for (const width of [390, 1024, 1920]) {
        await resize(width, 900);
        await page.evaluate(async () => {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {})));
        });
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const ruler = document.querySelector('[data-testid="marker-ruler-time"]').getBoundingClientRect();
                    let error = 0;
                    for (const selector of [
                        '[data-testid="editor-timeline"]',
                        '[data-testid="editor-tempo-lane"]',
                        '.marker-surface',
                    ]) {
                        for (const element of document.querySelectorAll(selector)) {
                            const rect = element.getBoundingClientRect();
                            error = Math.max(
                                error,
                                Math.abs(rect.left - ruler.left),
                                Math.abs(rect.right - ruler.right),
                            );
                        }
                    }
                    const rail = document.querySelector('.beat-control-rail').getBoundingClientRect();
                    for (const element of document.querySelectorAll(
                        '.beat-control-rail button, .beat-control-rail select, .beat-control-rail input',
                    )) {
                        const rect = element.getBoundingClientRect();
                        error = Math.max(error, rail.left - rect.left, rect.right - rail.right);
                    }
                    const panel = document.querySelector('.editor-timeline-panel');
                    return Math.max(error, panel.scrollWidth - panel.clientWidth);
                }),
            )
            .toBeLessThanOrEqual(1);
        if ((await page.getByTestId('editor-timeline').getAttribute('data-locked')) === 'true')
            await expectLockedAlignment(page);
        if (screenshot) await screenshot(`alignment-${width}`);
    }
}

export const timelineRange = async page =>
    page.getByTestId('editor-timeline').evaluate(element => ({
        start: Number(element.dataset.viewStart),
        end: Number(element.dataset.viewEnd),
    }));

export async function verifyIndependentTimeline(page) {
    const wave = page.getByTestId('editor-timeline');
    await wave.focus();
    await page.keyboard.press('Home');
    const original = await timelineRange(page);
    const markerSpan = await page.getByTestId('marker-span').textContent();
    await wave.hover({ position: { x: 100, y: 50 } });
    await page.mouse.wheel(0, -200);
    await expect
        .poll(async () => {
            const v = await timelineRange(page);
            return v.end - v.start;
        })
        .toBeLessThan(original.end - original.start);
    await expect(page.getByTestId('marker-span')).toHaveText(markerSpan);
    const rect = await wave.boundingBox();
    const before = await timelineRange(page);
    await page.mouse.move(rect.x + rect.width * 0.5, rect.y + 50);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(rect.x + rect.width * 0.35, rect.y + 50, { steps: 5 });
    await page.mouse.up({ button: 'right' });
    await expect.poll(async () => (await timelineRange(page)).start).toBeGreaterThan(before.start);
    await wave.click({ position: { x: rect.width * 0.4, y: 50 } });
    await expect
        .poll(async () => Number(await page.getByTestId('marker-ruler-time').getAttribute('data-cursor-seconds')))
        .toBeGreaterThan(1);
    await wave.click({ button: 'right', position: { x: rect.width * 0.5, y: 50 } });
    await page.getByRole('menuitem', { name: '重置为全曲', exact: true }).click();
    await expect.poll(() => timelineRange(page)).toEqual(original);
    await wave.focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.getByTestId('add-tempo-boundary').click();
    await expect(page.locator('[data-testid^="tempo-boundary-"][data-time-seconds="2"]')).toBeVisible();
}

async function expectLockedAlignment(page) {
    await expect
        .poll(() =>
            page.evaluate(() => {
                const wave = document.querySelector('[data-testid="editor-timeline"]');
                const ruler = document.querySelector('[data-testid="marker-ruler-time"]');
                const rect = wave.getBoundingClientRect(),
                    rr = ruler.getBoundingClientRect();
                return Math.max(
                    Math.abs(Number(wave.dataset.viewStart) - Number(ruler.dataset.viewStart)),
                    Math.abs(Number(wave.dataset.viewEnd) - Number(ruler.dataset.viewEnd)),
                    Math.abs(rect.left - rr.left),
                    Math.abs(rect.right - rr.right),
                );
            }),
        )
        .toBeLessThanOrEqual(0.000001);
    await expect
        .poll(() =>
            page.evaluate(() => {
                const wave = document.querySelector('[data-testid="editor-timeline"]');
                const canvas = wave.querySelector('.cursor-canvas');
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, 1).data;
                const xs = [];
                for (let x = 0; x < canvas.width; x++) if (pixels[x * 4 + 3] > 0) xs.push(x);
                if (!xs.length) return Infinity;
                return Math.abs(
                    (xs[0] + xs.at(-1) + 1) / 2 / devicePixelRatio - wave.getBoundingClientRect().width * 0.15,
                );
            }),
        )
        .toBeLessThanOrEqual(1);
}

export async function readTimelineProject(page) {
    return page.evaluate(
        () =>
            new Promise((resolve, reject) => {
                const request = indexedDB.open('audionotsurfyet-editor');
                request.onerror = () => reject(request.error);
                request.onsuccess = () => {
                    const db = request.result,
                        get = db.transaction('draft').objectStore('draft').get('latest');
                    get.onerror = () => {
                        db.close();
                        reject(get.error);
                    };
                    get.onsuccess = () => {
                        db.close();
                        resolve(get.result?.envelope.project);
                    };
                };
            }),
    );
}

export async function verifyTimelineLock(page, screenshot) {
    const wave = page.getByTestId('editor-timeline'),
        ruler = page.getByTestId('marker-ruler-time');
    const button = page.getByTestId('lock-editor-timeline'),
        bar = page.locator('#music-bar-container');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await wave.focus();
    await page.keyboard.press('Home');
    await wave.hover({ position: { x: 100, y: 50 } });
    await page.mouse.wheel(0, -100);
    await expect(page.getByTestId('editor-save-state')).toHaveAttribute('data-state', 'saved');
    const independent = await timelineRange(page),
        original = await readTimelineProject(page);
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expectLockedAlignment(page);
    expect((await timelineRange(page)).start).toBeLessThan(0);
    const rect = await wave.boundingBox();
    await wave.click({ position: { x: rect.width * 0.8, y: 50 } });
    await expect(bar).toHaveAttribute('data-current-time', '0');
    const span = Number((await timelineRange(page)).end - (await timelineRange(page)).start);
    await wave.hover({ position: { x: 100, y: 50 } });
    await page.mouse.wheel(0, -100);
    await expect
        .poll(async () => {
            const v = await timelineRange(page);
            return v.end - v.start;
        })
        .toBeLessThan(span);
    await ruler.hover();
    await page.mouse.wheel(0, 100);
    await expect
        .poll(async () => {
            const v = await timelineRange(page);
            return v.end - v.start;
        })
        .toBeCloseTo(span, 6);
    await wave.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    const x = rect.x + rect.width * 0.65,
        y = rect.y + 50;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect(wave).toHaveAttribute('data-dragging', 'true');
    await ruler.dispatchEvent('wheel', { deltaY: -100 });
    expect((await timelineRange(page)).end - (await timelineRange(page)).start).toBeCloseTo(span, 6);
    await page.mouse.move(x - rect.width * 0.1, y, { steps: 5 });
    await page.mouse.up();
    await expect
        .poll(async () => Number(await ruler.getAttribute('data-cursor-seconds')))
        .toBeCloseTo(2 + span * 0.1, 3);
    await expectLockedAlignment(page);
    await page.mouse.move(x, y);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(x - 40, y, { steps: 3 });
    await page.mouse.up({ button: 'right' });
    await expect(page.getByTestId('editor-timeline-menu')).toBeHidden();
    expect(await readTimelineProject(page)).toEqual(original);
    await page.getByTestId('playback-speed').click();
    await page.getByRole('slider', { name: '播放速度', exact: true }).fill('2');
    await page.keyboard.press('Escape');
    await page.getByTestId('toggle-playback').click();
    const before = Number(await ruler.getAttribute('data-cursor-seconds'));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await expect
        .poll(async () => Number(await ruler.getAttribute('data-cursor-seconds')))
        .toBeGreaterThan(before + 0.2);
    await expect(wave).toHaveAttribute('data-dragging', 'true');
    await page.mouse.move(x - rect.width * 0.03, y, { steps: 3 });
    await page.mouse.up();
    await expect(bar).toHaveAttribute('data-playback-state', 'playing');
    await expect(bar).toHaveAttribute('data-playback-rate', '2');
    await expectLockedAlignment(page);
    await page.getByTestId('toggle-playback').click();
    await wave.focus();
    await page.keyboard.press('End');
    await expectLockedAlignment(page);
    expect((await timelineRange(page)).end).toBeGreaterThan(12);
    if (screenshot) await screenshot('locked-song-end');
    await button.click();
    await expect.poll(() => timelineRange(page)).toEqual(independent);
    await button.click();
    for (const action of ['escape', 'blur', 'workspace', 'mode']) {
        await wave.focus();
        await page.keyboard.press('Home');
        await page.keyboard.press('ArrowRight');
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 20, y, { steps: 3 });
        await expect(wave).toHaveAttribute('data-dragging', 'true');
        if (action === 'escape') await page.keyboard.press('Escape');
        if (action === 'blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
        if (action === 'workspace') await page.getByTestId('editor-separation-tab').dispatchEvent('click');
        if (action === 'mode') {
            await button.focus();
            await page.keyboard.press('Enter');
        }
        const stopped = await ruler.getAttribute('data-cursor-seconds');
        await page.mouse.move(x - 60, y);
        await page.mouse.up();
        await expect(wave).toHaveAttribute('data-dragging', 'false');
        await expect(ruler).toHaveAttribute('data-cursor-seconds', stopped);
        if (action === 'workspace') {
            await page.getByTestId('editor-marking-tab').click();
            await expect(button).toHaveAttribute('aria-pressed', 'true');
        }
        if (action === 'mode') {
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            await button.click();
        }
    }
    await wave.focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
    await page.getByTestId('add-tempo-boundary').click();
    const boundary = page.locator('button[data-testid^="tempo-boundary-"][data-time-seconds="6"]');
    const boundaryRect = await boundary.boundingBox();
    await page.mouse.move(boundaryRect.x + boundaryRect.width / 2, boundaryRect.y + 5);
    await page.mouse.down();
    await page.mouse.move(boundaryRect.x + boundaryRect.width / 2 + rect.width * 0.05, boundaryRect.y + 5, {
        steps: 4,
    });
    await expect
        .poll(async () =>
            Number(
                await page.locator('button[data-testid^="tempo-boundary-"]').last().getAttribute('data-time-seconds'),
            ),
        )
        .toBeCloseTo(6.5, 3);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await expect(boundary).toBeVisible();
    await button.click();
    await expect.poll(() => timelineRange(page)).toEqual(independent);
}
