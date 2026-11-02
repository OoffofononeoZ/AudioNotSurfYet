import { expect, test } from '@playwright/test';
import { installFilePickerStub } from '../support/file-picker';

test('keeps a fifteen-minute 3D overview and cancelled rebuilds responsive', async ({ page }, info) => {
    test.setTimeout(240000);
    await installFilePickerStub(page);
    await page.goto('/analyzer');
    await page.evaluate(async () => {
        const rate = 48000,
            seconds = 900,
            bytes = rate * seconds * 2;
        const header = new DataView(new ArrayBuffer(44));
        const text = (offset: number, value: string) =>
            [...value].forEach((char, i) => header.setUint8(offset + i, char.charCodeAt(0)));
        text(0, 'RIFF');
        header.setUint32(4, bytes + 36, true);
        text(8, 'WAVE');
        text(12, 'fmt ');
        header.setUint32(16, 16, true);
        header.setUint16(20, 1, true);
        header.setUint16(22, 1, true);
        header.setUint32(24, rate, true);
        header.setUint32(28, rate * 2, true);
        header.setUint16(32, 2, true);
        header.setUint16(34, 16, true);
        text(36, 'data');
        header.setUint32(40, bytes, true);
        const root = await navigator.storage.getDirectory();
        const directory = await root.getDirectoryHandle(`three-d-long-${crypto.randomUUID()}`, { create: true });
        const handle = await directory.getFileHandle('three-d-fifteen-minutes.wav', { create: true });
        const file = await handle.createWritable();
        await file.write(header.buffer);
        const pcm = new Int16Array(rate * 5);
        for (let i = 0; i < pcm.length; i++)
            pcm[i] = Math.round(
                5000 * Math.sin((2 * Math.PI * 440 * i) / rate) * (0.6 + 0.4 * Math.sin((2 * Math.PI * i) / rate)),
            );
        for (let i = 0; i < seconds; i += 5) await file.write(pcm);
        await file.close();
        (window as any).__audioNotSurfYetPickerQueue.push([handle]);
    });
    await page.getByTestId('import-audio').click();
    await expect(page.locator('#music-bar-container')).toHaveAttribute('data-playback-state', 'playing', {
        timeout: 90000,
    });
    await page.getByTestId('toggle-playback').click();
    await page.locator('[data-source="original-3d"]').click();
    await page.locator('[data-feature-id="amplitudeSpectrum"] .toggle-card').click();
    const chart = page.getByTestId('three-d-plot');
    await expect(chart.locator('.three-d-message')).toHaveCount(0, { timeout: 120000 });
    await expect(chart).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
    const response = await page.evaluate(async () => {
        const longTasks: number[] = [],
            feedback: number[] = [];
        const observer = new PerformanceObserver(list =>
            longTasks.push(...list.getEntries().map(entry => entry.duration)),
        );
        observer.observe({ entryTypes: ['longtask'] });
        const stage = document.querySelector('.three-d-stage')!,
            rect = stage.getBoundingClientRect();
        for (let i = 0; i < 8; i++) {
            const start = performance.now();
            stage.dispatchEvent(
                new WheelEvent('wheel', {
                    deltaY: i % 2 ? 120 : -120,
                    clientX: rect.x + rect.width * 0.4,
                    clientY: rect.y + rect.height * 0.5,
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            feedback.push(performance.now() - start);
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        observer.disconnect();
        return { longTasks, feedback };
    });
    await expect(chart).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
    expect(Math.max(...response.feedback)).toBeLessThanOrEqual(100);
    await chart.getByRole('button', { name: '切换伪2D图表' }).click();
    await chart.getByRole('slider', { name: '选择图表分量' }).focus();
    await page.keyboard.press('End');
    await expect(chart).toHaveAttribute('aria-busy', 'false', { timeout: 45000 });
    await page.getByRole('link', { name: '首页', exact: true }).click();
    await expect(page.getByTestId('three-d-plot')).toHaveCount(0);
    console.log(
        JSON.stringify({ metric: 'analyzer-3d-long', browser: info.project.name, durationSeconds: 900, ...response }),
    );
});
