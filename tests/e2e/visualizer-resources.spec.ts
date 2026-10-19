import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';
import { chooseFiles, installFilePickerStub, savedPickerEntries, queuePickerData } from '../support/file-picker';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
import type { ElementDefinition } from '../../src/visualizer/resourceTypes';

const audio = path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav');
async function open(page: Page) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page);
    await page.goto('/');
    await chooseFiles(page, [audio]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    if ((await page.locator('#music-bar-container').getAttribute('data-playback-state')) === 'playing')
        await page.getByTestId('toggle-playback').click();
}
async function addPreset(page: Page, id: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator(`[data-preset-id="${id}"]`).click();
}
async function add(page: Page, type: string) {
    await page.getByTestId('add-visualizer-element').click();
    await page.getByRole('button', { name: '全部', exact: true }).click();
    await page.locator(`[data-element-type="${type}"]`).click();
}
async function exported(page: Page): Promise<VisualizerProjectV5> {
    const count = (await savedPickerEntries(page)).length;
    await page.getByTestId('export-visualizer-project').click();
    await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(count + 1);
    return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
}
async function input(page: Page, label: string, value: string) {
    const field = page.getByRole('spinbutton', { name: label, exact: true });
    await field.fill(value);
    await field.dispatchEvent('change');
}
test('two presets and three leaves form five roots; shared values, child differences and reapply survive restore', async ({
    page,
}) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page);
    await addPreset(page, 'geometric-0.6');
    await expect(page.locator('.viz-root-item')).toHaveCount(1);
    await expect(page.locator('.viz-preset-children')).toHaveCount(0);
    await input(page, '响应系数', '1.1');
    await page.getByRole('button', { name: '展开几何律动', exact: true }).click();
    await page.getByRole('button', { name: '外环 · 双重复频谱', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toHaveValue('1.1');
    await input(page, '响应系数', '0.8');
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.locator('.viz-common-differences')).toContainText('已有 1 个元素修改此值');
    await page.getByRole('button', { name: '重新应用', exact: true }).click();
    await expect(page.getByText('已有 1 个元素修改此值')).toHaveCount(0);
    await addPreset(page, 'prismatic-voyage');
    for (const type of ['solid', 'blur', 'spectral-dots']) await add(page, type);
    await expect(page.locator('.viz-root-item')).toHaveCount(5);
    const p = await exported(page);
    expect(p.schemaVersion).toBe(5);
    expect(p.items).toHaveLength(5);
    expect(p.resources.presets).toHaveLength(2);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.locator('.viz-root-item')).toHaveCount(5);
    await expect(page.locator('.viz-preset-children')).toHaveCount(0);
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toHaveValue('1.1');
    await page.locator('.viz-root-item').last().getByRole('button', { name: '上移预设', exact: true }).click();
    const reordered = await exported(page);
    expect(reordered.items[1]!.id).toBe(p.items[0]!.id);
    await page.screenshot({ path: 'artifacts/visualizer-composition/resources/groups.png' });
    expect(errors).toEqual([]);
});

test('embedded algorithms restore and export while the project catalog is unavailable', async ({ page }) => {
    await open(page);
    await addPreset(page, 'geometric-0.6');
    const project = await exported(page);
    expect(project.schemaVersion).toBe(5);
    expect(project.resources.algorithms.length).toBeGreaterThan(0);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    await page.route('**/visualizer-resources/v2/**', route => route.fulfill({ status: 503, body: '' }));
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    expect((await exported(page)).resources).toEqual(project.resources);
});

test('an unregistered algorithm and parameter render through the complete V5 import path', async ({ page }) => {
    await open(page);
    const project = await exported(page);
    const algorithm: AlgorithmDefinition = {
        id: 'fixture-only-algorithm',
        version: 1,
        hash: '',
        apiVersion: 1,
        contract: {
            kind: 'visual',
            sharedParameters: [],
            historyParameters: [],
            parameters: [
                { id: 'novelAmount', valueKind: 'number', allowedSourceKinds: ['constant'], range: { min: 0, max: 1 } },
            ],
        },
        source: 'export function create() { return { prepareFrame(frame) { return { passes: [{program:"draw", uniforms:{uNovel:frame.parameters.novelAmount.value}}] }; } }; }',
        programs: {
            draw: {
                geometry: 'quad',
                vertex: 'void main(){gl_Position=vec4(position,1.0);}',
                fragment: 'uniform float uNovel;void main(){gl_FragColor=vec4(uNovel,0.5,1.0,1.0);}',
                uniforms: { uNovel: { type: 'number' } },
            },
        },
    };
    algorithm.hash = resourceHash(algorithm);
    const element: ElementDefinition = {
        id: 'fixture-only-element',
        version: 1,
        hash: '',
        algorithm: resourceRef(algorithm),
        kind: 'visual',
        title: '测试算法',
        icon: 'square',
        parameters: [{ ...algorithm.contract.parameters[0]!, label: '测试参数', defaultValue: 0.25 }],
    };
    element.hash = resourceHash(element);
    const id = crypto.randomUUID();
    project.resources = { algorithms: [algorithm], elements: [element], presets: [] };
    project.elements = [
        {
            id,
            resource: resourceRef(element),
            name: '测试算法',
            enabled: true,
            layer: 0,
            timing: { kind: 'manual', startSeconds: 0, endSeconds: project.track.durationSeconds },
            bindings: [{ parameterId: 'novelAmount', source: { kind: 'constant', value: 0.25 } }],
        },
    ];
    project.items = [{ kind: 'element', id }];
    await queuePickerData(page, [
        { name: 'algorithm.json', mimeType: 'application/json', text: JSON.stringify(project) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await page.getByRole('button', { name: '测试算法', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '测试参数', exact: true })).toHaveValue('0.25');
    const canvas = page.getByTestId('visualizer-preview-canvas');
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await canvas.dispatchEvent('visualizer-sample-center-test');
    await expect.poll(() => canvas.getAttribute('data-center-pixel')).toMatch(/^6[3-5],12[7-9],255,255$/);
    const bad = structuredClone(project);
    bad.resources.algorithms[0]!.source = 'throw Error("invalid candidate module");';
    bad.resources.algorithms[0]!.hash = resourceHash(bad.resources.algorithms[0]!);
    bad.resources.elements[0]!.algorithm = resourceRef(bad.resources.algorithms[0]!);
    bad.resources.elements[0]!.hash = resourceHash(bad.resources.elements[0]!);
    bad.elements[0]!.resource = resourceRef(bad.resources.elements[0]!);
    await queuePickerData(page, [{ name: 'bad.json', mimeType: 'application/json', text: JSON.stringify(bad) }]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByRole('alert')).toContainText('invalid candidate module');
    expect((await exported(page)).resources).toEqual(project.resources);
    const badShader = structuredClone(project);
    badShader.resources.algorithms[0]!.programs.draw!.fragment = 'not valid GLSL';
    badShader.resources.algorithms[0]!.hash = resourceHash(badShader.resources.algorithms[0]!);
    badShader.resources.elements[0]!.algorithm = resourceRef(badShader.resources.algorithms[0]!);
    badShader.resources.elements[0]!.hash = resourceHash(badShader.resources.elements[0]!);
    badShader.elements[0]!.resource = resourceRef(badShader.resources.elements[0]!);
    await queuePickerData(page, [
        { name: 'bad-shader.json', mimeType: 'application/json', text: JSON.stringify(badShader) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await expect(page.getByRole('alert')).toContainText('Shader 编译或链接失败');
    expect((await exported(page)).resources).toEqual(project.resources);
});

test('catalog request failures retry and preset controls remain usable in narrow drawers', async ({ page }) => {
    await page.route('**/visualizer-resources/v2/catalog.json', route => route.fulfill({ status: 503, body: '' }));
    await open(page);
    await page.getByTestId('add-visualizer-element').click();
    await expect(page.getByRole('alert')).toContainText('资源索引加载失败');
    await page.unroute('**/visualizer-resources/v2/catalog.json');
    await page.getByRole('button', { name: '重试加载', exact: true }).click();
    await page.getByRole('button', { name: '预设', exact: true }).click();
    await page.locator('[data-preset-id="geometric-0.6"]').click();
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.getByRole('button', { name: '元素列表', exact: true }).click();
    await page.getByRole('button', { name: '几何律动', exact: true }).click();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toBeVisible();
    await input(page, '响应系数', '0.9');
    await page.screenshot({ path: 'artifacts/visualizer-composition/resources/narrow.png' });
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
});

test('group edits lock during a short deterministic offline export on the same renderer', async ({ page }) => {
    test.setTimeout(60000);
    await open(page);
    await addPreset(page, 'geometric-0.6');
    await page.getByRole('tab', { name: '状态', exact: true }).click();
    await expect(page.locator('.viz-status-lines')).toContainText('已就绪');
    const canvas = page.getByTestId('visualizer-preview-canvas'),
        host = await canvas.getAttribute('data-renderer-host-id');
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.getByTestId('add-visualizer-element')).toBeDisabled();
    await expect(page.getByRole('spinbutton', { name: '响应系数', exact: true })).toBeDisabled();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    expect(await canvas.getAttribute('data-renderer-host-id')).toBe(host);
    await page.getByTestId('save-visualizer-export').click();
    await expect
        .poll(async () =>
            (await savedPickerEntries(page)).some(
                e => e.name.endsWith('.webm') && Buffer.from(e.base64, 'base64').length > 1000,
            ),
        )
        .toBe(true);
});
