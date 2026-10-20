import { expect, test } from '@playwright/test';
import path from 'node:path';
import { markerFixture } from '../visualizer/marker-input-fixture';
import { chooseFiles, installFilePickerStub, queuePickerData, savedPickerEntries } from '../support/file-picker';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import type { VisualizerProjectV5 } from '../../src/visualizer/compositionTypes';
import { createInitialEditorProject } from '../../src/editor/projectCodec';

test('ABI 2 marker transport only serves declared inputs of the active instance and ended frames cannot borrow another instance', async ({
    page,
}) => {
    await page.goto('/');
    const report = await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts',
            identityPath = '/src/visualizer/resourceIdentity.ts';
        const { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } = await import(runtimePath),
            { resourceHash } = await import(identityPath);
        const algorithm = {
            id: 'marker-isolation-fixture',
            version: 1,
            apiVersion: 2,
            contract: {
                kind: 'visual',
                parameters: [],
                sharedParameters: [],
                historyParameters: [],
                markerInputs: [{ id: 'notes', eventKind: 'point', selectionModes: ['collection'] }],
            },
            source: `let previous;export function create(){return {async prepareFrame(frame,input){let oldRejected=false;if(previous){try{await previous({inputId:'notes',startSeconds:0,endSeconds:1});}catch{oldRejected=true;}}previous=input.markers;const page=await input.markers({inputId:'notes',startSeconds:0,endSeconds:1});return {passes:[],state:[page.events[0].atSeconds,oldRejected?1:0,typeof postMessage==='undefined'&&typeof EventTarget.prototype.dispatchEvent==='undefined'?1:0]};}}}`,
            programs: { draw: { geometry: 'quad', vertex: 'void main(){}', fragment: 'void main(){}', uniforms: {} } },
        };
        const runtime = new IsolatedAlgorithmRuntime(),
            calls: string[] = [];
        try {
            await runtime.initialize(
                ['first', 'second'].map(id => ({ id, algorithm: { ...algorithm, hash: resourceHash(algorithm) } })),
            );
            const frames = ['first', 'second'].map(id => ({
                id,
                frame: { time: 0, seed: 1, revision: '1', width: 1, height: 1, range: null, parameters: {} },
            }));
            const packets = await runtime.prepareFrames(
                frames,
                async () => [],
                undefined,
                async (id: string) => {
                    calls.push(id);
                    return {
                        eventKind: 'point',
                        events: [{ id: 'event', innerClassId: 'class', atSeconds: id === 'first' ? 0.1 : 0.2 }],
                        nextCursor: null,
                    };
                },
            );
            return { first: packets.get('first')!.state, second: packets.get('second')!.state, calls };
        } finally {
            runtime.dispose();
            if (algorithmRuntimeDiagnostics.activeTasks || algorithmRuntimeDiagnostics.activeSandboxes)
                throw Error('Marker runtime leaked');
        }
    });
    expect(report).toEqual({ first: [0.1, 0, 1], second: [0.2, 1, 1], calls: ['first', 'second'] });
});

test('marker queries are denied for ABI 1 and undeclared ABI 2 inputs before the project reader runs', async ({
    page,
}) => {
    await page.goto('/');
    const results = await page.evaluate(async () => {
        const runtimePath = '/src/visualizer/isolatedAlgorithmRuntime.ts',
            identityPath = '/src/visualizer/resourceIdentity.ts';
        const { IsolatedAlgorithmRuntime, algorithmRuntimeDiagnostics } = await import(runtimePath),
            { resourceHash } = await import(identityPath);
        let reads = 0;
        const denied: boolean[] = [];
        for (const apiVersion of [1, 2]) {
            const runtime = new IsolatedAlgorithmRuntime();
            const algorithm = {
                id: 'marker-denied-fixture',
                version: 1,
                apiVersion,
                contract: {
                    kind: 'visual',
                    parameters: [],
                    sharedParameters: [],
                    historyParameters: [],
                    ...(apiVersion === 2
                        ? { markerInputs: [{ id: 'allowed', eventKind: 'point', selectionModes: ['single'] }] }
                        : {}),
                },
                source: `export function create(){return {async prepareFrame(frame,input){await input.markers({inputId:'other'});return {passes:[]};}}}`,
                programs: {
                    draw: { geometry: 'quad', vertex: 'void main(){}', fragment: 'void main(){}', uniforms: {} },
                },
            };
            try {
                await runtime.initialize([
                    { id: 'instance', algorithm: { ...algorithm, hash: resourceHash(algorithm) } },
                ]);
                await runtime.prepareFrames(
                    [
                        {
                            id: 'instance',
                            frame: {
                                time: 0,
                                seed: 1,
                                revision: '1',
                                width: 1,
                                height: 1,
                                range: null,
                                parameters: {},
                            },
                        },
                    ],
                    async () => [],
                    undefined,
                    async () => {
                        reads++;
                        return { eventKind: 'point', events: [], nextCursor: null };
                    },
                );
                denied.push(false);
            } catch (error) {
                denied.push((error as Error).message.includes('未授权'));
            } finally {
                runtime.dispose();
            }
        }
        return {
            denied,
            reads,
            tasks: algorithmRuntimeDiagnostics.activeTasks,
            sandboxes: algorithmRuntimeDiagnostics.activeSandboxes,
        };
    });
    expect(results).toEqual({ denied: [true, true], reads: 0, tasks: 0, sandboxes: 0 });
});

test('point/range bindings remain project-local through import, class filtering, restore and short offline export', async ({
    page,
}) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await installFilePickerStub(page, { visualizerAssets: true });
    await page.goto('/');
    await chooseFiles(page, [path.resolve(import.meta.dirname, '../fixtures/audio/visualizer-v5-avsync-v1.wav')]);
    await page.getByTestId('header-visualizer-link').click();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    async function exported(): Promise<VisualizerProjectV5> {
        const n = (await savedPickerEntries(page)).length;
        await page.getByTestId('export-visualizer-project').click();
        await expect.poll(async () => (await savedPickerEntries(page)).length).toBe(n + 1);
        return JSON.parse(Buffer.from((await savedPickerEntries(page)).at(-1)!.base64, 'base64').toString('utf8'));
    }
    const actual = await exported(),
        fixture = markerFixture();
    actual.resources = fixture.project.resources;
    actual.resources.algorithms[0]!.source = `export function create(){return {async prepareFrame(frame,input){let total=0,cursor;do{const page=await input.markers({inputId:'points',startSeconds:0,endSeconds:3,...(cursor?{cursor}:{})});total+=page.events.length;cursor=page.nextCursor;}while(cursor);const range=(await input.markers({inputId:'ranges'})).events[0];return {passes:[{program:'draw',uniforms:{}}],state:[total,range.startSeconds,range.endSeconds]};}}}`;
    actual.resources.algorithms[0]!.hash = resourceHash(actual.resources.algorithms[0]!);
    actual.resources.elements[0]!.algorithm = resourceRef(actual.resources.algorithms[0]!);
    actual.resources.elements[0]!.hash = resourceHash(actual.resources.elements[0]!);
    actual.elements = fixture.project.elements;
    actual.elements[0]!.resource = resourceRef(actual.resources.elements[0]!);
    actual.elements[0]!.timing = { kind: 'manual', startSeconds: 0, endSeconds: actual.track.durationSeconds };
    actual.items = fixture.project.items;
    const editor = createInitialEditorProject({ track: actual.track });
    editor.lanes = fixture.project.editorSnapshot!.project.lanes;
    const pointLane = editor.lanes[0]!,
        rangeLane = editor.lanes[1]!;
    if (pointLane.eventKind === 'point')
        pointLane.events = pointLane.events.filter(e => e.atSeconds < actual.track.durationSeconds);
    if (rangeLane.eventKind === 'range') rangeLane.events = rangeLane.events.slice(0, 2);
    actual.editorSnapshot = { capturedAt: editor.updatedAt, project: editor };
    await queuePickerData(page, [
        { name: 'marker-project.json', mimeType: 'application/json', text: JSON.stringify(actual) },
    ]);
    await page.getByTestId('import-visualizer-project').click();
    await page.getByRole('button', { name: '标记测试', exact: true }).click();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    await expect(page.getByRole('button', { name: '移除', exact: true })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Editor 数据', exact: true }).click();
    await expect(page.getByRole('button', { name: '移除', exact: true })).toBeDisabled();
    await page.getByLabel('点输入分类 乙', { exact: true }).check();
    const both = await exported();
    expect(both.elements[0]!.markerBindings!.points).toMatchObject({
        innerClassIds: expect.arrayContaining([fixture.classA, fixture.classB]),
    });
    await page.getByLabel('范围输入轨道', { exact: true }).selectOption(fixture.rangeLane);
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    // Re-select the range after clearing it; marker IDs never come from library defaults.
    await page.getByLabel('范围输入', { exact: true }).selectOption(editor.lanes[1]!.events[1]!.id);
    await expect(page.getByText('已保存', { exact: true })).toBeVisible();
    const before = await exported();
    await page.reload();
    await expect(page.getByTestId('visualizer-ready')).toBeVisible();
    await expect(page.getByTestId('visualizer-preview-frame')).toHaveAttribute('data-scene-status', 'ready');
    expect((await exported()).elements).toEqual(before.elements);
    await page.getByTestId('visualizer-preview-frame').hover();
    await page.getByTestId('start-visualizer-export').click();
    await expect(page.locator('[data-export-status=ready]')).toBeVisible({ timeout: 30000 });
    await page.getByTestId('save-visualizer-export').click();
    await expect
        .poll(async () =>
            (await savedPickerEntries(page)).some(
                e => e.name.endsWith('.webm') && Buffer.from(e.base64, 'base64').length > 1000,
            ),
        )
        .toBe(true);
});
