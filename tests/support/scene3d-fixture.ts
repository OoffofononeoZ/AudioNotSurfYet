import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { createComposition, validateComposition } from '../../src/visualizer/compositionCodec';
import { defaultCamera, defaultTransform3d } from '../../src/visualizer/scene3dTypes';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
import type { ElementDefinition } from '../../src/visualizer/resourceTypes';
import { WebGLRenderer } from 'three';

export const createSceneTestRenderer = (canvas: HTMLCanvasElement) =>
    new WebGLRenderer({ canvas, antialias: false, alpha: false });

export function scene3dFixture() {
    const a: AlgorithmDefinition = {
        id: 'test-world',
        version: 1,
        hash: '',
        apiVersion: 4,
        contract: {
            kind: 'visual',
            parameters: [],
            sharedParameters: [],
            historyParameters: [],
            renderSpace: 'world',
            executionModes: ['timeline', 'realtime'],
        },
        source: 'export function create(){return {prepareFrame(){return {passes:[]}}}}',
        programs: {
            mesh: {
                geometry: 'triangles',
                alphaMode: 'opaque',
                uniforms: {},
                vertex: 'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
                fragment: 'vec4 shade(){return vec4(1.,0.,0.,1.);}',
            },
        },
    };
    a.hash = resourceHash(a);
    const d: ElementDefinition = {
        id: 'test-world',
        version: 1,
        hash: '',
        algorithm: resourceRef(a),
        kind: 'visual',
        title: '测试世界元素',
        icon: 'square',
        parameters: [],
        scene3dDefaults: { camera: defaultCamera() },
    };
    d.hash = resourceHash(d);
    const p = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'world.wav',
        durationSeconds: 20,
        sampleRate: 48000,
    });
    const elements = [0, 1].map((_, i) => ({
        id: crypto.randomUUID(),
        resource: resourceRef(d),
        name: '物体' + i,
        enabled: true,
        layer: i,
        timing: { kind: 'manual' as const, startSeconds: 0, endSeconds: 20 },
        bindings: [],
        transform3d: defaultTransform3d(),
    }));
    const scene = {
        kind: 'scene3d' as const,
        id: crypto.randomUUID(),
        name: '三维测试场景',
        enabled: true,
        children: elements.map(e => e.id),
        startSeconds: 0,
        endSeconds: 20,
        camera: defaultCamera(),
    };
    return validateComposition({
        ...p,
        resources: { algorithms: [a], elements: [d], presets: [] },
        elements,
        items: [scene],
    });
}
