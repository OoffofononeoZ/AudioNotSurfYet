import { expect, test } from 'vitest';
import { createComposition } from '../../src/visualizer/compositionCodec';
import { appendStandaloneElements } from '../../src/visualizer/compositionModel';
import { elementRegistry } from '../../src/visualizer/elementRegistry';
import { compositionPresets, instantiatePreset } from '../../src/visualizer/compositionPresets';
import { inspectRealtimePreset, inspectRealtimeProject } from '../../src/visualizer/realtimeCapabilities';
const track = { contentHash: 'a'.repeat(64), fileName: 'test.wav', durationSeconds: 10, sampleRate: 48000 };
const project = (...ids: string[]) =>
    appendStandaloneElements(
        createComposition(track),
        ids.map((id, i) => elementRegistry.create(id, 10, i)),
    );
test('fixed content is eligible, full-song audio requires only the declared feature and WE is a strict subset', () => {
    expect(inspectRealtimeProject(project('solid'))).toMatchObject({ browser: true, wallpaper: true });
    const p = project('radial-spectrum');
    expect(inspectRealtimeProject(p)).toMatchObject({ browser: true, wallpaper: false });
    p.elements[0]!.bindings.find(b => b.parameterId === 'spectrum')!.source = {
        kind: 'analysis',
        featureId: 'wallpaperEngineSpectrum',
        projection: { kind: 'full' },
    };
    expect(inspectRealtimeProject(p)).toMatchObject({ browser: true, wallpaper: true });
});
test('history, markers, partial timing and empty content identify blockers; disabled content is excluded', () => {
    for (const id of ['spectral-strings', 'fade', 'point-line-horizontal'])
        expect(inspectRealtimeProject(project(id)).browser).toBe(false);
    const p = project('solid', 'spectral-strings');
    p.elements[1]!.enabled = false;
    expect(inspectRealtimeProject(p).browser).toBe(true);
    p.elements[0]!.timing = { kind: 'manual', startSeconds: 1, endSeconds: 10 };
    expect(inspectRealtimeProject(p).browserIssues.join()).toMatch(/局部分镜/);
    expect(inspectRealtimeProject(createComposition(track)).browser).toBe(false);
});
test('library and instantiated preset classification agree, and hidden groups do not participate', () => {
    for (const definition of compositionPresets) {
        const instance = instantiatePreset(definition.id, 10),
            p = createComposition(track);
        Object.assign(p, { elements: instance.elements, items: [instance.group], resources: instance.resources });
        const expected = inspectRealtimePreset(definition);
        expect(inspectRealtimeProject(p)).toMatchObject({ browser: expected.browser, wallpaper: expected.wallpaper });
    }
    expect(inspectRealtimePreset(compositionPresets.find(p => p.id === 'geometric-0.6')!)).toMatchObject({
        browser: true,
        wallpaper: false,
    });
    expect(inspectRealtimePreset(compositionPresets.find(p => p.id === 'prismatic-voyage')!)).toMatchObject({
        browser: false,
        wallpaper: false,
    });
});
