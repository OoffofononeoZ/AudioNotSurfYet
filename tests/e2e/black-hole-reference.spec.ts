import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const reference = process.env.BLACK_HOLE_REFERENCE_DIR ?? 'D:/steam/steamapps/workshop/content/431960/2903479369';
test('reference wallpaper render cost at matching output sizes', async ({ browser }, info) => {
    test.skip(
        !existsSync(path.join(reference, 'Interactive Black Hole_files/webgl-black-hole.js')),
        'Local reference not available',
    );
    test.setTimeout(120000);
    const results = [];
    for (const [width, height] of [
        [1920, 1080],
        [3840, 2160],
    ]) {
        const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
        const errors: string[] = [];
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/__black-hole_reference__/**', async route => {
            const name = new URL(route.request().url()).pathname.split('/').at(-1);
            if (name === 'index.html')
                return route.fulfill({
                    contentType: 'text/html',
                    body: '<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}.experience{width:100%;height:100%}</style></head><body><div class="experience"></div><script type="module" src="./webgl-black-hole.js"></script></body></html>',
                });
            if (name === 'webgl-black-hole.js')
                return route.fulfill({
                    contentType: 'application/javascript',
                    body: await readFile(
                        path.join(reference, 'Interactive Black Hole_files/webgl-black-hole.js'),
                        'utf8',
                    ),
                });
            return route.abort();
        });
        await page.addInitScript(() => {
            const state = {
                queries: [] as WebGLQuery[],
                draws: 0,
                frames: 0,
                samples: [] as number[],
                drawCounts: [] as number[],
                contexts: [] as WebGLRenderingContext[],
            };
            (window as any).referenceMeasure = state;
            const original = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
                const gl = (original as any).apply(this, args);
                if (gl && String(args[0]).startsWith('webgl') && !state.contexts.includes(gl)) {
                    state.contexts.push(gl);
                    for (const method of ['drawArrays', 'drawElements']) {
                        const draw = gl[method].bind(gl);
                        gl[method] = (...a: any[]) => {
                            state.draws++;
                            return draw(...a);
                        };
                    }
                }
                return gl;
            } as any;
            const raf = window.requestAnimationFrame.bind(window);
            window.requestAnimationFrame = fn =>
                raf(time => {
                    if (state.frames >= 60) return;
                    const before = state.draws,
                        start = performance.now();
                    const gl = state.contexts[0] as any,
                        timer = gl?.getExtension('EXT_disjoint_timer_query_webgl2');
                    const query = timer ? gl.createQuery() : null;
                    if (query) gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
                    fn(time);
                    if (query) gl.endQuery(timer.TIME_ELAPSED_EXT);
                    if (state.draws > before) {
                        for (const gl of state.contexts) gl.finish();
                        if (state.frames >= 20) {
                            if (query) state.queries.push(query);
                            state.samples.push(performance.now() - start);
                            state.drawCounts.push(state.draws - before);
                        }
                        state.frames++;
                        if (query && state.frames <= 20) gl.deleteQuery(query);
                    } else if (query) gl.deleteQuery(query);
                });
        });
        await page.goto(
            'http://127.0.0.1:' + (process.env.PLAYWRIGHT_PORT ?? 4173) + '/__black-hole_reference__/index.html',
        );
        await expect
            .poll(() => page.evaluate(() => (window as any).referenceMeasure.frames), { timeout: 60000 })
            .toBe(60);
        await expect
            .poll(() =>
                page.evaluate(() => {
                    const s = (window as any).referenceMeasure,
                        gl = s.contexts[0];
                    return s.queries.every((q: any) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE));
                }),
            )
            .toBe(true);
        const result = await page.evaluate(() => {
            const s = (window as any).referenceMeasure,
                gl = s.contexts[0],
                ext = gl.getExtension('WEBGL_debug_renderer_info');
            const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2'),
                valid = timer && !gl.getParameter(timer.GPU_DISJOINT_EXT);
            const gpuSamples = valid
                ? s.queries
                      .map((q: any) => gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6)
                      .sort((a: number, b: number) => a - b)
                : [];
            for (const q of s.queries) gl.deleteQuery(q);
            const sorted = [...s.samples].sort((a: number, b: number) => a - b),
                canvas = document.querySelector('canvas')!;
            return {
                width: canvas.width,
                height: canvas.height,
                dpr: devicePixelRatio,
                gpuMedianMs: gpuSamples[Math.floor(gpuSamples.length / 2)] ?? null,
                gpuP95Ms: gpuSamples[Math.floor(gpuSamples.length * 0.95)] ?? null,
                gpuTimer: valid ? 'EXT_disjoint_timer_query_webgl2' : 'unavailable or disjoint',
                maxMs: sorted.at(-1),
                gpuMaxMs: gpuSamples.at(-1) ?? null,
                medianMs: sorted[Math.floor(sorted.length / 2)],
                p95Ms: sorted[Math.floor(sorted.length * 0.95)],
                samples: s.samples,
                drawCalls: s.drawCounts,
                gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable',
                includes:
                    'Original reference render callback + gl.finish; no display-vsync; bundled code unchanged, audio/UI omitted',
            };
        });
        expect(result.width).toBe(width);
        expect(result.height).toBe(height);
        expect(errors).toEqual([]);
        const output = 'artifacts/black-hole-visualizer-v2';
        await mkdir(output, { recursive: true });
        await page.screenshot({ path: output + '/' + info.project.name + '-reference-' + height + '.png' });
        results.push(result);
        await page.close();
    }
    await writeFile(
        'artifacts/black-hole-visualizer-v2/' + info.project.name + '-reference-performance.json',
        JSON.stringify(results, null, 2),
        'utf8',
    );
});
