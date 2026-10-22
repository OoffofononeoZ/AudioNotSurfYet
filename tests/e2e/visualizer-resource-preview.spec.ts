import { expect, test } from '@playwright/test';
import path from 'node:path';
import { chooseFiles, installFilePickerStub } from '../support/file-picker';
import { resourceRows } from '../support/visualizer-assets.mjs';

test.use({ viewport: { width: 1920, height: 1080 } });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="54" viewBox="0 0 96 54">
    <defs>
        <linearGradient id="color"><stop stop-color="#00ff00"/><stop offset="1" stop-color="#0000ff"/></linearGradient>
        <radialGradient id="light"><stop stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <linearGradient id="inherited" href="#color"/>
        <clipPath id="clip"><rect width="96" height="54"/></clipPath>
        <mask id="mask"><rect width="96" height="54" fill="white"/></mask>
        <path id="mark" d="M0 0h1v1h-1z"/>
        <filter id="glow"><feGaussianBlur stdDeviation="0.2"/><feColorMatrix type="saturate" values="1"/>
            <feComponentTransfer><feFuncA type="linear" slope="1"/></feComponentTransfer>
            <feComposite in2="SourceGraphic" operator="over"/>
        </filter>
    </defs>
    <rect width="96" height="54" fill="url(#inherited)" filter="url('#glow')" clip-path="url(#clip)" mask="url(#mask)"/>
    <use href="#mark" fill="white"/>
    <circle cx="48" cy="45" r="3" fill="url( &quot;#light&quot; )"/>
    <text x="2" y="50" fill="white" font-size="5">SVG preview</text>
</svg>`;

test('SVG previews load gradients, filters and text from nested paths and automatic discovery', async ({ page }) => {
    await page.goto('/');
    const results = await page.evaluate(async svg => {
        const modulePath = '/src/visualizer/resourcePreview.ts';
        const { readResourcePreview, isResourceImage } = await import(modulePath);
        const root = await navigator.storage.getDirectory();
        const dir = await root.getDirectoryHandle('svg-preview-test', { create: true });
        const images = await dir.getDirectoryHandle('images', { create: true });
        for (const [folder, filename] of [
            [images, 'cover.SVG'],
            [dir, 'preview.svg'],
        ] as const) {
            const writer = await (await folder.getFileHandle(filename, { create: true })).createWritable();
            await writer.write(svg);
            await writer.close();
        }
        const result = [];
        for (const previewPath of ['images/cover.SVG', undefined]) {
            const blob = await readResourcePreview(dir, previewPath, new AbortController().signal);
            if (!blob) {
                result.push(null);
                continue;
            }
            const url = URL.createObjectURL(blob);
            try {
                const image = new Image();
                image.src = url;
                await image.decode();
                const canvas = document.createElement('canvas');
                canvas.width = 96;
                canvas.height = 54;
                const context = canvas.getContext('2d')!;
                context.drawImage(image, 0, 0);
                result.push({
                    type: blob.type,
                    source: await blob.text(),
                    left: [...context.getImageData(10, 20, 1, 1).data],
                    right: [...context.getImageData(85, 20, 1, 1).data],
                });
            } finally {
                URL.revokeObjectURL(url);
            }
        }
        return { recognized: isResourceImage('images/cover.SVG'), result };
    }, svg);
    expect(results.recognized).toBe(true);
    for (const result of results.result) {
        expect(result).not.toBeNull();
        expect(result!.type).toBe('image/svg+xml');
        expect(result!.source).toBe(svg);
        expect(result!.left[1]).toBeGreaterThan(200);
        expect(result!.right[2]).toBeGreaterThan(200);
        expect(result!.left[3]).toBe(255);
    }
});

test('SVG validation still rejects scripts, external references and malformed artwork before decoding', async ({
    page,
}) => {
    await page.goto('/');
    const results = await page.evaluate(async () => {
        const modulePath = '/src/visualizer/resourcePreview.ts';
        const { readResourcePreview } = await import(modulePath);
        const wrap = (body: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
        const fixtures = [
            '<svg',
            wrap('<script>alert(1)</script>'),
            wrap('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">html</div></foreignObject>'),
            wrap('<rect onload="alert(1)"/>'),
            wrap('<rect fill="url(https://example.test/paint.svg#color)"/>'),
            wrap('<rect fill="url(#missing)"/>'),
            wrap('<rect style="fill: red"/>'),
            wrap('<style>@import "https://example.test/style.css";</style>'),
            wrap('<use href="https://example.test/paint.svg#color"/>'),
            wrap('<filter><feImage href="https://example.test/image.png"/></filter>'),
            wrap(
                '<defs><linearGradient id="color"/></defs><rect fill="url(#color)"/>',
                'xml:base="https://example.test/"',
            ),
            '<?xml-stylesheet href="https://example.test/style.css"?>' + wrap(''),
            '<!DOCTYPE svg [<!ENTITY color "red">]>' + wrap('<rect fill="&color;"/>'),
            wrap('<rect fill="u\\72l(https://example.test/paint.svg#color)"/>'),
            wrap('<rect fill="url/**/(https://example.test/paint.svg#color)"/>'),
        ];
        const results = [];
        for (const source of fixtures) {
            let decoded = false;
            const dir = {
                async *entries() {
                    yield ['cover.svg', { kind: 'file' }];
                },
                async getFileHandle() {
                    return { getFile: async () => new File([source], 'cover.svg') };
                },
            };
            const blob = await readResourcePreview(dir, 'cover.svg', new AbortController().signal, async () => {
                decoded = true;
            });
            results.push({ source, rejected: blob === null && !decoded });
        }
        return results;
    });
    for (const result of results) expect(result.rejected, result.source).toBe(true);
});

test('external element and preset SVG covers use their actual images in the catalog', async ({ page }) => {
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await page.getByTestId('add-visualizer-element').click();
    for (const kind of ['elements', 'presets']) {
        if (kind === 'presets') await page.getByRole('button', { name: '预设', exact: true }).click();
        const rows = resourceRows().filter(row => (row.info.kind === 'preset') === (kind === 'presets'));
        const attribute = kind === 'presets' ? 'data-preset-id' : 'data-resource-id';
        await expect(page.locator(`[${attribute}]`)).toHaveCount(rows.length);
        for (const row of rows.filter(row => /\.svg$/i.test(row.info.previewPath ?? ''))) {
            const cover = page.locator(`[${attribute}="${row.info.resource.id}"] img`);
            await expect(cover).toHaveAttribute('src', /^blob:/);
            const image = await cover.evaluate(async image => {
                const img = image as HTMLImageElement;
                await img.decode();
                return { width: img.naturalWidth, type: (await fetch(img.src)).headers.get('content-type') };
            });
            expect(image.type).toBe('image/svg+xml');
            expect(image.width).toBeGreaterThan(0);
        }
    }
});
