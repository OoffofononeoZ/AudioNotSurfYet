import { createComposition } from '../../src/visualizer/compositionCodec';
import { createDefinitionElement } from '../../src/visualizer/elementRegistry';
import { resourceHash, resourceRef } from '../../src/visualizer/resourceIdentity';
import { hashBytes } from '../../src/processing/sha256';
import type { LyricAsset } from '../../src/visualizer/lyricTypes';
import type { AlgorithmDefinition } from '../../src/visualizer/algorithmTypes';
import type { ElementDefinition } from '../../src/visualizer/resourceTypes';

export function lyricAsset(text = '[00:01.125]Hello world\n[00:03.000]你好，世界！'): LyricAsset {
    const bytes = new TextEncoder().encode(text);
    return { id: hashBytes(bytes), name: 'synthetic.lrc', data: btoa(String.fromCharCode(...bytes)) };
}
export function lyricFixture() {
    const algorithm: AlgorithmDefinition = {
        id: 'lyric-fixture',
        version: 1,
        hash: '',
        apiVersion: 5,
        contract: {
            kind: 'visual',
            parameters: [],
            historyParameters: [],
            sharedParameters: [],
            executionModes: ['timeline'],
            lyricInputs: [{ id: 'lyrics' }],
        },
        source: 'export function create(){return {prepareFrame(){return {passes:[]}}}}',
        programs: {
            text: {
                geometry: 'triangles',
                uniforms: { uText: { type: 'lyrics', inputId: 'lyrics' } },
                vertex: 'attribute vec2 edge; varying vec2 vUv; void main(){vUv=edge;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
                fragment:
                    'uniform sampler2D uText; varying vec2 vUv; void main(){float a=texture2D(uText,vUv).a;gl_FragColor=vec4(vec3(a),a);}',
            },
        },
    };
    algorithm.hash = resourceHash(algorithm);
    const definition: ElementDefinition = {
        id: 'lyric-fixture',
        version: 1,
        hash: '',
        title: '测试歌词',
        icon: 'square',
        kind: 'visual',
        algorithm: resourceRef(algorithm),
        parameters: [],
        lyricInputs: [{ id: 'lyrics', label: '歌词' }],
    };
    definition.hash = resourceHash(definition);
    const project = createComposition({
        contentHash: 'a'.repeat(64),
        fileName: 'test.wav',
        durationSeconds: 10,
        sampleRate: 48000,
    });
    const e = createDefinitionElement(definition, 10, 0);
    project.elements = [e];
    project.items = [{ kind: 'element', id: e.id }];
    project.resources = { algorithms: [algorithm], elements: [definition], presets: [] };
    return { project, algorithm, definition, element: e };
}
