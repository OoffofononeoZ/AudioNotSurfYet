import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

export async function writeMovementCapture(file, result, browser, version) {
    await writeFile(
        file + '.capture.json',
        JSON.stringify(
            {
                mode: 'offline',
                kind: 'music',
                scenario: 'cross-preset',
                browser,
                browserVersion: version,
                sourceDurationSeconds: result.project.track.durationSeconds,
                preset: {
                    resolution: '720p',
                    frameRate: 30,
                    width: 1280,
                    height: 720,
                    videoBitsPerSecond: 6000000,
                    audioBitsPerSecond: 192000,
                },
            },
            null,
            2,
        ),
        'utf8',
    );
}

export function movementFixture(source) {
    const p = structuredClone(source),
        group = p.items.find(i => i.kind === 'preset');
    const solid = p.elements.find(e => e.resource.id === 'solid');
    if (!group || !solid) throw Error('Load the existing geometric preset first.');
    const leaf = (name, color, opacity, layer) => {
        const e = { ...structuredClone(solid), id: randomUUID(), name, layer, enabled: true };
        e.bindings.find(b => b.parameterId === 'color').source = { kind: 'constant', value: color };
        e.bindings.find(b => b.parameterId === 'opacity').source = { kind: 'constant', value: opacity };
        return e;
    };
    const red = leaf('底层红色', '#ff0000', 1, 0),
        green = leaf('上层绿色', '#00ff00', 0.5, 1),
        blue = leaf('独立蓝色', '#0000ff', 1, 2);
    group.name = '叠层预设';
    group.children = [red.id, green.id];
    group.controls = [];
    delete group.scenes3d;
    p.elements = [red, green, blue];
    p.items = [group, { kind: 'element', id: blue.id }];
    p.output.resolution = '720p';
    p.output.frameRate = 30;
    p.output.audioVideoOffsetMs = 0;
    return { p, group, red, green, blue };
}
function decodePixel(png, x, y) {
    return [
        ...execFileSync(
            'ffmpeg',
            ['-v', 'error', '-i', 'pipe:0', '-vf', `format=rgb24,crop=1:1:${x}:${y}`, '-f', 'rawvideo', 'pipe:1'],
            { input: png, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        ),
    ];
}
async function canvasPixel(page, canvas) {
    const rect = await canvas.boundingBox();
    if (!rect) throw Error('Canvas is not visible.');
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    const png = await page.screenshot();
    return decodePixel(
        png,
        Math.floor(((rect.x + rect.width / 2) * png.readUInt32BE(16)) / viewport.width),
        Math.floor(((rect.y + rect.height / 2) * png.readUInt32BE(20)) / viewport.height),
    );
}
function teal(rgb) {
    // Same four-level channel tolerance as the existing primitive GPU pixel checks.
    return rgb[0] <= 4 && Math.abs(rgb[1] - 128) <= 4 && Math.abs(rgb[2] - 127) <= 4;
}
export async function runCompositionMovement(page, io) {
    const { p, group, red, green, blue } = movementFixture(await io.readProject());
    const row = id => page.locator(`[data-composition-id="${id}"]`);
    const button = (id, direction) => row(id).locator(`[data-move-direction="${direction}"]`);
    const canvas = page.getByTestId('visualizer-preview-canvas');
    await io.importProject(p);
    await row(blue.id).locator('.viz-element-select').click();
    await expect(button(blue.id, -1)).toBeDisabled();
    await expect(button(blue.id, 1)).toHaveAttribute('title', '移入叠层预设');
    await button(blue.id, 1).click();
    await expect(button(blue.id, 1)).toBeFocused();
    await expect(page.getByRole('button', { name: '折叠叠层预设', exact: true })).toBeVisible();
    await expect(row(blue.id).locator('.viz-element-select')).toHaveAttribute('aria-pressed', 'true');
    await button(blue.id, 1).press('Enter');
    let moved = await io.readProject();
    expect(moved.items.find(i => i.id === group.id).children).toEqual([red.id, blue.id, green.id]);
    const interleaved = structuredClone(moved);
    await page.mouse.move(10, 10);
    await expect
        .poll(async () => {
            const rgb = await canvasPixel(page, canvas);
            return Math.max(rgb[0], Math.abs(rgb[1] - 128), Math.abs(rgb[2] - 127));
        })
        .toBeLessThanOrEqual(4);
    await io.screenshot('interleaved');
    await button(blue.id, -1).click();
    await button(blue.id, -1).click();
    await expect(row(blue.id).locator('.viz-element-select')).toBeFocused();
    moved = await io.readProject();
    expect(moved.items.map(i => i.id)).toEqual([group.id, blue.id]);
    await expect.poll(async () => (await canvasPixel(page, canvas))[2]).toBeGreaterThanOrEqual(251);

    // Exercise native HTML drag/drop, including explicit row edges and a collapsed destination.
    const b = { ...structuredClone(group), id: randomUUID(), name: '接收预设', children: [] };
    const transparent = { ...structuredClone(red), id: randomUUID(), name: '透明层', layer: 2 };
    transparent.bindings.find(v => v.parameterId === 'opacity').source.value = 0;
    b.children = [transparent.id];
    const multiple = structuredClone(p);
    multiple.elements = [red, green, transparent, { ...blue, layer: 3 }];
    multiple.items = [group, b, { kind: 'element', id: blue.id }];
    await io.importProject(multiple);
    await row(blue.id).dragTo(row(group.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 32 } });
    await expect(row(blue.id)).toHaveClass(/nested/);
    await row(blue.id).dragTo(row(green.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 60 } });
    moved = await io.readProject();
    expect(moved.items.find(i => i.id === group.id).children).toEqual([red.id, blue.id, green.id]);
    await row(blue.id).dragTo(row(group.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 3 } });
    await expect(row(blue.id)).not.toHaveClass(/nested/);
    await row(blue.id).dragTo(row(b.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 32 } });
    moved = await io.readProject();
    expect(moved.items.find(i => i.id === b.id).children).toEqual([transparent.id, blue.id]);
    await row(b.id).dragTo(row(group.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 32 } });
    expect(await io.readProject()).toEqual(moved);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    expect(await io.readProject()).toEqual(moved);
    await io.importProject(interleaved);
    const imported = await io.readProject();
    expect(imported).toEqual({ ...interleaved, updatedAt: imported.updatedAt });
    await io.resizeViewport(1024, 900);
    await page.getByRole('button', { name: '元素列表', exact: true }).click();
    await expect(row(group.id)).toBeVisible();
    await io.screenshot('narrow');
    await io.resizeViewport(1920, 1080);

    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.getByTestId('cancel-visualizer-export')).toBeVisible();
    for (const action of await page.locator('.viz-row-actions button').all()) await expect(action).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    const video = await io.saveVideo();
    const pixels = execFileSync(
        'ffmpeg',
        [
            '-v',
            'error',
            '-i',
            video,
            '-map',
            '0:v:0',
            '-vf',
            'crop=64:64:(iw-64)/2:(ih-64)/2,scale=1:1,format=rgb24',
            '-fps_mode',
            'passthrough',
            '-f',
            'rawvideo',
            'pipe:1',
        ],
        { maxBuffer: 8 * 1024 * 1024, windowsHide: true },
    );
    const frames = Math.ceil(interleaved.track.durationSeconds * 30);
    expect(pixels.length).toBe(frames * 3);
    for (let i = 0; i < pixels.length; i += 3) expect(teal(pixels.subarray(i, i + 3))).toBe(true);
    // A shared-depth scene moves as one unit; direct member escape remains forbidden.
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="shared-camera-demo"]').click();
    const worldProject = await io.readProject(),
        worldGroup = worldProject.items.at(-1);
    const scene = worldGroup.scenes3d[0];
    await page.getByRole('button', { name: '展开' + worldGroup.name, exact: true }).click();
    await button(scene.id, -1).click();
    let sceneProject = await io.readProject();
    expect(sceneProject.items.some(i => i.id === worldGroup.id)).toBe(false);
    expect(sceneProject.items.find(i => i.id === scene.id)).toEqual(scene);
    await button(scene.id, 1).click();
    sceneProject = await io.readProject();
    expect(sceneProject.items.find(i => i.id === group.id).scenes3d[0]).toEqual(scene);
    const member = scene.children.at(-1);
    await expect(button(member, -1)).toBeDisabled();
    await row(member).dragTo(row(group.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 3 } });
    expect(await io.readProject()).toEqual(sceneProject);
    await row(scene.id).dragTo(row(group.id), { sourcePosition: { x: 80, y: 32 }, targetPosition: { x: 80, y: 3 } });
    sceneProject = await io.readProject();
    expect(sceneProject.items.find(i => i.id === scene.id)).toEqual(scene);
    for (const id of scene.children) {
        const e = worldProject.elements.find(e => e.id === id);
        expect(sceneProject.elements.find(e => e.id === id)).toEqual({
            ...e,
            layer: sceneProject.elements.find(e => e.id === id).layer,
        });
    }
    await io.screenshot('scene-transferred');
    return { frames, pixel: [...pixels.subarray(0, 3)], project: interleaved, sceneId: scene.id };
}
