import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { createInitialEditorProject } from '../../src/editor/projectCodec';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
import type { ElementDefinition } from '../../src/visualizer/resourceTypes';
export function markerFixture() {
    const project = createComposition({
        contentHash: 'b'.repeat(64),
        fileName: 'markers.wav',
        durationSeconds: 12,
        sampleRate: 48000,
    });
    const algorithm: AlgorithmDefinition = {
        id: 'marker-fixture',
        version: 1,
        hash: '',
        apiVersion: 2,
        contract: {
            kind: 'visual',
            parameters: [],
            sharedParameters: [],
            historyParameters: [],
            markerInputs: [
                { id: 'points', eventKind: 'point', selectionModes: ['single', 'collection'] },
                { id: 'ranges', eventKind: 'range', selectionModes: ['single', 'collection'] },
            ],
        },
        source: 'export function create(){return {prepareFrame(){return {passes:[]}}}}',
        programs: {
            draw: {
                geometry: 'quad',
                vertex: 'void main(){gl_Position=vec4(position,1.0);}',
                fragment: 'void main(){gl_FragColor=vec4(1.0);}',
                uniforms: {},
            },
        },
    };
    algorithm.hash = resourceHash(algorithm);
    const definition: ElementDefinition = {
        id: 'marker-fixture',
        version: 1,
        hash: '',
        algorithm: resourceRef(algorithm),
        kind: 'visual',
        title: '标记测试',
        icon: 'square',
        parameters: [],
        markerInputs: algorithm.contract.markerInputs!.map(i => ({
            ...i,
            label: i.id === 'points' ? '点输入' : '范围输入',
        })),
    };
    definition.hash = resourceHash(definition);
    const editor = createInitialEditorProject({ track: project.track }),
        pointLane = crypto.randomUUID(),
        rangeLane = crypto.randomUUID(),
        classA = crypto.randomUUID(),
        classB = crypto.randomUUID(),
        rangeA = crypto.randomUUID(),
        rangeB = crypto.randomUUID();
    editor.lanes = [
        {
            id: pointLane,
            name: '点轨道',
            eventKind: 'point',
            innerClasses: [
                { id: classA, label: '甲' },
                { id: classB, label: '乙' },
            ],
            events: Array.from({ length: 610 }, (_, i) => ({
                id: crypto.randomUUID(),
                innerClassId: i % 2 ? classB : classA,
                atSeconds: i / 100,
            })),
        },
        {
            id: rangeLane,
            name: '范围轨道',
            eventKind: 'range',
            innerClasses: [
                { id: rangeA, label: '长音甲' },
                { id: rangeB, label: '长音乙' },
            ],
            events: [
                { id: crypto.randomUUID(), innerClassId: rangeA, startSeconds: 0, endSeconds: 2 },
                { id: crypto.randomUUID(), innerClassId: rangeA, startSeconds: 2, endSeconds: 3 },
                { id: crypto.randomUUID(), innerClassId: rangeB, startSeconds: 3, endSeconds: 4 },
            ],
        },
    ];
    project.editorSnapshot = { capturedAt: editor.updatedAt, project: editor };
    project.resources = { algorithms: [algorithm], elements: [definition], presets: [] };
    const element = createDefinitionElement(definition, 12, 0);
    element.markerBindings = {
        points: { kind: 'collection', laneId: pointLane, innerClassIds: [classA] },
        ranges: { kind: 'single', laneId: rangeLane, eventId: editor.lanes[1]!.events[1]!.id },
    };
    project.elements = [element];
    project.items = [{ kind: 'element', id: element.id }];
    return {
        project: validateComposition(project),
        algorithm,
        definition,
        element,
        pointLane,
        rangeLane,
        classA,
        classB,
    };
}
