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
