import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { assetsRoot, resourcePack } from '../support/visualizer-assets.mjs';
const task = 'artifacts/black-hole-visualizer-v2';
const baseline = path.resolve(assetsRoot, '..', task);
for (const version of ['v1', 'v2'])
    test(version + ' components and full-preset GPU measurement', async ({ page }, info) => {
        test.setTimeout(120000);
        test.skip(
            version === 'v1' && !fs.existsSync(path.join(baseline, 'v1-components.json')),
            'Explicit v1 benchmark snapshot is not available',
        );
        const preset = resourcePack('black-hole-visualizer-2903479369');
        const full =
            version === 'v1'
                ? JSON.parse(fs.readFileSync(path.join(baseline, 'v1-preset.json'), 'utf8'))
                : [preset, ...preset.presets[0].elements.map((e: any) => resourcePack(e.element.id))];
        await page.goto('/');
        let components: any;
        if (version === 'v1') {
            const packs = JSON.parse(fs.readFileSync(path.join(baseline, 'v1-components.json'), 'utf8'));
            const result = await page.evaluate(async packs => {
                const file = '/tests/support/black-hole-render.ts';
                return (await import(file)).renderBlackHole(packs);
            }, packs);
            expect(result.released && result.recreated).toBe(true);
            components = result.timings;
            await fs.promises.mkdir(task, { recursive: true });
            const combined = result.captures.find((c: any) => c.name === 'combined');
            await fs.promises.writeFile(
                task + '/' + info.project.name + '-v1.png',
                Buffer.from(combined.image.split(',')[1], 'base64'),
            );
        }
        const fullPreset = await page.evaluate(async packs => {
            const file = '/tests/support/black-hole-benchmark.ts';
            return (await import(file)).benchmarkBlackHolePreset(packs);
        }, full);
        await fs.promises.mkdir(task, { recursive: true });
        await fs.promises.writeFile(
            task + '/' + info.project.name + '-' + version + '-benchmark.json',
            JSON.stringify({ version, components, fullPreset }, null, 2),
            'utf8',
        );
    });
