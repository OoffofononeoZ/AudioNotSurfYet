import assert from 'node:assert/strict';

/** Inspect actual Canvas output, including the viewport-sized Editor overlay. */
export async function verifyWaveformPixels(page, selector, mirror = false, panelSelector) {
    const panel = panelSelector ? await page.locator(panelSelector).boundingBox() : null;
    const result = await page
        .locator(selector)
        .first()
        .evaluate((canvas, panel) => {
            const bounds = canvas.getBoundingClientRect(),
                dpr = canvas.width / bounds.width;
            const rect = panel ?? bounds;
            const x0 = Math.max(0, Math.round((rect.x - bounds.x) * dpr));
            const x1 = Math.min(canvas.width, Math.round((rect.x + rect.width - bounds.x) * dpr));
            const y0 = Math.max(0, Math.round((rect.y - bounds.y) * dpr));
            const y1 = Math.min(canvas.height, Math.round((rect.y + rect.height - bounds.y) * dpr));
            const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
            const reference = document.createElement('canvas');
            reference.width = 1;
            reference.height = canvas.height;
            const background = reference.getContext('2d');
            const gradient = background.createLinearGradient(0, y0, 0, y1);
            const style = getComputedStyle(document.documentElement);
            gradient.addColorStop(0, style.getPropertyValue('--editor-stage-top').trim());
            gradient.addColorStop(1, style.getPropertyValue('--editor-stage-bottom').trim());
            background.fillStyle = gradient;
            background.fillRect(0, y0, 1, y1 - y0);
            const bg = background.getImageData(0, 0, 1, canvas.height).data;
            let colored = 0,
                symmetryError = 0,
                worst = [];
            for (let x = x0; x < x1; x += Math.max(1, Math.floor((x1 - x0) / 128))) {
                let first = Infinity,
                    last = -Infinity;
                for (let y = y0; y < y1; y++) {
                    const i = (y * canvas.width + x) * 4;
                    const base = (bg[y * 4 + 1] * bg[y * 4 + 3]) / 255;
                    const coverage = ((pixels[i + 1] * pixels[i + 3]) / 255 - base) / (255 - base);
                    if (coverage > 0.2) {
                        colored++;
                        first = Math.min(first, y);
                        last = Math.max(last, y);
                    }
                }
                if (Number.isFinite(first)) {
                    const error = Math.abs(first + last + 1 - y0 - y1);
                    if (error > symmetryError) {
                        symmetryError = error;
                        worst = [x, first, last];
                    }
                }
            }
            return { colored, symmetryError, worst, y0, y1, panel, dpr, width: canvas.width, height: canvas.height };
        }, panel);
    assert(result.colored > 0, `No green waveform pixels in ${selector}`);
    if (mirror)
        assert(
            result.symmetryError <= Math.ceil(2 * result.dpr),
            `Asymmetric nonnegative waveform: ${JSON.stringify(result)}`,
        );
    return result;
}
