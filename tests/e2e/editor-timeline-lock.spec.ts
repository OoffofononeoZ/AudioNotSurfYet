import { expect, test } from '@playwright/test';
import { prepareMarkerEditor, addMarkerLane } from '../support/editor-marking';
import { verifyTimelineAlignment, verifyIndependentTimeline } from '../support/editor-timeline-scenario.mjs';

for (const dpr of [1, 2])
    test(`timeline and marker plots align with and without vertical overflow at DPR ${dpr}`, async ({ browser }) => {
        const context = await browser.newContext({ deviceScaleFactor: dpr, viewport: { width: 1280, height: 900 } });
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await prepareMarkerEditor(page);
            await verifyTimelineAlignment(page, (width: number, height: number) =>
                page.setViewportSize({ width, height }),
            );
            for (let i = 0; i < 10; i++) await addMarkerLane(page, 'point');
            await verifyTimelineAlignment(
                page,
                (width: number, height: number) => page.setViewportSize({ width, height }),
                (name: string) => page.screenshot({ path: `artifacts/editor-timeline/${name}-dpr-${dpr}.png` }),
            );
            await verifyIndependentTimeline(page);
            expect(errors).toEqual([]);
        } finally {
            await context.close();
        }
    });
