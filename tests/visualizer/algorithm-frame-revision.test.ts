import { expect, test } from 'vitest';
import { AlgorithmFrameRevisions } from '../../src/visualizer/algorithmFrameRevision';
import type { CompositionRenderModel, VisualizerElement } from '../../src/visualizer/compositionTypes';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';

function harness(stateParameters?: string[]) {
    const ref = { id: 'example', version: 1, hash: 'a'.repeat(64) };
    const algorithm = {
        ...ref,
        contract: {
            parameters: ['spectrum', 'decay', 'color'].map(id => ({ id })),
            historyParameters: ['spectrum'],
            ...(stateParameters === undefined ? {} : { stateParameters }),
        },
    } as AlgorithmDefinition;
    const element = {
        id: 'leaf',
        resource: ref,
        timing: { kind: 'manual', startSeconds: 0, endSeconds: 180 },
        bindings: [
            { parameterId: 'spectrum', source: { kind: 'constant', value: [1] } },
            { parameterId: 'decay', source: { kind: 'constant', value: 0.6 } },
            { parameterId: 'color', source: { kind: 'constant', value: '#ffffff' } },
        ],
    } as VisualizerElement;
    const project = {
        projectId: 'project',
        elements: [element],
        resources: { algorithms: [algorithm], elements: [{ ...ref, algorithm: ref }] },
    } as unknown as CompositionRenderModel;
    const revisions = new AlgorithmFrameRevisions();
    return { element, project, version: (identity = 'input') => revisions.resolve(project, element, identity) };
}

test('unrelated edits and drawing parameters retain state, while inputs and state parameters invalidate it', () => {
    const h = harness(['decay']);
    const first = h.version();
    h.element.name = 'renamed';
    h.element.bindings[2]!.source = { kind: 'constant', value: '#ff0000' };
    expect(h.version()).toBe(first);
    h.element.bindings[1]!.source = { kind: 'constant', value: 0.3 };
    const decay = h.version();
    expect(decay).not.toBe(first);
    h.element.bindings[0]!.source = { kind: 'constant', value: [2] };
    const history = h.version();
    expect(history).not.toBe(decay);
    expect(h.version('replacement decoded input')).not.toBe(history);
});

test('omitted declarations preserve conservative old-resource behavior and empty declarations retain history inputs', () => {
    for (const declaration of [undefined, []]) {
        const h = harness(declaration);
        const before = h.version();
        h.element.bindings[2]!.source = { kind: 'constant', value: '#ff0000' };
        expect(h.version() === before).toBe(declaration !== undefined);
        const color = h.version();
        h.element.timing = { kind: 'manual', startSeconds: 1, endSeconds: 180 };
        expect(h.version()).not.toBe(color);
    }
});
